# 🚂 Railway Deployment Guide

## 🎉 Repository Pushed!

**GitHub**: https://github.com/Raylyrix/TASKFORCE-EXTENTION.git ✅

---

## 🚀 Deploy to Railway (Step-by-Step)

### Step 1: Sign Up for Railway

1. Go to [railway.app](https://railway.app)
2. Click **"Login"** → **"Start a New Project"**
3. Sign in with GitHub

### Step 2: Create New Project

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Find **"TASKFORCE-EXTENTION"** repository
4. Click **"Deploy Now"**

### Step 3: Configure Project

Railway will detect Node.js automatically. You'll see:

- **Detected**: Node.js
- **Build Command**: `npm install`
- **Start Command**: `node backend/server.js`

### Step 4: Add PostgreSQL Database

1. Click **"+ New"** button
2. Select **"Database"** → **"Add PostgreSQL"**
3. Wait for database to provision (30 seconds)
4. Railway creates database automatically!

### Step 5: Set Environment Variables

1. Click on your service
2. Go to **"Variables"** tab
3. Add these variables:

```bash
# Server Config
PORT=3000
NODE_ENV=production

# Database (Railway provides this automatically)
# DATABASE_URL is auto-set by Railway! Don't add it manually.

# Google OAuth (Add your credentials)
GOOGLE_CLIENT_ID=1007595181381-ccpidhl425plue2cuns97288df1b6290.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here

# Optional
JWT_SECRET=your-secret-key
```

**Important**: Railway automatically sets `DATABASE_URL` when you add PostgreSQL!

### Step 6: Update Start Command

1. Go to **"Settings"** tab
2. Find **"Start Command"**
3. Change to: `cd backend && npm install && npm start`
4. Or set **"Root Directory"** to: `backend`

### Step 7: Deploy!

Railway will automatically:
1. Install dependencies
2. Run build
3. Start server
4. Show live logs

---

## 🎯 Railway-Specific Configuration

### Root Directory Setup

In Railway settings:
1. **Settings** → **"Root Directory"**
2. Set to: `backend`
3. This tells Railway where your Node.js app is

### Or Update package.json (Alternative)

Create `package.json` in root:

```json
{
  "scripts": {
    "start": "cd backend && npm start"
  }
}
```

---

## 📊 Monitor Deployment

### View Logs
- Click on your service
- See live deployment logs
- Watch for errors

### Check Health
Once deployed, Railway gives you a URL like:
```
https://taskforce-email-backend-production.up.railway.app
```

Test it:
```bash
curl https://your-app.railway.app/health
```

Should return:
```json
{"status":"ok","timestamp":"..."}
```

---

## 🔧 Backend Configuration

### Update Extension Backend URL

Once Railway gives you the URL:

1. Open `backend-integration.js`
2. Update line 6:

```javascript
const BACKEND_URL = 'https://your-app.railway.app'; // Your Railway URL
```

3. Commit and push:
```bash
git add backend-integration.js
git commit -m "Update backend URL to Railway"
git push
```

---

## 🌐 Custom Domain (Optional)

1. Go to Railway **"Settings"**
2. Click **"Generate Domain"**
3. Railway gives you a domain
4. Or add your own custom domain

---

## 📈 Railway Features

### Free Tier Includes:
- ✅ 500 hours/month compute
- ✅ $5 credit for services
- ✅ PostgreSQL database
- ✅ Automatic deployments
- ✅ HTTPS by default
- ✅ Environment variables
- ✅ Team collaboration

### Upgrade for Production:
- **Pro**: $20/month
- More resources
- Priority support
- Custom domains

---

## 🔍 Troubleshooting

### Issue: Build Failed

**Check:**
- Root directory set to `backend`
- Package.json exists in backend folder
- All dependencies listed

### Issue: Port Error

**Solution:**
Railway sets `PORT` automatically. Your code should use:
```javascript
const PORT = process.env.PORT || 3000;
```

### Issue: Database Connection Failed

**Check:**
- `DATABASE_URL` is set (Railway auto-sets this)
- PostgreSQL addon is running
- Credentials are correct

### Issue: Cron Jobs Not Running

**Solution:**
Railway runs your server 24/7, so cron jobs work automatically!
No special configuration needed.

---

## ✅ Success Checklist

After deployment:

- [ ] Railway shows "Deployed" status
- [ ] Health endpoint returns `{"status":"ok"}`
- [ ] Logs show "Server running on port..."
- [ ] No errors in logs
- [ ] PostgreSQL connected
- [ ] Environment variables set
- [ ] Extension updated with new URL

---

## 🎉 Deployed!

Your backend is now running 24/7 on Railway!

**Backend URL**: `https://your-app.railway.app`
**Status**: Always-on ✅
**Cron Jobs**: Running every minute ✅
**Database**: PostgreSQL connected ✅

---

## 📋 Quick Reference

### Railway Dashboard
- **URL**: https://railway.app/dashboard
- **View**: Services, databases, logs
- **Deploy**: Automatic from GitHub

### Useful Commits
```bash
# Get Railway URL
railway status

# View logs
railway logs

# Open shell
railway shell

# Add environment variable
railway variables set GOOGLE_CLIENT_ID=xxx
```

---

## 🚀 Next Steps

1. **Test backend**: Visit `/health` endpoint
2. **Update extension**: Change `BACKEND_URL`
3. **Test full flow**: Schedule email, turn off PC
4. **Monitor**: Watch logs for 24 hours
5. **Scale**: Upgrade if needed

---

## 📞 Support

Railway Support:
- Discord: https://discord.gg/railway
- Docs: https://docs.railway.app
- Community: https://community.railway.app

---

## 🎊 Enjoy!

Your backend is deployed! Emails will send 24/7! 🚀

**Users can now:**
- Schedule emails
- Turn off PC
- Go for a walk
- Enjoy life!

**No limitations!** 🎉

