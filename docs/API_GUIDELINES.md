# API Guidelines

Standards for all REST endpoints in the EQC backend.

---

## URL Structure

```
/api/{resource}              → collection
/api/{resource}/{id}         → single resource
/api/{resource}/{id}/{action} → action on a resource
/api/{resource}/{id}/{child}  → sub-resource
```

Examples:
```
GET    /api/assets                          → list assets
GET    /api/assets/{id}                     → get one asset
POST   /api/assets                          → create asset
PATCH  /api/assets/{id}                     → update asset
PATCH  /api/assets/{id}/status              → transition status
POST   /api/deployments/{id}/extension      → request extension
POST   /api/inspections/{id}/complete       → complete inspection
POST   /api/dispatch/documents              → generate transport doc
POST   /api/dispatch/documents/{id}/sign    → upload signed copy
```

---

## HTTP Methods

| Method | Usage | Body | Idempotent? |
|--------|-------|------|------------|
| `GET` | Read | None | Yes |
| `POST` | Create or complex action | JSON or multipart | No |
| `PATCH` | Partial update or transition | JSON | No |
| `PUT` | Full replacement | JSON | Yes |
| `DELETE` | Soft delete only | None | Yes |

Use `PATCH` (not `PUT`) for status transitions and partial updates. We never do full replacements.

---

## Standard Response Format

**Success (single resource):**
```json
{
  "success": true,
  "data": { ...resource fields }
}
```

**Success (list with pagination):**
```json
{
  "success": true,
  "data": [ ...items ],
  "meta": {
    "total": 152,
    "page": 2,
    "limit": 20,
    "totalPages": 8
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": { ...optional field-level details }
  }
}
```

---

## Error Codes

| Code | HTTP Status | When |
|------|------------|------|
| `NOT_FOUND` | 404 | Record does not exist |
| `UNAUTHORIZED` | 401 | Missing or no token |
| `INVALID_TOKEN` | 401 | Malformed JWT |
| `TOKEN_EXPIRED` | 401 | JWT past expiry |
| `INSUFFICIENT_PERMISSIONS` | 403 | Wrong role for this endpoint |
| `VALIDATION_ERROR` | 400 | Zod schema validation failed |
| `CONFLICT` | 409 | Unique constraint violation (e.g., duplicate serial number) |
| `BOOKING_CONFLICT` | 409 | Device date overlap with existing deployment |
| `DISPATCH_BLOCKED` | 409 | Missing required BOM items prevents dispatch |
| `INVALID_TRANSITION` | 409 | State machine rejects the status transition |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error |

---

## Pagination

All list endpoints accept `page` and `limit` query parameters:

```
GET /api/assets?page=1&limit=20
GET /api/deployments?status=DELIVERED&page=2&limit=50
```

Defaults: `page=1`, `limit=20`. Maximum: `limit=100`.

---

## Filtering

Pass filters as query parameters. Filters are additive (AND):

```
GET /api/assets?status=AVAILABLE&model_code=CF-HQ290L
GET /api/deployments?status=PENDING_EQC&deployment_type=LOANER
GET /api/deployments?is_overdue=true
```

---

## Health Check

```
GET /api/health
```

No authentication required. Returns:
```json
{
  "status": "ok",
  "database": "connected",
  "redis": "connected",
  "timestamp": "2026-05-09T10:00:00Z"
}
```

Used by AKS liveness and readiness probes.

---

## Authentication Header

```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

All endpoints except `/api/auth/*`, `/api/webhooks/*`, and `/api/health` require this header.

---

## Content Types

- API requests: `Content-Type: application/json`
- File uploads: `Content-Type: multipart/form-data`
- Webhook routes: Raw body (`express.raw()`) — Content-Type header preserved but body not pre-parsed

---

## Rate Limits

| Route Pattern | Limit | Window |
|-------------|-------|--------|
| `POST /api/auth/login` | 10 requests | 1 minute |
| `/api/*` (general) | 100 requests | 1 minute |
| `/api/webhooks/*` | 200 requests | 1 minute |
| AI endpoints | 20 requests | 1 minute |

Limits are distributed across AKS pods via Redis store.

On limit exceeded: HTTP 429 `Too Many Requests`.

---

## Audit Trail

All state-changing operations (POST, PATCH, DELETE) on core entities generate an `AuditLog` entry automatically via `audit.middleware.ts`. This is non-blocking — it never delays the HTTP response.

Controllers do not need to call audit logging manually — the middleware handles it. Exception: write explicit audit entries for complex operations with custom `action` descriptions.

---

## Webhook Endpoints

Special rules for `/api/webhooks/*`:

1. **No JWT auth** — authentication is via HMAC-SHA256 signature validation
2. **Raw body** — uses `express.raw()` not `express.json()`
3. **Always return 200** from MuleSoft handlers — even on application errors
4. **Signature validation first** — reject immediately with 401 if invalid, before any processing

---

*Back to [CLAUDE.md](../CLAUDE.md)*
