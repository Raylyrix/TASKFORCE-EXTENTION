# 🔐 OAuth Setup Instructions - CRITICAL

## ⚠️ You MUST Configure OAuth Properly

Your client ID exists but **needs the correct redirect URI** for Chrome extensions.

## 📋 Step-by-Step Setup

### Step 1: Get Your Extension ID

1. Go to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Find "TaskForce Email Manager"
4. **Copy the Extension ID** (looks like: `abcdefghijklmnopqrstuvwxyz123456`)

### Step 2: Go to Google Cloud Console

1. Open: https://console.cloud.google.com/apis/credentials
2. Select project: **taskforce-mailer-v2**

### Step 3: Edit Your OAuth Client

1. Find your client ID in the list: `1007595181381-dd7o4v4jh01b1pcar6a681hj6pmjdsnp`
2. **Click on it** to edit
3. You'll see fields for:
   - Authorized JavaScript origins
   - Authorized redirect URIs

### Step 4: Add Redirect URI

In **"Authorized redirect URIs"**, click **"+ ADD URI"** and add:

```
https://YOUR_EXTENSION_ID.chromiumapp.org
```

Replace `YOUR_EXTENSION_ID` with the ID you copied in Step 1.

**Example:**
```
https://abcdefghijklmnopqrstuvwxyz123456.chromiumapp.org
```

### Step 5: Save

1. Click **"SAVE"** at the bottom
2. Wait for changes to propagate (10-30 seconds)

### Step 6: Test Extension

1. Reload extension in `chrome://extensions/`
2. Click extension icon
3. Click "Not Connected"
4. Should now work! ✅

---

## 🎯 Alternative: Create New OAuth Client

If you want to create a fresh one:

### Step 1: Create Credentials

1. In Google Cloud Console
2. Click **"Create Credentials"** → **"OAuth client ID"**

### Step 2: Select Type

- Choose **"Chrome App"** for best compatibility
- OR choose **"Web application"** (you're using this)

### Step 3: Configure

**For Web Application:**
- Name: TaskForce Extension
- Authorized JavaScript origins: `https://accounts.google.com`
- Authorized redirect URIs: `https://YOUR_EXTENSION_ID.chromiumapp.org`

**For Chrome App:**
- Name: TaskForce Extension
- Application ID: Your extension ID

### Step 4: Get Credentials

1. Click **Create**
2. **Copy the Client ID**
3. Update manifest.json with new Client ID

---

## 🔍 How to Debug

### Check Current Redirect URI

1. Open popup
2. Open console (F12)
3. Look for log: `Redirect URI: https://...`

This is what you need to add to Google Cloud Console.

### Still Not Working?

**Check:**
1. Did you reload extension after changing?
2. Did you wait 30 seconds after saving OAuth settings?
3. Is redirect URI exactly matching (including https://)?

**Common Issues:**
- Trailing slash mismatch
- Wrong extension ID
- Changes haven't propagated yet

---

## ✅ Success Checklist

- [ ] Got Extension ID from chrome://extensions/
- [ ] Went to Google Cloud Console
- [ ] Edited OAuth client or created new one
- [ ] Added redirect URI: `https://EXTENSION_ID.chromiumapp.org`
- [ ] Saved changes
- [ ] Waited 30 seconds
- [ ] Reloaded extension
- [ ] Clicked "Not Connected"
- [ ] Authentication works! 🎉

---

## 🚨 IMPORTANT

**Chrome extensions MUST have the redirect URI configured in Google Cloud Console!**

Without it, you'll always get "bad client id" error.

The redirect URI format is:
```
https://[EXTENSION_ID].chromiumapp.org
```

Where `[EXTENSION_ID]` is your actual extension ID from chrome://extensions/

---

## Need Help?

If still having issues:
1. Check console logs for exact redirect URI
2. Verify it matches Google Cloud Console
3. Make sure Gmail API is enabled
4. Ensure you're logged into Google Cloud Console with same account



