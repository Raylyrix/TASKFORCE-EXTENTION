const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const cron = require('node-cron');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

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

    console.log('✅ Database initialized successfully');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
}

// Initialize database on startup
initDatabase();

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

function getBackendPublicUrl() {
  const url = process.env.BACKEND_PUBLIC_URL;
  if (!url) {
    console.warn('BACKEND_PUBLIC_URL not set - falling back to request host for redirects');
  }
  return url;
}

function buildGoogleOAuthUrl(state) {
  // Requires OAuth client configured for Web application
  const redirectUri = `${getBackendPublicUrl() || ''}/api/auth/callback`;
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
    const url = buildGoogleOAuthUrl(email ? `hint:${email}` : undefined);
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

    const redirectUri = `${getBackendPublicUrl() || ''}/api/auth/callback`;

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
      await pool.query('UPDATE users SET refresh_token = $1 WHERE email = $2', [refresh_token || '', email]);
      userId = existing.rows[0].id;
    } else {
      const insert = await pool.query('INSERT INTO users (email, refresh_token) VALUES ($1, $2) RETURNING id', [email, refresh_token || '']);
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
    
    if (!email || !refreshToken) {
      return res.status(400).json({ error: 'Email and refresh token required' });
    }

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
        [refreshToken, email]
      );
      userId = existingUser.rows[0].id;
    } else {
      // Create new user
      const result = await pool.query(
        'INSERT INTO users (email, refresh_token) VALUES ($1, $2) RETURNING id',
        [email, refreshToken]
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
    const { userId, email, scheduledFor } = req.body;
    
    if (!userId || !email || !scheduledFor) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      `INSERT INTO scheduled_emails 
       (user_id, to_email, cc, bcc, subject, body, scheduled_for, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled')
       RETURNING id`,
      [
        userId,
        email.to,
        email.cc || null,
        email.bcc || null,
        email.subject,
        email.body,
        scheduledFor
      ]
    );

    const emailId = result.rows[0].id;
    console.log(`📧 Email scheduled: ID ${emailId} for ${scheduledFor}`);

    res.json({ success: true, emailId });
  } catch (error) {
    console.error('Schedule email error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Schedule bulk emails
app.post('/api/emails/schedule-bulk', async (req, res) => {
  try {
    const { userId, emails, startTime, delay } = req.body;
    
    if (!userId || !emails || emails.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const emailIds = [];
    
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      // Calculate scheduled time for each email based on delay
      const scheduledTime = new Date(new Date(startTime).getTime() + (i * (delay || 1000)));
      
      const result = await pool.query(
        `INSERT INTO scheduled_emails 
         (user_id, to_email, cc, bcc, subject, body, scheduled_for, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled')
         RETURNING id`,
        [
          userId,
          email.to,
          email.cc || null,
          email.bcc || null,
          email.subject,
          email.body,
          scheduledTime
        ]
      );
      
      emailIds.push(result.rows[0].id);
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

async function getAccessToken(refreshToken) {
  try {
    const response = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
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
  try {
    console.log(`📤 Sending email ID ${emailRecord.id} to ${emailRecord.to_email}`);

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
    const response = await axios.post(
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
    return true;
  } catch (error) {
    console.error(`❌ Failed to send email ID ${emailRecord.id}:`, error.message);

    // Update email status with error
    await pool.query(
      'UPDATE scheduled_emails SET status = $1, error_message = $2 WHERE id = $3',
      ['failed', error.message, emailRecord.id]
    );

    // Update stats
    await pool.query(
      'UPDATE email_stats SET failed_count = failed_count + 1 WHERE user_id = $1',
      [emailRecord.user_id]
    );

    return false;
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

