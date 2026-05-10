# Inspection Module

**Location:** `src/modules/inspection/`  
**Base route:** `/api/inspections`

---

## Overview

The inspection module handles device inspections at two points in the lifecycle:

- **DISPATCH inspection:** Verifies all required BOM items are packed before a device leaves the warehouse.
- **RETURN inspection:** Verifies condition and completeness of all BOM items when a device is returned from a customer.

One `inspection_record` is created per inspection event. Multiple `inspection_line_items` are created — one per `bom_line_item` in the assigned BOM set. Any FAIL or MISSING result on a return inspection automatically creates a `repair_case` record and posts a Teams CRIT alert.

---

## Files

| File | Purpose |
|------|---------|
| `inspection.routes.ts` | Route registration |
| `inspection.controller.ts` | HTTP layer |
| `inspection.service.ts` | Business logic |
| `inspection.schema.ts` | Zod validation schemas |

---

## Routes (`inspection.routes.ts`)

All routes require EQC_Operator, EQC_Manager, or System_Admin role.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/` | Create inspection record + generate all line items |
| `GET` | `/:id` | Get inspection with all line item results |
| `PATCH` | `/:id/items/:lineItemId` | Record result for one line item |
| `POST` | `/:id/complete` | Finalize inspection, transition asset + deployment |

---

## Inspection Service (`inspection.service.ts`)

### `createInspection(deploymentId, inspectionType, inspectedById)`
1. Fetch deployment — validate:
   - For DISPATCH type: deployment status must be `Preparing`
   - For RETURN type: deployment status must be `Returned`
2. Resolve `bom_set_id` from `deployment → request → bom_set_id`
3. Fetch all `bom_line_items` for this set
4. Create one `inspection_record` header row
5. Create one `inspection_line_item` row per BOM line item with `result = null` (pending), `inspection_type = inspectionType`
6. Return the inspection with all pending line item rows

**Row count:** exactly equal to the number of line items in the BOM set. Always uses the assigned BOM set — never queries BOM data outside the set.

### `recordLineItemResult(inspectionId, lineItemId, result, quantityActual, notes, inspectedById)`
1. Fetch the `inspection_line_item` for this `(inspectionId, lineItemId)` pair
2. Update `result` field with Pass / Fail / Missing
3. Set `quantity_actual`, `notes`, and timestamp
4. **If RETURN type AND `result === 'Fail'` or `result === 'Missing'`:**
   - Auto-create `repair_case` record with `status: Quoted`
   - Generate `rs_number` using `RS-YYYYMM-NNNNNN` format
   - Link repair case to the `inspection_record`
   - Call `teams.service.postDefectAlert(deployment, lineItem, result, rsNumber)` — posts CRIT alert to `#asset-defects` (non-blocking)
5. Return updated line item

### `completeInspection(inspectionId, inspectedById)`
1. Fetch all `inspection_line_item` rows for this inspection
2. Validate all items have been recorded (none have `result = null`) — throw 400 if any pending
3. Set `inspection_record.overall_condition` based on worst result:
   - All Pass → `Good`
   - Any Missing → `Missing`
   - Any Fail → `Defective`
4. For RETURN type: determine asset outcome:
   - **All Pass:** `assetStatus = Cleaning`, then `Available`; `deploymentStatus = Returned`
   - **Any Fail or Missing:** `assetStatus = Under_Repair`; `deploymentStatus = In_Inspection → In_Repair`
5. Within a single Prisma transaction:
   - Update inspection_record overall_condition
   - Update asset status
   - Update deployment status
   - Set `deployment.actual_return_date = now()` (if RETURN type and not already set)
6. Write event log (non-blocking)
7. Return summary: `{ outcome: 'ALL_PASS' | 'HAS_FAILURES', repairCases: RepairCase[] }`

---

## Inspection Schema (`inspection.schema.ts`)

```typescript
export const CreateInspectionSchema = z.object({
  deployment_id: z.string().uuid(),
  inspection_type: z.enum(['DISPATCH', 'RETURN']),
})

export const RecordLineItemResultSchema = z.object({
  result: z.enum(['Pass', 'Fail', 'Missing']),
  quantity_actual: z.number().int().min(0).optional(),
  notes: z.string().optional(),
})
```

---

## Business Rules Summary

| Rule | Detail |
|------|--------|
| One inspection per event | Creating a second RETURN inspection for the same deployment throws conflict |
| Line items mirror BOM set | Items created from `bom_line_items` of the assigned set — never from live BOM queries outside the set |
| All items must be recorded before completing | `completeInspection` throws 400 if any item has `result = null` |
| FAIL/MISSING (return) → auto repair case | `repair_case` created with `rs_number` format RS-YYYYMM-NNNNNN, Teams CRIT alert posted |
| Asset status after return inspection | All Pass → Cleaning → Available; Any Fail/Missing → Under_Repair |
| Deployment status after return inspection | All Pass → Returned (complete); Any Fail/Missing → In_Repair |
| DISPATCH inspection | Only validates packing completeness — does not create repair cases |

---

## Repair Case Auto-Creation

When `result = Fail` or `Missing` on a **return** inspection line item:

1. `repair.service.create()` is called automatically within `recordLineItemResult()`
2. A `repair_case` is created with:
   - `rs_number` → `RS-YYYYMM-NNNNNN` (e.g., `RS-202602-099595`)
   - `asset_id` from the deployment
   - `account_id` from the linked request
   - `status: Quoted`
   - `repair_type` inferred from linked request's `purpose2` (e.g., Q3S_Repair if purpose2 = Q3S_Loaner)
3. `repair_case_id` is linked back to the `inspection_record`

---

## Teams Alert on FAIL/MISSING (Return Inspection)

Posted to `#asset-defects` channel. Example Adaptive Card content:

```
🔴 CRIT: Component Failure Detected
Deployment: BGH Demo | DR-2602-106504
Accessory: Biopsy Cap (MAJ-1700) — REQUIRED
Result: MISSING
Repair Case: RS-202602-099595
Inspector: Somchai K.
Action: [Open Case] [View Deployment]
```

---

*Back to [CLAUDE.md](../CLAUDE.md)*
