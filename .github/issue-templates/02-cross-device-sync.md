# Cross-Device Sync & Data Portability

**Labels:** `enhancement`, `architecture`, `priority: high`

## Problem
Data is currently trapped in single browser's localStorage:
- ❌ No sync across devices (desktop, mobile, different browsers)
- ❌ Browser clear = permanent data loss
- ❌ No way to migrate data to new device
- ❌ Can't access ideas from phone while working on desktop

## Impact
Users lose trust in the app due to fear of data loss. This is a critical barrier to adoption.

## Proposed Solutions

### Solution 1: Cloud Sync (Recommended - Part of Multi-User)
Once Firebase/Supabase backend is implemented, cross-device sync is automatic:
- Login from any device
- Data syncs in real-time
- Offline changes queued and synced when online
- Works seamlessly across platforms

**Dependencies:** Requires multi-user backend (#[Multi-User-Issue-Number])
**Timeline:** Included in multi-user implementation (4 weeks)
**Cost:** Included in backend costs (~$15/month)

### Solution 2: Export/Import (Immediate Quick Win)
**Can be implemented TODAY while waiting for backend**

**Implementation:**
```typescript
// Export
const exportData = () => {
  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    rawIdeas: localStorage.getItem('ideaflow_rawIdeas'),
    themes: localStorage.getItem('ideaflow_themes')
  };
  // Download as JSON file
};

// Import
const importData = (file: File) => {
  // Parse and validate JSON
  // Confirm before overwriting
  // Update localStorage
  // Reload app
};
```

**UI Additions:**
- Export button in header/settings
- Import via file picker
- Format: `ideaflow-backup-{timestamp}.json`

**Benefits:**
- ✅ Immediate data safety
- ✅ Manual device migration
- ✅ Zero infrastructure cost
- ✅ Works offline
- ✅ User owns their data

**Limitations:**
- Manual process (not automatic)
- No real-time sync
- User must remember to export

**Timeline:** 1-2 days
**Cost:** $0

### Solution 3: Automatic Cloud Backup (Without Full Backend)
Use Dropbox/Google Drive API for automatic backups:

**Implementation:**
- User connects Dropbox/Google Drive account
- App auto-backs up every hour
- Sync on app launch
- User owns data in their cloud storage

**Benefits:**
- ✅ Automatic backups
- ✅ User controls data storage
- ✅ Works across devices (with manual restore)

**Limitations:**
- Requires OAuth setup
- Not real-time (hourly)
- More complex than export/import

**Timeline:** 1-2 weeks
**Cost:** $0 (uses user's storage)

## Recommended Implementation Strategy

### Phase 1: Quick Win (Week 1)
Implement **Export/Import** immediately:
- Provides immediate safety net
- Builds user confidence
- Takes 1-2 days to implement
- Zero cost

**Priority:** 🔴 **CRITICAL - Implement First**

### Phase 2: Backend Sync (Week 2-5)
Implement **Cloud Sync** with backend:
- Automatic, real-time sync
- Works seamlessly
- Part of multi-user implementation

### Phase 3: Enhanced Portability (Future)
- Export to other formats (CSV, Markdown)
- Integrate with note-taking apps (Notion, Obsidian)
- API for third-party integrations

## Features to Implement

### Export Functionality
- [ ] Export button in header
- [ ] Export all data as JSON
- [ ] Include timestamp in filename
- [ ] Validate data before export
- [ ] Success confirmation toast

### Import Functionality
- [ ] Import button with file picker
- [ ] Validate JSON structure
- [ ] Preview import data (show counts)
- [ ] Confirm dialog before overwrite
- [ ] Merge vs Replace options
- [ ] Error handling for corrupt files

### UI/UX Improvements
- [ ] Clear visual indicators of data source (local vs cloud)
- [ ] Last sync timestamp
- [ ] Sync status indicator
- [ ] Conflict resolution UI (if needed)

### Data Format
```json
{
  "version": "1.0",
  "exportedAt": "2025-11-06T14:00:00.000Z",
  "metadata": {
    "ideaCount": 42,
    "themeCount": 8,
    "exportSource": "IdeaFlow v1.0"
  },
  "rawIdeas": [...],
  "themes": [...]
}
```

## Migration Path

### Current Users (localStorage only)
1. Prompt to export data (one-time migration)
2. Create account
3. Import data to cloud
4. Enable auto-sync

### New Users
- Start with cloud sync by default
- Still provide export for data portability

## Success Metrics
- [ ] 100% of users can export their data
- [ ] <5 seconds to export/import
- [ ] Zero data corruption during import
- [ ] 90%+ users complete one-time migration
- [ ] <1% import failure rate

## Security Considerations
- Exported JSON contains all user data (no encryption by default)
- Warn users about storing exports securely
- Consider adding optional encryption with user password
- Sanitize data before export (remove sensitive debugging info)

## Alternative Formats (Future)

### Export Options
- **JSON** (current, machine-readable)
- **Markdown** (human-readable, portable)
- **CSV** (for spreadsheet analysis)
- **HTML** (for archival/print)

### Import Options
- Support importing from other note-taking apps
- Parse markdown files into ideas
- Bulk import from CSV

## Testing Checklist
- [ ] Export with 0 ideas/themes
- [ ] Export with 1000+ ideas
- [ ] Import valid backup
- [ ] Import corrupted JSON
- [ ] Import old version format
- [ ] Import on different browser
- [ ] Import with existing data (merge)
- [ ] Import with existing data (replace)

## References
- `ARCHITECTURE_IMPROVEMENTS.md` Section 2 - Detailed implementation
- Example backup format in `/docs/backup-format.md`

## Related Issues
- #[Multi-User] - Backend sync implementation
- #[Data-Loss-Prevention] - Automatic backups
- #[Offline-Support] - Offline data access
