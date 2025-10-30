# TaskForce Email Backend Server

Reliable background email sending server. Sends scheduled emails 24/7, even when user's PC is off.

## 🚀 Features

- ✅ **Always-On Sending**: Emails send even when user's PC is off
- ✅ **Reliable Scheduling**: Cron-based email delivery
- ✅ **User Management**: Secure user registration and authentication
- ✅ **Statistics Tracking**: Track sent/failed emails
- ✅ **RESTful API**: Clean API endpoints
- ✅ **PostgreSQL Database**: Robust data storage
- ✅ **Rate Limiting**: Prevents spam and API throttling

## 📦 Installation

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Set Up Database

#### Option A: Local PostgreSQL
```bash
# Install PostgreSQL
# Create database
createdb taskforce_emails
```

#### Option B: Cloud Database (Recommended for production)
- **Heroku Postgres**: Free tier available
- **Supabase**: Free tier with PostgreSQL
- **Neon**: Free tier PostgreSQL
- **Railway**: Easy PostgreSQL hosting

### 3. Configure Environment

Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

Edit `.env` with your credentials:
```env
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@localhost:5432/taskforce_emails
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

### 4. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URIs
4. Copy Client ID and Secret to `.env`

## 🏃 Running the Server

### Development Mode (with auto-reload)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

## 🌐 API Endpoints

### Health Check
```
GET /health
```

### Register User
```
POST /api/auth/register
Body: { email, refreshToken }
```

### Schedule Email
```
POST /api/emails/schedule
Body: { userId, email, scheduledFor }
```

### Get Scheduled Emails
```
GET /api/emails/scheduled/:userId
```

### Cancel Email
```
DELETE /api/emails/schedule/:emailId
```

### Get Stats
```
GET /api/stats/:userId
```

## 🔄 How It Works

1. **User schedules email** via extension
2. **Extension sends** to backend API
3. **Backend stores** in PostgreSQL
4. **Cron job runs** every minute
5. **Checks for** due emails
6. **Sends via** Gmail API
7. **Updates status** in database
8. **User gets notification** (if enabled)

## 🚀 Deployment

### Heroku (Recommended)
```bash
heroku create taskforce-email-backend
heroku addons:create heroku-postgresql:hobby-dev
heroku config:set GOOGLE_CLIENT_ID=xxx
heroku config:set GOOGLE_CLIENT_SECRET=xxx
git push heroku main
```

### Railway
```bash
railway init
railway up
# Add PostgreSQL addon
# Set environment variables
```

### DigitalOcean
- Create App Platform
- Add PostgreSQL database
- Set environment variables
- Deploy

## 📊 Database Schema

### users
- id
- email
- refresh_token
- created_at

### scheduled_emails
- id
- user_id
- to_email
- cc
- bcc
- subject
- body
- scheduled_for
- status
- sent_at
- error_message
- created_at

### email_stats
- id
- user_id
- sent_count
- failed_count
- last_reset
- created_at

## 🔒 Security

- ✅ Environment variables for secrets
- ✅ PostgreSQL prepared statements (SQL injection protection)
- ✅ HTTPS in production
- ✅ CORS enabled
- ✅ Rate limiting built-in

## 📈 Monitoring

Check server health:
```bash
curl http://localhost:3000/health
```

View logs:
```bash
# Development
npm run dev

# Production (Heroku)
heroku logs --tail
```

## 🐛 Troubleshooting

### Database connection issues
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1"
```

### OAuth token errors
- Check `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env`
- Verify OAuth redirect URIs match

### Emails not sending
- Check cron job is running: `console.log` in server
- Verify database has scheduled emails
- Check Gmail API quota limits

## 📝 License

MIT

## 🎉 Success!

Your backend server is now running and will send emails 24/7!

