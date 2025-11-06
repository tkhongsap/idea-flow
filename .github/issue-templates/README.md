# GitHub Issue Templates for Architecture Improvements

This directory contains comprehensive issue templates for the 5 major architectural improvements planned for IdeaFlow.

## How to Create Issues from These Templates

### Option 1: Manual Copy-Paste (Easiest)
1. Go to [GitHub Issues](https://github.com/tkhongsap/idea-flow/issues/new)
2. Open one of the template files below
3. Copy the entire content
4. Paste into the GitHub issue body
5. Update the title to match the template header
6. Add the appropriate labels (listed at the top of each template)
7. Click "Submit new issue"

### Option 2: Using GitHub CLI
If you have the `gh` CLI installed and authenticated:

```bash
# Navigate to project root
cd /home/user/idea-flow

# Create all issues at once
for file in .github/issue-templates/*.md; do
  if [[ "$file" != *"README.md" ]]; then
    # Extract title (first line after # )
    title=$(grep -m 1 "^# " "$file" | sed 's/^# //')

    # Extract labels (from the label line)
    labels=$(grep "^\*\*Labels:\*\*" "$file" | sed 's/^**Labels:** //' | sed 's/`//g')

    # Create issue
    gh issue create \
      --title "$title" \
      --body-file "$file" \
      --label "$labels"
  fi
done
```

### Option 3: GitHub Web Interface with Template Selection
1. Go to your repository's Issues tab
2. Click "New issue"
3. If you've set up issue templates in `.github/ISSUE_TEMPLATE/`, select the appropriate one
4. GitHub will auto-populate the issue with the template content

---

## Available Templates

### 1. Multi-User Support & Collaboration
**File:** `01-multi-user-support.md`
**Priority:** High
**Timeline:** 4 weeks
**Cost:** ~$15/month

**What it covers:**
- User authentication (Google, email)
- Real-time cloud sync across devices
- Shared workspaces with permissions
- Collaboration features (comments, activity feed)
- Three implementation options (Firebase, Supabase, P2P)

**Dependencies:** None (can start immediately)

---

### 2. Cross-Device Sync & Data Portability
**File:** `02-cross-device-sync.md`
**Priority:** High (Quick win available)
**Timeline:** 1 day (export/import) to 4 weeks (full sync)
**Cost:** $0 (export/import) or included in backend costs

**What it covers:**
- Export/Import functionality (immediate quick win)
- Automatic cloud sync (with backend)
- Manual device migration
- Data ownership and portability

**Dependencies:**
- Quick win: None (can implement today)
- Full sync: Requires #1 (Multi-User backend)

**🔴 RECOMMENDED: Start with Export/Import immediately (1-2 days)**

---

### 3. API Key Security
**File:** `03-api-key-security.md`
**Priority:** CRITICAL 🔴
**Timeline:** 2 weeks
**Cost:** $0 (included in backend)

**What it covers:**
- Backend API proxy implementation
- Per-user rate limiting
- Usage tracking and cost control
- Three implementation options (Firebase, Vercel, Custom)

**Dependencies:** Requires #1 (Multi-User backend with auth)

**⚠️ CRITICAL SECURITY ISSUE - Currently API key is exposed in client bundle**

---

### 4. Offline Support
**File:** `04-offline-support.md`
**Priority:** Medium
**Timeline:** 2-3 weeks
**Cost:** $0

**What it covers:**
- Progressive Web App (PWA) implementation
- Service Worker for offline caching
- Offline queue for API requests
- Mobile installation support
- Automatic sync when reconnected

**Dependencies:** None (can implement independently)

**Benefits:** Better mobile experience, installable app, works offline

---

### 5. Data Loss Prevention
**File:** `05-data-loss-prevention.md`
**Priority:** High
**Timeline:** 1-4 weeks (phased approach)
**Cost:** $0 (trash/undo) to included in backend (backups)

**What it covers:**
- Trash system with 30-day recovery (Week 1)
- Automatic cloud backups every 5 minutes (Week 2)
- Version history with undo/redo (Week 3-4)
- Data integrity checks

**Dependencies:**
- Trash & Undo: None (can implement immediately)
- Auto-backup: Requires #1 (Multi-User backend)

**🔴 RECOMMENDED: Start with Trash system immediately (1 week)**

---

## Recommended Implementation Order

### Phase 1: Quick Wins (Week 1-2) 🚀
**Start these IMMEDIATELY - No backend required**

1. **Export/Import** (Issue #2) - 1-2 days
   - Manual backup for users
   - Device migration capability
   - Zero infrastructure cost

2. **Trash System** (Issue #5) - 1 week
   - Prevent accidental deletions
   - 30-day recovery window
   - Builds user confidence

**Impact:** Immediate data safety without backend complexity

---

### Phase 2: Backend Foundation (Week 3-6)
**Core infrastructure for all other features**

3. **Multi-User Backend** (Issue #1) - 4 weeks
   - Firebase authentication
   - Real-time Firestore sync
   - Workspace management

4. **API Security** (Issue #3) - 2 weeks (parallel with #1)
   - Backend API proxy
   - Rate limiting
   - Cost control

**Impact:** Secure, scalable foundation for all future features

---

### Phase 3: Enhanced UX (Week 7-10)

5. **Automatic Backups** (Issue #5) - 1 week
   - Cloud backup every 5 minutes
   - One-click restoration

6. **Version History** (Issue #5) - 2 weeks
   - Undo/Redo with Cmd+Z
   - 50-action history

7. **Offline Support** (Issue #4) - 2-3 weeks
   - PWA implementation
   - Mobile installation
   - Offline queue

**Impact:** Production-grade reliability and mobile experience

---

## Priority Matrix

| Issue | Priority | Effort | Impact | Dependencies | Start When |
|-------|----------|--------|--------|--------------|------------|
| #2 Export/Import | 🔴 High | Low | High | None | **TODAY** |
| #5 Trash System | 🔴 High | Low | High | None | **TODAY** |
| #3 API Security | 🔴 CRITICAL | Med | Critical | Auth | Week 2 |
| #1 Multi-User | 🔴 High | High | High | None | Week 2 |
| #5 Auto-Backup | 🟡 Medium | Low | High | #1 | Week 5 |
| #5 Undo/Redo | 🟡 Medium | Med | Medium | None | Week 6 |
| #4 Offline PWA | 🟢 Medium | Med | Medium | None | Week 7 |

---

## Cost Summary

### Current State
- **Monthly Cost:** $0 (Replit free tier)
- **Risk:** Unlimited API abuse potential = $$$$ in surprise bills
- **Capabilities:** Single-user, no collaboration, data loss risk

### With All Improvements
- **Monthly Cost:** $15-25 (Firebase or Supabase)
- **Risk:** Zero (API key secured, rate limited)
- **Capabilities:**
  - Multi-user with real-time collaboration
  - Secure API with cost controls
  - Automatic backups + version history
  - Offline support + PWA
  - Cross-device sync

**ROI:** Backend cost pays for itself by preventing even ONE API abuse incident

---

## Success Metrics

Track these KPIs after implementation:

### Security
- [ ] Zero exposed API keys in production
- [ ] <1% API abuse attempts
- [ ] 100% of API calls authenticated
- [ ] Predictable monthly costs within budget

### Reliability
- [ ] Zero data loss incidents
- [ ] 99.9% uptime
- [ ] <1 second sync latency
- [ ] 95%+ backup success rate

### User Experience
- [ ] Users can access data from any device
- [ ] 100% of deletions recoverable (within 30 days)
- [ ] App works offline for viewing/capturing
- [ ] 50%+ mobile users install PWA
- [ ] 30%+ users adopt collaboration features

---

## Related Documentation

- **Main Plan:** `ARCHITECTURE_IMPROVEMENTS.md` (detailed implementation guides)
- **Codebase Docs:** `CLAUDE.md` (AI assistant instructions)
- **Project README:** `README.md` (user-facing documentation)

---

## Questions?

If you need clarification on any template or implementation approach:
1. Review the detailed plan in `ARCHITECTURE_IMPROVEMENTS.md`
2. Check the relevant sections in each issue template
3. Consider the dependencies and recommended order
4. Start with the quick wins (export/import + trash) to build momentum

---

## Creating Issues Now

**Ready to get started?** Here's the fastest path:

```bash
# 1. Create the two quick-win issues first
# Open 02-cross-device-sync.md and create Issue #2
# Open 05-data-loss-prevention.md and create Issue #5

# 2. Create the critical security issue
# Open 03-api-key-security.md and create Issue #3

# 3. Create the foundation issues
# Open 01-multi-user-support.md and create Issue #1
# Open 04-offline-support.md and create Issue #4
```

**Or create all at once using the GitHub CLI script above!**

---

**Happy building! 🚀**
