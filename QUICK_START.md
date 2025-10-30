# 🚀 Quick Start Guide - TaskForce Email Manager

## Installation (2 minutes)

1. **Open Chrome Extensions**
   ```
   chrome://extensions/
   ```

2. **Enable Developer Mode** (top-right toggle)

3. **Click "Load unpacked"**

4. **Select this folder**: `E:\TASKFORCE`

5. **Done!** Extension is installed ✅

## First Use (1 minute)

1. **Click extension icon** in Chrome toolbar
2. **Click "Not Connected"** to authenticate
3. **Grant Gmail permissions**
4. **You're ready!** 🎉

## Try It Out

### 📅 Schedule Your First Email

1. Open Gmail
2. Click "Compose"
3. Write an email
4. Look for **"Schedule" button** in compose window
5. Pick a time and click "Schedule"

### 📧 Bulk Send Emails

1. Click extension icon → **"Settings"**
2. Go to **"Templates"** tab → Create a template
3. Go to **"Bulk Send"** tab → Select template
4. Enter email addresses (one per line or comma-separated)
5. Click **"Send Bulk"**

### 🔄 Set Up Auto Follow-up

1. Go to extension Settings → **"Auto Follow-up"** tab
2. Create a rule (name, template, days to wait)
3. Go to **"Settings"** tab → Enable auto follow-up
4. Extension will automatically follow up!

## File Structure

```
E:\TASKFORCE\
├── manifest.json          # Extension config (✅ client ID configured)
├── background.js          # Scheduler & automation
├── content.js            # Gmail UI injection
├── popup.html/js         # Extension popup
├── options.html/js       # Settings page
├── styles.css            # UI styling
├── icons/                # Extension icons (✅ created)
└── README files
```

## Features Enabled

| Feature | Status | Description |
|---------|--------|-------------|
| Email Scheduling | ✅ | Send emails at specific times |
| Recurring Emails | ✅ | Daily, weekly, monthly |
| Bulk Sending | ✅ | Send to multiple recipients |
| Templates | ✅ | Reusable email templates |
| Auto Follow-up | ✅ | Automatic follow-up emails |
| Daily Limits | ✅ | Max 500 emails/day (configurable) |
| Rate Limiting | ✅ | Prevents API throttling |
| Stats Tracking | ✅ | Monitor emails sent |

## Settings

Default configuration:
- **Max Daily Send**: 500 emails
- **Bulk Delay**: 1000ms (1 second)
- **Follow-up Check**: Every 6 hours

Modify in: Extension popup → Settings

## Troubleshooting

**Schedule button not showing?**
→ Refresh Gmail page (Ctrl+R)

**Not sending emails?**
→ Check connection status in popup

**Need to see logs?**
→ `chrome://extensions/` → Click "service worker" link

## Support

📖 Full documentation: See `README.md` and `INSTALL_INSTRUCTIONS.md`

## Your Credentials (Already Configured)

✅ **Client ID**: `1007595181381-dd7o4v4jh01b1pcar6a681hj6pmjdsnp.apps.googleusercontent.com`  
✅ **Project**: `taskforce-mailer-v2`  
✅ **Gmail API**: Enabled  

**You're all set! Start scheduling emails! 📧**



