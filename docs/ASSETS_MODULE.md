# Assets Module

**Location:** `src/modules/assets/`  
**Base route:** `/api/assets`

---

## Files

| File | Purpose |
|------|---------|
| `asset.routes.ts` | Route registration with RBAC guards |
| `asset.controller.ts` | HTTP layer |
| `asset.service.ts` | Business logic |
| `asset.stateMachine.ts` | Valid transition map + validator |
| `asset.schema.ts` | Zod validation schemas |

---

## Routes (`asset.routes.ts`)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/` | Any authenticated | List assets (filtered, paginated) |
| `GET` | `/:id` | Any authenticated | Get single asset |
| `POST` | `/` | System_Admin | Create new asset |
| `PATCH` | `/:id` | EQC_Operator, EQC_Manager, System_Admin | Update asset fields |
| `PATCH` | `/:id/status` | EQC_Operator, EQC_Manager, System_Admin | Transition asset status |
| `GET` | `/:id/availability` | Any authenticated | Check date availability |

---

## Asset Service (`asset.service.ts`)

### `list(filters, pagination)`
- Filters: `status`, `model_code`, `warehouse_code`, `demo_loaner_type`, `business_unit`, `area`
- Uses explicit Prisma `select` — no N+1
- Returns paginated results

### `getById(id)`
- Includes current deployment context if in active status
- Includes linked service contract if present
- Throws `AppError.notFound()` if not found

### `create(dto)`
- Validates `serial_number` uniqueness (Prisma P2002 → 409 CONFLICT)
- Sets `total_repair_count = 0`, `is_active = true` on creation
- Throws conflict error if serial number already exists

### `update(id, dto)`
- Partial update — only provided fields are updated
- Does not allow status change (use `transitionStatus` instead)

### `transitionStatus(id, newStatus, userId)`
1. Fetch current asset
2. Call `isValidAssetTransition(current.status, newStatus)` — throw 409 if invalid
3. Update asset status via Prisma
4. **Side effect:** If `newStatus === 'Under_Repair'` → call `teams.service.postInventoryWarning()` with asset details
5. Write event log (non-blocking)
6. Return updated asset

### `checkAvailability(assetId, startDate, endDate)`
- Queries for any `device_deployment` on this asset where:
  - `status` NOT IN `['Returned', 'In_Repair']`
  - Date ranges overlap: `start_date <= endDate AND expected_return_date >= startDate`
- Returns `{ available: boolean, conflictingDeployment?: {...} }`

---

## Asset State Machine (`asset.stateMachine.ts`)

### Transition Map

```typescript
const ASSET_TRANSITIONS: Record<AssetStatus, AssetStatus[]> = {
  Available:         ['Requested', 'Preparing', 'Under_Repair', 'Quarantine'],
  Requested:         ['Preparing', 'Available'],
  Preparing:         ['BOM_Confirmed', 'Available'],
  BOM_Confirmed:     ['Dispatched', 'Preparing'],
  Dispatched:        ['In_Transit'],
  In_Transit:        ['With_Customer'],
  With_Customer:     ['Return_Initiated', 'Extension_Used', 'Overdue'],
  Return_Initiated:  ['In_Inspection'],
  In_Inspection:     ['Cleaning', 'Under_Repair', 'Available'],
  Cleaning:          ['Available', 'Under_Repair'],
  Under_Repair:      ['Available', 'Quarantine', 'Retired'],
  Quarantine:        ['Under_Repair', 'Retired'],
  Extension_Used:    ['With_Customer', 'Return_Initiated', 'Overdue'],
  Overdue:           ['Return_Initiated', 'With_Customer'],
  Retired:           [],  // terminal state — no transitions allowed
}

export const isValidAssetTransition = (from: AssetStatus, to: AssetStatus): boolean =>
  ASSET_TRANSITIONS[from]?.includes(to) ?? false
```

### Rules
- `Retired` is a **terminal state** — no asset can leave Retired
- Status transitions are always validated server-side — the frontend cannot bypass this
- `Overdue` is set automatically by the background job processor, not directly by users

### Tandem Updates
When a deployment or request status changes, the asset status must also change in tandem:

| Trigger | Asset Status Change |
|---------|-------------------|
| Sales request approved → `Preparing` | Asset → `Preparing` |
| BOM confirmed on request | Asset → `BOM_Confirmed` |
| Dispatch document generated | Asset → `Dispatched` |
| Deployment status → `With_Customer` | Asset → `With_Customer` |
| Return initiated | Asset → `Return_Initiated` |
| Inspection started | Asset → `In_Inspection` |
| Inspection: all Pass | Asset → `Cleaning` then `Available` |
| Inspection: any Fail/Missing | Asset → `Under_Repair` |
| Extension approved | Asset → `Extension_Used` |

---

## Asset Schema (`asset.schema.ts`)

```typescript
export const CreateAssetSchema = z.object({
  asset_name: z.string().min(1),
  serial_number: z.string().min(1),
  model_code: z.string().min(1),
  model_name: z.string().optional(),
  sap_asset_number: z.string().optional(),
  sfdc_asset_id: z.string().optional(),
  demo_loaner_type: z.enum([
    'Demo_Asset', 'Loaner_Asset', 'MBA_Asset', 'Service_Center',
    'Rental', 'Operating_Lease', 'Workshop', 'MKTS', 'Comprehensive_Contract'
  ]),
  warehouse_code: z.string().optional(),
  installation_location: z.string().optional(),
  account_id: z.string().uuid().optional(),
  fse_owner_id: z.string().uuid().optional(),
  business_unit: z.string().optional(),
  oth_tier1: z.string().optional(),
  oth_tier2: z.string().optional(),
  oth_tier3: z.string().optional(),
  install_date: z.string().date().optional(),
  warranty_start: z.string().date().optional(),
  warranty_end: z.string().date().optional(),
  invoice_date: z.string().date().optional(),
  fda_status: z.enum(['Not_Enrolled', 'Enrolled', 'Approved']).optional(),
  fda_approved_no: z.string().optional(),
  condition_grade: z.enum(['New', 'Good', 'Needs_Service', 'Defective']).default('New'),
})

export const UpdateAssetSchema = CreateAssetSchema.partial()

export const TransitionAssetStatusSchema = z.object({
  status: z.enum([
    'Available', 'Requested', 'Preparing', 'BOM_Confirmed', 'Dispatched',
    'In_Transit', 'With_Customer', 'Return_Initiated', 'In_Inspection',
    'Cleaning', 'Under_Repair', 'Quarantine', 'Extension_Used', 'Overdue', 'Retired'
  ]),
  reason: z.string().optional(),
})

export const AssetListQuerySchema = z.object({
  status: z.enum([
    'Available', 'Requested', 'Preparing', 'BOM_Confirmed', 'Dispatched',
    'In_Transit', 'With_Customer', 'Return_Initiated', 'In_Inspection',
    'Cleaning', 'Under_Repair', 'Quarantine', 'Extension_Used', 'Overdue', 'Retired'
  ]).optional(),
  model_code: z.string().optional(),
  warehouse_code: z.string().optional(),
  demo_loaner_type: z.string().optional(),
  business_unit: z.string().optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
})
```

---

## Error Codes

| Code | HTTP | When |
|------|------|------|
| `NOT_FOUND` | 404 | Asset ID not found |
| `CONFLICT` | 409 | Serial number already exists |
| `INVALID_TRANSITION` | 409 | State machine rejects the transition |

---

*Back to [CLAUDE.md](../CLAUDE.md)*
