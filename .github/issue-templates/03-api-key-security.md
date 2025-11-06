# API Key Security - Backend Proxy Implementation

**Labels:** `security`, `critical`, `architecture`, `priority: critical`

## Problem - CRITICAL SECURITY VULNERABILITY

Currently the Gemini API key is exposed in the client-side bundle:
- ❌ Anyone can inspect the JavaScript bundle and extract the API key
- ❌ Malicious users can abuse the key for unlimited API calls
- ❌ No rate limiting or usage tracking per user
- ❌ Could result in **thousands of dollars** in unauthorized API usage
- ❌ No way to revoke access without redeploying

**Risk Level:** 🔴 **CRITICAL** - This is the highest priority security issue

## Real-World Impact
One malicious user could:
1. Extract API key from bundle (takes 5 minutes)
2. Use it for their own projects
3. Run up $1000+ in API charges in one day
4. You have no way to stop them without redeploying

**This has happened to many production apps. Backend proxy is MANDATORY for production use.**

## Proposed Solutions

### Solution 1: Firebase Cloud Functions (Recommended)

**Architecture:**
```
Client → Firebase Cloud Functions → Gemini API
  ↓           (with Auth + Rate Limiting)
Firebase Auth
```

**Benefits:**
- ✅ API key never exposed to client
- ✅ Built-in authentication (only logged-in users can call)
- ✅ Per-user rate limiting (prevent abuse)
- ✅ Usage tracking and analytics
- ✅ Cost control and quotas
- ✅ Automatic scaling
- ✅ Easy to implement

**Implementation:**

```typescript
// functions/src/index.ts
import * as functions from 'firebase-functions';
import { GoogleGenAI } from '@google/genai';
import * as admin from 'firebase-admin';

admin.initializeApp();

const ai = new GoogleGenAI({
  apiKey: functions.config().gemini.api_key // Stored securely server-side
});

export const organizeIdeas = functions.https.onCall(async (data, context) => {
  // 1. Authenticate user
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be logged in'
    );
  }

  const userId = context.auth.uid;

  // 2. Check rate limit
  const userDoc = await admin.firestore()
    .doc(`users/${userId}`)
    .get();

  const usage = userDoc.data()?.apiUsage || {
    count: 0,
    resetAt: Date.now()
  };

  // Allow 100 requests per day
  if (usage.count >= 100 && usage.resetAt > Date.now()) {
    throw new functions.https.HttpsError(
      'resource-exhausted',
      'Daily API limit reached. Resets at midnight.'
    );
  }

  // 3. Call Gemini API (server-side, secure)
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: data.prompt,
      config: data.config
    });

    // 4. Update usage counter
    await admin.firestore().doc(`users/${userId}`).set({
      apiUsage: {
        count: admin.firestore.FieldValue.increment(1),
        resetAt: Date.now() + 86400000, // 24 hours
        lastUsed: Date.now()
      }
    }, { merge: true });

    // 5. Return result
    return { result: response.text };

  } catch (error) {
    console.error('Gemini API error:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to process request'
    );
  }
});

// Similar functions for:
// - semanticSearch
// - chatWithTheme
// - transcribeAudio
```

**Client-side updates:**

```typescript
// services/geminiService.ts
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();

export const organizeIdeas = async (rawIdeas: RawIdea[]): Promise<Theme[]> => {
  const organizeFunc = httpsCallable(functions, 'organizeIdeas');

  try {
    const result = await organizeFunc({
      prompt: buildPrompt(rawIdeas),
      config: {
        responseMimeType: "application/json",
        responseSchema: organizeSchema
      }
    });

    return JSON.parse(result.data.result);

  } catch (error) {
    if (error.code === 'unauthenticated') {
      throw new Error('Please log in to use AI features');
    }
    if (error.code === 'resource-exhausted') {
      throw new Error('Daily AI limit reached. Try again tomorrow!');
    }
    throw new Error('AI processing failed. Please try again.');
  }
};
```

**Rate Limiting Strategy:**
- Free tier: 50 requests/day
- Basic plan: 200 requests/day
- Pro plan: Unlimited (with cost caps)

**Cost:** Included in Firebase free tier (125k invocations/month)
**Timeline:** 2 weeks
**Priority:** 🔴 CRITICAL

---

### Solution 2: Vercel Edge Functions (Alternative)

**Architecture:**
```
Client → Vercel Edge Functions → Gemini API
         (with IP Rate Limiting)
```

**Benefits:**
- Edge computing (low latency)
- Simple deployment
- Built-in rate limiting with Vercel KV

**Implementation:**

```typescript
// api/gemini.ts
import { GoogleGenAI } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { kv } from '@vercel/kv';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY // Server-side environment variable
});

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Rate limiting by IP
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const rateLimitKey = `ratelimit:${ip}`;

  // 10 requests per minute
  const count = await kv.incr(rateLimitKey);
  if (count === 1) {
    await kv.expire(rateLimitKey, 60);
  }

  if (count > 10) {
    return res.status(429).json({
      error: 'Rate limit exceeded. Try again in 1 minute.'
    });
  }

  // Proxy to Gemini
  try {
    const { endpoint, ...data } = req.body;
    const response = await ai.models.generateContent(data);
    return res.json({ result: response.text });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
```

**Cost:** Free tier: 100k requests/month
**Timeline:** 1 week
**Priority:** 🔴 CRITICAL

---

### Solution 3: Custom Node.js Backend (Full Control)

For enterprises or specific requirements:
- Express.js or Fastify server
- JWT authentication
- Redis for rate limiting
- PostgreSQL for usage tracking
- Deploy on Railway, Fly.io, or AWS

**Timeline:** 3-4 weeks
**Cost:** $10-50/month depending on hosting

---

## Recommended Approach

**Use Firebase Cloud Functions (Solution 1)**

**Reasons:**
1. **Fastest to implement** - Integrates with existing Firebase auth
2. **Lowest cost** - Free tier covers most usage
3. **Best rate limiting** - Per-user tracking
4. **Easy maintenance** - Fully managed
5. **Scalable** - Automatic scaling

---

## Implementation Checklist

### Phase 1: Backend Setup (Week 1)
- [ ] Create Firebase project
- [ ] Install Firebase CLI
- [ ] Initialize Cloud Functions
- [ ] Set up environment variables for API key
- [ ] Deploy test function

### Phase 2: Migrate API Calls (Week 2)
- [ ] Implement `organizeIdeas` function
- [ ] Implement `semanticSearch` function
- [ ] Implement `chatWithTheme` function
- [ ] Implement `transcribeAudio` function
- [ ] Update client-side service to call functions
- [ ] Test all endpoints

### Phase 3: Rate Limiting (Week 2)
- [ ] Implement per-user usage tracking
- [ ] Set daily limits (100 requests/day)
- [ ] Add usage dashboard in UI
- [ ] Implement graceful error messages
- [ ] Add "upgrade plan" UI for power users

### Phase 4: Monitoring (Week 3)
- [ ] Set up Cloud Functions logging
- [ ] Create usage dashboard
- [ ] Set up billing alerts
- [ ] Monitor API costs
- [ ] Track abuse patterns

---

## Security Best Practices

### API Key Management
- ✅ Store in environment variables (never in code)
- ✅ Use Firebase Secret Manager or similar
- ✅ Rotate keys every 90 days
- ✅ Different keys for dev/staging/prod

### Rate Limiting
- ✅ Per-user daily limits
- ✅ Per-IP limits as backup
- ✅ Exponential backoff for repeated failures
- ✅ Clear error messages to users

### Monitoring
- ✅ Track all API calls
- ✅ Alert on unusual patterns
- ✅ Daily cost reports
- ✅ Usage analytics per user

### Authentication
- ✅ Require login for all AI features
- ✅ Validate Firebase auth tokens
- ✅ Implement CORS properly
- ✅ Use HTTPS only

---

## Cost Analysis

### Current (No Backend)
- **Cost:** $0/month
- **Risk:** ♾️ unlimited (exposed API key)
- **One abuse incident = $1000+ charge**

### With Backend Proxy
- **Cost:** $0-15/month (predictable)
- **Risk:** Zero API exposure
- **ROI:** Immediate - prevents all abuse

**The backend pays for itself by preventing even one abuse incident.**

---

## Migration Strategy

### Step 1: Deploy Backend (Week 1)
- Deploy Cloud Functions
- Keep old client code working

### Step 2: Test Backend (Week 1)
- Test with small user group
- Verify all features work
- Monitor costs

### Step 3: Switch Traffic (Week 2)
- Update client to use backend
- Monitor for errors
- Keep localStorage fallback temporarily

### Step 4: Remove Old Code (Week 3)
- Remove client-side API key
- Redeploy without exposed key
- Celebrate 🎉

---

## Success Metrics
- [ ] Zero exposed API keys in production bundle
- [ ] <1% API abuse attempts
- [ ] 100% of API calls authenticated
- [ ] <100ms added latency from proxy
- [ ] Predictable monthly costs within budget

---

## Testing Checklist
- [ ] Test authenticated user can call API
- [ ] Test unauthenticated user gets 401
- [ ] Test rate limit enforcement (101st request fails)
- [ ] Test rate limit resets after 24 hours
- [ ] Test error handling for invalid requests
- [ ] Test Gemini API errors are handled gracefully
- [ ] Load test: 100 concurrent requests
- [ ] Security test: Try to bypass auth

---

## References
- `ARCHITECTURE_IMPROVEMENTS.md` Section 3 - Detailed implementation
- [Firebase Cloud Functions Docs](https://firebase.google.com/docs/functions)
- [Vercel Serverless Functions](https://vercel.com/docs/functions)

## Related Issues
- #[Multi-User] - Requires authentication to be in place
- #[Data-Loss-Prevention] - Backend enables cloud backup
