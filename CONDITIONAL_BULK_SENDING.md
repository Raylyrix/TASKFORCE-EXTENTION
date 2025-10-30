# Conditional Bulk Sending Feature

## Overview
Added intelligent conditional sending options to the bulk email feature, allowing you to target recipients based on their engagement history (opens, clicks, replies).

## Features Added

### 1. Conditional Sending Options
- **Send if Opened**: Only send to recipients who opened previous emails
- **Send if Clicked**: Only send to recipients who clicked links in previous emails  
- **Send if Replied**: Only send to recipients who replied to previous emails
- **Send if No Engagement**: Only send to recipients who did NOT open/click/reply (for nurture sequences)

### 2. UI Enhancement
Added a new "🎯 Conditional Sending" section to the bulk send panel in Gmail compose window:
- Clean, Gmail-matching UI design
- Checkboxes for each conditional option
- Helpful tooltip: "Leave all unchecked to send to everyone"
- Organized in a collapsible section with visual styling

### 3. Smart Filtering Logic
The system now:
1. Fetches engagement data from stored tracking information
2. Checks each recipient against:
   - Email open tracking
   - Link click tracking  
   - Reply detection
3. Filters the recipient list based on selected conditions
4. Shows appropriate messages if no recipients match criteria

## Technical Implementation

### Modified Files
- `content.js`: Added conditional sending UI and filtering logic

### Key Changes
1. **UI Addition** (lines 1467-1494):
   - Added conditional sending checkbox section to bulk send panel
   - Styled to match Gmail's design language

2. **Filtering Logic** (lines 1868-1945):
   - Get conditional options from checkboxes
   - Fetch `trackedEmails` and `emailReplies` from storage
   - Filter recipients based on engagement history
   - Created `continueBulkSendProcess` helper function

3. **Data Integration**:
   - Uses email tracking data (from Phase 1 implementation)
   - Cross-references multiple data sources
   - Handles edge cases (no data, no matches)

## User Workflow

1. Open Gmail compose window
2. Click "Bulk Send" button
3. Load Google Sheets data
4. Set up timing options (delays, start time)
5. **NEW**: Select conditional sending criteria (optional)
   - Check boxes for desired conditions
   - Leave all unchecked to send to everyone
6. Click "Send X Emails"
7. System automatically filters recipients based on engagement
8. Shows confirmation with filtered count

## Use Cases

### 1. Follow-up with Engaged Recipients
- Check "Send if Opened" + "Send if Clicked"
- Send special content to active subscribers
- Perfect for product announcements, special offers

### 2. Re-engagement Campaign
- Check "Send if No Engagement"
- Target inactive recipients with re-engagement content
- Great for win-back campaigns

### 3. Multi-step Nurture Sequence
- Send if No Engagement → basic info
- Send if Opened → detailed content
- Send if Clicked → call-to-action
- Send if Replied → personal follow-up

### 4. Reply-focused Follow-up
- Check "Send if Replied"
- Send additional resources to engaged prospects
- Perfect for sales follow-up sequences

## Benefits

✅ **Targeted Messaging**: Send relevant content to the right audience  
✅ **Higher Engagement**: Focus on interested recipients  
✅ **Automated Segmentation**: No manual list management needed  
✅ **Better ROI**: Reduce unopened emails, increase relevance  
✅ **Smart Sequences**: Build intelligent multi-step campaigns  
✅ **Data-Driven**: Uses actual engagement data, not assumptions  

## Technical Notes

- Conditional filtering happens client-side in `content.js`
- Data fetched from `chrome.storage.local`
- Works with existing email tracking infrastructure
- No performance impact for non-conditional sends
- Handles missing data gracefully

## Future Enhancements

Potential additions:
- Multiple condition combinations (AND/OR logic)
- Time-based conditions (e.g., "not opened in 7 days")
- Engagement scoring system
- A/B testing integration
- Advanced segmentation options

