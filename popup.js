// Popup script

document.addEventListener('DOMContentLoaded', async () => {
  // Load stats
  loadStats();
  loadReplies();
  loadFollowUps();
  
  // Check authentication status
  checkAuth();
  
  // Refresh stats every 2 seconds when popup is open
  setInterval(() => {
    loadStats();
    loadReplies();
  }, 2000);
  
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active class
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Show corresponding content
      const tabName = btn.dataset.tab;
      document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
      document.getElementById(`tab-${tabName}`).classList.add('active');
      
      // Update button styles
      document.querySelectorAll('.tab-btn').forEach(b => {
        b.style.background = 'transparent';
        b.style.color = '#5f6368';
      });
      btn.style.background = 'white';
      btn.style.color = '#1a73e8';
    });
  });
  
  // Button handlers
  document.getElementById('settings-btn').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });
  
  document.getElementById('add-followup-btn').addEventListener('click', () => {
    addFollowUpRule();
  });
});

async function loadStats() {
  try {
    const result = await chrome.storage.local.get(['scheduledEmails', 'emailStats', 'lastBulkSend', 'activeBulkCampaigns']);
    const scheduled = result.scheduledEmails || [];
    const stats = result.emailStats || { sentToday: 0 };
    const lastBulk = result.lastBulkSend || null;
    const activeCampaigns = result.activeBulkCampaigns || [];
    
    // Update quick stats
    document.getElementById('sent-today').textContent = stats.sentToday;
    document.getElementById('pending-scheduled').textContent = scheduled.length;
    
    // Display bulk progress
    displayBulkProgress(lastBulk, activeCampaigns);
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

function displayBulkProgress(lastBulk, activeCampaigns) {
  const progressSection = document.getElementById('bulk-progress-content');
  
  if (!lastBulk && activeCampaigns.length === 0) {
    progressSection.innerHTML = `
      <div style="text-align: center; color: #666; padding: 20px;">
        No active campaigns
      </div>
    `;
    return;
  }
  
  let html = '';
  
  // Show last bulk send result if exists
  if (lastBulk) {
    const timestamp = new Date(lastBulk.timestamp).toLocaleTimeString();
    const successRate = lastBulk.total > 0 ? ((lastBulk.sent / lastBulk.total) * 100).toFixed(1) : 0;
    
    html += `
      <div style="background: #e8f0fe; border-left: 3px solid #1a73e8; padding: 12px; margin-bottom: 12px; border-radius: 4px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <strong style="color: #1a73e8;">Last Campaign</strong>
          <span style="font-size: 12px; color: #666;">${timestamp}</span>
        </div>
        <div class="stat" style="margin-bottom: 4px;">
          <span class="stat-label">Total:</span>
          <span class="stat-value">${lastBulk.total}</span>
        </div>
        <div class="stat" style="margin-bottom: 4px;">
          <span class="stat-label">Sent:</span>
          <span class="stat-value" style="color: #34a853;">${lastBulk.sent}</span>
        </div>
        <div class="stat" style="margin-bottom: 4px;">
          <span class="stat-label">Failed:</span>
          <span class="stat-value" style="color: #ea4335;">${lastBulk.failed}</span>
        </div>
        <div style="margin-top: 8px;">
          <div style="background: #dadce0; height: 6px; border-radius: 3px; overflow: hidden;">
            <div style="background: #34a853; height: 100%; width: ${successRate}%; transition: width 0.3s;"></div>
          </div>
          <div style="font-size: 11px; color: #666; margin-top: 4px; text-align: right;">
            ${successRate}% success rate
          </div>
        </div>
      </div>
    `;
  }
  
  // Show active campaigns
  if (activeCampaigns.length > 0) {
    html += '<div style="margin-top: 12px;"><strong style="color: #1a73e8;">Active Campaigns:</strong></div>';
    
    activeCampaigns.forEach((campaign, index) => {
      const progress = campaign.total > 0 ? ((campaign.sent / campaign.total) * 100).toFixed(0) : 0;
      const startTime = campaign.startTime ? new Date(campaign.startTime).toLocaleTimeString() : 'Immediate';
      
      html += `
        <div style="background: white; border: 1px solid #dadce0; padding: 10px; margin-top: 8px; border-radius: 4px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-weight: 500;">Campaign #${index + 1}</span>
            <span style="font-size: 12px; color: #666;">${startTime}</span>
          </div>
          <div class="stat" style="margin-bottom: 4px;">
            <span class="stat-label">Progress:</span>
            <span class="stat-value">${campaign.sent}/${campaign.total}</span>
          </div>
          <div style="margin-top: 6px;">
            <div style="background: #e8eaed; height: 6px; border-radius: 3px; overflow: hidden;">
              <div style="background: #1a73e8; height: 100%; width: ${progress}%; transition: width 0.3s;"></div>
            </div>
            <div style="font-size: 11px; color: #666; margin-top: 4px; text-align: right;">
              ${progress}%
            </div>
          </div>
        </div>
      `;
    });
  }
  
  progressSection.innerHTML = html;
}

// Load and display replies
async function loadReplies() {
  try {
    const result = await chrome.storage.local.get('emailReplies');
    const replies = result.emailReplies || [];
    
    displayReplies(replies);
  } catch (error) {
    console.error('Error loading replies:', error);
  }
}

function displayReplies(replies) {
  const repliesContent = document.getElementById('replies-content');
  
  if (replies.length === 0) {
    repliesContent.innerHTML = `
      <div style="text-align: center; color: #666; padding: 20px;">
        No tracked emails yet. Send some emails to start tracking!
      </div>
    `;
    return;
  }
  
  const withReply = replies.filter(r => r.hasReplied);
  const withoutReply = replies.filter(r => !r.hasReplied);
  
  let html = `
    <div style="background: #e8f0fe; padding: 10px; border-radius: 6px; margin-bottom: 12px;">
      <div style="display: flex; gap: 16px; font-size: 13px;">
        <div>
          <span style="color: #34a853; font-weight: 600;">Replied: ${withReply.length}</span>
        </div>
        <div>
          <span style="color: #ea4335; font-weight: 600;">No Reply: ${withoutReply.length}</span>
        </div>
      </div>
    </div>
  `;
  
  // Show replied emails (green border)
  withReply.slice(0, 5).forEach(email => {
    html += `
      <div class="reply-item has-reply">
        <div style="flex: 1;">
          <div style="font-weight: 500; font-size: 14px;">${email.to}</div>
          <div style="font-size: 12px; color: #666;">${email.subject || 'No subject'}</div>
          <div style="font-size: 11px; color: #888; margin-top: 4px;">Sent: ${new Date(email.sentAt).toLocaleDateString()}</div>
        </div>
        <div style="color: #34a853; font-weight: 600; font-size: 12px;">✓ Replied</div>
      </div>
    `;
  });
  
  // Show no-reply emails (red border)
  withoutReply.slice(0, 5).forEach(email => {
    html += `
      <div class="reply-item no-reply">
        <div style="flex: 1;">
          <div style="font-weight: 500; font-size: 14px;">${email.to}</div>
          <div style="font-size: 12px; color: #666;">${email.subject || 'No subject'}</div>
          <div style="font-size: 11px; color: #888; margin-top: 4px;">Sent: ${new Date(email.sentAt).toLocaleDateString()}</div>
        </div>
        <div style="color: #ea4335; font-weight: 600; font-size: 12px;">⚠ No Reply</div>
      </div>
    `;
  });
  
  if (replies.length > 10) {
    html += `
      <div style="text-align: center; margin-top: 12px;">
        <a href="#" style="color: #1a73e8; font-size: 13px;">View all (${replies.length})</a>
      </div>
    `;
  }
  
  repliesContent.innerHTML = html;
}

// Load and display follow-up rules
async function loadFollowUps() {
  try {
    const result = await chrome.storage.local.get('followUpRules');
    const rules = result.followUpRules || [];
    
    displayFollowUps(rules);
  } catch (error) {
    console.error('Error loading follow-ups:', error);
  }
}

function displayFollowUps(rules) {
  const followupContent = document.getElementById('followup-rules-content');
  
  if (rules.length === 0) {
    followupContent.innerHTML = `
      <div style="text-align: center; color: #666; padding: 20px;">
        No follow-up rules configured
      </div>
    `;
    return;
  }
  
  let html = '';
  rules.forEach((rule, index) => {
    html += `
      <div class="followup-rule">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <strong style="color: #1a73e8;">Follow-up #${index + 1}</strong>
          <button onclick="deleteFollowUp(${index})" style="background: #ea4335; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">Delete</button>
        </div>
        <div style="font-size: 12px; color: #666; margin-bottom: 6px;">Trigger: <strong>After ${rule.daysAfter} days</strong> if no reply</div>
        <div style="font-size: 12px; color: #666; margin-bottom: 6px;">Subject: ${rule.subject}</div>
        <div style="font-size: 12px; color: #666;">Status: <span style="color: ${rule.enabled ? '#34a853' : '#ea4335'}; font-weight: 600;">${rule.enabled ? 'Enabled' : 'Disabled'}</span></div>
      </div>
    `;
  });
  
  followupContent.innerHTML = html;
}

// Add follow-up rule
async function addFollowUpRule() {
  const days = prompt('Follow up after how many days?', '7');
  if (!days) return;
  
  const subject = prompt('Follow-up email subject:', 'Following up on my previous email');
  if (!subject) return;
  
  const message = prompt('Follow-up message (will be sent automatically):', 'Hi,\n\nI wanted to follow up on my previous email...');
  if (!message) return;
  
  const result = await chrome.storage.local.get('followUpRules');
  const rules = result.followUpRules || [];
  
  rules.push({
    daysAfter: parseInt(days),
    subject: subject,
    message: message,
    enabled: true
  });
  
  await chrome.storage.local.set({ followUpRules: rules });
  loadFollowUps();
}

// Delete follow-up rule
window.deleteFollowUp = async function(index) {
  if (!confirm('Delete this follow-up rule?')) return;
  
  const result = await chrome.storage.local.get('followUpRules');
  const rules = result.followUpRules || [];
  rules.splice(index, 1);
  
  await chrome.storage.local.set({ followUpRules: rules });
  loadFollowUps();
}

async function checkAuth() {
  const statusDiv = document.getElementById('status');
  
  // Try to get existing token
  try {
    const token = await new Promise((resolve, reject) => {
      chrome.identity.getAuthToken({ 
        interactive: false,
        scopes: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.modify',
          'https://www.googleapis.com/auth/spreadsheets.readonly',
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/contacts.readonly',
          'https://www.googleapis.com/auth/contacts'
        ]
      }, (token) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(token);
        }
      });
    });
    
    if (token) {
      statusDiv.className = 'status connected';
      statusDiv.textContent = '✅ Connected to Gmail';
      
      // Show reauthenticate button
      showReauthenticateButton();
      return true;
    }
  } catch (error) {
    console.log('Not authenticated:', error.message);
  }
  
  showNotConnected();
  return false;
}

function showReauthenticateButton() {
  const container = document.getElementById('reauthenticate-btn-container');
  if (container) {
    container.style.display = 'block';
    
    // Remove old listener
    const btn = document.getElementById('reauthenticate-btn');
    if (btn) {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
      
      // Add click listener
      newBtn.addEventListener('click', async () => {
        // Show loading state
        newBtn.textContent = '🔄 Authenticating...';
        newBtn.disabled = true;
        
        // Remove all cached tokens to force fresh auth
        try {
          const token = await new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ 
              interactive: false 
            }, (token) => {
              if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
              } else {
                resolve(token);
              }
            });
          });
          
          if (token) {
            await chrome.identity.removeCachedAuthToken({ token: token });
            console.log('Removed cached token');
            // Keep trying to remove more tokens
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.log('No cached token to remove or already removed');
        }
        
        // Authenticate with explicit scopes - this should go DIRECTLY to Google OAuth consent screen
        chrome.identity.getAuthToken({ 
          interactive: true,
          scopes: [
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.modify',
            'https://www.googleapis.com/auth/spreadsheets.readonly',
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events',
            'https://www.googleapis.com/auth/contacts.readonly',
            'https://www.googleapis.com/auth/contacts'
          ],
          account: { id: 'default' }
        }, (token) => {
          if (chrome.runtime.lastError) {
            console.error('Auth error:', chrome.runtime.lastError);
            newBtn.textContent = '🔄 Reauthenticate';
            newBtn.disabled = false;
            
            const error = chrome.runtime.lastError.message || '';
            if (error.includes('popup_closed')) {
              alert('Authentication cancelled. Please try again.');
            } else {
              alert('Reauthentication failed: ' + error);
            }
          } else if (token) {
            console.log('Reauthentication successful!');
            // Update storage
            chrome.storage.local.set({ needsAuth: false, lastAuthSuccess: Date.now() }, () => {
              alert('✅ Successfully reauthenticated!');
              location.reload();
            });
          }
        });
      });
    }
  }
}

function showNotConnected() {
  const statusDiv = document.getElementById('status');
  statusDiv.className = 'status disconnected';
  statusDiv.textContent = 'Not Connected - Click to authenticate';
  statusDiv.style.cursor = 'pointer';
  
  // Remove old listener if any
  const newStatusDiv = statusDiv.cloneNode(true);
  statusDiv.parentNode.replaceChild(newStatusDiv, statusDiv);
  
  // Add new listener
  newStatusDiv.addEventListener('click', async () => {
    try {
      // Get Chrome extension ID
      const redirectUri = chrome.identity.getRedirectURL();
      
      console.log('Redirect URI:', redirectUri);
      
      // Show loading state
      newStatusDiv.textContent = '🔄 Authenticating...';
      newStatusDiv.style.cursor = 'not-allowed';
      
      await chrome.identity.getAuthToken({ 
        interactive: true,
        scopes: [
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.modify',
          'https://www.googleapis.com/auth/spreadsheets.readonly',
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/contacts.readonly',
          'https://www.googleapis.com/auth/contacts'
        ],
        account: { id: 'default' }
      }, (token) => {
        if (chrome.runtime.lastError) {
          console.error('Auth error:', chrome.runtime.lastError);
          const error = chrome.runtime.lastError.message || '';
          
          // Reset button state
          newStatusDiv.textContent = 'Not Connected - Click to authenticate';
          newStatusDiv.style.cursor = 'pointer';
          
          if (error.includes('bad client id')) {
            alert('OAuth Configuration Error\n\nYour client ID needs to be configured for Chrome extensions.\n\nPlease:\n1. Go to Google Cloud Console\n2. Add redirect URI to your OAuth client:\n' + redirectUri + '\n3. Reload extension and try again');
          } else if (error.includes('popup_closed')) {
            alert('Authentication cancelled. Please try again.');
          } else {
            alert('Authentication failed: ' + error);
          }
        } else if (token) {
          console.log('Auth successful!');
          // Update storage
          chrome.storage.local.set({ needsAuth: false, lastAuthSuccess: Date.now() }, () => {
            location.reload(); // Refresh popup to show connected status
          });
        }
      });
    } catch (error) {
      console.error('Error authenticating:', error);
      alert('Authentication error: ' + error.message);
    }
  });
}

