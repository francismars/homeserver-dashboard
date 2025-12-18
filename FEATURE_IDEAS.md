# Dashboard Feature Ideas

Based on available homeserver APIs, here are cool features we could add to the dashboard:

## 🔧 Core Infrastructure Features

### 0. **Login & Connection Management** ⭐⭐⭐

**APIs**: Admin API (`/info`, `/dav`), Pubky SDK (PKARR resolution)

**What it enables:**

- **No env file required**: Deploy dashboard as standalone app without build-time configuration
- **Multi-homeserver support**: Connect to and manage multiple homeservers from one dashboard
- **Pubky authentication**: Optional sign-in with pubky for easier connection and homeserver discovery
- **Flexible deployment**: Works for local development, self-hosted, or public deployments
- **Better security**: Pubky-based auth instead of just admin tokens

**User flows:**

- **Anonymous mode**: Enter homeserver pubkey/URL + admin token → Connect
- **Pubky mode**: Sign in with secret key → Discover homeservers via PKARR → Auto-connect
- **Multi-homeserver**: Switch between connected homeservers, add new ones

**Implementation:**

- Create connection context/provider to manage current homeserver connection
- Replace all `process.env.NEXT_PUBLIC_ADMIN_*` usage with connection context
- Build connection page (`/connect` or `/`) with:
  - Connection form (homeserver pubkey/URL + admin token)
  - Optional "Sign in with Pubky" button
  - Homeserver discovery for pubky users
- Update routing: redirect to connection page if no connection exists
- Store connections in:
  - `sessionStorage` for anonymous users (single homeserver)
  - `localStorage` (encrypted) for pubky users (multiple homeservers)
- Add homeserver switcher in navbar for multi-homeserver management
- Update all services/hooks to initialize with connection from context

**Value**:

- Enables flexible deployment without rebuilds
- Foundation for multi-homeserver management
- Better UX for users managing multiple homeservers
- More secure authentication option

**Priority**: **CRITICAL** - Should be implemented before other features to enable flexible deployment

---

## 🎯 High-Value Features (Easy to Implement)

### 1. **Activity Feed / Event Stream** ⭐⭐⭐

**API**: `GET /events/` and `GET /events-stream` (SSE)

**What it shows:**

- Real-time activity feed of file operations (PUT, DELETE)
- Recent user signups (from events)
- File uploads/deletions across all users
- Activity timeline with timestamps
- Filter by user pubkey
- Live updates via Server-Sent Events

**Implementation:**

- New "Activity" tab
- List view with event type badges (PUT/DEL)
- User pubkey extraction from paths
- Time-ago formatting
- Click to navigate to file in File Browser
- Real-time updates using EventSource API

**Value**: Great for monitoring server activity and debugging issues

---

### 2. **Storage Analytics** ⭐⭐ ⚠️ **PARTIALLY IMPLEMENTED**

**Status**: ⚠️ Partially implemented in Usage tab

**What's implemented:**

- ✅ Storage trends over time (mock data with interactive charts)
- ✅ Storage capacity visualization with breakdown (User Data, Database, System Files)
- ✅ Health status indicators (Healthy/Warning/Critical)

**Remaining work:**

- Top users by storage usage
- File type breakdown (by extension)
- Storage by directory structure
- Largest files/folders
- Real storage data (currently mocked)

---

### 3. **Real-Time Metrics Dashboard** ⭐⭐

**API**: `GET /metrics` (Prometheus format)

**What it shows:**

- Active event stream connections
- Database query performance (histograms)
- Event stream lag indicators
- Connection duration stats
- Request rates

**Implementation:**

- Parse Prometheus text format
- Display key metrics as cards
- Simple charts for trends
- Refresh interval selector
- Alert thresholds (e.g., "High lag detected")

**Value**: Monitor server health and performance

---

### 4. **Signup Code Analytics** ⭐ ⚠️ **PARTIALLY IMPLEMENTED**

**Status**: ⚠️ Partially implemented in InvitesDialog

**What's implemented:**

- ✅ Generate signup tokens (real API: `/generate_signup_token`)
- ✅ View recently generated invites
- ✅ Copy invite codes to clipboard
- ✅ Invite statistics display (mock data)

**Remaining work:**

- Track which codes generated the most users (requires events API)
- Match signups to codes via events
- Usage statistics per code
- Code creation timeline
- User signup timeline visualization

---

## 🚀 Advanced Features (Require More Work)

### 5. **File Search & Analytics** ⭐⭐ ⚠️ **PARTIALLY IMPLEMENTED**

**Status**: ⚠️ Partially implemented in FileBrowser (integrated into Users tab)

**What's implemented:**

- ✅ Search files by name (within current directory)
- ✅ Filter and sort files (by name, size, date)
- ✅ Browse files and directories via WebDAV

**Remaining work:**

- Search across all users (currently limited to user-specific directories)
- File type statistics
- Largest files list
- Most active files (by event frequency)
- Duplicate file detection
- Recursive directory scanning across all users

---

### 6. **User Activity Timeline** ⭐⭐

**APIs**: `/events/` filtered by user

**What it shows:**

- Per-user activity timeline
- File operations over time
- Activity heatmap (by hour/day)
- Most active users ranking
- Activity patterns

**Implementation:**

- Fetch events filtered by user
- Group by time periods
- Visualize with timeline/heatmap components
- Aggregate across users for rankings

**Value**: Understand user behavior and activity patterns

---

### 7. **Health Monitoring & Alerts** ⭐⭐

**APIs**: `/info`, `/metrics`, `/events-stream`

**What it shows:**

- Server health status
- Disk usage alerts (when approaching limits)
- High error rate detection
- Connection issues
- Performance degradation warnings

**Implementation:**

- Poll `/info` and `/metrics` periodically
- Set thresholds for alerts
- Visual indicators (status badges)
- Alert history

**Value**: Proactive monitoring and issue detection

---

### 8. **Backup & Export Tools** ⭐

**APIs**: WebDAV (full file access)

**What it shows:**

- Export user data (all files for a user)
- Backup configuration
- Export metrics/logs
- Bulk operations

**Implementation:**

- Use WebDAV to download files
- Zip/tar creation in browser (using JSZip)
- Progress indicators
- Scheduled exports (requires backend)

**Value**: Data portability and backup capabilities

---

## 🎨 UI/UX Enhancements

### 9. **Dark/Light Mode Toggle** ⚠️ **PARTIALLY IMPLEMENTED**

**Status**: ⚠️ Toggle exists but is mock (doesn't actually change theme)

**What's implemented:**

- ✅ Theme toggle in settings dropdown
- ✅ UI for dark/light mode switching

**Remaining work:**

- Actual theme switching functionality
- Persist preference in localStorage
- Apply theme changes to the UI

### 10. **Dashboard Customization**

- Drag-and-drop widget arrangement
- Show/hide cards
- Customizable refresh intervals

### 11. **Keyboard Shortcuts**

- Quick navigation between tabs
- Search shortcuts
- Action shortcuts (e.g., Ctrl+K for search)

### 12. **Export Reports**

- PDF export of dashboard state
- CSV export of user lists
- JSON export of metrics

---

## 📊 Recommended Priority Order

**Phase 1 (Quick Wins):**

1. ⚠️ **Activity Feed** - High value, uses existing `/events/` endpoint
2. ⚠️ **Storage Analytics** - ⚠️ **PARTIALLY IMPLEMENTED** (needs real data and additional features)

**Phase 2 (More Complex):** 3. ⚠️ **Real-Time Metrics** - Medium value, requires Prometheus parsing 4. ⚠️ **File Search** - ⚠️ **PARTIALLY IMPLEMENTED** (needs cross-user search and analytics)

**Phase 3 (Nice to Have):** 5. ⚠️ **User Activity Timeline** - Nice visualization 6. ⚠️ **Health Monitoring** - Proactive alerts 7. ⚠️ **Signup Code Analytics** - ⚠️ **PARTIALLY IMPLEMENTED** (needs usage tracking)

---

## 💡 Implementation Notes

**For Activity Feed:**

- Use EventSource API for `/events-stream` (SSE)
- Parse event format: `PUT pubky://user_pubkey/pub/file.txt`
- Extract user pubkey from path
- Show relative timestamps ("2 minutes ago")
- Link events to File Browser

**For Storage Analytics:**

- Use WebDAV PROPFIND with depth=infinity for full directory tree
- Parse file extensions from paths
- Calculate sizes from `getcontentlength` properties
- Group by extension/user/directory

**For Metrics:**

- Parse Prometheus text format (simple key-value format)
- Extract relevant metrics:
  - `event_stream_active_connections`
  - `events_db_query_duration_ms`
  - `event_stream_broadcast_lagged_count`
- Display as cards with trend indicators

---

## 🔧 Technical Considerations

**Performance:**

- Cache frequently accessed data (user lists, metrics)
- Use pagination for large datasets
- Debounce search/filter inputs
- Lazy load heavy components

**Data Storage:**

- Use localStorage for user preferences
- Consider IndexedDB for caching event data
- Store metrics history locally (limited)

**Real-Time Updates:**

- Use EventSource for SSE streams
- Polling fallback for browsers without SSE support
- WebSocket alternative (would require backend changes)

**Error Handling:**

- Graceful degradation when APIs unavailable
- Show partial data when possible
- Clear error messages with retry options
