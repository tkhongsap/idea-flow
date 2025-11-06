# Offline Support - PWA Implementation

**Labels:** `enhancement`, `architecture`, `mobile`, `priority: medium`

## Problem
App requires network for all features, providing poor mobile experience:
- ❌ No offline access to captured ideas
- ❌ Can't view existing themes without internet
- ❌ No graceful degradation when connection lost
- ❌ Poor experience on mobile/spotty networks
- ❌ Can't capture ideas on plane/subway/remote locations
- ❌ Users lose work if connection drops during capture

## User Impact
**Mobile users** especially suffer from this:
- "I wanted to capture an idea on the subway but couldn't"
- "My phone lost connection and I lost my idea"
- "The app doesn't work on planes"

## Proposed Solutions

### Solution 1: Progressive Web App (PWA) with Service Worker (Recommended)

**Architecture:**
```
Service Worker (cache layer)
     ↓
[Online]  → Backend API → Gemini
[Offline] → LocalStorage → Offline Queue → (sync when online)
```

**Benefits:**
- ✅ Works offline for viewing and capturing
- ✅ Installable on mobile devices (like native app)
- ✅ Automatic background sync when online
- ✅ 70% smaller than native app
- ✅ One codebase for all platforms
- ✅ Push notifications support

**What Works Offline:**
- View all captured ideas
- View all themes
- Capture new text ideas (queued for AI processing)
- Capture voice ideas (queued for transcription)
- Search existing content (local search)
- Browse theme details

**What Requires Online:**
- AI organization (Gemini API)
- Semantic search (Gemini API)
- Chat with themes (Gemini API)
- Audio transcription (Gemini API)
- Real-time sync with other devices

**Timeline:** 2-3 weeks
**Cost:** $0 (no infrastructure required)

---

### Implementation Plan

#### Phase 1: Service Worker for Caching (Week 1)

**Cache Strategy:**
```typescript
// public/service-worker.js
const CACHE_NAME = 'ideaflow-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.json',
  // All bundled JS files
];

// Install: Cache all static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Fetch: Cache-first strategy for static assets
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      return response || fetch(event.request);
    })
  );
});

// Activate: Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
});
```

**Register Service Worker:**
```typescript
// index.tsx
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('SW registered:', registration);
      })
      .catch((error) => {
        console.log('SW registration failed:', error);
      });
  });
}
```

---

#### Phase 2: Offline Queue for API Requests (Week 2)

**Queue Implementation:**
```typescript
// services/offlineQueue.ts
interface QueuedRequest {
  id: string;
  endpoint: 'organize' | 'search' | 'chat' | 'transcribe';
  data: any;
  timestamp: number;
  retries: number;
  status: 'pending' | 'processing' | 'failed';
}

class OfflineQueue {
  private queue: QueuedRequest[] = [];
  private isProcessing = false;

  constructor() {
    this.loadQueue();
    this.startProcessor();
    this.setupNetworkListeners();
  }

  // Add request to queue
  enqueue(endpoint: string, data: any): string {
    const request: QueuedRequest = {
      id: crypto.randomUUID(),
      endpoint,
      data,
      timestamp: Date.now(),
      retries: 0,
      status: 'pending'
    };

    this.queue.push(request);
    this.saveQueue();

    // Try to process immediately if online
    if (navigator.onLine) {
      this.processQueue();
    }

    return request.id; // Return ID for tracking
  }

  // Process queue when online
  async processQueue() {
    if (this.isProcessing || !navigator.onLine) return;

    this.isProcessing = true;

    while (this.queue.length > 0 && navigator.onLine) {
      const request = this.queue[0];
      request.status = 'processing';

      try {
        await this.executeRequest(request);

        // Success - remove from queue
        this.queue.shift();
        this.saveQueue();
        this.notifySuccess(request.id);

      } catch (error) {
        request.retries++;

        if (request.retries >= 3) {
          // Give up after 3 retries
          request.status = 'failed';
          this.queue.shift();
          this.notifyFailure(request.id);
        }

        this.saveQueue();
        break; // Stop processing on error
      }
    }

    this.isProcessing = false;
  }

  private async executeRequest(request: QueuedRequest) {
    const { endpoint, data } = request;

    switch (endpoint) {
      case 'organize':
        return await organizeIdeas(data);
      case 'search':
        return await semanticSearch(data.query, data.ideas, data.themes);
      case 'chat':
        return await chatWithTheme(data.theme, data.history, data.message);
      case 'transcribe':
        return await transcribeAudio(data.audio, data.mimeType);
      default:
        throw new Error('Unknown endpoint');
    }
  }

  private setupNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('Back online - processing queue');
      this.processQueue();
    });

    window.addEventListener('offline', () => {
      console.log('Gone offline - queuing requests');
    });
  }

  private startProcessor() {
    // Check every 10 seconds
    setInterval(() => {
      if (navigator.onLine && this.queue.length > 0) {
        this.processQueue();
      }
    }, 10000);
  }

  private saveQueue() {
    localStorage.setItem('ideaflow_offline_queue', JSON.stringify(this.queue));
  }

  private loadQueue() {
    const saved = localStorage.getItem('ideaflow_offline_queue');
    this.queue = saved ? JSON.parse(saved) : [];
  }

  getQueueSize(): number {
    return this.queue.filter(r => r.status === 'pending').length;
  }

  // Callbacks for UI updates
  private notifySuccess(id: string) {
    window.dispatchEvent(new CustomEvent('queue-success', { detail: id }));
  }

  private notifyFailure(id: string) {
    window.dispatchEvent(new CustomEvent('queue-failure', { detail: id }));
  }
}

export const offlineQueue = new OfflineQueue();
```

---

#### Phase 3: Offline UI Indicators (Week 2)

**Offline Indicator Component:**
```typescript
// components/OfflineIndicator.tsx
export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Back online! Syncing your changes...');
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.info('You\'re offline. Changes will sync when you reconnect.');
    };

    const updateQueueSize = () => {
      setQueueSize(offlineQueue.getQueueSize());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('queue-success', updateQueueSize);
    window.addEventListener('queue-failure', updateQueueSize);

    // Poll queue size
    const interval = setInterval(updateQueueSize, 1000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('queue-success', updateQueueSize);
      window.removeEventListener('queue-failure', updateQueueSize);
      clearInterval(interval);
    };
  }, []);

  if (isOnline && queueSize === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
      {!isOnline && (
        <>
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span>📡 Offline Mode - Changes will sync when online</span>
        </>
      )}
      {isOnline && queueSize > 0 && (
        <>
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span>⏳ Syncing {queueSize} pending changes...</span>
        </>
      )}
    </div>
  );
};
```

**Update CaptureInput to queue when offline:**
```typescript
const handleNewIdea = async (content: string, sourceType: 'text' | 'voice') => {
  // Always save locally first
  const newIdea: RawIdea = {
    id: `idea-${Date.now()}`,
    content,
    timestamp: new Date().toISOString(),
    sourceType,
  };
  setRawIdeas(prev => [...prev, newIdea]);

  // Queue AI processing if offline
  if (!navigator.onLine) {
    offlineQueue.enqueue('organize', [newIdea]);
    toast.info('Idea saved! Will organize when online.');
  }
};
```

---

#### Phase 4: PWA Manifest (Week 1)

**Create manifest.json:**
```json
{
  "name": "IdeaFlow - AI Idea Organization",
  "short_name": "IdeaFlow",
  "description": "Capture, organize, and explore your ideas with AI",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#F8F5F2",
  "theme_color": "#A3B18A",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ],
  "screenshots": [
    {
      "src": "/screenshots/desktop-1.png",
      "sizes": "1280x720",
      "type": "image/png",
      "form_factor": "wide"
    },
    {
      "src": "/screenshots/mobile-1.png",
      "sizes": "750x1334",
      "type": "image/png",
      "form_factor": "narrow"
    }
  ],
  "shortcuts": [
    {
      "name": "Capture Idea",
      "short_name": "Capture",
      "description": "Quickly capture a new idea",
      "url": "/?action=capture",
      "icons": [{ "src": "/icons/shortcut-capture.png", "sizes": "96x96" }]
    },
    {
      "name": "View Themes",
      "short_name": "Themes",
      "description": "Browse organized themes",
      "url": "/?view=themes",
      "icons": [{ "src": "/icons/shortcut-themes.png", "sizes": "96x96" }]
    }
  ],
  "categories": ["productivity", "utilities"],
  "prefer_related_applications": false
}
```

**Add to index.html:**
```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#A3B18A">
<link rel="apple-touch-icon" href="/icons/icon-192x192.png">
```

---

### Solution 2: Local AI for Offline Processing (Advanced/Experimental)

Use WebLLM or ONNX Runtime to run AI models locally in the browser:

**Benefits:**
- Complete offline AI processing
- No API costs
- Privacy-focused (data never leaves device)

**Limitations:**
- 2-4 GB model download (one-time)
- Requires WebGPU support (limited browsers)
- Slower than cloud API (2-10x)
- Lower quality than Gemini 2.5 Flash
- High memory usage

**Implementation:**
```typescript
import { WebLLM } from '@mlc-ai/web-llm';

let engine: WebLLM | null = null;

export const initializeLocalAI = async () => {
  engine = new WebLLM();
  await engine.reload('Llama-3.1-8B-Instruct-q4f16_1-MLC');
};

export const organizeIdeasOffline = async (ideas: RawIdea[]): Promise<Theme[]> => {
  if (!engine) throw new Error('Local AI not initialized');

  const prompt = `Organize these ideas: ${JSON.stringify(ideas)}`;
  const response = await engine.chat.completions.create({
    messages: [{ role: 'user', content: prompt }]
  });

  return JSON.parse(response.choices[0].message.content);
};
```

**Timeline:** 4-6 weeks (experimental)
**Cost:** $0
**Recommendation:** Skip for now, revisit in future

---

## Recommended Approach

**Implement PWA with Service Worker + Offline Queue (Solution 1)**

**Why:**
- ✅ Works today with current browsers
- ✅ Reasonable offline functionality
- ✅ Provides great mobile experience
- ✅ No model downloads required
- ✅ Can always upgrade to local AI later

---

## Features to Implement

### Core PWA Features
- [ ] Service worker with cache-first strategy
- [ ] Offline queue for API requests
- [ ] PWA manifest with icons
- [ ] Install prompt for mobile users
- [ ] App shortcuts in manifest

### Offline Functionality
- [ ] View all ideas offline
- [ ] View all themes offline
- [ ] Capture new text ideas offline
- [ ] Capture voice ideas offline (queue transcription)
- [ ] Local keyword search (fallback when offline)
- [ ] Queue indicator showing pending syncs

### User Experience
- [ ] Offline indicator badge
- [ ] Clear messaging when features require internet
- [ ] Automatic retry with exponential backoff
- [ ] Sync progress indicator
- [ ] "Failed to sync" error handling

### Installation
- [ ] Custom install prompt
- [ ] Install instructions for iOS Safari
- [ ] Install instructions for Android Chrome
- [ ] Desktop install support

---

## Success Metrics
- [ ] App loads in <2s on 3G network
- [ ] 100% of UI accessible offline
- [ ] 95%+ success rate for queued syncs
- [ ] <5s to sync after reconnection
- [ ] 50%+ mobile users install PWA

---

## Testing Checklist
- [ ] Test offline mode (disable network in DevTools)
- [ ] Test airplane mode on mobile
- [ ] Test flaky connection (throttle to 3G)
- [ ] Test queue with 100+ pending items
- [ ] Test app installation on iOS
- [ ] Test app installation on Android
- [ ] Test service worker updates
- [ ] Test cache invalidation

---

## Browser Support

### Excellent Support
- ✅ Chrome 90+ (desktop & mobile)
- ✅ Edge 90+
- ✅ Firefox 90+
- ✅ Samsung Internet 14+

### Partial Support
- ⚠️ Safari 15+ (limited PWA features)
- ⚠️ iOS Safari (no real install, just "Add to Home Screen")

### Fallback Strategy
For unsupported browsers:
- Still works as normal web app
- No offline mode
- No install prompt
- Graceful degradation

---

## References
- `ARCHITECTURE_IMPROVEMENTS.md` Section 4 - Detailed implementation
- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Workbox (Service Worker Library)](https://developers.google.com/web/tools/workbox)

## Related Issues
- #[Data-Loss-Prevention] - Offline queue prevents data loss
- #[Mobile-Experience] - PWA provides app-like mobile UX
