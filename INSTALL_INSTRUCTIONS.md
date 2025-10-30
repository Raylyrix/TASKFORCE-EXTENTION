# TaskForce Email Manager - Installation Instructions

## ✅ Your Extension is Ready!

Your client ID has been configured: `1007595181381-dd7o4v4jh01b1pcar6a681hj6pmjdsnp.apps.googleusercontent.com`

## Quick Start

### 1. Load Extension in Chrome

1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Enable **"Developer mode"** (toggle in top-right corner)
4. Click **"Load unpacked"**
5. Select the `E:\TASKFORCE` folder
6. Extension will appear in your list

### 2. Authenticate with Gmail

1. Click the extension icon in the Chrome toolbar
2. You'll see "Not Connected" status
3. Click it to authenticate
4. Grant Gmail permissions when prompted
5. You're now connected!

### 3. Start Using Features

#### Schedule an Email:
1. Open Gmail in a new tab
2. Click "Compose"
3. Write your email
4. Look for the **"Schedule"** button (appears in compose toolbar)
5. Pick date/time and click "Schedule"

#### Bulk Send:
1. Click extension icon
2. Go to "Settings" (or use options page)
3. Create templates in "Templates" tab
4. Use "Bulk Send" tab to send to multiple recipients

#### Auto Follow-up:
1. Go to settings
2. Set up follow-up rules
3. Enable auto follow-up
4. Extension will automatically follow up on emails

## 📋 Features Enabled

✅ **Email Scheduling** - Send emails at specific times  
✅ **Recurring Emails** - Daily, weekly, monthly options  
✅ **Bulk Sending** - Send to multiple recipients  
✅ **Email Templates** - Reusable email templates  
✅ **Auto Follow-up** - Automatic follow-up system  
✅ **Daily Limits** - Configurable sending limits (max 500/day)  
✅ **Rate Limiting** - Prevents API throttling  
✅ **Stats Tracking** - Monitor emails sent  

## 🔧 Configuration

Your extension uses these default settings:
- **Max Daily Send**: 500 emails
- **Bulk Send Delay**: 1000ms (1 second between emails)
- **Auto Follow-up Check**: Every 6 hours

You can modify these in the Settings tab of the options page.

## 🐛 Troubleshooting

### "Invalid client ID" error:
- Your client ID is already configured in manifest.json
- Make sure Gmail API is enabled in Google Cloud Console
- Check that OAuth consent screen is configured

### "Not Connected" status:
- Click the extension icon
- Click "Not Connected" to authenticate
- Grant all requested permissions

### Schedule button not showing in Gmail:
1. Refresh the Gmail page (Ctrl+R)
2. Check if extension is enabled in chrome://extensions/
3. Open browser console (F12) to see error messages

### Emails not sending:
- Check if you're authenticated (popup should show "Connected")
- Verify Gmail API is enabled in Google Cloud Console
- Check background script console in chrome://extensions/

## 📊 Viewing Logs

**Extension logs:**
1. Go to `chrome://extensions/`
2. Find "TaskForce Email Manager"
3. Click "service worker" or "background page" link
4. Console will show all logs

**Gmail page logs:**
1. Open Gmail
2. Press F12 (developer tools)
3. Check Console tab for any errors

## 🔒 Security Notes

- ✅ All OAuth tokens stored securely by Chrome
- ✅ No external servers - everything runs locally
- ✅ Your email data stays in your browser
- ✅ No tracking or analytics

## 🚀 Next Steps

1. **Create templates** for common emails
2. **Set up follow-up rules** for important conversations
3. **Schedule your first email** to test
4. **Adjust settings** for your workflow

## 📝 Credentials

Your OAuth credentials are configured:
- **Client ID**: `1007595181381-dd7o4v4jh01b1pcar6a681hj6pmjdsnp.apps.googleusercontent.com`
- **Project ID**: `taskforce-mailer-v2`
- **Redirect URIs**: `http://localhost:3000/auth/google/callback`, `http://localhost:3000/auth/callback`

**Note**: The extension doesn't use these redirect URIs directly (they're for web apps). Chrome's identity API handles OAuth for extensions automatically.

## 🎉 You're All Set!

Your TaskForce Email Manager extension is ready to use. Happy emailing!



