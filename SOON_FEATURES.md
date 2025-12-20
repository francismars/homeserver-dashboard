# "Soon" Features Implementation Guide

Quick reference for implementing features marked with "Soon" badges in the dashboard.

---

## API Endpoints Needed

### Homeserver
```
GET /info
  + pubkey: string
  + version: string
  + signup_code_stats?: Array<{ invite_code: string, user_count: number }>

GET /users/disabled
  Query: ?search=&limit=&offset=
  Response: { users: Array<{ pubkey, disabled_at }>, total: number }

GET /logs
  Query: ?level=&event_type=&search=&limit=&offset=
  Response: { logs: Array<LogEntry>, total: number }

GET /config
  Response: { config: string, format: "toml" } | { ...structured... }
```

### Dashboard
```
POST /api/umbrel/apps/restart
POST /api/umbrel/apps/shutdown
POST /api/docker/logs (fallback)
POST /api/docker/restart (fallback)
```