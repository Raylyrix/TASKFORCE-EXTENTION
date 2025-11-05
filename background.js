// Background service worker for email scheduling and automation
// TaskForce Email Manager

// Import backend integration for hybrid system
try {
  importScripts('backend-integration.js');
} catch (error) {
  console.warn('Backend integration not available:', error);
}

// Install event - set up initial data
chrome.runtime.onInstalled.addListener(() => {
  console.log('TaskForce Email Manager installed');
  
  // Initialize default settings
  chrome.storage.local.set({
    scheduledEmails: [],
    templates: [],
    autoFollowUpRules: [],
    filters: [],
    trackedEmails: [],
    quickReplies: [],
    emailStats: {
      sentToday: 0,
      lastReset: new Date().toDateString()
    },
    settings: {
      autoFollowUpEnabled: false,
      bulkSendDelay: 1000, // ms between emails in bulk
      maxDailySend: 500,
      enableTracking: false,
      enableDarkMode: false
    },
    needsAuth: false,
    authPopupOpened: 0
  });
  
  // Set up recurring alarm for follow-ups check (every 6 hours)
  chrome.alarms.create('checkFollowUps', {
    periodInMinutes: 360 // 6 hours
  });
  
  // Set up notification click handler
  chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
    if (buttonIndex === 0) {
      // "Authenticate Now" button clicked
      chrome.action.openPopup();
    }
  });
});

// Check for authentication needs periodically
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.needsAuth && changes.needsAuth.newValue) {
    console.log('Authentication needed - triggering auto-popup');
    openPopupForAuth();
  }
});

// Handle alarms for scheduled emails
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('sendEmail_')) {
    const emailId = alarm.name.replace('sendEmail_', '');
    await sendScheduledEmail(emailId);
  } else if (alarm.name === 'checkFollowUps') {
    await checkAutoFollowUps();
  }
});

// Send a scheduled email
async function sendScheduledEmail(emailId) {
  try {
    // Check if email should be sent (for recurring emails)
    const result = await chrome.storage.local.get('scheduledEmails');
    const scheduledEmails = result.scheduledEmails || [];
    const emailIndex = scheduledEmails.findIndex(e => e.id === emailId);
    
    if (emailIndex === -1) {
      console.error('Email not found:', emailId);
      return;
    }
    
    const email = scheduledEmails[emailIndex];
    
    // Check daily sending limit
    if (!(await checkDailyLimit())) {
      console.warn('Daily sending limit reached. Email postponed:', emailId);
      email.status = 'postponed';
      scheduledEmails[emailIndex] = email;
      await chrome.storage.local.set({ scheduledEmails });
      return;
    }
    
    // Get access token
    const token = await getAccessToken();
    if (!token) {
      console.error('No access token available');
      email.status = 'error';
      email.error = 'Not authenticated';
      scheduledEmails[emailIndex] = email;
      await chrome.storage.local.set({ scheduledEmails });
      return;
    }
    
    // Handle CC and BCC
    const cc = email.cc ? email.cc.split(',').map(e => e.trim()) : [];
    const bcc = email.bcc ? email.bcc.split(',').map(e => e.trim()) : [];
    
    // Send email via Gmail API
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        raw: createRawEmail(email.to, email.subject, email.body, cc, bcc)
      })
    });
    
    if (response.ok) {
      const responseData = await response.json();
      email.status = 'sent';
      email.sentAt = new Date().toISOString();
      email.messageId = responseData.id;
      
      // Track email if enabled
      await trackEmail(email.to, email.subject, email.body);
      
      // Notify successful send
      notifyEmailSent(email);
      
      // Handle recurring emails
      if (email.recurring && email.recurring !== 'none') {
        const nextDate = getNextRecurringDate(email.scheduledFor, email.recurring);
        email.scheduledFor = nextDate;
        email.status = 'scheduled';
        
        // Schedule next occurrence
        chrome.alarms.create(`sendEmail_${emailId}`, {
          when: new Date(nextDate).getTime()
        });
      } else {
        // Remove from scheduled emails if not recurring
        scheduledEmails.splice(emailIndex, 1);
      }
      
      // Update stats
      await incrementSentCounter();
      
      console.log('Email sent successfully:', emailId);
    } else {
      const errorText = await response.text();
      console.error('Failed to send email:', errorText);
      email.status = 'error';
      email.error = errorText;
      scheduledEmails[emailIndex] = email;
    }
    
    await chrome.storage.local.set({ scheduledEmails });
  } catch (error) {
    console.error('Error sending scheduled email:', error);
    const result = await chrome.storage.local.get('scheduledEmails');
    const scheduledEmails = result.scheduledEmails || [];
    const emailIndex = scheduledEmails.findIndex(e => e.id === emailId);
    if (emailIndex !== -1) {
      scheduledEmails[emailIndex].status = 'error';
      scheduledEmails[emailIndex].error = error.message;
      await chrome.storage.local.set({ scheduledEmails });
    }
  }
}

// Check auto-follow-up conditions
async function checkAutoFollowUps() {
  try {
    const result = await chrome.storage.local.get(['autoFollowUpRules', 'settings']);
    const rules = result.autoFollowUpRules || [];
    const settings = result.settings || {};
    
    if (!settings.autoFollowUpEnabled) return;
    
    for (const rule of rules) {
      await processFollowUpRule(rule);
    }
  } catch (error) {
    console.error('Error checking follow-ups:', error);
  }
}

// Process a single follow-up rule
async function processFollowUpRule(rule) {
  try {
    console.log('Checking follow-up rule:', rule.name);
    
    // Get access token
    const token = await getAccessToken();
    if (!token) {
      console.error('No access token for follow-up check');
      return;
    }
    
    // Build Gmail search query from rule (labels/folders/query)
    let q = 'from:me';
    try {
      if (rule && (rule.gmailQuery || (Array.isArray(rule.labels) && rule.labels.length))) {
        const parts = [];
        if (rule.gmailQuery) parts.push(rule.gmailQuery);
        if (Array.isArray(rule.labels)) {
          rule.labels.forEach((l) => {
            if (l && typeof l === 'string') parts.push(`label:${l}`);
          });
        }
        if (parts.length) q = parts.join(' ');
      }
    } catch (_) { /* ignore */ }

    // Get recent messages matching query
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=50&q=${encodeURIComponent(q)}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (!response.ok) return;
    
    const data = await response.json();
    if (!data.messages) return;
    
    // Check each message for follow-up conditions
    for (const message of data.messages) {
      await checkMessageNeedsFollowUp(message.id, rule, token);
    }
  } catch (error) {
    console.error('Error processing follow-up rule:', error);
  }
}

// Check if a specific message needs follow-up
async function checkMessageNeedsFollowUp(messageId, rule, token) {
  try {
    // Get message details
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (!response.ok) return;
    
    const message = await response.json();
    
    // Check if already sent follow-up
    const followUpKey = `followup_${messageId}`;
    const followUpSent = await chrome.storage.local.get(followUpKey);
    if (followUpSent[followUpKey]) return;
    
    // Check time since sent
    const sentDate = new Date(parseInt(message.internalDate));
    const now = new Date();
    const daysSince = (now - sentDate) / (1000 * 60 * 60 * 24);
    
    if (daysSince >= rule.days) {
      // Send follow-up
      await sendFollowUpEmail(message, rule, token);
      
      // Mark as follow-up sent
      await chrome.storage.local.set({ [followUpKey]: true });
    }
  } catch (error) {
    console.error('Error checking message follow-up:', error);
  }
}

// Send follow-up email
async function sendFollowUpEmail(originalMessage, rule, token) {
  try {
    // Get template
    const templates = await chrome.storage.local.get('templates');
    const template = templates.templates?.find(t => t.name === rule.template);
    
    if (!template) {
      console.error('Template not found:', rule.template);
      return;
    }
    
    // Extract recipient from original message
    const headers = originalMessage.payload.headers;
    const toHeader = headers.find(h => h.name.toLowerCase() === 'to');
    const recipient = toHeader?.value || '';
    
    if (!recipient) return;
    
    // Send email
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        raw: createRawEmail(
          recipient,
          template.subject,
          template.body
        )
      })
    });
    
    if (response.ok) {
      console.log('Follow-up sent successfully');
      await incrementSentCounter();
    }
  } catch (error) {
    console.error('Error sending follow-up:', error);
  }
}

// Get OAuth access token
async function getAccessToken(interactive = false) {
  function getTokenOnce(flag) {
    return new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: flag }, (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(token);
        }
      });
    });
  }

  try {
    const token = await getTokenOnce(interactive);
    chrome.storage.local.set({ needsAuth: false });
    return token;
  } catch (error) {
    const msg = (error?.message || '').toLowerCase();
    if (!interactive && (msg.includes('oauth') || msg.includes('auth') || msg.includes('invalid_grant') || msg.includes('not signed in'))) {
      chrome.storage.local.set({ needsAuth: true });
      openPopupForAuth();
      const token = await getTokenOnce(true);
      chrome.storage.local.set({ needsAuth: false });
      return token;
    }
    throw error;
  }
}

// Auto-open popup when authentication is required
function openPopupForAuth() {
  chrome.storage.local.get('authPopupOpened', (result) => {
    const lastPopupTime = result.authPopupOpened || 0;
    const now = Date.now();
    
    // Don't spam - only open popup once per 30 seconds
    if (now - lastPopupTime > 30000) {
      // Open popup programmatically
      chrome.action.openPopup((popupUrl) => {
        if (chrome.runtime.lastError) {
          console.log('Could not open popup:', chrome.runtime.lastError.message);
          // Fallback: Send notification
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'TaskForce Email Manager',
            message: 'Authentication required. Click extension icon to authenticate.',
            buttons: [{ title: 'Authenticate Now' }]
          });
        } else {
          chrome.storage.local.set({ authPopupOpened: now });
        }
      });
    }
  });
}

// Create raw email format for Gmail API
function createRawEmail(to, subject, body, cc = [], bcc = []) {
  try {
    // Inject tracking pixel and link-wrapping when enabled and backend URL is configured
    if (AEM_SETTINGS?.enableTracking && typeof BACKEND_URL !== 'undefined' && BACKEND_URL) {
      const mid = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      body = buildTrackedBody(body, mid);
    }
    // Append TaskForce watermark
    body = appendWatermark(body);
  } catch (_) {
    // Non-fatal: fall through without tracking injection
  }
  const headers = [];
  
  // Add To header
  if (to && Array.isArray(to)) {
    headers.push(`To: ${to.join(', ')}`);
  } else {
    headers.push(`To: ${to || ''}`);
  }
  
  // Add CC header if present
  if (cc && cc.length > 0) {
    headers.push(`Cc: ${cc.join(', ')}`);
  }
  
  // Add BCC header if present
  if (bcc && bcc.length > 0) {
    headers.push(`Bcc: ${bcc.join(', ')}`);
  }
  
  headers.push(`Subject: ${subject}`);
  headers.push('MIME-Version: 1.0');
  headers.push('Content-Type: text/html; charset=utf-8');
  headers.push('Content-Transfer-Encoding: 7bit');
  headers.push(''); // Empty line before body
  
  const email = [...headers, body].join('\n');
  
  // Convert to base64url encoding
  return btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

// Message handler addition for labels fetch
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request && request.action === 'fetchGmailLabels') {
    (async () => {
      try {
        const labels = await (async function() {
          const token = await getAccessToken();
          if (!token) throw new Error('Not authenticated');
          const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (!resp.ok) throw new Error(`Labels fetch failed (${resp.status})`);
          const data = await resp.json();
          return Array.isArray(data.labels) ? data.labels : [];
        })();
        sendResponse({ success: true, labels });
      } catch (e) {
        sendResponse({ success: false, error: e?.message || 'Labels fetch error' });
      }
    })();
    return true;
  }
  
  if (request && request.action === 'createMeetEventsBulk') {
    (async () => {
      try {
        const { recipients = [], title = 'Meeting', startTime, durationMin = 30 } = request;
        const token = await getAccessToken(true);
        if (!token) {
          sendResponse({ success: false, error: 'Not authenticated' });
          return;
        }
        const start = startTime ? new Date(startTime) : new Date(Date.now() + 60 * 60 * 1000);
        const end = new Date(start.getTime() + (parseInt(durationMin, 10) || 30) * 60 * 1000);
        const links = {};
        for (const r of recipients) {
          const event = {
            summary: title.replace(/\{\{\s*email\s*\}\}/ig, r),
            start: { dateTime: start.toISOString() },
            end: { dateTime: end.toISOString() },
            attendees: [{ email: r }],
            conferenceData: {
              createRequest: {
                requestId: `${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
                conferenceSolutionKey: { type: 'hangoutsMeet' }
              }
            }
          };
          const resp = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
          });
          if (resp.ok) {
            const data = await resp.json();
            const meet = (data.conferenceData && data.conferenceData.entryPoints && data.conferenceData.entryPoints.find(e => e.entryPointType === 'video'))?.uri || '';
            links[r] = meet || data.hangoutLink || '';
          } else {
            links[r] = '';
          }
          await new Promise(res => setTimeout(res, 150));
        }
        sendResponse({ success: true, links, start: start.toISOString(), end: end.toISOString() });
      } catch (e) {
        sendResponse({ success: false, error: e?.message || 'Failed to create events' });
      }
    })();
    return true;
  }

  if (request && request.action === 'generateAvailabilitySlots') {
    (async () => {
      try {
        const days = request.daysAhead || 14;
        const windowStart = request.windowStart || '09:00';
        const windowEnd = request.windowEnd || '17:00';
        const slotMinutes = request.slotMinutes || 30;
        const gapMinutes = request.gapMinutes || 0;

        const token = await getAccessToken(true);
        if (!token) { sendResponse({ success: false, error: 'Not authenticated' }); return; }

        const now = new Date();
        const timeMin = now.toISOString();
        const timeMax = new Date(now.getTime() + days*24*60*60*1000).toISOString();

        // Fetch primary calendar events (busy times)
        const calResp = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const calJson = calResp.ok ? await calResp.json() : { items: [] };
        const busy = (calJson.items||[]).map(e => ({
          start: new Date(e.start?.dateTime || e.start?.date),
          end: new Date(e.end?.dateTime || e.end?.date)
        }));

        // Generate slots
        const slots = [];
        for (let d = 0; d < days; d++) {
          const day = new Date(now.getFullYear(), now.getMonth(), now.getDate()+d);
          const [sh, sm] = windowStart.split(':').map(n=>parseInt(n,10));
          const [eh, em] = windowEnd.split(':').map(n=>parseInt(n,10));
          let cursor = new Date(day.getFullYear(), day.getMonth(), day.getDate(), sh, sm, 0);
          const endDay = new Date(day.getFullYear(), day.getMonth(), day.getDate(), eh, em, 0);
          while (cursor < endDay) {
            const slotStart = new Date(cursor);
            const slotEnd = new Date(cursor.getTime() + slotMinutes*60*1000);
            cursor = new Date(slotEnd.getTime() + gapMinutes*60*1000);
            if (slotEnd > endDay) break;
            // skip past slots
            if (slotStart < now) continue;
            // conflict check
            const conflict = busy.some(b => !(slotEnd <= b.start || slotStart >= b.end));
            if (!conflict) {
              slots.push({ start: slotStart.toISOString(), end: slotEnd.toISOString() });
            }
            if (slots.length >= 1000) break;
          }
          if (slots.length >= 1000) break;
        }
        sendResponse({ success: true, slots });
      } catch (e) {
        sendResponse({ success: false, error: e?.message || 'Availability generation failed' });
      }
    })();
    return true;
  }
});

// Helper to wrap links and append a 1x1 tracking pixel via backend
function buildTrackedBody(html, messageId) {
  try {
    const base = (typeof BACKEND_URL !== 'undefined' ? BACKEND_URL : '').replace(/\/$/, '');
    if (!base) return html;
    // Replace hrefs with backend redirect
    const replaced = html.replace(/href=\"(https?:\/\/[^\"]+)\"/gi, (m, url) => {
      try {
        const wrapped = `${base}/t/c?m=${encodeURIComponent(messageId)}&u=${encodeURIComponent(url)}`;
        return `href="${wrapped}"`;
      } catch (_) {
        return m;
      }
    });
    const pixel = `<img src="${base}/t/o?m=${encodeURIComponent(messageId)}" width="1" height="1" style="display:none;"/>`;
    // Ensure pixel appended once
    if (replaced.includes('/t/o?m=')) return replaced;
    return replaced + `\n${pixel}`;
  } catch (_) {
    return html;
  }
}

// Append TaskForce watermark footer if not already present
function appendWatermark(html) {
  try {
    if (typeof html !== 'string') return html;
    if (html.toLowerCase().includes('taskforce automated mailer')) return html;
    const footer = `\n<div style="margin-top:16px;font-size:11px;line-height:1.3;color:#5f6368;">Sent using <strong>TaskForce Automated Mailer</strong></div>`;
    return html + footer;
  } catch (_) {
    return html;
  }
}

// Get next recurring date
function getNextRecurringDate(currentDate, frequency) {
  const date = new Date(currentDate);
  
  switch (frequency) {
    case 'daily':
      date.setDate(date.getDate() + 1);
      break;
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    default:
      return currentDate;
  }
  
  return date.toISOString();
}

// Check daily sending limit
async function checkDailyLimit() {
  const result = await chrome.storage.local.get(['emailStats', 'settings']);
  const stats = result.emailStats || { sentToday: 0 };
  const settings = result.settings || {};
  const maxDaily = settings.maxDailySend || 500;
  
  // Reset counter if new day
  if (stats.lastReset !== new Date().toDateString()) {
    stats.sentToday = 0;
    stats.lastReset = new Date().toDateString();
    await chrome.storage.local.set({ emailStats: stats });
  }
  
  return stats.sentToday < maxDaily;
}

// Increment sent counter
async function incrementSentCounter() {
  const result = await chrome.storage.local.get('emailStats');
  const stats = result.emailStats || { sentToday: 0 };
  
  // Reset if new day
  if (stats.lastReset !== new Date().toDateString()) {
    stats.sentToday = 0;
    stats.lastReset = new Date().toDateString();
  }
  
  stats.sentToday++;
  await chrome.storage.local.set({ emailStats: stats });
}

// Send manual follow-up email
async function sendManualFollowUpEmail(email, subject, message) {
  try {
    // Check daily sending limit
    if (!(await checkDailyLimit())) {
      throw new Error('Daily sending limit reached');
    }
    
    // Get access token
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    // Send email via Gmail API
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        raw: createRawEmail(email.to, subject, message)
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gmail API error: ${errorText}`);
    }
    
    // Track this email for reply detection
    const result = await chrome.storage.local.get('emailReplies');
    const emailReplies = result.emailReplies || [];
    
    emailReplies.push({
      id: Date.now().toString(),
      to: email.to,
      subject: email.subject,
      body: message,
      sentAt: new Date().toISOString(),
      hasReplied: false,
      isFollowUp: true
    });
    
    await chrome.storage.local.set({ emailReplies });
    
    // Increment stats
    await incrementSentCounter();
    
    // Update follow-ups sent count
    const stats = await chrome.storage.local.get('emailStats');
    const emailStats = stats.emailStats || { sentToday: 0, followUpsSent: 0 };
    emailStats.followUpsSent = (emailStats.followUpsSent || 0) + 1;
    await chrome.storage.local.set({ emailStats });
    
    console.log('Manual follow-up sent successfully to:', email.to);
  } catch (error) {
    console.error('Error sending manual follow-up:', error);
    throw error;
  }
}

// Track email opens
async function trackEmailOpen(emailId, timestamp) {
  try {
    const result = await chrome.storage.local.get('trackedEmails');
    const trackedEmails = result.trackedEmails || [];
    
    const tracked = trackedEmails.find(e => e.id === emailId);
    if (tracked) {
      if (!tracked.opened) {
        tracked.opened = true;
        tracked.openedAt = timestamp || new Date().toISOString();
        tracked.openedCount = 1;
      } else {
        tracked.openedCount++;
      }
    } else {
      trackedEmails.push({
        id: emailId,
        opened: true,
        openedAt: timestamp || new Date().toISOString(),
        openedCount: 1,
        linkClicks: []
      });
    }
    
    await chrome.storage.local.set({ trackedEmails });
    
    // Show notification
    createNotification('Email Opened!', 'Someone opened your tracked email', 'open');
    
    console.log('Email opened:', emailId);
  } catch (error) {
    console.error('Error tracking email open:', error);
  }
}

// Track link clicks
async function trackLinkClick(emailId, linkUrl, timestamp) {
  try {
    const result = await chrome.storage.local.get('trackedEmails');
    const trackedEmails = result.trackedEmails || [];
    
    const tracked = trackedEmails.find(e => e.id === emailId);
    if (tracked) {
      if (!tracked.linkClicks) {
        tracked.linkClicks = [];
      }
      tracked.linkClicks.push({
        url: linkUrl,
        clickedAt: timestamp || new Date().toISOString()
      });
    } else {
      trackedEmails.push({
        id: emailId,
        opened: false,
        linkClicks: [{
          url: linkUrl,
          clickedAt: timestamp || new Date().toISOString()
        }]
      });
    }
    
    await chrome.storage.local.set({ trackedEmails });
    
    // Show notification
    createNotification('Link Clicked!', `Someone clicked: ${linkUrl.substring(0, 30)}...`, 'click');
    
    console.log('Link clicked in email:', emailId, linkUrl);
  } catch (error) {
    console.error('Error tracking link click:', error);
  }
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'scheduleEmail') {
    scheduleEmail(request.email).then(() => sendResponse({ success: true }));
    return true; // Will respond asynchronously
  }
  
  if (request.action === 'sendBulkEmails') {
    sendBulkEmails(request.emails).then(() => sendResponse({ success: true }));
    return true;
  }
  
  if (request.action === 'fetchSheetsData') {
    fetchSheetsData(request.sheetId).then((data) => {
      sendResponse({ success: true, data: data });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message, data: null });
    });
    return true;
  }
  
  if (request.action === 'startBulkSending') {
    startBulkSending(request.emails, request.startTime, request.delay).then(() => {
      sendResponse({ success: true, error: null });
    }).catch((error) => {
      console.error('Bulk sending error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (request.action === 'sendManualFollowUp') {
    sendManualFollowUpEmail(request.email, request.subject, request.message).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (request.action === 'showNotification') {
    createNotification(request.title || 'TaskForce Email Manager', request.message || '', request.type || 'info');
    sendResponse({ success: true });
    return false;
  }
  
  if (request.action === 'trackEmailOpen') {
    trackEmailOpen(request.emailId, request.timestamp).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (request.action === 'trackLinkClick') {
    trackLinkClick(request.emailId, request.linkUrl, request.timestamp).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (request.action === 'fetchCalendarEvents') {
    fetchCalendarEvents(request.daysAhead).then((events) => {
      sendResponse({ success: true, events });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (request.action === 'createCalendarEvent') {
    createCalendarEvent(request.event).then((event) => {
      sendResponse({ success: true, event });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (request.action === 'detectCalendarEvents') {
    detectCalendarEventsFromEmail(request.emailBody, request.emailSubject).then((result) => {
      sendResponse({ success: true, result });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (request.action === 'getUpcomingEvents') {
    getUpcomingEvents(request.context).then((events) => {
      sendResponse({ success: true, events });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  // Contacts API handlers
  if (request.action === 'fetchContacts') {
    fetchContacts().then((contacts) => {
      sendResponse({ success: true, contacts });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (request.action === 'upsertContact') {
    upsertContact(request.contact).then((result) => {
      sendResponse({ success: true, contact: result });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  // Hybrid system handlers (backend integration)
  if (request.action === 'handleBulkSendHybrid') {
    try {
      const start = request.startTime ? new Date(request.startTime) : new Date();
      if (typeof handleBulkSendHybrid === 'function') {
        handleBulkSendHybrid(request.emails || [], start, request.delay || 0)
          .then(() => sendResponse({ success: true }))
          .catch((err) => sendResponse({ success: false, error: err?.message || 'Hybrid send failed' }));
        return true;
      }
      sendResponse({ success: false, error: 'Hybrid handler not available' });
    } catch (e) {
      sendResponse({ success: false, error: e?.message || 'Error' });
    }
  }

  if (request.action === 'initiateBackendOAuth') {
    try {
      if (typeof initiateBackendOAuth === 'function') {
        initiateBackendOAuth();
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'OAuth initiator not available' });
      }
    } catch (e) {
      sendResponse({ success: false, error: e?.message || 'Error' });
    }
    return true;
  }

  if (request.action === 'getBackendStatus') {
    try {
      chrome.storage.local.get(['backendStatus', 'backendUserId'], (result) => {
        sendResponse({ success: true, status: result.backendStatus || 'unknown', userId: result.backendUserId || null });
      });
    } catch (e) {
      sendResponse({ success: false, error: e?.message || 'Error' });
    }
    return true;
  }

  if (request.action === 'getBackendMetrics') {
    (async () => {
      try {
        if (typeof BACKEND_URL === 'undefined') {
          sendResponse({ success: false, error: 'Backend URL not set' });
          return;
        }
        const resp = await fetch(`${BACKEND_URL}/metrics`);
        const data = await resp.json();
        sendResponse({ success: true, data });
      } catch (e) {
        sendResponse({ success: false, error: e?.message || 'Error' });
      }
    })();
    return true;
  }
});

// Schedule an email to be sent later
async function scheduleEmail(email) {
  const emailId = Date.now().toString();
  const scheduledEmail = {
    id: emailId,
    ...email,
    scheduledFor: email.scheduledFor,
    status: 'scheduled'
  };
  
  // Save to storage
  const result = await chrome.storage.local.get('scheduledEmails');
  const scheduledEmails = [...(result.scheduledEmails || []), scheduledEmail];
  await chrome.storage.local.set({ scheduledEmails });
  
  // Schedule alarm
  chrome.alarms.create(`sendEmail_${emailId}`, {
    when: new Date(email.scheduledFor).getTime()
  });
  
  console.log('Email scheduled:', emailId, 'for', email.scheduledFor);
  
  // Notify scheduled email
  notifyEmailScheduled(scheduledEmail);
}

// Send bulk emails with rate limiting
async function sendBulkEmails(emails) {
  const result = await chrome.storage.local.get('settings');
  const delay = result.settings?.bulkSendDelay || 1000;
  
  console.log(`Starting bulk send of ${emails.length} emails`);
  
  for (let i = 0; i < emails.length; i++) {
    const email = emails[i];
    
    try {
      // Get access token
      const token = await getAccessToken();
      if (!token) {
        console.error('No access token for bulk send');
        break;
      }
      
      // Send email
      const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          raw: createRawEmail(email.to, email.subject, email.body)
        })
      });
      
      if (response.ok) {
        console.log(`Sent ${i + 1}/${emails.length}: ${email.to}`);
        await incrementSentCounter();
      } else {
        console.error(`Failed to send to ${email.to}`);
      }
      
      // Rate limit
      if (i < emails.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      console.error(`Error sending to ${email.to}:`, error);
    }
  }
  
  console.log('Bulk send complete');
}

// Track email for analytics
async function trackEmail(to, subject, body) {
  try {
    const result = await chrome.storage.local.get(['trackedEmails', 'settings']);
    const settings = result.settings || {};
    
    // Only track if enabled
    if (!settings.enableTracking) return;
    
    const trackedEmails = result.trackedEmails || [];
    
    // Create tracking data
    const email = {
      to,
      subject,
      sentAt: new Date().toISOString(),
      opens: 0,
      clicks: 0,
      messageId: Date.now().toString()
    };
    
    // Add tracking pixel to body
    const trackingPixel = `<img src="https://api.tracking-pixel.com/track?id=${email.messageId}" width="1" height="1" style="display:none;">`;
    // Note: In production, you'd need a real tracking server
    
    trackedEmails.push(email);
    
    await chrome.storage.local.set({ trackedEmails });
    console.log('Email tracked:', email.messageId);
  } catch (error) {
    console.error('Error tracking email:', error);
  }
}

// Record email open
async function recordEmailOpen(messageId) {
  try {
    const result = await chrome.storage.local.get('trackedEmails');
    const trackedEmails = result.trackedEmails || [];
    const email = trackedEmails.find(e => e.messageId === messageId);
    
    if (email) {
      email.opens = (email.opens || 0) + 1;
      await chrome.storage.local.set({ trackedEmails });
      console.log('Email opened:', messageId);
      try { await addGmailLabel(messageId, 'TaskForce/Opened'); } catch(_){}
    }
  } catch (error) {
    console.error('Error recording email open:', error);
  }
}

// Record link click
async function recordLinkClick(messageId) {
  try {
    const result = await chrome.storage.local.get('trackedEmails');
    const trackedEmails = result.trackedEmails || [];
    const email = trackedEmails.find(e => e.messageId === messageId);
    
    if (email) {
      email.clicks = (email.clicks || 0) + 1;
      await chrome.storage.local.set({ trackedEmails });
      console.log('Link clicked:', messageId);
      try { await addGmailLabel(messageId, 'TaskForce/Clicked'); } catch(_){}
    }
  } catch (error) {
    console.error('Error recording click:', error);
  }
}

// Ensure label exists and add to message
async function addGmailLabel(messageId, labelName) {
  const token = await getAccessToken();
  if (!token) throw new Error('No token');
  const labelId = await ensureLabel(labelName, token);
  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ addLabelIds: [labelId] })
  });
}

async function ensureLabel(name, token) {
  const list = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', { headers: { 'Authorization': `Bearer ${token}` } });
  const data = await list.json();
  const existing = (data.labels||[]).find(l => l.name === name);
  if (existing) return existing.id;
  const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, labelListVisibility: 'labelShow', messageListVisibility: 'show' })
  });
  const created = await resp.json();
  return created.id;
}

// Fetch data from Google Sheets
async function fetchSheetsData(sheetId) {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    // Fetch sheet data using Google Sheets API
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/A1:Z1000?access_token=${token}`,
      {
        method: 'GET'
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Sheets API error:', response.status, errorText);
      
      // Detect authentication errors
      if (response.status === 401 || response.status === 403) {
        throw new Error('Authentication required. Please click "Reauthenticate" in the extension popup to grant Google Sheets access.');
      }
      
      // Detect permission errors
      if (errorText.includes('permission') || errorText.includes('PERMISSION_DENIED')) {
        throw new Error('Permission denied. Please make sure the sheet is shared or you have access to it.');
      }
      
      throw new Error(`Failed to fetch sheet data (${response.status}). Make sure the sheet is shared publicly or you have access to it.`);
    }
    
    const data = await response.json();
    
    // Convert to array of objects
    if (!data.values || data.values.length === 0) {
      return [];
    }
    
    const headers = data.values[0];
    const rows = data.values.slice(1);
    
    const result = rows.map(row => {
      const obj = {};
      headers.forEach((header, index) => {
        obj[header.toLowerCase().trim()] = row[index] || '';
      });
      return obj;
    });
    
    return result;
  } catch (error) {
    console.error('Error fetching sheets data:', error);
    throw error;
  }
}

// Start bulk sending with scheduling
async function startBulkSending(emails, startTime, delay) {
  try {
    console.log(`Starting bulk send: ${emails.length} emails, delay: ${delay}ms`);
    
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    // Calculate start time
    let waitTime = 0;
    if (startTime) {
      const start = new Date(startTime).getTime();
      const now = Date.now();
      waitTime = Math.max(0, start - now);
    }
    
    // Wait until start time if specified
    if (waitTime > 0) {
      console.log(`Waiting ${waitTime}ms until start time...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    // Send emails with delay
    let sentCount = 0;
    let failedCount = 0;
    
    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];
      
      try {
        // Check daily limit
        if (!(await checkDailyLimit())) {
          console.warn('Daily limit reached, stopping');
          throw new Error('Daily sending limit reached');
        }
        
        // Send email
        const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            raw: createRawEmail(email.to, email.subject, email.body)
          })
        });
        
        if (response.ok) {
          sentCount++;
          console.log(`✅ Sent ${i + 1}/${emails.length}: ${email.to}`);
          await incrementSentCounter();
          
          // Track email
          await trackEmail(email.to, email.subject, email.body);
        } else {
          failedCount++;
          console.error(`❌ Failed to send to ${email.to}`);
        }
        
        // Delay between emails (except last one)
        if (i < emails.length - 1 && delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error) {
        failedCount++;
        console.error(`Error sending to ${email.to}:`, error);
      }
    }
    
    console.log(`Bulk send complete: ${sentCount} sent, ${failedCount} failed`);
    
    // Store results
    await chrome.storage.local.set({
      lastBulkSend: {
        total: emails.length,
        sent: sentCount,
        failed: failedCount,
        timestamp: new Date().toISOString()
      }
    });
    
    // Store sent emails for reply tracking
    const result = await chrome.storage.local.get('emailReplies');
    const emailReplies = result.emailReplies || [];
    
    // Add successfully sent emails to tracking
    emails.forEach((email, index) => {
      if (index < sentCount) { // Only track successfully sent ones
        emailReplies.push({
          to: email.to,
          subject: email.subject,
          sentAt: new Date().toISOString(),
          hasReplied: false // Will be updated when we check for replies
        });
      }
    });
    
    await chrome.storage.local.set({ emailReplies });
    
    // Show completion notification
    if (sentCount > 0) {
      createNotification(
        'Bulk Send Complete!',
        `Successfully sent ${sentCount} of ${emails.length} emails${failedCount > 0 ? ` (${failedCount} failed)` : ''}`,
        sentCount === emails.length ? 'success' : 'warning'
      );
    }
    
    return { sent: sentCount, failed: failedCount };
  } catch (error) {
    console.error('Error in bulk sending:', error);
    createNotification('Bulk Send Failed', 'An error occurred while sending bulk emails', 'error');
    throw error;
  }
}

// Enhanced notification system
function createNotification(title, message, type = 'info') {
  const icons = {
    info: 'icons/icon48.png',
    success: 'icons/icon48.png',
    warning: 'icons/icon48.png',
    error: 'icons/icon48.png',
    open: 'icons/icon48.png',
    click: 'icons/icon48.png',
    reply: 'icons/icon48.png',
    schedule: 'icons/icon48.png',
    followup: 'icons/icon48.png'
  };
  
  const notificationOptions = {
    type: 'basic',
    iconUrl: icons[type] || icons.info,
    title: title,
    message: message,
    contextMessage: 'TaskForce Email Manager'
  };
  
  chrome.notifications.create(notificationOptions);
  
  // Log notification for debugging
  console.log('Notification:', type, title, message);
}

// Notification for email sent
function notifyEmailSent(email) {
  createNotification(
    'Email Sent',
    `Successfully sent to ${email.to}`,
    'success'
  );
}

// Notification for email scheduled
function notifyEmailScheduled(email) {
  createNotification(
    'Email Scheduled',
    `Email scheduled for ${new Date(email.scheduledFor).toLocaleString()}`,
    'schedule'
  );
}

// Notification for reply received
function notifyReplyReceived(email) {
  createNotification(
    'Reply Received!',
    `You received a reply from ${email.from}`,
    'reply'
  );
}

// Notification for follow-up triggered
function notifyFollowUpTriggered(email) {
  createNotification(
    'Follow-up Sent',
    `Auto follow-up sent to ${email.to}`,
    'followup'
  );
}

// Calendar API integration
// Fetch calendar events
async function fetchCalendarEvents(daysAhead = 7) {
  try {
    const token = await getAccessToken();
    if (!token) {
      console.error('No access token for calendar API');
      return [];
    }
    
    const now = new Date();
    const timeMax = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);
    
    const response = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      `timeMin=${now.toISOString()}&timeMax=${timeMax.toISOString()}&singleEvents=true&orderBy=startTime`,
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (!response.ok) {
      console.error('Failed to fetch calendar events');
      return [];
    }
    
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return [];
  }
}

// Create calendar event
async function createCalendarEvent(event) {
  try {
    const token = await getAccessToken();
    if (!token) {
      console.error('No access token for calendar API');
      return null;
    }
    
    const response = await fetch(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      }
    );
    
    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to create calendar event:', error);
      return null;
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return null;
  }
}

// Detect calendar events with email context
async function detectCalendarEventsFromEmail(emailBody, emailSubject) {
  try {
    // Parse email for date/time information
    const datePatterns = [
      /\d{1,2}\/\d{1,2}\/\d{4}/g,  // MM/DD/YYYY
      /\d{1,2}-\d{1,2}-\d{4}/g,     // MM-DD-YYYY
      /\d{4}-\d{2}-\d{2}/g,         // YYYY-MM-DD
      /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/g,
      /(January|February|March|April|May|June|July|August|September|October|November|December)/g
    ];
    
    const detectedDates = [];
    datePatterns.forEach(pattern => {
      const matches = emailBody.match(pattern);
      if (matches) {
        detectedDates.push(...matches);
      }
    });
    
    // Look for time patterns
    const timePatterns = [
      /\d{1,2}:\d{2}\s*(AM|PM)/g,
      /\d{1,2}:\d{2}/g
    ];
    
    const detectedTimes = [];
    timePatterns.forEach(pattern => {
      const matches = emailBody.match(pattern);
      if (matches) {
        detectedTimes.push(...matches);
      }
    });
    
    // Look for meeting-related keywords
    const meetingKeywords = ['meeting', 'call', 'conference', 'zoom', 'teams', 'schedule', 'appointment'];
    const hasMeetingKeyword = meetingKeywords.some(keyword => 
      emailSubject.toLowerCase().includes(keyword) || emailBody.toLowerCase().includes(keyword)
    );
    
    return {
      hasPotentialEvent: detectedDates.length > 0 || hasMeetingKeyword,
      detectedDates,
      detectedTimes,
      meetingKeywords,
      suggestion: detectedDates.length > 0 || hasMeetingKeyword ? 
        'This email may contain event information. Would you like to create a calendar event?' : null
    };
  } catch (error) {
    console.error('Error detecting calendar events:', error);
    return { hasPotentialEvent: false, detectedDates: [], detectedTimes: [] };
  }
}

// Get upcoming events for email context
async function getUpcomingEvents(context) {
  try {
    const events = await fetchCalendarEvents(context?.daysAhead || 7);
    
    return events.map(event => ({
      id: event.id,
      summary: event.summary,
      start: event.start?.dateTime || event.start?.date,
      end: event.end?.dateTime || event.end?.date,
      location: event.location,
      description: event.description,
      attendees: event.attendees?.map(a => a.email) || [],
      htmlLink: event.htmlLink
    }));
  } catch (error) {
    console.error('Error getting upcoming events:', error);
    return [];
  }
}

// CONTACTS API INTEGRATION

// Fetch contacts from Google Contacts
async function fetchContacts() {
  try {
    const token = await getAccessToken();
    if (!token) {
      console.error('No access token for contacts API');
      return [];
    }
    
    const response = await fetch(
      'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses,organizations&pageSize=2000',
      {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    if (!response.ok) {
      console.error('Failed to fetch contacts');
      return [];
    }
    
    const data = await response.json();
    const contacts = data.connections || [];
    
    // Transform contacts to simpler format
    return contacts.map(contact => ({
      id: contact.resourceName,
      name: contact.names?.[0]?.displayName || 'Unknown',
      email: contact.emailAddresses?.[0]?.value || '',
      company: contact.organizations?.[0]?.name || '',
      jobTitle: contact.organizations?.[0]?.title || ''
    })).filter(contact => contact.email); // Only return contacts with emails
    
  } catch (error) {
    console.error('Error fetching contacts:', error);
    return [];
  }
}

// Create or update contact
async function upsertContact(contactData) {
  try {
    const token = await getAccessToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const { name, email, company, jobTitle } = contactData;
    
    // Build the contact object
    const contact = {
      names: [{ displayName: name, givenName: name }],
      emailAddresses: [{ value: email }]
    };
    
    if (company || jobTitle) {
      contact.organizations = [{}];
      if (company) contact.organizations[0].name = company;
      if (jobTitle) contact.organizations[0].title = jobTitle;
    }
    
    const response = await fetch(
      'https://people.googleapis.com/v1/people:createContact',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(contact)
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Failed to create contact:', errorData);
      throw new Error('Failed to create contact');
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error creating contact:', error);
    throw error;
  }
}
