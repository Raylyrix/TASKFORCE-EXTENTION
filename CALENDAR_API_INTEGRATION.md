# Calendar API Integration

## Overview
Implemented comprehensive Google Calendar API integration for event detection, creation, and management within the email context.

## Features Added

### 1. Calendar Event Detection
Automatically detects potential calendar events from email content:
- **Date Detection**: Multiple date formats (MM/DD/YYYY, MM-DD-YYYY, YYYY-MM-DD)
- **Day Detection**: Weekdays (Monday-Sunday)
- **Month Detection**: Full month names
- **Time Detection**: Time formats with AM/PM and 24-hour format
- **Keyword Detection**: Meeting-related keywords (meeting, call, conference, zoom, teams, schedule, appointment)

### 2. Fetch Calendar Events
Retrieve upcoming calendar events from Google Calendar:
- **Date Range**: Configurable days ahead (default: 7 days)
- **Event Details**: Summary, start, end, location, description, attendees
- **Calendar Link**: Direct link to Google Calendar event
- **Smart Filtering**: Only upcoming events

### 3. Create Calendar Events
Programmatically create calendar events:
- **Event Creation**: Full calendar event creation via API
- **Event Details**: Title, description, location, attendees, time
- **Integration**: Seamless integration with Gmail

## Technical Implementation

### Modified Files
- `background.js`: Added Calendar API functions and message handlers
- `manifest.json`: Already includes Calendar API scopes

### Key Functions

#### 1. Fetch Calendar Events
```javascript
async function fetchCalendarEvents(daysAhead = 7)
```
- Fetches upcoming calendar events
- Returns array of event objects
- Handles errors gracefully

#### 2. Create Calendar Event
```javascript
async function createCalendarEvent(event)
```
- Creates a new calendar event
- Accepts event object with all details
- Returns created event or null on error

#### 3. Detect Calendar Events from Email
```javascript
async function detectCalendarEventsFromEmail(emailBody, emailSubject)
```
- Analyzes email content for event information
- Uses regex patterns for date/time detection
- Returns detection result with suggestions

#### 4. Get Upcoming Events
```javascript
async function getUpcomingEvents(context)
```
- Retrieves formatted upcoming events
- Provides context for email composition
- Returns simplified event objects

### Message Handlers
Added 4 new message handlers in `background.js`:
- `fetchCalendarEvents`: Fetch upcoming events
- `createCalendarEvent`: Create new event
- `detectCalendarEvents`: Detect event in email
- `getUpcomingEvents`: Get formatted events for context

## API Endpoints Used

### Google Calendar API
```
GET /calendar/v3/calendars/primary/events
POST /calendar/v3/calendars/primary/events
```

### Required Scopes
Already included in `manifest.json`:
- `https://www.googleapis.com/auth/calendar`
- `https://www.googleapis.com/auth/calendar.events`

## Detection Patterns

### Date Patterns
- `MM/DD/YYYY`: 12/21/2024
- `MM-DD-YYYY`: 12-21-2024
- `YYYY-MM-DD`: 2024-12-21
- Weekdays: Monday, Tuesday, etc.
- Months: January, February, etc.

### Time Patterns
- `H:MM AM/PM`: 3:00 PM, 10:30 AM
- `H:MM`: 15:00, 10:30

### Meeting Keywords
- meeting, call, conference, zoom, teams, schedule, appointment

## Use Cases

### 1. Smart Email-to-Event
- User receives email about meeting
- System detects date/time
- Suggests creating calendar event
- User confirms and event created

### 2. Context-Aware Composing
- User composing email
- System shows upcoming events
- User can reference events in email
- Better email context

### 3. Meeting Coordination
- Bulk emails with meeting invitations
- Automatic calendar event creation
- Attendees added from email list
- Location and time synced

### 4. Follow-up Scheduling
- After email conversation
- System detects agreed meeting time
- Creates calendar event automatically
- Sends confirmation

## Integration with Email System

### Email Detection Flow
1. Email received/composed
2. Content analyzed for event keywords
3. Dates/times extracted
4. Suggestions provided to user
5. User creates event if appropriate

### Calendar Context Flow
1. User opens compose
2. System fetches upcoming events
3. Events shown in sidebar/context
4. User can reference in email

## Benefits

✅ **Event Detection**: Automatically finds events in emails  
✅ **Smart Suggestions**: Proactive calendar event creation  
✅ **Context Awareness**: Shows upcoming events while composing  
✅ **Time Saving**: No manual event creation needed  
✅ **Integrated Workflow**: Seamless Gmail-Calendar integration  
✅ **Meeting Coordination**: Easier meeting management  

## Example Detection Results

### Sample Email
```
Subject: Meeting Tomorrow
Body: Let's meet on 12/21/2024 at 3:00 PM to discuss the project.
```

### Detection Result
```javascript
{
  hasPotentialEvent: true,
  detectedDates: ['12/21/2024'],
  detectedTimes: ['3:00 PM'],
  meetingKeywords: ['meeting', 'discuss'],
  suggestion: 'This email may contain event information. Would you like to create a calendar event?'
}
```

## Event Object Structure

### Event Creation Format
```javascript
{
  summary: 'Meeting Title',
  description: 'Meeting description',
  location: 'Location or Zoom link',
  start: {
    dateTime: '2024-12-21T15:00:00',
    timeZone: 'America/New_York'
  },
  end: {
    dateTime: '2024-12-21T16:00:00',
    timeZone: 'America/New_York'
  },
  attendees: [
    { email: 'user@example.com' }
  ]
}
```

## Error Handling

- **No Token**: Returns empty array/null
- **API Errors**: Logged to console
- **Network Issues**: Graceful degradation
- **Invalid Data**: Validation before API calls

## Future Enhancements

Potential additions:
- Recurring event detection
- Multiple timezone support
- Event conflict detection
- Auto-add meeting links
- Event reminder integration
- Meeting room booking
- Automatic attendee matching
- Event templates
- Sync with email scheduling

