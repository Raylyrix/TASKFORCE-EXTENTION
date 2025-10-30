const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const cron = require('node-cron');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
// CORS whitelist from ALLOWED_ORIGINS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.length === 0) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json());
// Basic security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Simple rate limiting (per-IP)
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX = 300; // 300 req/min
const ipBuckets = new Map();
app.use((req, res, next) => {
  const ip = req.headers['x-forwarded-for']?.toString().split(',')[0].trim() || req.ip;
  const now = Date.now();
  const bucket = ipBuckets.get(ip) || { count: 0, reset: now + RATE_LIMIT_WINDOW_MS };
  if (now > bucket.reset) {
    bucket.count = 0;
    bucket.reset = now + RATE_LIMIT_WINDOW_MS;
  }
  bucket.count += 1;
  ipBuckets.set(ip, bucket);
  if (bucket.count > RATE_LIMIT_MAX) return res.status(429).json({ error: 'Too many requests' });
  next();
});

// PostgreSQL Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database tables
async function initDatabase() {
  try {
    // Create tables if they don't exist
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        refresh_token TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS scheduled_emails (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        to_email VARCHAR(255) NOT NULL,
        cc VARCHAR(255),
        bcc VARCHAR(255),
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        scheduled_for TIMESTAMP NOT NULL,
        status VARCHAR(50) DEFAULT 'scheduled',
        sent_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS email_stats (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        sent_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        last_reset TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_scheduled_emails_status 
      ON scheduled_emails(status, scheduled_for)
    `);

    await pool.query(`
      DO $$
      BEGIN
        BEGIN
          ALTER TABLE scheduled_emails ADD COLUMN idempotency_key VARCHAR(255);
        EXCEPTION WHEN duplicate_column THEN
          NULL;
        END;
      END$$;
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_scheduled_emails_idempotency
      ON scheduled_emails(idempotency_key)
      WHERE idempotency_key IS NOT NULL
    `);

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
}

// Initialize database on startup
initDatabase();

// ============================================
// VALIDATION HELPERS
// ============================================

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function validateEmailAddress(email) {
  if (!isNonEmptyString(email)) return false;
  // Simple RFC-like regex
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
  return re.test(email.trim());
}

function parseFutureISODate(value) {
  if (!isNonEmptyString(value)) return { ok: false, error: 'scheduledFor is required' };
  const t = Date.parse(value);
  if (Number.isNaN(t)) return { ok: false, error: 'scheduledFor must be ISO date' };
  if (t < Date.now() - 60_000) return { ok: false, error: 'scheduledFor must be in the future' };
  return { ok: true, date: new Date(t) };
}

function sanitizeSubject(subject) {
  let s = (subject || '').toString();
  s = s.replace(/[\r\n\t]/g, ' ').trim();
  if (s.length > 256) s = s.slice(0, 256);
  return s;
}

function validateBody(body) {
  const MAX = 200 * 1024; // 200KB
  if (!isNonEmptyString(body)) return { ok: false, error: 'body is required' };
  const size = Buffer.byteLength(body, 'utf8');
  if (size > MAX) return { ok: false, error: `body too large (${size}b > ${MAX}b)` };
  return { ok: true };
}

function validateRecipientObject(emailObj) {
  const errors = [];
  const to = emailObj?.to;
  if (!validateEmailAddress(to)) errors.push('invalid to');
  const subject = sanitizeSubject(emailObj?.subject);
  const bodyV = validateBody(emailObj?.body);
  if (!bodyV.ok) errors.push(bodyV.error);
  const cc = emailObj?.cc ? [].concat(emailObj.cc).filter(Boolean) : [];
  const bcc = emailObj?.bcc ? [].concat(emailObj.bcc).filter(Boolean) : [];
  const invalidCc = cc.find((e) => !validateEmailAddress(e));
  const invalidBcc = bcc.find((e) => !validateEmailAddress(e));
  if (invalidCc) errors.push('invalid cc');
  if (invalidBcc) errors.push('invalid bcc');
  return { ok: errors.length === 0, errors, subject, cc, bcc };
}

// ============================================
// API ENDPOINTS
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// OAUTH 2.0 AUTHORIZATION CODE FLOW (REFRESH TOKEN)
// ============================================

function getBackendPublicUrl(req) {
  const url = process.env.BACKEND_PUBLIC_URL;
  if (url && url.trim().length > 0) return url.replace(/\/$/, '');
  // Fallback: derive from request
  const proto = (req.headers['x-forwarded-proto'] || 'https').toString();
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString();
  const base = `${proto}://${host}`;
  console.warn('BACKEND_PUBLIC_URL not set - derived from request as:', base);
  return base;
}

function buildGoogleOAuthUrl(req, state) {
  // Requires OAuth client configured for Web application
  const redirectUri = `${getBackendPublicUrl(req)}/api/auth/callback`;
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/contacts',
      'https://www.googleapis.com/auth/contacts.readonly',
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'email',
      'profile'
    ].join(' '),
    state: state || ''
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

// Start OAuth - redirects to Google Consent Screen
app.get('/api/auth/start', (req, res) => {
  try {
    const { email } = req.query; // optional hint
    const url = buildGoogleOAuthUrl(req, email ? `hint:${email}` : undefined);
    res.redirect(url);
  } catch (e) {
    console.error('Error building OAuth URL:', e);
    res.status(500).send('OAuth initialization failed');
  }
});

// OAuth callback - exchanges code for refresh token and stores it
app.get('/api/auth/callback', async (req, res) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.status(400).send('Missing authorization code');
    }

    const redirectUri = `${getBackendPublicUrl(req)}/api/auth/callback`;

    // Exchange code for tokens
    const tokenResp = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri
    });

    const { access_token, refresh_token, id_token } = tokenResp.data;
    if (!refresh_token) {
      console.warn('No refresh_token returned. Ensure prompt=consent & access_type=offline and a new consent session.');
    }

    // Get user email via tokeninfo / userinfo
    const userInfo = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const email = userInfo.data?.email;
    if (!email) {
      return res.status(500).send('Could not determine user email');
    }

    // Upsert user with refresh token
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    let userId;
    if (existing.rows.length > 0) {
      await pool.query('UPDATE users SET refresh_token = $1 WHERE email = $2', [refresh_token ? encrypt(refresh_token) : '', email]);
      userId = existing.rows[0].id;
    } else {
      const insert = await pool.query('INSERT INTO users (email, refresh_token) VALUES ($1, $2) RETURNING id', [email, refresh_token ? encrypt(refresh_token) : '']);
      userId = insert.rows[0].id;
      await pool.query('INSERT INTO email_stats (user_id) VALUES ($1)', [userId]);
    }

    // Simple success page
    res.send(`
      <html>
        <head><title>Connected</title></head>
        <body style="font-family:Arial; padding:24px;">
          <h2>✅ Connected</h2>
          <p>Your account <b>${email}</b> is now connected. You can close this tab and return to the extension.</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('OAuth callback error:', error.response?.data || error.message);
    res.status(500).send('Authentication failed');
  }
});

// Register/authenticate user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, refreshToken } = req.body;
    
    if (!validateEmailAddress(email)) return res.status(400).json({ error: 'Invalid email' });
    if (!isNonEmptyString(refreshToken)) return res.status(400).json({ error: 'refreshToken required' });

    // Check if user exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    let userId;
    
    if (existingUser.rows.length > 0) {
      // Update refresh token
      await pool.query(
        'UPDATE users SET refresh_token = $1 WHERE email = $2',
        [encrypt(refreshToken), email]
      );
      userId = existingUser.rows[0].id;
    } else {
      // Create new user
      const result = await pool.query(
        'INSERT INTO users (email, refresh_token) VALUES ($1, $2) RETURNING id',
        [email, encrypt(refreshToken)]
      );
      userId = result.rows[0].id;

      // Initialize stats
      await pool.query(
        'INSERT INTO email_stats (user_id) VALUES ($1)',
        [userId]
      );
    }

    res.json({ success: true, userId });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Schedule email
app.post('/api/emails/schedule', async (req, res) => {
  try {
    const { userId, email, scheduledFor, idempotencyKey } = req.body;
    if (!Number.isInteger(userId)) return res.status(400).json({ error: 'userId must be integer' });
    if (!email || typeof email !== 'object') return res.status(400).json({ error: 'email object required' });
    const rec = validateRecipientObject(email);
    if (!rec.ok) return res.status(422).json({ error: 'invalid email payload', details: rec.errors });
    const date = parseFutureISODate(scheduledFor);
    if (!date.ok) return res.status(422).json({ error: date.error });
    
    if (!userId || !email || !scheduledFor) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const key = idempotencyKey || crypto.createHash('sha256').update(`${userId}|${email.to}|${rec.subject}|${date.date.toISOString()}`).digest('hex').slice(0, 64);
    const result = await pool.query(
      `INSERT INTO scheduled_emails 
       (user_id, to_email, cc, bcc, subject, body, scheduled_for, idempotency_key, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled')
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING id`,
      [
        userId,
        email.to,
        rec.cc.length ? rec.cc.join(',') : null,
        rec.bcc.length ? rec.bcc.join(',') : null,
        rec.subject,
        email.body,
        date.date,
        key
      ]
    );

    if (result.rows.length === 0) {
      return res.json({ success: true, duplicate: true });
    }
    const emailId = result.rows[0].id;
    console.log(`📧 Email scheduled: ID ${emailId} for ${scheduledFor}`);
    res.json({ success: true, emailId, idempotencyKey: key });
  } catch (error) {
    console.error('Schedule email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Schedule bulk emails
app.post('/api/emails/schedule-bulk', async (req, res) => {
  try {
    const { userId, emails, startTime, delay } = req.body;
    if (!Number.isInteger(userId)) return res.status(400).json({ error: 'userId must be integer' });
    if (!Array.isArray(emails) || emails.length === 0) return res.status(400).json({ error: 'emails array required' });
    if (emails.length > 1000) return res.status(413).json({ error: 'Too many emails in one batch (max 1000)' });
    const delayMs = Number.isInteger(delay) ? delay : 1000;
    const startParse = parseFutureISODate(startTime || new Date(Date.now() + 1000).toISOString());
    if (!startParse.ok) return res.status(422).json({ error: startParse.error });

    const emailIds = [];
    
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      const rec = validateRecipientObject(email);
      if (!rec.ok) continue; // skip invalid entries silently
      // Calculate scheduled time for each email based on delay
      const scheduledTime = new Date(startParse.date.getTime() + (i * delayMs));
      
      const key = crypto.createHash('sha256').update(`${userId}|${email.to}|${email.subject}|${scheduledTime.toISOString()}`).digest('hex').slice(0, 64);
      const result = await pool.query(
        `INSERT INTO scheduled_emails 
         (user_id, to_email, cc, bcc, subject, body, scheduled_for, idempotency_key, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled')
         ON CONFLICT (idempotency_key) DO NOTHING
         RETURNING id`,
        [
          userId,
          email.to,
          rec.cc.length ? rec.cc.join(',') : null,
          rec.bcc.length ? rec.bcc.join(',') : null,
          rec.subject,
          email.body,
          scheduledTime,
          key
        ]
      );
      
      if (result.rows.length > 0) {
        emailIds.push(result.rows[0].id);
      }
    }

    console.log(`📧 Bulk emails scheduled: ${emailIds.length} emails from ${startTime}`);
    res.json({ success: true, emailIds, count: emailIds.length });
  } catch (error) {
    console.error('Schedule bulk emails error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user's scheduled emails
app.get('/api/emails/scheduled/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await pool.query(
      `SELECT * FROM scheduled_emails 
       WHERE user_id = $1 
       AND status = 'scheduled'
       ORDER BY scheduled_for ASC`,
      [userId]
    );

    res.json({ success: true, emails: result.rows });
  } catch (error) {
    console.error('Get scheduled emails error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Metrics: basic counters
app.get('/metrics', async (req, res) => {
  try {
    const totals = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM scheduled_emails WHERE status='scheduled') AS queued,
        (SELECT COUNT(*) FROM scheduled_emails WHERE status='sent') AS sent,
        (SELECT COUNT(*) FROM scheduled_emails WHERE status='failed') AS failed
    `);
    res.json({ success: true, metrics: totals.rows[0] });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Cancel scheduled email
app.delete('/api/emails/schedule/:emailId', async (req, res) => {
  try {
    const { emailId } = req.params;
    
    const result = await pool.query(
      'UPDATE scheduled_emails SET status = $1 WHERE id = $2',
      ['cancelled', emailId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Cancel email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get user stats
app.get('/api/stats/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM email_stats WHERE user_id = $1',
      [userId]
    );

    res.json({ success: true, stats: result.rows[0] || {} });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GOOGLE OAUTH HELPERS
// ============================================

function getEncKey() {
  const key = (process.env.JWT_SECRET || '').padEnd(32, '0').slice(0, 32);
  return Buffer.from(key);
}
function encrypt(text) {
  if (!text) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getEncKey(), iv);
  const enc = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}
function decrypt(blob) {
  if (!blob) return '';
  const data = Buffer.from(blob, 'base64');
  const iv = data.slice(0, 12);
  const tag = data.slice(12, 28);
  const enc = data.slice(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getEncKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString('utf8');
}

async function getAccessToken(refreshToken) {
  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: decrypt(refreshToken),
      grant_type: 'refresh_token'
    });

    return response.data.access_token;
  } catch (error) {
    console.error('Token refresh error:', error.response?.data || error.message);
    throw error;
  }
}

function createRawEmail(to, subject, body, cc = [], bcc = []) {
  const from = 'from@example.com'; // Will be replaced by Gmail
  let email = `From: ${from}\r\n`;
  email += `To: ${Array.isArray(to) ? to.join(', ') : to}\r\n`;
  
  if (cc && cc.length > 0) {
    email += `Cc: ${cc.join(', ')}\r\n`;
  }
  
  if (bcc && bcc.length > 0) {
    email += `Bcc: ${bcc.join(', ')}\r\n`;
  }
  
  email += `Subject: ${subject}\r\n`;
  email += `Content-Type: text/html; charset=utf-8\r\n`;
  email += `\r\n${body}`;

  return Buffer.from(email).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
}

// ============================================
// EMAIL SENDING LOGIC
// ============================================

async function sendEmail(emailRecord) {
  // Helper: sleep
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const isTransient = (err) => {
    const msg = (err?.message || '').toLowerCase();
    const code = err?.response?.status;
    return (
      code === 429 ||
      (code >= 500 && code < 600) ||
      msg.includes('timeout') ||
      msg.includes('etimedout') ||
      msg.includes('ecconnreset') ||
      msg.includes('socket hang up')
    );
  };

  const maxAttempts = 5;
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      attempt += 1;
      console.log(`📤 Sending email ID ${emailRecord.id} to ${emailRecord.to_email} (attempt ${attempt}/${maxAttempts})`);

      // Get user's refresh token
      const userResult = await pool.query(
        'SELECT refresh_token FROM users WHERE id = $1',
        [emailRecord.user_id]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const refreshToken = userResult.rows[0].refresh_token;

      // Get fresh access token
      const accessToken = await getAccessToken(refreshToken);

      // Prepare email
      const cc = emailRecord.cc ? emailRecord.cc.split(',').map(e => e.trim()) : [];
      const bcc = emailRecord.bcc ? emailRecord.bcc.split(',').map(e => e.trim()) : [];
      
      const raw = createRawEmail(
        emailRecord.to_email,
        emailRecord.subject,
        emailRecord.body,
        cc,
        bcc
      );

      // Send via Gmail API
      await axios.post(
        'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        { raw },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Update email status
      await pool.query(
        'UPDATE scheduled_emails SET status = $1, sent_at = $2 WHERE id = $3',
        ['sent', new Date(), emailRecord.id]
      );

      // Update stats
      await pool.query(
        'UPDATE email_stats SET sent_count = sent_count + 1 WHERE user_id = $1',
        [emailRecord.user_id]
      );

      console.log(`✅ Email sent successfully: ID ${emailRecord.id}`);
      // Optional webhook
      if (process.env.WEBHOOK_URL) {
        try {
          await axios.post(process.env.WEBHOOK_URL, {
            type: 'email_sent',
            id: emailRecord.id,
            to: emailRecord.to_email,
            subject: emailRecord.subject,
            sentAt: new Date().toISOString()
          });
        } catch (e) {
          console.warn('Webhook failed:', e.message);
        }
      }
      return true;
    } catch (error) {
      const transient = isTransient(error);
      console.warn(`❌ Send failed (attempt ${attempt}/${maxAttempts}) id=${emailRecord.id} transient=${transient}:`, error.message);
      if (attempt >= maxAttempts || !transient) {
        // Final failure
        await pool.query(
          'UPDATE scheduled_emails SET status = $1, error_message = $2 WHERE id = $3',
          ['failed', error.message, emailRecord.id]
        );
        await pool.query(
          'UPDATE email_stats SET failed_count = failed_count + 1 WHERE user_id = $1',
          [emailRecord.user_id]
        );
        if (process.env.WEBHOOK_URL) {
          try {
            await axios.post(process.env.WEBHOOK_URL, {
              type: 'email_failed',
              id: emailRecord.id,
              to: emailRecord.to_email,
              subject: emailRecord.subject,
              error: error.message,
              failedAt: new Date().toISOString()
            });
          } catch (e) {
            console.warn('Webhook failed:', e.message);
          }
        }
        return false;
      }
      // Exponential backoff with jitter: 1s, 2s, 4s, 8s... + 0-500ms
      const backoff = Math.min(8000, 1000 * Math.pow(2, attempt - 1)) + Math.floor(Math.random() * 500);
      await sleep(backoff);
    }
  }
}

// ============================================
// CRON JOB - CHECK FOR DUE EMAILS
// ============================================

// Run every minute
cron.schedule('* * * * *', async () => {
  try {
    console.log('⏰ Checking for due emails...');
    
    const now = new Date();
    
    // Get all due emails
    const result = await pool.query(
      `SELECT * FROM scheduled_emails 
       WHERE status = 'scheduled' 
       AND scheduled_for <= $1
       ORDER BY scheduled_for ASC
       LIMIT 100`,
      [now]
    );

    if (result.rows.length > 0) {
      console.log(`📬 Found ${result.rows.length} due email(s)`);
      
      // Send each email
      for (const email of result.rows) {
        await sendEmail(email);
        // Rate limiting: wait 1 second between emails
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    console.error('❌ Cron job error:', error);
  }
});

// Daily retention job at 03:00
cron.schedule('0 3 * * *', async () => {
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const res1 = await pool.query('DELETE FROM scheduled_emails WHERE status IN (\'sent\', \'failed\') AND COALESCE(sent_at, created_at) < $1', [cutoff]);
    console.log(`🧹 Retention: deleted ${res1.rowCount} old records`);
  } catch (e) {
    console.error('Retention job error:', e.message);
  }
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log('🚀 TaskForce Email Backend Server Started!');
  console.log(`📍 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⏰ Cron jobs active - checking for due emails every minute`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

