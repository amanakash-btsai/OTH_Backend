# Code Conventions

Strict conventions that must be followed across the entire codebase.

---

## TypeScript

- **Strict mode always on** — `"strict": true` in tsconfig. No exceptions.
- **No `any` type** — if a type is unknown, use `unknown` and narrow it.
- **No `!` non-null assertions** — handle nullable values explicitly.
- **Decorators disabled** — `experimentalDecorators: false` in tsconfig.
- **Use path aliases** — `@config/*`, `@middleware/*`, `@modules/*`, `@services/*`, `@utils/*`, `@types/*` — never relative imports like `../../../../`.
- **Enums from `@types/enums.ts`** — never import from `@prisma/client` directly in business logic files.

---

## File Naming

| Pattern | Convention | Example |
|---------|-----------|---------|
| Service files | `{entity}.service.ts` | `asset.service.ts` |
| Controller files | `{entity}.controller.ts` | `asset.controller.ts` |
| Route files | `{entity}.routes.ts` | `asset.routes.ts` |
| Schema files | `{entity}.schema.ts` | `asset.schema.ts` |
| State machine files | `{entity}.stateMachine.ts` | `asset.stateMachine.ts` |
| Agent files | `{purpose}.agent.ts` | `overdueClassifier.agent.ts` |
| Processor files | `{purpose}.processor.ts` | `overdueAlert.processor.ts` |
| Test files | `{subject}.test.ts` | `bom.service.test.ts` |

---

## Module Structure

Every feature module follows the same 4-file structure:

```
src/modules/{feature}/
├── {feature}.routes.ts      ← route registration + RBAC guards
├── {feature}.controller.ts  ← HTTP layer only (req/res handling)
├── {feature}.service.ts     ← business logic + DB queries
└── {feature}.schema.ts      ← Zod validation schemas
```

Plus optional:
- `{feature}.stateMachine.ts` — for modules with state transitions (assets, deployments)
- `{feature}.cache.ts` — for modules with caching (dashboards)
- Additional service files — for modules with complex sub-concerns (dispatch: `pdf.service.ts`, `qr.service.ts`)

---

## Controller Rules

Controllers are thin HTTP layers only. They must not contain business logic.

```typescript
// ✅ Correct
export const approve = asyncHandler(async (req, res) => {
  const deployment = await deploymentService.approve(req.params.id, req.user.id)
  sendSuccess(res, deployment)
})

// ❌ Wrong — business logic in controller
export const approve = asyncHandler(async (req, res) => {
  const deployment = await prisma.deviceDeployment.findUnique({ where: { deployment_id: req.params.id } })
  if (deployment.status !== 'PENDING_EQC') throw new Error('...')
  // ...
})
```

---

## Service Rules

Services contain all business logic and database operations.

- Import `prisma` from `@config/database`
- Use `Prisma.$transaction()` for operations that must be atomic
- Throw `AppError` subclasses — never `throw new Error('string')`
- Never import Express types (`Request`, `Response`) in service files
- Call audit logging via `setImmediate` — never `await`
- Call Teams/email notifications non-blocking where appropriate

---

## Response Format

Always use `sendSuccess` and `sendPaginated` from `@utils/response.ts`:

```typescript
// Single resource
sendSuccess(res, asset)

// List with pagination
sendPaginated(res, assets, total, page, limit)

// Created resource
res.status(201)
sendSuccess(res, newDeployment)
```

Never call `res.json()` directly. Never call `res.send()`.

---

## Error Handling

Always throw `AppError` factory methods:

```typescript
// ✅ Correct
throw AppError.notFound('Deployment not found')
throw AppError.conflict('BOOKING_CONFLICT', 'Date overlap with existing deployment')
throw AppError.forbidden()
throw AppError.dispatchBlocked(missingItems)

// ❌ Wrong
throw new Error('not found')
res.status(404).json({ error: 'not found' })
```

The global `errorHandler.middleware` handles all `AppError` instances.

---

## Database Queries

- Always use explicit `select` or `include` — never implicit eager loading
- For list endpoints: always paginate — never return unbounded result sets
- For state transitions: use `prisma.$transaction()` with appropriate isolation level
- Never use raw SQL (`prisma.$queryRaw`) unless absolutely necessary
- Index usage: check `explain` / query plan for any query on large tables

```typescript
// ✅ Correct — explicit select
const deployment = await prisma.deviceDeployment.findUnique({
  where: { deployment_id: id },
  select: {
    deployment_id: true,
    status: true,
    account: { select: { name: true, city: true } },
  }
})

// ❌ Wrong — implicit eager loading
const deployment = await prisma.deviceDeployment.findUnique({
  where: { deployment_id: id },
  include: { account: true, asset: true, bomSnapshot: true }  // loads everything
})
```

---

## Logging

Never use `console.log`, `console.error`, or `console.warn`. Always use:

```typescript
import { logger } from '@utils/logger'

logger.info('Deployment approved', { deploymentId, userId, status: 'IN_PREPARATION' })
logger.warn('Teams alert retry', { channel, attempt, error: err.message })
logger.error('Critical: Dispatch document generation failed', { deploymentId, error: err })
```

Log objects include context fields — never interpolate into the message string.

---

## Environment Variables

- The **only** file that reads `process.env` is `src/config/index.ts`
- All other files import from `@config/index` (the frozen config object)
- Never use `process.env.VARIABLE` anywhere else in the codebase

---

## Async/Await

- Always use `async/await` — never `.then().catch()` chains
- Always wrap async route handlers with `asyncHandler` from `@middleware/asyncHandler.ts`
- Non-blocking fire-and-forget calls: use `setImmediate(() => { asyncFn().catch(logger.error) })`

---

## Secrets

- No secrets in source code
- No secrets in `.env` (only `.env.example` template committed)
- Production secrets via Azure Key Vault (`key-vault.ts`)
- Development secrets via `.env` (gitignored)
- API keys, webhook secrets, DB passwords — never hardcode, never log

---

## Testing Conventions

- Unit tests mock all external services (Teams, Blob, Email, OpenAI, Redis)
- Integration tests use real test DB, mock only external HTTP calls
- Test files co-located in `tests/unit/` and `tests/integration/` — not alongside source files
- Test names describe behavior: `"returns 409 DISPATCH_BLOCKED when required items missing"`
- Seed fresh test data per test, clean up after each test suite

---

*Back to [CLAUDE.md](../CLAUDE.md)*
