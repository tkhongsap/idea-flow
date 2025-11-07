# 🚀 IdeaFlow Deployment Guide

This guide walks you through deploying IdeaFlow with the secure backend architecture. You'll create **two Replit apps** that work together while keeping your code in **one repository**.

## 📊 Architecture Overview

```
┌─────────────────────────────────────────────┐
│  Your Single Git Repository (ideaflow)      │
│  ├── frontend files (React + Vite)          │
│  └── backend/ folder (Express API)          │
└─────────────────────────────────────────────┘
           │
           ├──────────────────┬──────────────────┐
           ▼                  ▼                  ▼
   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
   │ Frontend App │   │ Backend App  │   │  Gemini API  │
   │  (Replit)    │──▶│  (Replit)    │──▶│  (Google)    │
   │  Port 5000   │   │  Port 3000   │   └──────────────┘
   └──────────────┘   └──────────────┘
   
   Users interact       Proxies API        AI Processing
   with React UI        calls securely
```

**Benefits:**
- ✅ One codebase to maintain (Git repo)
- ✅ Two independent deployments (better isolation)
- ✅ API key never exposed to users
- ✅ Independent scaling and monitoring

---

## 🎯 Step 1: Create Backend Replit App

### 1.1 Create New Replit

1. Go to [replit.com](https://replit.com)
2. Click **"+ Create Replit"**
3. Choose **"Import from GitHub"** OR **"Node.js"** template
4. Name it: `ideaflow-backend` (or your preferred name)
5. Click **"Create Replit"**

### 1.2 Upload Backend Files

In your new backend Replit, you need to upload the `backend/` folder contents:

**Option A: Copy Files Manually**
1. In the backend Replit, create these files:
   - `server.js` (copy from `backend/server.js`)
   - `package.json` (copy from `backend/package.json`)
   - `.replit` (copy from `backend/.replit`)
   - `replit.nix` (copy from `backend/replit.nix`)
   - `.gitignore` (copy from `backend/.gitignore`)

**Option B: Clone Repo and Navigate**
1. In the backend Replit Shell, run:
   ```bash
   git clone <your-repo-url>
   cd <repo-name>/backend
   npm install
   ```

---

## 🔐 Step 2: Configure Backend Secrets

Secrets keep your API keys secure. Never put them in code!

### 2.1 Add Secrets in Backend Replit

1. In your **backend Replit**, click the **🔒 Lock icon** in the left sidebar (Secrets)
2. Click **"+ New Secret"**

**Add Secret #1:**
- Key: `GEMINI_API_KEY`
- Value: Your Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)

**Add Secret #2:**
- Key: `FRONTEND_URL`
- Value: We'll get this in Step 3, use placeholder for now: `https://placeholder.replit.dev`

> ⚠️ **Important:** You'll update `FRONTEND_URL` after deploying the frontend!

---

## 🚀 Step 3: Deploy Backend

### 3.1 Install Dependencies

In the **backend Replit Shell**, run:
```bash
npm install
```

### 3.2 Test Locally

Click the **"Run"** button. You should see:
```
IdeaFlow Backend API running on port 3000
Environment: development
```

Test the health endpoint:
```bash
curl http://localhost:3000/health
```

Should return:
```json
{"status":"ok","timestamp":"..."}
```

### 3.3 Deploy to Production

1. Click the **"Deploy"** button (rocket icon) in the top right
2. Choose **"Autoscale"** deployment
3. Click **"Deploy"**
4. Wait for deployment to complete
5. **Copy the deployment URL** (e.g., `https://ideaflow-backend.username.replit.app`)

> 💡 **Save this URL!** You'll need it for the frontend configuration.

---

## 🎨 Step 4: Configure Frontend

Now we'll connect your existing frontend Replit to the backend.

### 4.1 Add Frontend Secret

1. Go to your **frontend Replit** (ideaflow app)
2. Click the **🔒 Lock icon** (Secrets)
3. Click **"+ New Secret"**

**Add Secret:**
- Key: `VITE_BACKEND_API_URL`
- Value: Your backend URL from Step 3.3 (e.g., `https://ideaflow-backend.username.replit.app`)

### 4.2 Update Backend FRONTEND_URL

Now that you have your frontend URL, update the backend:

1. Go back to your **backend Replit**
2. Click **🔒 Secrets**
3. Find the `FRONTEND_URL` secret
4. Click **Edit**
5. Update value to your frontend URL (e.g., `https://ideaflow.username.replit.dev`)
6. Click **Save**

> ⚠️ **Critical:** This must be the exact URL! The backend only accepts requests from this specific domain.

---

## ✅ Step 5: Test Everything

### 5.1 Restart Frontend

In your **frontend Replit**:
1. Click **"Stop"** if running
2. Click **"Run"** to restart with the new backend URL

### 5.2 Test Core Features

Open your IdeaFlow app and test:

**✓ Capture Idea (Text)**
1. Type an idea in the input box
2. Click "Capture Idea"
3. Should appear in the ideas list below

**✓ Voice Recording**
1. Click "Record Voice"
2. Allow microphone access
3. Say something (e.g., "This is a test idea")
4. Click stop
5. Should transcribe and add to ideas list

**✓ Semantic Search**
1. Add a few different ideas
2. Use the search box (⌘K)
3. Type a query (e.g., "ideas about testing")
4. Should find relevant ideas

**✓ Theme Chat**
1. Click "Themes" tab
2. Click on a theme
3. Type a question in the chat
4. Should get AI responses

### 5.3 Verify API Key Security

Open browser DevTools (F12):
1. Go to **Sources** tab
2. Press `Cmd+Shift+F` (Mac) or `Ctrl+Shift+F` (Windows)
3. Search for: `AIza`
4. **Should find ZERO matches** ✅

If you find your API key, something went wrong - contact support.

---

## 🔍 Troubleshooting

### Frontend shows "Failed to fetch" errors

**Cause:** Backend URL not configured or incorrect

**Fix:**
1. Check `VITE_BACKEND_API_URL` secret in frontend Replit
2. Verify it matches your backend deployment URL exactly
3. Restart the frontend

### Backend returns CORS errors

**Cause:** `FRONTEND_URL` doesn't match actual frontend URL

**Fix:**
1. Check `FRONTEND_URL` secret in backend Replit
2. Update to exact frontend URL (including https://)
3. Restart the backend deployment

### "API key not configured" error

**Cause:** Missing `GEMINI_API_KEY` in backend

**Fix:**
1. Go to backend Replit → Secrets
2. Add `GEMINI_API_KEY` with your Google API key
3. Restart backend

### Voice recording doesn't work

**Cause:** HTTPS required for microphone access

**Fix:**
- Use the deployed Replit URL (https://...), not localhost
- Browser must support Web Audio API

---

## 📊 Monitoring & Logs

### Backend Logs

In your **backend Replit**:
1. Click the **"Logs"** tab
2. View API requests, errors, and rate limiting events

### Frontend Logs

In your **frontend Replit**:
1. Open browser DevTools (F12)
2. Check the **Console** tab for errors

---

## 💰 Cost Considerations

**Replit Costs:**
- Backend Autoscale: Only charged when requests are made
- Frontend: Regular Replit hosting

**Gemini API Costs:**
- Rate limited to 100 requests per 15 minutes
- Monitor usage in [Google AI Studio](https://aistudio.google.com/)

---

## 🔄 Making Updates

### Updating Backend Code

1. Edit files in your Git repo
2. Push changes to GitHub
3. In backend Replit, pull latest: `git pull`
4. Redeploy: Click **"Deploy"** button

### Updating Frontend Code

1. Edit files in frontend Replit (or push from Git)
2. Frontend auto-rebuilds on save
3. Test changes in the preview

---

## 🎉 You're Done!

Your IdeaFlow app is now securely deployed with:
- ✅ Protected API key (backend only)
- ✅ Rate limiting (100 req/15min)
- ✅ CORS security (specific frontend only)
- ✅ Independent scaling
- ✅ Production-ready architecture

**Next Steps:**
- Share your app URL with users
- Monitor backend logs for usage patterns
- Consider adding user authentication for multi-user support

---

## 📚 Additional Resources

- **Backend API Documentation:** See `backend/README.md`
- **Security Details:** See `API_SECURITY_FIX_SUMMARY.md`
- **Replit Deployment Docs:** https://docs.replit.com/hosting/deployments/about-deployments

Need help? Check the troubleshooting section or review the backend logs for specific error messages.
