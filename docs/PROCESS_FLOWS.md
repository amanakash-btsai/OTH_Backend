# Process Flows

End-to-end flows that span multiple modules. Read these to understand how the system works holistically.

---

## 1. Azure AD SSO Authentication Flow

1. User clicks "Sign in with Olympus AD" on the frontend application
2. Frontend redirects to Azure AD authorize URL:
   ```
   https://login.microsoftonline.com/{AZURE_AD_TENANT_ID}/oauth2/v2.0/authorize
     ?client_id={AZURE_AD_CLIENT_ID}
     &redirect_uri={AZURE_AD_REDIRECT_URI}
     &response_type=code
     &scope=openid email profile
   ```
3. User authenticates with Olympus corporate credentials inside Azure AD
4. Azure AD redirects to `GET /api/auth/sso/azure?code={auth_code}` on the backend
5. `auth.service.azureCallback(code)` exchanges the code for an Azure AD access token via POST to the token endpoint
6. Backend fetches user profile from Microsoft Graph API using the Azure AD access token
7. `user.service.upsertFromAzureAD(azureAdObjectId, profile)` — creates the user on first login, updates name/email on subsequent logins
8. `auth.service.issueTokenPair(user)` — signs a 15-minute JWT access token and a 7-day cryptographic refresh token
9. SHA-256 hash of the refresh token stored in `User.refreshTokenHash`
10. HttpOnly, SameSite=Strict, Secure cookie set with the refresh token value
11. JSON response body contains the access token
12. Frontend stores the access token in memory only — never in `localStorage` or `sessionStorage`
13. All subsequent API calls include `Authorization: Bearer {access_token}` header

---

## 2. Demo Deployment Full Lifecycle

1. **Salesforce → MuleSoft → Backend:** Sales rep creates a Demo Request in Salesforce. MuleSoft calls `POST /api/webhooks/mulesoft/new-request` with HMAC signature. Backend validates HMAC, checks `sfdc_request_id` idempotency, creates `DeviceDeployment` (status: `PENDING_EQC`), upserts Account.

2. **EQC Manager reviews:** Logs into web app, sees pending request in service dashboard. Calls `PATCH /api/deployments/{id}/approve`. System validates no date conflicts, transitions status to `IN_PREPARATION`, posts Teams Adaptive Card to `#eqc-ops-alerts`.

3. **BOM snapshot:** EQC Operator calls `POST /api/bom/snapshots` with `deployment_id`. Freezes all active BOM components for this device model into a JSON snapshot in the `BOMSnapshot` table.

4. **Physical packing + validation:** Operator physically picks components. Calls `POST /api/bom/validate-packing` to verify all REQUIRED items are packed. Receives `{ isComplete: true/false, missingItems: [...] }`.

5. **Dispatch document generation:** Operator calls `POST /api/dispatch/documents`. System:
   - Checks dispatch block (returns 409 if any REQUIRED item missing)
   - Generates QR code
   - Generates A4 PDF (PDFKit)
   - Uploads PDF to Azure Blob `transport-docs`
   - Creates `DispatchDocument` record (status: GENERATED)
   - Transitions deployment to `IN_TRANSIT` (tandem: asset → DEMO)
   - Queues print email to warehouse printer
   - Posts Teams card to `#eqc-ops-alerts`
   - Returns `{ docId, pdfUrl (SAS, 1-hour) }`

6. **Delivery:** Device is physically dispatched to the hospital.

7. **Signed copy upload:** Hospital receives device, signs the paper transport document. EQC Operator scans and calls `POST /api/dispatch/documents/{id}/sign` (multipart). Signed copy stored in Blob `signed-copies`. `DispatchDocument.status → SIGNED`.

8. **Return:** Hospital returns device. Operator calls `PATCH /api/deployments/{id}/status` with `status: RETURNED`. `actual_return_date` recorded.

9. **Inspection:**
   - `POST /api/inspections` — creates one `InspectionRecord` per BOM component (from frozen snapshot)
   - `PATCH /api/inspections/{id}/items/{componentId}` — record PASS/FAIL/MISSING for each component
   - Any FAIL/MISSING → auto-generate `repair_case_id` + CRIT Teams alert to `#asset-defects`
   - `POST /api/inspections/{id}/complete` — finalize:
     - All PASS → Asset: `AVAILABLE`, Deployment: `COMPLETED`
     - Any FAIL → Asset: `IN_REPAIR`, Deployment: `COMPLETED`

---

## 3. BOM Dispatch Block Enforcement

The dispatch block is a hard server-side constraint. Cannot be bypassed by the frontend.

1. EQC Operator calls `POST /api/dispatch/documents` with `{ deploymentId, packedItemIds: [...] }`
2. `dispatch.service.generateDocument()` first calls `bom.service.validatePacking(snapshotId, packedItemIds)`
3. `validatePacking` reads all components from the frozen `BOMSnapshot` where `item_type = 'REQUIRED'`
4. Checks which required component IDs are present in `packedItemIds`
5. If any REQUIRED component is absent: returns `{ isComplete: false, missingItems: [{componentId, componentName, requiredQty}...] }`
6. `dispatch.service` receives `isComplete = false` → throws `AppError.dispatchBlocked(missingItems)`
7. `errorHandler.middleware` catches this AppError → HTTP 409:
   ```json
   {
     "success": false,
     "error": {
       "code": "DISPATCH_BLOCKED",
       "message": "Cannot dispatch — missing required BOM items",
       "details": {
         "missingItems": [{ "componentId": "...", "componentName": "Biopsy Cap", "requiredQty": 2 }]
       }
     }
   }
   ```
8. Frontend displays the missing items list to the operator
9. Operator physically locates missing items, re-calls validate-packing to confirm
10. Once all REQUIRED items present: `POST /api/dispatch/documents` proceeds to PDF generation

---

## 4. MuleSoft Inbound Integration Flow

1. Salesforce event triggers MuleSoft Experience API
2. MuleSoft computes `HMAC-SHA256(rawBody, MULESOFT_WEBHOOK_SECRET)` and adds `X-Mulesoft-Signature` header
3. MuleSoft calls `POST /api/webhooks/mulesoft/new-request` with raw JSON body
4. `webhook.routes.ts` applies `express.raw()` — preserves raw body bytes
5. `webhook.validator.ts` computes `HMAC-SHA256(rawBody, MULESOFT_WEBHOOK_SECRET)` using Node.js crypto
6. Compares with `crypto.timingSafeEqual()` to prevent timing attacks
7. If mismatch → 401 Unauthorized, log to Azure Monitor
8. If valid → `JSON.parse(rawBody.toString())`
9. Check `DeviceDeployment` for existing `sfdc_request_id = body.id`
10. If duplicate → 200 with existing record (prevents duplicate on MuleSoft retry)
11. If new → create deployment, upsert account → 201
12. On any application error inside processing → catch, log, return 200 (prevents MuleSoft retry storm)

---

## 5. Automated Overdue Alert Pipeline

1. BullMQ cron fires every 6 hours via `overdueAlertQueue`
2. `overdueAlert.processor.ts` queries: `DeviceDeployment WHERE status = 'DELIVERED' AND end_date < NOW()`
3. For each overdue deployment: `daysOverdue = floor((now - endDate) / 86400000)`
4. Classify severity:
   - 1–3 days → MEDIUM (log only)
   - 4–7 days → HIGH
   - 8–14 days → CRIT
   - >14 days → URGENT
5. Read `alert_sent_at` and `last_alert_severity` — skip if this severity already alerted
6. For new severity: call `overdueClassifier.agent.ts` with deployment context
7. Agent returns `{ severity, suggestedAction, emailDraft }`
8. `teams.service.postOverdueAlert()` posts Adaptive Card to `#loaner-overdue` or `#demo-alerts`
9. Card includes: device details, days overdue, AI-drafted message, action buttons (Acknowledge, Escalate)
10. Update deployment: `alert_sent_at = now`, `last_alert_severity = severity`
11. When Teams card button is clicked: Teams POST to `/api/webhooks/teams` → `teams.controller` routes the action

---

## 6. MS Teams Adaptive Card Integration

### Outbound (Backend → Teams)

`teams.service` builds an Adaptive Card JSON payload and POSTs to the channel webhook URL. 3× exponential backoff retry. On total failure: writes to `AlertFailure` table.

```typescript
const adaptiveCard = {
  type: 'message',
  attachments: [{
    contentType: 'application/vnd.microsoft.card.adaptive',
    content: {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [ /* card body */ ],
      actions: [
        { type: 'Action.Http', title: 'Acknowledge', url: `${API_URL}/webhooks/teams`, body: JSON.stringify({ actionType: 'ACKNOWLEDGE', deploymentId }) },
        { type: 'Action.Http', title: 'Escalate', url: `${API_URL}/webhooks/teams`, body: JSON.stringify({ actionType: 'ESCALATE', deploymentId }) },
      ]
    }
  }]
}
```

### Inbound (Teams → Backend)

When a user clicks a card button, Teams sends `POST /api/webhooks/teams` with the action payload. `teams.controller.handleCardAction()`:
1. Validates Teams HMAC signature
2. Parses `actionType` from body
3. Routes to appropriate service method
4. Returns 200 immediately (Teams requires fast response < 5 seconds)

---

*Back to [CLAUDE.md](../CLAUDE.md)*
