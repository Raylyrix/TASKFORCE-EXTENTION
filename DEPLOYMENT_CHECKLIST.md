# ✅ Deployment Checklist

## 🎯 Repository Status

**GitHub**: https://github.com/Raylyrix/TASKFORCE-EXTENTION.git  
**Status**: ✅ Pushed Successfully  
**Files**: 90 files, 19,437+ lines of code  
**Branches**: main

---

## 🚀 Railway Deployment Steps

### 1. Sign Up & Login ⏱️ 2 min
- [ ] Go to https://railway.app
- [ ] Click "Login" → "Start a New Project"
- [ ] Sign in with GitHub account

### 2. Create Project ⏱️ 1 min
- [ ] Click "New Project"
- [ ] Select "Deploy from GitHub repo"
- [ ] Find "TASKFORCE-EXTENTION"
- [ ] Click "Deploy Now"

### 3. Configure Settings ⏱️ 2 min
- [ ] Go to Settings → Root Directory
- [ ] Set to: `backend`
- [ ] Save changes

### 4. Add PostgreSQL ⏱️ 1 min
- [ ] Click "+ New" button
- [ ] Select "Database" → "Add PostgreSQL"
- [ ] Wait for provisioning (30 seconds)

### 5. Set Environment Variables ⏱️ 3 min
- [ ] Click on your service
- [ ] Go to "Variables" tab
- [ ] Add:
  ```bash
  GOOGLE_CLIENT_ID=1007595181381-ccpidhl425plue2cuns97288df1b6290.apps.googleusercontent.com
  GOOGLE_CLIENT_SECRET=your-client-secret-here
  JWT_SECRET=your-secret-key (optional)
  ```
- [ ] NOTE: DATABASE_URL is auto-set by Railway!

### 6. Monitor Deployment ⏱️ 2 min
- [ ] Watch logs for build progress
- [ ] Wait for "Deployed" status
- [ ] Copy deployment URL

### 7. Test Backend ⏱️ 1 min
- [ ] Visit: `https://your-app.railway.app/health`
- [ ] Should return: `{"status":"ok",...}`
- [ ] Check logs for "Server running"

### 8. Update Extension ⏱️ 3 min
- [ ] Open `backend-integration.js`
- [ ] Update line 6 with Railway URL:
  ```javascript
  const BACKEND_URL = 'https://your-app.railway.app';
  ```
- [ ] Commit and push:
  ```bash
  git add backend-integration.js
  git commit -m "Update backend URL"
  git push
  ```

### 9. Test Full Flow ⏱️ 5 min
- [ ] Reload extension in Chrome
- [ ] Schedule test email
- [ ] Check Railway logs
- [ ] Verify email sends

---

## ✅ Success Indicators

After deployment, you should see:

### Railway Dashboard:
- [ ] Service status: "Running" (green)
- [ ] Last deployment: Just now
- [ ] Logs show: "Server running on port..."
- [ ] No errors in logs

### Health Check:
- [ ] URL returns JSON response
- [ ] Status: "ok"
- [ ] Timestamp present

### Extension:
- [ ] Backend connected
- [ ] Can schedule emails
- [ ] Notification appears
- [ ] Emails send successfully

---

## 🔧 Configuration Summary

### Environment Variables Needed:
```bash
# Auto-set by Railway
DATABASE_URL=postgresql://... ✅

# You need to add:
GOOGLE_CLIENT_ID=... ⚠️
GOOGLE_CLIENT_SECRET=... ⚠️
JWT_SECRET=... (optional)
```

### Google OAuth Setup:
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. APIs & Services → Credentials
3. Find your OAuth 2.0 Client
4. Copy Client ID and Secret
5. Add to Railway variables

---

## 🐛 Common Issues

### Build Fails
**Solution**: Check Root Directory is set to `backend`

### Database Connection Error
**Solution**: Verify PostgreSQL addon is running

### Port Already in Use
**Solution**: Use `process.env.PORT` (Railway auto-sets this)

### Cron Not Working
**Solution**: Cron works automatically on Railway! No config needed.

---

## 📊 Post-Deployment

### Monitor for 24 Hours:
- [ ] Check logs for errors
- [ ] Monitor email sending
- [ ] Test with real users
- [ ] Verify database growth

### Upgrade When Needed:
- [ ] Free tier: 500 hours/month
- [ ] Pro tier: $20/month (if needed)
- [ ] Enterprise: Custom pricing

---

## 🎉 You're Done!

**Time to deploy**: ~15 minutes  
**Cost**: FREE  
**Result**: Backend running 24/7! 🚀

---

## 📝 Quick Commands

```bash
# Clone repo
git clone https://github.com/Raylyrix/TASKFORCE-EXTENTION.git

# Update backend URL
# Edit backend-integration.js line 6

# Push changes
git add backend-integration.js
git commit -m "Update backend URL"
git push

# Check Railway logs (via dashboard)
# Or use Railway CLI
railway logs
```

---

## 🚀 Start Deploying!

Go to: https://railway.app/dashboard

Follow steps above and you'll be live in 15 minutes! 🎊

