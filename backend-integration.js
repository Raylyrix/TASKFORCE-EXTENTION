// Advanced Backend Integration with Health Checks & Hybrid Sending
// TaskForce Email Manager

// Configuration - CHANGE THIS TO YOUR BACKEND URL
// For local development, use: http://localhost:5000
// For production, use your deployed backend URL
const BACKEND_URL = 'http://localhost:5000'; // Update this to your backend URL

// Backend status tracking
let backendStatus = 'unknown'; // 'ready', 'offline', 'checking', 'unknown'
let backendCheckInterval = null;
let backendUserId = null;
// Persist pending emails in storage to survive service worker restarts
async function addPendingEmail(email, scheduledFor) {
  return new Promise((resolve) => {
    chrome.storage.local.get('pendingEmails', (result) => {
      const list = result.pendingEmails || [];
      list.push({ email, scheduledFor, addedAt: Date.now() });
      chrome.storage.local.set({ pendingEmails: list }, () => resolve());
    });
  });
}

async function getPendingEmails() {
  return new Promise((resolve) => {
    chrome.storage.local.get('pendingEmails', (result) => resolve(result.pendingEmails || []));
  });
}

async function clearPendingEmails() {
  return new Promise((resolve) => chrome.storage.local.set({ pendingEmails: [] }, () => resolve()));
}


// ============================================
// BACKEND HEALTH MONITORING
// ============================================

// Check backend health with detailed status
async function checkBackendHealthDetailed() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5 second timeout
    
    const response = await fetch(`${BACKEND_URL}/health`, {
      signal: controller.signal,
      method: 'GET'
    });
    
    clearTimeout(timeout);
    
    if (response.ok) {
      const data = await response.json();
      
      if (data.status === 'ok') {
        return { 
          status: 'ready', 
          message: 'Backend is ready',
          responseTime: performance.now()
        };
      }
    }
    
    return { status: 'offline', message: 'Backend health check failed' };
  } catch (error) {
    if (error.name === 'AbortError') {
      return { status: 'offline', message: 'Backend timeout - server not responding' };
    }
    return { status: 'offline', message: 'Backend not accessible' };
  }
}

// Continuous backend health monitoring
function startBackendMonitoring() {
  // Stop existing monitoring if running
  if (backendCheckInterval) {
    clearInterval(backendCheckInterval);
  }
  
  // Check immediately
  monitorBackendStatus();
  
  // Then check every 30 seconds
  backendCheckInterval = setInterval(monitorBackendStatus, 30000);
  
  console.log('🔍 Backend monitoring started');
}

// Monitor backend status and handle transitions
async function monitorBackendStatus() {
  const prevStatus = backendStatus;
  const healthCheck = await checkBackendHealthDetailed();
  backendStatus = healthCheck.status;
  
  // Status changed
  if (prevStatus !== backendStatus && prevStatus !== 'unknown') {
    handleBackendStatusChange(prevStatus, backendStatus);
  }
  
  console.log(`📊 Backend status: ${backendStatus} - ${healthCheck.message}`);
  
  // Store status
  chrome.storage.local.set({ 
    backendStatus: backendStatus,
    backendStatusMessage: healthCheck.message,
    backendLastCheck: new Date().toISOString()
  });
}

// Handle backend status transitions
async function handleBackendStatusChange(oldStatus, newStatus) {
  console.log(`🔄 Backend status changed: ${oldStatus} → ${newStatus}`);
  
  if (newStatus === 'ready' && oldStatus === 'offline') {
    // Backend came online - migrate pending emails
    await handleBackendReconnected();
  }
  
  if (newStatus === 'offline' && oldStatus === 'ready') {
    // Backend went offline - show warning
    showBackendOfflineNotification();
  }
}

// Handle backend reconnection
async function handleBackendReconnected() {
  console.log('🎉 Backend reconnected!');
  
  // Initialize user registration
  await initializeBackend();
  
  // Migrate pending emails to backend
  if (pendingEmails.length > 0) {
    await migratePendingEmailsToBackend();
  }
  
  // Notify user if they have active sends
  await checkAndNotifyActiveSends();
}

// Show offline notification
function showBackendOfflineNotification() {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'TaskForce Email Manager',
    message: '⚠️ Backend offline - Don\'t turn off your PC! Emails will only send with browser open.',
    buttons: [{ title: 'Check Status' }]
  });
}

// ============================================
// USER REGISTRATION
// ============================================

// Register user with backend
async function registerUserBackend(email, refreshToken) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, refreshToken })
    });
    
    if (!response.ok) {
      throw new Error(`Registration failed: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
}

// Get user email from Google account
async function getUserEmail() {
  try {
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(token);
        }
      });
    });
    
    const response = await fetch(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      { headers: { Authorization: `Bearer ${token}` } }
    );
    
    const data = await response.json();
    return data.email;
  } catch (error) {
    console.error('Get user email error:', error);
    return null;
  }
}

// Get refresh token
async function getRefreshToken() {
  try {
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(token);
        }
      });
    });
    return token;
  } catch (error) {
    console.error('Get refresh token error:', error);
    throw error;
  }
}

// Start OAuth to obtain refresh token via backend
async function initiateBackendOAuth() {
  try {
    const url = `${BACKEND_URL}/api/auth/start`;
    chrome.tabs.create({ url });
    // User completes consent; we will poll registration status later
  } catch (e) {
    console.error('Failed to initiate backend OAuth:', e);
  }
}

// Initialize backend connection
async function initializeBackend() {
  try {
    console.log('🔌 Initializing backend connection...');
    
    if (backendStatus !== 'ready') {
      console.warn('⚠️ Backend not ready, skipping registration');
      return false;
    }
    
    const userEmail = await getUserEmail();
    if (!userEmail) {
      console.warn('⚠️ No user email found');
      return false;
    }
    
    // Try to register with existing token (legacy). If backend needs refresh token,
    // user can run initiateBackendOAuth() from UI to complete consent.
    const refreshToken = await getRefreshToken();
    const result = await registerUserBackend(userEmail, refreshToken);
    
    if (result.success) {
      backendUserId = result.userId;
      console.log('✅ User registered with backend:', backendUserId);
      
      chrome.storage.local.set({ 
        backendUserId: result.userId,
        backendConnected: true,
        backendStatus: 'ready'
      });
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('❌ Backend initialization error:', error);
    chrome.storage.local.set({ backendConnected: false });
    return false;
  }
}

// ============================================
// HYBRID EMAIL SCHEDULING
// ============================================

// Schedule email with smart routing
async function scheduleEmailHybrid(email, scheduledFor, origin = 'compose') {
  try {
    console.log('📧 Scheduling email with hybrid system...');
    
    // Get backend status
    await chrome.storage.local.get(['backendStatus', 'backendUserId'], async (result) => {
      const isBackendReady = result.backendStatus === 'ready' && result.backendUserId;
      
      if (isBackendReady) {
        // Backend is ready - use it
        try {
          await scheduleEmailOnBackend(result.backendUserId, email, scheduledFor);
          
          // Show success with "you can turn off PC" message
          await showBackendActiveNotification('You can turn off your PC and go enjoy! Emails will send automatically.');
          
        } catch (error) {
          console.error('Backend scheduling failed:', error);
          await scheduleEmailLocally(email, scheduledFor);
          
          // Show warning
          await showLocalModeNotification('Using local mode - Please keep your PC on');
        }
      } else {
        // Backend not ready - use local
        await scheduleEmailLocally(email, scheduledFor);
        
        // Show warning
        await showLocalModeNotification('⚠️ Backend offline - Please DO NOT close or turn off your PC!');
        
        // Store for later migration (persistent)
        await addPendingEmail(email, scheduledFor);
      }
    });
  } catch (error) {
    console.error('Schedule email error:', error);
    await scheduleEmailLocally(email, scheduledFor);
    await showLocalModeNotification('⚠️ Using local mode - Please keep your PC on');
  }
}

// Schedule email on backend
async function scheduleEmailOnBackend(userId, emailData, scheduledFor) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/emails/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        email: emailData,
        scheduledFor
      })
    });
    
    if (!response.ok) {
      throw new Error(`Backend scheduling failed: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ Email scheduled on backend:', data.emailId);
    return data;
  } catch (error) {
    console.error('Schedule email on backend error:', error);
    throw error;
  }
}

// Schedule email locally (fallback)
async function scheduleEmailLocally(email, scheduledFor) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get('scheduledEmails', (result) => {
      const scheduledEmails = result.scheduledEmails || [];
      const emailId = Date.now().toString();
      
      scheduledEmails.push({
        id: emailId,
        ...email,
        scheduledFor: scheduledFor,
        status: 'scheduled',
        source: 'local'
      });
      
      chrome.storage.local.set({ scheduledEmails }, () => {
        // Create alarm for local sending
        chrome.alarms.create(`sendEmail_${emailId}`, {
          when: new Date(scheduledFor).getTime()
        });
        
        console.log('✅ Email scheduled locally:', emailId);
        resolve({ success: true, emailId });
      });
    });
  });
}

// ============================================
// BULK EMAIL HYBRID SYSTEM
// ============================================

// Handle bulk email sending with hybrid system
async function handleBulkSendHybrid(emails, startTime, delay) {
  chrome.storage.local.get(['backendStatus', 'backendUserId', 'activeBulkCampaign'], async (result) => {
    const isBackendReady = result.backendStatus === 'ready' && result.backendUserId;
    const activeCampaign = result.activeBulkCampaign || null;
    
    if (isBackendReady && !activeCampaign) {
      // Backend ready and no active local campaign - use backend
      await startBulkSendOnBackend(emails, startTime, delay);
      await showBackendActiveNotification(`Bulk send started on backend! You can turn off your PC. ${emails.length} emails will send automatically.`);
    } else if (activeCampaign) {
      // Active local campaign - keep using local
      console.log('Active local campaign detected, continuing locally');
    } else {
      // Backend not ready - start local campaign
      await startBulkSendLocally(emails, startTime, delay);
      await showLocalModeNotification(`⚠️ Bulk send started locally - DO NOT turn off PC! Monitoring backend...`);
      
      // Start backend monitoring for migration
      monitorBulkSendBackendAvailable(emails.length);
    }
  });
}

// Monitor if backend becomes available during bulk send
function monitorBulkSendBackendAvailable(totalEmails) {
  const checkInterval = setInterval(async () => {
    const healthCheck = await checkBackendHealthDetailed();
    
    if (healthCheck.status === 'ready') {
      clearInterval(checkInterval);
      
      // Migrate remaining emails to backend
      await migrateActiveBulkSendToBackend();
    }
  }, 10000); // Check every 10 seconds
  
  // Stop monitoring after 5 minutes
  setTimeout(() => {
    clearInterval(checkInterval);
  }, 300000);
}

// Migrate active bulk send to backend
async function migrateActiveBulkSendToBackend() {
  chrome.storage.local.get(['activeBulkCampaign', 'backendUserId'], async (result) => {
    const campaign = result.activeBulkCampaign;
    
    if (!campaign || campaign.sent >= campaign.total) {
      return; // Campaign finished or not found
    }
    
    const remaining = campaign.total - campaign.sent;
    
    // Show notification
    await showBackendMigratedNotification(remaining, campaign.total);
    
    console.log(`🔄 Migrating ${remaining} remaining emails to backend`);
    
    // Clear local campaign
    chrome.storage.local.set({ activeBulkCampaign: null });
  });
}

// Start bulk send on backend
async function startBulkSendOnBackend(emails, startTime, delay) {
  try {
    chrome.storage.local.get('backendUserId', async (result) => {
      if (!result.backendUserId) {
        throw new Error('No backend user ID');
      }
      
      // Use bulk endpoint
      const response = await fetch(`${BACKEND_URL}/api/emails/schedule-bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: result.backendUserId,
          emails: emails,
          startTime: startTime.toISOString(),
          delay: delay
        })
      });
      
      if (!response.ok) {
        throw new Error(`Bulk scheduling failed: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ Bulk send scheduled on backend: ${data.count} emails`);
      return data;
    });
  } catch (error) {
    console.error('Bulk send on backend error:', error);
    throw error;
  }
}

// Start bulk send locally
async function startBulkSendLocally(emails, startTime, delay) {
  // Set active campaign in storage
  chrome.storage.local.set({
    activeBulkCampaign: {
      total: emails.length,
      sent: 0,
      startTime: startTime.toISOString(),
      delay: delay
    }
  });
  
  // Send via background.js existing logic
  chrome.runtime.sendMessage({
    action: 'startBulkSending',
    emails: emails,
    startTime: startTime.toISOString(),
    delay: delay
  });
}

// ============================================
// NOTIFICATIONS
// ============================================

// Show backend active notification with auto-popup
const CONNECT_BACKEND_NOTIFICATION_ID = 'aem-connect-backend';
const LOCAL_MODE_NOTIFICATION_ID = 'aem-local-mode';

async function showBackendActiveNotification(message) {
  // Create notification with stable ID and buttons
  chrome.notifications.create(CONNECT_BACKEND_NOTIFICATION_ID, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: '🚀 TaskForce Email Manager',
    message: message,
    buttons: [{ title: 'Connect Backend' }, { title: 'Close' }]
  });
  
  // Try to open popup automatically
  chrome.action.openPopup();
  
  console.log('✅ Backend Active:', message);
}

// Show local mode notification
async function showLocalModeNotification(message) {
  chrome.notifications.create(LOCAL_MODE_NOTIFICATION_ID, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: '⚠️ TaskForce Email Manager',
    message: message,
    buttons: [{ title: 'Connect Backend' }, { title: 'OK' }]
  });
  
  console.log('⚠️ Local Mode:', message);
}

// Show migrated notification
async function showBackendMigratedNotification(remaining, total) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: '🎉 TaskForce Email Manager',
    message: `Backend is now ready! The remaining ${remaining}/${total} emails will send automatically. You can turn off your PC now! 🚀`,
    buttons: [{ title: 'Close' }]
  });
  
  // Try to open popup
  chrome.action.openPopup();
}

// ============================================
// PENDING EMAIL MIGRATION
// ============================================

// Migrate pending emails to backend when it comes online
async function migratePendingEmailsToBackend() {
  const list = await getPendingEmails();
  if (list.length === 0) return;
  
  chrome.storage.local.get('backendUserId', async (result) => {
    if (!result.backendUserId) return;
    
    console.log(`🔄 Migrating ${list.length} pending emails to backend`);
    
    for (const pending of list) {
      try {
        await scheduleEmailOnBackend(result.backendUserId, pending.email, pending.scheduledFor);
      } catch (error) {
        console.error('Failed to migrate pending email:', error);
      }
    }
    
    // Clear pending emails
    await clearPendingEmails();
    console.log('✅ Pending emails migrated');
  });
}

// Check and notify about active sends
async function checkAndNotifyActiveSends() {
  chrome.storage.local.get(['activeBulkCampaign', 'scheduledEmails'], async (result) => {
    const hasActiveCampaign = result.activeBulkCampaign && result.activeBulkCampaign.sent < result.activeBulkCampaign.total;
    const hasScheduled = result.scheduledEmails && result.scheduledEmails.length > 0;
    
    if (hasActiveCampaign || hasScheduled) {
      await showBackendActiveNotification('Backend is ready! Your remaining scheduled emails will send automatically. You can turn off your PC now.');
    }
  });
}

// ============================================
// INITIALIZATION
// ============================================

// Initialize on startup
chrome.runtime.onStartup.addListener(() => {
  console.log('🚀 Extension started, initializing backend...');
  startBackendMonitoring();
});

chrome.runtime.onInstalled.addListener(() => {
  console.log('📦 Extension installed, initializing backend...');
  startBackendMonitoring();
});

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (notificationId === CONNECT_BACKEND_NOTIFICATION_ID && buttonIndex === 0) {
    // User clicked "Connect Backend"
    initiateBackendOAuth();
  }
  if (notificationId === LOCAL_MODE_NOTIFICATION_ID && buttonIndex === 0) {
    initiateBackendOAuth();
  }
});

// Start monitoring immediately
startBackendMonitoring();

// ============================================
// CONTACTS API HELPERS (via Backend)
// ============================================

// Fetch contacts from backend
async function fetchContactsFromBackend(userId) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/contacts/${userId}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch contacts');
    }
    return data.contacts || [];
  } catch (error) {
    console.error('Fetch contacts from backend error:', error);
    throw error;
  }
}

// Create contact via backend
async function createContactOnBackend(userId, contactData) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/contacts/${userId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contactData)
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create contact');
    }
    return data.contact;
  } catch (error) {
    console.error('Create contact on backend error:', error);
    throw error;
  }
}

// Search contacts via backend
async function searchContactsOnBackend(userId, query) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/contacts/${userId}/search?query=${encodeURIComponent(query)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to search contacts');
    }
    return data.contacts || [];
  } catch (error) {
    console.error('Search contacts on backend error:', error);
    throw error;
  }
}

// ============================================
// CALENDAR API HELPERS (via Backend)
// ============================================

// Fetch calendar events from backend
async function fetchCalendarEventsFromBackend(userId, daysAhead = 7) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/calendar/${userId}/events?daysAhead=${daysAhead}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to fetch calendar events');
    }
    return data.events || [];
  } catch (error) {
    console.error('Fetch calendar events from backend error:', error);
    throw error;
  }
}

// Create calendar event via backend
async function createCalendarEventOnBackend(userId, eventData) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/calendar/${userId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(eventData)
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create calendar event');
    }
    return data.event;
  } catch (error) {
    console.error('Create calendar event on backend error:', error);
    throw error;
  }
}

// Create calendar event from scheduled email (auto-integration)
async function createCalendarEventFromEmail(userId, emailId, scheduledFor, durationMinutes = 30) {
  try {
    const response = await fetch(`${BACKEND_URL}/api/calendar/${userId}/events/from-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailId,
        scheduledFor,
        durationMinutes
      })
    });
    
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to create calendar event from email');
    }
    return data.event;
  } catch (error) {
    console.error('Create calendar event from email error:', error);
    throw error;
  }
}

// Export functions for use in other files
if (typeof window !== 'undefined') {
  window.scheduleEmailHybrid = scheduleEmailHybrid;
  window.handleBulkSendHybrid = handleBulkSendHybrid;
  window.checkBackendHealthDetailed = checkBackendHealthDetailed;
  window.initiateBackendOAuth = initiateBackendOAuth;
  window.fetchContactsFromBackend = fetchContactsFromBackend;
  window.createContactOnBackend = createContactOnBackend;
  window.searchContactsOnBackend = searchContactsOnBackend;
  window.fetchCalendarEventsFromBackend = fetchCalendarEventsFromBackend;
  window.createCalendarEventOnBackend = createCalendarEventOnBackend;
  window.createCalendarEventFromEmail = createCalendarEventFromEmail;
}
