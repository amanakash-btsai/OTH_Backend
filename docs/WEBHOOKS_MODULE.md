# Webhooks Module

**Location:** `src/modules/webhooks/`  
**Base route:** `/api/webhooks`

---

## Overview

The webhooks module handles all inbound external system calls:
- **MuleSoft** (from Salesforce + SAP) — HMAC-SHA256 signed JSON payloads
- **MS Teams** — card action callbacks (button clicks on Adaptive Cards)

**No JWT auth on webhook routes.** Authentication is via HMAC-SHA256 signature validation only.

**Always return HTTP 200** from webhook handlers — never let MuleSoft see a non-200 response for application-level errors (it triggers retry storms). Log errors to Azure Monitor instead.

---

## Files

| File | Purpose |
|------|---------|
| `webhook.routes.ts` | Route registration (uses `express.raw()` not `express.json()`) |
| `webhook.validator.ts` | HMAC-SHA256 signature validation |
| `mulesoft.controller.ts` | MuleSoft inbound event handlers |
| `teams.controller.ts` | Teams card action handlers |
| `webhook.service.ts` | Batch processing logic |

---

## Routes (`webhook.routes.ts`)

**Critical:** All webhook routes apply `express.raw({ type: 'application/json' })` instead of `express.json()`. This preserves the raw body bytes needed for HMAC signature computation.

| Method | Path | Signature Header | Description |
|--------|------|-----------------|-------------|
| `POST` | `/mulesoft/new-request` | `X-Mulesoft-Signature` | New Salesforce deployment request |
| `POST` | `/mulesoft/status-update` | `X-Mulesoft-Signature` | Salesforce status change sync |
| `POST` | `/mulesoft/asset-sync` | `X-Mulesoft-Signature` | SAP daily asset/BOM sync |
| `POST` | `/teams` | `X-Teams-Signature` | Teams card action callback |

```typescript
// In webhook.routes.ts
import { Router } from 'express'
import express from 'express'

const router = Router()
router.use(express.raw({ type: 'application/json' }))

router.post('/mulesoft/new-request', asyncHandler(mulesoftController.handleNewRequest))
router.post('/mulesoft/status-update', asyncHandler(mulesoftController.handleStatusUpdate))
router.post('/mulesoft/asset-sync', asyncHandler(mulesoftController.handleAssetSync))
router.post('/teams', asyncHandler(teamsController.handleCardAction))

export default router
```

---

## Webhook Validator (`webhook.validator.ts`)

HMAC-SHA256 signature validation using `crypto.timingSafeEqual()` to prevent timing attacks.

```typescript
import crypto from 'crypto'

export const validateMulesoftSignature = (rawBody: Buffer, signatureHeader: string): boolean => {
  const computed = crypto
    .createHmac('sha256', config.MULESOFT_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex')
  
  const provided = Buffer.from(signatureHeader, 'hex')
  const expected = Buffer.from(computed, 'hex')
  
  if (provided.length !== expected.length) return false
  return crypto.timingSafeEqual(provided, expected)
}
```

If signatures do not match: return 401 Unauthorized immediately and log the attempt to Azure Monitor.

`timingSafeEqual()` is mandatory — prevents timing-based signature oracle attacks where an attacker can guess the secret by measuring response times.

---

## MuleSoft Controller (`mulesoft.controller.ts`)

### `handleNewRequest(req, res)`

```
1. Validate HMAC → 401 if invalid
2. Parse: const body = JSON.parse(req.body.toString())
3. Check idempotency: find DeviceDeployment where sfdc_request_id = body.id
4. If found: return 200 with existing record (duplicate — MuleSoft retry)
5. If not found:
   a. Upsert Account via accountService.upsertFromSalesforce()
   b. Create DeviceDeployment (status: PENDING_EQC)
6. Return 201 with created deployment
7. On ANY application error: catch, log to Azure Monitor, return 200 (prevent retry storm)
```

### `handleStatusUpdate(req, res)`

```
1. Validate HMAC → 401 if invalid
2. Parse body: { sfdc_request_id, newStatus }
3. Find deployment by sfdc_request_id
4. If found and status is valid transition: call deploymentService.transitionStatus()
5. Always return 200
```

### `handleAssetSync(req, res)`

```
1. Validate HMAC → 401 if invalid
2. Parse body: { assets: AssetSyncItem[], bomComponents: BOMSyncItem[] }
3. Call webhookService.processAssetSyncBatch(assets, bomComponents)
4. Return 200 with summary: { created, updated, skipped }
```

---

## Teams Controller (`teams.controller.ts`)

### `handleCardAction(req, res)`

```
1. Validate Teams signature
2. Parse body: { actionType, deploymentId, userId }
3. Route by actionType:
   - 'ACKNOWLEDGE': mark alert acknowledged on deployment
   - 'ESCALATE': create manager escalation record, notify manager
   - 'REVIEW': return deployment detail URL for Teams to open
4. Return 200 immediately (Teams requires fast response)
```

Teams sends card action callbacks when users click "Acknowledge", "Escalate", or "Review" buttons on Adaptive Cards.

---

## Webhook Service (`webhook.service.ts`)

### `processAssetSyncBatch(assets, bomComponents)`
Processes the SAP daily sync batch.

```typescript
const results = { created: 0, updated: 0, skipped: 0 }

for (const asset of assets) {
  await prisma.asset.upsert({
    where: { serial_number: asset.serial_number },
    create: { ...asset },
    update: { sap_asset_number: asset.sap_asset_number, model_code: asset.model_code },
  })
}

for (const component of bomComponents) {
  await prisma.bOMComponent.upsert({
    where: { sap_component_material: component.material_number },
    create: { ...component, last_synced_from_sap: new Date() },
    update: { ...component, last_synced_from_sap: new Date() },
  })
}

return results
```

---

## Integration Details

### MuleSoft / Salesforce Connector

- **Trigger:** Salesforce event → MuleSoft Experience API → this endpoint
- **HMAC shared secret:** `MULESOFT_WEBHOOK_SECRET` env var (from Key Vault in production)
- **Idempotency key:** `sfdc_request_id` (Salesforce record ID)
- **Error strategy:** Always return 200. Log errors. Never let MuleSoft retry on app errors.

### SAP S/4HANA Connector

- **Direction:** Read-only inbound
- **Schedule:** Daily at 02:00 UTC via MuleSoft calling `POST /mulesoft/asset-sync`
- **Data:** Material Master (BOM parts) + Equipment Asset (SAP asset numbers)
- No writes back to SAP in current phase

### Teams Connector

See [SHARED_SERVICES.md](./SHARED_SERVICES.md#teams-service) for outbound Teams integration details.

---

*Back to [CLAUDE.md](../CLAUDE.md)*
