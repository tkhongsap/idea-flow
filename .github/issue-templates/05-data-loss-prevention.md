# Data Loss Prevention - Backup & Recovery System

**Labels:** `enhancement`, `data-safety`, `priority: high`

## Problem
Users risk losing all their ideas with no recovery option:
- ❌ No automatic backups
- ❌ Browser clear = permanent data loss
- ❌ No version history or undo
- ❌ No recovery from accidental deletions
- ❌ No way to restore previous versions

## User Stories

**Horror Story #1: Browser Clear**
> "I cleared my browser cache and lost 3 months of ideas. 47 ideas, 12 themes, all gone forever."

**Horror Story #2: Accidental Delete**
> "I accidentally deleted a theme with 20 ideas. No undo button. I tried everything to get it back."

**Horror Story #3: Corrupted Data**
> "LocalStorage got corrupted somehow and my data won't load. The app is stuck showing 'Error loading data'."

**These are preventable with proper backup systems.**

---

## Proposed Solutions

### Solution 1: Automatic Cloud Backup (Week 1-2)

**Once backend is implemented, enable automatic backups:**

```typescript
// services/autoBackup.ts
class AutoBackup {
  private backupInterval: NodeJS.Timeout | null = null;
  private db = getFirestore();

  start(userId: string) {
    // Backup every 5 minutes
    this.backupInterval = setInterval(() => {
      this.performBackup(userId);
    }, 300000);

    // Immediate backup on page unload
    window.addEventListener('beforeunload', () => {
      this.performBackup(userId);
    });

    // Initial backup
    this.performBackup(userId);
  }

  stop() {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
    }
  }

  private async performBackup(userId: string) {
    const backupData = {
      rawIdeas: JSON.parse(localStorage.getItem('ideaflow_rawIdeas') || '[]'),
      themes: JSON.parse(localStorage.getItem('ideaflow_themes') || '[]'),
      timestamp: new Date().toISOString(),
      version: '1.0'
    };

    // Save with timestamp as ID for historical tracking
    await setDoc(
      doc(this.db, 'users', userId, 'backups', Date.now().toString()),
      backupData
    );

    // Keep only last 10 backups (auto-prune old ones)
    await this.pruneOldBackups(userId);
  }

  private async pruneOldBackups(userId: string) {
    const backupsRef = collection(this.db, 'users', userId, 'backups');
    const snapshot = await getDocs(
      query(backupsRef, orderBy('timestamp', 'desc'))
    );

    const backups = snapshot.docs;

    // Delete backups beyond the 10 most recent
    if (backups.length > 10) {
      const toDelete = backups.slice(10);
      await Promise.all(
        toDelete.map(doc => deleteDoc(doc.ref))
      );
    }
  }

  async restore(userId: string, backupId: string) {
    const backup = await getDoc(
      doc(this.db, 'users', userId, 'backups', backupId)
    );

    if (backup.exists()) {
      const data = backup.data();

      // Confirm with user
      const confirmed = window.confirm(
        `Restore backup from ${new Date(data.timestamp).toLocaleString()}?\n\n` +
        `This will replace your current data:\n` +
        `- ${data.rawIdeas.length} ideas\n` +
        `- ${data.themes.length} themes`
      );

      if (confirmed) {
        localStorage.setItem('ideaflow_rawIdeas', JSON.stringify(data.rawIdeas));
        localStorage.setItem('ideaflow_themes', JSON.stringify(data.themes));
        window.location.reload();
      }
    }
  }

  async listBackups(userId: string): Promise<BackupInfo[]> {
    const backupsRef = collection(this.db, 'users', userId, 'backups');
    const snapshot = await getDocs(
      query(backupsRef, orderBy('timestamp', 'desc'))
    );

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        timestamp: data.timestamp,
        ideaCount: data.rawIdeas.length,
        themeCount: data.themes.length,
        version: data.version
      };
    });
  }
}

export const autoBackup = new AutoBackup();
```

**Backup Manager UI:**
```typescript
// components/BackupManager.tsx
export const BackupManager: React.FC = () => {
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    setLoading(true);
    const backupsList = await autoBackup.listBackups(currentUserId);
    setBackups(backupsList);
    setLoading(false);
  };

  const handleRestore = async (backupId: string) => {
    await autoBackup.restore(currentUserId, backupId);
  };

  const handleCreateManualBackup = async () => {
    await autoBackup.performBackup(currentUserId);
    await loadBackups();
    toast.success('Manual backup created!');
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">Backup History</h2>
        <button onClick={handleCreateManualBackup} className="btn-primary">
          Create Backup Now
        </button>
      </div>

      <div className="text-sm text-gray-600">
        Automatic backups every 5 minutes • Last 10 backups kept
      </div>

      {backups.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No backups yet. They'll appear automatically.
        </div>
      ) : (
        <div className="space-y-2">
          {backups.map((backup, index) => (
            <div
              key={backup.id}
              className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">
                    {index === 0 && '🟢 '}
                    {new Date(backup.timestamp).toLocaleString()}
                    {index === 0 && ' (Latest)'}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {backup.ideaCount} ideas • {backup.themeCount} themes
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {timeAgo(backup.timestamp)}
                  </p>
                </div>
                <button
                  onClick={() => handleRestore(backup.id)}
                  className="btn-secondary"
                  disabled={index === 0}
                >
                  {index === 0 ? 'Current' : 'Restore'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

**Dependencies:** Requires backend (#[Multi-User-Issue])
**Timeline:** 1 week
**Cost:** Included in Firestore storage (~1KB per backup × 10 backups per user)

---

### Solution 2: Version History with Undo/Redo (Week 2-3)

**Local version history for immediate undo:**

```typescript
// services/versionHistory.ts
interface HistoryEntry {
  id: string;
  timestamp: number;
  action: string;
  description: string;
  before: AppState;
  after: AppState;
}

interface AppState {
  ideas: RawIdea[];
  themes: Theme[];
}

class VersionHistory {
  private history: HistoryEntry[] = [];
  private currentIndex: number = -1;
  private maxHistory: number = 50;

  recordChange(action: string, description: string, before: AppState, after: AppState) {
    // Remove any redo history when new change is made
    this.history = this.history.slice(0, this.currentIndex + 1);

    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      action,
      description,
      before,
      after
    };

    this.history.push(entry);
    this.currentIndex++;

    // Limit history size to prevent memory issues
    if (this.history.length > this.maxHistory) {
      this.history.shift();
      this.currentIndex--;
    }

    this.save();
  }

  undo(): AppState | null {
    if (!this.canUndo()) return null;

    const entry = this.history[this.currentIndex];
    this.currentIndex--;
    this.save();

    return entry.before;
  }

  redo(): AppState | null {
    if (!this.canRedo()) return null;

    this.currentIndex++;
    const entry = this.history[this.currentIndex];
    this.save();

    return entry.after;
  }

  canUndo(): boolean {
    return this.currentIndex >= 0;
  }

  canRedo(): boolean {
    return this.currentIndex < this.history.length - 1;
  }

  getCurrentEntry(): HistoryEntry | null {
    if (this.currentIndex < 0) return null;
    return this.history[this.currentIndex];
  }

  getHistory(): HistoryEntry[] {
    return this.history.slice(0, this.currentIndex + 1);
  }

  clear() {
    this.history = [];
    this.currentIndex = -1;
    this.save();
  }

  private save() {
    // Save to localStorage (compressed)
    const data = {
      history: this.history,
      currentIndex: this.currentIndex
    };
    localStorage.setItem('ideaflow_history', JSON.stringify(data));
  }

  load() {
    const saved = localStorage.getItem('ideaflow_history');
    if (saved) {
      const data = JSON.parse(saved);
      this.history = data.history || [];
      this.currentIndex = data.currentIndex ?? -1;
    }
  }
}

export const versionHistory = new VersionHistory();
```

**Use in App.tsx:**
```typescript
// App.tsx
useEffect(() => {
  versionHistory.load();
}, []);

const recordChange = (action: string, description: string) => {
  const before = { ideas: rawIdeas, themes };
  return (after: AppState) => {
    versionHistory.recordChange(action, description, before, after);
  };
};

const handleDeleteIdea = (id: string) => {
  const record = recordChange('delete_idea', 'Deleted an idea');

  setRawIdeas(prev => {
    const updated = prev.filter(idea => idea.id !== id);
    record({ ideas: updated, themes });
    return updated;
  });
};

const handleUndo = () => {
  const previous = versionHistory.undo();
  if (previous) {
    setRawIdeas(previous.ideas);
    setThemes(previous.themes);
    toast.info('Undo: ' + versionHistory.getCurrentEntry()?.description);
  }
};

const handleRedo = () => {
  const next = versionHistory.redo();
  if (next) {
    setRawIdeas(next.ideas);
    setThemes(next.themes);
    toast.info('Redo: ' + versionHistory.getCurrentEntry()?.description);
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

**Undo/Redo UI:**
```typescript
// components/UndoRedoButtons.tsx
export const UndoRedoButtons: React.FC = () => {
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    const update = () => {
      setCanUndo(versionHistory.canUndo());
      setCanRedo(versionHistory.canRedo());
    };

    update();

    // Update on history change
    window.addEventListener('history-changed', update);
    return () => window.removeEventListener('history-changed', update);
  }, []);

  return (
    <div className="flex gap-1">
      <button
        onClick={handleUndo}
        disabled={!canUndo}
        className="p-2 rounded hover:bg-gray-100 disabled:opacity-30"
        title="Undo (Cmd+Z)"
      >
        <UndoIcon className="w-5 h-5" />
      </button>
      <button
        onClick={handleRedo}
        disabled={!canRedo}
        className="p-2 rounded hover:bg-gray-100 disabled:opacity-30"
        title="Redo (Cmd+Shift+Z)"
      >
        <RedoIcon className="w-5 h-5" />
      </button>
    </div>
  );
};
```

**Timeline:** 1-2 weeks
**Cost:** $0 (localStorage-based)

---

### Solution 3: Trash/Archive System (Week 1)

**Soft delete instead of hard delete:**

```typescript
// Add to types.ts
interface RawIdea {
  // ... existing fields
  deletedAt?: string;
  deletedBy?: string;
}

interface Theme {
  // ... existing fields
  deletedAt?: string;
  deletedBy?: string;
}

// Soft delete implementation
const handleDeleteIdea = (id: string) => {
  const record = recordChange('trash_idea', 'Moved idea to trash');

  setRawIdeas(prev => {
    const updated = prev.map(idea =>
      idea.id === id
        ? { ...idea, deletedAt: new Date().toISOString() }
        : idea
    );
    record({ ideas: updated, themes });
    return updated;
  });

  toast.info('Moved to trash', {
    action: {
      label: 'Undo',
      onClick: () => handleUndo()
    }
  });
};

// Filter deleted items in UI
const activeIdeas = rawIdeas.filter(idea => !idea.deletedAt);
const trashedIdeas = rawIdeas.filter(idea => idea.deletedAt);

// Restore from trash
const handleRestoreIdea = (id: string) => {
  const record = recordChange('restore_idea', 'Restored idea from trash');

  setRawIdeas(prev => {
    const updated = prev.map(idea =>
      idea.id === id
        ? { ...idea, deletedAt: undefined }
        : idea
    );
    record({ ideas: updated, themes });
    return updated;
  });

  toast.success('Idea restored!');
};

// Permanent delete (after 30 days)
useEffect(() => {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  setRawIdeas(prev => prev.filter(idea => {
    if (!idea.deletedAt) return true;

    const deletedTime = new Date(idea.deletedAt).getTime();
    return deletedTime > thirtyDaysAgo;
  }));
}, []);
```

**Trash View:**
```typescript
// components/TrashView.tsx
export const TrashView: React.FC = () => {
  const trashedIdeas = rawIdeas.filter(idea => idea.deletedAt);
  const trashedThemes = themes.filter(theme => theme.deletedAt);

  const getDaysUntilPermanentDelete = (deletedAt: string) => {
    const deleted = new Date(deletedAt).getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    const expiresAt = deleted + thirtyDays;
    const daysLeft = Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000));
    return daysLeft;
  };

  const handleEmptyTrash = () => {
    if (confirm('Permanently delete all items in trash? This cannot be undone.')) {
      setRawIdeas(prev => prev.filter(idea => !idea.deletedAt));
      setThemes(prev => prev.filter(theme => !theme.deletedAt));
      toast.success('Trash emptied');
    }
  };

  if (trashedIdeas.length === 0 && trashedThemes.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <TrashIcon className="w-16 h-16 mx-auto mb-4 opacity-30" />
        <h3 className="text-lg font-semibold">Trash is empty</h3>
        <p>Deleted items will appear here for 30 days before being permanently deleted.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Trash</h2>
          <p className="text-sm text-gray-600">
            Items are permanently deleted after 30 days
          </p>
        </div>
        <button onClick={handleEmptyTrash} className="btn-danger">
          Empty Trash
        </button>
      </div>

      {trashedIdeas.length > 0 && (
        <div>
          <h3 className="font-semibold mb-2">Deleted Ideas ({trashedIdeas.length})</h3>
          {trashedIdeas.map(idea => (
            <div key={idea.id} className="p-4 border rounded-lg mb-2 bg-red-50">
              <p>{idea.content}</p>
              <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-red-600">
                  Deletes in {getDaysUntilPermanentDelete(idea.deletedAt!)} days
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRestoreIdea(idea.id)}
                    className="btn-sm btn-primary"
                  >
                    Restore
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(idea.id)}
                    className="btn-sm btn-danger"
                  >
                    Delete Forever
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Similar for themes */}
    </div>
  );
};
```

**Timeline:** 1 week
**Cost:** $0

---

## Recommended Implementation Order

### Phase 1: Quick Wins (Week 1) - IMMEDIATE PRIORITY
1. **Trash system** (3 days)
   - Prevents accidental permanent deletions
   - 30-day recovery window
   - Zero infrastructure required

2. **Export/Import** (2 days)
   - Manual backup option
   - Device migration capability
   - User owns their data

**Priority:** 🔴 **START THESE IMMEDIATELY**

### Phase 2: Auto-Backup (Week 2)
3. **Cloud backup** (5 days)
   - Automatic every 5 minutes
   - Keep last 10 versions
   - One-click restoration
   - Requires backend

### Phase 3: Version Control (Week 3-4)
4. **Undo/Redo system** (7 days)
   - 50-action history
   - Cmd+Z / Cmd+Shift+Z shortcuts
   - Visual history timeline

---

## Features to Implement

### Trash System
- [ ] Soft delete for ideas
- [ ] Soft delete for themes
- [ ] Trash view with list
- [ ] 30-day auto-purge
- [ ] Restore button
- [ ] Empty trash button
- [ ] Days-until-deletion counter

### Auto-Backup
- [ ] Backup every 5 minutes
- [ ] Backup on page unload
- [ ] Keep last 10 backups
- [ ] Backup manager UI
- [ ] One-click restore
- [ ] Manual backup button
- [ ] Backup size indicator

### Version History
- [ ] Record all changes
- [ ] Undo functionality (Cmd+Z)
- [ ] Redo functionality (Cmd+Shift+Z)
- [ ] Undo/redo buttons in UI
- [ ] History timeline view
- [ ] Change descriptions
- [ ] Visual diff view (future)

### Data Integrity
- [ ] Validate data on load
- [ ] Repair corrupted data
- [ ] Detect and warn of issues
- [ ] Automatic data health checks

---

## Success Metrics
- [ ] Zero data loss incidents
- [ ] 100% of deletions recoverable within 30 days
- [ ] 95%+ backup success rate
- [ ] <2s to restore backup
- [ ] Undo used by 40%+ users
- [ ] Average 15 undo/redo actions per user per session

---

## Testing Checklist
- [ ] Test trash with 1 idea
- [ ] Test trash with 100 ideas
- [ ] Test restore from trash
- [ ] Test 30-day auto-purge
- [ ] Test backup creation
- [ ] Test backup restoration
- [ ] Test corrupted backup file
- [ ] Test undo/redo 50 times
- [ ] Test undo/redo with complex state
- [ ] Test data corruption recovery

---

## User Education

### Onboarding
- Show trash feature on first delete
- Explain 30-day recovery window
- Promote auto-backup after signup

### In-App
- Trash icon in navigation
- "Moved to trash" toast with undo
- Backup status in settings
- Undo hint on first edit

---

## References
- `ARCHITECTURE_IMPROVEMENTS.md` Section 5 - Detailed implementation
- [Soft Delete Patterns](https://en.wikipedia.org/wiki/Soft_deletion)
- [Undo/Redo Patterns](https://en.wikipedia.org/wiki/Command_pattern)

## Related Issues
- #[Multi-User] - Backend required for auto-backup
- #[API-Security] - Authenticated backups
- #[Offline-Support] - Offline queue prevents data loss
