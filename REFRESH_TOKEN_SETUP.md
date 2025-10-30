# 🔐 Refresh Token Setup (Backend OAuth)

To enable true 24/7 background sending, the backend must hold a Google OAuth refresh token per user.

## What we added
- `GET /api/auth/start` → redirects to Google Consent Screen (prompt=consent, access_type=offline)
- `GET /api/auth/callback` → exchanges code for tokens, stores refresh token with user email
- `BACKEND_PUBLIC_URL` → used to build redirect URI (set to your Render URL)

## Configure on Render
1. Add env vars on the service:
   - `BACKEND_PUBLIC_URL=https://your-service.onrender.com`
   - `GOOGLE_CLIENT_ID=...`
   - `GOOGLE_CLIENT_SECRET=...`
   - `DATABASE_URL` (auto from Render/Postgres)
2. Redeploy

## Chrome Extension flow
- Extension opens a tab to `BACKEND_URL/api/auth/start`
- User completes Google consent
- Backend stores refresh token
- Backend can now send emails 24/7 using refresh tokens

## Notes
- If no refresh token is returned, ensure a fresh consent session (prompt=consent) and `access_type=offline`.
- For accounts that already consented, revoke access or add `prompt=consent` to force re-consent.
