# Quick Setup Guide

## Step 1: Create Placeholder Icons

The extension needs icon files. For now, create simple colored PNG files or use online icon generators:

1. Go to https://www.favicon-generator.org/ or any icon creator
2. Create 16x16, 48x48, and 128x128 pixel icons
3. Save them as `icon16.png`, `icon48.png`, and `icon128.png` in the `icons/` folder

Or quickly create them with an image editor or tool like https://www.iconshock.com/

## Step 2: Get Gmail API Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable the **Gmail API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"

4. Create OAuth 2.0 Credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Chrome App" application type (for extensions)
   - Enter your extension ID (get it from chrome://extensions/ after loading)
   - Download the JSON file

5. Alternatively, use "Web application" type with redirect URI:
   - `https://YOUR_EXTENSION_ID.chromiumapp.org/`

6. Update `manifest.json`:
   ```json
   "oauth2": {
     "client_id": "YOUR_CLIENT_ID_HERE.apps.googleusercontent.com",
     "scopes": [...]
   }
   ```

## Step 3: Load Extension in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (top right toggle)
3. Click "Load unpacked"
4. Select the extension folder (`E:\TASKFORCE`)
5. The extension will appear in your extensions list

## Step 4: Authenticate

1. Click the extension icon in the toolbar
2. Click "Not Connected - Click to authenticate"
3. Grant Gmail permissions when prompted
4. You're ready to use the extension!

## Step 5: Test Features

### Test Scheduling:
1. Open Gmail and click Compose
2. Write an email
3. Look for the "Schedule" button (top right of compose window)
4. Set a future date/time
5. Click "Schedule"

### Test Bulk Send:
1. Click extension icon
2. Go to "Settings" or click "Bulk Send"
3. Create a template in Templates tab
4. Use that template in Bulk Send tab
5. Enter email addresses and send

## Troubleshooting

**"Invalid client ID" error:**
- Make sure you copied the complete client ID including `.apps.googleusercontent.com`
- For Chrome extensions, use Chrome App type or proper redirect URI

**"Schedule button not showing":**
- Refresh Gmail page
- Check browser console (F12) for errors
- Make sure extension permissions are granted

**"Cannot send email":**
- Check that you're authenticated (extension popup should show "Connected")
- Verify Gmail API is enabled in Google Cloud Console
- Check background.js console for errors

## Next Steps

- Customize templates
- Set up auto-follow-up rules
- Configure filter rules
- Adjust settings (bulk send delay, etc.)

## Development Tips

- Open `chrome://extensions/` to see extension logs
- Check background script console for service worker logs
- Use Chrome DevTools for content script debugging
- Right-click Gmail and "Inspect" to see injected UI elements



