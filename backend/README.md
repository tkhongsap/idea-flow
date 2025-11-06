# IdeaFlow Backend API

Secure backend proxy for IdeaFlow's Gemini AI integration. This server protects your API key and adds rate limiting.

## Setup in Replit

### 1. Create New Replit App

1. Go to [Replit](https://replit.com)
2. Click **"Create Repl"**
3. Choose **"Node.js"** template
4. Name it something like `ideaflow-backend-api`

### 2. Upload Backend Files

Copy these files to your new Replit app:
- `package.json`
- `server.js`
- `.env.example`

### 3. Configure Secrets

1. In your Replit app, click on **"Tools"** (🔧) in the left sidebar
2. Click on **"Secrets"**
3. Add the following secrets:

   **GEMINI_API_KEY (Required)**
   - Key: `GEMINI_API_KEY`
   - Value: Your actual Gemini API key from Google AI Studio
   
   **FRONTEND_URL (Critical for Security!)**
   - Key: `FRONTEND_URL`
   - Value: Your **exact** frontend Replit app URL (e.g., `https://your-frontend-app.replit.dev`)
   
   ⚠️ **SECURITY CRITICAL:** The `FRONTEND_URL` must be set to your exact frontend URL. This prevents unauthorized apps from using your backend API and stealing API credits. Only requests from this specific URL will be allowed.

### 4. Install Dependencies

In the Replit Shell, run:
```bash
npm install
```

### 5. Start the Server

In the Replit Shell, run:
```bash
npm start
```

The server will start on port 3000 (or whatever port Replit assigns).

### 6. Deploy to Production

1. Click the **"Deploy"** button in Replit
2. Choose **"Autoscale"** deployment type (recommended for APIs)
3. Configure deployment settings
4. Click **"Deploy"**

Once deployed, you'll get a production URL like:
`https://ideaflow-backend-api.username.repl.co`

**Save this URL** - you'll need it in your frontend configuration!

## API Endpoints

All endpoints are prefixed with `/api/`:

### POST /api/organize
Organize raw ideas into themes
```json
{
  "rawIdeas": [
    {
      "id": "idea-1",
      "content": "Build a note-taking app",
      "timestamp": "2025-11-06T10:00:00Z",
      "sourceType": "text"
    }
  ]
}
```

### POST /api/search
Semantic search across ideas and themes
```json
{
  "query": "productivity apps",
  "ideas": [...],
  "themes": [...]
}
```

### POST /api/chat
Chat with a theme
```json
{
  "theme": { "title": "...", "summary": "...", ... },
  "history": [],
  "newMessage": "Tell me more about this"
}
```

### POST /api/transcribe
Transcribe audio to text
```json
{
  "audioBase64": "base64_encoded_audio_data",
  "mimeType": "audio/webm"
}
```

### GET /api/health
Health check endpoint

## Rate Limiting

- **100 requests per 15 minutes** per IP address
- Prevents API abuse and controls costs
- Returns `429 Too Many Requests` when limit exceeded

## Security Features

- ✅ **API key stored securely** in Replit Secrets (never exposed to frontend)
- ✅ **Strict CORS policy** - Only allows requests from your specific frontend URL (set via `FRONTEND_URL`)
- ✅ **Rate limiting** - 100 requests per 15 minutes per IP address
- ✅ **Request validation** on all endpoints
- ✅ **Error handling** with appropriate status codes
- ✅ **CORS attack prevention** - Unauthorized domains cannot access your API

### How CORS Protection Works

The backend only accepts API requests from:
1. Your specific frontend URL (set in `FRONTEND_URL` secret)
2. `localhost:5000` and `localhost:3000` (for local development only)

**Any other domain** attempting to use your API will receive a CORS error. This prevents:
- Malicious websites from stealing your API credits
- Other Replit apps from using your backend
- Unauthorized access to your Gemini API quota

## Troubleshooting

### "API key not set" error
Make sure you've added `GEMINI_API_KEY` to Replit Secrets (not as a regular environment variable).

### CORS errors
1. Make sure `FRONTEND_URL` in Secrets matches your frontend app URL exactly
2. Check that your frontend is making requests to the correct backend URL

### Rate limit errors
If you're hitting rate limits during development, you can temporarily increase the limit in `server.js`:
```javascript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200, // Increase this number
  // ...
});
```

## Cost Monitoring

To monitor your Gemini API usage:
1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Check your API usage dashboard
3. Set up billing alerts in Google Cloud Console

## Next Steps

After deploying this backend:
1. Copy the production URL
2. Update your frontend's environment variables with this URL
3. Update frontend code to call this API instead of Gemini directly
4. Remove the exposed API key from your frontend
