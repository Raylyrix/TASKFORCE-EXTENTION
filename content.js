// Content script injected into Gmail
// TaskForce Email Manager

console.log('TaskForce Email Manager: Content script loaded');

// Check if we're on Gmail
function isGmailPage() {
  return window.location.hostname === 'mail.google.com' || window.location.hostname === 'gmail.com';
}

// Show user-friendly notification when compose window is required
function showComposeRequiredNotification(message) {
  // Try to send native notification first
  chrome.runtime.sendMessage({ 
    action: 'showNotification', 
    title: 'Action Requires Compose', 
    message: message 
  }).catch(() => {
    // Fallback to alert if notification fails
    alert(message);
  });
}

// Inject UI elements into Gmail
function injectEmailManagerUI() {
  console.log('TaskForce Email Manager: Initializing Gmail integration...');
  
  // Make sure we're on Gmail
  if (!isGmailPage()) {
    console.log('TaskForce Email Manager: Not on Gmail, skipping injection');
    return;
  }
  
  console.log('TaskForce Email Manager: Gmail detected, injecting UI...');
  
  // Wait a bit for Gmail to initialize
  setTimeout(() => {
    // Add Schedule button to compose window
    observeComposeWindow();
    
    // Add notification that extension is active
    showExtensionActiveNotification();
    // Command palette
    initCommandPalette();
    
    console.log('TaskForce Email Manager: UI injection complete');
  }, 1000);
}

// Command palette (Ctrl/Cmd+K)
function initCommandPalette() {
  if (window.__aem_cmd_palette) return; // once
  window.__aem_cmd_palette = true;
  document.addEventListener('keydown', (e) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC')>=0;
    if ((isMac && e.metaKey && e.key.toLowerCase()==='k') || (!isMac && e.ctrlKey && e.key.toLowerCase()==='k')) {
      e.preventDefault();
      showCommandPalette();
    }
  }, true);
}

function showCommandPalette() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:2147483647;display:flex;align-items:flex-start;justify-content:center;padding-top:10vh;';
  const box = document.createElement('div');
  box.style.cssText = 'width: min(720px, 90%); background:#fff; border:1px solid #dadce0; border-radius:8px; box-shadow:0 16px 48px rgba(0,0,0,0.2);';
  box.innerHTML = `
    <div style="padding:8px 12px; border-bottom:1px solid #dadce0; font-weight:600;">TaskForce – Command Palette</div>
    <div style="padding:12px; display:grid; gap:8px;">
      <button data-cmd="bulk" style="text-align:left;padding:10px;border:1px solid #dadce0;border-radius:6px;background:#fff;cursor:pointer;">Open Bulk Composer</button>
      <button data-cmd="availability" style="text-align:left;padding:10px;border:1px solid #dadce0;border-radius:6px;background:#fff;cursor:pointer;">Insert Availability (next 14 days)</button>
      <button data-cmd="templates" style="text-align:left;padding:10px;border:1px solid #dadce0;border-radius:6px;background:#fff;cursor:pointer;">Manage Templates</button>
      <button data-cmd="analytics" style="text-align:left;padding:10px;border:1px solid #dadce0;border-radius:6px;background:#fff;cursor:pointer;">Open Analytics</button>
    </div>`;
  overlay.appendChild(box);
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target===overlay) overlay.remove(); });
  box.querySelectorAll('button[data-cmd]')?.forEach(btn => {
    btn.addEventListener('click', async () => {
      const cmd = btn.getAttribute('data-cmd');
      overlay.remove();
      if (cmd==='bulk') { showBulkComposerModal(); return; }
      if (cmd==='templates') { const cc = document.querySelector('[role="dialog"]'); cc? showTemplatesModal(cc): showComposeRequiredNotification('Open a compose window to manage templates.'); return; }
      if (cmd==='analytics') { showAnalyticsModal(); return; }
      if (cmd==='availability') {
        try {
          const resp = await new Promise((resolve)=> chrome.runtime.sendMessage({ action:'generateAvailabilitySlots', daysAhead:14, windowStart:'09:00', windowEnd:'17:00', slotMinutes:30, gapMinutes:0 }, resolve));
          if (!resp || !resp.success) { alert('Could not generate availability'); return; }
          const slots = (resp.slots||[]).slice(0, 10);
          if (slots.length===0) { alert('No free slots found'); return; }
          const compose = document.querySelector('[role="dialog"]');
          if (!compose) { showComposeRequiredNotification('Open a compose window first.'); return; }
          const bodyEl = compose.querySelector('[contenteditable="true"][g_editable="true"]');
          if (!bodyEl) { showComposeRequiredNotification('Open a compose window first.'); return; }
          const list = slots.map(s=>{
            const dt = new Date(s.start);
            return `${dt.toLocaleString()} – <a href="https://calendar.google.com/calendar/u/0/r/eventedit?dates=${s.start.replace(/[-:]/g,'').split('.')[0].replace('T','/').replace('Z','Z')}/${s.end.replace(/[-:]/g,'').split('.')[0].replace('T','/').replace('Z','Z')}&text=Meeting&location=Google+Meet&details=Suggested+slot">Pick this time</a>`;
          }).join('<br>');
          bodyEl.focus();
          document.execCommand('insertHTML', false, `<div><br><strong>My availability:</strong><br>${list}</div>`);
        } catch (_) { alert('Failed to insert availability'); }
      }
    });
  });
}

// Show notification that extension is active
function showExtensionActiveNotification() {
  const notification = document.createElement('div');
  notification.id = 'aem-active-notification';
  notification.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: #4285f4;
    color: white;
    padding: 10px 20px;
    border-radius: 4px;
    z-index: 999999;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    font-family: Roboto, Arial, sans-serif;
    font-size: 14px;
  `;
  notification.textContent = '✅ TaskForce Email Manager Active';
  document.body.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
  
  // Add sidebar with tabs for Gmail
  addGmailSidebar();
  // Ensure Bulk Send entry is present and kept present
  startBulkSendButtonObserver();
}

// Add sidebar tabs in Gmail main view
function addGmailSidebar() {
  // Find Gmail's left sidebar navigation
  const sidebar = document.querySelector('[role="navigation"]');
  if (!sidebar) {
    console.log('Gmail sidebar not found');
    return;
  }
  
  // Check if already added
  if (sidebar.querySelector('.aem-gmail-tabs')) {
    return;
  }
  
  // Create TaskForce section
  const taskforceSection = document.createElement('div');
  taskforceSection.className = 'aem-gmail-tabs aem-theme-luxe';
  taskforceSection.style.cssText = 'margin-top: 20px; padding: 12px 8px; border-top: 1px solid #dadce0;';
  
  taskforceSection.innerHTML = `
    <div style="padding: 0 8px 12px; color: #5f6368; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
      TaskForce
    </div>
    <div class="aem-tab-item" data-tab="send" style="display: flex; align-items: center; padding: 8px; border-radius: 4px; cursor: pointer; margin-bottom: 4px; transition: background 0.2s;">
      <span style="margin-right: 16px; font-size: 20px;">📧</span>
      <span style="font-size: 14px; color: #202124;">Send & Schedule</span>
    </div>
    <div class="aem-tab-item" data-tab="track" style="display: flex; align-items: center; padding: 8px; border-radius: 4px; cursor: pointer; margin-bottom: 4px; transition: background 0.2s;">
      <span style="margin-right: 16px; font-size: 20px;">📊</span>
      <span style="font-size: 14px; color: #202124;">Track & Engage</span>
    </div>
    <div class="aem-tab-item" data-tab="settings" style="display: flex; align-items: center; padding: 8px; border-radius: 4px; cursor: pointer; margin-bottom: 4px; transition: background 0.2s;">
      <span style="margin-right: 16px; font-size: 20px;">⚙️</span>
      <span style="font-size: 14px; color: #202124;">Settings & Tools</span>
    </div>
  `;
  
  // Insert after the last nav item
  sidebar.appendChild(taskforceSection);
  
  // Add hover and click handlers
  taskforceSection.querySelectorAll('.aem-tab-item').forEach(item => {
    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = '#f8f9fa';
    });
    item.addEventListener('mouseleave', () => {
      if (!item.classList.contains('active')) {
        item.style.backgroundColor = 'transparent';
      }
    });
    
    // Click handler - show content in Gmail view
    item.addEventListener('click', () => {
      // Remove active class from all
      taskforceSection.querySelectorAll('.aem-tab-item').forEach(i => {
        i.classList.remove('active');
        i.style.backgroundColor = 'transparent';
        i.style.color = '#202124';
      });
      
      // Add active class to clicked item
      item.classList.add('active');
      item.style.backgroundColor = '#e8f0fe';
      item.style.color = '#1a73e8';
      item.querySelector('span').style.color = '#1a73e8';
      
      // Show tab content in Gmail view
      showTabContent(item.dataset.tab);
    });
  });
  
  console.log('TaskForce sidebar tabs added to Gmail');
}

// Ensure a persistent Bulk Send button in Gmail sidebar that opens our own composer modal
function ensureBulkSendEntry() {
  try {
    const sidebar = document.querySelector('[role="navigation"]');
    if (!sidebar) return;
    if (sidebar.querySelector('#aem-bulk-send-entry')) return;

    const entry = document.createElement('div');
    entry.id = 'aem-bulk-send-entry';
    entry.style.cssText = 'margin: 8px 8px 0 8px;';
    entry.innerHTML = `
      <button id="aem-bulk-send-btn" style="width: 100%; display: inline-flex; align-items: center; gap: 8px; padding: 10px 12px; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; color: #fff; background: linear-gradient(135deg, #667eea, #764ba2); box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
        <span style="font-size: 16px;">📤</span>
        <span>Bulk Send</span>
      </button>
    `;
    sidebar.appendChild(entry);

    const btn = entry.querySelector('#aem-bulk-send-btn');
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      showBulkComposerModal();
    }, true);
  } catch (e) {
    console.warn('ensureBulkSendEntry error', e);
  }
}

// Full custom Bulk Composer modal (independent from Gmail native composer)
function showBulkComposerModal() {
  const existing = document.querySelector('.aem-bulk-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'aem-bulk-modal-overlay';
  overlay.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 2147483647;
    display: flex; align-items: center; justify-content: center;`;

  const modal = document.createElement('div');
  modal.style.cssText = `
    width: 600px; max-width: 90%; max-height: 90vh; overflow: hidden; background: #fff; border: 1px solid #dadce0; border-radius: 8px; padding: 0;
    box-shadow: 0 8px 24px rgba(0,0,0,0.2); font-family: Roboto, Arial, sans-serif;`;

  modal.innerHTML = `
    <div style="display:flex; justify-content: space-between; align-items:center; padding:8px 12px; border-bottom:1px solid #dadce0; background:#fff;">
      <h3 style="margin:0; font-size:16px; color:#202124; font-weight:500;">Bulk Composer</h3>
      <button id="aem-close-composer" title="Close" style="border:none;background:transparent;color:#5f6368;border-radius:4px;padding:6px 8px;cursor:pointer;">✕</button>
    </div>
    <div style="display:grid; gap:10px; padding:12px; background:#fff; max-height: calc(90vh - 56px); overflow-y: auto;">
      <textarea id="aem-bulk-recipients" placeholder="Recipients (one email per line or comma-separated)" style="width:100%; min-height:90px; border:1px solid #dadce0; border-radius:4px; padding:10px; font-size:13px; background:#fff; color:#202124;"></textarea>
      <input id="aem-bulk-subject" placeholder="Subject" style="width:100%; border:1px solid #dadce0; border-radius:4px; padding:10px; font-size:13px; background:#fff; color:#202124;" />
      <textarea id="aem-bulk-body" placeholder="Message (HTML allowed)" style="width:100%; min-height:160px; border:1px solid #dadce0; border-radius:4px; padding:10px; font-size:13px; background:#fff; color:#202124;"></textarea>
      <div style="border:1px solid #dadce0; border-radius:4px; padding:12px; background:#fff;">
        <div style="font-weight:600; color:#202124; margin-bottom:8px;">Import Recipients from Google Sheets (optional)</div>
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
          <input id="aem-sheets-url" type="text" placeholder="Google Sheets URL (accessible to your account)" style="flex:1; border:1px solid #dadce0; border-radius:6px; padding:8px; font-size:13px;" />
          <button id="aem-load-sheets" style="padding:8px 12px; border:none; border-radius:6px; background:#1a73e8; color:#fff; cursor:pointer;">Load Sheet</button>
          <button id="aem-clear-sheets" style="display:none; padding:8px 12px; border:1px solid #dadce0; border-radius:6px; background:#fff; color:#202124; cursor:pointer;">Clear</button>
        </div>
        <div id="aem-sheets-mapping" style="display:none; margin-bottom:8px;">
          <label style="font-size:12px; color:#5f6368; margin-right:8px;">Email column:</label>
          <select id="aem-email-column" style="border:1px solid #dadce0; border-radius:4px; padding:6px; font-size:12px; background:#fff; color:#202124;"></select>
          <span style="font-size:12px; color:#5f6368; margin-left:12px;">Use {{name}}, {{company}} in subject/body</span>
        </div>
        <div id="aem-sheet-preview" style="display:none; font-size:12px; color:#202124; background:#fff; border:1px solid #dadce0; border-radius:4px; padding:8px; max-height:160px; overflow:auto;"></div>
      </div>
      <div style="border:1px solid #dadce0; border-radius:4px; padding:12px; background:#fff;">
        <div style="font-weight:600; color:#202124; margin-bottom:8px;">Google Meet / Calendar (optional)</div>
        <label style="display:flex; align-items:center; gap:8px; margin-bottom:8px;"><input type="checkbox" id="aem-meet-create"> <span style="font-size:13px;color:#202124;">Create Google Calendar event(s) with Meet link</span></label>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
          <input id="aem-meet-title" placeholder="Event title (e.g. Meeting with {{email}})" style="border:1px solid #dadce0; border-radius:4px; padding:8px; font-size:13px; background:#fff; color:#202124;" />
          <input id="aem-meet-duration" type="number" min="15" step="15" value="30" placeholder="Duration (min)" style="border:1px solid #dadce0; border-radius:4px; padding:8px; font-size:13px; background:#fff; color:#202124;" />
        </div>
        <div style="font-size:12px; color:#5f6368; margin-top:6px;">Uses Bulk start time if set; otherwise schedules ~1 hour from now. Insert {{meet_link}} in your message to place the link inline.</div>
      </div>
      <div>
        <label style="font-size:12px; color:#5f6368; font-weight:600;">Attachments</label>
        <input id="aem-file-input" type="file" multiple style="display:block; margin-top:6px;" />
        <div id="aem-attach-list" style="margin-top:8px; display:grid; gap:6px;"></div>
        <div style="font-size:11px;color:#5f6368;margin-top:6px;">Max 10 files, total ≤ 10MB</div>
      </div>
      <div style="display:flex; gap:10px;">
        <input id="aem-start-time" type="datetime-local" style="flex:1; border:1px solid #dadce0; border-radius:4px; padding:8px; background:#fff; color:#202124;" />
        <input id="aem-delay-ms" type="number" min="0" placeholder="Delay between emails (ms)" style="width:220px; border:1px solid #dadce0; border-radius:4px; padding:8px; background:#fff; color:#202124;" />
      </div>
      <div style="display:flex; gap:10px; justify-content:flex-end;">
        <button id="aem-send-now" style="padding:8px 14px; border:none; border-radius:4px; background:#1a73e8; color:#fff; cursor:pointer; min-width:96px;">Send</button>
        <button id="aem-schedule" style="padding:8px 14px; border:1px solid #dadce0; border-radius:4px; background:#fff; color:#202124; cursor:pointer; min-width:96px;">Schedule</button>
      </div>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const closeBtn = modal.querySelector('#aem-close-composer');
  closeBtn.addEventListener('click', () => overlay.remove());

  const attachList = modal.querySelector('#aem-attach-list');
  const fileInput = modal.querySelector('#aem-file-input');
  const selected = [];
  let sheetRows = [];
  let sheetHeaders = [];
  let lastFocus = 'body';
  const subjEl = modal.querySelector('#aem-bulk-subject');
  const bodyEl = modal.querySelector('#aem-bulk-body');
  subjEl.addEventListener('focus', () => { lastFocus = 'subject'; });
  bodyEl.addEventListener('focus', () => { lastFocus = 'body'; });

  // Insert variable section dynamically after sheet preview block
  try {
    const previewBlock = modal.querySelector('#aem-sheet-preview');
    if (previewBlock) {
      const section = document.createElement('div');
      section.id = 'aem-variable-section';
      section.style.cssText = 'border:1px solid #e8eaed; border-radius:8px; padding:12px; background:#f7f7f8;';
      section.innerHTML = `
        <div style="font-weight:600; color:#202124; margin-bottom:8px;">Insert Variables</div>
        <div id="aem-variable-chips" style="display:flex; flex-wrap:wrap; gap:8px;"><span style="font-size:12px; color:#5f6368;">Load a sheet to see available variables.</span></div>
      `;
      previewBlock.parentElement.insertAdjacentElement('afterend', section);
    }
  } catch (_) {}

  function renderVariableChips() {
    try {
      const chips = modal.querySelector('#aem-variable-chips');
      if (!chips) return;
      chips.innerHTML = '';
      if (!sheetHeaders || sheetHeaders.length === 0) {
        chips.innerHTML = '<span style="font-size:12px; color:#5f6368;">Load a sheet to see available variables.</span>';
        return;
      }
      sheetHeaders.forEach((h) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = `{{${h}}}`;
        btn.style.cssText = 'padding:6px 10px; border:1px solid #dadce0; border-radius:16px; background:#fff; cursor:pointer; font-size:12px;';
        btn.addEventListener('click', () => {
          const token = `{{${h}}}`;
          const target = (lastFocus === 'subject') ? subjEl : bodyEl;
          insertAtCursor(target, token);
        });
        chips.appendChild(btn);
      });
    } catch (_) {}
  }

  function insertAtCursor(el, text) {
    try {
      if (!el) return;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const before = el.value.substring(0, start);
      const after = el.value.substring(end);
      el.value = before + text + after;
      const pos = start + text.length;
      el.focus();
      el.setSelectionRange(pos, pos);
    } catch (_) {
      el.value += text;
    }
  }

  function setSheetsLoadedUI(loaded) {
    const mapping = modal.querySelector('#aem-sheets-mapping');
    const preview = modal.querySelector('#aem-sheet-preview');
    const clearBtn = modal.querySelector('#aem-clear-sheets');
    mapping.style.display = loaded ? 'block' : 'none';
    preview.style.display = loaded ? 'block' : 'none';
    clearBtn.style.display = loaded ? 'inline-block' : 'none';
  }

  function refreshAttachList() {
    attachList.innerHTML = '';
    selected.forEach((att, idx) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; justify-content: space-between; align-items:center; border:1px solid #e8eaed; border-radius:6px; padding:6px 8px;';
      row.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; font-size:12px; color:#202124;">
          <span>📎</span>
          <span>${att.filename}</span>
          <span style="color:#5f6368;">(${Math.round(att.size/1024)} KB)</span>
        </div>
        <button data-idx="${idx}" style="border:none;background:#fdecea;color:#b00020;border-radius:6px;padding:4px 8px;cursor:pointer;font-size:12px;">Remove</button>
      `;
      row.querySelector('button').addEventListener('click', (e) => {
        const i = parseInt(e.currentTarget.getAttribute('data-idx'), 10);
        selected.splice(i, 1);
        refreshAttachList();
      });
      attachList.appendChild(row);
    });
  }

  fileInput.addEventListener('change', () => {
    const files = Array.from(fileInput.files || []);
    const MAX_FILES = 10;
    const MAX_TOTAL = 10 * 1024 * 1024;
    let total = selected.reduce((a, b) => a + (b.size || 0), 0);

    files.slice(0, MAX_FILES - selected.length).forEach((file) => {
      if (total + file.size > MAX_TOTAL) return;
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result.split(',')[1] || '';
        selected.push({ filename: file.name, mimeType: file.type || 'application/octet-stream', dataBase64: base64, size: file.size });
        refreshAttachList();
      };
      reader.readAsDataURL(file);
      total += file.size;
    });
    // Reset input so same file can be chosen again later
    fileInput.value = '';
  });

  // Sheets helpers and events
  function extractSheetId(url) {
    try {
      const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      return m ? m[1] : null;
    } catch (_) { return null; }
  }

  function renderSheetPreview() {
    const preview = modal.querySelector('#aem-sheet-preview');
    const emailCol = (modal.querySelector('#aem-email-column')?.value || 'email');
    const rows = sheetRows.slice(0, 10).map((r, i) => {
      const email = r[emailCol] || '';
      const rest = sheetHeaders.filter(h => h !== emailCol).slice(0, 3).map(h => `${h}: ${r[h] || ''}`).join(' • ');
      return `<div style="padding:4px 0; border-bottom:1px solid #f1f3f4;"><strong>${i+1}.</strong> ${email} <span style=\"color:#5f6368;\">${rest}</span></div>`;
    }).join('');
    const extra = sheetRows.length > 10 ? `<div style=\"color:#5f6368; font-style:italic; padding-top:4px;\">... and ${sheetRows.length - 10} more</div>` : '';
    preview.innerHTML = rows + extra;
  }

  function populateEmailColumnOptions(headers) {
    const sel = modal.querySelector('#aem-email-column');
    sel.innerHTML = '';
    headers.forEach(h => {
      const opt = document.createElement('option');
      opt.value = h;
      opt.textContent = h;
      if (h.toLowerCase() === 'email') opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', renderSheetPreview);
  }

  modal.querySelector('#aem-load-sheets')?.addEventListener('click', () => {
    const url = (modal.querySelector('#aem-sheets-url').value || '').trim();
    const sheetId = extractSheetId(url);
    if (!sheetId) {
      alert('Invalid Google Sheets URL');
      return;
    }
    const btn = modal.querySelector('#aem-load-sheets');
    const original = btn.textContent;
    btn.textContent = 'Loading...';
    btn.disabled = true;
    chrome.runtime.sendMessage({ action: 'fetchSheetsData', sheetId }, (response) => {
      btn.textContent = original;
      btn.disabled = false;
      if (!response || !response.success) {
        alert('Failed to load sheet: ' + (response?.error || 'Unknown error'));
        return;
      }
      const data = response.data || [];
      if (!Array.isArray(data) || data.length === 0) {
        alert('No rows found in sheet');
        return;
      }
      sheetRows = data.map(r => {
        const o = {};
        Object.keys(r).forEach(k => { o[k.toLowerCase().trim()] = r[k]; });
        return o;
      });
      sheetHeaders = Array.from(new Set(sheetRows.flatMap(r => Object.keys(r))));
      populateEmailColumnOptions(sheetHeaders);
      setSheetsLoadedUI(true);
      renderSheetPreview();
      renderVariableChips();
    });
  });

  modal.querySelector('#aem-clear-sheets')?.addEventListener('click', () => {
    sheetRows = [];
    sheetHeaders = [];
    setSheetsLoadedUI(false);
    modal.querySelector('#aem-sheet-preview').innerHTML = '';
    renderVariableChips();
  });

  function replaceVariables(text, row) {
    if (!text) return text;
    return text.replace(/\{\{\s*([a-z0-9_\-]+)\s*\}\}/gi, (m, key) => {
      const v = row[(key || '').toLowerCase()];
      return (v === undefined || v === null) ? '' : String(v);
    });
  }

  function parseRecipients(text) {
    if (!text) return [];
    const raw = text.split(/\n|,|;|\s/).map(s => s.trim()).filter(Boolean);
    const seen = new Set();
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
    return raw.filter(e => re.test(e) && !seen.has(e) && seen.add(e));
  }

  async function submitBulk(schedule) {
    const manualRecipients = parseRecipients(modal.querySelector('#aem-bulk-recipients').value);
    const subject = (modal.querySelector('#aem-bulk-subject').value || '').trim();
    const body = modal.querySelector('#aem-bulk-body').value || '';
    const startVal = modal.querySelector('#aem-start-time').value;
    const delayMs = parseInt(modal.querySelector('#aem-delay-ms').value || '1000', 10);

    if (!subject) { alert('Subject is required'); return; }
    if (!body) { alert('Message body is required'); return; }

    let emails = [];
    if (sheetRows.length > 0) {
      const emailCol = (modal.querySelector('#aem-email-column').value || 'email').toLowerCase();
      if (!sheetHeaders.includes(emailCol)) { alert('Selected email column not found in sheet'); return; }
      const seen = new Set();
      sheetRows.forEach(row => {
        const to = (row[emailCol] || '').toString().trim();
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
        if (!re.test(to) || seen.has(to)) return;
        seen.add(to);
        emails.push({
          to,
          subject: replaceVariables(subject, row),
          body: replaceVariables(body, row),
          attachments: selected
        });
      });
      if (emails.length === 0) { alert('No valid email addresses found in the sheet'); return; }
    } else {
      if (manualRecipients.length === 0) { alert('Add at least one valid recipient'); return; }
      emails = manualRecipients.map(to => ({ to, subject, body, attachments: selected }));
    }

    const startTime = schedule && startVal ? new Date(startVal).toISOString() : new Date().toISOString();

    const wantsMeet = !!modal.querySelector('#aem-meet-create')?.checked;
    if (wantsMeet) {
      try {
        const title = (modal.querySelector('#aem-meet-title')?.value || 'Meeting with {{email}}').trim();
        const durationMin = parseInt(modal.querySelector('#aem-meet-duration')?.value || '30', 10);
        const uniqueRecipients = [...new Set(emails.map(e => e.to))];
        chrome.runtime.sendMessage({ action: 'createMeetEventsBulk', recipients: uniqueRecipients, title, startTime, durationMin }, (resp) => {
          if (resp && resp.success) {
            const links = resp.links || {};
            emails = emails.map(e => {
              const link = links[e.to] || '';
              if (!link) return e;
              const replaced = e.body.includes('{{meet_link}}') ? e.body.replace(/\{\{\s*meet_link\s*\}\}/ig, link) : (e.body + `\n\n<div style=\"font-size:13px;\">Join: <a href=\"${link}\">${link}</a></div>`);
              return { ...e, body: replaced };
            });
          }
          proceedSend();
        });
      } catch (_) {
        proceedSend();
      }
    } else {
      proceedSend();
    }

    function proceedSend() {
      chrome.runtime.sendMessage({ action: 'getBackendStatus' }, (statusResp) => {
        if (statusResp && statusResp.success && statusResp.status !== 'ready') {
          const proceed = confirm('Backend appears offline. Proceed in local mode? You must keep your PC on.');
          if (!proceed) return;
        }
        chrome.runtime.sendMessage({
          action: 'handleBulkSendHybrid',
          emails,
          startTime,
          delay: delayMs
        }, (response) => {
          if (!response || response.error || !response.success) {
            alert('Error: ' + (response && response.error ? response.error : 'Failed'));
            return;
          }
          overlay.remove();
        });
      });
    }
  }

  modal.querySelector('#aem-send-now').addEventListener('click', () => submitBulk(false));
  modal.querySelector('#aem-schedule').addEventListener('click', () => submitBulk(true));

  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
}

// Observe DOM to inject Bulk Send entry when sidebar mounts
function startBulkSendButtonObserver() {
  const observer = new MutationObserver(() => {
    ensureBulkSendEntry();
  });
  observer.observe(document.documentElement || document.body, { childList: true, subtree: true });
  // Also try immediately
  ensureBulkSendEntry();
}

// Show tab content in Gmail main view - SIMPLIFIED 3-TAB STRUCTURE
async function showTabContent(tabName) {
  // Remove existing content panel
  let existingPanel = document.querySelector('.aem-main-content-panel');
  if (existingPanel) {
    existingPanel.remove();
  }
  
  // Get data based on tab
  let html = '';
  
  if (tabName === 'send') {
    // Tab 1: Send & Schedule
    html = await getSendAndScheduleContent();
  } else if (tabName === 'track') {
    // Tab 2: Track & Engage
    html = await getTrackAndEngageContent();
  } else if (tabName === 'settings') {
    // Tab 3: Settings & Tools
    html = await getSettingsAndToolsContent();
  }
  
  // Create and show panel in main Gmail area
  const panel = document.createElement('div');
  panel.className = 'aem-main-content-panel aem-theme-luxe';
  panel.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(15,17,19,0.88);
    z-index: 999999;
    padding: 24px 48px;
    overflow-y: auto;
    font-family: 'Google Sans', Roboto, Arial, sans-serif;
  `;
  
  panel.innerHTML = `
    <div style="max-width: 1200px; margin: 0 auto;">
      <div class="aem-section" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; padding: 16px; border-radius: 12px;">
        <h1 style="margin: 0; font-size: 24px; font-weight: 600;">TaskForce Email Manager</h1>
        <button id="aem-close-panel" class="aem-btn-sm">Close</button>
      </div>
      ${html}
    </div>
  `;
  
  document.body.appendChild(panel);
  
  // Close button handler
  panel.querySelector('#aem-close-panel')?.addEventListener('click', () => {
    panel.remove();
  });
  
  // Add click handlers for action buttons in tabs
  setTimeout(() => {
    // Templates button
    const openTemplatesBtn = panel.querySelector('#open-templates');
    if (openTemplatesBtn) {
      openTemplatesBtn.addEventListener('click', () => {
        const composeContainer = document.querySelector('[role="dialog"]');
        if (composeContainer) {
          panel.remove();
          showTemplatesModal(composeContainer);
        } else {
          showComposeRequiredNotification('Templates require a compose window to insert text. Please click Compose first.');
        }
      });
    }
    
    // Recipients button
    const openRecipientsBtn = panel.querySelector('#open-recipients');
    if (openRecipientsBtn) {
      openRecipientsBtn.addEventListener('click', () => {
        const composeContainer = document.querySelector('[role="dialog"]');
        if (composeContainer) {
          panel.remove();
          // Show menu to pick between recipient picker and CSV import
          if (confirm('Choose:\n\nOK = Pick from past emails\nCancel = Import CSV')) {
            showRecipientPicker(composeContainer);
          } else {
            showCSVImportModal(composeContainer);
          }
        } else {
          showComposeRequiredNotification('Recipients can only be added to emails. Please click Compose first.');
        }
      });
    }
    
    // Calendar button
    const openCalendarBtn = panel.querySelector('#open-calendar');
    if (openCalendarBtn) {
      openCalendarBtn.addEventListener('click', () => {
        const composeContainer = document.querySelector('[role="dialog"]');
        if (composeContainer) {
          panel.remove();
          showCalendarView(composeContainer);
        } else {
          showComposeRequiredNotification('Calendar scheduling requires an email to schedule. Please click Compose first.');
        }
      });
    }
    
    // Bulk Operations button
    const openBulkOpsBtn = panel.querySelector('#open-bulk-ops');
    if (openBulkOpsBtn) {
      openBulkOpsBtn.addEventListener('click', () => {
        const composeContainer = document.querySelector('[role="dialog"]');
        if (composeContainer) {
          panel.remove();
          showBulkOperations(composeContainer);
        } else {
          showComposeRequiredNotification('Bulk operations require emails to manage. Please click Compose first.');
        }
      });
    }
    
    // Analytics buttons in Track & Engage tab
    const openAnalyticsBtn = panel.querySelector('#open-analytics');
    if (openAnalyticsBtn) {
      openAnalyticsBtn.addEventListener('click', () => {
        const composeContainer = document.querySelector('[role="dialog"]');
        if (composeContainer) {
          panel.remove();
          showAnalyticsModal();
        } else {
          // Can still view analytics without compose
          panel.remove();
          showAnalyticsModal();
        }
      });
    }
    
    const viewTrackingStatsBtn = panel.querySelector('#view-tracking-stats');
    if (viewTrackingStatsBtn) {
      viewTrackingStatsBtn.addEventListener('click', () => {
        const composeContainer = document.querySelector('[role="dialog"]');
        if (composeContainer) {
          panel.remove();
          showAnalyticsModal();
        } else {
          panel.remove();
          showAnalyticsModal();
        }
      });
    }
    
    // Tracking toggle in Settings tab
    const toggleTracking = panel.querySelector('#toggle-tracking');
    if (toggleTracking) {
      chrome.storage.local.get('enableTracking', (result) => {
        const isEnabled = result.enableTracking || false;
        if (isEnabled) {
          toggleTracking.checked = true;
          const sliderSpan = toggleTracking.nextElementSibling;
          const circleSpan = sliderSpan.nextElementSibling;
          sliderSpan.style.backgroundColor = '#1a73e8';
          circleSpan.style.transform = 'translateX(20px)';
        }
      });
      
      toggleTracking.addEventListener('change', () => {
        const isEnabled = toggleTracking.checked;
        chrome.storage.local.set({ enableTracking: isEnabled }, () => {
          const sliderSpan = toggleTracking.nextElementSibling;
          const circleSpan = sliderSpan.nextElementSibling;
          
          if (isEnabled) {
            sliderSpan.style.backgroundColor = '#1a73e8';
            circleSpan.style.transform = 'translateX(20px)';
          } else {
            sliderSpan.style.backgroundColor = '#dadce0';
            circleSpan.style.transform = 'translateX(0px)';
          }
          
          chrome.runtime.sendMessage({ 
            action: 'showNotification', 
            title: isEnabled ? 'Email Tracking Enabled' : 'Email Tracking Disabled', 
            message: isEnabled ? 'Opens and clicks will be tracked' : 'Tracking is now disabled' 
          });
        });
      });
    }
  }, 100);
}

// Get progress content
async function getProgressContent() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['scheduledEmails', 'emailStats', 'lastBulkSend', 'activeBulkCampaigns'], (result) => {
      const scheduled = result.scheduledEmails || [];
      const stats = result.emailStats || { sentToday: 0 };
      const lastBulk = result.lastBulkSend || null;
      const activeCampaigns = result.activeBulkCampaigns || [];
      
      let html = `
        <div style="background: #f8f9fa; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
          <h2 style="margin-top: 0; font-size: 20px; color: #202124; margin-bottom: 16px;">📊 Quick Stats</h2>
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;">
            <div style="background: white; padding: 16px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="font-size: 14px; color: #5f6368; margin-bottom: 8px;">Sent Today</div>
              <div style="font-size: 32px; font-weight: 500; color: #1a73e8;">${stats.sentToday}</div>
            </div>
            <div style="background: white; padding: 16px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="font-size: 14px; color: #5f6368; margin-bottom: 8px;">Pending Scheduled</div>
              <div style="font-size: 32px; font-weight: 500; color: #ea8600;">${scheduled.length}</div>
            </div>
            <div style="background: white; padding: 16px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="font-size: 14px; color: #5f6368; margin-bottom: 8px;">Active Campaigns</div>
              <div style="font-size: 32px; font-weight: 500; color: #34a853;">${activeCampaigns.length}</div>
            </div>
          </div>
        </div>
      `;
      
      // Last bulk send
      if (lastBulk) {
        const timestamp = new Date(lastBulk.timestamp).toLocaleString();
        const successRate = lastBulk.total > 0 ? ((lastBulk.sent / lastBulk.total) * 100).toFixed(1) : 0;
        
        html += `
          <div style="background: #e8f0fe; border-left: 4px solid #1a73e8; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <h2 style="margin: 0; font-size: 20px; color: #1a73e8;">Last Campaign</h2>
              <span style="font-size: 14px; color: #666;">${timestamp}</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px;">
              <div>
                <div style="font-size: 13px; color: #5f6368; margin-bottom: 4px;">Total</div>
                <div style="font-size: 24px; font-weight: 500;">${lastBulk.total}</div>
              </div>
              <div>
                <div style="font-size: 13px; color: #5f6368; margin-bottom: 4px;">Sent</div>
                <div style="font-size: 24px; font-weight: 500; color: #34a853;">${lastBulk.sent}</div>
              </div>
              <div>
                <div style="font-size: 13px; color: #5f6368; margin-bottom: 4px;">Failed</div>
                <div style="font-size: 24px; font-weight: 500; color: #ea4335;">${lastBulk.failed}</div>
              </div>
            </div>
            <div>
              <div style="background: #dadce0; height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 8px;">
                <div style="background: #34a853; height: 100%; width: ${successRate}%; transition: width 0.3s;"></div>
              </div>
              <div style="font-size: 13px; color: #666; text-align: right;">${successRate}% success rate</div>
            </div>
          </div>
        `;
      }
      
      // Active campaigns
      if (activeCampaigns.length > 0) {
        html += `
          <div style="background: white; padding: 24px; border-radius: 8px;">
            <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #202124;">Active Campaigns</h2>
        `;
        
        activeCampaigns.forEach((campaign, index) => {
          const progress = campaign.total > 0 ? ((campaign.sent / campaign.total) * 100).toFixed(0) : 0;
          const startTime = campaign.startTime ? new Date(campaign.startTime).toLocaleString() : 'Immediate';
          
          html += `
            <div style="border: 1px solid #dadce0; padding: 16px; margin-bottom: 12px; border-radius: 8px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span style="font-weight: 500; font-size: 16px;">Campaign #${index + 1}</span>
                <span style="font-size: 13px; color: #666;">Started: ${startTime}</span>
              </div>
              <div style="margin-bottom: 12px;">
                <span style="font-size: 14px; color: #5f6368;">Progress: </span>
                <span style="font-size: 18px; font-weight: 500;">${campaign.sent}/${campaign.total}</span>
              </div>
              <div>
                <div style="background: #e8eaed; height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 8px;">
                  <div style="background: #1a73e8; height: 100%; width: ${progress}%; transition: width 0.3s;"></div>
                </div>
                <div style="font-size: 13px; color: #666; text-align: right;">${progress}%</div>
              </div>
            </div>
          `;
        });
        
        html += `</div>`;
      }
      
      resolve(html);
    });
  });
}

// Get replies content
async function getRepliesContent() {
  return new Promise((resolve) => {
    chrome.storage.local.get('emailReplies', (result) => {
      const replies = result.emailReplies || [];
      
      if (replies.length === 0) {
        resolve(`
          <div style="text-align: center; padding: 60px 20px; color: #666;">
            <div style="font-size: 48px; margin-bottom: 16px;">💬</div>
            <h2 style="margin: 0 0 8px 0; font-size: 20px; color: #202124;">No tracked emails yet</h2>
            <p>Send some emails to start tracking replies!</p>
          </div>
        `);
        return;
      }
      
      const withReply = replies.filter(r => r.hasReplied);
      const withoutReply = replies.filter(r => !r.hasReplied);
      
      let html = `
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
          <div style="display: flex; gap: 32px; font-size: 16px;">
            <div>
              <span style="color: #34a853; font-weight: 600; font-size: 24px;">✓ ${withReply.length}</span>
              <span style="color: #5f6368; margin-left: 8px;">Replied</span>
            </div>
            <div>
              <span style="color: #ea4335; font-weight: 600; font-size: 24px;">⚠ ${withoutReply.length}</span>
              <span style="color: #5f6368; margin-left: 8px;">No Reply</span>
            </div>
          </div>
        </div>
      `;
      
      // Show recent replies
      html += `<div style="margin-bottom: 24px;"><h2 style="margin: 0 0 12px 0; font-size: 18px; color: #202124;">Recent Activity</h2></div>`;
      
      replies.slice(0, 20).forEach(email => {
        const isReplied = email.hasReplied;
        html += `
          <div style="border: 1px solid ${isReplied ? '#34a853' : '#ea4335'}; border-left: 4px solid ${isReplied ? '#34a853' : '#ea4335'}; padding: 16px; margin-bottom: 12px; border-radius: 8px; background: white;">
            <div style="display: flex; justify-content: space-between; align-items: start;">
              <div style="flex: 1;">
                <div style="font-weight: 500; font-size: 16px; margin-bottom: 4px;">${email.to}</div>
                <div style="font-size: 14px; color: #666; margin-bottom: 8px;">${email.subject || 'No subject'}</div>
                <div style="font-size: 12px; color: #888;">Sent: ${new Date(email.sentAt).toLocaleString()}</div>
              </div>
              <div style="color: ${isReplied ? '#34a853' : '#ea4335'}; font-weight: 600; font-size: 14px;">
                ${isReplied ? '✓ Replied' : '⚠ No Reply'}
              </div>
            </div>
          </div>
        `;
      });
      
      resolve(html);
    });
  });
}

// Get follow-ups content
async function getFollowUpsContent() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['followUpRules', 'emailReplies', 'emailStats'], (result) => {
      const rules = result.followUpRules || [];
      const replies = result.emailReplies || [];
      const stats = result.emailStats || { sentToday: 0, followUpsSent: 0 };
      
      // Calculate follow-up stats
      const totalFollowUps = rules.length;
      const enabledFollowUps = rules.filter(r => r.enabled).length;
      const followUpsSent = stats.followUpsSent || 0;
      const followUpResponses = replies.filter(r => r.hasReplied && r.isFollowUp).length;
      
      let html = `
        <div style="background: #f8f9fa; padding: 24px; border-radius: 8px; margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h2 style="margin: 0; font-size: 20px; color: #202124;">Follow-up Automation</h2>
            <button id="aem-add-followup" style="background: #1a73e8; color: white; border: none; padding: 10px 24px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">+ Create New Follow-up</button>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
            <div style="background: white; padding: 12px; border-radius: 6px; text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
              <div style="font-size: 24px; font-weight: 600; color: #1a73e8;">${totalFollowUps}</div>
              <div style="font-size: 12px; color: #5f6368; margin-top: 4px;">Total Rules</div>
            </div>
            <div style="background: white; padding: 12px; border-radius: 6px; text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
              <div style="font-size: 24px; font-weight: 600; color: #34a853;">${enabledFollowUps}</div>
              <div style="font-size: 12px; color: #5f6368; margin-top: 4px;">Active</div>
            </div>
            <div style="background: white; padding: 12px; border-radius: 6px; text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
              <div style="font-size: 24px; font-weight: 600; color: #ea8600;">${followUpsSent}</div>
              <div style="font-size: 12px; color: #5f6368; margin-top: 4px;">Follow-ups Sent</div>
            </div>
            <div style="background: white; padding: 12px; border-radius: 6px; text-align: center; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
              <div style="font-size: 24px; font-weight: 600; color: ${followUpResponses > 0 ? '#34a853' : '#ea4335'};">${followUpResponses}</div>
              <div style="font-size: 12px; color: #5f6368; margin-top: 4px;">Got Replies</div>
            </div>
          </div>
        </div>
      `;
      
      // Add email list viewer section
      html += `
        <div style="background: white; border: 1px solid #dadce0; border-radius: 8px; padding: 24px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 18px; color: #202124;">📋 Your Sent Emails</h3>
            <button id="aem-show-all-emails" style="background: #1a73e8; color: white; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 500;">View All Emails</button>
          </div>
          
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px;">
            <div style="background: #f8f9fa; padding: 10px; border-radius: 6px; text-align: center;">
              <div style="font-size: 20px; font-weight: 600; color: #202124;">${replies.length}</div>
              <div style="font-size: 11px; color: #5f6368; margin-top: 4px;">Total Sent</div>
            </div>
            <div style="background: #e8f5e9; padding: 10px; border-radius: 6px; text-align: center;">
              <div style="font-size: 20px; font-weight: 600; color: #34a853;">${replies.filter(r => r.hasReplied).length}</div>
              <div style="font-size: 11px; color: #5f6368; margin-top: 4px;">Got Replies</div>
            </div>
            <div style="background: #fef7e0; padding: 10px; border-radius: 6px; text-align: center;">
              <div style="font-size: 20px; font-weight: 600; color: #ea8600;">${replies.filter(r => !r.hasReplied).length}</div>
              <div style="font-size: 11px; color: #5f6368; margin-top: 4px;">No Reply</div>
            </div>
            <div style="background: #e8f0fe; padding: 10px; border-radius: 6px; text-align: center;">
              <div style="font-size: 20px; font-weight: 600; color: #1a73e8;">${followUpsSent}</div>
              <div style="font-size: 11px; color: #5f6368; margin-top: 4px;">Follow-ups Sent</div>
            </div>
          </div>
          
          <!-- Advanced Filters -->
          <div style="background: #f8f9fa; padding: 16px; border-radius: 6px;">
            <div style="font-size: 13px; font-weight: 500; color: #202124; margin-bottom: 12px;">🔍 Filter Emails</div>
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px;">
              <div>
                <label style="display: block; font-size: 12px; color: #5f6368; margin-bottom: 6px;">Reply Status</label>
                <select id="filter-reply-status" style="width: 100%; padding: 8px; border: 1px solid #dadce0; border-radius: 4px; font-size: 13px; background: white;">
                  <option value="all">All emails</option>
                  <option value="replied">Got replies</option>
                  <option value="no-reply">No reply yet</option>
                </select>
              </div>
              <div>
                <label style="display: block; font-size: 12px; color: #5f6368; margin-bottom: 6px;">Email Type</label>
                <select id="filter-email-type" style="width: 100%; padding: 8px; border: 1px solid #dadce0; border-radius: 4px; font-size: 13px; background: white;">
                  <option value="all">All types</option>
                  <option value="bulk">Bulk sends</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
            </div>
            <div style="margin-top: 12px;">
              <label style="display: block; font-size: 12px; color: #5f6368; margin-bottom: 6px;">Search by content</label>
              <input type="text" id="filter-content" placeholder="Search in subject or body..." style="width: 100%; padding: 8px; border: 1px solid #dadce0; border-radius: 4px; font-size: 13px;">
            </div>
            <button id="apply-filters" style="margin-top: 12px; background: #1a73e8; color: white; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 500;">Apply Filters</button>
          </div>
        </div>
      `;
      
      // Show recent emails preview
      const recentEmails = replies.slice(0, 5);
      if (recentEmails.length > 0) {
        html += `
          <div style="background: white; border: 1px solid #dadce0; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
            <h3 style="margin: 0 0 16px 0; font-size: 16px; color: #202124;">Recent Sent Emails</h3>
        `;
        
        recentEmails.forEach((email, index) => {
          const isReplied = email.hasReplied;
          html += `
            <div style="border: 1px solid ${isReplied ? '#34a853' : '#ea4335'}; border-left: 3px solid ${isReplied ? '#34a853' : '#ea4335'}; padding: 12px; margin-bottom: 8px; border-radius: 4px; background: white; ${isReplied ? 'opacity: 0.7;' : ''}">
              <div style="display: flex; justify-content: space-between; align-items: start;">
                <div style="flex: 1;">
                  <div style="font-weight: 500; font-size: 14px; margin-bottom: 4px;">${email.to}</div>
                  <div style="font-size: 13px; color: #666; margin-bottom: 4px;">${email.subject || 'No subject'}</div>
                  <div style="font-size: 11px; color: #888;">${new Date(email.sentAt).toLocaleString()}</div>
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <span style="color: ${isReplied ? '#34a853' : '#ea4335'}; font-weight: 600; font-size: 12px;">${isReplied ? '✓ Replied' : '⚠ No Reply'}</span>
                  ${!isReplied ? `<button data-email-index="${index}" class="aem-send-manual-followup" style="background: #1a73e8; color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">Send Follow-up</button>` : ''}
                </div>
              </div>
            </div>
          `;
        });
        
        html += `</div>`;
      }
      
      if (rules.length === 0) {
        html += `
          <div style="text-align: center; padding: 60px 20px; color: #666; border: 2px dashed #dadce0; border-radius: 8px; background: #fafbfc;">
            <div style="font-size: 64px; margin-bottom: 16px;">🔄</div>
            <h2 style="margin: 0 0 8px 0; font-size: 22px; color: #202124;">No follow-up rules yet</h2>
            <p style="margin: 0 0 24px 0; font-size: 14px;">Automatically send follow-ups to recipients who haven't replied.<br>Set up multiple follow-ups for maximum effectiveness!</p>
            <button id="aem-quick-start" style="background: #1a73e8; color: white; border: none; padding: 12px 32px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500;">Get Started</button>
          </div>
        `;
      } else {
        rules.forEach((rule, index) => {
          const triggers = rule.triggerOptions || {};
          const timing = rule.timing || { days: rule.daysAfter || 3 };
          
          html += `
            <div style="border: 2px solid ${rule.enabled ? '#1a73e8' : '#dadce0'}; padding: 20px; margin-bottom: 16px; border-radius: 8px; background: white; ${rule.enabled ? 'box-shadow: 0 2px 4px rgba(26,115,232,0.1);' : ''}">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                <div>
                  <strong style="color: #1a73e8; font-size: 18px;">Follow-up Sequence #${rule.sequenceNumber || index + 1}</strong>
                  <span style="margin-left: 12px; padding: 4px 12px; background: ${rule.enabled ? '#e8f0fe' : '#f1f3f4'}; color: ${rule.enabled ? '#1a73e8' : '#5f6368'}; border-radius: 12px; font-size: 12px; font-weight: 500;">${rule.enabled ? '✓ Active' : '⏸ Paused'}</span>
                  ${rule.emailSelection ? `<span style="margin-left: 8px; padding: 4px 12px; background: #e8f5e9; color: #137333; border-radius: 12px; font-size: 12px; font-weight: 500;">${rule.emailSelection}</span>` : ''}
                  ${rule.autoStopOnReply ? `<span style="margin-left: 8px; padding: 4px 12px; background: #fff3e0; color: #e65100; border-radius: 12px; font-size: 12px; font-weight: 500;">🛑 Auto-stop</span>` : ''}
                </div>
                <div style="display: flex; gap: 8px;">
                  <button data-rule-index="${index}" class="aem-toggle-rule" style="background: ${rule.enabled ? '#fef7e0' : '#e8f0fe'}; color: ${rule.enabled ? '#ea8600' : '#1a73e8'}; border: none; padding: 6px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 500;">${rule.enabled ? '⏸ Pause' : '▶ Resume'}</button>
                  <button data-rule-index="${index}" class="aem-edit-rule" style="background: #1a73e8; color: white; border: none; padding: 6px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 500;">✏️ Edit</button>
                  <button data-rule-index="${index}" class="aem-delete-rule" style="background: #ea4335; color: white; border: none; padding: 6px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 500;">🗑 Delete</button>
                </div>
              </div>
              
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 16px;">
                <div style="background: #f8f9fa; padding: 12px; border-radius: 6px;">
                  <div style="font-size: 12px; color: #5f6368; margin-bottom: 4px;">⏰ Timing</div>
                  <div style="font-size: 14px; font-weight: 500; color: #202124;">
                    ${timing.days ? `After ${timing.days} days` : ''}
                    ${timing.hours ? `${timing.hours} hours` : ''}
                    ${triggers.onlyIfNoReply ? ' (if no reply)' : ''}
                  </div>
                </div>
                
                <div style="background: #f8f9fa; padding: 12px; border-radius: 6px;">
                  <div style="font-size: 12px; color: #5f6368; margin-bottom: 4px;">📧 Subject</div>
                  <div style="font-size: 14px; font-weight: 500; color: #202124;">${rule.subject || 'Re: ${original_subject}'}</div>
                </div>
              </div>
              
              <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin-bottom: 12px;">
                <div style="font-size: 12px; color: #5f6368; margin-bottom: 6px;">💬 Message Preview</div>
                <div style="font-size: 13px; color: #5f6368; line-height: 1.5; max-height: 60px; overflow: hidden; text-overflow: ellipsis;">
                  ${rule.message ? rule.message.substring(0, 120) + '...' : 'No message set'}
                </div>
              </div>
              
              ${rule.stats ? `
                <div style="display: flex; gap: 16px; padding-top: 12px; border-top: 1px solid #dadce0; font-size: 12px; color: #5f6368;">
                  <div>Sent: <strong style="color: #202124;">${rule.stats.sent || 0}</strong></div>
                  <div>Replies: <strong style="color: #34a853;">${rule.stats.replied || 0}</strong></div>
                  ${rule.stats.sent > 0 ? `<div>Success Rate: <strong style="color: #1a73e8;">${((rule.stats.replied / rule.stats.sent) * 100).toFixed(1)}%</strong></div>` : ''}
                </div>
              ` : ''}
            </div>
          `;
        });
      }
      
      resolve(html);
      
      // Add event listeners after panel is shown
      setTimeout(() => {
        const addBtn = document.getElementById('aem-add-followup');
        const quickStartBtn = document.getElementById('aem-quick-start');
        
        if (addBtn) {
          addBtn.addEventListener('click', () => {
            showAdvancedFollowUpModal();
          });
        }
        
        if (quickStartBtn) {
          quickStartBtn.addEventListener('click', () => {
            showAdvancedFollowUpModal();
          });
        }
        
        document.querySelectorAll('.aem-delete-rule').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.ruleIndex);
            deleteFollowUpRule(index);
          });
        });
        
        document.querySelectorAll('.aem-toggle-rule').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.ruleIndex);
            toggleFollowUpRule(index);
          });
        });
        
        document.querySelectorAll('.aem-edit-rule').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.ruleIndex);
            editFollowUpRule(index);
          });
        });
        
        // View all emails button
        const showAllBtn = document.getElementById('aem-show-all-emails');
        if (showAllBtn) {
          showAllBtn.addEventListener('click', () => {
            showAllEmailsModal();
          });
        }
        
        // Apply filters button
        const applyFiltersBtn = document.getElementById('apply-filters');
        if (applyFiltersBtn) {
          applyFiltersBtn.addEventListener('click', () => {
            applyEmailFilters();
          });
        }
        
        // Manual follow-up buttons
        document.querySelectorAll('.aem-send-manual-followup').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.emailIndex);
            sendManualFollowUp(replies[index]);
          });
        });
      }, 100);
    });
  });
}

// NEW CONSOLIDATED FUNCTIONS FOR 3-TAB STRUCTURE

// Tab 1: Send & Schedule Content
async function getSendAndScheduleContent() {
  const composeContainer = document.querySelector('[role="dialog"]');
  
  return `
    <div style="max-width: 900px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 32px; border-radius: 12px; margin-bottom: 32px; color: white;">
        <h2 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700;">📧 Send & Schedule</h2>
        <p style="margin: 0; font-size: 16px; opacity: 0.9;">Manage templates, recipients, and scheduled sends</p>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 32px;">
        <!-- Templates Section -->
        <div style="background: white; border: 2px solid #e8eaed; padding: 24px; border-radius: 12px; cursor: pointer; transition: all 0.3s;" id="open-templates">
          <div style="display: flex; align-items: center; margin-bottom: 16px;">
            <span style="font-size: 40px; margin-right: 16px;">📝</span>
            <h3 style="margin: 0; font-size: 20px; color: #202124;">Templates</h3>
          </div>
          <p style="margin: 0 0 16px 0; color: #5f6368; font-size: 14px;">Save and reuse email templates</p>
          <button style="background: #1a73e8; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; width: 100%;">Manage Templates</button>
        </div>
        
        <!-- Recipients Section -->
        <div style="background: white; border: 2px solid #e8eaed; padding: 24px; border-radius: 12px; cursor: pointer; transition: all 0.3s;" id="open-recipients">
          <div style="display: flex; align-items: center; margin-bottom: 16px;">
            <span style="font-size: 40px; margin-right: 16px;">👥</span>
            <h3 style="margin: 0; font-size: 20px; color: #202124;">Recipients</h3>
          </div>
          <p style="margin: 0 0 16px 0; color: #5f6368; font-size: 14px;">Pick recipients or import CSV</p>
          <button style="background: #34a853; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; width: 100%;">${composeContainer ? 'Manage Recipients' : 'Open Compose First'}</button>
        </div>
      </div>
      
      <div style="background: #f8f9fa; padding: 24px; border-radius: 12px; border-left: 4px solid #1a73e8;">
        <h3 style="margin: 0 0 12px 0; font-size: 18px; color: #202124;">💡 Quick Tips</h3>
        <ul style="margin: 0; padding-left: 24px; color: #5f6368; font-size: 14px; line-height: 1.8;">
          <li>Use <strong>Schedule</strong> button in compose window for one-time scheduling</li>
          <li>Use <strong>Bulk Send</strong> button for Google Sheets integration</li>
          <li>Save common messages as <strong>Templates</strong> for quick reuse</li>
          <li>Import recipient lists via <strong>CSV</strong> or pick from past emails</li>
        </ul>
      </div>
    </div>
  `;
}

// Tab 2: Track & Engage Content
async function getTrackAndEngageContent() {
  const progressContent = await getProgressContent();
  const repliesContent = await getRepliesContent();
  
  return `
    <div style="max-width: 1200px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); padding: 32px; border-radius: 12px; margin-bottom: 32px; color: white;">
        <h2 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700;">📊 Track & Engage</h2>
        <p style="margin: 0; font-size: 16px; opacity: 0.9;">Monitor campaign progress, replies, and engagement</p>
      </div>
      
      <!-- Campaign Progress Section -->
      <div style="margin-bottom: 32px;">
        <h3 style="margin: 0 0 20px 0; font-size: 22px; color: #202124; border-bottom: 2px solid #e8eaed; padding-bottom: 12px;">📊 Campaign Progress</h3>
        ${progressContent}
      </div>
      
      <!-- Quick Actions Bar -->
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
        <button id="open-analytics" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; padding: 16px; border-radius: 12px; cursor: pointer; font-size: 16px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 12px; box-shadow: 0 4px 12px rgba(102,126,234,0.4);">
          <span style="font-size: 24px;">📊</span>
          <span>View Analytics Dashboard</span>
        </button>
        <button id="view-tracking-stats" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; border: none; padding: 16px; border-radius: 12px; cursor: pointer; font-size: 16px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 12px; box-shadow: 0 4px 12px rgba(245,87,108,0.4);">
          <span style="font-size: 24px;">📈</span>
          <span>Email Tracking Stats</span>
        </button>
      </div>
      
      <!-- Analytics & Replies Section -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px;">
        <div>
          <h3 style="margin: 0 0 20px 0; font-size: 22px; color: #202124; border-bottom: 2px solid #e8eaed; padding-bottom: 12px;">💬 Email Replies</h3>
          ${repliesContent}
        </div>
        
        <div>
          <h3 style="margin: 0 0 20px 0; font-size: 22px; color: #202124; border-bottom: 2px solid #e8eaed; padding-bottom: 12px;">🔄 Follow-up Automation</h3>
          ${await getFollowUpsContent()}
        </div>
      </div>
    </div>
  `;
}

// Tab 3: Settings & Tools Content
async function getSettingsAndToolsContent() {
  const composeContainer = document.querySelector('[role="dialog"]');
  
  return `
    <div style="max-width: 900px; margin: 0 auto;">
      <div style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); padding: 32px; border-radius: 12px; margin-bottom: 32px; color: white;">
        <h2 style="margin: 0 0 8px 0; font-size: 28px; font-weight: 700;">⚙️ Settings & Tools</h2>
        <p style="margin: 0; font-size: 16px; opacity: 0.9;">Configuration, calendar integration, and advanced features</p>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 32px;">
        <!-- Calendar Section -->
        <div style="background: white; border: 2px solid #e8eaed; padding: 24px; border-radius: 12px; cursor: pointer; transition: all 0.3s;" id="open-calendar">
          <div style="display: flex; align-items: center; margin-bottom: 16px;">
            <span style="font-size: 40px; margin-right: 16px;">📅</span>
            <h3 style="margin: 0; font-size: 20px; color: #202124;">Calendar</h3>
          </div>
          <p style="margin: 0 0 16px 0; color: #5f6368; font-size: 14px;">Schedule emails and view calendar events</p>
          <button style="background: #ea8600; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; width: 100%;">${composeContainer ? 'Open Calendar' : 'Open Compose First'}</button>
        </div>
        
        <!-- Bulk Operations Section -->
        <div style="background: white; border: 2px solid #e8eaed; padding: 24px; border-radius: 12px; cursor: pointer; transition: all 0.3s;" id="open-bulk-ops">
          <div style="display: flex; align-items: center; margin-bottom: 16px;">
            <span style="font-size: 40px; margin-right: 16px;">⚡</span>
            <h3 style="margin: 0; font-size: 20px; color: #202124;">Bulk Operations</h3>
          </div>
          <p style="margin: 0 0 16px 0; color: #5f6368; font-size: 14px;">Advanced bulk email management</p>
          <button style="background: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; width: 100%;">${composeContainer ? 'Bulk Actions' : 'Open Compose First'}</button>
        </div>
      </div>
      
      <!-- Settings Panel -->
      <div style="background: white; border: 2px solid #e8eaed; padding: 24px; border-radius: 12px;">
        <h3 style="margin: 0 0 20px 0; font-size: 20px; color: #202124;">⚙️ Preferences</h3>
        <div style="display: grid; gap: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #f8f9fa; border-radius: 8px;">
            <div>
              <div style="font-weight: 500; font-size: 14px; color: #202124; margin-bottom: 4px;">Email Tracking</div>
              <div style="font-size: 13px; color: #5f6368;">Track opens and clicks</div>
            </div>
            <label style="position: relative; display: inline-block; width: 44px; height: 24px;">
              <input type="checkbox" id="toggle-tracking" style="opacity: 0; width: 0; height: 0;">
              <span style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #dadce0; transition: .4s; border-radius: 24px;"></span>
              <span style="position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: .4s; border-radius: 50%;"></span>
            </label>
          </div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 16px; background: #f8f9fa; border-radius: 8px;">
            <div>
              <div style="font-weight: 500; font-size: 14px; color: #202124; margin-bottom: 4px;">Daily Send Limit</div>
              <div style="font-size: 13px; color: #5f6368;">Maximum emails per day</div>
            </div>
            <select style="padding: 8px 12px; border: 1px solid #dadce0; border-radius: 6px; font-size: 14px; background: white;">
              <option>50</option>
              <option>100</option>
              <option>200</option>
              <option>Unlimited</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Show all emails modal
function showAllEmailsModal() {
  chrome.storage.local.get('emailReplies', (result) => {
    const replies = result.emailReplies || [];
    
    const modal = document.createElement('div');
    modal.id = 'aem-all-emails-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 1000000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `;
    
    let emailListHtml = '';
    replies.forEach((email, index) => {
      const isReplied = email.hasReplied;
      emailListHtml += `
        <div style="border: 1px solid ${isReplied ? '#34a853' : '#ea4335'}; border-left: 3px solid ${isReplied ? '#34a853' : '#ea4335'}; padding: 14px; margin-bottom: 10px; border-radius: 4px; background: white;">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div style="flex: 1;">
              <div style="font-weight: 600; font-size: 15px; margin-bottom: 6px;">${email.to}</div>
              <div style="font-size: 13px; color: #666; margin-bottom: 4px;">${email.subject || 'No subject'}</div>
              <div style="font-size: 11px; color: #888;">${new Date(email.sentAt).toLocaleString()}</div>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <span style="color: ${isReplied ? '#34a853' : '#ea4335'}; font-weight: 600; font-size: 12px;">${isReplied ? '✓ Replied' : '⚠ No Reply'}</span>
              ${!isReplied ? `<button data-email-id="${email.id || index}" class="aem-send-followup-all" style="background: #1a73e8; color: white; border: none; padding: 6px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">Send Follow-up</button>` : ''}
            </div>
          </div>
        </div>
      `;
    });
    
    modal.innerHTML = `
      <div style="background: white; border-radius: 8px; max-width: 900px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">
        <div style="padding: 24px; border-bottom: 1px solid #dadce0; position: sticky; top: 0; background: white; z-index: 10;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h2 style="margin: 0; font-size: 24px; color: #202124; font-weight: 400;">Your Sent Emails</h2>
              <p style="margin: 8px 0 0 0; color: #5f6368; font-size: 14px;">${replies.length} total emails</p>
            </div>
            <button id="close-all-emails" style="background: #dadce0; color: #202124; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-size: 14px;">Close</button>
          </div>
        </div>
        
        <div style="padding: 24px;">
          ${emailListHtml || '<div style="text-align: center; padding: 40px; color: #666;">No emails found</div>'}
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close button
    modal.querySelector('#close-all-emails').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    
    // Send follow-up buttons
    modal.querySelectorAll('.aem-send-followup-all').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const emailId = e.target.dataset.emailId;
        const email = replies[parseInt(emailId)] || replies.find(e => e.id === emailId);
        if (email) {
          sendManualFollowUp(email);
          modal.remove();
        }
      });
    });
  });
}

// Apply email filters
function applyEmailFilters() {
  chrome.storage.local.get('emailReplies', (result) => {
    const replies = result.emailReplies || [];
    const replyStatus = document.getElementById('filter-reply-status').value;
    const emailType = document.getElementById('filter-email-type').value;
    const contentSearch = document.getElementById('filter-content').value.toLowerCase();
    
    let filtered = replies;
    
    // Filter by reply status
    if (replyStatus === 'replied') {
      filtered = filtered.filter(e => e.hasReplied);
    } else if (replyStatus === 'no-reply') {
      filtered = filtered.filter(e => !e.hasReplied);
    }
    
    // Filter by email type (if emails have type property)
    if (emailType !== 'all') {
      filtered = filtered.filter(e => e.type === emailType);
    }
    
    // Filter by content
    if (contentSearch) {
      filtered = filtered.filter(e => 
        (e.subject && e.subject.toLowerCase().includes(contentSearch)) ||
        (e.body && e.body.toLowerCase().includes(contentSearch))
      );
    }
    
    // Show results
    showFilteredEmails(filtered);
  });
}

// Show filtered emails
function showFilteredEmails(emails) {
  const modal = document.createElement('div');
  modal.id = 'aem-filtered-emails';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 1000000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;
  
  let emailListHtml = '';
  emails.forEach((email, index) => {
    const isReplied = email.hasReplied;
    emailListHtml += `
      <div style="border: 1px solid ${isReplied ? '#34a853' : '#ea4335'}; border-left: 3px solid ${isReplied ? '#34a853' : '#ea4335'}; padding: 14px; margin-bottom: 10px; border-radius: 4px; background: white;">
        <div style="display: flex; justify-content: space-between; align-items: start;">
          <div style="flex: 1;">
            <div style="font-weight: 600; font-size: 15px; margin-bottom: 6px;">${email.to}</div>
            <div style="font-size: 13px; color: #666; margin-bottom: 4px;">${email.subject || 'No subject'}</div>
            <div style="font-size: 11px; color: #888;">${new Date(email.sentAt).toLocaleString()}</div>
          </div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <span style="color: ${isReplied ? '#34a853' : '#ea4335'}; font-weight: 600; font-size: 12px;">${isReplied ? '✓ Replied' : '⚠ No Reply'}</span>
            ${!isReplied ? `<button data-email-index="${index}" class="aem-send-followup-filtered" style="background: #1a73e8; color: white; border: none; padding: 6px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">Send Follow-up</button>` : ''}
          </div>
        </div>
      </div>
    `;
  });
  
  modal.innerHTML = `
    <div style="background: white; border-radius: 8px; max-width: 900px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">
      <div style="padding: 24px; border-bottom: 1px solid #dadce0; position: sticky; top: 0; background: white; z-index: 10;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h2 style="margin: 0; font-size: 24px; color: #202124; font-weight: 400;">Filtered Results</h2>
            <p style="margin: 8px 0 0 0; color: #5f6368; font-size: 14px;">${emails.length} emails found</p>
          </div>
          <button id="close-filtered" style="background: #dadce0; color: #202124; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-size: 14px;">Close</button>
        </div>
      </div>
      
      <div style="padding: 24px;">
        ${emailListHtml || '<div style="text-align: center; padding: 40px; color: #666;">No emails match your filters</div>'}
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('#close-filtered').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  modal.querySelectorAll('.aem-send-followup-filtered').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.emailIndex);
      const email = emails[index];
      if (email) {
        sendManualFollowUp(email);
        modal.remove();
      }
    });
  });
}

// Send manual follow-up
function sendManualFollowUp(email) {
  // Show quick follow-up modal for this specific email
  const modal = document.createElement('div');
  modal.id = 'aem-manual-followup';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 1000000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;
  
  modal.innerHTML = `
    <div style="background: white; border-radius: 8px; max-width: 600px; width: 100%; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">
      <div style="padding: 24px; border-bottom: 1px solid #dadce0;">
        <h2 style="margin: 0; font-size: 20px; color: #202124; font-weight: 400;">Send Follow-up</h2>
        <p style="margin: 8px 0 0 0; color: #5f6368; font-size: 13px;">To: ${email.to}</p>
        <p style="margin: 4px 0 0 0; color: #5f6368; font-size: 13px;">Original: ${email.subject || 'No subject'}</p>
      </div>
      
      <div style="padding: 24px;">
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 13px; font-weight: 500; color: #202124; margin-bottom: 8px;">Subject</label>
          <input type="text" id="manual-subject" value="Re: ${email.subject || ''}" style="width: 100%; padding: 10px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px;">
        </div>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 13px; font-weight: 500; color: #202124; margin-bottom: 8px;">Message</label>
          <textarea id="manual-message" rows="6" style="width: 100%; padding: 10px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px;">Hi,

I wanted to follow up on my previous email about "${email.subject || 'our conversation'}".

Please let me know if you have any questions.

Best regards</textarea>
        </div>
      </div>
      
      <div style="padding: 16px 24px; border-top: 1px solid #dadce0; display: flex; justify-content: flex-end; gap: 12px;">
        <button id="cancel-manual" style="background: transparent; border: 1px solid #dadce0; color: #202124; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-size: 14px;">Cancel</button>
        <button id="send-manual" style="background: #1a73e8; color: white; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">Send Follow-up</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('#cancel-manual').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  modal.querySelector('#send-manual').addEventListener('click', () => {
    const subject = modal.querySelector('#manual-subject').value;
    const message = modal.querySelector('#manual-message').value;
    
    // Send via background script
    chrome.runtime.sendMessage({
      action: 'sendManualFollowUp',
      email: email,
      subject: subject,
      message: message
    }, (response) => {
      if (response && response.success) {
        alert('Follow-up sent successfully!');
        modal.remove();
        showTabContent('followups'); // Refresh
      } else {
        alert('Failed to send follow-up: ' + (response?.error || 'Unknown error'));
      }
    });
  });
}

// Show advanced follow-up modal
function showAdvancedFollowUpModal() {
  const modal = document.createElement('div');
  modal.id = 'aem-followup-modal';
  modal.classList.add('aem-theme-luxe');
  modal.classList.add('aem-theme-luxe');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 1000000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;
  
  modal.innerHTML = `
    <div style="background: white; border-radius: 8px; max-width: 700px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">
      <div style="padding: 24px; border-bottom: 1px solid #dadce0;">
        <h2 style="margin: 0; font-size: 24px; color: #202124; font-weight: 400;">Create New Follow-up</h2>
        <p style="margin: 8px 0 0 0; color: #5f6368; font-size: 14px;">Automatically send follow-ups to recipients who haven't replied</p>
      </div>
      
      <div style="padding: 24px;">
        <!-- Timing Options -->
        <div style="margin-bottom: 24px;">
          <label style="display: block; font-size: 14px; font-weight: 500; color: #202124; margin-bottom: 12px;">⏰ When to Send Follow-up?</label>
          
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 12px;">
            <div>
              <label style="display: block; font-size: 13px; color: #5f6368; margin-bottom: 6px;">Days</label>
              <input type="number" id="followup-days" value="3" min="1" max="30" style="width: 100%; padding: 8px 12px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px;">
            </div>
            <div>
              <label style="display: block; font-size: 13px; color: #5f6368; margin-bottom: 6px;">Hours (optional)</label>
              <input type="number" id="followup-hours" value="0" min="0" max="23" style="width: 100%; padding: 8px 12px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px;">
            </div>
          </div>
          
          <div style="margin-bottom: 12px;">
            <label style="display: block; font-size: 13px; font-weight: 500; color: #202124; margin-bottom: 8px;">Send on specific days of the week:</label>
            <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px;">
              <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border: 2px solid #dadce0; border-radius: 6px; cursor: pointer; transition: all 0.2s;" id="day-mon">
                <span style="font-size: 11px; font-weight: 600; color: #5f6368; margin-bottom: 4px;">Mon</span>
                <input type="checkbox" value="monday" style="width: 18px; height: 18px; margin: 0;">
              </label>
              <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border: 2px solid #dadce0; border-radius: 6px; cursor: pointer; transition: all 0.2s;" id="day-tue">
                <span style="font-size: 11px; font-weight: 600; color: #5f6368; margin-bottom: 4px;">Tue</span>
                <input type="checkbox" value="tuesday" style="width: 18px; height: 18px; margin: 0;">
              </label>
              <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border: 2px solid #dadce0; border-radius: 6px; cursor: pointer; transition: all 0.2s;" id="day-wed">
                <span style="font-size: 11px; font-weight: 600; color: #5f6368; margin-bottom: 4px;">Wed</span>
                <input type="checkbox" value="wednesday" style="width: 18px; height: 18px; margin: 0;">
              </label>
              <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border: 2px solid #dadce0; border-radius: 6px; cursor: pointer; transition: all 0.2s;" id="day-thu">
                <span style="font-size: 11px; font-weight: 600; color: #5f6368; margin-bottom: 4px;">Thu</span>
                <input type="checkbox" value="thursday" style="width: 18px; height: 18px; margin: 0;">
              </label>
              <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border: 2px solid #dadce0; border-radius: 6px; cursor: pointer; transition: all 0.2s;" id="day-fri">
                <span style="font-size: 11px; font-weight: 600; color: #5f6368; margin-bottom: 4px;">Fri</span>
                <input type="checkbox" value="friday" style="width: 18px; height: 18px; margin: 0;">
              </label>
              <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border: 2px solid #dadce0; border-radius: 6px; cursor: pointer; transition: all 0.2s;" id="day-sat">
                <span style="font-size: 11px; font-weight: 600; color: #5f6368; margin-bottom: 4px;">Sat</span>
                <input type="checkbox" value="saturday" style="width: 18px; height: 18px; margin: 0;">
              </label>
              <label style="display: flex; flex-direction: column; align-items: center; padding: 8px; border: 2px solid #dadce0; border-radius: 6px; cursor: pointer; transition: all 0.2s;" id="day-sun">
                <span style="font-size: 11px; font-weight: 600; color: #5f6368; margin-bottom: 4px;">Sun</span>
                <input type="checkbox" value="sunday" style="width: 18px; height: 18px; margin: 0;">
              </label>
            </div>
            <div style="font-size: 11px; color: #5f6368; margin-top: 8px; line-height: 1.4;">
              💡 Leave all unchecked to send on any day. Follow-up will only trigger on selected days.
            </div>
          </div>
          
          <div style="margin-bottom: 12px;">
            <label style="display: block; font-size: 13px; font-weight: 500; color: #202124; margin-bottom: 8px;">Number of follow-ups in this sequence:</label>
            <div style="display: flex; align-items: center; gap: 12px;">
              <input type="number" id="followup-count" value="1" min="1" max="5" style="width: 80px; padding: 8px 12px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px;">
              <span style="font-size: 13px; color: #5f6368;">follow-up(s) with the same timing</span>
            </div>
            <div style="font-size: 11px; color: #5f6368; margin-top: 6px; line-height: 1.4;">
              💡 Create multiple follow-ups with different messages (e.g., 1st after 3 days, 2nd after 7 days). Each automatically stops if recipient replies.
            </div>
          </div>
          
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" id="only-if-no-reply" checked style="width: 18px; height: 18px;">
            <span style="font-size: 13px; color: #202124;">Only send if recipient hasn't replied</span>
          </label>
        </div>

        <!-- Targeting: Labels and Gmail Query -->
        <div style="margin-bottom: 24px;">
          <label style="display: block; font-size: 14px; font-weight: 500; color: #202124; margin-bottom: 8px;">Target by Labels (optional)</label>
          <div id="aem-labels-selected" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;"></div>
          <button id="aem-select-labels" style="background:#202124; color:#fff; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-size:13px;">Select Labels</button>
        </div>
        <div style="margin-bottom: 24px;">
          <label style="display: block; font-size: 14px; font-weight: 500; color: #202124; margin-bottom: 8px;">Gmail Search Query (optional)</label>
          <input type="text" id="followup-query" placeholder="e.g. in:inbox -has:userlabels" style="width: 100%; padding: 10px 12px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px;">
          <div style="font-size: 12px; color: #5f6368; margin-top: 6px;">Advanced Gmail search to apply follow-ups across folders/labels</div>
        </div>
        
        <!-- Email Selection -->
        <div style="margin-bottom: 24px;">
          <label style="display: block; font-size: 14px; font-weight: 500; color: #202124; margin-bottom: 12px;">📧 Which Emails to Follow Up?</label>
          <select id="email-selection" style="width: 100%; padding: 10px 12px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px; background: white;">
            <option value="all">All sent emails</option>
            <option value="bulk">Only bulk send emails</option>
            <option value="scheduled">Only scheduled emails</option>
            <option value="manual">Only manually sent emails</option>
          </select>
        </div>
        
        <!-- Subject -->
        <div style="margin-bottom: 24px;">
          <label style="display: block; font-size: 14px; font-weight: 500; color: #202124; margin-bottom: 8px;">📝 Follow-up Subject</label>
          <input type="text" id="followup-subject" placeholder="Re: [original subject]" style="width: 100%; padding: 10px 12px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px;">
          <div style="font-size: 12px; color: #5f6368; margin-top: 6px; line-height: 1.5;">
            💡 Tip: Use <code style="background: #e8eaed; padding: 2px 6px; border-radius: 3px;">\${original_subject}</code> to include the original subject
          </div>
        </div>
        
        <!-- Message Content -->
        <div style="margin-bottom: 24px;">
          <label style="display: block; font-size: 14px; font-weight: 500; color: #202124; margin-bottom: 8px;">💬 Follow-up Message</label>
          <textarea id="followup-message" rows="8" placeholder="Hi,

I wanted to follow up on my previous email. [recipient_name], I hope you're doing well!

Let me know if you have any questions or need clarification.

Best regards"
style="width: 100%; padding: 12px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px; font-family: inherit; resize: vertical;"></textarea>
          <div style="font-size: 12px; color: #5f6368; margin-top: 6px; line-height: 1.5;">
            💡 Variables you can use: <code style="background: #e8eaed; padding: 2px 6px; border-radius: 3px;">\${recipient_name}</code>, <code style="background: #e8eaed; padding: 2px 6px; border-radius: 3px;">\${original_subject}</code>, <code style="background: #e8eaed; padding: 2px 6px; border-radius: 3px;">\${original_message}</code>
          </div>
        </div>
        
        <!-- Auto-enable -->
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 24px;">
          <input type="checkbox" id="auto-enable" checked style="width: 18px; height: 18px;">
          <span style="font-size: 14px; color: #202124;">Activate this follow-up immediately</span>
        </label>
        
        <!-- Auto-stop on reply -->
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 24px;">
          <input type="checkbox" id="auto-stop-reply" checked style="width: 18px; height: 18px;">
          <span style="font-size: 14px; color: #202124;">Auto-stop sequence if recipient replies</span>
        </label>
        
        <div style="background: #fff3e0; padding: 12px; border-radius: 6px; margin-bottom: 24px;">
          <div style="font-size: 12px; color: #e65100; font-weight: 500; margin-bottom: 4px;">💡 Follow-up Sequence Tip</div>
          <div style="font-size: 11px; color: #666; line-height: 1.5;">
            Create multiple follow-ups with different messages (e.g., 1st follow-up after 3 days, 2nd after 7 days, 3rd after 14 days). 
            Each follow-up in the sequence automatically stops if the recipient replies!
          </div>
        </div>
      </div>
      
      <div style="padding: 16px 24px; border-top: 1px solid #dadce0; display: flex; justify-content: flex-end; gap: 12px;">
        <button id="cancel-followup" style="background: transparent; border: 1px solid #dadce0; color: #202124; padding: 10px 24px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">Cancel</button>
        <button id="save-followup" style="background: #1a73e8; color: white; border: none; padding: 10px 24px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">Create Follow-up</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Close on cancel or background click
  modal.querySelector('#cancel-followup').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  // Save follow-up
  modal.querySelector('#save-followup').addEventListener('click', () => {
    const days = parseInt(modal.querySelector('#followup-days').value);
    const hours = parseInt(modal.querySelector('#followup-hours').value) || 0;
    const onlyIfNoReply = modal.querySelector('#only-if-no-reply').checked;
    const emailSelection = modal.querySelector('#email-selection').value;
    const subject = modal.querySelector('#followup-subject').value || 'Re: ${original_subject}';
    const message = modal.querySelector('#followup-message').value;
    const enabled = modal.querySelector('#auto-enable').checked;
    const autoStopOnReply = modal.querySelector('#auto-stop-reply').checked;
    const selectedLabels = Array.from(modal.querySelectorAll('#aem-labels-selected .aem-chip')).map(el => el.dataset.value);
    const gmailQuery = (modal.querySelector('#followup-query').value || '').trim();
    
    // Get day selection
    const selectedDays = [];
    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].forEach(day => {
      const checkbox = modal.querySelector(`input[value="${day}"]`);
      if (checkbox && checkbox.checked) {
        selectedDays.push(day);
      }
    });
    
    // Get number of follow-ups in sequence
    const followupCount = parseInt(modal.querySelector('#followup-count').value) || 1;
    
    if (!message.trim()) {
      alert('Please enter a follow-up message');
      return;
    }
    
    chrome.storage.local.get('followUpRules', (result) => {
      const rules = result.followUpRules || [];
      
      // Determine sequence number
      const existingRules = rules.length;
      
      // Create multiple follow-ups if count > 1
      const followupsToCreate = [];
      for (let i = 0; i < followupCount; i++) {
        const sequenceNumber = existingRules + i + 1;
        followupsToCreate.push({
          id: 'followup_' + Date.now() + '_' + i,
          sequenceNumber: sequenceNumber,
          timing: { days: days * (i + 1), hours }, // Multiply days for each follow-up in sequence
          triggerOptions: { onlyIfNoReply },
          emailSelection: emailSelection,
          labels: selectedLabels && selectedLabels.length ? selectedLabels : null,
          gmailQuery: gmailQuery || null,
          subject: subject,
          message: message,
          enabled: enabled,
          autoStopOnReply: autoStopOnReply,
          selectedDays: selectedDays.length > 0 ? selectedDays : null, // Store day selection
          createdAt: new Date().toISOString(),
          stats: { sent: 0, replied: 0 },
          isSequence: true
        });
      }
      
      // Add all follow-ups
      rules.push(...followupsToCreate);
      
      chrome.storage.local.set({ followUpRules: rules }, () => {
        modal.remove();
        showTabContent('followups'); // Refresh
      });
      
      // Show success notification
      chrome.runtime.sendMessage({
        action: 'showNotification',
        title: 'Follow-up Created',
        message: `${followupCount} follow-up(s) added to sequence!`
      });
    });
  });

  // Label selector UI
  const selectedLabels = new Set();
  function renderSelectedChips() {
    const wrap = modal.querySelector('#aem-labels-selected');
    if (!wrap) return;
    wrap.innerHTML = '';
    if (selectedLabels.size === 0) {
      wrap.innerHTML = '<span style="font-size:12px; color:#5f6368;">No labels selected</span>';
      return;
    }
    Array.from(selectedLabels).forEach((name) => {
      const chip = document.createElement('span');
      chip.className = 'aem-chip';
      chip.dataset.value = name;
      chip.textContent = name;
      chip.style.cssText = 'padding:6px 10px; border:1px solid #dadce0; border-radius:16px; background:#fff; font-size:12px; display:inline-flex; align-items:center; gap:6px;';
      const x = document.createElement('button');
      x.textContent = '×';
      x.style.cssText = 'border:none; background:transparent; cursor:pointer; font-size:12px;';
      x.addEventListener('click', () => { selectedLabels.delete(name); renderSelectedChips(); });
      chip.appendChild(x);
      wrap.appendChild(chip);
    });
  }

  modal.querySelector('#aem-select-labels')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'fetchGmailLabels' }, (resp) => {
      if (!resp || !resp.success) { alert('Failed to fetch labels'); return; }
      const labels = resp.labels || [];
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:1000001;display:flex;align-items:center;justify-content:center;';
      const panel = document.createElement('div');
      panel.style.cssText = 'background:#fff;max-width:520px;width:100%;max-height:80vh;overflow:auto;border-radius:12px;padding:16px;box-shadow:0 16px 48px rgba(0,0,0,0.25)';
      panel.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center; margin-bottom:8px;">
          <h3 style="margin:0;font-size:18px;color:#202124;">Select Labels</h3>
          <button id="aem-close-labels" style="border:none;background:#eef2ff;color:#1a73e8;border-radius:8px;padding:6px 10px;cursor:pointer;">Close</button>
        </div>
        <div style="display:grid; gap:8px;">
          ${labels.map(l => {
            const isSystem = (l.type || '').toLowerCase() === 'system';
            const name = l.name;
            const sel = selectedLabels.has(name) ? 'border-color:#202124;background:#f1f3f4;' : '';
            return `<button data-name="${name}" style="text-align:left;padding:8px 12px;border:1px solid #dadce0;border-radius:8px;background:#fff;cursor:pointer;${sel}">${isSystem ? '📁' : '🏷️'} ${name}</button>`;
          }).join('')}
        </div>
      `;
      overlay.appendChild(panel);
      document.body.appendChild(overlay);
      panel.querySelector('#aem-close-labels').addEventListener('click', () => overlay.remove());
      panel.querySelectorAll('button[data-name]')?.forEach(btn => {
        btn.addEventListener('click', () => {
          const n = btn.getAttribute('data-name');
          if (selectedLabels.has(n)) selectedLabels.delete(n); else selectedLabels.add(n);
          renderSelectedChips();
          // visual toggle
          const was = btn.style.borderColor;
          btn.style.borderColor = selectedLabels.has(n) ? '#202124' : '#dadce0';
          btn.style.background = selectedLabels.has(n) ? '#f1f3f4' : '#fff';
        });
      });
    });
  });

  renderSelectedChips();
}

// Delete follow-up rule
async function deleteFollowUpRule(index) {
  if (!confirm('Delete this follow-up rule?')) return;
  
  chrome.storage.local.get('followUpRules', (result) => {
    const rules = result.followUpRules || [];
    rules.splice(index, 1);
    
    chrome.storage.local.set({ followUpRules: rules }, () => {
      showTabContent('followups'); // Refresh
    });
  });
}

// Toggle follow-up rule (pause/resume)
async function toggleFollowUpRule(index) {
  chrome.storage.local.get('followUpRules', (result) => {
    const rules = result.followUpRules || [];
    rules[index].enabled = !rules[index].enabled;
    
    chrome.storage.local.set({ followUpRules: rules }, () => {
      showTabContent('followups'); // Refresh
    });
  });
}

// Edit follow-up rule
function editFollowUpRule(index) {
  chrome.storage.local.get('followUpRules', (result) => {
    const rules = result.followUpRules || [];
    const rule = rules[index];
    
    // Show edit modal with pre-filled values
    const modal = document.createElement('div');
    modal.id = 'aem-followup-modal-edit';
    modal.classList.add('aem-theme-luxe');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 1000000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `;
    
    modal.innerHTML = `
      <div style="background: white; border-radius: 8px; max-width: 700px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">
        <div style="padding: 24px; border-bottom: 1px solid #dadce0;">
          <h2 style="margin: 0; font-size: 24px; color: #202124; font-weight: 400;">Edit Follow-up</h2>
          <p style="margin: 8px 0 0 0; color: #5f6368; font-size: 14px;">Update your follow-up settings</p>
        </div>
        
        <div style="padding: 24px;">
          <div style="margin-bottom: 24px;">
            <label style="display: block; font-size: 14px; font-weight: 500; color: #202124; margin-bottom: 12px;">⏰ When to Send Follow-up?</label>
            
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 12px;">
              <div>
                <label style="display: block; font-size: 13px; color: #5f6368; margin-bottom: 6px;">Days</label>
                <input type="number" id="edit-followup-days" value="${rule.timing?.days || rule.daysAfter || 3}" min="1" max="30" style="width: 100%; padding: 8px 12px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px;">
              </div>
              <div>
                <label style="display: block; font-size: 13px; color: #5f6368; margin-bottom: 6px;">Hours (optional)</label>
                <input type="number" id="edit-followup-hours" value="${rule.timing?.hours || 0}" min="0" max="23" style="width: 100%; padding: 8px 12px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px;">
              </div>
            </div>
            
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
              <input type="checkbox" id="edit-only-if-no-reply" ${rule.triggerOptions?.onlyIfNoReply ? 'checked' : ''} style="width: 18px; height: 18px;">
              <span style="font-size: 13px; color: #202124;">Only send if recipient hasn't replied</span>
            </label>
          </div>
          
          <div style="margin-bottom: 24px;">
            <label style="display: block; font-size: 14px; font-weight: 500; color: #202124; margin-bottom: 12px;">📧 Which Emails to Follow Up?</label>
            <select id="edit-email-selection" style="width: 100%; padding: 10px 12px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px; background: white;">
              <option value="all" ${rule.emailSelection === 'all' ? 'selected' : ''}>All sent emails</option>
              <option value="bulk" ${rule.emailSelection === 'bulk' ? 'selected' : ''}>Only bulk send emails</option>
              <option value="scheduled" ${rule.emailSelection === 'scheduled' ? 'selected' : ''}>Only scheduled emails</option>
              <option value="manual" ${rule.emailSelection === 'manual' ? 'selected' : ''}>Only manually sent emails</option>
            </select>
          </div>
          
          <div style="margin-bottom: 24px;">
            <label style="display: block; font-size: 14px; font-weight: 500; color: #202124; margin-bottom: 8px;">📝 Follow-up Subject</label>
            <input type="text" id="edit-followup-subject" value="${rule.subject || ''}" style="width: 100%; padding: 10px 12px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px;">
          </div>
          
          <div style="margin-bottom: 24px;">
            <label style="display: block; font-size: 14px; font-weight: 500; color: #202124; margin-bottom: 8px;">💬 Follow-up Message</label>
            <textarea id="edit-followup-message" rows="8" style="width: 100%; padding: 12px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px; font-family: inherit; resize: vertical;">${rule.message || ''}</textarea>
          </div>
          
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 24px;">
            <input type="checkbox" id="edit-auto-enable" ${rule.enabled ? 'checked' : ''} style="width: 18px; height: 18px;">
            <span style="font-size: 14px; color: #202124;">Activate this follow-up immediately</span>
          </label>
        </div>
        
        <div style="padding: 16px 24px; border-top: 1px solid #dadce0; display: flex; justify-content: flex-end; gap: 12px;">
          <button id="cancel-edit-followup" style="background: transparent; border: 1px solid #dadce0; color: #202124; padding: 10px 24px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">Cancel</button>
          <button id="save-edit-followup" style="background: #1a73e8; color: white; border: none; padding: 10px 24px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">Save Changes</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close handlers
    modal.querySelector('#cancel-edit-followup').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    
    // Inject Labels + Query UI programmatically for edit modal
    try {
      const contentArea = modal.querySelector('div[style*="padding: 24px;"]');
      const labelsBlock = document.createElement('div');
      labelsBlock.innerHTML = `
        <div style="margin-bottom: 24px;">
          <label style="display: block; font-size: 14px; font-weight: 500; color: #202124; margin-bottom: 8px;">Target by Labels (optional)</label>
          <div id="aem-labels-selected-edit" style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:8px;"></div>
          <button id="aem-select-labels-edit" style="background:#202124; color:#fff; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-size:13px;">Select Labels</button>
        </div>
        <div style="margin-bottom: 24px;">
          <label style="display: block; font-size: 14px; font-weight: 500; color: #202124; margin-bottom: 8px;">Gmail Search Query (optional)</label>
          <input type="text" id="edit-followup-query" value="${(rule.gmailQuery || '').replace(/"/g,'&quot;')}" placeholder="e.g. in:inbox -has:userlabels" style="width: 100%; padding: 10px 12px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px;">
          <div style="font-size: 12px; color: #5f6368; margin-top: 6px;">Advanced Gmail search; overrides default from:me when set</div>
        </div>
      `;
      // Insert before footer (top-level next sibling is footer container)
      contentArea.parentElement.insertBefore(labelsBlock, contentArea.parentElement.lastElementChild);
      
      // Label selector logic
      const selectedLabelsEdit = new Set((rule.labels || []).filter(Boolean));
      function renderSelectedChipsEdit() {
        const wrap = modal.querySelector('#aem-labels-selected-edit');
        if (!wrap) return;
        wrap.innerHTML = '';
        if (selectedLabelsEdit.size === 0) {
          wrap.innerHTML = '<span style="font-size:12px; color:#5f6368;">No labels selected</span>';
          return;
        }
        Array.from(selectedLabelsEdit).forEach((name) => {
          const chip = document.createElement('span');
          chip.className = 'aem-chip';
          chip.dataset.value = name;
          chip.textContent = name;
          chip.style.cssText = 'padding:6px 10px; border:1px solid #dadce0; border-radius:16px; background:#fff; font-size:12px; display:inline-flex; align-items:center; gap:6px;';
          const x = document.createElement('button');
          x.textContent = '×';
          x.style.cssText = 'border:none; background:transparent; cursor:pointer; font-size:12px;';
          x.addEventListener('click', () => { selectedLabelsEdit.delete(name); renderSelectedChipsEdit(); });
          chip.appendChild(x);
          wrap.appendChild(chip);
        });
      }
      
      modal.querySelector('#aem-select-labels-edit')?.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'fetchGmailLabels' }, (resp) => {
          if (!resp || !resp.success) { alert('Failed to fetch labels'); return; }
          const labels = resp.labels || [];
          const overlay = document.createElement('div');
          overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:1000001;display:flex;align-items:center;justify-content:center;';
          const panel = document.createElement('div');
          panel.style.cssText = 'background:#fff;max-width:520px;width:100%;max-height:80vh;overflow:auto;border-radius:12px;padding:16px;box-shadow:0 16px 48px rgba(0,0,0,0.25)';
          panel.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center; margin-bottom:8px;">
              <h3 style="margin:0;font-size:18px;color:#202124;">Select Labels</h3>
              <button id="aem-close-labels-edit" style="border:none;background:#eef2ff;color:#1a73e8;border-radius:8px;padding:6px 10px;cursor:pointer;">Close</button>
            </div>
            <div style="display:grid; gap:8px;">
              ${labels.map(l => {
                const isSystem = (l.type || '').toLowerCase() === 'system';
                const name = l.name;
                const sel = selectedLabelsEdit.has(name) ? 'border-color:#202124;background:#f1f3f4;' : '';
                return `<button data-name="${name}" style="text-align:left;padding:8px 12px;border:1px solid #dadce0;border-radius:8px;background:#fff;cursor:pointer;${sel}">${isSystem ? '📁' : '🏷️'} ${name}</button>`;
              }).join('')}
            </div>
          `;
          overlay.appendChild(panel);
          document.body.appendChild(overlay);
          panel.querySelector('#aem-close-labels-edit').addEventListener('click', () => overlay.remove());
          panel.querySelectorAll('button[data-name]')?.forEach(btn => {
            btn.addEventListener('click', () => {
              const n = btn.getAttribute('data-name');
              if (selectedLabelsEdit.has(n)) selectedLabelsEdit.delete(n); else selectedLabelsEdit.add(n);
              renderSelectedChipsEdit();
              btn.style.borderColor = selectedLabelsEdit.has(n) ? '#202124' : '#dadce0';
              btn.style.background = selectedLabelsEdit.has(n) ? '#f1f3f4' : '#fff';
            });
          });
        });
      });
      renderSelectedChipsEdit();
    } catch (_) {}
    
    // Save changes
    modal.querySelector('#save-edit-followup').addEventListener('click', () => {
      const days = parseInt(modal.querySelector('#edit-followup-days').value);
      const hours = parseInt(modal.querySelector('#edit-followup-hours').value) || 0;
      const onlyIfNoReply = modal.querySelector('#edit-only-if-no-reply').checked;
      const emailSelection = modal.querySelector('#edit-email-selection').value;
      const subject = modal.querySelector('#edit-followup-subject').value;
      const message = modal.querySelector('#edit-followup-message').value;
      const enabled = modal.querySelector('#edit-auto-enable').checked;
      const labelsArr = Array.from(modal.querySelectorAll('#aem-labels-selected-edit .aem-chip')).map(el => el.dataset.value);
      const gmailQuery = (modal.querySelector('#edit-followup-query')?.value || '').trim();
      
      if (!message.trim()) {
        alert('Please enter a follow-up message');
        return;
      }
      
      rules[index] = {
        ...rules[index],
        timing: { days, hours },
        triggerOptions: { onlyIfNoReply },
        emailSelection: emailSelection,
        subject: subject,
        message: message,
        enabled: enabled,
        labels: labelsArr && labelsArr.length ? labelsArr : null,
        gmailQuery: gmailQuery || null,
        updatedAt: new Date().toISOString()
      };
      
      chrome.storage.local.set({ followUpRules: rules }, () => {
        modal.remove();
        showTabContent('followups'); // Refresh
      });
    });
  });
}

// Observe compose window and add scheduling option
function observeComposeWindow() {
  const observer = new MutationObserver(() => {
    const composeContainer = document.querySelector('[role="dialog"]');
    if (composeContainer && !composeContainer.querySelector('.aem-schedule-btn')) {
      addScheduleButton(composeContainer);
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Add Schedule and Bulk Send buttons to compose window
function addScheduleButton(composeContainer) {
  const toolbar = composeContainer.querySelector('[role="group"]');
  if (!toolbar) return;
  
  // REMOVED: Email Tracking Toggle (now in Settings tab only for cleaner composer)
  
  // Add Schedule button
  const scheduleBtn = document.createElement('div');
  scheduleBtn.className = 'aem-schedule-btn';
  scheduleBtn.innerHTML = `<button class="aem-btn">📅 Schedule</button>`;
  toolbar.appendChild(scheduleBtn);
  
  scheduleBtn.querySelector('button').addEventListener('click', () => {
    showScheduleDialog(composeContainer);
  });
  // Skip adding Bulk Send buttons to Gmail composer; use sidebar Bulk Composer instead.
  return;
  
  // Add Bulk Send button (ONLY Schedule and Bulk Send in composer)
  const bulkBtn = document.createElement('div');
  bulkBtn.className = 'aem-bulk-btn';
  bulkBtn.innerHTML = `<button class="aem-btn" style="background: #0f5132;">📧 Bulk Send</button>`;
  toolbar.appendChild(bulkBtn);
  
  bulkBtn.querySelector('button').addEventListener('click', () => {
    showBulkSendModal();
  });
}

// Show schedule dialog
function showScheduleDialog(composeContainer) {
  const dialog = document.createElement('div');
  dialog.className = 'aem-modal';
  dialog.innerHTML = `
    <div class="aem-modal-content">
      <h3>Schedule Email</h3>
      <div>
        <label>Send on:</label>
        <input type="datetime-local" id="aem-schedule-time">
      </div>
      <div>
        <label>Recurring:</label>
        <select id="aem-recurring">
          <option value="none">None</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      </div>
      <div class="aem-modal-actions">
        <button class="aem-btn-primary" id="aem-schedule-submit">Schedule</button>
        <button class="aem-btn" id="aem-schedule-cancel">Cancel</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(dialog);
  
  // Get email details
  const to = composeContainer.querySelector('[name="to"]')?.value || '';
  const subject = composeContainer.querySelector('[name="subjectbox"]')?.value || '';
  const body = composeContainer.querySelector('[contenteditable="true"][g_editable="true"]')?.innerText || '';
  
  // Submit handler
  document.getElementById('aem-schedule-submit').addEventListener('click', () => {
    const scheduledTime = document.getElementById('aem-schedule-time').value;
    const recurring = document.getElementById('aem-recurring').value;
    
    if (!scheduledTime) {
      alert('Please select a date and time');
      return;
    }
    
    // Schedule email
    chrome.runtime.sendMessage({
      action: 'scheduleEmail',
      email: {
        to,
        subject,
        body,
        scheduledFor: scheduledTime,
        recurring
      }
    }, (response) => {
      if (response.success) {
        alert('Email scheduled successfully!');
        document.body.removeChild(dialog);
        // Optionally close compose window
        composeContainer.querySelector('[role="button"][aria-label="Close"]')?.click();
      }
    });
  });
  
  // Cancel handler
  document.getElementById('aem-schedule-cancel').addEventListener('click', () => {
    document.body.removeChild(dialog);
  });
}

// Show bulk send panel integrated into Gmail compose - CHANGED TO MODAL OVERLAY
function showBulkSendModal() {
  // Find compose container
  const composeContainer = document.querySelector('[role="dialog"]');
  if (!composeContainer) {
    alert('Please open compose window first');
    return;
  }
  
  // Check if modal already exists
  let existingModal = document.querySelector('.aem-bulk-modal-overlay');
  if (existingModal) {
    existingModal.remove();
  }
  
  // Create modal overlay
  const modal = document.createElement('div');
  modal.className = 'aem-bulk-modal-overlay';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999999;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  
  // Create modal content
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 24px;
    max-width: 600px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    font-family: 'Google Sans', Roboto, sans-serif;
  `;
  
  document.body.appendChild(modal);
  
  // Get Gmail's actual subject and body elements
  let gmailSubject = composeContainer.querySelector('[name="subjectbox"]');
  if (!gmailSubject) {
    gmailSubject = composeContainer.querySelector('input[name="subject"]');
  }
  if (!gmailSubject) {
    gmailSubject = composeContainer.querySelector('input[placeholder*="Subject"]');
  }
  
  let gmailBody = composeContainer.querySelector('[g_editable="true"][contenteditable="true"]');
  if (!gmailBody) {
    gmailBody = composeContainer.querySelector('[role="textbox"][contenteditable="true"]');
  }
  if (!gmailBody) {
    gmailBody = composeContainer.querySelector('[contenteditable="true"]');
  }
  
  if (!gmailSubject || !gmailBody) {
    alert('Cannot access Gmail compose fields. Please make sure you have subject and message filled.');
    modal.remove();
    return;
  }
  
  modalContent.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h2 style="margin: 0; font-size: 20px; font-weight: 600; color: #202124;">📧 Bulk Send</h2>
      <button id="close-bulk-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #5f6368;">&times;</button>
    </div>
    
    <div style="margin-bottom: 16px;">
      <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #202124;">Google Sheets URL</label>
      <input type="text" id="sheets-url" placeholder="Paste Google Sheets URL here..." style="width: 100%; padding: 10px; border: 1px solid #dadce0; border-radius: 6px; font-size: 14px; box-sizing: border-box;">
    </div>
    
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
      <div>
        <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #202124;">Delay Between Emails</label>
        <select id="delay-option" style="width: 100%; padding: 10px; border: 1px solid #dadce0; border-radius: 6px; font-size: 14px;">
          <option value="instant">Send now</option>
          <option value="1">1 sec delay</option>
          <option value="3">3 sec delay</option>
          <option value="5">5 sec delay</option>
          <option value="10">10 sec delay</option>
        </select>
      </div>
      <div>
        <label style="display: block; font-weight: 600; margin-bottom: 8px; color: #202124;">Start Time (Optional)</label>
        <input type="datetime-local" id="start-time" style="width: 100%; padding: 10px; border: 1px solid #dadce0; border-radius: 6px; font-size: 14px;">
      </div>
    </div>
    
    <details style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
      <summary style="font-weight: 600; color: #202124; cursor: pointer;">🎯 Conditional Sending (Optional)</summary>
      <div style="margin-top: 12px;">
        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;">
          <input type="checkbox" id="send-if-opened">
          <span>Opened previous email</span>
        </label>
        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;">
          <input type="checkbox" id="send-if-clicked">
          <span>Clicked link</span>
        </label>
        <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px; cursor: pointer;">
          <input type="checkbox" id="send-if-replied">
          <span>Replied to email</span>
        </label>
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
          <input type="checkbox" id="send-if-no-engagement">
          <span>No engagement</span>
        </label>
      </div>
    </details>
    
    <div style="display: flex; gap: 12px;">
      <button id="load-sheets-btn" style="flex: 1; padding: 12px; border: none; border-radius: 6px; background: #1a73e8; color: white; font-weight: 600; cursor: pointer; font-size: 14px;">Load Sheet</button>
      <button id="send-bulk-btn" style="display: none; flex: 1; padding: 12px; border: none; border-radius: 6px; background: #34a853; color: white; font-weight: 600; cursor: pointer; font-size: 14px;">Send <span id="email-count">0</span> Emails</button>
    </div>
    
    <div id="sheet-preview" style="margin-top: 16px; display: none;"></div>
  `;
  
  modal.appendChild(modalContent);
  
  // Close button
  document.getElementById('close-bulk-modal').addEventListener('click', () => {
    modal.remove();
  });
  
  // Click outside to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
    }
  });
  
  // Load button
  document.getElementById('load-sheets-btn').addEventListener('click', () => {
    const sheetsUrl = document.getElementById('sheets-url').value;
    if (!sheetsUrl) {
      alert('Please enter a Google Sheets URL');
      return;
    }
    loadSheetsDataFromModal(sheetsUrl, gmailSubject, gmailBody);
  });
  
  // Send button
  document.getElementById('send-bulk-btn').addEventListener('click', () => {
    startBulkSendFromGmail(gmailSubject, gmailBody);
    modal.remove();
  });
}

// Load sheets data from the modal
function loadSheetsDataFromModal(sheetsUrl, gmailSubject, gmailBody) {
  // Check if extension context is still valid
  if (!chrome.runtime || !chrome.runtime.id) {
    alert('Extension context invalidated. Please reload the Gmail page.');
    return;
  }
  
  const sheetId = sheetsUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  
  if (!sheetId) {
    alert('Invalid Google Sheets URL');
    return;
  }
  
  // Show loading state
  const loadBtn = document.getElementById('load-sheets-btn');
  const originalText = loadBtn.textContent;
  loadBtn.textContent = 'Loading...';
  loadBtn.disabled = true;
  
  chrome.runtime.sendMessage({
    action: 'fetchSheetsData',
    sheetId: sheetId
  }, (response) => {
    // Restore button state
    loadBtn.textContent = originalText;
    loadBtn.disabled = false;
    
    // Check for runtime errors
    if (chrome.runtime.lastError) {
      const error = chrome.runtime.lastError.message;
      if (error.includes('Extension context invalidated') || error.includes('message port closed')) {
        alert('Extension was reloaded. Please refresh this page and try again.');
        window.location.reload();
        return;
      }
      alert('Error: ' + error);
      return;
    }
    
    if (!response) {
      alert('No response from extension. Please check if the extension is running.');
      return;
    }
    
    if (response.success) {
      window.bulkSheetData = response.data;
      
      // Show preview
      const preview = document.getElementById('sheet-preview');
      const emailCount = response.data.length;
      
      preview.innerHTML = `
        <div style="background: #e8f5e9; padding: 16px; border-radius: 8px; margin-top: 16px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span style="font-size: 24px;">✅</span>
            <strong style="font-size: 16px;">Found ${emailCount} recipients!</strong>
          </div>
          <div style="font-size: 13px; color: #5f6368;">
            Columns: ${Object.keys(response.data[0] || {}).join(', ')}
          </div>
        </div>
      `;
      preview.style.display = 'block';
      
      // Show send button
      document.getElementById('load-sheets-btn').style.display = 'none';
      document.getElementById('send-bulk-btn').style.display = 'flex';
      document.getElementById('email-count').textContent = emailCount;
    } else {
      const errorMsg = response.error || 'Unknown error';
      if (errorMsg.includes('authenticated') || errorMsg.includes('permission') || errorMsg.includes('401') || errorMsg.includes('403')) {
        alert('Authentication Error!\n\nYour session may have expired. Please:\n\n1. Click "Reauthenticate" in the extension popup\n2. Or reload this page after reauthenticating\n\nError: ' + errorMsg);
      } else {
        alert('Error loading sheet: ' + errorMsg);
      }
    }
  });
}

function closeBulkPanel() {
  const modal = document.querySelector('.aem-bulk-modal-overlay');
  if (modal) {
    modal.remove();
  }
}

// Start bulk sending
function startBulkSend() {
  if (!gmailSubject) {
    gmailSubject = composeContainer.querySelector('input[name="subject"]');
  }
  if (!gmailSubject) {
    gmailSubject = composeContainer.querySelector('input[placeholder*="Subject"]');
  }
  
  let gmailBody = composeContainer.querySelector('[g_editable="true"][contenteditable="true"]');
  if (!gmailBody) {
    gmailBody = composeContainer.querySelector('[role="textbox"][contenteditable="true"]');
  }
  if (!gmailBody) {
    gmailBody = composeContainer.querySelector('[contenteditable="true"]');
  }
  
  if (!gmailSubject || !gmailBody) {
    console.log('Gmail elements not found. Subject:', gmailSubject, 'Body:', gmailBody);
    alert('Cannot access Gmail compose fields. Please make sure you have subject and message filled.');
    return;
  }
  
  console.log('Found Gmail elements:', {
    subject: gmailSubject,
    body: gmailBody
  });
  
  panel.innerHTML = `
    <div class="aem-mini-header" style="cursor: pointer; user-select: none;">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 18px;">📧</span>
        <div style="flex: 1;">
          <div style="font-weight: 600; font-size: 14px; color: #202124;">Bulk Send</div>
          <div style="font-size: 11px; color: #5f6368;" id="bulk-status">Paste sheet URL to start</div>
        </div>
        <span class="aem-toggle-icon" style="font-size: 16px; color: #5f6368;">▼</span>
      </div>
    </div>
    <div class="aem-mini-content" style="display: none; padding: 12px; background: #fafafa; border-top: 1px solid #e8eaed;">
      <div class="aem-sheets-input" style="display: flex; gap: 8px; margin-bottom: 12px;">
        <input type="text" id="sheets-url" placeholder="Paste Google Sheets URL here..." style="flex: 1; padding: 8px 12px; border: 1px solid #dadce0; border-radius: 6px; font-size: 13px; box-sizing: border-box;">
        <button class="aem-load-btn" id="load-sheets-btn" style="padding: 8px 20px; border: none; border-radius: 6px; background: #1a73e8; color: white; font-weight: 600; cursor: pointer; white-space: nowrap;">Load</button>
      </div>
      
      <div class="aem-timing-controls" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px;">
        <select id="delay-option" class="aem-select" style="padding: 8px 12px; border: 1px solid #dadce0; border-radius: 6px; font-size: 12px;">
          <option value="instant">Send now</option>
          <option value="1">1 sec delay</option>
          <option value="3">3 sec delay</option>
          <option value="5">5 sec delay</option>
          <option value="10">10 sec delay</option>
        </select>
        <input type="datetime-local" id="start-time" class="aem-datetime" placeholder="Start time" style="padding: 8px 12px; border: 1px solid #dadce0; border-radius: 6px; font-size: 12px;">
      </div>
      
      <details style="background: #f8f9fa; padding: 8px; border-radius: 6px; margin-bottom: 12px; font-size: 12px;">
        <summary style="font-weight: 600; color: #202124; cursor: pointer; padding: 4px;">🎯 Conditional Sending (Optional)</summary>
        <div style="margin-top: 8px; padding-left: 16px;">
          <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; cursor: pointer;">
            <input type="checkbox" id="send-if-opened" style="width: 16px; height: 16px;">
            <span>Opened previous email</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; cursor: pointer;">
            <input type="checkbox" id="send-if-clicked" style="width: 16px; height: 16px;">
            <span>Clicked link</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; cursor: pointer;">
            <input type="checkbox" id="send-if-replied" style="width: 16px; height: 16px;">
            <span>Replied to email</span>
          </label>
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
            <input type="checkbox" id="send-if-no-engagement" style="width: 16px; height: 16px;">
            <span>No engagement</span>
          </label>
        </div>
      </details>
      
      <button class="aem-send-btn-main" id="send-bulk-btn" style="display: none; width: 100%; padding: 10px; border: none; border-radius: 6px; background: #34a853; color: white; font-weight: 600; cursor: pointer; font-size: 14px;">
        Send <span id="email-count">0</span> Emails
      </button>
    </div>
  `;
  
  // Insert after subject line but in a controlled way to prevent Gmail auto-resize
  const parentNode = subjectLine.parentNode;
  
  // Try to insert right after subject but if that causes issues, insert at end
  try {
    // Find the body editor and insert before it
    const bodyEditor = composeContainer.querySelector('[contenteditable="true"]');
    if (bodyEditor && bodyEditor.parentNode) {
      bodyEditor.parentNode.insertBefore(panel, bodyEditor);
    } else {
      parentNode.insertBefore(panel, subjectLine.nextSibling);
    }
  } catch (e) {
    // Fallback: append to parent
    parentNode.appendChild(panel);
  }
  
  // CRITICAL: Add MutationObserver to prevent Gmail from modifying our panel
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
        const target = mutation.target;
        if (target === panel || panel.contains(target)) {
          // Re-apply our height constraints if Gmail tries to change them
          if (panel.style.height && parseInt(panel.style.height) > 350) {
            panel.style.height = '350px';
          }
          if (panel.style.maxHeight && parseInt(panel.style.maxHeight) > 350) {
            panel.style.maxHeight = '350px';
          }
        }
      }
    });
  });
  
  // Start observing the panel and its parent for style changes
  observer.observe(panel, { 
    attributes: true, 
    attributeFilter: ['style', 'class'],
    subtree: true 
  });
  observer.observe(composeContainer, { 
    attributes: true, 
    attributeFilter: ['style', 'class'] 
  });
  
  // Add event listeners
  setTimeout(() => {
    // Toggle button - always starts collapsed
    const header = panel.querySelector('.aem-mini-header');
    const content = panel.querySelector('.aem-mini-content');
    const icon = header.querySelector('.aem-toggle-icon');
    
    header.addEventListener('click', () => {
      if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = '▲';
        panel.style.marginBottom = '12px';
      } else {
        content.style.display = 'none';
        icon.textContent = '▼';
        panel.style.marginBottom = '0px';
      }
    });
    
    // Start collapsed to keep composer compact
    content.style.display = 'none';
    panel.style.marginBottom = '0px';
    
    // Note: Height protection is handled by:
    // 1. CSS constraints on .aem-bulk-mini
    // 2. MutationObserver below
    // No need for event handlers that block interactions
    
    // Load button
    document.getElementById('load-sheets-btn')?.addEventListener('click', () => {
      const sheetsUrl = document.getElementById('sheets-url').value;
      if (!sheetsUrl) {
        alert('Please enter a Google Sheets URL');
        return;
      }
      loadSheetsDataFromGmail(gmailSubject, gmailBody);
    });
    
    // Send button
    document.getElementById('send-bulk-btn')?.addEventListener('click', () => {
      startBulkSendFromGmail(gmailSubject, gmailBody);
    });
  }, 100);
}

function closeBulkPanel() {
  const panel = document.querySelector('.aem-bulk-panel');
  if (panel) {
    panel.style.display = 'none';
  }
}

// Start bulk sending
function startBulkSend() {
  const subject = document.getElementById('bulk-subject').value;
  const content = document.getElementById('bulk-content').value;
  const startTime = document.getElementById('start-time').value;
  const delayOption = document.getElementById('delay-option').value;
  const customDelay = document.getElementById('custom-delay-value').value;
  
  if (!subject || !content) {
    alert('Please fill in subject and content');
    return;
  }
  
  if (!window.bulkSheetData || window.bulkSheetData.length === 0) {
    alert('Please load sheet data first');
    return;
  }
  
  // Calculate delay in milliseconds
  let delay = 0;
  if (delayOption === 'instant') {
    delay = 0;
  } else if (delayOption === 'custom') {
    delay = (parseInt(customDelay) || 1) * 1000;
  } else {
    delay = parseInt(delayOption) * 1000;
  }
  
  // Prepare emails
  const emails = window.bulkSheetData.map((row, index) => {
    let emailContent = content;
    let emailSubject = subject;
    
    // Replace variables
    Object.keys(row).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'gi');
      emailContent = emailContent.replace(regex, row[key] || '');
      emailSubject = emailSubject.replace(regex, row[key] || '');
    });
    
    // Also support common variable names
    emailContent = emailContent.replace(/{{name}}/gi, row.name || row.Name || '');
    emailContent = emailContent.replace(/{{email}}/gi, row.email || row.Email || '');
    emailContent = emailContent.replace(/{{company}}/gi, row.company || row.Company || '');
    emailSubject = emailSubject.replace(/{{name}}/gi, row.name || row.Name || '');
    emailSubject = emailSubject.replace(/{{email}}/gi, row.email || row.Email || '');
    emailSubject = emailSubject.replace(/{{company}}/gi, row.company || row.Company || '');
    
    // Intelligent email detection - try multiple common column names
    let emailAddress = '';
    
    // Try various email column names (case-insensitive)
    const emailKeys = Object.keys(row);
    for (const key of emailKeys) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('email') || lowerKey.includes('e-mail')) {
        emailAddress = row[key] || '';
        if (emailAddress && emailAddress.includes('@')) {
          break;
        }
      }
    }
    
    return {
      id: Date.now() + index,
      to: emailAddress,
      subject: emailSubject,
      body: emailContent,
      rowData: row
    };
  }).filter(email => email.to && email.to.includes('@')); // Filter out emails without recipient
  
  if (emails.length === 0) {
    alert('No valid email addresses found in sheet');
    return;
  }
  
  // Confirm before sending
  if (!confirm(`Ready to send ${emails.length} emails with ${delay/1000}s delay between each?\n\nStart time: ${startTime || 'Now'}`)) {
    return;
  }
  
  // Send to background script
  chrome.runtime.sendMessage({
    action: 'startBulkSending',
    emails: emails,
    startTime: startTime,
    delay: delay
  }, (response) => {
    if (response.error) {
      alert('Error: ' + response.error);
    } else {
      alert(`✅ Started sending ${emails.length} emails!\n\nCheck extension popup for progress.`);
      closeBulkModal();
    }
  });
}

// Load data from Google Sheets
async function loadSheetsData() {
  const sheetsUrl = document.getElementById('sheets-url').value;
  
  if (!sheetsUrl) {
    alert('Please enter a Google Sheets URL');
    return;
  }
  
  // Extract sheet ID from URL
  const sheetId = extractSheetId(sheetsUrl);
  if (!sheetId) {
    alert('Invalid Google Sheets URL');
    return;
  }
  
  const loadBtn = document.getElementById('load-sheets-btn');
  loadBtn.textContent = 'Loading...';
  loadBtn.disabled = true;
  
  try {
    // Check if runtime is available
    if (!chrome.runtime || !chrome.runtime.id) {
      throw new Error('Extension context invalid. Please reload the Gmail page.');
    }
    
    // Call background script to fetch sheet data
    chrome.runtime.sendMessage({
      action: 'fetchSheetsData',
      sheetId: sheetId
    }, (response) => {
      if (chrome.runtime.lastError) {
        alert('Error: ' + chrome.runtime.lastError.message + '\n\nPlease reload the Gmail page.');
        loadBtn.textContent = '📥 Load Sheet';
        loadBtn.disabled = false;
        return;
      }
      
      if (response.error) {
        alert('Error loading sheet: ' + response.error);
        loadBtn.textContent = '📥 Load Sheet';
        loadBtn.disabled = false;
        return;
      }
      
      // Show preview
      const previewDiv = document.getElementById('sheets-preview');
      previewDiv.style.display = 'block';
      
      let previewHtml = '<p style="margin: 0 0 8px 0; font-weight: 500;">✅ Loaded!</p>';
      previewHtml += '<table style="width: 100%; font-size: 12px;">';
      
      if (response.data && response.data.length > 0) {
        // Header row
        previewHtml += '<tr>';
        Object.keys(response.data[0]).forEach(key => {
          previewHtml += `<th>${key}</th>`;
        });
        previewHtml += '</tr>';
        
        // Data rows (first 3)
        response.data.slice(0, 3).forEach(row => {
          previewHtml += '<tr>';
          Object.values(row).forEach(val => {
            previewHtml += `<td>${val}</td>`;
          });
          previewHtml += '</tr>';
        });
      }
      
      previewHtml += '</table>';
      previewHtml += `<p style="margin: 8px 0 0 0; color: #1a73e8; font-weight: 500;">${response.data.length} recipients ready</p>`;
      
      previewDiv.innerHTML = previewHtml;
      document.getElementById('send-bulk-btn').style.display = 'inline-block';
      document.getElementById('send-bulk-btn').textContent = `Send ${response.data.length} Emails`;
      
      loadBtn.textContent = '📥 Load Sheet';
      loadBtn.disabled = false;
      
      // Store data for sending
      window.bulkSheetData = response.data;
    });
  } catch (error) {
    console.error('Error:', error);
    alert('Error loading sheet: ' + error.message + '\n\nPlease reload the Gmail page.');
    loadBtn.textContent = '📥 Load Sheet';
    loadBtn.disabled = false;
  }
}

// Extract sheet ID from URL
function extractSheetId(url) {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

// Load sheets data using Gmail's native fields
async function loadSheetsDataFromGmail(gmailSubject, gmailBody) {
  const sheetsUrl = document.getElementById('sheets-url').value;
  const loadBtn = document.getElementById('load-sheets-btn');
  
  if (!sheetsUrl) {
    alert('Please enter a Google Sheets URL');
    return;
  }
  
  const sheetId = extractSheetId(sheetsUrl);
  if (!sheetId) {
    alert('Invalid Google Sheets URL');
    return;
  }
  
  loadBtn.textContent = 'Loading...';
  loadBtn.disabled = true;
  
  try {
    if (!chrome.runtime || !chrome.runtime.id) {
      throw new Error('Extension context invalid. Please reload the Gmail page.');
    }
    
    chrome.runtime.sendMessage({
      action: 'fetchSheetsData',
      sheetId: sheetId
    }, (response) => {
      if (chrome.runtime.lastError) {
        alert('Error: ' + chrome.runtime.lastError.message);
        loadBtn.textContent = 'Load';
        loadBtn.disabled = false;
        return;
      }
      
      if (response.error) {
        alert('Error loading sheet: ' + response.error);
        loadBtn.textContent = 'Load';
        loadBtn.disabled = false;
        return;
      }
      
      // Show preview in popup instead of composer to avoid long height
      showSheetsPreviewPopup(response.data);
      
      document.getElementById('send-bulk-btn').style.display = 'inline-block';
      document.getElementById('email-count').textContent = response.data.length;
      
      // Update header status
      const statusEl = document.getElementById('bulk-status');
      if (statusEl) {
        statusEl.textContent = `${response.data.length} recipients loaded - Ready to send`;
        statusEl.style.color = '#34a853';
        statusEl.style.fontWeight = '600';
      }
      
      // Hide the preview div in composer to keep it compact
      const previewDiv = document.getElementById('sheets-preview');
      if (previewDiv) {
        previewDiv.style.display = 'none';
      }
      
      loadBtn.textContent = 'Load';
      loadBtn.disabled = false;
      
      window.bulkSheetData = response.data;
      window.gmailSubject = gmailSubject;
      window.gmailBody = gmailBody;
    });
  } catch (error) {
    alert('Error: ' + error.message);
    loadBtn.textContent = 'Load';
    loadBtn.disabled = false;
  }
}

// Start bulk send using Gmail's fields
function startBulkSendFromGmail(gmailSubject, gmailBody) {
  if (!window.bulkSheetData || window.bulkSheetData.length === 0) {
    alert('Please load sheet data first');
    return;
  }
  
  // Get values from Gmail's native fields - try multiple methods
  let subject = '';
  let content = '';
  
  // Try to get subject
  if (gmailSubject) {
    subject = gmailSubject.value || gmailSubject.textContent || gmailSubject.innerText || '';
  }
  
  // Try to get body content - Gmail uses contenteditable div
  if (gmailBody) {
    content = gmailBody.textContent || gmailBody.innerText || '';
    
    // If still empty, try to get from all contenteditable elements
    if (!content) {
      const allContentEditable = document.querySelectorAll('[contenteditable="true"]');
      for (const elem of allContentEditable) {
        const elemText = elem.textContent || elem.innerText || '';
        if (elemText.length > content.length) {
          content = elemText;
        }
      }
    }
  }
  
  // Check if values are meaningful
  if (!subject || subject.trim().length === 0) {
    alert('Please add a subject line to your email');
    return;
  }
  
  if (!content || content.trim().length === 0) {
    alert('Please add message content to your email');
    return;
  }
  
  console.log('Subject found:', subject);
  console.log('Content found:', content.substring(0, 100) + '...');
  
  // Get conditional sending options
  const sendIfOpened = document.getElementById('send-if-opened')?.checked || false;
  const sendIfClicked = document.getElementById('send-if-clicked')?.checked || false;
  const sendIfReplied = document.getElementById('send-if-replied')?.checked || false;
  const sendIfNoEngagement = document.getElementById('send-if-no-engagement')?.checked || false;
  
  const startTime = document.getElementById('start-time').value;
  const delayOption = document.getElementById('delay-option').value;
  
  let delay = 0;
  if (delayOption !== 'instant') {
    delay = parseInt(delayOption) * 1000;
  }
  
  // Prepare emails
  let emails = window.bulkSheetData.map((row, index) => {
    let emailContent = content;
    let emailSubject = subject;
    
    // Replace variables
    Object.keys(row).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'gi');
      emailContent = emailContent.replace(regex, row[key] || '');
      emailSubject = emailSubject.replace(regex, row[key] || '');
    });
    
    // Intelligent email detection
    let emailAddress = '';
    const emailKeys = Object.keys(row);
    for (const key of emailKeys) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('email') || lowerKey.includes('e-mail')) {
        emailAddress = row[key] || '';
        if (emailAddress && emailAddress.includes('@')) {
          break;
        }
      }
    }
    
    return {
      id: Date.now() + index,
      to: emailAddress,
      subject: emailSubject,
      body: emailContent,
      rowData: row
    };
  }).filter(email => {
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return email.to && email.to.includes('@') && emailRegex.test(email.to);
  });
  
  // Apply conditional sending filters
  if (sendIfOpened || sendIfClicked || sendIfReplied || sendIfNoEngagement) {
    // Check if extension context is still valid
    if (!chrome.runtime || !chrome.runtime.id) {
      alert('Extension context invalidated. Please reload the Gmail page.');
      return;
    }
    
    chrome.storage.local.get(['trackedEmails', 'emailReplies'], (result) => {
      // Handle potential errors from storage access
      if (chrome.runtime.lastError) {
        console.error('Storage error:', chrome.runtime.lastError);
        alert('Error accessing stored data: ' + chrome.runtime.lastError.message);
        return;
      }
      
      const trackedEmails = result.trackedEmails || [];
      const emailReplies = result.emailReplies || [];
      
      const filteredEmails = emails.filter(email => {
        const emailData = emailReplies.find(e => e.to === email.to);
        const trackedData = trackedEmails.find(t => t.id === emailData?.id);
        
        const hasReplied = emailData?.hasReplied || false;
        const hasOpened = trackedData?.opened || false;
        const hasClicked = trackedData?.linkClicks && trackedData.linkClicks.length > 0;
        
        // Apply conditional filters
        if (sendIfReplied && !hasReplied) return false;
        if (sendIfOpened && !hasOpened) return false;
        if (sendIfClicked && !hasClicked) return false;
        if (sendIfNoEngagement && (hasReplied || hasOpened || hasClicked)) return false;
        
        return true;
      });
      
      continueBulkSendProcess(filteredEmails, startTime, delay);
    });
    return;
  }
  
  continueBulkSendProcess(emails, startTime, delay);
}

function continueBulkSendProcess(emails, startTime, delay) {
  if (emails.length === 0) {
    alert('No valid email addresses found in sheet' + 
      ' (no recipients matched your conditional criteria)');
    return;
  }
  
  // Prevent NaN in message
  const delayText = delay > 0 ? `${delay/1000}s` : 'no';
  
  if (!confirm(`Ready to send ${emails.length} emails with ${delayText} delay?\n\nSubject and message will be taken from the compose window above.`)) {
    return;
  }
  
  // Check if extension context is still valid
  if (!chrome.runtime || !chrome.runtime.id) {
    alert('Extension context invalidated. Please reload the Gmail page.');
    return;
  }
  
  // Backend guardrail: warn if backend offline
  chrome.runtime.sendMessage({ action: 'getBackendStatus' }, (statusResp) => {
    if (statusResp && statusResp.success && statusResp.status !== 'ready') {
      const proceed = confirm('Backend appears offline. Proceed in local mode? You must keep your PC on.');
      if (!proceed) return;
    }
    // Always route via background hybrid handler for reliability
    chrome.runtime.sendMessage({
      action: 'handleBulkSendHybrid',
      emails: emails,
      startTime: startTime,
      delay: delay
    }, (response) => {
    if (chrome.runtime.lastError) {
      const error = chrome.runtime.lastError.message;
      if (error.includes('Extension context invalidated') || error.includes('message port closed')) {
        alert('Extension was reloaded. Please refresh this page and try again.');
        window.location.reload();
        return;
      }
      alert('Error sending message: ' + error);
      return;
    }

    if (!response) {
      alert('No response from extension. Please check if the extension is running.');
      return;
    }

    if (response.error || !response.success) {
      alert('Error: ' + (response.error || 'Unknown error'));
    } else {
      // Close the modal overlay
      const modal = document.querySelector('.aem-bulk-modal-overlay');
      if (modal) {
        modal.remove();
      }
    }
    });
  });
}

// Show analytics modal
function showAnalyticsModal() {
  chrome.storage.local.get(['trackedEmails', 'emailStats', 'emailReplies'], (result) => {
    const trackedEmails = result.trackedEmails || [];
    const stats = result.emailStats || { sentToday: 0 };
    const replies = result.emailReplies || [];
    
    const modal = document.createElement('div');
    modal.id = 'aem-analytics-modal';
    modal.classList.add('aem-theme-luxe');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 1000000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `;
    
    // Calculate analytics
    const totalSent = replies.length;
    const openedCount = trackedEmails.filter(e => e.opened).length;
    const clickedCount = trackedEmails.filter(e => e.linkClicks && e.linkClicks.length > 0).length;
    const repliedCount = replies.filter(r => r.hasReplied).length;
    
    const openRate = totalSent > 0 ? ((openedCount / totalSent) * 100).toFixed(1) : 0;
    const clickRate = totalSent > 0 ? ((clickedCount / totalSent) * 100).toFixed(1) : 0;
    const replyRate = totalSent > 0 ? ((repliedCount / totalSent) * 100).toFixed(1) : 0;
    
    modal.innerHTML = `
      <div style="background: white; border-radius: 8px; max-width: 900px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">
        <div style="padding: 24px; border-bottom: 1px solid #dadce0;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h2 style="margin: 0; font-size: 24px; color: #202124; font-weight: 400;">📊 Email Analytics</h2>
              <p style="margin: 8px 0 0 0; color: #5f6368; font-size: 14px;">Track opens, clicks, and replies</p>
            </div>
            <button id="close-analytics" style="background: #dadce0; color: #202124; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-size: 14px;">Close</button>
          </div>
        </div>
        
        <div style="padding: 24px;">
          <!-- Key Metrics -->
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px;">
            <div style="background: #e8f0fe; padding: 20px; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: 600; color: #1a73e8;">${totalSent}</div>
              <div style="font-size: 13px; color: #5f6368; margin-top: 8px;">Total Sent</div>
            </div>
            <div style="background: #e8f5e9; padding: 20px; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: 600; color: #34a853;">${openedCount}</div>
              <div style="font-size: 13px; color: #5f6368; margin-top: 8px;">Opened (${openRate}%)</div>
            </div>
            <div style="background: #fef7e0; padding: 20px; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: 600; color: #ea8600;">${clickedCount}</div>
              <div style="font-size: 13px; color: #5f6368; margin-top: 8px;">Link Clicks (${clickRate}%)</div>
            </div>
            <div style="background: #e8f0fe; padding: 20px; border-radius: 8px; text-align: center;">
              <div style="font-size: 32px; font-weight: 600; color: #1a73e8;">${repliedCount}</div>
              <div style="font-size: 13px; color: #5f6368; margin-top: 8px;">Replied (${replyRate}%)</div>
            </div>
          </div>
          
          <!-- Quick Stats Row -->
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #1a73e8;">
              <div style="font-size: 14px; color: #5f6368; margin-bottom: 4px;">Active Campaigns</div>
              <div style="font-size: 24px; font-weight: 600; color: #202124;">${stats.activeBulkCampaigns || 0}</div>
            </div>
            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #34a853;">
              <div style="font-size: 14px; color: #5f6368; margin-bottom: 4px;">Pending Scheduled</div>
              <div style="font-size: 24px; font-weight: 600; color: #202124;">${stats.scheduledEmails || 0}</div>
            </div>
            <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; border-left: 4px solid #ea8600;">
              <div style="font-size: 14px; color: #5f6368; margin-bottom: 4px;">Sent Today</div>
              <div style="font-size: 24px; font-weight: 600; color: #202124;">${stats.sentToday || 0}</div>
            </div>
          </div>
          
          <!-- Engagement Chart Placeholder -->
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 24px; text-align: center;">
            <div style="font-size: 14px; color: #5f6368; margin-bottom: 8px;">Engagement Overview</div>
            <div style="display: flex; justify-content: center; align-items: end; gap: 12px; height: 120px;">
              <div style="flex: 1; background: #dadce0; border-radius: 4px 4px 0 0; position: relative; min-width: 40px;">
                <div style="position: absolute; bottom: 0; left: 0; right: 0; background: #1a73e8; height: ${openRate}%; border-radius: 4px 4px 0 0;"></div>
                <div style="position: absolute; top: -20px; left: 0; right: 0; text-align: center; font-size: 11px; font-weight: 600;">${openRate}%</div>
                <div style="position: absolute; bottom: -25px; left: 0; right: 0; text-align: center; font-size: 11px; color: #5f6368;">Opens</div>
              </div>
              <div style="flex: 1; background: #dadce0; border-radius: 4px 4px 0 0; position: relative; min-width: 40px;">
                <div style="position: absolute; bottom: 0; left: 0; right: 0; background: #ea8600; height: ${clickRate}%; border-radius: 4px 4px 0 0;"></div>
                <div style="position: absolute; top: -20px; left: 0; right: 0; text-align: center; font-size: 11px; font-weight: 600;">${clickRate}%</div>
                <div style="position: absolute; bottom: -25px; left: 0; right: 0; text-align: center; font-size: 11px; color: #5f6368;">Clicks</div>
              </div>
              <div style="flex: 1; background: #dadce0; border-radius: 4px 4px 0 0; position: relative; min-width: 40px;">
                <div style="position: absolute; bottom: 0; left: 0; right: 0; background: #34a853; height: ${replyRate}%; border-radius: 4px 4px 0 0;"></div>
                <div style="position: absolute; top: -20px; left: 0; right: 0; text-align: center; font-size: 11px; font-weight: 600;">${replyRate}%</div>
                <div style="position: absolute; bottom: -25px; left: 0; right: 0; text-align: center; font-size: 11px; color: #5f6368;">Replies</div>
              </div>
            </div>
          </div>
          
          <!-- Tracked Emails List -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h3 style="margin: 0; font-size: 18px; color: #202124;">Recent Tracked Emails</h3>
            <div style="display: flex; gap: 8px;">
              <button id="export-csv" style="background: #1a73e8; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Export CSV</button>
              <button id="clear-analytics" style="background: #ea4335; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;">Clear Data</button>
            </div>
          </div>
          <div style="max-height: 400px; overflow-y: auto;">
            ${trackedEmails.slice(0, 20).map(email => `
              <div style="border: 1px solid #dadce0; padding: 16px; margin-bottom: 12px; border-radius: 8px; background: white;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                  <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">Email #${email.id}</div>
                    <div style="font-size: 12px; color: #5f6368;">
                      Opened: ${email.opened ? '✓ ' + email.openedCount + ' times' : '✗ Not opened'}
                    </div>
                  </div>
                  <div style="display: flex; gap: 8px;">
                    ${email.opened ? '<span style="color: #34a853; font-size: 12px; font-weight: 600;">✓ Open</span>' : ''}
                    ${email.linkClicks && email.linkClicks.length > 0 ? `<span style="color: #ea8600; font-size: 12px; font-weight: 600;">🔗 ${email.linkClicks.length} clicks</span>` : ''}
                  </div>
                </div>
                ${email.linkClicks && email.linkClicks.length > 0 ? `
                  <div style="background: #f8f9fa; padding: 8px; border-radius: 4px; margin-top: 8px;">
                    <div style="font-size: 11px; color: #5f6368; margin-bottom: 4px;">Link Clicks:</div>
                    ${email.linkClicks.map(click => `
                      <div style="font-size: 11px; color: #666;">→ ${click.url.substring(0, 40)}...</div>
                    `).join('')}
                  </div>
                ` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('#close-analytics').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  });
}

// Show recipient picker
function showRecipientPicker(composeContainer) {
  chrome.storage.local.get(['emailReplies', 'trackedEmails'], (result) => {
    const replies = result.emailReplies || [];
    const tracked = result.trackedEmails || [];
    
    const modal = document.createElement('div');
    modal.id = 'aem-recipient-picker';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 1000000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `;
    
    // Extract unique recipients
    const recipients = [...new Set(replies.map(r => r.to).filter(Boolean))];
    
    modal.innerHTML = `
      <div style="background: white; border-radius: 8px; max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">
        <div style="padding: 24px; border-bottom: 1px solid #dadce0; position: sticky; top: 0; background: white; z-index: 10;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h2 style="margin: 0; font-size: 24px; color: #202124; font-weight: 400;">👥 Pick Recipients</h2>
              <p style="margin: 8px 0 0 0; color: #5f6368; font-size: 14px;">Select emails to send to</p>
            </div>
            <button id="close-recipient-picker" style="background: #dadce0; color: #202124; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-size: 14px;">Close</button>
          </div>
          
          <div style="margin-top: 16px;">
            <input type="text" id="recipient-search" placeholder="Search recipients..." style="width: 100%; padding: 10px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px;">
          </div>
          
          <div style="margin-top: 12px; display: flex; gap: 8px;">
            <button id="select-all" style="background: #1a73e8; color: white; border: none; padding: 6px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">Select All</button>
            <button id="deselect-all" style="background: #dadce0; color: #202124; border: none; padding: 6px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">Deselect All</button>
            <span style="margin-left: auto; font-size: 13px; color: #5f6368; line-height: 30px;">
              <span id="selected-count">0</span> selected
            </span>
          </div>
        </div>
        
        <div style="padding: 24px;">
          <div id="recipient-list">
            ${recipients.map(email => {
              const emailData = replies.find(r => r.to === email);
              const isOpened = tracked.find(t => t.id === emailData?.id)?.opened;
              const hasReplied = emailData?.hasReplied;
              
              return `
                <label style="display: block; padding: 12px; border: 1px solid #dadce0; border-radius: 4px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s;" class="recipient-item">
                  <div style="display: flex; align-items: center; gap: 12px;">
                    <input type="checkbox" class="recipient-checkbox" value="${email}" style="width: 18px; height: 18px; cursor: pointer;">
                    <div style="flex: 1;">
                      <div style="font-weight: 500; font-size: 14px; color: #202124;">${email}</div>
                      <div style="font-size: 12px; color: #5f6368; margin-top: 2px;">
                        ${hasReplied ? '<span style="color: #34a853;">✓ Replied</span>' : ''}
                        ${isOpened ? '<span style="color: #1a73e8;">✓ Opened</span>' : '<span style="color: #ea4335;">✗ Not opened</span>'}
                      </div>
                    </div>
                  </div>
                </label>
              `;
            }).join('')}
          </div>
        </div>
        
        <div style="padding: 16px 24px; border-top: 1px solid #dadce0; display: flex; justify-content: flex-end; gap: 12px; position: sticky; bottom: 0; background: white;">
          <button id="cancel-recipient-picker" style="background: transparent; border: 1px solid #dadce0; color: #202124; padding: 10px 24px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">Cancel</button>
          <button id="add-recipients" style="background: #9c27b0; color: white; border: none; padding: 10px 24px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">Add Selected</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close handlers
    modal.querySelector('#close-recipient-picker').addEventListener('click', () => modal.remove());
    modal.querySelector('#cancel-recipient-picker').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    
    // Select/Deselect All
    modal.querySelector('#select-all').addEventListener('click', () => {
      modal.querySelectorAll('.recipient-checkbox').forEach(cb => cb.checked = true);
      updateSelectedCount();
    });
    
    modal.querySelector('#deselect-all').addEventListener('click', () => {
      modal.querySelectorAll('.recipient-checkbox').forEach(cb => cb.checked = false);
      updateSelectedCount();
    });
    
    // Search
    modal.querySelector('#recipient-search').addEventListener('input', (e) => {
      const search = e.target.value.toLowerCase();
      modal.querySelectorAll('.recipient-item').forEach(item => {
        const email = item.querySelector('.recipient-checkbox').value;
        if (email.toLowerCase().includes(search)) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
    
    // Update count
    function updateSelectedCount() {
      const count = modal.querySelectorAll('.recipient-checkbox:checked').length;
      modal.querySelector('#selected-count').textContent = count;
    }
    
    modal.querySelectorAll('.recipient-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', updateSelectedCount);
    });
    
    // Add to compose
    modal.querySelector('#add-recipients').addEventListener('click', () => {
      const selected = Array.from(modal.querySelectorAll('.recipient-checkbox:checked'))
        .map(cb => cb.value);
      
      if (selected.length === 0) {
        alert('Please select at least one recipient');
        return;
      }
      
      // Find Gmail's To field and add recipients
      const toField = composeContainer.querySelector('[name="to"]') || 
                      composeContainer.querySelector('input[aria-label*="To"]');
      
      if (toField) {
        const currentValue = toField.value || '';
        const currentRecipients = currentValue.split(',').map(r => r.trim()).filter(Boolean);
        const allRecipients = [...new Set([...currentRecipients, ...selected])];
        toField.value = allRecipients.join(', ');
        
        // Trigger input event for Gmail
        toField.dispatchEvent(new Event('input', { bubbles: true }));
        toField.dispatchEvent(new Event('change', { bubbles: true }));
      }
      
      modal.remove();
      
      // Show notification
      chrome.runtime.sendMessage({
        action: 'showNotification',
        title: 'Recipients Added',
        message: `Added ${selected.length} recipient(s) to compose`
      });
    });
  });
}

// Show CSV import modal
function showCSVImportModal(composeContainer) {
  const modal = document.createElement('div');
  modal.id = 'aem-csv-import';
  modal.classList.add('aem-theme-luxe');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 1000000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;
  
  modal.innerHTML = `
    <div style="background: white; border-radius: 8px; max-width: 600px; width: 100%; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">
      <div style="padding: 24px; border-bottom: 1px solid #dadce0;">
        <h2 style="margin: 0; font-size: 24px; color: #202124; font-weight: 400;">📄 Import Recipients from CSV</h2>
        <p style="margin: 8px 0 0 0; color: #5f6368; font-size: 14px;">Upload a CSV file with email addresses</p>
      </div>
      
      <div style="padding: 24px;">
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
          <div style="font-size: 13px; font-weight: 500; color: #202124; margin-bottom: 8px;">CSV Format Example:</div>
          <code style="background: white; padding: 8px; border-radius: 4px; display: block; font-size: 11px; color: #666;">
            email,name<br>
            john@example.com,John Doe<br>
            jane@example.com,Jane Smith
          </code>
        </div>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 13px; font-weight: 500; color: #202124; margin-bottom: 8px;">Upload CSV File</label>
          <input type="file" id="csv-file-input" accept=".csv,.txt" style="width: 100%; padding: 8px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px;">
        </div>
        
        <div style="background: #e8f0fe; padding: 12px; border-radius: 6px; display: none;" id="csv-preview-box">
          <div style="font-size: 13px; font-weight: 500; color: #1a73e8; margin-bottom: 8px;">📊 Preview (<span id="csv-count">0</span> recipients)</div>
          <div style="font-size: 12px; color: #666; max-height: 150px; overflow-y: auto;" id="csv-preview-content"></div>
        </div>
      </div>
      
      <div style="padding: 16px 24px; border-top: 1px solid #dadce0; display: flex; justify-content: flex-end; gap: 12px;">
        <button id="cancel-csv" style="background: transparent; border: 1px solid #dadce0; color: #202124; padding: 10px 24px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">Cancel</button>
        <button id="import-csv" style="background: #ff9800; color: white; border: none; padding: 10px 24px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; opacity: 0.5;" disabled>Import</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Close handlers
  modal.querySelector('#cancel-csv').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  let csvData = [];
  
  // File upload handler
  modal.querySelector('#csv-file-input').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      
      // Parse CSV
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        alert('CSV file must have at least 2 lines (header + data)');
        return;
      }
      
      const headers = lines[0].split(',').map(h => h.trim());
      const emailIndex = headers.findIndex(h => h.toLowerCase().includes('email'));
      
      if (emailIndex === -1) {
        alert('CSV must have an "email" column');
        return;
      }
      
      csvData = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim());
        return values[emailIndex];
      }).filter(email => email && email.includes('@'));
      
      // Show preview
      modal.querySelector('#csv-preview-box').style.display = 'block';
      modal.querySelector('#csv-count').textContent = csvData.length;
      modal.querySelector('#csv-preview-content').innerHTML = 
        csvData.slice(0, 10).map(email => `<div style="margin-bottom: 4px;">${email}</div>`).join('') +
        (csvData.length > 10 ? `<div style="color: #888; font-style: italic;">... and ${csvData.length - 10} more</div>` : '');
      
      // Enable import button
      modal.querySelector('#import-csv').style.opacity = '1';
      modal.querySelector('#import-csv').disabled = false;
    };
    
    reader.readAsText(file);
  });
  
  // Import button
  modal.querySelector('#import-csv').addEventListener('click', () => {
    if (csvData.length === 0) return;
    
    // Add to Gmail's To field
    const toField = composeContainer.querySelector('[name="to"]') || 
                    composeContainer.querySelector('input[aria-label*="To"]');
    
    if (toField) {
      const currentValue = toField.value || '';
      const currentRecipients = currentValue.split(',').map(r => r.trim()).filter(Boolean);
      const allRecipients = [...new Set([...currentRecipients, ...csvData])];
      toField.value = allRecipients.join(', ');
      
      // Trigger input event for Gmail
      toField.dispatchEvent(new Event('input', { bubbles: true }));
      toField.dispatchEvent(new Event('change', { bubbles: true }));
    }
    
    modal.remove();
    
    // Show notification
    chrome.runtime.sendMessage({
      action: 'showNotification',
      title: 'CSV Imported',
      message: `Added ${csvData.length} recipient(s) from CSV`
    });
  });
}

// Show templates modal
function showTemplatesModal(composeContainer) {
  chrome.storage.local.get('templates', (result) => {
    const templates = result.templates || [];
    
    const modal = document.createElement('div');
    modal.id = 'aem-templates-modal';
    modal.classList.add('aem-theme-luxe');
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 1000000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `;
    
    modal.innerHTML = `
      <div style="background: white; border-radius: 8px; max-width: 900px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">
        <div style="padding: 24px; border-bottom: 1px solid #dadce0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div>
              <h2 style="margin: 0; font-size: 24px; color: #202124; font-weight: 400;">📝 Email Templates</h2>
              <p style="margin: 8px 0 0 0; color: #5f6368; font-size: 14px;">Use saved templates or generate with AI</p>
            </div>
            <button id="close-templates" style="background: #dadce0; color: #202124; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-size: 14px;">Close</button>
          </div>
          
          <div style="display: flex; gap: 8px;">
            <button id="new-template" style="background: #00bcd4; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 500;">+ New Template</button>
            <button id="generate-ai" style="background: #9c27b0; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 500;">✨ Generate with AI</button>
          </div>
        </div>
        
        <div style="padding: 24px;">
          ${templates.length === 0 ? `
            <div style="text-align: center; padding: 60px 20px; color: #666;">
              <div style="font-size: 64px; margin-bottom: 16px;">📝</div>
              <h3 style="margin: 0 0 8px 0; font-size: 18px; color: #202124;">No templates yet</h3>
              <p>Create templates for common emails or use AI to generate new ones!</p>
            </div>
          ` : `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
              ${templates.map((template, index) => `
                <div style="border: 1px solid #dadce0; padding: 16px; border-radius: 8px; cursor: pointer; transition: all 0.2s; hover:shadow" class="template-card" data-index="${index}">
                  <div style="font-weight: 600; font-size: 15px; color: #202124; margin-bottom: 8px;">${template.name}</div>
                  <div style="font-size: 12px; color: #5f6368; margin-bottom: 8px;">${template.subject || 'No subject'}</div>
                  <div style="font-size: 11px; color: #888; max-height: 60px; overflow: hidden; text-overflow: ellipsis;">${template.body.substring(0, 100)}...</div>
                  <div style="margin-top: 12px; display: flex; gap: 8px;">
                    <button class="use-template" data-index="${index}" style="background: #00bcd4; color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">Use</button>
                    <button class="delete-template" data-index="${index}" style="background: #ea4335; color: white; border: none; padding: 4px 12px; border-radius: 4px; cursor: pointer; font-size: 11px;">Delete</button>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close handler
    modal.querySelector('#close-templates').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    
    // New template button
    modal.querySelector('#new-template')?.addEventListener('click', () => {
      modal.remove();
      showNewTemplateModal(composeContainer);
    });
    
    // Generate with AI button
    modal.querySelector('#generate-ai')?.addEventListener('click', () => {
      modal.remove();
      showAIGenerateModal(composeContainer);
    });
    
    // Use template buttons
    modal.querySelectorAll('.use-template').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        useTemplate(templates[index], composeContainer);
        modal.remove();
      });
    });
    
    // Delete template buttons
    modal.querySelectorAll('.delete-template').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(e.target.dataset.index);
        if (confirm('Delete this template?')) {
          templates.splice(index, 1);
          chrome.storage.local.set({ templates }, () => {
            modal.remove();
            showTemplatesModal(composeContainer);
          });
        }
      });
    });
  });
}

// Show new template modal
function showNewTemplateModal(composeContainer) {
  const modal = document.createElement('div');
  modal.id = 'aem-new-template';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 1000000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;
  
  modal.innerHTML = `
    <div style="background: white; border-radius: 8px; max-width: 700px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">
      <div style="padding: 24px; border-bottom: 1px solid #dadce0;">
        <h2 style="margin: 0; font-size: 24px; color: #202124; font-weight: 400;">📝 Create New Template</h2>
      </div>
      
      <div style="padding: 24px;">
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 13px; font-weight: 500; color: #202124; margin-bottom: 8px;">Template Name</label>
          <input type="text" id="template-name" placeholder="e.g., Meeting Follow-up" style="width: 100%; padding: 10px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px;">
        </div>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 13px; font-weight: 500; color: #202124; margin-bottom: 8px;">Subject</label>
          <input type="text" id="template-subject" placeholder="Meeting follow-up" style="width: 100%; padding: 10px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px;">
        </div>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 13px; font-weight: 500; color: #202124; margin-bottom: 8px;">Message</label>
          <textarea id="template-body" rows="10" placeholder="Hi ${recipient_name},

I wanted to follow up on our meeting...

Best regards" style="width: 100%; padding: 10px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px; font-family: inherit;"></textarea>
          <div style="font-size: 11px; color: #5f6368; margin-top: 6px;">
            💡 Use variables: <code style="background: #e8eaed; padding: 2px 6px; border-radius: 3px;">\${recipient_name}</code>, <code style="background: #e8eaed; padding: 2px 6px; border-radius: 3px;">\${date}</code>
          </div>
        </div>
      </div>
      
      <div style="padding: 16px 24px; border-top: 1px solid #dadce0; display: flex; justify-content: flex-end; gap: 12px;">
        <button id="cancel-template" style="background: transparent; border: 1px solid #dadce0; color: #202124; padding: 10px 24px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">Cancel</button>
        <button id="save-template" style="background: #00bcd4; color: white; border: none; padding: 10px 24px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">Save Template</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('#cancel-template').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  modal.querySelector('#save-template').addEventListener('click', () => {
    const name = modal.querySelector('#template-name').value.trim();
    const subject = modal.querySelector('#template-subject').value.trim();
    const body = modal.querySelector('#template-body').value.trim();
    
    if (!name || !body) {
      alert('Please fill in name and message');
      return;
    }
    
    chrome.storage.local.get('templates', (result) => {
      const templates = result.templates || [];
      templates.push({ name, subject, body, createdAt: new Date().toISOString() });
      
      chrome.storage.local.set({ templates }, () => {
        modal.remove();
        showTemplatesModal(composeContainer);
      });
    });
  });
}

// Show AI generate modal
function showAIGenerateModal(composeContainer) {
  const modal = document.createElement('div');
  modal.id = 'aem-ai-generate';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 1000000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;
  
  modal.innerHTML = `
    <div style="background: white; border-radius: 8px; max-width: 600px; width: 100%; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">
      <div style="padding: 24px; border-bottom: 1px solid #dadce0;">
        <h2 style="margin: 0; font-size: 24px; color: #202124; font-weight: 400;">✨ Generate Template with AI</h2>
        <p style="margin: 8px 0 0 0; color: #5f6368; font-size: 13px;">Describe what you need, AI will create the template</p>
      </div>
      
      <div style="padding: 24px;">
        <div style="background: #e8f0fe; padding: 12px; border-radius: 6px; margin-bottom: 16px;">
          <div style="font-size: 12px; color: #1a73e8; font-weight: 500;">How it works:</div>
          <div style="font-size: 11px; color: #5f6368; margin-top: 4px;">
            You write a prompt like "Email to follow up on a sales call" and AI generates a complete email template for you!
          </div>
        </div>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 13px; font-weight: 500; color: #202124; margin-bottom: 8px;">What do you need?</label>
          <textarea id="ai-prompt" rows="4" placeholder="e.g., An email template to follow up after a sales meeting, asking if they're ready to move forward..." style="width: 100%; padding: 10px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px; font-family: inherit;"></textarea>
        </div>
        
        <div id="ai-result" style="display: none; margin-top: 16px;">
          <div style="font-size: 13px; font-weight: 500; color: #202124; margin-bottom: 8px;">Generated Template:</div>
          <div id="ai-template-content" style="background: #f8f9fa; padding: 16px; border-radius: 6px; font-size: 13px; color: #202124; max-height: 300px; overflow-y: auto;"></div>
        </div>
      </div>
      
      <div style="padding: 16px 24px; border-top: 1px solid #dadce0; display: flex; justify-content: flex-end; gap: 12px;">
        <button id="cancel-ai" style="background: transparent; border: 1px solid #dadce0; color: #202124; padding: 10px 24px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">Cancel</button>
        <button id="generate-ai-btn" style="background: #9c27b0; color: white; border: none; padding: 10px 24px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;">Generate</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  modal.querySelector('#cancel-ai').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  modal.querySelector('#generate-ai-btn').addEventListener('click', async () => {
    const prompt = modal.querySelector('#ai-prompt').value.trim();
    const generateBtn = modal.querySelector('#generate-ai-btn');
    
    if (!prompt) {
      alert('Please describe what you need');
      return;
    }
    
    // Show loading state
    const originalText = generateBtn.textContent;
    generateBtn.textContent = '🔄 Generating...';
    generateBtn.disabled = true;
    
    try {
      // Generate template using AI
      const generated = await generateAITemplateWithAPI(prompt);
      
      if (!generated) {
        throw new Error('Failed to generate template');
      }
      
      modal.querySelector('#ai-result').style.display = 'block';
      modal.querySelector('#ai-template-content').textContent = generated;
      
      // Reset button
      generateBtn.textContent = originalText;
      generateBtn.disabled = false;
      
      // Add save button if not exists
      if (!document.getElementById('save-ai-template')) {
        const saveBtn = document.createElement('button');
        saveBtn.id = 'save-ai-template';
        saveBtn.style.cssText = 'background: #00bcd4; color: white; border: none; padding: 10px 24px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500;';
        saveBtn.textContent = 'Save Template';
        
        const resultBox = modal.querySelector('#ai-result');
        const btnContainer = document.createElement('div');
        btnContainer.style.cssText = 'display: flex; justify-content: flex-end; gap: 12px; margin-top: 12px;';
        btnContainer.appendChild(saveBtn);
        resultBox.appendChild(btnContainer);
        
        saveBtn.addEventListener('click', () => {
          const name = prompt('Template name?', prompt.substring(0, 30));
          if (name) {
            chrome.storage.local.get('templates', (result) => {
              const templates = result.templates || [];
              const subject = extractSubject(generated);
              const body = generated;
              templates.push({ name, subject, body, createdAt: new Date().toISOString(), aiGenerated: true });
              chrome.storage.local.set({ templates }, () => {
                modal.remove();
                showTemplatesModal(composeContainer);
              });
            });
          }
        });
      }
    } catch (error) {
      console.error('AI generation error:', error);
      generateBtn.textContent = originalText;
      generateBtn.disabled = false;
      alert('Failed to generate template. Please try again or use manual creation.');
    }
  });
}

// Generate AI template using free open-source AI API
async function generateAITemplateWithAPI(prompt) {
  try {
    // Use Hugging Face Inference API (free, no API key needed for basic use)
    // Model: microsoft/DialoGPT-medium for conversation, or use text generation models
    
    // Enhanced prompt for email template generation
    const enhancedPrompt = `Generate a professional email template based on this request: "${prompt}". 
Make it concise, professional, and ready to use. Include placeholder variables like {{name}} where appropriate. 
Format: Subject line first, then message body.`;
    
    // Option 1: Use Hugging Face Inference API (no key needed, but rate limited)
    const response = await fetch('https://api-inference.huggingface.co/models/gpt2', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        inputs: enhancedPrompt,
        parameters: {
          max_length: 200,
          temperature: 0.7,
          return_full_text: false
        }
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data[0] && data[0].generated_text) {
        return data[0].generated_text.trim();
      }
    }
    
    // If Hugging Face fails, use fallback intelligent template generator
    return generateIntelligentTemplate(prompt);
    
  } catch (error) {
    console.error('AI API error:', error);
    // Fallback to intelligent template generator
    return generateIntelligentTemplate(prompt);
  }
}

// Intelligent template generator with pattern matching and context understanding
function generateIntelligentTemplate(prompt) {
  const lowerPrompt = prompt.toLowerCase();
  
  // Smart pattern detection for common email types
  let template = '';
  let subject = '';
  
  // Follow-up emails
  if (lowerPrompt.includes('follow') || lowerPrompt.includes('reminder') || lowerPrompt.includes('haven\'t heard')) {
    subject = 'Following up on my previous email';
    template = `Hi {{name}},

I wanted to follow up on my previous email about {{topic}}. I understand you're busy, but I'd love to hear your thoughts.

Let me know if you need any clarification or have questions.

Best regards,
Your Name`;
  }
  // Sales/outreach emails  
  else if (lowerPrompt.includes('sales') || lowerPrompt.includes('pitch') || lowerPrompt.includes('product') || lowerPrompt.includes('service')) {
    subject = 'Quick question about {{company_name}}';
    template = `Hi {{name}},

I noticed {{company_name}} is in the {{industry}} space. We help companies like yours with {{value_proposition}}.

Would you be open to a brief conversation about how we might help?

Best regards,
Your Name`;
  }
  // Meeting request emails
  else if (lowerPrompt.includes('meeting') || lowerPrompt.includes('call') || lowerPrompt.includes('schedule')) {
    subject = 'Quick meeting request';
    template = `Hi {{name}},

I'd love to schedule a quick {{duration}} call to discuss {{topic}}.

Are you available this week? Here are some times that work for me:
- Monday at 2 PM
- Wednesday at 10 AM
- Friday at 3 PM

Let me know what works for you!

Best regards,
Your Name`;
  }
  // Thank you emails
  else if (lowerPrompt.includes('thank') || lowerPrompt.includes('appreciation') || lowerPrompt.includes('gratitude')) {
    subject = 'Thank you!';
    template = `Hi {{name}},

Thank you so much for {{action}}. I really appreciate it!

Looking forward to {{next_step}}.

Best regards,
Your Name`;
  }
  // General/personalized email
  else {
    subject = 'Quick update';
    template = `Hi {{name}},

I hope this email finds you well. I wanted to reach out about {{topic}}.

{{custom_content}}

Would love to hear your thoughts on this.

Best regards,
Your Name`;
  }
  
  return `Subject: ${subject}\n\n${template}`;
}

// Legacy placeholder function (keeping for backwards compatibility)
function generateAITemplate(prompt) {
  // This is a simple template generator - user can integrate real Gemini API
  const templates = {
    'follow up': `Hi ${recipient_name},

I wanted to follow up on our conversation. I hope everything is going well!

Let me know if you have any questions.

Best regards`,
    'sales': `Hi ${recipient_name},

I wanted to reach out about our proposal. Are you ready to move forward?

I'm happy to schedule a call if you'd like to discuss further.

Best regards`,
    'meeting': `Hi ${recipient_name},

I wanted to follow up on our meeting. It was great discussing [topic] with you.

Next steps would be...

Looking forward to hearing from you.

Best regards`
  };
  
  const lowerPrompt = prompt.toLowerCase();
  for (const [key, template] of Object.entries(templates)) {
    if (lowerPrompt.includes(key)) {
      return template;
    }
  }
  
  return `Hi ${recipient_name},

${prompt}

Best regards`;
}

function extractSubject(text) {
  const firstLine = text.split('\n')[0];
  return firstLine.length > 50 ? firstLine.substring(0, 50) + '...' : firstLine;
}

function useTemplate(template, composeContainer) {
  // Find Gmail's subject and body fields
  let subjectField = composeContainer.querySelector('[name="subjectbox"]');
  let bodyField = composeContainer.querySelector('[g_editable="true"][contenteditable="true"]');
  
  if (subjectField && template.subject) {
    subjectField.value = template.subject;
    subjectField.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  if (bodyField && template.body) {
    bodyField.innerHTML = template.body.replace(/\n/g, '<br>');
    bodyField.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  chrome.runtime.sendMessage({
    action: 'showNotification',
    title: 'Template Applied',
    message: `Loaded "${template.name}" template`
  });
}

// Close bulk modal
function closeBulkModal() {
  const modal = document.getElementById('aem-bulk-modal');
  if (modal) {
    modal.remove();
  }
}

// Show bulk operations panel
function showBulkOperations(composeContainer) {
  // Close existing modal if any
  const existing = document.getElementById('aem-bulk-operations');
  if (existing) {
    existing.remove();
    return;
  }
  
  chrome.storage.local.get(['emailReplies', 'trackedEmails'], (result) => {
    const replies = result.emailReplies || [];
    const tracked = result.trackedEmails || [];
    
    const modal = document.createElement('div');
    modal.id = 'aem-bulk-operations';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      z-index: 1000000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    `;
    
    // Extract unique recipients with engagement data
    const recipientMap = new Map();
    replies.forEach(r => {
      if (r.to && !recipientMap.has(r.to)) {
        const emailData = tracked.find(t => t.id === r.id);
        recipientMap.set(r.to, {
          to: r.to,
          subject: r.subject || 'No subject',
          hasReplied: r.hasReplied || false,
          opened: emailData?.opened || false,
          clicked: emailData?.linkClicks && emailData.linkClicks.length > 0
        });
      }
    });
    
    const recipients = Array.from(recipientMap.values());
    
    modal.innerHTML = `
      <div style="background: white; border-radius: 8px; max-width: 900px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">
        <div style="padding: 24px; border-bottom: 1px solid #dadce0; position: sticky; top: 0; background: white; z-index: 10;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h2 style="margin: 0; font-size: 24px; color: #202124; font-weight: 400;">⚡ Bulk Operations</h2>
              <p style="margin: 8px 0 0 0; color: #5f6368; font-size: 14px;">Multi-select recipients for bulk actions</p>
            </div>
            <button id="close-bulk-ops" style="background: #dadce0; color: #202124; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-size: 14px;">Close</button>
          </div>
          
          <div style="margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap;">
            <input type="text" id="bulk-ops-search" placeholder="Search..." style="flex: 1; min-width: 250px; padding: 10px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px;">
            
            <div style="display: flex; gap: 8px;">
              <select id="bulk-ops-filter" style="padding: 10px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px; cursor: pointer;">
                <option value="all">All Recipients</option>
                <option value="replied">Replied</option>
                <option value="not-replied">Not Replied</option>
                <option value="opened">Opened</option>
                <option value="clicked">Clicked Links</option>
                <option value="no-engagement">No Engagement</option>
              </select>
            </div>
          </div>
          
          <div style="margin-top: 16px; display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <button id="bulk-select-all" style="background: #1a73e8; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: 500;">Select All</button>
            <button id="bulk-deselect-all" style="background: #dadce0; color: #202124; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 13px;">Deselect All</button>
            
            <div style="flex: 1; text-align: right;">
              <span style="font-size: 14px; color: #5f6368; margin-right: 16px;">
                <strong id="bulk-selected-count">0</strong> selected
              </span>
              
              <span style="font-size: 14px; color: #5f6368;">
                Total: <strong>${recipients.length}</strong> recipients
              </span>
            </div>
          </div>
          
          <div style="margin-top: 16px; padding: 12px; background: #f8f9fa; border-radius: 6px;">
            <div style="font-size: 13px; font-weight: 500; margin-bottom: 8px; color: #202124;">Quick Actions:</div>
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button id="bulk-op-add-to" style="background: #1a73e8; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">Add to "To"</button>
              <button id="bulk-op-add-cc" style="background: #5f6368; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">Add to CC</button>
              <button id="bulk-op-add-bcc" style="background: #5f6368; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">Add to BCC</button>
              <button id="bulk-op-schedule" style="background: #fbbc04; color: #202124; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">Schedule for Selected</button>
              <button id="bulk-op-followup" style="background: #34a853; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: 500;">Create Follow-up</button>
            </div>
          </div>
        </div>
        
        <div style="padding: 24px;">
          <div id="bulk-ops-list">
            ${recipients.map((rec, idx) => `
              <label style="display: block; padding: 12px; border: 1px solid #dadce0; border-radius: 4px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s; background: white;" class="bulk-ops-item">
                <input type="checkbox" class="bulk-ops-checkbox" data-email="${rec.to}" style="margin-right: 12px; width: 18px; height: 18px; cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="flex: 1;">
                    <div style="font-weight: 500; font-size: 14px; color: #202124; margin-bottom: 4px;">${rec.to}</div>
                    <div style="font-size: 12px; color: #5f6368;">${rec.subject}</div>
                  </div>
                  <div style="display: flex; gap: 4px;">
                    ${rec.hasReplied ? '<span style="padding: 4px 8px; background: #e8f5e9; color: #137333; border-radius: 4px; font-size: 11px; font-weight: 500;">✓ Replied</span>' : ''}
                    ${rec.opened ? '<span style="padding: 4px 8px; background: #e3f2fd; color: #174ea6; border-radius: 4px; font-size: 11px; font-weight: 500;">👁 Opened</span>' : ''}
                    ${rec.clicked ? '<span style="padding: 4px 8px; background: #fff3e0; color: #b06000; border-radius: 4px; font-size: 11px; font-weight: 500;">🔗 Clicked</span>' : ''}
                    ${!rec.hasReplied && !rec.opened && !rec.clicked ? '<span style="padding: 4px 8px; background: #fce8e6; color: #c5221f; border-radius: 4px; font-size: 11px; font-weight: 500;">No engagement</span>' : ''}
                  </div>
                </div>
              </label>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Event listeners
    setTimeout(() => {
      // Close button
      document.getElementById('close-bulk-ops')?.addEventListener('click', () => modal.remove());
      
      // Modal background click
      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
      });
      
      // Checkbox change
      document.querySelectorAll('.bulk-ops-checkbox').forEach(cb => {
        cb.addEventListener('change', updateSelectedCount);
      });
      
      // Select/Deselect all
      document.getElementById('bulk-select-all')?.addEventListener('click', () => {
        document.querySelectorAll('.bulk-ops-checkbox').forEach(cb => cb.checked = true);
        updateSelectedCount();
      });
      
      document.getElementById('bulk-deselect-all')?.addEventListener('click', () => {
        document.querySelectorAll('.bulk-ops-checkbox').forEach(cb => cb.checked = false);
        updateSelectedCount();
      });
      
      // Search
      document.getElementById('bulk-ops-search')?.addEventListener('input', (e) => {
        const search = e.target.value.toLowerCase();
        document.querySelectorAll('.bulk-ops-item').forEach(item => {
          const text = item.textContent.toLowerCase();
          item.style.display = text.includes(search) ? 'block' : 'none';
        });
      });
      
      // Filter
      document.getElementById('bulk-ops-filter')?.addEventListener('change', (e) => {
        const filter = e.target.value;
        document.querySelectorAll('.bulk-ops-item').forEach(item => {
          const text = item.textContent.toLowerCase();
          let show = true;
          
          if (filter === 'replied' && !text.includes('replied')) show = false;
          else if (filter === 'not-replied' && text.includes('replied')) show = false;
          else if (filter === 'opened' && !text.includes('opened')) show = false;
          else if (filter === 'clicked' && !text.includes('clicked')) show = false;
          else if (filter === 'no-engagement' && !text.includes('no engagement')) show = false;
          
          item.style.display = show ? 'block' : 'none';
        });
      });
      
      // Bulk actions
      document.getElementById('bulk-op-add-to')?.addEventListener('click', () => executeBulkAction('to', composeContainer));
      document.getElementById('bulk-op-add-cc')?.addEventListener('click', () => executeBulkAction('cc', composeContainer));
      document.getElementById('bulk-op-add-bcc')?.addEventListener('click', () => executeBulkAction('bcc', composeContainer));
      document.getElementById('bulk-op-schedule')?.addEventListener('click', () => executeBulkAction('schedule', composeContainer));
      document.getElementById('bulk-op-followup')?.addEventListener('click', () => executeBulkAction('followup', composeContainer));
    }, 100);
    
    function updateSelectedCount() {
      const count = document.querySelectorAll('.bulk-ops-checkbox:checked').length;
      document.getElementById('bulk-selected-count').textContent = count;
    }
  });
}

// Show sheets preview in popup
function showSheetsPreviewPopup(data) {
  const modal = document.createElement('div');
  modal.id = 'aem-sheets-preview-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.6);
    z-index: 1000001;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    backdrop-filter: blur(4px);
  `;
  
  modal.innerHTML = `
    <div style="background: white; border-radius: 16px; max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.3);">
      <div style="padding: 24px; border-bottom: 1px solid #dadce0; position: sticky; top: 0; background: white; z-index: 10;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <h2 style="margin: 0; font-size: 22px; color: #202124; font-weight: 600;">📊 Sheet Preview</h2>
            <p style="margin: 8px 0 0 0; color: #5f6368; font-size: 14px;">${data.length} recipients loaded successfully</p>
          </div>
          <button id="close-sheets-preview" style="background: #dadce0; color: #202124; border: none; padding: 8px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500;">Close</button>
        </div>
      </div>
      
      <div style="padding: 24px;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px; padding: 16px; background: linear-gradient(135deg, #e8f5e9, #c8e6c9); border-radius: 12px; border: 2px solid #34a853;">
          <span style="font-size: 32px;">✅</span>
          <div style="flex: 1;">
            <div style="color: #137333; font-weight: 700; font-size: 18px;">Sheet Loaded Successfully!</div>
            <div style="font-size: 14px; color: #5f6368; margin-top: 4px;">Ready to send ${data.length} personalized emails</div>
          </div>
        </div>
        
        <div style="background: #f8f9fa; padding: 16px; border-radius: 12px; margin-bottom: 20px;">
          <div style="font-size: 15px; color: #202124; font-weight: 600; margin-bottom: 12px;">📊 Available Columns</div>
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${Object.keys(data[0] || {}).map(col => `
              <span style="background: white; padding: 6px 12px; border-radius: 6px; border: 1px solid #dadce0; font-size: 13px; color: #202124; font-weight: 500;">
                ${col}
              </span>
            `).join('')}
          </div>
        </div>
        
        <div style="background: #e3f2fd; padding: 16px; border-radius: 12px; border-left: 4px solid #1a73e8; margin-bottom: 20px;">
          <div style="font-size: 14px; color: #1a73e8; font-weight: 600; margin-bottom: 8px;">💡 How to Use Variables</div>
          <div style="font-size: 13px; color: #202124;">
            In your email subject and body, use variables like <code style="background: white; padding: 4px 8px; border-radius: 4px; font-weight: 600; color: #1a73e8;">{{name}}</code>, 
            <code style="background: white; padding: 4px 8px; border-radius: 4px; font-weight: 600; color: #1a73e8;">{{email1}}</code>, or any column name from above.
            <br><br>
            Example: <code style="background: white; padding: 4px 8px; border-radius: 4px; font-family: monospace; color: #5f6368;">Hi {{name}}, thanks for your interest in {{company}}!</code>
          </div>
        </div>
        
        <div style="background: white; padding: 16px; border-radius: 12px; border: 1px solid #dadce0;">
          <div style="font-size: 15px; color: #202124; font-weight: 600; margin-bottom: 12px;">📋 First 5 Rows Preview</div>
          <div style="overflow-x: auto; max-height: 400px; overflow-y: auto;">
            <table style="width: 100%; border-collapse: collapse;">
              <thead style="background: #f1f3f4; position: sticky; top: 0;">
                <tr>
                  ${Object.keys(data[0] || {}).map(col => `
                    <th style="padding: 12px; text-align: left; border: 1px solid #dadce0; font-size: 13px; font-weight: 600; color: #202124;">
                      ${col}
                    </th>
                  `).join('')}
                </tr>
              </thead>
              <tbody>
                ${data.slice(0, 5).map((row, idx) => `
                  <tr style="background: ${idx % 2 === 0 ? 'white' : '#fafafa'};">
                    ${Object.values(row).map(val => `
                      <td style="padding: 10px; border: 1px solid #dadce0; font-size: 12px; color: #3c4043;">
                        ${val || '-'}
                      </td>
                    `).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${data.length > 5 ? `
              <div style="padding: 12px; text-align: center; color: #5f6368; font-size: 13px; font-style: italic;">
                ... and ${data.length - 5} more rows
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  setTimeout(() => {
    document.getElementById('close-sheets-preview')?.addEventListener('click', () => modal.remove());
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }, 100);
}

function executeBulkAction(action, composeContainer) {
  const selected = Array.from(document.querySelectorAll('.bulk-ops-checkbox:checked')).map(cb => cb.dataset.email);
  
  if (selected.length === 0) {
    alert('Please select at least one recipient');
    return;
  }
  
  const emails = selected.join(', ');
  
  if (action === 'to') {
    // Add to "To" field
    let toField = composeContainer.querySelector('[name="to"]');
    if (toField) {
      toField.value = (toField.value ? toField.value + ', ' : '') + emails;
      toField.dispatchEvent(new Event('input', { bubbles: true }));
    }
    alert(`✅ Added ${selected.length} recipients to "To" field`);
  } else if (action === 'cc') {
    // Add to CC field
    let ccField = composeContainer.querySelector('[name="cc"]');
    if (ccField) {
      ccField.value = (ccField.value ? ccField.value + ', ' : '') + emails;
      ccField.dispatchEvent(new Event('input', { bubbles: true }));
    }
    alert(`✅ Added ${selected.length} recipients to CC field`);
  } else if (action === 'bcc') {
    // Add to BCC field
    let bccField = composeContainer.querySelector('[name="bcc"]');
    if (bccField) {
      bccField.value = (bccField.value ? bccField.value + ', ' : '') + emails;
      bccField.dispatchEvent(new Event('input', { bubbles: true }));
    }
    alert(`✅ Added ${selected.length} recipients to BCC field`);
  } else if (action === 'schedule') {
    // Schedule for selected recipients
    alert(`📅 Scheduling for ${selected.length} recipients...\n\nThis feature will schedule separate sends for each recipient.`);
  } else if (action === 'followup') {
    // Create follow-up
    alert(`📨 Creating follow-up rules for ${selected.length} recipients...`);
  }
  
  // Close modal
  document.getElementById('aem-bulk-operations')?.remove();
}

// Show calendar view for scheduling
function showCalendarView(composeContainer) {
  // Close existing modal if any
  const existing = document.getElementById('aem-calendar-view');
  if (existing) {
    existing.remove();
    return;
  }
  
  const modal = document.createElement('div');
  modal.id = 'aem-calendar-view';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    z-index: 1000000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;
  
  // Get current month
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  // Generate calendar days
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  let calendarHTML = `
    <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; background: #dadce0;">
  `;
  
  // Add day headers
  dayNames.forEach(day => {
    calendarHTML += `<div style="background: #f8f9fa; padding: 8px; text-align: center; font-size: 11px; font-weight: 600; color: #5f6368;">${day}</div>`;
  });
  
  // Add empty cells for days before month starts
  for (let i = 0; i < startingDayOfWeek; i++) {
    calendarHTML += `<div style="background: white; padding: 4px;"></div>`;
  }
  
  // Add day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const isPast = new Date(dateStr) < new Date().setHours(0, 0, 0, 0);
    calendarHTML += `
      <div class="calendar-day" data-date="${dateStr}" style="background: white; padding: 8px; text-align: center; cursor: pointer; min-height: 40px; ${isPast ? 'opacity: 0.5;' : ''}">
        <div style="font-size: 13px; margin-bottom: 4px;">${day}</div>
        <div class="scheduled-count" style="font-size: 9px; color: #1a73e8; font-weight: 600;"></div>
      </div>
    `;
  }
  
  calendarHTML += `</div>`;
  
  modal.innerHTML = `
    <div style="background: white; border-radius: 8px; max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 8px 24px rgba(0,0,0,0.2);">
      <div style="padding: 24px; border-bottom: 1px solid #dadce0; position: sticky; top: 0; background: white; z-index: 10;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <div>
            <h2 style="margin: 0; font-size: 24px; color: #202124; font-weight: 400;">📅 Schedule Email</h2>
            <p style="margin: 8px 0 0 0; color: #5f6368; font-size: 14px;">Select date and time to schedule</p>
          </div>
          <button id="close-calendar" style="background: #dadce0; color: #202124; border: none; padding: 8px 20px; border-radius: 4px; cursor: pointer; font-size: 14px;">Close</button>
        </div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <button id="prev-month" style="background: #1a73e8; color: white; border: none; padding: 6px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">← Previous</button>
          <div style="font-size: 18px; font-weight: 600; color: #202124;">${monthNames[currentMonth]} ${currentYear}</div>
          <button id="next-month" style="background: #1a73e8; color: white; border: none; padding: 6px 16px; border-radius: 4px; cursor: pointer; font-size: 14px;">Next →</button>
        </div>
      </div>
      
      <div style="padding: 24px;">
        ${calendarHTML}
        
        <div style="margin-top: 24px; padding: 16px; background: #f8f9fa; border-radius: 8px;">
          <div style="font-size: 14px; font-weight: 600; color: #202124; margin-bottom: 12px;">Schedule Details</div>
          
          <div style="margin-bottom: 12px;">
            <label style="display: block; font-size: 12px; color: #5f6368; margin-bottom: 4px;">Selected Date:</label>
            <input type="date" id="selected-date" style="width: 100%; padding: 8px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px;">
          </div>
          
          <div style="margin-bottom: 12px;">
            <label style="display: block; font-size: 12px; color: #5f6368; margin-bottom: 4px;">Time:</label>
            <input type="time" id="selected-time" style="width: 100%; padding: 8px; border: 1px solid #dadce0; border-radius: 4px; font-size: 14px;">
          </div>
          
          <button id="confirm-schedule" style="background: #34a853; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 500; width: 100%;">Schedule Email</button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  setTimeout(() => {
    document.getElementById('close-calendar')?.addEventListener('click', () => modal.remove());
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
    
    // Day selection
    document.querySelectorAll('.calendar-day').forEach(day => {
      day.addEventListener('click', () => {
        const date = day.dataset.date;
        const isPast = new Date(date) < new Date().setHours(0, 0, 0, 0);
        if (isPast) return;
        
        // Update selected date
        document.getElementById('selected-date').value = date;
        
        // Highlight selected day
        document.querySelectorAll('.calendar-day').forEach(d => d.style.border = 'none');
        day.style.border = '2px solid #1a73e8';
        
        // Set default time to now if date is today, else 9 AM
        const selectedDate = new Date(date);
        const today = new Date().setHours(0, 0, 0, 0);
        const timeInput = document.getElementById('selected-time');
        
        if (selectedDate.getTime() === today) {
          const now = new Date();
          timeInput.value = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        } else {
          timeInput.value = '09:00';
        }
      });
    });
    
    // Confirm schedule
    document.getElementById('confirm-schedule')?.addEventListener('click', () => {
      const date = document.getElementById('selected-date').value;
      const time = document.getElementById('selected-time').value;
      
      if (!date || !time) {
        alert('Please select a date and time');
        return;
      }
      
      const scheduledDateTime = new Date(`${date}T${time}`).toISOString();
      
      chrome.runtime.sendMessage({
        action: 'scheduleEmail',
        email: {
          to: composeContainer.querySelector('[name="to"]')?.value || '',
          subject: composeContainer.querySelector('[name="subjectbox"]')?.value || '',
          body: composeContainer.querySelector('[g_editable="true"][contenteditable="true"]')?.textContent || '',
          scheduledFor: scheduledDateTime
        }
      }, (response) => {
        if (response.success) {
          alert(`✅ Email scheduled for ${new Date(scheduledDateTime).toLocaleString()}`);
          modal.remove();
        } else {
          alert('Error scheduling email');
        }
      });
    });
  }, 100);
}

// Initialize when DOM is ready
console.log('TaskForce Email Manager: Waiting for DOM...');

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('TaskForce Email Manager: DOM loaded');
    injectEmailManagerUI();
  });
} else {
  console.log('TaskForce Email Manager: DOM already ready');
  injectEmailManagerUI();
}

// Also inject after page load (for SPA navigation)
window.addEventListener('load', () => {
  console.log('TaskForce Email Manager: Page loaded');
  setTimeout(injectEmailManagerUI, 1000);
});

// Handle Gmail SPA navigation (Gmail uses AJAX for navigation)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    console.log('TaskForce Email Manager: Page navigated to:', url);
    setTimeout(injectEmailManagerUI, 1500);
  }
}).observe(document, { subtree: true, childList: true });

console.log('TaskForce Email Manager: Initialization complete');
