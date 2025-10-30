# Visual Calendar Feature

## Overview
Added an interactive calendar UI for scheduling emails with date and time selection, providing a user-friendly visual interface for email scheduling.

## Features Added

### 1. Calendar Button
- Added new "📅 Calendar" button to Gmail compose toolbar
- Red color (`#d93025`) to distinguish from other actions
- Integrated seamlessly into existing toolbar

### 2. Visual Calendar Display
- **Monthly View**: Shows current month in grid format
- **Day Selection**: Click any day to select it
- **Past Days**: Grayed out and non-selectable
- **Current Date**: Highlighted
- **Visual Grid**: Clean 7-day week layout

### 3. Month Navigation
- **Previous/Next Buttons**: Navigate between months
- **Month Display**: Shows current month and year
- **Dynamic Rendering**: Calendar updates based on selected month

### 4. Date & Time Selection
- **Date Picker**: Standard HTML date input
- **Time Picker**: Standard HTML time input
- **Smart Defaults**: 
  - Current time for today
  - 9:00 AM for future dates
- **Visual Feedback**: Selected day highlighted in blue

### 5. Schedule Email Integration
- **Compose Integration**: Uses content from Gmail compose window
- **Email Scheduling**: Sends email at selected date/time
- **Confirmation**: Shows success message with scheduled time
- **Error Handling**: Graceful error handling

## Technical Implementation

### Modified Files
- `content.js`: Added calendar UI and scheduling functionality

### Key Components

#### 1. Calendar Button (lines 1287-1295)
- Added to compose toolbar
- Opens calendar view on click

#### 2. Calendar View Function (lines 3060-3234)
- `showCalendarView(composeContainer)`: Main calendar display
- Generates calendar grid dynamically
- Handles day selection and scheduling

#### 3. Calendar Grid Generation
- Calculates days in month
- Determines starting day of week
- Creates 7x6 grid layout
- Handles month boundaries

#### 4. Scheduling Logic
- Reads compose window content
- Creates scheduled email
- Sends to background worker
- Provides user feedback

## User Workflow

1. Open Gmail compose window
2. Compose email (recipients, subject, body)
3. Click "📅 Calendar" button
4. Calendar modal opens
5. Select date by clicking on calendar
6. Select time using time picker
7. Click "Schedule Email" button
8. Confirmation shown
9. Email scheduled and modal closes

## Calendar Features

### Grid Layout
- 7 columns (Sunday-Saturday)
- Variable rows based on month
- Consistent cell sizing
- Responsive design

### Day Display
- Day number prominently displayed
- Placeholder for scheduled emails count
- Hover effect on clickable days
- Border highlight on selection

### Month Header
- Month name and year
- Previous/Next navigation buttons
- Sticky header for scrolling

## Styling

### Color Scheme
- Background: White
- Grid background: Light gray (#dadce0)
- Selected day: Blue border (#1a73e8)
- Past days: 50% opacity
- Buttons: Google Blue (#1a73e8)
- Schedule button: Google Green (#34a853)

### Typography
- Headers: 24px, Google Sans
- Day labels: 11px, semibold
- Day numbers: 13px
- Body text: 14px, Roboto

### Layout
- Modal: Max width 600px, centered
- Grid: 7 columns, equal width
- Padding: 24px modal, 8px cells
- Spacing: 2px gaps between cells

## Integration with Email System

### Data Flow
1. User composes email in Gmail
2. Clicks Calendar button
3. Calendar opens with current compose content
4. User selects date/time
5. Email content extracted from compose window
6. Background worker schedules email
7. User receives confirmation

### Email Content Extraction
- **To**: From `[name="to"]` input
- **Subject**: From `[name="subjectbox"]` input
- **Body**: From contenteditable div with Gmail attributes

## Use Cases

### 1. Schedule for Later
- Compose email during off-hours
- Schedule for optimal send time
- Meet time zone considerations

### 2. Reminder Emails
- Schedule follow-up reminders
- Coordinate with calendar events
- Time-sensitive communications

### 3. Batch Scheduling
- Schedule multiple emails at once
- Different times for different recipients
- Coordinated campaign sends

### 4. Time Zone Management
- Schedule for recipient time zone
- Avoid sending too early/late
- Professional communication timing

## Benefits

✅ **Visual Selection**: Click-to-select dates  
✅ **User-Friendly**: Familiar calendar interface  
✅ **Time Precision**: Date and time selection  
✅ **Integration**: Works with existing compose  
✅ **Flexible**: Any future date/time  
✅ **Feedback**: Clear confirmation messages  

## Future Enhancements

Potential additions:
- Show scheduled emails count per day
- Recurring event visualization
- Time zone selector
- Multi-month view
- Click-and-drag to select date range
- Integration with Google Calendar events
- Suggested send times
- Preview scheduled email content
- Edit scheduled emails
- Conflict detection

