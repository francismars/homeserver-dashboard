# Dashboard Feature Ideas

Based on available homeserver APIs, here are cool features we could add to the dashboard:

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

### 2. **User Management Dashboard** ⭐⭐⭐
**APIs**: `/events/` (to extract users), `/info` (user counts), WebDAV (to browse user files)

**What it shows:**
- List of all users (extracted from events or file system)
- User details:
  - Pubkey
  - Signup date (from first event)
  - Last activity timestamp
  - Storage used (via WebDAV PROPFIND)
  - File count
  - Status (active/disabled)
- Quick actions:
  - Disable/Enable user
  - View user's files
  - Delete user's files
  - Copy pubkey

**Implementation:**
- Parse `/events/` to extract unique user pubkeys
- Use WebDAV to get storage stats per user
- Table view with sortable columns
- Search/filter by pubkey
- Link to File Browser filtered by user

**Value**: Centralized user management and monitoring

---

### 3. **Storage Analytics** ⭐⭐
**APIs**: `/info` (total disk usage), WebDAV PROPFIND (per-user storage)

**What it shows:**
- Storage trends over time (if we track it)
- Top users by storage usage
- File type breakdown (by extension)
- Storage growth chart
- Storage by directory structure
- Largest files/folders

**Implementation:**
- Aggregate WebDAV directory listings
- Parse file extensions
- Calculate directory sizes recursively
- Charts using a simple charting library (recharts or similar)
- Storage history (requires local storage or backend endpoint)

**Value**: Understand storage patterns and identify heavy users

---

### 4. **Real-Time Metrics Dashboard** ⭐⭐
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

### 5. **Signup Code Analytics** ⭐
**APIs**: `/info` (signup code counts), `/events/` (to track usage)

**What it shows:**
- Signup codes and their usage
- Which codes generated the most users
- Unused codes list
- Code creation timeline
- User signup timeline

**Implementation:**
- Track generated codes (already done)
- Parse events to match signups to codes
- Show usage statistics per code
- Visualize signup trends

**Value**: Understand invite code effectiveness

---

## 🚀 Advanced Features (Require More Work)

### 6. **File Search & Analytics** ⭐⭐
**APIs**: WebDAV PROPFIND (recursive directory listing)

**What it shows:**
- Search files by name across all users
- File type statistics
- Largest files list
- Most active files (by event frequency)
- Duplicate file detection (by content hash from events)

**Implementation:**
- Recursive PROPFIND with depth=infinity
- Client-side indexing/search
- Parse file extensions
- Match events to files for activity stats

**Value**: Find files quickly and understand file patterns

---

### 7. **User Activity Timeline** ⭐⭐
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

### 8. **Health Monitoring & Alerts** ⭐⭐
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

### 9. **Backup & Export Tools** ⭐
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

### 10. **System Logs Viewer** ⭐
**APIs**: Could add `/logs` endpoint (not currently available)

**What it shows:**
- Real-time log stream
- Filter by log level
- Search logs
- Export logs

**Implementation:**
- Would require new backend endpoint
- Or parse metrics for error indicators
- SSE stream for real-time logs

**Value**: Debugging and troubleshooting

---

## 🎨 UI/UX Enhancements

### 11. **Dark/Light Mode Toggle**
- Already have theme variables from Franky
- Add toggle in header
- Persist preference

### 12. **Dashboard Customization**
- Drag-and-drop widget arrangement
- Show/hide cards
- Customizable refresh intervals

### 13. **Keyboard Shortcuts**
- Quick navigation between tabs
- Search shortcuts
- Action shortcuts (e.g., Ctrl+K for search)

### 14. **Export Reports**
- PDF export of dashboard state
- CSV export of user lists
- JSON export of metrics

---

## 📊 Recommended Priority Order

**Phase 1 (Quick Wins):**
1. ✅ **Activity Feed** - High value, uses existing `/events/` endpoint
2. ✅ **User Management Dashboard** - High value, combines multiple APIs
3. ✅ **Storage Analytics** - Medium value, uses WebDAV + `/info`

**Phase 2 (More Complex):**
4. ✅ **Real-Time Metrics** - Medium value, requires Prometheus parsing
5. ✅ **File Search** - High value but requires recursive directory scanning

**Phase 3 (Nice to Have):**
6. ✅ **User Activity Timeline** - Nice visualization
7. ✅ **Health Monitoring** - Proactive alerts
8. ✅ **Signup Code Analytics** - Useful for understanding growth

---

## 💡 Implementation Notes

**For Activity Feed:**
- Use EventSource API for `/events-stream` (SSE)
- Parse event format: `PUT pubky://user_pubkey/pub/file.txt`
- Extract user pubkey from path
- Show relative timestamps ("2 minutes ago")
- Link events to File Browser

**For User Management:**
- Extract unique users from events: `GET /events/?limit=1000` then parse paths
- Or use WebDAV: `PROPFIND /dav/` to list user directories
- Calculate storage per user via recursive PROPFIND
- Cache user list to avoid repeated API calls

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

