# 🚨 IMMEDIATE OAuth Fix - Step by Step

## The Problem
Your client ID is a **"Web application"** type, but Chrome extensions need specific configuration to work with OAuth.

## ⚡ QUICK FIX (5 Minutes)

### Option 1: Remove OAuth2 from Manifest (Temporary)

The extension can work WITHOUT OAuth2 in manifest if we handle auth differently.

1. **Edit manifest.json** - Remove this block:
```json
"oauth2": {
  "client_id": "1007595181381-dd7o4v4jh01b1pcar6a681hj6pmjdsnp.apps.googleusercontent.com",
  "scopes": [...]
}
```

2. **Alternative:** We'll use Gmail API via normal fetch requests after user manually authenticates

### Option 2: Create Chrome Extension Client (Proper Fix)

1. Go to: https://console.cloud.google.com/apis/credentials
2. Select project: **taskforce-mailer-v2**
3. Click **"Create Credentials"** → **"OAuth client ID"**
4. Under **"Application type"**: Select **"Web application"** (NOT Chrome App!)
5. **Name:** TaskForce Extension
6. Add to **"Authorized JavaScript origins"**:
   - `https://accounts.google.com`
7. Add to **"Authorized redirect URIs"**:
   - `https://YOUR_EXTENSION_ID.chromiumapp.org`
8. Click **Create**
9. **Copy the Client ID**
10. Update manifest.json with new ID

### Option 3: Keep Existing Client, Add Redirect URI

1. Go to your existing client in Google Cloud Console
2. Click to edit it
3. In **"Authorized redirect URIs"**, add:
   - `https://YOUR_EXTENSION_ID.chromiumapp.org`
4. Save
5. Reload extension

## 🎯 RIGHT NOW - Do This:

**Get your Extension ID:**
1. Go to `chrome://extensions/`
2. Find "TaskForce Email Manager"
3. Copy the Extension ID (example: `abcdefghijklmnopqrstuvwxyz123456`)

**Update manifest.json with redirect:**
I'll add the extension ID redirect URI to the manifest for you right now.

## Let Me Fix It For You:

I'll modify the manifest to include the proper redirect URI pattern that Chrome extensions need.



