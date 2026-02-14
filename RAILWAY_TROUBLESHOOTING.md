# Railway Deployment Troubleshooting Guide

## Quick Diagnostic Steps

### Step 1: Get Your Railway URL

1. Go to Railway Dashboard: https://railway.app
2. Click on your **SiteManagement** project
3. Click on the **SiteManagement** service
4. Find the **Public Domain** (e.g., `sitemanagement-production.up.railway.app`)

### Step 2: Test Backend API Directly

Open these URLs in your browser (replace `YOUR-RAILWAY-URL` with your actual URL):

#### Test 1: Health Check
```
https://YOUR-RAILWAY-URL.up.railway.app/api/health
```
**Expected:** `{"status":"OK","database":"Connected"}`

#### Test 2: Admin User Check
```
https://YOUR-RAILWAY-URL.up.railway.app/check-admin-profiles
```
**Expected:** JSON showing admin user details

#### Test 3: Login Endpoint
Try logging in via API directly using curl or Postman:
```bash
curl -X POST https://YOUR-RAILWAY-URL.up.railway.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@2026"}'
```
**Expected:** JSON with `success: true` and a token

### Step 3: Check Railway Deployment Logs

1. Railway Dashboard → SiteManagement service
2. Click **Deployments** tab
3. Click on the latest deployment
4. Look for these messages:
   - ✅ `📂 Contents of dist: [files]` - Frontend built successfully
   - ✅ `🚀 Server started on port XXXX` - Backend started
   - ❌ `dist folder not found` - Frontend build failed
   - ❌ Any error messages

### Step 4: Check Environment Variables

1. Railway Dashboard → SiteManagement service
2. Click **Variables** tab
3. Verify these are set:
   - `DATABASE_URL` - PostgreSQL connection string
   - `JWT_SECRET` - Your JWT secret
   - `NODE_ENV` - Should be `production` (optional)

## Common Issues & Solutions

### Issue 1: Frontend Shows Error Page

**Symptoms:** "Une erreur est survenue" on homepage

**Causes:**
- Frontend build didn't complete
- Frontend can't reach backend API
- CORS issues

**Solutions:**
1. Check if `/api/health` endpoint works (Step 2, Test 1)
2. If health check fails → Backend not running
3. If health check works → Frontend routing issue

### Issue 2: Login Fails with Correct Credentials

**Symptoms:** "Invalid credentials" even with `admin` / `Admin@2026`

**Causes:**
- Frontend not sending request to backend
- CORS blocking the request
- Password mismatch in database

**Solutions:**
1. Test login via curl (Step 2, Test 3)
2. If curl works → Frontend issue
3. If curl fails → Check database with `diagnose-railway.js`

### Issue 3: 404 on All Routes

**Symptoms:** All pages show 404 error

**Causes:**
- Frontend not built
- Express not serving static files

**Solutions:**
1. Check Railway logs for "dist folder exists"
2. Redeploy if dist folder missing

## Emergency Fix: Force Rebuild

If nothing works, force a complete rebuild:

```bash
# In your local project
git commit --allow-empty -m "Force Railway rebuild"
git push origin main
```

Railway will automatically detect the push and rebuild.

## Need Help?

If you've tried all the above and still have issues, provide:
1. Your Railway app URL
2. Screenshot of Railway deployment logs
3. Result of `/api/health` endpoint test

## Login Credentials

Once everything is working, login with:
- **Username:** `admin`
- **Password:** `Admin@2026`

**Security Note:** Change this password immediately after first login!
