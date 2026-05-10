# Testing Guide & Verification Plan

---

## Test Infrastructure

| File | Purpose |
|------|---------|
| `tests/setup.ts` | Jest global setup — migrations, seed data, cleanup |
| `tests/helpers/testDb.ts` | DB seeding and cleanup helpers |
| `tests/helpers/authHelper.ts` | Test JWT generation |
| `tests/helpers/mockServices.ts` | Service mocks (Teams, Blob, Email, OpenAI) |

### `tests/setup.ts`

```typescript
// runs before all tests
beforeAll(async () => {
  await prisma.$executeRaw`...`  // run migrations against test DB
  await seedTestData()           // seed one user per role + 5 assets + 2 accounts
})

afterAll(async () => {
  await clearAllTables()
  await prisma.$disconnect()
})
```

### `tests/helpers/testDb.ts`

```typescript
export const seedTestUser = async (role: UserRole, overrides = {}) => { ... }
export const seedTestAsset = async (overrides = {}) => { ... }
export const seedTestDeployment = async (overrides = {}) => { ... }
export const clearTable = async (tableName: string) => { ... }
export const resetAllTables = async () => { ... }
```

### `tests/helpers/authHelper.ts`

```typescript
export const getTestToken = (role: UserRole): string => {
  return `Bearer ${jwt.sign({ sub: 'test-user-id', email: 'test@eqc.olympus.th', role }, config.JWT_SECRET)}`
}
```

### `tests/helpers/mockServices.ts`

Applied in both unit and integration tests. Prevents real HTTP calls during tests.

```typescript
jest.mock('@services/teams.service', () => ({
  postDispatchCard: jest.fn().mockResolvedValue(undefined),
  postOverdueAlert: jest.fn().mockResolvedValue(undefined),
  postDefectAlert: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@services/blob.service', () => ({
  uploadTransportDoc: jest.fn().mockResolvedValue('fake/path/doc.pdf'),
  generateSasUrl: jest.fn().mockResolvedValue('https://fake-sas-url.com/doc.pdf'),
}))

jest.mock('@services/email.service', () => ({
  sendTransportDocEmail: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@services/openai.service', () => ({
  complete: jest.fn().mockResolvedValue('AI response placeholder'),
}))
```

---

## Unit Tests

### `tests/unit/bom.service.test.ts`

Tests the `validatePacking` dispatch block logic in isolation.

| Test | Expected Result |
|------|----------------|
| All REQUIRED items packed | `{ isComplete: true, missingItems: [] }` |
| One REQUIRED item missing | `{ isComplete: false, missingItems: [{ componentId, componentName, requiredQty }] }` |
| Only OPTIONAL items missing | `{ isComplete: true, missingItems: [] }` — OPTIONAL never blocks |
| Empty packed list | `{ isComplete: false, missingItems: [...all required items] }` |

### `tests/unit/dispatch.service.test.ts`

| Test | Expected Result |
|------|----------------|
| `generateDocument` with incomplete BOM | Throws `AppError` with `errorCode = 'DISPATCH_BLOCKED'` |
| `generateDocument` with complete BOM | Returns `{ docId, pdfUrl }`, Teams mock called once |
| `uploadSignedCopy` on valid document | Updates `status = SIGNED`, `signed_at` set |

### `tests/unit/asset.stateMachine.test.ts`

| Transition | Expected |
|-----------|---------|
| `AVAILABLE → DEMO` | `true` |
| `AVAILABLE → LOANER` | `true` |
| `AVAILABLE → IN_REPAIR` | `true` |
| `AVAILABLE → QUARANTINE` | `true` |
| `AVAILABLE → COMPLETED` | `false` (COMPLETED is not an asset status) |
| `RETIRED → AVAILABLE` | `false` (terminal state) |
| `RETIRED → IN_REPAIR` | `false` (terminal state) |
| `DEMO → COMPLETED` | `false` |
| `IN_REPAIR → DEMO` | `false` |

---

## Integration Tests

All integration tests run against a real test database (Azure SQL Edge in Docker). Mocks are applied for Teams, Blob, Email, and OpenAI.

### `tests/integration/deployments.test.ts`

| Test | Expected |
|------|---------|
| Create deployment (no conflicts) | 201, deployment created |
| Create deployment (date overlap) | 409 `BOOKING_CONFLICT` |
| Approve with MANAGER token | 200, status → IN_PREPARATION |
| Approve with EQC token | 403 `INSUFFICIENT_PERMISSIONS` |
| Approve with SALES token | 403 |
| Approve non-existent deployment | 404 `NOT_FOUND` |

### `tests/integration/dispatch.test.ts`

| Test | Expected |
|------|---------|
| Generate doc — incomplete BOM | 409 `DISPATCH_BLOCKED` with `missingItems` array |
| Generate doc — complete BOM | 200 with `pdfUrl` and `docId` |
| Upload signed copy | 200, `DispatchDocument.status = SIGNED` |
| Generate doc — no snapshot | 400 or 404 |

### `tests/integration/inspection.test.ts`

| Test | Expected |
|------|---------|
| `createInspection` | Row count equals snapshot component count |
| FAIL result | `repair_case_id` set, Teams defect mock called |
| MISSING result | `repair_case_id` set, Teams defect mock called |
| PASS result | No `repair_case_id`, Teams not called |
| `completeInspection` — all PASS | Asset → AVAILABLE, Deployment → COMPLETED |
| `completeInspection` — any FAIL | Asset → IN_REPAIR, Deployment → COMPLETED |
| `completeInspection` — items still pending | 400 |

### `tests/integration/webhooks.test.ts`

| Test | Expected |
|------|---------|
| Valid HMAC + new `sfdc_request_id` | 201, deployment created |
| Valid HMAC + same `sfdc_request_id` again | 200, same existing record returned |
| Invalid HMAC | 401 |
| Valid HMAC + malformed body | 200 (logged, not thrown — prevent retry storm) |

---

## Verification Plan (8 Steps)

Run these after full implementation to verify end-to-end correctness:

### Step 1 — Schema Migrations
```bash
docker-compose up db -d
npx prisma migrate dev
```
Confirm all 13 tables created without errors. Verify all indexes using Azure Data Studio or SSMS.

### Step 2 — Authentication
```bash
# Login
curl -X POST /api/auth/login -d '{"email":"admin@eqc.olympus.th","password":"..."}'
# → receive JWT access token + cookie

# Verify token
curl -H "Authorization: Bearer {token}" /api/auth/me
# → user object returned

# No token
curl /api/assets
# → 401

# Expired token (use a token with exp in past)
# → 401 TOKEN_EXPIRED
```

### Step 3 — RBAC
```bash
# ADMIN-only endpoint with SALES token
curl -H "Authorization: Bearer {SALES_token}" /api/users
# → 403 INSUFFICIENT_PERMISSIONS

# With ADMIN token
curl -H "Authorization: Bearer {ADMIN_token}" /api/users
# → 200
```

### Step 4 — BOM Dispatch Block
```bash
# Incomplete packing
curl -X POST /api/dispatch/documents -d '{"deploymentId":"...", "packedItemIds":[]}'
# → 409 DISPATCH_BLOCKED with missingItems array

# Complete packing
curl -X POST /api/dispatch/documents -d '{"deploymentId":"...", "packedItemIds":[...all required]}'
# → 200 with pdfUrl and docId
```

### Step 5 — State Machine Enforcement
```bash
# Invalid: AVAILABLE → COMPLETED (COMPLETED is not an asset status)
curl -X PATCH /api/assets/{id}/status -d '{"status":"COMPLETED"}'
# → 409

# Valid: AVAILABLE → DEMO
curl -X PATCH /api/assets/{id}/status -d '{"status":"DEMO"}'
# → 200

# RETIRED → any status
curl -X PATCH /api/assets/{id}/status -d '{"status":"AVAILABLE"}'
# → 409 (terminal state)
```

### Step 6 — MuleSoft Webhook Idempotency
```bash
# First call — new sfdc_request_id
curl -X POST /api/webhooks/mulesoft/new-request \
  -H "X-Mulesoft-Signature: {valid_hmac}" \
  -d '{"id":"SF-001", ...}'
# → 201, new deployment created

# Same call again
curl -X POST /api/webhooks/mulesoft/new-request \
  -H "X-Mulesoft-Signature: {valid_hmac}" \
  -d '{"id":"SF-001", ...}'
# → 200, same existing deployment returned (no duplicate)

# Invalid HMAC
curl -X POST /api/webhooks/mulesoft/new-request \
  -H "X-Mulesoft-Signature: invalid" \
  -d '{"id":"SF-001", ...}'
# → 401
```

### Step 7 — Teams Alert (Mocked)
```bash
# Trigger overdue alert processor manually
curl -X POST /api/admin/agents/overdue-alert/trigger \
  -H "Authorization: Bearer {ADMIN_token}"

# Check logs for: "teams.service.postOverdueAlert called"
# In test environment: mockTeamsService resolves without HTTP calls
```

### Step 8 — Integration Test Suite
```bash
npm test -- --testPathPattern=integration
# All integration tests must pass with 100% success rate
# before any deployment to staging
```

---

## Jest Config

```typescript
// jest.config.ts
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  coverageThreshold: {
    global: { lines: 80, branches: 80, functions: 80, statements: 80 }
  },
  setupFilesAfterFramework: ['./tests/setup.ts'],
  testMatch: ['**/tests/**/*.test.ts'],
}
```

Run unit tests only: `npm test -- --testPathPattern=unit`  
Run integration tests only: `npm test -- --testPathPattern=integration`  
Run with coverage: `npm test -- --coverage`

---

*Back to [CLAUDE.md](../CLAUDE.md)*
