# Sales Requests & Deployments Module

**Locations:**  
- Sales Requests: `src/modules/requests/`  
- Device Deployments: `src/modules/deployments/`  
- Repair Cases: `src/modules/repairs/`

**Base routes:** `/api/requests`, `/api/deployments`, `/api/repairs`

---

## Overview

The request lifecycle in v2.0 is built around three linked entities:

1. **`sales_requests`** — the central record representing a Demo/Loaner request (replaces Salesforce Demo_Loaner_Request__c). A request has a status lifecycle from Draft through Request_Complete.
2. **`device_deployments`** — links a specific physical asset to a sales request with its own status lifecycle (Preparing → Dispatched → With_Customer → Returned → In_Inspection → In_Repair).
3. **`repair_cases`** — full repair job records, auto-created from inspection failures or directly from Salesforce Repair__c.

A single `sales_request` can have one or more `device_deployments` linked to it.

---

## Sales Requests Module (`src/modules/requests/`)

### Files

| File | Purpose |
|------|---------|
| `request.routes.ts` | Route registration with RBAC guards |
| `request.controller.ts` | HTTP layer |
| `request.service.ts` | Business logic |
| `request.stateMachine.ts` | Valid transition map + role requirements |
| `request.schema.ts` | Zod validation schemas |

### Routes (`request.routes.ts`)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/` | Any authenticated | List requests (filtered, paginated) |
| `GET` | `/:id` | Any authenticated | Get single request with full details |
| `POST` | `/` | Sales_Rep, FSE, EQC_Operator, EQC_Manager, Sales_Manager, System_Admin | Create new request |
| `PATCH` | `/:id/approve` | EQC_Manager, Sales_Manager, System_Admin | Approve a pending request |
| `PATCH` | `/:id/reject` | EQC_Manager, Sales_Manager, System_Admin | Reject a pending request |
| `PATCH` | `/:id/status` | EQC_Operator, EQC_Manager, System_Admin | Transition request status |
| `POST` | `/:id/extensions` | Sales_Rep, FSE, Sales_Manager, System_Admin | Request date extension |
| `PATCH` | `/:id/extensions/:extId/approve` | EQC_Manager, Sales_Manager, System_Admin | Approve/reject extension |

### Request Service (`request.service.ts`)

#### `create(dto, userId)`
1. Validate `account_id` references a real account
2. Validate `sales_person_id` references a real user
3. Auto-generate `request_number` using `DR-YYMM-NNNNNN` format
4. Create `sales_request` with `status: Draft`, `record_type: First_Request`
5. Write event log (non-blocking)
6. Return created request

#### `approve(requestId, managerId)`
1. Fetch request — throw `NOT_FOUND` if missing
2. Validate status is `Waiting_Approval` — throw 409 if not
3. Update status to `Waiting_Reservation`, set `approved_by_id`, `approved_at`
4. Post Teams Adaptive Card to `#demo-alerts` (non-blocking)
5. Write event log (non-blocking via `setImmediate`)
6. Return updated request

#### `reject(requestId, managerId, reason)`
1. Validate status is `Waiting_Approval`
2. Update status to `Cancelled`, set `rejection_reason`
3. Write event log

#### `requestExtension(requestId, dto, userId)`
1. Validate request is in `With_Customer` status
2. Validate `new_return_date > current estimate_return_date`
3. Create `request_extension` record with `status: Waiting_Approval`
4. Post Teams alert to `#demo-alerts` (non-blocking)

#### `approveExtension(requestId, extensionId, managerId)`
1. Fetch extension — validate status is `Waiting_Approval`
2. Update extension `status: Approved`
3. Update `sales_request.estimate_return_date` to extension's `new_return_date`
4. Increment `sales_request.extension_count`
5. Update linked asset status to `Extension_Used`
6. Notify EQC team via Teams

### Request State Machine (`request.stateMachine.ts`)

```typescript
const REQUEST_TRANSITIONS: Record<SalesRequestStatus, SalesRequestStatus[]> = {
  Draft:               ['Waiting_Approval', 'Cancelled'],
  Waiting_Approval:    ['Waiting_Reservation', 'Cancelled'],
  Waiting_Reservation: ['Preparing'],
  Preparing:           ['BOM_Confirmed'],
  BOM_Confirmed:       ['Ready_for_Dispatch'],
  Ready_for_Dispatch:  ['Dispatched'],
  Dispatched:          ['With_Customer'],
  With_Customer:       ['Return_Initiated'],
  Return_Initiated:    ['Request_Complete'],
  Request_Complete:    [],  // terminal
  Cancelled:           [],  // terminal
}
```

### Request Schema (`request.schema.ts`)

```typescript
export const CreateRequestSchema = z.object({
  record_type: z.enum(['First_Request', 'Extension_Request']).default('First_Request'),
  purpose1: z.enum(['Repair', 'Sales', 'Marketing', 'QARA', 'Others']),
  purpose2: z.enum([
    'Normal_Repair_Loaner', 'Q3S_Loaner', 'GI3_Loaner', 'Service_Contract_Loaner',
    'Demonstration', 'VPP_CPP_Rental', 'Operating_Lease', 'Workshop'
  ]),
  account_id: z.string().uuid(),
  department_category: z.string().optional(),
  department_name: z.string().optional(),
  customer_address: z.string().optional(),
  customer_pic_id: z.string().uuid().optional(),
  sales_person_id: z.string().uuid(),
  start_use_date: z.string().date(),
  estimate_return_date: z.string().date(),
  repair_case_id: z.string().uuid().optional(),
  parent_request_id: z.string().uuid().optional(),
  internal_so_number: z.string().optional(),
  pr_number: z.string().optional(),
  event_name: z.string().optional(),
  prospect_name: z.string().optional(),
  pcl_number: z.string().optional(),
}).refine(data => new Date(data.estimate_return_date) > new Date(data.start_use_date), {
  message: 'estimate_return_date must be after start_use_date',
  path: ['estimate_return_date'],
})

export const ExtensionRequestSchema = z.object({
  new_return_date: z.string().date(),
  reason_code: z.string().min(1),
  reason_text: z.string().optional(),
})

export const RequestListQuerySchema = z.object({
  status: z.enum([
    'Draft', 'Waiting_Approval', 'Waiting_Reservation', 'Preparing', 'BOM_Confirmed',
    'Ready_for_Dispatch', 'Dispatched', 'With_Customer', 'Return_Initiated',
    'Request_Complete', 'Cancelled'
  ]).optional(),
  record_type: z.enum(['First_Request', 'Extension_Request']).optional(),
  account_id: z.string().uuid().optional(),
  sales_person_id: z.string().uuid().optional(),
  purpose1: z.string().optional(),
  is_overdue: z.coerce.boolean().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
})
```

---

## Device Deployments Module (`src/modules/deployments/`)

### Files

| File | Purpose |
|------|---------|
| `deployment.routes.ts` | Route registration with RBAC guards |
| `deployment.controller.ts` | HTTP layer |
| `deployment.service.ts` | Business logic |
| `deployment.stateMachine.ts` | Valid transition map |
| `deployment.schema.ts` | Zod validation schemas |

### Routes (`deployment.routes.ts`)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/` | Any authenticated | List deployments (filtered, paginated) |
| `GET` | `/:id` | Any authenticated | Get single deployment with full details |
| `POST` | `/` | EQC_Operator, EQC_Manager, System_Admin | Create deployment for an approved request |
| `PATCH` | `/:id/status` | EQC_Operator, EQC_Manager, System_Admin | Transition deployment status |

### Deployment Service (`deployment.service.ts`)

#### `create(dto, userId)`
1. Validate `request_id` references a request in `BOM_Confirmed` or `Ready_for_Dispatch` status
2. Validate `asset_id` references an asset with status `BOM_Confirmed` or `Available`
3. **Within a serializable Prisma transaction:**
   - Query for overlapping active deployments on the same asset
   - If overlap found: throw `AppError.conflict('BOOKING_CONFLICT')`
   - Create `device_deployment` with `status: Preparing`
4. Return created deployment

#### `transitionStatus(deploymentId, newStatus, userId)`
1. Fetch deployment
2. Validate via `isValidDeploymentTransition(current.status, newStatus)`
3. Update deployment status
4. Tandem asset status update (see state machine below)
5. If `newStatus = 'Returned'`: set `actual_return_date = now()`
6. Event log (non-blocking)

### Deployment State Machine (`deployment.stateMachine.ts`)

```typescript
const DEPLOYMENT_TRANSITIONS: Record<DeploymentStatus, DeploymentStatus[]> = {
  Preparing:     ['Dispatched'],
  Dispatched:    ['With_Customer'],
  With_Customer: ['Returned'],
  Returned:      ['In_Inspection'],
  In_Inspection: ['In_Repair'],  // auto-set if any Fail/Missing inspection result
  In_Repair:     [],  // terminal for deployment — asset continues in repair
}
```

### Asset Status Tandem Updates

| Deployment → New Status | Asset → New Status |
|------------------------|--------------------|
| `Dispatched` | `Dispatched` |
| `With_Customer` | `With_Customer` |
| `Returned` | `Return_Initiated` |
| `In_Inspection` | `In_Inspection` |
| Inspection: all Pass | `Cleaning` → `Available` |
| Inspection: any Fail | `Under_Repair` |

---

## Repair Cases Module (`src/modules/repairs/`)

### Files

| File | Purpose |
|------|---------|
| `repair.routes.ts` | Route registration |
| `repair.controller.ts` | HTTP layer |
| `repair.service.ts` | Business logic |
| `repair.schema.ts` | Zod validation schemas |

### Routes (`repair.routes.ts`)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/` | Any authenticated | List repair cases (filtered, paginated) |
| `GET` | `/:id` | Any authenticated | Get single repair case |
| `POST` | `/` | EQC_Operator, EQC_Manager, System_Admin | Create repair case manually |
| `PATCH` | `/:id/status` | EQC_Operator, EQC_Manager, FSE, System_Admin | Transition repair case status |

### Repair State Machine

```typescript
const REPAIR_TRANSITIONS: Record<RepairCaseStatus, RepairCaseStatus[]> = {
  Quoted:          ['IQ_Quoted', 'Confirmed'],
  IQ_Quoted:       ['PO_Received'],
  PO_Received:     ['Parts_Arranged'],
  Parts_Arranged:  ['Confirmed'],
  Confirmed:       ['Completed'],
  Completed:       [],  // terminal
}
```

### ID Format
Repair case numbers use format `RS-YYYYMM-NNNNNN` (e.g., `RS-202602-099595`), generated by `idGenerator.generateRepairCaseId()`.

---

## Error Codes

| Code | HTTP | When |
|------|------|------|
| `NOT_FOUND` | 404 | Request/deployment/repair ID not found |
| `BOOKING_CONFLICT` | 409 | Date overlap with existing active deployment on same asset |
| `INVALID_TRANSITION` | 409 | State machine rejects the status change |
| `INSUFFICIENT_PERMISSIONS` | 403 | Wrong role for this transition |

---

## Full Lifecycle Flow

See [PROCESS_FLOWS.md](./PROCESS_FLOWS.md) for the end-to-end sequence across all modules.

---

*Back to [CLAUDE.md](../CLAUDE.md)*
