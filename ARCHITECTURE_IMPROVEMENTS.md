# Architecture Improvement Plans for IdeaFlow

This document outlines comprehensive plans to address the current architectural limitations of IdeaFlow, transforming it from a single-user, client-only application to a more robust, secure, and feature-rich platform.

---

## 1. Multi-User Support & Collaboration

### Current Limitation
- Single user per browser instance
- No user authentication
- No collaboration features
- No shared workspaces

### Proposed Solutions

#### **Option A: Firebase Backend (Recommended for MVP)**

**Architecture:**
```
Client (React) ↔ Firebase Auth ↔ Firestore Database ↔ Cloud Functions
                                     ↓
                              Gemini API (server-side)
```

**Benefits:**
- No server infrastructure to manage
- Built-in authentication (Google, email, etc.)
- Real-time database sync
- Generous free tier
- Quick to implement

**Implementation Steps:**

1. **Phase 1: User Authentication (Week 1)**
   ```typescript
   // services/authService.ts
   import { initializeApp } from 'firebase/app';
   import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

   export const signInWithGoogle = async () => {
     const auth = getAuth();
     const provider = new GoogleAuthProvider();
     const result = await signInWithPopup(auth, provider);
     return result.user;
   };
   ```

2. **Phase 2: Data Migration (Week 2)**
   ```typescript
   // services/firestoreService.ts
   import { getFirestore, collection, doc, setDoc, onSnapshot } from 'firebase/firestore';

   export const syncIdeasToFirestore = async (userId: string, ideas: RawIdea[]) => {
     const db = getFirestore();
     const userIdeasRef = collection(db, 'users', userId, 'ideas');

     for (const idea of ideas) {
       await setDoc(doc(userIdeasRef, idea.id), idea);
     }
   };

   export const subscribeToIdeas = (userId: string, callback: (ideas: RawIdea[]) => void) => {
     const db = getFirestore();
     const userIdeasRef = collection(db, 'users', userId, 'ideas');

     return onSnapshot(userIdeasRef, (snapshot) => {
       const ideas = snapshot.docs.map(doc => doc.data() as RawIdea);
       callback(ideas);
     });
   };
   ```

3. **Phase 3: Real-time Sync (Week 2)**
   - Replace localStorage with Firestore
   - Implement optimistic updates
   - Add conflict resolution

4. **Phase 4: Collaboration Features (Week 3-4)**
   ```typescript
   // New data model
   interface Workspace {
     id: string;
     name: string;
     ownerId: string;
     members: {
       userId: string;
       role: 'owner' | 'editor' | 'viewer';
       joinedAt: string;
     }[];
     settings: {
       visibility: 'private' | 'team' | 'public';
       allowComments: boolean;
     };
   }

   interface SharedTheme extends Theme {
     workspaceId: string;
     createdBy: string;
     comments: Comment[];
     collaborators: string[];
   }
   ```

**Cost Estimate:**
- Free tier: 50k reads/day, 20k writes/day (sufficient for 100-200 active users)
- Paid tier: ~$25/month for 10k users

**Timeline:** 4 weeks

---

#### **Option B: Supabase Backend (Recommended for Scale)**

**Architecture:**
```
Client (React) ↔ Supabase Auth ↔ PostgreSQL ↔ Edge Functions
                                     ↓
                              Gemini API (server-side)
```

**Benefits:**
- SQL database (more powerful queries)
- Real-time subscriptions
- Row-level security
- Better for complex data relationships
- Built-in storage for audio files

**Implementation Steps:**

1. **Database Schema (Week 1)**
   ```sql
   -- users table (auto-created by Supabase Auth)

   CREATE TABLE ideas (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID REFERENCES auth.users NOT NULL,
     workspace_id UUID REFERENCES workspaces,
     content TEXT NOT NULL,
     source_type TEXT CHECK (source_type IN ('text', 'voice')),
     tags TEXT[],
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   CREATE TABLE themes (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID REFERENCES auth.users NOT NULL,
     workspace_id UUID REFERENCES workspaces,
     title TEXT NOT NULL,
     summary TEXT,
     tags TEXT[],
     action_items TEXT[],
     questions TEXT[],
     is_user_created BOOLEAN DEFAULT FALSE,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   CREATE TABLE idea_atoms (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     theme_id UUID REFERENCES themes NOT NULL,
     source_idea_id UUID REFERENCES ideas,
     content TEXT NOT NULL,
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   CREATE TABLE workspaces (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     name TEXT NOT NULL,
     owner_id UUID REFERENCES auth.users NOT NULL,
     visibility TEXT CHECK (visibility IN ('private', 'team', 'public')),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
   );

   CREATE TABLE workspace_members (
     workspace_id UUID REFERENCES workspaces NOT NULL,
     user_id UUID REFERENCES auth.users NOT NULL,
     role TEXT CHECK (role IN ('owner', 'editor', 'viewer')),
     joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     PRIMARY KEY (workspace_id, user_id)
   );

   -- Row Level Security policies
   ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Users can view their own ideas"
     ON ideas FOR SELECT
     USING (auth.uid() = user_id OR workspace_id IN (
       SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
     ));

   CREATE POLICY "Users can insert their own ideas"
     ON ideas FOR INSERT
     WITH CHECK (auth.uid() = user_id);
   ```

2. **Real-time Subscriptions (Week 2)**
   ```typescript
   // services/supabaseService.ts
   import { createClient } from '@supabase/supabase-js';

   const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

   export const subscribeToIdeas = (userId: string, callback: (ideas: RawIdea[]) => void) => {
     return supabase
       .channel('ideas')
       .on('postgres_changes',
         {
           event: '*',
           schema: 'public',
           table: 'ideas',
           filter: `user_id=eq.${userId}`
         },
         (payload) => {
           // Handle real-time updates
           callback(transformIdea(payload.new));
         }
       )
       .subscribe();
   };
   ```

3. **Collaboration Features (Week 3-4)**
   - Workspace management UI
   - Member invitation system
   - Permission-based access control
   - Activity feed

**Cost Estimate:**
- Free tier: 500MB database, 50k monthly active users
- Paid tier: ~$25/month for production use

**Timeline:** 4 weeks

---

#### **Option C: Lightweight P2P Sync (Quick Win)**

**Architecture:**
```
Browser A ↔ WebRTC ↔ Browser B
    ↓           ↓
LocalStorage  LocalStorage
```

**Benefits:**
- No backend required
- No recurring costs
- Privacy-focused (no data on servers)
- Quick to implement

**Libraries:**
- [Automerge](https://automerge.org/) for CRDT-based sync
- [y-webrtc](https://github.com/yjs/y-webrtc) for WebRTC connections

**Implementation:**
```typescript
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';

const ydoc = new Y.Doc();
const provider = new WebrtcProvider('ideaflow-room-' + workspaceId, ydoc);

const yIdeas = ydoc.getArray('ideas');

// Sync state with Yjs
yIdeas.observe(() => {
  setRawIdeas(yIdeas.toArray());
});
```

**Limitations:**
- Both users must be online simultaneously
- Limited to small groups (2-5 people)
- No persistent server storage

**Timeline:** 1-2 weeks

---

### **Recommended Approach: Firebase (Option A)**

**Rationale:**
- Fastest time to market
- Lowest operational complexity
- Sufficient for current scale
- Easy migration path to custom backend later

---

## 2. Cross-Device Sync & Data Portability

### Current Limitation
- Data trapped in single browser's localStorage
- No sync across devices
- Browser clear = data loss

### Proposed Solutions

#### **Solution 1: Cloud Sync (Part of Multi-User Plan)**

Once Firebase/Supabase is implemented, cross-device sync is automatic:
- Login from any device
- Data syncs automatically
- Offline changes queued and synced when online

**No additional work needed if Option A or B from Section 1 is chosen.**

---

#### **Solution 2: Export/Import (Immediate Solution)**

**Implementation (Week 1):**

```typescript
// utils/dataExport.ts
export const exportData = () => {
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    rawIdeas: JSON.parse(localStorage.getItem('ideaflow_rawIdeas') || '[]'),
    themes: JSON.parse(localStorage.getItem('ideaflow_themes') || '[]')
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ideaflow-backup-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export const importData = (file: File): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);

        // Validate data structure
        if (!data.rawIdeas || !data.themes) {
          throw new Error('Invalid backup file');
        }

        // Confirm before overwriting
        const confirmed = window.confirm(
          'This will replace your current data. Continue?'
        );

        if (confirmed) {
          localStorage.setItem('ideaflow_rawIdeas', JSON.stringify(data.rawIdeas));
          localStorage.setItem('ideaflow_themes', JSON.stringify(data.themes));
          resolve(true);
        } else {
          resolve(false);
        }
      } catch (error) {
        reject(error);
      }
    };
    reader.readAsText(file);
  });
};

// Add to App.tsx
const handleExport = () => {
  exportData();
};

const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (file) {
    try {
      await importData(file);
      window.location.reload(); // Refresh to load new data
    } catch (error) {
      alert('Import failed: ' + error.message);
    }
  }
};
```

**UI Addition:**
```typescript
// Add to header or settings menu
<div className="flex gap-2">
  <button onClick={handleExport} className="btn-secondary">
    Export Data
  </button>
  <label className="btn-secondary cursor-pointer">
    Import Data
    <input type="file" accept=".json" onChange={handleImport} className="hidden" />
  </label>
</div>
```

**Timeline:** 1 week

---

#### **Solution 3: Automatic Cloud Backup (without full backend)**

**Using Dropbox/Google Drive API:**

```typescript
// services/cloudBackupService.ts
import { Dropbox } from 'dropbox';

export const setupAutoBackup = (accessToken: string) => {
  const dbx = new Dropbox({ accessToken });

  // Backup every hour
  setInterval(async () => {
    const data = {
      rawIdeas: JSON.parse(localStorage.getItem('ideaflow_rawIdeas') || '[]'),
      themes: JSON.parse(localStorage.getItem('ideaflow_themes') || '[]')
    };

    await dbx.filesUpload({
      path: '/IdeaFlow/backup-' + Date.now() + '.json',
      contents: JSON.stringify(data),
      mode: { '.tag': 'add' },
      autorename: true
    });
  }, 3600000); // 1 hour
};
```

**Benefits:**
- User owns their data
- No server costs
- Automatic backups

**Limitations:**
- Requires OAuth setup
- Not real-time sync
- User must grant permissions

**Timeline:** 1-2 weeks

---

### **Recommended Approach: Export/Import (Immediate) + Cloud Sync (Future)**

Implement export/import immediately as a safety net, then add full cloud sync with multi-user support.

---

## 3. API Key Security

### Current Limitation
- API key exposed in client-side bundle
- Anyone can extract and abuse it
- No rate limiting or usage tracking per user

### Proposed Solutions

#### **Solution 1: Backend Proxy (Recommended)**

**Architecture:**
```
Client ↔ Backend API Gateway ↔ Gemini API
         (with rate limiting)
```

**Implementation with Firebase Cloud Functions:**

```typescript
// functions/src/index.ts
import * as functions from 'firebase-functions';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({
  apiKey: functions.config().gemini.api_key // Stored securely
});

export const organizeIdeas = functions.https.onCall(async (data, context) => {
  // Authenticate user
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be logged in');
  }

  const userId = context.auth.uid;

  // Rate limiting (using Firestore)
  const userDoc = await admin.firestore().doc(`users/${userId}`).get();
  const usage = userDoc.data()?.apiUsage || { count: 0, resetAt: Date.now() };

  // Allow 100 requests per day
  if (usage.count >= 100 && usage.resetAt > Date.now()) {
    throw new functions.https.HttpsError('resource-exhausted', 'Daily API limit reached');
  }

  // Call Gemini API (server-side)
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: data.prompt,
    config: data.config
  });

  // Update usage counter
  await admin.firestore().doc(`users/${userId}`).update({
    'apiUsage.count': admin.firestore.FieldValue.increment(1),
    'apiUsage.resetAt': Date.now() + 86400000 // 24 hours
  });

  return { result: response.text };
});

export const semanticSearch = functions.https.onCall(async (data, context) => {
  // Similar implementation with auth + rate limiting
});

export const chatWithTheme = functions.https.onCall(async (data, context) => {
  // Similar implementation with auth + rate limiting
});

export const transcribeAudio = functions.https.onCall(async (data, context) => {
  // Similar implementation with auth + rate limiting
});
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

    return result.data.result;
  } catch (error) {
    if (error.code === 'resource-exhausted') {
      throw new Error('Daily API limit reached. Please try again tomorrow.');
    }
    throw error;
  }
};
```

**Benefits:**
- API key never exposed to client
- Per-user rate limiting
- Usage tracking and analytics
- Cost control

**Cost:** Included in Firebase Cloud Functions free tier (125k invocations/month)

**Timeline:** 2 weeks

---

#### **Solution 2: API Key Rotation with Usage Limits**

**Short-term solution without backend:**

1. **Google Cloud Console Setup:**
   - Create multiple API keys
   - Set usage quotas per key (e.g., 1000 requests/day)
   - Add HTTP referrer restrictions
   - Enable billing alerts

2. **Client-side key rotation:**
   ```typescript
   // Build-time key injection with rotation
   const API_KEYS = [
     process.env.GEMINI_KEY_1,
     process.env.GEMINI_KEY_2,
     process.env.GEMINI_KEY_3
   ];

   let currentKeyIndex = Math.floor(Math.random() * API_KEYS.length);

   const getApiKey = () => {
     return API_KEYS[currentKeyIndex];
   };

   const rotateKey = () => {
     currentKeyIndex = (currentKeyIndex + 1) % API_KEYS.length;
   };

   // Rotate on 429 (rate limit) errors
   ```

**Limitations:**
- Keys still exposed (but harder to abuse)
- Manual rotation required
- Not a true security solution

**Timeline:** 3 days

---

#### **Solution 3: Vercel Edge Functions (Alternative Backend)**

**For projects deployed on Vercel:**

```typescript
// api/gemini.ts
import { GoogleGenAI } from '@google/genai';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Rate limiting with Vercel KV
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const rateLimitKey = `ratelimit:${ip}`;

  // Simple rate limit: 10 requests per minute
  const count = await kv.incr(rateLimitKey);
  if (count === 1) {
    await kv.expire(rateLimitKey, 60);
  }
  if (count > 10) {
    return res.status(429).json({ error: 'Rate limit exceeded' });
  }

  // Proxy to Gemini
  const { endpoint, ...data } = req.body;

  try {
    const response = await ai.models.generateContent(data);
    return res.json({ result: response.text });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
```

**Benefits:**
- Edge computing (low latency)
- Automatic scaling
- Simple deployment

**Cost:** Free tier: 100k requests/month

**Timeline:** 1 week

---

### **Recommended Approach: Backend Proxy (Solution 1)**

Implement Firebase Cloud Functions (or Vercel Edge) as an API gateway. This is essential for production use.

---

## 4. Offline Support

### Current Limitation
- Requires network for all AI features
- No graceful degradation
- Poor mobile experience

### Proposed Solutions

#### **Solution 1: Progressive Web App (PWA) with Service Worker**

**Implementation:**

1. **Service Worker for Offline Caching (Week 1)**

```typescript
// public/service-worker.js
const CACHE_NAME = 'ideaflow-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/App.tsx',
  '/styles.css',
  // Add all static assets
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      return response || fetch(event.request);
    })
  );
});
```

2. **Offline Queue for API Requests (Week 2)**

```typescript
// services/offlineQueue.ts
interface QueuedRequest {
  id: string;
  endpoint: string;
  data: any;
  timestamp: number;
  retries: number;
}

class OfflineQueue {
  private queue: QueuedRequest[] = [];

  constructor() {
    this.loadQueue();
    this.startProcessor();

    // Listen for online event
    window.addEventListener('online', () => {
      this.processQueue();
    });
  }

  enqueue(endpoint: string, data: any) {
    const request: QueuedRequest = {
      id: crypto.randomUUID(),
      endpoint,
      data,
      timestamp: Date.now(),
      retries: 0
    };

    this.queue.push(request);
    this.saveQueue();

    if (navigator.onLine) {
      this.processQueue();
    }
  }

  async processQueue() {
    while (this.queue.length > 0 && navigator.onLine) {
      const request = this.queue[0];

      try {
        await fetch(request.endpoint, {
          method: 'POST',
          body: JSON.stringify(request.data)
        });

        // Success - remove from queue
        this.queue.shift();
        this.saveQueue();
      } catch (error) {
        request.retries++;

        if (request.retries >= 3) {
          // Give up after 3 retries
          this.queue.shift();
        }

        this.saveQueue();
        break; // Stop processing on error
      }
    }
  }

  private saveQueue() {
    localStorage.setItem('ideaflow_offline_queue', JSON.stringify(this.queue));
  }

  private loadQueue() {
    const saved = localStorage.getItem('ideaflow_offline_queue');
    this.queue = saved ? JSON.parse(saved) : [];
  }

  private startProcessor() {
    setInterval(() => {
      if (navigator.onLine && this.queue.length > 0) {
        this.processQueue();
      }
    }, 10000); // Check every 10 seconds
  }
}

export const offlineQueue = new OfflineQueue();
```

3. **Offline UI Indicators (Week 2)**

```typescript
// components/OfflineIndicator.tsx
export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && queueSize === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg">
      {!isOnline && '📡 Offline Mode - Changes will sync when online'}
      {isOnline && queueSize > 0 && `⏳ Syncing ${queueSize} pending changes...`}
    </div>
  );
};
```

4. **PWA Manifest (Week 1)**

```json
// public/manifest.json
{
  "name": "IdeaFlow",
  "short_name": "IdeaFlow",
  "description": "AI-powered idea organization",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F8F5F2",
  "theme_color": "#A3B18A",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**Benefits:**
- Works offline for viewing and capturing
- Syncs automatically when online
- Installable on mobile devices
- Native app-like experience

**Timeline:** 2-3 weeks

---

#### **Solution 2: Local AI for Basic Features (Advanced)**

**Use WebLLM or ONNX models for offline processing:**

```typescript
// services/localAI.ts
import { WebLLM } from '@mlc-ai/web-llm';

let engine: WebLLM | null = null;

export const initializeLocalAI = async () => {
  engine = new WebLLM();
  await engine.reload('Llama-3.1-8B-Instruct-q4f16_1-MLC');
};

export const organizeIdeasOffline = async (ideas: RawIdea[]): Promise<Theme[]> => {
  if (!engine) {
    throw new Error('Local AI not initialized');
  }

  const prompt = `Organize these ideas into themes: ${JSON.stringify(ideas)}`;
  const response = await engine.chat.completions.create({
    messages: [{ role: 'user', content: prompt }]
  });

  return JSON.parse(response.choices[0].message.content);
};
```

**Limitations:**
- Large model download (2-4 GB)
- Requires WebGPU support
- Slower than cloud API
- Lower quality than Gemini

**Timeline:** 4-6 weeks (experimental)

---

### **Recommended Approach: PWA with Offline Queue (Solution 1)**

Focus on offline UI caching and request queuing. Skip local AI for now (too complex, limited benefit).

---

## 5. Data Loss Prevention

### Current Limitation
- No automatic backups
- Browser clear = permanent data loss
- No version history
- No deleted item recovery

### Proposed Solutions

#### **Solution 1: Automatic Cloud Backup (Immediate)**

**Implementation with Firebase (Week 1):**

```typescript
// services/autoBackup.ts
import { getFirestore, doc, setDoc } from 'firebase/firestore';

class AutoBackup {
  private backupInterval: NodeJS.Timeout | null = null;

  start(userId: string) {
    // Backup every 5 minutes
    this.backupInterval = setInterval(() => {
      this.performBackup(userId);
    }, 300000);

    // Immediate backup on page unload
    window.addEventListener('beforeunload', () => {
      this.performBackup(userId);
    });
  }

  stop() {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }
  }

  private async performBackup(userId: string) {
    const db = getFirestore();
    const backupData = {
      rawIdeas: JSON.parse(localStorage.getItem('ideaflow_rawIdeas') || '[]'),
      themes: JSON.parse(localStorage.getItem('ideaflow_themes') || '[]'),
      timestamp: new Date().toISOString()
    };

    await setDoc(
      doc(db, 'users', userId, 'backups', Date.now().toString()),
      backupData
    );

    // Keep only last 10 backups
    this.pruneOldBackups(userId);
  }

  private async pruneOldBackups(userId: string) {
    // Implement cleanup logic to keep only recent backups
  }

  async restore(userId: string, backupId: string) {
    const db = getFirestore();
    const backup = await getDoc(doc(db, 'users', userId, 'backups', backupId));

    if (backup.exists()) {
      const data = backup.data();
      localStorage.setItem('ideaflow_rawIdeas', JSON.stringify(data.rawIdeas));
      localStorage.setItem('ideaflow_themes', JSON.stringify(data.themes));
      window.location.reload();
    }
  }
}

export const autoBackup = new AutoBackup();
```

**UI for Restoration:**

```typescript
// components/BackupManager.tsx
export const BackupManager: React.FC = () => {
  const [backups, setBackups] = useState<Backup[]>([]);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    const db = getFirestore();
    const backupsSnapshot = await getDocs(
      collection(db, 'users', currentUserId, 'backups')
    );

    const backupsList = backupsSnapshot.docs.map(doc => ({
      id: doc.id,
      timestamp: doc.data().timestamp,
      ideaCount: doc.data().rawIdeas.length,
      themeCount: doc.data().themes.length
    }));

    setBackups(backupsList.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ));
  };

  const handleRestore = async (backupId: string) => {
    if (confirm('This will replace your current data. Continue?')) {
      await autoBackup.restore(currentUserId, backupId);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">Backup History</h2>
      {backups.map(backup => (
        <div key={backup.id} className="p-4 border rounded-lg">
          <p className="font-semibold">
            {new Date(backup.timestamp).toLocaleString()}
          </p>
          <p className="text-sm text-gray-600">
            {backup.ideaCount} ideas, {backup.themeCount} themes
          </p>
          <button
            onClick={() => handleRestore(backup.id)}
            className="mt-2 btn-secondary"
          >
            Restore This Backup
          </button>
        </div>
      ))}
    </div>
  );
};
```

**Timeline:** 1 week

---

#### **Solution 2: Version History with Undo/Redo (Week 2-3)**

**Implementation:**

```typescript
// services/versionHistory.ts
interface HistoryEntry {
  id: string;
  timestamp: number;
  action: string;
  before: any;
  after: any;
}

class VersionHistory {
  private history: HistoryEntry[] = [];
  private currentIndex: number = -1;
  private maxHistory: number = 50;

  recordChange(action: string, before: any, after: any) {
    // Remove any redo history
    this.history = this.history.slice(0, this.currentIndex + 1);

    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      action,
      before,
      after
    };

    this.history.push(entry);
    this.currentIndex++;

    // Limit history size
    if (this.history.length > this.maxHistory) {
      this.history.shift();
      this.currentIndex--;
    }

    this.save();
  }

  undo(): any | null {
    if (this.currentIndex < 0) return null;

    const entry = this.history[this.currentIndex];
    this.currentIndex--;

    return entry.before;
  }

  redo(): any | null {
    if (this.currentIndex >= this.history.length - 1) return null;

    this.currentIndex++;
    const entry = this.history[this.currentIndex];

    return entry.after;
  }

  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  private save() {
    localStorage.setItem('ideaflow_history', JSON.stringify({
      history: this.history,
      currentIndex: this.currentIndex
    }));
  }
}

export const versionHistory = new VersionHistory();

// Use in App.tsx
const handleDeleteIdea = (id: string) => {
  const before = { ideas: rawIdeas, themes };

  setRawIdeas(prev => prev.filter(idea => idea.id !== id));
  setThemes(prev => prev.map(theme => ({
    ...theme,
    ideaAtoms: theme.ideaAtoms.filter(atom => atom.sourceIdeaId !== id)
  })));

  const after = { ideas: rawIdeas, themes };
  versionHistory.recordChange('delete_idea', before, after);
};

const handleUndo = () => {
  const previous = versionHistory.undo();
  if (previous) {
    setRawIdeas(previous.ideas);
    setThemes(previous.themes);
  }
};

const handleRedo = () => {
  const next = versionHistory.redo();
  if (next) {
    setRawIdeas(next.ideas);
    setThemes(next.themes);
  }
};

// Keyboard shortcuts
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) {
        handleRedo();
      } else {
        handleUndo();
      }
    }
  };

  window.addEventListener('keydown', handleKeyDown);
  return () => window.removeEventListener('keydown', handleKeyDown);
}, []);
```

**Timeline:** 1-2 weeks

---

#### **Solution 3: Trash/Archive System (Week 1)**

**Implementation:**

```typescript
// Add to types.ts
interface RawIdea {
  // ... existing fields
  deletedAt?: string;
  archived?: boolean;
}

// Soft delete instead of hard delete
const handleDeleteIdea = (id: string) => {
  setRawIdeas(prev => prev.map(idea =>
    idea.id === id
      ? { ...idea, deletedAt: new Date().toISOString() }
      : idea
  ));
};

// Filter deleted items in UI
const activeIdeas = rawIdeas.filter(idea => !idea.deletedAt);

// Restore from trash
const handleRestoreIdea = (id: string) => {
  setRawIdeas(prev => prev.map(idea =>
    idea.id === id
      ? { ...idea, deletedAt: undefined }
      : idea
  ));
};

// Permanent delete (after 30 days)
useEffect(() => {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  setRawIdeas(prev => prev.filter(idea => {
    if (!idea.deletedAt) return true;
    return new Date(idea.deletedAt).getTime() > thirtyDaysAgo;
  }));
}, []);
```

**Timeline:** 1 week

---

### **Recommended Approach: All Three Solutions**

Implement in order:
1. Trash system (Week 1) - Immediate safety
2. Auto-backup (Week 1-2) - Cloud safety
3. Version history (Week 3-4) - Power user feature

---

## Implementation Roadmap

### Phase 1: Critical Security & Data Safety (4 weeks)

**Week 1:**
- ✅ Export/Import functionality
- ✅ Trash system for soft deletes
- ✅ PWA manifest and basic service worker

**Week 2:**
- ✅ Firebase authentication setup
- ✅ Backend API proxy for Gemini
- ✅ Auto-backup to cloud

**Week 3:**
- ✅ Real-time sync with Firestore
- ✅ Offline queue implementation

**Week 4:**
- ✅ Rate limiting and usage tracking
- ✅ Version history with undo/redo

### Phase 2: Multi-User & Collaboration (4 weeks)

**Week 5-6:**
- ✅ Workspace data model
- ✅ Member management UI
- ✅ Permission system

**Week 7-8:**
- ✅ Real-time collaboration features
- ✅ Activity feed
- ✅ Shared theme commenting

### Phase 3: Advanced Features (Ongoing)

- Enhanced search with filters
- Mobile app (React Native)
- Browser extensions
- API for third-party integrations
- Team analytics dashboard

---

## Cost Analysis

### Current (Client-Only)
- **Hosting:** $0 (Replit free tier)
- **Gemini API:** Exposed (uncontrolled costs)
- **Total:** $0/month (but risky)

### With Backend (Recommended)
- **Firebase:**
  - Auth: Free (50k MAU)
  - Firestore: Free tier + ~$10/month for 100k active users
  - Cloud Functions: Free tier + ~$5/month
  - Total: **~$15/month for 100k users**

- **Supabase:**
  - Database: $25/month (Pro plan)
  - Auth: Included
  - Storage: Included (50 GB)
  - Total: **~$25/month**

- **Vercel:**
  - Hobby: Free (non-commercial)
  - Pro: $20/month
  - Total: **$0-20/month**

### Break-Even Analysis
- Current risk: Unlimited API abuse = $$$$ potential cost
- Backend cost: Fixed ~$15-25/month
- **Backend pays for itself with just one abuse incident**

---

## Success Metrics

### Security
- [ ] Zero exposed API keys in production
- [ ] <1% API abuse rate
- [ ] 100% of API calls authenticated

### Reliability
- [ ] Zero data loss incidents
- [ ] 99.9% uptime
- [ ] <1 second sync latency

### User Experience
- [ ] Users can access data from any device
- [ ] Offline mode works smoothly
- [ ] Collaboration features adopted by >30% of users

---

## Next Steps

1. **Immediate (This Week):**
   - Implement export/import
   - Add trash system
   - Create Firebase project

2. **Short-term (Next Month):**
   - Deploy backend proxy
   - Enable authentication
   - Launch auto-backup

3. **Long-term (3-6 Months):**
   - Full collaboration features
   - Mobile apps
   - Enterprise features

---

**Questions or need clarification on any of these plans? Let me know which ones you'd like to prioritize!**
