# 🚀 Render Deployment Guide

Deploy the TaskForce Email Backend on Render using the provided `render.yaml` blueprint.

---

## ✅ What’s included
- `render.yaml` (blueprint): provisions a free Postgres database and a Node web service
- Auto-wires `DATABASE_URL` from the database to the service
- Uses `backend` as the root directory with `node server.js`
- Cron handled by node-cron in the server (always-on on Render)

---

## 1) One‑click deployment

### Option A: Render Blueprint (recommended)
1. Push changes (already done)
2. Go to https://render.com
3. Click New → Blueprint
4. Paste your GitHub repo URL: `https://github.com/Raylyrix/TASKFORCE-EXTENTION`
5. Review resources:
   - Database: `taskforce-postgres` (Free)
   - Web Service: `taskforce-email-backend` (Free)
6. Click Apply → Deploy

### Option B: Manual setup
1. Create a new Web Service from Git repo
2. Root Directory: `backend`
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. Add a PostgreSQL database (Render → New → PostgreSQL)
6. Copy `External Database URL` to env var `DATABASE_URL`

---

## 2) Environment variables (Service → Environment)
Add the following:

- `NODE_ENV=production`
- `GOOGLE_CLIENT_ID=1007595181381-ccpidhl425plue2cuns97288df1b6290.apps.googleusercontent.com`
- `GOOGLE_CLIENT_SECRET=your-secret-here`
- `DATABASE_URL` (auto-wired by blueprint; if manual, paste value from your DB)

Optional:
- `JWT_SECRET=your-random-secret`

> Note: Port is managed by Render via `process.env.PORT`. The blueprint sets a placeholder, but the app already uses `process.env.PORT || 3000`.

---

## 3) Verify
After deploy, open the service URL and check:

```
GET /health
```

You should see:
```json
{"status":"ok","timestamp":"..."}
```

Check Logs → should show server start and cron checks.

---

## 4) Point the extension
Edit `backend-integration.js`:
```javascript
const BACKEND_URL = 'https://your-service.onrender.com';
```
Commit and push:
```bash
git add backend-integration.js
git commit -m "Point extension to Render backend"
git push
```
Reload your Chrome extension.

---

## 5) Notes on cron & reliability
- Render services are always-on on Free/Starter tiers → `node-cron` works
- No extra configuration needed for cron jobs
- For heavy workloads, consider a separate worker service

---

## 6) Troubleshooting
- Build fails → ensure Root Directory is `backend`
- DB connection → confirm `DATABASE_URL` exists and DB is ready
- OAuth errors → verify `GOOGLE_CLIENT_ID/SECRET` and Google Cloud project
- 404 on `/health` → ensure you deployed `backend/server.js` and set rootDir correctly

---

## 7) Cost
- Free tier is typically enough to start
- Upgrade plan if you need more resources or custom scaling

---

## 8) Success checklist
- [ ] Service deployed on Render
- [ ] `/health` returns `ok`
- [ ] `DATABASE_URL` populated
- [ ] Emails sent on schedule (cron running)
- [ ] Extension updated with Render URL

---

## 🎉 Done!
You’re ready to run 24/7 on Render. The backend will send emails even when users’ PCs are off.
