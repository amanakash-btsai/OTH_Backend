# Development Roadmap

---

## Sprint Overview

| Sprint | Weeks | Focus |
|--------|-------|-------|
| S1–S2 | 1–8 | Core data layer: DB schema, Auth, Assets, Deployments, BOM |
| S3 | 9–12 | Dispatch, Inspection, MuleSoft webhooks, Azure Blob |
| S4 | 13–16 | Dashboard APIs, Report generation, Dashboard caching |
| S5 | 16–20 | AI agents, BullMQ job processors, MS Teams integration, OpenAI connector |
| S6 | 21–24 | Performance tuning, load testing, go-live migration, handover |

---

## Sprint 1–2: Core Data Layer (Weeks 1–8)

**Goal:** Working Auth + Asset + Deployment + BOM APIs with all state machines enforced.

### Deliverables

- `prisma/schema.prisma` — all 13 models, enums, indexes
- `prisma/migrations/` — initial migration applied to Azure SQL
- `src/config/` — all 6 config files (index, database, redis, azure-blob, azure-openai, key-vault)
- `src/types/` — all type definitions and enums
- `src/utils/` — errors, response, pagination, dateUtils, idGenerator, logger
- `src/middleware/` — all 8 middleware files
- `src/modules/auth/` — all 4 files, login + SSO + refresh + logout
- `src/modules/assets/` — all 5 files including state machine
- `src/modules/deployments/` — all 5 files including state machine + serializable booking transaction
- `src/modules/bom/` — all 4 files including `validatePacking` dispatch block
- `src/modules/accounts/` — account CRUD + upsertFromSalesforce
- `src/modules/users/` — user management + upsertFromAzureAD
- `src/modules/audit/` — append-only audit service
- `src/routes/index.ts` — root router

### Acceptance Criteria
- Auth flow works end-to-end (email/password + Azure AD SSO)
- RBAC middleware correctly allows/blocks by role
- Asset state machine rejects invalid transitions with 409
- Deployment booking conflict returns 409 `BOOKING_CONFLICT` under concurrent load
- BOM `validatePacking` correctly identifies missing REQUIRED items
- All unit tests for state machines pass

---

## Sprint 3: Dispatch & Webhooks (Weeks 9–12)

**Goal:** Full dispatch document flow + MuleSoft integration.

### Deliverables

- `src/modules/dispatch/` — all 6 files (service, pdf.service, qr.service, controller, routes, schema)
- `src/modules/inspection/` — all 4 files with repair case auto-creation
- `src/modules/webhooks/` — HMAC validator + MuleSoft controller + Teams controller + webhook service
- `src/services/blob.service.ts` — Azure Blob upload + SAS URL generation
- Integration tests: dispatch block + inspection flow + webhook idempotency

### Acceptance Criteria
- Incomplete BOM → 409 `DISPATCH_BLOCKED` with `missingItems` array
- Complete BOM → 200 with `pdfUrl` (SAS URL) and `docId`
- PDF generated with QR code, BOM checklist, signature block (A4 format)
- Signed copy upload stores blob path, updates document status to SIGNED
- MuleSoft webhook: valid HMAC → create deployment; invalid HMAC → 401
- Same `sfdc_request_id` twice → idempotent 200 response
- Inspection: FAIL result generates `repair_case_id`
- `completeInspection` transitions asset to correct status

---

## Sprint 4: Dashboards & Reports (Weeks 13–16)

**Goal:** Role-gated dashboard APIs + report generation.

### Deliverables

- `src/modules/dashboards/` — all 4 files, 5 dashboard types
- `src/modules/reports/` — report service with XLSX + PDF export, scheduled reports
- `dashboard.cache.ts` — node-cache wrapper, 5-minute TTL, invalidation on status changes

### Acceptance Criteria
- Sales dashboard returns correct counts for SALES-role user's own deployments
- Executive dashboard accessible only to MANAGER/ADMIN
- Dashboard data served from cache on repeat requests (no DB hit within 5 minutes)
- Cache invalidated when deployment/asset status changes
- Report exports to XLSX and PDF correctly
- Scheduled reports queue email job

---

## Sprint 5: AI Agents & Background Jobs (Weeks 16–20)

**Goal:** Full BullMQ job infrastructure + all 6 AI agents + Teams integration.

### Deliverables

- `src/services/openai.service.ts` — Azure OpenAI client with 3× retry
- `src/services/teams.service.ts` — 6-channel Teams integration, exponential backoff, AlertFailure logging
- `src/services/email.service.ts` — Nodemailer + queue integration
- `src/jobs/queue.ts` — 6 BullMQ queue instances
- `src/jobs/scheduler.ts` — cron registration for all 4 scheduled jobs
- `src/jobs/processors/` — all 5 processor files
- `src/jobs/agents/` — all 6 agent files

### Acceptance Criteria
- Overdue alert processor queries correctly and posts Teams cards
- AI agents produce valid structured output (validated with test fixtures)
- `dispatchPopulation.agent` always returns `requiresConfirmation: true`
- Teams 3× retry works; on total failure writes to `AlertFailure` table
- Email jobs queued and processed correctly with attachments
- All agents never called in HTTP request path
- Manual trigger endpoint works for admin testing

---

## Sprint 6: Performance, Load Testing & Go-Live (Weeks 21–24)

**Goal:** Production-ready system with verified performance under load.

### Deliverables

- AKS autoscaling configuration (2–10 pods)
- Load test results (target: p95 < 500ms on dashboard APIs, < 2s on dispatch)
- Go-live data migration scripts (from MS Access/Excel)
- Rollback procedure documented
- Team handover documentation
- Azure Key Vault secrets rotation procedure

### Performance Targets

| Endpoint | p50 | p95 | p99 |
|---------|-----|-----|-----|
| `GET /api/assets` | <50ms | <200ms | <500ms |
| `GET /api/dashboard/*` | <100ms | <500ms | <1s |
| `POST /api/dispatch/documents` | <500ms | <2s | <5s |
| `POST /api/webhooks/mulesoft/*` | <100ms | <500ms | <1s |
| `POST /api/auth/login` | <100ms | <300ms | <500ms |

---

## Current Sprint Focus

Check [PROCESS_FLOWS.md](./PROCESS_FLOWS.md) for the flows to implement first. Check [TESTING.md](./TESTING.md) for how to verify each sprint's deliverables.

---

*Back to [CLAUDE.md](../CLAUDE.md)*
