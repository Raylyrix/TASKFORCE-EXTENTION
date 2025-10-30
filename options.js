// Options page script

document.addEventListener('DOMContentLoaded', () => {
  initializeTabs();
  loadTemplates();
  loadFollowUpRules();
  loadSettings();
});

function initializeTabs() {
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active from all
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      
      // Add active to clicked tab
      tab.classList.add('active');
      const tabId = tab.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });
  
  // Check hash for direct navigation
  const hash = window.location.hash.replace('#', '');
  if (hash) {
    const tab = document.querySelector(`[data-tab="${hash}"]`);
    if (tab) {
      tab.click();
    }
  }
}

async function loadTemplates() {
  const result = await chrome.storage.local.get('templates');
  const templates = result.templates || [];
  
  const listDiv = document.getElementById('templates-list');
  listDiv.innerHTML = '';
  
  templates.forEach((template, index) => {
    const div = document.createElement('div');
    div.style.cssText = 'border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; border-radius: 4px;';
    div.innerHTML = `
      <strong>${template.name}</strong>
      <p style="margin: 5px 0;">${template.subject}</p>
      <button onclick="deleteTemplate(${index})">Delete</button>
    `;
    listDiv.appendChild(div);
  });
}

async function saveTemplate() {
  const template = {
    name: document.getElementById('template-name').value,
    subject: document.getElementById('template-subject').value,
    body: document.getElementById('template-body').value
  };
  
  const result = await chrome.storage.local.get('templates');
  const templates = [...result.templates, template];
  await chrome.storage.local.set({ templates });
  
  // Clear form
  document.getElementById('template-name').value = '';
  document.getElementById('template-subject').value = '';
  document.getElementById('template-body').value = '';
  
  loadTemplates();
}

async function deleteTemplate(index) {
  const result = await chrome.storage.local.get('templates');
  const templates = result.templates;
  templates.splice(index, 1);
  await chrome.storage.local.set({ templates });
  
  loadTemplates();
}

async function sendBulk() {
  const templateName = document.getElementById('bulk-template').value;
  const recipientsText = document.getElementById('bulk-recipients').value;
  
  const recipients = recipientsText.split(/[,\n]/).map(r => r.trim()).filter(r => r);
  
  // Get template
  const result = await chrome.storage.local.get('templates');
  const template = result.templates.find(t => t.name === templateName);
  
  if (!template) {
    alert('Template not found');
    return;
  }
  
  // Create emails
  const emails = recipients.map(recipient => ({
    id: Date.now() + Math.random(),
    to: recipient,
    subject: template.subject,
    body: template.body,
    scheduledFor: new Date().toISOString(), // Send immediately
    status: 'scheduled'
  }));
  
  // Send message to background script
  chrome.runtime.sendMessage({
    action: 'sendBulkEmails',
    emails
  }, (response) => {
    if (response.success) {
      alert(`Sending ${recipients.length} emails...`);
    }
  });
}

async function loadFollowUpRules() {
  const result = await chrome.storage.local.get('autoFollowUpRules');
  const rules = result.autoFollowUpRules || [];
  
  const listDiv = document.getElementById('followup-list');
  listDiv.innerHTML = '';
  
  rules.forEach((rule, index) => {
    const div = document.createElement('div');
    div.style.cssText = 'border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; border-radius: 4px;';
    div.innerHTML = `
      <strong>${rule.name}</strong>
      <p style="margin: 5px 0;">Send after ${rule.days} days</p>
      <button onclick="deleteFollowUp(${index})">Delete</button>
    `;
    listDiv.appendChild(div);
  });
}

async function saveFollowUp() {
  const rule = {
    name: document.getElementById('followup-name').value,
    template: document.getElementById('followup-template').value,
    days: parseInt(document.getElementById('followup-days').value)
  };
  
  const result = await chrome.storage.local.get('autoFollowUpRules');
  const rules = [...result.autoFollowUpRules, rule];
  await chrome.storage.local.set({ autoFollowUpRules: rules });
  
  // Clear form
  document.getElementById('followup-name').value = '';
  document.getElementById('followup-days').value = '3';
  
  loadFollowUpRules();
}

async function deleteFollowUp(index) {
  const result = await chrome.storage.local.get('autoFollowUpRules');
  const rules = result.autoFollowUpRules;
  rules.splice(index, 1);
  await chrome.storage.local.set({ autoFollowUpRules: rules });
  
  loadFollowUpRules();
}

async function loadSettings() {
  const result = await chrome.storage.local.get('settings');
  const settings = result.settings || {};
  
  document.getElementById('enable-followup').checked = settings.autoFollowUpEnabled || false;
  document.getElementById('bulk-delay').value = settings.bulkSendDelay || 1000;
  document.getElementById('max-daily').value = settings.maxDailySend || 500;
  document.getElementById('enable-tracking').checked = settings.enableTracking || false;
  document.getElementById('enable-dark-mode').checked = settings.enableDarkMode || false;
  
  // Load additional data
  loadQuickReplies();
  loadScheduledQueue();
  loadTrackingData();
  
  // Setup CSV file handler
  document.getElementById('csv-file').addEventListener('change', handleCSVFile);
}

async function saveSettings() {
  const settings = {
    autoFollowUpEnabled: document.getElementById('enable-followup').checked,
    bulkSendDelay: parseInt(document.getElementById('bulk-delay').value),
    maxDailySend: parseInt(document.getElementById('max-daily').value),
    enableTracking: document.getElementById('enable-tracking').checked,
    enableDarkMode: document.getElementById('enable-dark-mode').checked
  };
  
  await chrome.storage.local.set({ settings });
  alert('Settings saved!');
  
  // Apply dark mode if enabled
  if (settings.enableDarkMode) {
    document.body.classList.add('dark-mode');
  } else {
    document.body.classList.remove('dark-mode');
  }
}

// === CSV IMPORT FUNCTIONALITY ===

let csvData = [];

async function handleCSVFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const text = await file.text();
  parseCSV(text);
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  if (lines.length === 0) return;
  
  const headers = lines[0].split(',').map(h => h.trim());
  csvData = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const obj = {};
    headers.forEach((header, idx) => {
      obj[header] = values[idx] || '';
    });
    csvData.push(obj);
  }
  
  previewCSVData();
}

function previewCSVData() {
  const previewDiv = document.getElementById('csv-preview');
  if (csvData.length === 0) {
    previewDiv.innerHTML = '<p>No data to preview</p>';
    return;
  }
  
  let html = `<p><strong>Preview: ${csvData.length} recipients</strong></p>`;
  html += '<div style="max-height: 200px; overflow-y: auto;">';
  csvData.slice(0, 5).forEach(row => {
    html += `<p style="margin: 5px 0;">${Object.values(row).join(' | ')}</p>`;
  });
  if (csvData.length > 5) {
    html += `<p>... and ${csvData.length - 5} more</p>`;
  }
  html += '</div>';
  
  previewDiv.innerHTML = html;
}

async function previewCSV() {
  if (csvData.length === 0) {
    const fileInput = document.getElementById('csv-file');
    if (fileInput.files.length > 0) {
      await handleCSVFile({ target: fileInput });
    } else {
      alert('Please select a CSV file first');
      return;
    }
  }
  
  const templateName = document.getElementById('csv-template').value;
  if (!templateName) {
    alert('Please select a template');
    return;
  }
  
  const result = await chrome.storage.local.get('templates');
  const template = result.templates?.find(t => t.name === templateName);
  
  if (!template) {
    alert('Template not found');
    return;
  }
  
  // Preview with variable replacement
  let html = '<h3>Email Preview</h3>';
  csvData.slice(0, 3).forEach(row => {
    const personalizedSubject = replaceVariables(template.subject, row);
    const personalizedBody = replaceVariables(template.body, row);
    html += `<div style="border: 1px solid #ddd; padding: 10px; margin: 10px 0; border-radius: 4px;">`;
    html += `<p><strong>To:</strong> ${row.email || 'N/A'}</p>`;
    html += `<p><strong>Subject:</strong> ${personalizedSubject}</p>`;
    html += `<p><strong>Body:</strong> ${personalizedBody.substring(0, 100)}...</p>`;
    html += `</div>`;
  });
  
  document.getElementById('csv-preview').innerHTML = html;
  
  // Ask if ready to send
  if (confirm(`Ready to send ${csvData.length} emails?`)) {
    await sendCSVEmails(templateName);
  }
}

function replaceVariables(text, data) {
  let result = text;
  Object.keys(data).forEach(key => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, data[key]);
  });
  // Also support common variables
  result = result.replace(/{{name}}/g, data.name || data.Name || '');
  result = result.replace(/{{company}}/g, data.company || data.Company || '');
  result = result.replace(/{{email}}/g, data.email || data.Email || '');
  return result;
}

async function sendCSVEmails(templateName) {
  const result = await chrome.storage.local.get('templates');
  const template = result.templates?.find(t => t.name === templateName);
  
  if (!template) {
    alert('Template not found');
    return;
  }
  
  const emails = csvData.map(row => ({
    id: Date.now() + Math.random(),
    to: row.email || row.Email,
    subject: replaceVariables(template.subject, row),
    body: replaceVariables(template.body, row),
    scheduledFor: new Date().toISOString(),
    status: 'scheduled'
  }));
  
  // Send to background script
  chrome.runtime.sendMessage({
    action: 'sendBulkEmails',
    emails
  }, (response) => {
    if (response.success) {
      alert(`Sending ${csvData.length} personalized emails...`);
      csvData = [];
      document.getElementById('csv-file').value = '';
    }
  });
}

// === QUICK REPLIES ===

async function loadQuickReplies() {
  const result = await chrome.storage.local.get('quickReplies');
  const replies = result.quickReplies || [];
  
  const listDiv = document.getElementById('quickreplies-list');
  listDiv.innerHTML = '';
  
  replies.forEach((reply, index) => {
    const div = document.createElement('div');
    div.style.cssText = 'border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; border-radius: 4px;';
    div.innerHTML = `
      <strong>${reply.shortcut}</strong> <span style="color: #666;">(${reply.category})</span>
      <p style="margin: 5px 0;">${reply.text.substring(0, 100)}...</p>
      <button onclick="deleteQuickReply(${index})">Delete</button>
    `;
    listDiv.appendChild(div);
  });
}

async function saveQuickReply() {
  const shortcut = document.getElementById('reply-shortcut').value;
  const category = document.getElementById('reply-category').value;
  const text = document.getElementById('reply-text').value;
  
  if (!shortcut || !text) {
    alert('Please fill in all fields');
    return;
  }
  
  const reply = { shortcut, category, text };
  
  const result = await chrome.storage.local.get('quickReplies');
  const replies = [...(result.quickReplies || []), reply];
  await chrome.storage.local.set({ quickReplies: replies });
  
  document.getElementById('reply-shortcut').value = '';
  document.getElementById('reply-text').value = '';
  
  loadQuickReplies();
}

async function deleteQuickReply(index) {
  const result = await chrome.storage.local.get('quickReplies');
  const replies = result.quickReplies;
  replies.splice(index, 1);
  await chrome.storage.local.set({ quickReplies: replies });
  
  loadQuickReplies();
}

// === SCHEDULED QUEUE ===

async function loadScheduledQueue() {
  const result = await chrome.storage.local.get('scheduledEmails');
  const scheduledEmails = result.scheduledEmails || [];
  
  const queueDiv = document.getElementById('scheduled-queue');
  
  if (scheduledEmails.length === 0) {
    queueDiv.innerHTML = '<p>No scheduled emails</p>';
    return;
  }
  
  let html = '<div style="max-height: 400px; overflow-y: auto;">';
  scheduledEmails.forEach(email => {
    const date = new Date(email.scheduledFor).toLocaleString();
    html += `<div style="border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; border-radius: 4px;">`;
    html += `<p><strong>To:</strong> ${email.to}</p>`;
    html += `<p><strong>Subject:</strong> ${email.subject}</p>`;
    html += `<p><strong>Scheduled:</strong> ${date}</p>`;
    html += `<p><strong>Status:</strong> ${email.status}</p>`;
    if (email.recurring && email.recurring !== 'none') {
      html += `<p><strong>Recurring:</strong> ${email.recurring}</p>`;
    }
    html += `<button onclick="cancelScheduledEmail('${email.id}')">Cancel</button>`;
    html += `</div>`;
  });
  html += '</div>';
  
  queueDiv.innerHTML = html;
}

async function cancelScheduledEmail(emailId) {
  if (!confirm('Cancel this scheduled email?')) return;
  
  const result = await chrome.storage.local.get('scheduledEmails');
  const scheduledEmails = result.scheduledEmails.filter(e => e.id !== emailId);
  await chrome.storage.local.set({ scheduledEmails });
  
  // Cancel alarm
  chrome.alarms.clear(`sendEmail_${emailId}`);
  
  loadScheduledQueue();
  alert('Email cancelled');
}

// === EMAIL TRACKING ===

async function loadTrackingData() {
  const result = await chrome.storage.local.get('trackedEmails');
  const trackedEmails = result.trackedEmails || [];
  
  // Display tracked emails
  const listDiv = document.getElementById('tracked-emails-list');
  if (trackedEmails.length === 0) {
    listDiv.innerHTML = '<p>No tracked emails yet. Enable tracking in settings and send emails to start tracking.</p>';
  } else {
    let html = '<div style="max-height: 300px; overflow-y: auto;">';
    trackedEmails.slice(0, 20).forEach(email => {
      html += `<div style="border: 1px solid #ddd; padding: 10px; margin-bottom: 10px; border-radius: 4px;">`;
      html += `<p><strong>To:</strong> ${email.to}</p>`;
      html += `<p><strong>Subject:</strong> ${email.subject}</p>`;
      html += `<p><strong>Opens:</strong> ${email.opens || 0} times</p>`;
      html += `<p><strong>Clicks:</strong> ${email.clicks || 0} times</p>`;
      html += `<p><strong>Sent:</strong> ${new Date(email.sentAt).toLocaleString()}</p>`;
      html += `</div>`;
    });
    html += '</div>';
    listDiv.innerHTML = html;
  }
  
  // Calculate stats
  calculateTrackingStats(trackedEmails);
}

function calculateTrackingStats(trackedEmails) {
  const totalSent = trackedEmails.length;
  const totalOpens = trackedEmails.reduce((sum, e) => sum + (e.opens || 0), 0);
  const totalClicks = trackedEmails.reduce((sum, e) => sum + (e.clicks || 0), 0);
  const openRate = totalSent > 0 ? ((totalOpens / totalSent) * 100).toFixed(1) : 0;
  const clickRate = totalSent > 0 ? ((totalClicks / totalSent) * 100).toFixed(1) : 0;
  
  document.getElementById('total-sent').textContent = totalSent;
  document.getElementById('total-opens').textContent = totalOpens;
  document.getElementById('total-clicks').textContent = totalClicks;
  document.getElementById('open-rate').textContent = openRate + '%';
  document.getElementById('click-rate').textContent = clickRate + '%';
}

