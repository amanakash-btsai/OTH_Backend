# Middleware Stack

All middleware lives in `src/middleware/`. Every file exports a factory or a direct middleware function.

---

## Execution Order

For every authenticated API request, middleware runs in this exact order:

```
1. Helmet            → security headers (CSP, HSTS, X-Frame-Options)
2. CORS              → restrict to FRONTEND_ORIGIN from config
3. express.json()    → parse body, 1MB limit
4. requestLogger     → log method, path, status, response time, user ID
5. rateLimiter       → per-route rate limit check
   [route match]
6. auth.middleware   → verify JWT, attach req.user  (skipped: /auth/*, /webhooks/*)
7. rbac.middleware   → check role against route requirement (where applied)
8. validate.middleware → Zod schema check (where applied)
9. asyncHandler      → wraps handler in try-catch, forwards errors to next()
10. Route Handler    → controller method
11. audit.middleware → write AuditLog via setImmediate (state-changing routes only)
12. errorHandler     → catches thrown errors, formats and sends response
```

---

## `src/middleware/auth.middleware.ts`

**JWT Authentication.** Applies to all routes except `/api/auth/*` and `/api/webhooks/*`.

- Reads `Authorization: Bearer <token>` header
- Verifies JWT signature using `JWT_SECRET`
- Attaches decoded payload to `req.user` (`id`, `email`, `role`, `azureAdObjectId`)
- Returns 401 on failure with one of: `UNAUTHORIZED`, `INVALID_TOKEN`, `TOKEN_EXPIRED`

```typescript
export const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) throw AppError.unauthorized('UNAUTHORIZED')
  
  const token = header.split(' ')[1]
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload
    req.user = { id: payload.sub, email: payload.email, role: payload.role, azureAdObjectId: payload.azureAdObjectId }
    next()
  } catch (err) {
    if (err instanceof TokenExpiredError) throw AppError.unauthorized('TOKEN_EXPIRED')
    throw AppError.unauthorized('INVALID_TOKEN')
  }
})
```

---

## `src/middleware/rbac.middleware.ts`

**Role-Based Access Control.** Factory that returns a middleware checking `req.user.role`.

```typescript
export const requireRole = (...roles: UserRole[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes(req.user.role)) {
      throw AppError.forbidden('INSUFFICIENT_PERMISSIONS')
    }
    next()
  }
```

Usage in routes:
```typescript
router.patch('/approve', requireRole('MANAGER', 'ADMIN'), asyncHandler(controller.approve))
```

On failure: HTTP 403 `{ success: false, error: { code: 'INSUFFICIENT_PERMISSIONS' } }`

---

## `src/middleware/audit.middleware.ts`

**Non-blocking Audit Logging.** Factory that wraps route handlers to write `AuditLog` entries.

```typescript
export const auditAction = (
  entityType: string,
  getEntityId: (req: Request, result: any) => string
) => (handler: RequestHandler): RequestHandler => {
  return asyncHandler(async (req, res, next) => {
    const result = await handler(req, res, next)
    setImmediate(() => {
      auditService.write({
        entityType,
        entityId: getEntityId(req, result),
        action: req.method + ' ' + req.path,
        userId: req.user.id,
      }).catch(logger.error)
    })
  })
}
```

**Critical:** Always uses `setImmediate` — never `await`. This ensures the HTTP response is sent before the audit write happens. The response is never delayed by audit logging.

---

## `src/middleware/validate.middleware.ts`

**Zod Request Validation.** Factory that validates `req.body`, `req.query`, or `req.params`.

```typescript
export const validate = (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      throw AppError.badRequest('VALIDATION_ERROR', result.error.flatten())
    }
    req.body = result.data  // replace with parsed/coerced data
    next()
  }
```

On failure: HTTP 400 `{ success: false, error: { code: 'VALIDATION_ERROR', details: { fieldErrors: {...} } } }`

---

## `src/middleware/rateLimiter.middleware.ts`

**Rate Limiting.** Uses `express-rate-limit` with a Redis store for distributed limiting across AKS pods.

| Limiter | Limit | Window |
|---------|-------|--------|
| Auth (`/api/auth/login`) | 10 req | 1 minute |
| API (general) | 100 req | 1 minute |
| Webhooks (`/api/webhooks/*`) | 200 req | 1 minute |
| AI endpoints | 20 req | 1 minute |

Uses Redis store so limits are shared across all AKS pod instances, not per-pod.

---

## `src/middleware/requestLogger.middleware.ts`

**Request Logging.** Morgan with custom format piped to Winston.

Fields logged per request: `method`, `path`, `status`, `response_time_ms`, `user_id` (if authenticated).

- Production: JSON format for structured log ingestion into Azure Application Insights
- Development: Colorized console format

Never use `console.log` anywhere in the codebase. Always use `logger.info()` / `logger.error()` from `src/utils/logger.ts`.

---

## `src/middleware/asyncHandler.ts`

**Async Error Forwarding.** Wraps async route handlers so thrown errors reach the global error handler.

```typescript
export const asyncHandler = (fn: AsyncRequestHandler) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
```

Without this, unhandled promise rejections in async handlers would not reach Express's error handling middleware.

---

## `src/middleware/errorHandler.middleware.ts`

**Global Error Handler.** Registered last in `app.ts`. Catches all errors forwarded via `next(err)`.

Handles:

| Error Type | HTTP Status | Behavior |
|-----------|------------|---------|
| `AppError` | `err.statusCode` | Returns `err.errorCode` and `err.message` |
| `ZodError` | 400 | Returns `VALIDATION_ERROR` with field-level details |
| `PrismaClientKnownRequestError` P2002 | 409 | Unique constraint violation → `CONFLICT` |
| `PrismaClientKnownRequestError` P2025 | 404 | Record not found → `NOT_FOUND` |
| All other errors | 500 | Generic `INTERNAL_SERVER_ERROR`, logs full stack |

Always returns:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {}
  }
}
```

In production, never expose stack traces or internal error details in the response.

---

## Webhook Routes — Special Middleware

Routes in `/api/webhooks/` use `express.raw()` instead of `express.json()`. This preserves the raw body bytes needed for HMAC-SHA256 signature computation. JSON parsing happens manually inside the controller after signature validation.

```typescript
webhookRouter.use(express.raw({ type: 'application/json' }))
```

---

*Back to [CLAUDE.md](../CLAUDE.md)*
