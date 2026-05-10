# BOM (Bill of Materials) Module

**Location:** `src/modules/bom/`  
**Base route:** `/api/bom`

---

## Overview

The BOM module manages three related tables: `bom_sets` (set definitions per model), `bom_line_items` (individual accessory lines per set), and `accessory_master` (catalog of all accessories). It enforces the dispatch block — the hard server-side rule that prevents dispatch if any `is_required = true` line item is missing. This block **cannot be bypassed by the frontend under any circumstances**.

---

## Files

| File | Purpose |
|------|---------|
| `bom.routes.ts` | Route registration with RBAC guards |
| `bom.controller.ts` | HTTP layer |
| `bom.service.ts` | Business logic including dispatch block enforcement |
| `bom.schema.ts` | Zod validation schemas |

---

## Routes (`bom.routes.ts`)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/sets` | Any authenticated | List BOM sets (optionally filtered by model_code) |
| `GET` | `/sets/:setId` | Any authenticated | Get single BOM set with all line items |
| `POST` | `/sets` | EQC_Manager, System_Admin | Create a new BOM set |
| `PATCH` | `/sets/:setId` | EQC_Manager, System_Admin | Update BOM set metadata |
| `GET` | `/sets/:setId/lines` | Any authenticated | Get all line items for a set |
| `POST` | `/sets/:setId/lines` | EQC_Manager, System_Admin | Add a line item to a set |
| `PATCH` | `/sets/:setId/lines/:lineId` | EQC_Manager, System_Admin | Update a line item |
| `DELETE` | `/sets/:setId/lines/:lineId` | EQC_Manager, System_Admin | Remove a line item from a set |
| `GET` | `/accessories` | Any authenticated | List accessory master catalog |
| `POST` | `/accessories` | System_Admin | Create accessory master record |
| `POST` | `/validate-packing` | EQC_Operator, EQC_Manager, System_Admin | Check packed items against REQUIRED list |

---

## BOM Service (`bom.service.ts`)

### `listSets(modelCode?)`
Returns all active `bom_sets`, optionally filtered by `model_code`. Used to populate the set selector in the dispatch UI.

### `getSetWithLines(setId)`
Returns the `bom_set` record with all `bom_line_items` joined with `accessory_master` names and codes. Filters `is_active = true` on the set only — line items are returned regardless.

### `createSet(dto, userId)`
Creates a new BOM set record. Validates that `model_code` is a known model (exists in assets table). Sets `is_active = true`, records `created_by_id`.

### `updateSet(setId, dto)`
Partial update of set metadata (description, version, expiry_date). Does not allow changing `model_code` (structural change — create a new set instead).

### `addLineItem(setId, dto)`
Adds a new `bom_line_item` to an existing set. Validates:
- `set_id` references an active set
- `accessory_id` references an existing `accessory_master` record
- Only one of `is_required`, `is_optional`, `is_consumable` should be true

### `updateLineItem(lineId, dto)`
Partial update of quantity, flags, or storage location on a line item.

### `removeLineItem(lineId)`
Soft-deletes by removing the line item. Validates the set is not currently assigned to an active `sales_request` (status not in terminal states).

### `listAccessories(filters)`
Returns all active `accessory_master` records. Filters: `device_model_code`, `accessory_code`, `is_active`.

### `validatePacking(setId, packedAccessoryIds: string[])`
**THE DISPATCH BLOCK — core enforcement logic.**

```typescript
async validatePacking(setId: string, packedAccessoryIds: string[]) {
  const lines = await prisma.bomLineItem.findMany({
    where: { set_id: setId },
    include: { accessory: true },
  })

  const requiredLines = lines.filter(l => l.is_required)
  const missingItems = requiredLines.filter(
    l => !packedAccessoryIds.includes(l.accessory_id)
  )

  return {
    isComplete: missingItems.length === 0,
    missingItems: missingItems.map(l => ({
      lineId: l.line_id,
      accessoryCode: l.accessory.accessory_code,
      accessoryName: l.accessory.accessory_name,
      quantityRequired: l.quantity_required,
      storageLocation: l.storage_location,
    })),
  }
}
```

**Key rules enforced:**
- Only `is_required = true` lines block dispatch — optional and consumable items are never blockers
- Missing optional items are logged but do not affect `isComplete`
- Returns `isComplete: false` with full `missingItems` array if any required line is absent
- This result is consumed by `dispatch.service.generateDocument()` — if `isComplete = false`, it throws `AppError.dispatchBlocked(missingItems)`

---

## BOM Schema (`bom.schema.ts`)

```typescript
export const CreateBOMSetSchema = z.object({
  set_name: z.string().min(1),
  model_code: z.string().min(1),
  version: z.string().min(1),
  effective_date: z.string().date(),
  expiry_date: z.string().date().optional(),
  description: z.string().optional(),
})

export const UpdateBOMSetSchema = CreateBOMSetSchema.partial().omit({ model_code: true })

export const AddLineItemSchema = z.object({
  accessory_id: z.string().uuid(),
  sequence_no: z.number().int().optional(),
  quantity_required: z.number().int().positive(),
  is_required: z.boolean().default(false),
  is_optional: z.boolean().default(false),
  is_consumable: z.boolean().default(false),
  storage_location: z.string().optional(),
}).refine(
  data => [data.is_required, data.is_optional, data.is_consumable].filter(Boolean).length === 1,
  { message: 'Exactly one of is_required, is_optional, is_consumable must be true' }
)

export const UpdateLineItemSchema = z.object({
  sequence_no: z.number().int().optional(),
  quantity_required: z.number().int().positive().optional(),
  is_required: z.boolean().optional(),
  is_optional: z.boolean().optional(),
  is_consumable: z.boolean().optional(),
  storage_location: z.string().optional(),
})

export const CreateAccessorySchema = z.object({
  accessory_code: z.string().min(1),
  accessory_name: z.string().min(1),
  device_model_code: z.string().optional(),
})

export const ValidatePackingSchema = z.object({
  set_id: z.string().uuid(),
  packed_accessory_ids: z.array(z.string().uuid()),
})
```

---

## Dispatch Block — Full Enforcement Flow

```
POST /api/dispatch/documents
  └── dispatch.service.generateDocument(deploymentId)
        └── 1. Resolve set_id from sales_request.bom_set_id
            2. bom.service.validatePacking(setId, packedAccessoryIds)
              ├── isComplete = false → AppError.dispatchBlocked(missingItems) → HTTP 409 DISPATCH_BLOCKED
              └── isComplete = true → continue to PDF generation
```

HTTP 409 response when blocked:
```json
{
  "success": false,
  "error": {
    "code": "DISPATCH_BLOCKED",
    "message": "Cannot dispatch — missing required BOM items",
    "details": {
      "missingItems": [
        {
          "lineId": "uuid",
          "accessoryCode": "MAJ-1700",
          "accessoryName": "Biopsy Cap",
          "quantityRequired": 2,
          "storageLocation": "Rack B-3"
        }
      ]
    }
  }
}
```

The frontend displays this list to the EQC operator including storage location to speed up finding items. Once all required items confirmed, operator re-calls `POST /api/dispatch/documents`.

---

## BOM Set Assignment to Requests

When an EQC operator prepares a request for Demo equipment:
1. They select the applicable BOM set via `PATCH /api/requests/:id` with `{ bom_set_id: "..." }`
2. Status transitions: request → `BOM_Confirmed`, asset → `BOM_Confirmed`
3. The selected `bom_set_id` is stored on the request and referenced at dispatch time

---

*Back to [CLAUDE.md](../CLAUDE.md)*
