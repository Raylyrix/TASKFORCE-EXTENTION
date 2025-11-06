# Email Sending Troubleshooting Guide

## Current Status

The email sending system has been fixed with comprehensive error handling and logging. Here's what was fixed:

### ✅ Fixes Applied

1. **Async Promise Handling** - Fixed `handleBulkSendHybrid` to properly return Promises
2. **Error Logging** - Enhanced error messages with full details
3. **Cron Job Logging** - Better visibility into which emails are being processed
4. **Refresh Token Validation** - Proper checking and decryption of refresh tokens
5. **User Registration** - Added automatic check and better error messages
6. **OAuth Flow** - Improved callback page with user ID and instructions

## Common Issues and Solutions

### Issue 1: "No users in database"

**Problem**: Emails can't be sent because no users are registered.

**Solution**:
1. Complete the OAuth flow first:
   - Click "Connect Backend" in the extension popup
   - Or visit: `http://localhost:5000/api/auth/start`
2. Grant all permissions in Google OAuth consent screen
3. You'll be redirected to a success page with your User ID
4. Return to extension and try sending emails again

### Issue 2: "No refresh token found"

**Problem**: User completed OAuth but refresh token wasn't stored.

**Solution**:
1. Revoke access in Google Account: https://myaccount.google.com/permissions
2. Complete OAuth flow again (this ensures fresh refresh token)
3. Check server logs for "User registered/updated" message

### Issue 3: "Backend user not registered"

**Problem**: Extension doesn't have a `backendUserId` stored.

**Solution**:
1. Complete OAuth flow via `/api/auth/start`
2. The extension will automatically check for registration after OAuth
3. Or manually check: `GET /api/auth/check?email=your@email.com`

### Issue 4: Emails not being sent by cron job

**Problem**: Cron job runs but emails aren't sending.

**Check**:
1. Check server logs for cron job execution
2. Look for "Found X due email(s)" messages
3. Check for error messages in logs
4. Verify emails have `status='scheduled'` and `scheduled_for <= now()`

**Debug**:
```sql
-- Check scheduled emails
SELECT id, user_id, to_email, subject, status, scheduled_for, created_at 
FROM scheduled_emails 
WHERE status = 'scheduled' 
ORDER BY scheduled_for ASC;

-- Check if any are due
SELECT COUNT(*) 
FROM scheduled_emails 
WHERE status = 'scheduled' 
AND scheduled_for <= NOW();
```

### Issue 5: Gmail API Errors

**Common Errors**:
- `401 Unauthorized` - Refresh token invalid or expired
- `403 Forbidden` - Missing scopes or API not enabled
- `429 Rate Limit` - Too many requests (handled by retry logic)

**Solution**:
- Re-authenticate via OAuth if token issues
- Enable Gmail API in Google Cloud Console
- Check that all required scopes are granted

## Testing Email Sending

### Test Endpoint
```bash
POST http://localhost:5000/api/test/send-email
Content-Type: application/json

{
  "userId": 1,
  "to": "test@example.com",
  "subject": "Test Email",
  "body": "This is a test email from the backend."
}
```

### Check Cron Job
The cron job runs every minute. Check server logs for:
```
⏰ Checking for due emails at 2025-11-06T...
📬 Found X due email(s):
  1. ID 123 to user@example.com (scheduled for ...)
📤 Sending email ID 123...
✅ Email sent successfully: ID 123
```

## Step-by-Step Setup

1. **Start Backend Server**:
   ```bash
   cd backend
   npm start
   ```

2. **Complete OAuth Flow**:
   - Visit: `http://localhost:5000/api/auth/start`
   - Grant permissions
   - Note your User ID from success page

3. **Check Registration**:
   ```bash
   curl "http://localhost:5000/api/auth/check?email=your@email.com"
   ```

4. **Schedule Test Email**:
   - Use the Bulk Composer in extension
   - Or use API: `POST /api/emails/schedule`

5. **Monitor Logs**:
   - Watch server console for cron job execution
   - Check for error messages
   - Verify emails are being sent

## Debugging Checklist

- [ ] Backend server running on port 5000
- [ ] Database connected (PostgreSQL)
- [ ] User registered via OAuth (check `/api/auth/check`)
- [ ] Refresh token stored in database (encrypted)
- [ ] Emails scheduled in database (check `scheduled_emails` table)
- [ ] Cron job running (check logs every minute)
- [ ] Gmail API enabled in Google Cloud Console
- [ ] All required scopes granted

## Next Steps

1. Complete OAuth flow to register user
2. Schedule a test email
3. Monitor server logs for cron job execution
4. Check email status in database
5. Verify email was sent via Gmail API

## Server Logs to Watch

```
✅ Database initialized successfully
⏰ Checking for due emails at...
📬 Found X due email(s):
📤 Sending email ID X to user@example.com (attempt 1/5)
✅ Email sent successfully: ID X
```

If you see errors, they will be logged with full details.

