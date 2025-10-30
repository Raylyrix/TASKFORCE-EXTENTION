# 🚀 Backend Server Deployment Guide

Complete guide to deploy TaskForce Email Backend Server for 24/7 reliable email sending.

---

## 🎯 What This Does

Your backend server will:
- ✅ Send scheduled emails 24/7
- ✅ Work even when user's PC is off
- ✅ Handle thousands of users
- ✅ Reliable and professional
- ✅ No limitations!

---

## 📋 Prerequisites

1. **Node.js** (v14 or higher)
2. **PostgreSQL Database** (free options available)
3. **Google OAuth Credentials**
4. **Git** (for deployment)

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Deploy Database

Choose one:

#### Option A: Supabase (Recommended - FREE)
1. Go to [supabase.com](https://supabase.com)
2. Create free account
3. Create new project
4. Copy database URL

#### Option B: Heroku Postgres (FREE)
```bash
heroku create your-app-name
heroku addons:create heroku-postgresql:hobby-dev
heroku config:get DATABASE_URL
```

#### Option C: Railway (FREE)
1. Go to [railway.app](https://railway.app)
2. New project → PostgreSQL
3. Copy connection string

---

### Step 2: Deploy Server

#### Option A: Heroku (Recommended)
```bash
# Install Heroku CLI
# Login
heroku login

# Create app
heroku create taskforce-email-backend

# Add PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# Set environment variables
heroku config:set GOOGLE_CLIENT_ID=your-client-id
heroku config:set GOOGLE_CLIENT_SECRET=your-client-secret

# Deploy
cd backend
git init
git add .
git commit -m "Initial commit"
git push heroku main
```

#### Option B: Railway
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Deploy
cd backend
railway init
railway up

# Add PostgreSQL addon
# Set environment variables in Railway dashboard
```

#### Option C: Render
1. Go to [render.com](https://render.com)
2. New → Web Service
3. Connect GitHub repo
4. Add PostgreSQL database
5. Set environment variables
6. Deploy

---

### Step 3: Configure Environment Variables

Set these in your hosting platform:

```env
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://... (from database provider)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

---

### Step 4: Update Extension

1. Open `backend-integration.js`
2. Replace `BACKEND_URL` with your deployed URL:
```javascript
const BACKEND_URL = 'https://your-app.herokuapp.com';
```

3. Add backend integration to manifest:
```json
{
  "background": {
    "service_worker": "background.js",
    "scripts": ["backend-integration.js"]
  }
}
```

---

## 🔧 Local Development Setup

### 1. Install Dependencies
```bash
cd backend
npm install
```

### 2. Set Up Local PostgreSQL
```bash
# Install PostgreSQL
brew install postgresql  # Mac
# or download from postgresql.org

# Create database
createdb taskforce_emails

# Create .env file
cp env.example .env

# Edit .env with your credentials
```

### 3. Run Server
```bash
npm run dev  # Development mode
# or
npm start    # Production mode
```

### 4. Test Backend
```bash
curl http://localhost:3000/health
# Should return: {"status":"ok",...}
```

---

## 🌐 API Testing

### Register User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "refreshToken": "your-refresh-token"
  }'
```

### Schedule Email
```bash
curl -X POST http://localhost:3000/api/emails/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1,
    "email": {
      "to": "recipient@example.com",
      "subject": "Test Email",
      "body": "Hello World"
    },
    "scheduledFor": "2024-12-31T12:00:00Z"
  }'
```

---

## 📊 Monitoring

### Check Logs

#### Heroku:
```bash
heroku logs --tail
```

#### Railway:
```bash
railway logs
```

#### Render:
- Go to dashboard → View logs

### Check Database
```bash
# Heroku
heroku pg:psql

# Supabase
# Use SQL editor in dashboard

# Local
psql taskforce_emails
```

---

## 🔍 Troubleshooting

### Issue: Database Connection Error

**Solution**:
```bash
# Check DATABASE_URL is correct
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

### Issue: Emails Not Sending

**Check**:
1. Cron job running? (Check logs)
2. Emails in database? `SELECT * FROM scheduled_emails WHERE status='scheduled'`
3. OAuth credentials valid?
4. Gmail API quota exceeded?

### Issue: 401 Unauthorized

**Solution**:
- Refresh token expired
- Need to get new refresh token
- Re-authenticate user

---

## 💰 Cost Estimates

### Free Tier (Good for Testing)
- **Supabase**: PostgreSQL free tier
- **Heroku**: Postgres hobby-dev free
- **Total**: $0/month

### Small Scale (100 users)
- **Database**: $0-7/month
- **Hosting**: $0-7/month
- **Total**: $0-14/month

### Medium Scale (1,000 users)
- **Database**: $7-25/month
- **Hosting**: $7-25/month
- **Total**: $14-50/month

### Large Scale (10,000 users)
- **Database**: $25-100/month
- **Hosting**: $25-100/month
- **Total**: $50-200/month

---

## 🔒 Security Checklist

- ✅ Environment variables for secrets
- ✅ HTTPS enabled (production)
- ✅ Prepared statements (SQL injection protection)
- ✅ Rate limiting
- ✅ CORS configured
- ✅ Input validation
- ✅ Error handling
- ✅ Database backups

---

## 🎉 Success Checklist

- [ ] Backend deployed and accessible
- [ ] Database connected
- [ ] Cron job running (check logs)
- [ ] Test email scheduled successfully
- [ ] Email sent on time
- [ ] Extension integrated with backend
- [ ] Users can schedule emails
- [ ] Emails send when PC is off

---

## 📞 Support

Need help? Check logs:
```bash
# See recent errors
heroku logs --tail

# Check database
heroku pg:psql -c "SELECT * FROM scheduled_emails LIMIT 10"

# Test health endpoint
curl https://your-backend.herokuapp.com/health
```

---

## 🚀 Next Steps

1. **Deploy backend** using guide above
2. **Update extension** with backend URL
3. **Test** scheduling an email
4. **Shut down PC** and verify email sends
5. **Monitor** logs for any issues
6. **Scale** as needed

---

## 🎊 Congratulations!

Your backend server is now running! Emails will send 24/7, even when PC is off! 🚀

**Users can now:**
- ✅ Schedule emails
- ✅ Turn off PC
- ✅ Go for a walk
- ✅ Enjoy life
- ✅ Emails still send on time!

**No limitations!** 🎉

