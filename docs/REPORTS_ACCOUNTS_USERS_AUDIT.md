# Reports, Accounts, Users & Audit Modules

---

## Reports Module (`src/modules/reports/`)

**Base route:** `/api/reports`  
**Roles:** EQC_Manager, Sales_Manager, Executive, System_Admin

### Report Types

| Report | Description | Export Formats |
|--------|-------------|---------------|
| `RequestSummary` | All sales requests in date range with status, type, account, purpose | XLSX, PDF |
| `DeploymentSummary` | All device deployments with status, asset, dates, condition | XLSX, PDF |
| `RepairCaseSummary` | Repair cases with status, cost, repair type per area | XLSX, PDF |
| `InspectionDefects` | Component failures/missing items with repair case numbers | XLSX, PDF |
| `AssetUtilization` | Asset utilization rate per model code over period | XLSX, PDF |

### Report Service (`report.service.ts`)

#### `generateReport(type, dateRange, format, userId)`
1. Query Prisma for report data based on type and date range
2. If `format = 'xlsx'`: call `exportToExcel(data, type)` → Buffer
3. If `format = 'pdf'`: call `exportToPdf(data, type)` → Buffer
4. Upload to Azure Blob `audit-reports` container
5. Return SAS URL (1-hour expiry)

#### `exportToExcel(data, reportType)` → Buffer
Uses the `xlsx` npm package (SheetJS). Creates workbook, adds headers with bold formatting, populates rows, auto-adjusts column widths. Returns `Buffer` for upload.

#### `exportToPdf(data, reportType)` → Buffer
Uses PDFKit. Creates a document with OTH header, report title, date range, and a formatted data table. Returns `Buffer`.

#### `scheduleReport(type, format, recipientEmail, cronExpression)`
Creates a BullMQ repeatable job in `reportQueue` with the given cron expression. Job payload: `ReportJobData`.

### Routes

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `POST` | `/generate` | EQC_Manager, Sales_Manager, Executive, System_Admin | Generate on-demand report |
| `POST` | `/schedule` | System_Admin | Schedule recurring report |
| `GET` | `/scheduled` | System_Admin | List scheduled report jobs |

---

## Accounts Module (`src/modules/accounts/`)

**Base route:** `/api/accounts`

Manages hospital and customer account records. Synced from Salesforce via MuleSoft.

### Account Service (`account.service.ts`)

#### `list(filters, pagination)`
Filters: `area`, `segmentation`. Returns paginated list.

#### `getById(id)`
Includes request history (last 10 sales requests) and total request count.

#### `create(dto)`
Manual creation (for accounts not in Salesforce). Validates uniqueness on `account_name`.

#### `update(id, dto)`
Partial update of account fields (address, area, department, segmentation, group_wave).

#### `upsertFromSalesforce(sfdc_account_id, dto)`
Idempotent upsert — called by the MuleSoft webhook handler. Uses `prisma.account.upsert()` matching on the Salesforce account ID. Never creates duplicates.

### Routes

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/` | Any authenticated | List accounts |
| `GET` | `/:id` | Any authenticated | Get account with request history |
| `POST` | `/` | EQC_Manager, Sales_Manager, System_Admin | Create account |
| `PATCH` | `/:id` | EQC_Manager, Sales_Manager, System_Admin | Update account |

---

## Users Module (`src/modules/users/`)

**Base route:** `/api/users`

### User Service (`user.service.ts`)

#### `list(filters, pagination)`
Filters: `role`, `area`, `isActive`. System_Admin-only endpoint.

#### `create(dto)`
Creates email/password user. Hashes password with `bcrypt.hash(password, 12)`. Validates email uniqueness. New users default to `Sales_Rep` role.

#### `updateRole(id, role)`
System_Admin-only. Changes a user's role. Writes event log.

#### `deactivate(id)`
Soft delete — sets `is_active = false`, nulls refresh token (invalidates all sessions). Does **not** delete the record (preserves audit trail).

#### `findByEmail(email)`
Used internally by auth service. Never return sensitive fields in API responses.

#### `upsertFromAzureAD(sfdc_user_id, profile)`
Called on every SSO login:
```typescript
prisma.user.upsert({
  where: { sfdc_user_id },
  create: { sfdc_user_id, email: profile.mail, name: profile.displayName, role: 'Sales_Rep' },
  update: { name: profile.displayName, email: profile.mail },
})
```
New SSO users default to `Sales_Rep` role. A System_Admin must manually upgrade their role.

### Routes

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/` | System_Admin | List all users |
| `POST` | `/` | System_Admin | Create user |
| `PATCH` | `/:id/role` | System_Admin | Change user role |
| `DELETE` | `/:id` | System_Admin | Deactivate user (soft delete) |
| `GET` | `/:id` | System_Admin | Get user profile |

---

## Audit / Event Log Module (`src/modules/audit/`)

**Base route:** `/api/audit`  
**Roles:** System_Admin only (read endpoints)

### Audit Service (`audit.service.ts`)

#### `write(entry)` — Non-blocking Insert
```typescript
const write = async (entry: EventLogEntry): Promise<void> => {
  await prisma.eventLog.create({
    data: {
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      event_type: entry.eventType,
      old_value: entry.oldValue ? JSON.stringify(entry.oldValue) : null,
      new_value: entry.newValue ? JSON.stringify(entry.newValue) : null,
      actor_id: entry.actorId ?? null,
      actor_type: entry.actorType,
      timestamp: new Date(),
      narrative: entry.narrative,
      ip_address: entry.ipAddress ?? null,
      session_id: entry.sessionId ?? null,
    },
  })
}
```

Always called via `setImmediate` from `audit.middleware.ts` — never awaited in the request path.

#### `getByEntity(entityType, entityId, pagination)`
Paginated read of event log entries for a specific entity. Ordered by `timestamp DESC`.

#### `getRecent(limit)`
Returns the N most recent event log entries across all entities. Used by admin dashboard.

### Event Log Table Rules

- **Append-only** — never UPDATE or DELETE rows in `event_log`
- `old_value` and `new_value` are stored as JSON strings
- All state transitions (status changes, approvals, role changes) must generate an event entry
- `entity_type` uses the values from the `EventEntityType` enum: `asset | sales_request | deployment | dispatch_doc | inspection | repair_case | bom_set`
- `actor_type` values: `User | System | AI_Agent | Integration`

### Routes

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/entity/:type/:id` | System_Admin | Get event trail for an entity |
| `GET` | `/recent` | System_Admin | Get recent event log entries |

---

*Back to [CLAUDE.md](../CLAUDE.md)*
