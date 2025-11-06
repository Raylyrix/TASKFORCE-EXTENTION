# Local PostgreSQL Setup Guide

## Database Configuration

The backend is now configured to use local PostgreSQL with the following credentials:

- **Host**: localhost
- **Port**: 5432
- **Database**: taskforce
- **User**: postgres
- **Password**: rayvical

## Setup Steps

### 1. Install PostgreSQL (if not already installed)

Download and install PostgreSQL from: https://www.postgresql.org/download/

### 2. Create the Database

```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create the database
CREATE DATABASE taskforce;

-- Verify creation
\l
```

### 3. Configure Environment Variables

The `.env` file has been created in the `backend/` directory with the following configuration:

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=taskforce
DB_USER=postgres
DB_PASSWORD=rayvical
```

**Important**: Update the following values in `backend/.env`:
- `GOOGLE_CLIENT_ID` - Your Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET` - Your Google OAuth Client Secret
- `JWT_SECRET` - Generate a secure random string (32+ characters)

### 4. Install Dependencies

```bash
cd backend
npm install
```

### 5. Start the Backend Server

```bash
npm start
# or for development with auto-reload:
npm run dev
```

The server will start on `http://localhost:5000` by default.

## Database Tables

The backend will automatically create the following tables on startup:

- `users` - Stores user authentication and refresh tokens
- `scheduled_emails` - Stores scheduled email data
- `email_stats` - Stores email sending statistics

## API Endpoints

### Email Endpoints
- `POST /api/emails/schedule` - Schedule a single email
- `POST /api/emails/schedule-bulk` - Schedule multiple emails
- `GET /api/emails/scheduled/:userId` - Get user's scheduled emails
- `DELETE /api/emails/schedule/:emailId` - Cancel scheduled email

### Contacts API Endpoints (NEW!)
- `GET /api/contacts/:userId` - Fetch all user contacts
- `POST /api/contacts/:userId` - Create or update a contact
- `GET /api/contacts/:userId/search?query=...` - Search contacts

### Calendar API Endpoints (NEW!)
- `GET /api/calendar/:userId/events?daysAhead=7` - Fetch calendar events
- `POST /api/calendar/:userId/events` - Create a calendar event
- `POST /api/calendar/:userId/events/from-email` - Create event from scheduled email

### Health & Stats
- `GET /health` - Health check endpoint
- `GET /metrics` - Backend metrics
- `GET /api/stats/:userId` - User statistics

## Features

### Contacts Integration ✅
- Fetch all Google Contacts
- Create new contacts
- Search contacts by name, email, or company
- Auto-import contacts for bulk sending

### Calendar Integration ✅
- Fetch upcoming calendar events
- Create calendar events
- Auto-create calendar events when scheduling emails
- Integration with scheduled email follow-ups

### Email Scheduling
- Schedule emails with attachments
- Bulk email scheduling
- Automatic calendar event creation (optional)
- Idempotency protection
- Retry logic with exponential backoff

## Testing the Setup

1. **Check Database Connection**:
   ```bash
   psql -U postgres -d taskforce -c "SELECT version();"
   ```

2. **Start Backend**:
   ```bash
   cd backend
   npm start
   ```

3. **Test Health Endpoint**:
   ```bash
   curl http://localhost:5000/health
   ```

4. **Update Extension Backend URL**:
   In `backend-integration.js`, ensure:
   ```javascript
   const BACKEND_URL = 'http://localhost:5000';
   ```

## Troubleshooting

### Database Connection Issues
- Verify PostgreSQL is running: `pg_isready -U postgres`
- Check credentials in `.env` file
- Ensure database `taskforce` exists

### Port Already in Use
- Change `PORT` in `.env` file
- Or kill the process using port 5000

### OAuth Errors
- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`
- Ensure OAuth redirect URI is set to `http://localhost:5000/api/auth/callback`

## Next Steps

1. Update Google OAuth credentials in `.env`
2. Generate a secure `JWT_SECRET`
3. Start the backend server
4. Test the health endpoint
5. Connect the extension to the local backend

