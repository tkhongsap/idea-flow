# IdeaFlow Backend Setup - Quick Reference

> 📘 **For full deployment instructions, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)**

This document provides technical details about the backend architecture. For step-by-step deployment instructions, use the main deployment guide.

## 🔒 Security Issue Fixed

Previously, the Gemini API key was exposed in the frontend JavaScript bundle, which meant:
- ❌ Anyone could inspect your code and steal the API key
- ❌ Malicious users could run up thousands in API charges
- ❌ No rate limiting or usage control

**Now with the backend proxy:**
- ✅ API key is stored securely on the server (never sent to the browser)
- ✅ **Strict CORS policy** - Only your specific frontend URL can access the API
- ✅ Rate limiting prevents abuse (100 requests per 15 minutes per IP)
- ✅ Request validation on all endpoints
- ✅ Full control over API usage and costs

### How the Security Works

The backend implements multiple layers of protection:

1. **API Key Protection**: The Gemini API key lives only in backend Replit Secrets, never in the frontend code
2. **CORS Restriction**: The backend **only accepts requests from your specific frontend URL** (set in `FRONTEND_URL`)
   - Other websites cannot call your API
   - Other Replit apps cannot steal your API credits
   - Malicious users are blocked at the CORS level
3. **Rate Limiting**: Maximum 100 requests per 15 minutes per IP address
4. **Request Validation**: All API endpoints validate input before processing

## 📋 Prerequisites

- A Replit account
- Google Gemini API key ([Get one here](https://aistudio.google.com/apikey))

## 🚀 Setup Steps

### Part 1: Create Backend API (Separate Replit App)

#### 1. Create New Replit App for Backend

1. Go to [Replit](https://replit.com)
2. Click **"Create Repl"**
3. Choose **"Node.js"** template
4. Name it: `ideaflow-backend-api` (or similar)
5. Click **"Create Repl"**

#### 2. Upload Backend Files

In your new backend Replit app, upload these files from the `backend/` folder:
- `package.json`
- `server.js`
- `.env.example`
- `.gitignore`
- `README.md`

You can do this by:
- Dragging and dropping files into the Replit file explorer, OR
- Using the "Upload file" button in the Replit file explorer

#### 3. Configure Secrets

1. In your backend Replit app, click **"Tools"** (🔧) in the left sidebar
2. Click **"Secrets"**
3. Add these secrets:

   **Secret 1: GEMINI_API_KEY**
   - Key: `GEMINI_API_KEY`
   - Value: `[Your Gemini API key from Google AI Studio]`

   **Secret 2: FRONTEND_URL** (⚠️ CRITICAL FOR SECURITY!)
   - Key: `FRONTEND_URL`
   - Value: `https://[your-frontend-repl-name].[your-username].replit.dev`

   > ⚠️ **SECURITY CRITICAL:** This must be your **exact** frontend URL. The backend will ONLY accept API requests from this specific URL. This prevents other apps from stealing your API credits.
   
   > 💡 To find your frontend URL: Go to your frontend Replit app, click the "Run" button, and copy the URL from the webview.

#### 4. Install Dependencies

In the backend Replit Shell, run:
```bash
npm install
```

#### 5. Test Locally

Start the server:
```bash
npm start
```

You should see:
```
✅ IdeaFlow Backend API running on port 3000
🔒 API Key configured: Yes
🌐 Frontend URL: [your-frontend-url]
```

Test the health endpoint by clicking the webview URL in Replit. You should see:
```json
{
  "message": "IdeaFlow Backend API",
  "endpoints": [...]
}
```

#### 6. Deploy Backend to Production

1. Click the **"Deploy"** button in Replit (top right)
2. Choose **"Autoscale"** deployment type (recommended for APIs that handle variable traffic)
3. Configure deployment settings:
   - Name: `ideaflow-backend-api`
   - Type: Autoscale
4. Click **"Deploy"**

Once deployed, **copy your production URL**. It will look like:
```
https://ideaflow-backend-api.[your-username].repl.co
```

**⚠️ IMPORTANT:** Save this URL - you'll need it for the frontend!

---

### Part 2: Update Frontend App (This Repl)

#### 1. Create Environment Variable File

Create a `.env` file in the root of this frontend project:

```bash
# .env
VITE_BACKEND_API_URL=https://ideaflow-backend-api.[your-username].repl.co
```

Replace `[your-username]` with your actual Replit username and the backend URL from Part 1, Step 6.

For local development with the backend running locally:
```bash
VITE_BACKEND_API_URL=http://localhost:3000
```

#### 2. Add .env to Replit Secrets (for Deployment)

1. In this frontend Replit app, click **"Tools"** → **"Secrets"**
2. Add the secret:
   - Key: `VITE_BACKEND_API_URL`
   - Value: `https://ideaflow-backend-api.[your-username].repl.co`

#### 3. Update Frontend Secrets in Backend

Go back to your **backend** Replit app and update the `FRONTEND_URL` secret:
- Key: `FRONTEND_URL`
- Value: Your frontend URL (e.g., `https://[your-frontend-repl].[username].replit.dev`)

This ensures CORS only allows requests from your frontend.

#### 4. Test the Integration

1. In this frontend app, click **"Run"**
2. Try capturing an idea and organizing it
3. Check that AI features work correctly
4. Open browser DevTools → Network tab
5. You should see requests going to your backend API URL (e.g., `https://ideaflow-backend-api.[username].repl.co/api/organize`)

---

## ✅ Verification Checklist

- [ ] Backend deployed and running on Replit
- [ ] Backend health check returns success (`GET /api/health`)
- [ ] `GEMINI_API_KEY` set in backend Secrets
- [ ] `FRONTEND_URL` set in backend Secrets
- [ ] `VITE_BACKEND_API_URL` set in frontend `.env` file
- [ ] `VITE_BACKEND_API_URL` set in frontend Secrets (for deployment)
- [ ] Frontend successfully calls backend API endpoints
- [ ] No API key visible in frontend JavaScript bundle (check DevTools → Sources)
- [ ] AI features (organize, search, chat, transcribe) work correctly

## 🔍 Verifying API Key is NOT Exposed

To verify the API key is no longer exposed in the frontend:

1. Open your IdeaFlow app in a browser
2. Open DevTools (F12 or right-click → Inspect)
3. Go to **Sources** tab
4. Press `Cmd+Shift+F` (Mac) or `Ctrl+Shift+F` (Windows) to search all files
5. Search for: `AIza` (the prefix of Google API keys)
6. **You should find ZERO results** ✅

Previously, you would have found the API key in the bundled JavaScript.

## 🐛 Troubleshooting

### Backend Issues

**Error: "GEMINI_API_KEY environment variable is not set"**
- Make sure you added `GEMINI_API_KEY` to **Secrets** in the backend Replit app
- Restart the backend server

**CORS errors in browser console**
- Check that `FRONTEND_URL` in backend Secrets matches your frontend URL exactly
- Make sure both HTTP/HTTPS protocols match

**Rate limit errors (429 Too Many Requests)**
- You've exceeded 100 requests in 15 minutes
- Wait 15 minutes or increase the limit in `server.js` (line 41)

### Frontend Issues

**Error: "VITE_BACKEND_API_URL environment variable is not set"**
- Create `.env` file with `VITE_BACKEND_API_URL=...`
- Restart the frontend dev server

**Network errors when calling API**
- Check that backend is running and deployed
- Verify `VITE_BACKEND_API_URL` points to the correct backend URL
- Check browser Network tab for actual error response

**AI features not working**
- Open browser DevTools → Console tab
- Look for error messages
- Check Network tab to see if API calls are being made
- Verify backend `/api/health` endpoint returns success

## 📊 Monitoring API Usage

To monitor your Gemini API usage and costs:

1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Go to API Dashboard
3. Check usage metrics
4. Set up billing alerts in Google Cloud Console

## 🎉 Success!

Your IdeaFlow app now has:
- ✅ Secure API key storage (backend only)
- ✅ Rate limiting (100 requests per 15 minutes)
- ✅ CORS protection
- ✅ Full control over API usage
- ✅ No risk of API key theft

The API key is **never exposed** to the frontend, so malicious users cannot steal it!

## 📝 Next Steps

- [ ] Test all features thoroughly
- [ ] Monitor API usage in Google AI Studio
- [ ] Set up billing alerts to avoid unexpected charges
- [ ] Consider implementing user authentication for additional security
- [ ] Adjust rate limits based on your usage patterns

## 📞 Support

If you encounter issues:
1. Check this documentation first
2. Review the backend `README.md` for additional details
3. Check backend logs in Replit for errors
4. Verify environment variables are set correctly in both apps
