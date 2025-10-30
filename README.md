# Advanced Email Manager Chrome Extension

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Raylyrix/TASKFORCE-EXTENTION)

A powerful Chrome extension that adds advanced email management features to Gmail including scheduling, auto-follow-up, bulk sending, and smart filters.

## Features

✨ **Schedule Emails**: Send emails at a specific date and time
📅 **Recurring Emails**: Set up daily, weekly, or monthly recurring emails
🔄 **Auto Follow-up**: Automatically follow up on emails when recipients don't respond
📧 **Bulk Sending**: Send personalized emails to multiple recipients
📝 **Email Templates**: Create and reuse email templates
🎯 **Smart Filters**: Automatically organize and categorize emails

## Installation

### Development Setup

1. Clone or download this extension
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked" and select the extension folder

### Configuration

Before using the extension, you need to set up Gmail API credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Gmail API
4. Create OAuth 2.0 credentials (Web application or Chrome extension)
5. Update `manifest.json` with your `client_id`:
   ```json
   "oauth2": {
     "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
     "scopes": [...]
   }
   ```

## Usage

### Scheduling Emails

1. Open Gmail compose window
2. Write your email
3. Click the "Schedule" button
4. Select date, time, and optional recurrence
5. Click "Schedule"

### Bulk Sending

1. Open extension popup
2. Go to "Bulk Send" tab
3. Select a template
4. Enter recipients (one per line or comma-separated)
5. Click "Send Bulk"

### Auto Follow-up

1. Open extension settings
2. Go to "Auto Follow-up" tab
3. Create a rule with:
   - Rule name
   - Template to use
   - Days to wait before following up
4. Enable auto follow-up in settings

### Templates

1. Open extension settings
2. Go to "Templates" tab
3. Create templates with:
   - Name
   - Subject
   - Body (supports variables like {{name}})
4. Use templates when composing or bulk sending

## Architecture

```
├── manifest.json       # Extension configuration
├── background.js       # Service worker (scheduling, automation)
├── content.js         # Injected into Gmail (UI enhancements)
├── popup.html/js      # Extension popup UI
├── options.html/js    # Settings page
└── styles.css         # Injected styles for Gmail UI
```

## Permissions

- **storage**: Store templates, scheduled emails, and settings
- **alarms**: Schedule emails to be sent at specific times
- **identity**: OAuth authentication with Gmail
- **gmail**: Access to Gmail messages (requires user consent)

## API Usage

The extension uses:
- **Gmail API**: For sending emails and accessing mailbox
- **Chrome APIs**: For scheduling, storage, and OAuth
- No backend server required!

## Development

### File Structure

- `background.js`: Handles all scheduling logic and Gmail API calls
- `content.js`: Injects UI into Gmail web interface
- `popup.js`: Manages extension popup interface
- `options.js`: Settings and configuration management

### Testing

1. Load extension in developer mode
2. Grant permissions when prompted
3. Authenticate with Gmail
4. Test features in Gmail interface

## Security

- All OAuth tokens are stored securely by Chrome
- No external API calls except to Gmail API
- All email data stays in your browser
- No server-side storage

## License

MIT License - feel free to modify and distribute

## Contributing

Contributions welcome! Please feel free to submit a Pull Request.

## Support

For issues or questions, please open an issue on GitHub.
