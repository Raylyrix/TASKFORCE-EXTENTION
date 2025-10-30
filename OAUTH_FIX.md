# OAuth Authentication Fix Guide

## Issue: "bad client id" Error

You're getting this error because your OAuth client ID is configured for **Web applications**, not **Chrome extensions**.

## Solution Options

### Option 1: Use Chrome Identity API (Recommended for Extensions)

Your client ID is actually fine for web apps, but Chrome extensions should use the built-in `chrome.identity` API which handles OAuth automatically.

**Current setup is already using chrome.identity** ✅

The error might be because:
1. The extension hasn't been reloaded after updating
2. Chrome needs the extension ID for OAuth redirect

**Fix Steps:**
1. Go to `chrome://extensions/`
2. Find your extension "TaskForce Email Manager"
3. Note your **Extension ID** (looks like: `abcdefghijklmnopqrstuvwxyz123456`)
4. Copy this ID

### Option 2: Create Chrome App OAuth Client

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project: **taskforce-mailer-v2**
3. Go to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Select **Chrome App** (NOT Web application)
6. Enter your **Extension ID** in the field
7. Download the client_secret JSON
8. Use the client_id from that file in manifest.json

### Option 3: Use Web App Client ID (Temporary Workaround)

If you want to use your existing web app client ID:

1. Add to your manifest.json oauth2 section:
```json
"oauth2": {
  "client_id": "1007595181381-dd7o4v4jh01b1pcar6a681hj6pmjdsnp.apps.googleusercontent.com",
  "scopes": [...],
  "redirect_uris": ["https://YOUR_EXTENSION_ID.chromiumapp.org/"]
}
```

2. Add this redirect URI to your Google Cloud Console OAuth client

## Quick Test

1. **Reload extension** in `chrome://extensions/`
2. Click extension icon
3. Click "Not Connected" to authenticate
4. If it works, you're done! ✅

If it still fails, see Option 2 above.

## Most Likely Cause

The extension just needs to be **reloaded** after we made changes. Try:
1. Reload extension
2. Clear extension data if needed
3. Try authentication again

The content script will automatically detect Gmail and show the "TaskForce Email Manager Active" notification when you open Gmail!



