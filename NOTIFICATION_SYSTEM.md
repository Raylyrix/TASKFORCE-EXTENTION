# Notification System

## Overview
Implemented a comprehensive notification system with multiple notification types for various email events, providing real-time alerts for user engagement and system actions.

## Features

### 1. Notification Types
The system supports 9 different notification types:
- **info**: General information
- **success**: Successful operations
- **warning**: Warnings and partial failures
- **error**: Errors and failures
- **open**: Email opened
- **click**: Link clicked
- **reply**: Reply received
- **schedule**: Email scheduled
- **followup**: Follow-up triggered

### 2. Events That Trigger Notifications

#### Email Engagement
- **Email Opened**: "Email Opened! - Someone opened your tracked email"
- **Link Clicked**: "Link Clicked! - Someone clicked: [url]..."

#### Email Sending
- **Email Sent**: "Email Sent - Successfully sent to [recipient]"
- **Email Scheduled**: "Email Scheduled - Email scheduled for [datetime]"
- **Bulk Send Complete**: "Bulk Send Complete! - Successfully sent X of Y emails"
- **Bulk Send Failed**: "Bulk Send Failed - An error occurred while sending bulk emails"

#### Follow-ups
- **Follow-up Sent**: "Follow-up Sent - Auto follow-up sent to [recipient]"

## Technical Implementation

### Modified Files
- `background.js`: Added notification system and integrated throughout

### Key Changes

1. **Notification Creation Function** (lines 889-915):
   ```javascript
   function createNotification(title, message, type = 'info')
   ```
   - Central function for creating all notifications
   - Supports multiple notification types
   - Logs notifications for debugging
   - Uses Chrome Notifications API

2. **Specialized Notification Functions**:
   - `notifyEmailSent(email)` - Email successfully sent
   - `notifyEmailScheduled(email)` - Email scheduled for later
   - `notifyReplyReceived(email)` - Reply received
   - `notifyFollowUpTriggered(email)` - Follow-up sent

3. **Integration Points**:
   - Email sending (`sendScheduledEmail`)
   - Email scheduling (`scheduleEmail`)
   - Bulk sending (`sendBulkEmailsFromSheets`)
   - Email tracking (`trackEmailOpen`, `trackLinkClick`)
   - Follow-up automation (`processFollowUpRule`)

## User Experience

### Notification Display
- **Platform**: Chrome notifications (desktop notifications)
- **Icon**: Extension icon (48x48)
- **Position**: System notification area
- **Persistence**: Auto-dismiss based on system settings

### Notification Content
Each notification includes:
- **Title**: Brief action description
- **Message**: Detailed information
- **Context**: "TaskForce Email Manager" context message
- **Icon**: Type-appropriate icon

## Notification Examples

### Email Opened
```
Title: Email Opened!
Message: Someone opened your tracked email
Type: open
```

### Link Clicked
```
Title: Link Clicked!
Message: Someone clicked: https://example.com/product...
Type: click
```

### Bulk Send Complete
```
Title: Bulk Send Complete!
Message: Successfully sent 45 of 50 emails (5 failed)
Type: warning
```

### Email Scheduled
```
Title: Email Scheduled
Message: Email scheduled for 12/21/2024, 3:00:00 PM
Type: schedule
```

## Benefits

✅ **Real-time Alerts**: Immediate notifications for engagement  
✅ **Multiple Types**: Different notifications for different events  
✅ **Non-intrusive**: System notifications don't block workflow  
✅ **Actionable**: Know immediately when emails are engaged  
✅ **Complete Tracking**: Notifications for all major actions  
✅ **User Feedback**: Clear confirmation of system actions  

## Notification Settings

Currently, all notifications are enabled by default. Future enhancement could include:
- Notification preferences UI
- Toggle specific notification types
- Quiet hours settings
- Sound preferences
- Notification frequency limits

## Technical Details

### Chrome Notifications API
- Uses `chrome.notifications.create()`
- Type: 'basic' notifications
- Requires 'notifications' permission in manifest.json

### Notification Lifecycle
1. Event occurs (email sent, opened, etc.)
2. `createNotification()` called with appropriate type
3. Notification created via Chrome API
4. Displayed in system notification area
5. Auto-dismissed or user-dismissed

### Error Handling
- Notifications are logged for debugging
- Failures don't block main functionality
- Graceful degradation if notifications fail

## Usage Examples

### Programmatic Usage
```javascript
// Simple notification
createNotification('Hello', 'World', 'info');

// Email sent
notifyEmailSent({ to: 'user@example.com' });

// Email scheduled
notifyEmailScheduled({ 
  to: 'user@example.com', 
  scheduledFor: '2024-12-21T15:00:00' 
});

// Follow-up triggered
notifyFollowUpTriggered({ to: 'user@example.com' });
```

### Message-Based Usage (from content script)
```javascript
chrome.runtime.sendMessage({
  action: 'showNotification',
  title: 'Custom Title',
  message: 'Custom message',
  type: 'success'
});
```

## Future Enhancements

Potential additions:
- Notification center (history of notifications)
- Notification categories (engagement, system, alerts)
- Custom notification sounds
- Rich notifications with actions
- Notification grouping
- Priority levels
- Export notification history
- Notification analytics

