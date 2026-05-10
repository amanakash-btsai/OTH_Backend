# Implementation Prompts

Use these prompts sequentially, one module at a time, to implement the EQC backend. Each prompt is self-contained — paste it directly into a new Claude session (or this one) along with this CLAUDE.md open as context.

Before using any prompt, ensure CLAUDE.md is in context so the relevant doc files are accessible.

---

## Phase 1 — Project Foundation

### Prompt 1.1 — Root Config Files
```
We are building the EQC Asset Management Platform backend (Node.js/Express/TypeScript).
Read CLAUDE.md → docs/CONFIG_AND_ENV.md and docs/CONVENTIONS.md for full context.

Implement the following root-level project files:
1. package.json — with all dependencies listed in the tech stack and all scripts (build, start, dev, test, migrate, generate)
2. tsconfig.json — strict mode, output dist/, path aliases (@config, @middleware, @modules, @services, @utils, @types)
3. jest.config.ts — ts-jest preset, 80% coverage thresholds
4. .env.example — all environment variables from docs/CONFIG_AND_ENV.md with placeholder values
5. .gitignore — excludes node_modules/, dist/, .env, coverage/, *.log
6. Dockerfile — multi-stage build (Stage 1: compile TypeScript; Stage 2: minimal Alpine runtime)
7. docker-compose.yml — api, Azure SQL Edge (port 1433), Redis (port 6379)

Write all files to the workspace folder.
```

---

### Prompt 1.2 — Prisma Schema
```
We are building the EQC Asset Management Platform backend.
Read CLAUDE.md → docs/DATABASE.md for the full schema specification.

Implement prisma/schema.prisma with:
- datasource: provider = "sqlserver"
- All 17 models: users, accounts, assets, sales_requests, request_extensions,
  bom_sets, bom_line_items, accessory_master, device_deployments,
  dispatch_documents, inspection_records, inspection_line_items,
  repair_cases, event_log, teams_alert_log, service_contracts, ai_prediction_log
- All enums as specified in DATABASE.md:
  UserRole, AssetStatus, DemoLoanerType, AssetAgeGroup, FDAStatus,
  AnnualInspectionStatus, ConditionGrade, RecordType, SalesRequestStatus,
  Purpose1, Purpose2, ExtensionStatus, DeploymentType, DeploymentStatus,
  ConditionOnDispatch, ConditionOnReturn, BillingCycle, DocumentType,
  DispatchDocStatus, InspectionResult, InspectionType,
  RepairCaseStatus, RepairType, EventEntityType, ActorType, AlertDeliveryStatus
- All fields exactly as specified in DATABASE.md
- All relations (foreign keys) correctly defined
- All indexes defined using @@index(), including the filtered index on
  device_deployments for overdue queries: (status, expected_return_date) WHERE status = 'Dispatched'

After writing the schema, verify it can be parsed by running: npx prisma validate
```

---

### Prompt 1.3 — Config, Types & Utils
```
We are building the EQC Asset Management Platform backend.
Read CLAUDE.md → docs/CONFIG_AND_ENV.md, docs/TYPES_AND_UTILS.md, and docs/CONVENTIONS.md.

Implement the following files:

Config files (src/config/):
- index.ts — Zod env validation, frozen config export, only file that reads process.env
- database.ts — Prisma Client singleton with dev query logging
- redis.ts — BullMQ Redis connection from REDIS_URL
- azure-blob.ts — BlobServiceClient + container helper functions
- azure-openai.ts — Azure OpenAI client export
- key-vault.ts — Key Vault integration (prod) / .env fallback (dev)

Type definitions (src/types/):
- express.d.ts — augment Express Request with req.user
- enums.ts — all application enums (mirrors Prisma schema)
- api.types.ts — ApiResponse<T>, PaginatedResponse<T>, ErrorResponse
- job.types.ts — BullMQ job payload interfaces

Utility helpers (src/utils/):
- errors.ts — AppError class with all factory methods including dispatchBlocked()
- response.ts — sendSuccess(), sendPaginated()
- pagination.ts — parsePagination(), buildPaginationMeta()
- dateUtils.ts — isOverdue(), daysOverdue(), addDays(), formatDateTH(), toUTC()
- idGenerator.ts — generateRequestNumber() → DR-YYMM-NNNNNN, generateRepairCaseId() → RS-YYYYMM-NNNNNN, generateDocumentRef() → DOC-YYYYMMDD-UUID
- logger.ts — Winston logger, JSON in prod, colorized in dev, App Insights transport

Entry points (src/):
- server.ts — HTTP server, SIGTERM/SIGINT graceful shutdown
- app.ts — Express app, global middleware registration, router mounting, /api/health
- routes/index.ts — root router mounting all module routers
```

---

### Prompt 1.4 — Middleware Stack
```
We are building the EQC Asset Management Platform backend.
Read CLAUDE.md → docs/MIDDLEWARE.md and docs/CONVENTIONS.md.

Implement all 8 middleware files in src/middleware/:

1. auth.middleware.ts — JWT verification, attach req.user, return 401 UNAUTHORIZED/INVALID_TOKEN/TOKEN_EXPIRED
2. rbac.middleware.ts — requireRole(...roles) factory, return 403 INSUFFICIENT_PERMISSIONS
3. audit.middleware.ts — auditAction(entityType, getEntityId) factory, setImmediate for non-blocking writes
4. validate.middleware.ts — validate(schema) factory, Zod safeParse on req.body, return 400 VALIDATION_ERROR
5. rateLimiter.middleware.ts — express-rate-limit with Redis store, per-route limits as specified
6. requestLogger.middleware.ts — Morgan with Winston, JSON in prod, colorized in dev
7. asyncHandler.ts — Promise.resolve(fn).catch(next) wrapper
8. errorHandler.middleware.ts — handle AppError, ZodError, Prisma P2002/P2025, generic 500

Follow the middleware execution order from docs/MIDDLEWARE.md exactly.
```

---

## Phase 2 — Core Modules (Sprint 1–2)

### Prompt 2.1 — Auth Module
```
We are building the EQC Asset Management Platform backend.
Read CLAUDE.md → docs/AUTH.md, docs/CONVENTIONS.md, and docs/API_GUIDELINES.md.

Implement the complete auth module in src/modules/auth/:

auth.schema.ts:
- LoginBodySchema (email, password min 8 chars)

auth.service.ts:
- login(email, password) — bcrypt verify, issue token pair
- refreshToken(rawToken) — reuse detection, new token pair
- logout(rawToken) — null refreshTokenHash
- azureCallback(code) — exchange code, Graph API call, upsert user, issue tokens
- issueTokenPair(user) — 15-min JWT + 7-day refresh, store SHA-256 hash

auth.controller.ts:
- login, refresh, logout, me, azureCallback handlers
- Set/clear HttpOnly SameSite=Strict Secure cookie for refresh token
- Return access token in JSON body

auth.routes.ts:
- POST /login (rate limited: 10/min)
- POST /refresh
- POST /logout
- GET /me (requires authenticate middleware)
- GET /sso/azure

Also implement src/modules/users/user.service.ts with:
- upsertFromAzureAD(sfdc_user_id, profile) — called on SSO login, defaults new users to Sales_Rep role
- findByEmail(email)
- create(dto) — bcrypt 12 rounds
- list(filters, pagination) — System_Admin only
- updateRole(id, role)
- deactivate(id) — soft delete, null refreshTokenHash
```

---

### Prompt 2.2 — Assets Module
```
We are building the EQC Asset Management Platform backend.
Read CLAUDE.md → docs/ASSETS_MODULE.md, docs/CONVENTIONS.md, and docs/API_GUIDELINES.md.

Implement the complete assets module in src/modules/assets/:

asset.schema.ts — CreateAssetSchema, UpdateAssetSchema, TransitionAssetStatusSchema, AssetListQuerySchema

asset.stateMachine.ts:
- ASSET_TRANSITIONS map covering all 15 statuses (see docs/ASSETS_MODULE.md)
- isValidAssetTransition(from, to): boolean
- Retired is terminal — no transitions from Retired

asset.service.ts:
- list(filters, pagination) — filtered by status, model_code, warehouse_code, demo_loaner_type, business_unit; paginated, explicit Prisma select
- getById(id) — throw notFound if missing; include linked service_contract if present
- create(dto) — validate serial_number uniqueness; set total_repair_count=0, is_active=true
- update(id, dto) — partial update
- transitionStatus(id, newStatus, userId) — state machine check, Teams alert on Under_Repair, event log
- checkAvailability(assetId, startDate, endDate) — no overlap query on device_deployments

asset.controller.ts — thin HTTP layer, use sendSuccess/sendPaginated

asset.routes.ts:
- GET / — any authenticated
- GET /:id — any authenticated
- POST / — System_Admin only
- PATCH /:id — EQC_Operator, EQC_Manager, System_Admin
- PATCH /:id/status — EQC_Operator, EQC_Manager, System_Admin
- GET /:id/availability — any authenticated
```

---

### Prompt 2.3 — Sales Requests, Deployments & Repair Cases Modules
```
We are building the EQC Asset Management Platform backend.
Read CLAUDE.md → docs/DEPLOYMENTS_MODULE.md, docs/CONVENTIONS.md, and docs/API_GUIDELINES.md.

Implement three modules. See docs/DEPLOYMENTS_MODULE.md for full detail on each.

--- src/modules/requests/ ---

request.schema.ts — CreateRequestSchema (with refine: estimate_return_date > start_use_date),
  ExtensionRequestSchema, RequestListQuerySchema

request.stateMachine.ts:
- REQUEST_TRANSITIONS map (Draft → Waiting_Approval → Waiting_Reservation → Preparing →
  BOM_Confirmed → Ready_for_Dispatch → Dispatched → With_Customer → Return_Initiated → Request_Complete)
- isValidRequestTransition(from, to): boolean
- Cancelled and Request_Complete are terminal states

request.service.ts:
- create(dto, userId) — auto-generate request_number (DR-YYMM-NNNNNN), status: Draft, event log
- approve(id, managerId) — validate Waiting_Approval status, transition to Waiting_Reservation,
  set approved_by_id + approved_at, Teams card to #demo-alerts (non-blocking), event log
- reject(id, managerId, reason) — transition to Cancelled, set rejection_reason
- requestExtension(id, dto, userId) — validate With_Customer status, create request_extension record
  with status: Waiting_Approval, Teams alert (non-blocking)
- approveExtension(id, extensionId, managerId) — update extension to Approved, update
  sales_request.estimate_return_date, increment extension_count, update asset to Extension_Used
- transitionStatus(id, newStatus, userId) — state machine check + tandem asset update + event log
- list(filters, pagination) — filtered, explicit select
- getById(id)

request.controller.ts — thin HTTP layer
request.routes.ts — all routes with correct RBAC guards per docs/DEPLOYMENTS_MODULE.md

--- src/modules/deployments/ ---

deployment.schema.ts — CreateDeploymentSchema, TransitionDeploymentStatusSchema, DeploymentListQuerySchema

deployment.stateMachine.ts:
- DEPLOYMENT_TRANSITIONS map (Preparing → Dispatched → With_Customer → Returned → In_Inspection → In_Repair)
- isValidDeploymentTransition(from, to): boolean

deployment.service.ts:
- create(dto, userId) — validate request is in BOM_Confirmed/Ready_for_Dispatch, validate asset
  availability; serializable Prisma transaction with overlap check → BOOKING_CONFLICT
- transitionStatus(id, newStatus, userId) — state machine + tandem asset update;
  set actual_return_date on Returned; event log
- list(filters, pagination) — filtered, explicit select
- getById(id)

deployment.controller.ts — thin HTTP layer
deployment.routes.ts — all routes with correct RBAC guards per docs/DEPLOYMENTS_MODULE.md

--- src/modules/repairs/ ---

repair.schema.ts — CreateRepairSchema, TransitionRepairStatusSchema, RepairListQuerySchema

repair.stateMachine.ts:
- REPAIR_TRANSITIONS map (Quoted → IQ_Quoted → PO_Received → Parts_Arranged → Confirmed → Completed)
- isValidRepairTransition(from, to): boolean

repair.service.ts:
- create(dto, userId) — auto-generate rs_number (RS-YYYYMM-NNNNNN via idGenerator), event log
- transitionStatus(id, newStatus, userId) — state machine check, event log
- list(filters, pagination)
- getById(id)

repair.controller.ts — thin HTTP layer
repair.routes.ts — all routes with correct RBAC guards per docs/DEPLOYMENTS_MODULE.md
```

---

### Prompt 2.4 — BOM Module
```
We are building the EQC Asset Management Platform backend.
Read CLAUDE.md → docs/BOM_MODULE.md, docs/CONVENTIONS.md, and docs/API_GUIDELINES.md.

Implement the complete BOM module in src/modules/bom/:

bom.schema.ts — CreateBOMSetSchema, UpdateBOMSetSchema, AddLineItemSchema (with refine: exactly one
  of is_required/is_optional/is_consumable must be true), UpdateLineItemSchema,
  CreateAccessorySchema, ValidatePackingSchema

bom.service.ts:
- listSets(modelCode?) — all active bom_sets, optionally filtered by model_code
- getSetWithLines(setId) — bom_set + all bom_line_items joined with accessory_master
- createSet(dto, userId) — validate model_code exists in assets table
- updateSet(setId, dto) — partial update; do not allow model_code change
- addLineItem(setId, dto) — validate set is active, accessory exists
- updateLineItem(lineId, dto)
- removeLineItem(lineId) — validate set not assigned to an active request
- listAccessories(filters) — filter by device_model_code, is_active
- validatePacking(setId, packedAccessoryIds[]) — THE DISPATCH BLOCK:
  * Fetch bom_line_items with is_required = true for this set
  * Compare accessory_ids against packedAccessoryIds
  * Return { isComplete: boolean, missingItems: MissingItem[] }
  * is_optional and is_consumable items never block — only is_required items matter
  * Include storageLocation in each missingItem for EQC operator convenience

bom.controller.ts — thin HTTP layer

bom.routes.ts (all routes and roles per docs/BOM_MODULE.md):
- GET /sets, GET /sets/:setId — any authenticated
- POST /sets, PATCH /sets/:setId — EQC_Manager, System_Admin
- GET /sets/:setId/lines — any authenticated
- POST /sets/:setId/lines, PATCH /sets/:setId/lines/:lineId,
  DELETE /sets/:setId/lines/:lineId — EQC_Manager, System_Admin
- GET /accessories — any authenticated
- POST /accessories — System_Admin
- POST /validate-packing — EQC_Operator, EQC_Manager, System_Admin

Also implement src/modules/accounts/account.service.ts:
- list(filters, pagination) — filters: area, segmentation
- getById(id) — include last 10 sales requests
- create(dto)
- update(id, dto)
- upsertFromSalesforce(sfdc_account_id, dto) — idempotent Prisma upsert

And src/modules/audit/audit.service.ts (event_log table):
- write(entry: EventLogEntry) — INSERT only, called via setImmediate; fields: entity_type,
  entity_id, event_type, old_value, new_value, actor_id, actor_type, narrative, ip_address, session_id
- getByEntity(entityType, entityId, pagination) — ordered by timestamp DESC
- getRecent(limit)
```

---

## Phase 3 — Dispatch, Inspection & Webhooks (Sprint 3)

### Prompt 3.1 — Dispatch Module
```
We are building the EQC Asset Management Platform backend.
Read CLAUDE.md → docs/DISPATCH_MODULE.md, docs/BOM_MODULE.md, and docs/CONVENTIONS.md.

Implement the complete dispatch module in src/modules/dispatch/:

qr.service.ts:
- generateQrCode(url): Promise<string> — returns base64 data URL using qrcode library
- URL encodes: https://app.eqc.olympus.th/documents/{docId}

pdf.service.ts (using PDFKit):
- generateTransportPdf(deployment, snapshot, docRef, qrBase64): Promise<Buffer>
- A4 format, includes: header with doc ref + embedded QR code, deployment details table, BOM checklist table (REQUIRED/OPTIONAL marked), signature block
- Returns Buffer — never written to disk

dispatch.service.ts — 10-step orchestration:
1. Fetch deployment + linked sales_request to resolve bom_set_id
2. validatePacking(setId, packedAccessoryIds) → if isComplete=false → throw AppError.dispatchBlocked(missingItems)
3. Generate docRef via idGenerator.generateDocumentRef()
4. Generate QR code
5. Generate PDF (include BOM line items with is_required/is_optional/is_consumable labels)
6. Upload to Blob transport-docs container
7. Create dispatch_documents record (status: Generated), link to deployment via deployment_id
8. Transition deployment to Dispatched (tandem: asset → Dispatched)
9. Queue print email to warehouse printer via emailQueue
10. Post Teams card to #eqc-ops-alerts (non-blocking)

Also implement: uploadSignedCopy(docId, buffer, mimeType, userId), emailToPrinter(docId)
On signed copy upload: set sap_gi_triggered=true, sap_gi_triggered_at=now() on the dispatch_document record.

dispatch.schema.ts — GenerateDocumentSchema (deploymentId, packedAccessoryIds array)

dispatch.controller.ts, dispatch.routes.ts:
- POST /documents — EQC, MANAGER, ADMIN
- GET /documents/:id — any authenticated (returns SAS URL)
- POST /documents/:id/sign — EQC, MANAGER, ADMIN (multer memoryStorage)
- POST /documents/:id/email — EQC, MANAGER, ADMIN

Also implement src/services/blob.service.ts:
- uploadTransportDoc(buffer, docRef) → blob path
- uploadSignedCopy(buffer, docId) → blob path
- uploadReport(buffer, reportRef) → blob path
- generateSasUrl(container, blobPath, expiryHours=1) → SAS URL (never stored in DB)
- deleteBlob(container, blobPath)
```

---

### Prompt 3.2 — Inspection Module
```
We are building the EQC Asset Management Platform backend.
Read CLAUDE.md → docs/INSPECTION_MODULE.md and docs/CONVENTIONS.md.

Implement the complete inspection module in src/modules/inspection/:

inspection.schema.ts — CreateInspectionSchema (deploymentId, inspection_type: DISPATCH|RETURN),
  RecordLineItemResultSchema (result: Pass|Fail|Missing, quantity_actual?, notes?)

inspection.service.ts:
- createInspection(deploymentId, inspectionType, inspectedById):
  * For DISPATCH type: validate deployment status = Preparing
  * For RETURN type: validate deployment status = Returned
  * Resolve bom_set_id from deployment → sales_request → bom_set_id
  * Fetch all bom_line_items for that set
  * Create one inspection_records header row
  * Create one inspection_line_items row per bom_line_item (result=null initially,
    inspection_type set on each row)

- recordLineItemResult(inspectionId, lineItemId, result, quantityActual, notes, inspectedById):
  * Fetch the inspection_line_item for this (inspectionId, lineItemId) pair
  * Update result, quantity_actual, notes
  * If RETURN type AND result = Fail or Missing:
    - Call repair.service.create() to create a full repair_case record
      (rs_number via idGenerator.generateRepairCaseId(), asset_id + account_id from deployment)
    - Set repair_case_id on inspection_records header
    - Post CRIT Teams alert to #asset-defects (non-blocking, mock in tests)

- completeInspection(inspectionId, inspectedById):
  * Validate all line items are recorded (none null) → 400 if any pending
  * Set inspection_records.overall_condition: all Pass → Good; any Missing → Missing; any Fail → Defective
  * For RETURN type:
    - All Pass → asset status = Cleaning → Available; deployment status = Returned
    - Any Fail/Missing → asset status = Under_Repair; deployment status = In_Repair
  * Both updates in single Prisma transaction
  * Event log (non-blocking)
  * Return { outcome: 'ALL_PASS'|'HAS_FAILURES', repairCases: RepairCase[] }

inspection.controller.ts, inspection.routes.ts (all require EQC_Operator, EQC_Manager, or System_Admin):
- POST / — create inspection
- GET /:id — any authenticated
- PATCH /:id/items/:lineItemId — record result for one line item
- POST /:id/complete — finalize inspection
```

---

### Prompt 3.3 — Webhooks Module
```
We are building the EQC Asset Management Platform backend.
Read CLAUDE.md → docs/WEBHOOKS_MODULE.md, docs/INTEGRATIONS.md, and docs/CONVENTIONS.md.

Implement the complete webhooks module in src/modules/webhooks/:

webhook.validator.ts:
- validateMulesoftSignature(rawBody: Buffer, signatureHeader: string): boolean
- HMAC-SHA256 using crypto module with MULESOFT_WEBHOOK_SECRET
- Use crypto.timingSafeEqual() — MANDATORY for timing attack prevention
- Return false if lengths differ

webhook.service.ts:
- processAssetSyncBatch(assets) — Prisma upsert on assets table, keyed on sfdc_asset_id
- processAccessorySyncBatch(accessories) — Prisma upsert on accessory_master, keyed on accessory_code
- Returns { created, updated, skipped }

mulesoft.controller.ts:
- handleNewRequest: validate HMAC → idempotency check (sfdc_request_id on sales_requests) →
  create sales_request + upsert account → always return 200 (catch all app errors, log, return 200)
- handleStatusUpdate: validate HMAC → find sales_request by sfdc_request_id → transition status → 200
- handleAssetSync: validate HMAC → processAssetSyncBatch → 200 with summary

teams.controller.ts:
- handleCardAction: validate Teams signature → parse actionType → route to service → return 200 immediately

webhook.routes.ts:
- CRITICAL: use express.raw({ type: 'application/json' }) on all webhook routes (NOT express.json())
- No JWT middleware on any webhook route
- POST /mulesoft/new-request
- POST /mulesoft/status-update
- POST /mulesoft/asset-sync
- POST /teams

Integration tests in tests/integration/webhooks.test.ts:
- Valid HMAC + new sfdc_request_id → 201
- Same request again → 200 idempotent
- Invalid HMAC → 401
```

---

## Phase 4 — Dashboards & Reports (Sprint 4)

### Prompt 4.1 — Dashboards Module
```
We are building the EQC Asset Management Platform backend.
Read CLAUDE.md → docs/DASHBOARDS_MODULE.md and docs/CONVENTIONS.md.

Implement the complete dashboards module in src/modules/dashboards/:

dashboard.cache.ts:
- NodeCache wrapper, 5-minute TTL
- getCached<T>(key, fetcher): Promise<T>
- invalidateDashboardCache(keys?: string[])
- Cache key pattern: dashboard:{type}:{userId}

dashboard.service.ts — 5 role-gated queries:
- getSalesDashboard(userId, role) — filter by user's own sales_requests for Sales_Rep role; all for managers
- getServiceDashboard() — active deployment workload, revenue at risk
  (sum rental_rate_thb * days_outstanding for overdue billable deployments)
- getInventoryDashboard() — asset counts by status and model_code
- getOverdueFeed() — all Dispatched deployments past expected_return_date,
  classified by severity (1-3: MEDIUM, 4-7: HIGH, 8-14: CRIT, >14: URGENT)
- getExecutiveDashboard() — 90-day KPI trends

IMPORTANT: All queries must use explicit Prisma select — no implicit eager loading (no N+1)
IMPORTANT: Wrap all service calls with getCached() from dashboard.cache.ts

dashboard.controller.ts — thin HTTP layer using sendSuccess

dashboard.routes.ts:
- GET /sales — Sales_Rep, Sales_Manager, EQC_Manager, System_Admin
- GET /service — EQC_Operator, EQC_Manager, System_Admin
- GET /inventory — EQC_Operator, EQC_Manager, System_Admin
- GET /overdue — EQC_Operator, EQC_Manager, Sales_Manager, System_Admin
- GET /executive — Sales_Manager, EQC_Manager, Executive, System_Admin

Add cache invalidation calls to request.service.transitionStatus() and asset.service.transitionStatus().
```

---

### Prompt 4.2 — Reports Module
```
We are building the EQC Asset Management Platform backend.
Read CLAUDE.md → docs/REPORTS_ACCOUNTS_USERS_AUDIT.md and docs/CONVENTIONS.md.

Implement the reports module in src/modules/reports/:

report.service.ts:
- generateReport(type, dateRange, format, userId) → SAS URL
  * Types: RequestSummary, DeploymentSummary, RepairCaseSummary, InspectionDefects, AssetUtilization
- exportToExcel(data, reportType) → Buffer (using xlsx/SheetJS package)
  * Headers with bold formatting, data rows, auto-column widths
- exportToPdf(data, reportType) → Buffer (using PDFKit)
  * OTH header, report title, date range, data table
- scheduleReport(type, format, recipientEmail, cronExpression) → creates BullMQ repeatable job

Routes (report.routes.ts):
- POST /generate — EQC_Manager, Sales_Manager, Executive, System_Admin
- POST /schedule — System_Admin
- GET /scheduled — System_Admin
```

---

## Phase 5 — AI Agents & Background Jobs (Sprint 5)

### Prompt 5.1 — Shared Services (Email, Teams, OpenAI)
```
We are building the EQC Asset Management Platform backend.
Read CLAUDE.md → docs/SHARED_SERVICES.md and docs/INTEGRATIONS.md.

Implement the three shared services:

src/services/openai.service.ts:
- complete(systemPrompt, userPrompt, maxTokens): Promise<string>
- Uses Azure OpenAI client from src/config/azure-openai.ts
- 3× retry on HTTP 429 and 503 with exponential backoff (1s, 2s, 4s)
- Never called in HTTP request path — only from BullMQ workers

src/services/teams.service.ts:
- 6 channel webhooks from config (one per channel)
- postDispatchCard(deployment, docRef) → #eqc-ops-alerts
- postOverdueAlert(deployment, severity, aiDraft) → #loaner-overdue or #demo-alerts by type
- postDefectAlert(deployment, component, result, repairCaseId) → #asset-defects CRIT
- postInventoryWarning(asset) → #inventory-critical
- postKpiDigest(kpiData, aiNarrative) → #exec-summary
- Internal: postWithRetry(webhookUrl, payload, maxRetries=3) — 500/1000/2000ms exponential backoff
- On total failure: write to teams_alert_log table with delivery_status: Failed (never throw — log and record)
- All sends: write to teams_alert_log with delivery_status: Sent/Delivered/Failed as appropriate

src/services/email.service.ts:
- Nodemailer with Azure Comm Services SMTP
- sendTransportDocEmail(to, pdfBuffer, docRef)
- sendEscalationEmail(to, deployment, daysOverdue, aiDraft)
- sendReportEmail(to, buffer, reportType, format)
- All methods called only by BullMQ email worker — never inline in request handlers
```

---

### Prompt 5.2 — AI Agents
```
We are building the EQC Asset Management Platform backend.
Read CLAUDE.md → docs/AI_AGENTS.md and docs/SHARED_SERVICES.md.

Implement all 6 AI agents in src/jobs/agents/:

Each agent must:
- Accept typed input and return typed output (define interfaces in the file)
- Call openai.service.complete(systemPrompt, userPrompt, maxTokens)
- Log failures with logger.error and re-throw (let BullMQ handle retry)

1. overdueClassifier.agent.ts (maxTokens: 300)
   - Input: deployment context, daysOverdue, account
   - Output: { severity, suggestedAction, emailDraft }

2. kpiForecast.agent.ts (maxTokens: 500)
   - Input: 90-day KPI data
   - Output: { narrative (2–3 sentences), keyInsights: string[] }

3. auditNarration.agent.ts (maxTokens: 800)
   - Input: entityType, entityId, auditEntries[]
   - Output: { narrative } — compliance-ready paragraph

4. receiptMonitor.agent.ts (maxTokens: 400)
   - Input: unsigned documents with account and operator info
   - Output: { hasPattern, patternDescription, chronicAccounts[], chronicOperators[], recommendation }

5. anomalyDetection.agent.ts (maxTokens: 600)
   - Input: inspection failure rates by component + warehouse vs baseline
   - Output: { anomalies[], summary }

6. dispatchPopulation.agent.ts (maxTokens: 200)
   - Input: account, recent dispatches with courier/driver/delivery time
   - Output: { suggestedCourier, suggestedDriver, confidence, reasoning, requiresConfirmation: true }
   - requiresConfirmation MUST always be true — this is immutable

Write the system prompt for each agent as specified in docs/AI_AGENTS.md.
```

---

### Prompt 5.3 — Background Job Processors
```
We are building the EQC Asset Management Platform backend.
Read CLAUDE.md → docs/BACKGROUND_JOBS.md, docs/AI_AGENTS.md, and docs/SHARED_SERVICES.md.

Implement the BullMQ infrastructure and all job processors:

src/jobs/queue.ts:
- 6 Queue instances (overdueAlertQueue, kpiDigestQueue, receiptMonitorQueue, inventoryAlertQueue, reportQueue, emailQueue)
- All sharing redisConnection from src/config/redis.ts

src/jobs/scheduler.ts:
- startScheduler() — register all 4 cron jobs with correct cron patterns
  * Overdue alert: every 6h → '0 */6 * * *'
  * KPI Digest: 07:00 UTC daily → '0 7 * * *'
  * Receipt Monitor: 09:00 UTC daily → '0 9 * * *'
  * Inventory Alert: 10:00 UTC daily → '0 10 * * *'
- triggerJobNow(queueName) — manual admin trigger

src/jobs/processors/overdueAlert.processor.ts:
- Query device_deployments with status = Dispatched and expected_return_date < TODAY
- Classify severity by days_outstanding (1-3: MEDIUM log only, 4-7: HIGH, 8-14: CRIT, >14: URGENT)
- Skip if this severity already alerted (check teams_alert_log for recent matching alert)
- Call overdueClassifier.agent → teams.service.postOverdueAlert
- Update asset status to Overdue for severely overdue assets

src/jobs/processors/kpiDigest.processor.ts:
- Get executive KPI data from sales_requests + device_deployments → kpiForecast.agent → teams.service.postKpiDigest

src/jobs/processors/receiptMonitor.processor.ts:
- Find dispatch_documents with status = Generated or Sent_to_Print older than 3 days (no signed copy)
- 3–7 days: reminder email; >7 days: manager escalation
- Call receiptMonitor.agent for pattern analysis

src/jobs/processors/inventoryAlert.processor.ts:
- Count assets by status = Available per model_code
- Post Teams alert to #inventory-critical when Available count drops below a configurable minimum
  (threshold stored in environment config, not a DB table)

src/jobs/processors/reportGeneration.processor.ts:
- Process ReportJobData: generate report → upload to blob → queue email with attachment

Also add email worker (either in a separate file or combined): processes emailQueue jobs, calls email.service methods, BullMQ handles retry.

Call startScheduler() from src/server.ts after app is ready.
Add admin trigger endpoint: POST /api/admin/agents/:jobName/trigger (System_Admin only).
```

---

## Phase 6 — Testing

### Prompt 6.1 — Unit Tests
```
We are building the EQC Asset Management Platform backend.
Read CLAUDE.md → docs/TESTING.md.

Implement all unit tests:

tests/helpers/mockServices.ts — Jest mocks for Teams, Blob, Email, OpenAI

tests/unit/bom.service.test.ts:
- All is_required lines packed → isComplete: true
- One is_required line missing → isComplete: false, that item in missingItems with storageLocation
- Only is_optional lines missing → isComplete: true (never blocks)
- Only is_consumable lines missing → isComplete: true (never blocks)
- Empty packedAccessoryIds → all is_required lines in missingItems

tests/unit/dispatch.service.test.ts:
- generateDocument with incomplete BOM → throws AppError with errorCode = 'DISPATCH_BLOCKED'
- generateDocument with complete BOM → returns { docId, pdfUrl }
- Teams mock called exactly once on success
- dispatch_document created with status: Generated

tests/unit/asset.stateMachine.test.ts:
- Test all valid transitions from the transition map → true
- Test key invalid transitions → false:
  * Available → Request_Complete (request status, not asset)
  * Retired → Available
  * Retired → Under_Repair
  * Retired → any status
  * With_Customer → Available (must go through Return_Initiated first)
  * Under_Repair → With_Customer
```

---

### Prompt 6.2 — Integration Tests
```
We are building the EQC Asset Management Platform backend.
Read CLAUDE.md → docs/TESTING.md.

Implement integration test infrastructure and all integration tests:

tests/setup.ts — global setup: run Prisma migrations against test DB, seed data, cleanup afterAll

tests/helpers/testDb.ts — seedTestUser(role), seedTestAsset(overrides?),
  seedTestRequest(overrides?), seedTestDeployment(overrides?),
  seedTestBOMSet(overrides?), clearTable(), resetAllTables()

tests/helpers/authHelper.ts — getTestToken(role: UserRole) → 'Bearer {jwt}'

tests/integration/requests.test.ts:
- Create request → 201, request_number matches DR-YYMM-NNNNNN format
- Approve with EQC_Manager token → 200, status = Waiting_Reservation
- Approve with Sales_Rep token → 403 INSUFFICIENT_PERMISSIONS
- Reject with reason → 200, status = Cancelled

tests/integration/deployments.test.ts:
- Create deployment (no asset conflict) → 201
- Create deployment (same asset overlap) → 409 BOOKING_CONFLICT
- Transition to Dispatched → 200, asset status = Dispatched

tests/integration/dispatch.test.ts:
- Incomplete BOM (is_required item missing) → 409 DISPATCH_BLOCKED with missingItems array including storageLocation
- Complete BOM → 200 with pdfUrl and docId
- dispatch_document.status = Generated

tests/integration/inspection.test.ts:
- createInspection creates correct line item count (matching bom_line_items count for set)
- RETURN inspection FAIL result creates full repair_case record with RS- number
- completeInspection all-Pass → asset Available
- completeInspection any-Fail/Missing → asset Under_Repair

tests/integration/webhooks.test.ts:
- Valid HMAC + new sfdc_request_id → 201, sales_request created
- Same request again → 200 (idempotency, no duplicate created)
- Invalid HMAC → 401
```

---

*These prompts cover the complete implementation. Work through them sequentially within each sprint.*

*Back to [CLAUDE.md](../CLAUDE.md)*
