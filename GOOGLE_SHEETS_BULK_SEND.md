# 📧 Google Sheets Bulk Email Sender

## ✅ Feature Complete!

Your extension now has a complete Google Sheets bulk email sending system!

## 🎯 How to Use

### Step 1: Prepare Your Google Sheet

Create a Google Sheet with your recipients:

| email | name | company | position |
|-------|------|---------|----------|
| john@example.com | John Doe | Acme Corp | Manager |
| jane@example.com | Jane Smith | XYZ Inc | Director |
| bob@example.com | Bob Johnson | Tech Co | CEO |

**Important:**
- First row should contain column headers
- Must have an `email` column
- Share the sheet publicly or make it accessible

### Step 2: Get Sheet URL

1. Open your Google Sheet
2. Click "Share" button
3. Set access to "Anyone with the link"
4. Copy the URL

### Step 3: Use Bulk Send in Gmail

1. Open Gmail
2. Click **Compose**
3. Look for **"📧 Bulk Send"** button in toolbar
4. Click it to open modal

### Step 4: Configure Bulk Send

**In the modal:**

1. **Paste Google Sheets URL** - Your sheet link
2. **Click "Load Sheet"** - Preview your data
3. **Enter Email Subject** - Use variables like `{{name}}`
4. **Enter Email Content** - Use variables like `{{company}}`
5. **Set Start Time** - When to begin sending
6. **Set Delay** - Time between each email
7. **Click "Start Sending"**

### Step 5: Wait for Completion

- Extension sends emails automatically
- Check progress in extension popup
- Receives success/failure notifications

---

## 📝 Available Variables

Use these variables in your subject and content:

- `{{name}}` - Person's name
- `{{email}}` - Email address
- `{{company}}` - Company name
- `{{position}}` - Position/role
- `{{any_column_name}}` - Any column from your sheet

**Example:**
```
Subject: Hi {{name}}, opportunity at {{company}}

Content:
Dear {{name}},

I noticed you're the {{position}} at {{company}}...

Best regards
```

---

## ⏰ Scheduling Options

### Start Sending At
- Leave empty = Start immediately
- Set date/time = Starts at that time

### Delay Between Emails
- **Instant** - No delay (not recommended for bulk)
- **1-60 seconds** - Small delay between emails
- **1 minute** - Longer delay
- **Custom** - Set your own delay in seconds

**Recommended:** 5-10 seconds delay to avoid being flagged as spam

---

## ✅ Features Implemented

✅ Google Sheets integration  
✅ Sheet data preview  
✅ Variable replacement  
✅ Personalized emails  
✅ Start time scheduling  
✅ Delay between emails  
✅ Progress tracking  
✅ Error handling  
✅ Daily limits  

---

## 🚀 Workflow

```
1. Click "📧 Bulk Send" in Gmail compose
2. Paste Google Sheets URL
3. Click "📥 Load Sheet"
4. Preview data (first 5 rows shown)
5. Enter subject and content
6. Configure timing options
7. Click "🚀 Start Sending"
8. Extension sends emails automatically
9. Check progress in popup
```

---

## ⚠️ Important Notes

### Google Sheets Sharing
- Sheet must be shared for extension to access
- Set to "Anyone with the link can view"
- Or use "Edit" access with your Google account

### Gmail API Limits
- Max 500 emails/day (configurable)
- Rate limiting built-in
- Delays prevent being flagged as spam

### Variables
- Case-insensitive: `{{NAME}}` = `{{name}}`
- Underscores supported: `{{first_name}}`
- Missing data = empty string

---

## 🎉 Ready to Use!

Your extension is now fully equipped for bulk email campaigns using Google Sheets!

**Reload extension and start using it!** 🚀



