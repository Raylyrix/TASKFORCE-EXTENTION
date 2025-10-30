# 🔐 Google Sheets Authentication Fix

## The Problem

Extension showing "Sheet not authenticated" even though you have edit permissions.

## Root Cause

The OAuth token needs to include the **Google Sheets scope** to access sheets.

## ✅ Fix Applied

I've updated the authentication to include the sheets scope:

```javascript
scopes: [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/spreadsheets.readonly' // ADDED THIS
]
```

## 🔄 What You Need to Do

### Step 1: Clear Existing Token

You need to re-authenticate to get a token with Sheets access:

1. Go to `chrome://extensions/`
2. Find "TaskForce Email Manager"
3. Click **"Remove"** on the extension
4. Click **"Load unpacked"** again
5. Reload the folder

**OR** manually clear the token:

1. Click extension icon
2. Authenticate again (will request Sheets permission)

### Step 2: Re-authenticate

After reloading:
1. Click extension icon
2. Click "Not Connected"
3. **New permission dialog will appear** - includes Google Sheets access
4. Grant all permissions

### Step 3: Test

1. Open Gmail Compose
2. Click "Bulk Send"
3. Paste Google Sheets URL
4. Click "Load Sheet"
5. Should work now! ✅

## Permissions Needed

The extension now requests:
- ✅ Gmail Read access
- ✅ Gmail Send access
- ✅ Gmail Modify access
- ✅ **Google Sheets Read access** (NEW)

## Alternative: Manual Token Clear

If you want to keep the extension installed:

1. Open browser console (F12)
2. Run: `chrome.identity.clearAllCachedAuthTokens()`
3. Reload extension
4. Re-authenticate

## Why This Happened

Chrome extensions cache OAuth tokens. Since we added the Sheets scope after you already authenticated, your old token doesn't have Sheets access.

**Solution:** Clear the cache and re-authenticate to get a new token with all scopes.

## Summary

✅ Code fixed to request Sheets scope  
⏳ You need to re-authenticate to get new token  
✅ After re-auth, everything will work

**Reload extension and authenticate again!** 🚀



