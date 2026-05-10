# Shared Services

**Location:** `src/services/`

These services are shared across multiple modules and called from controllers, job processors, and other services.

---

## Email Service (`src/services/email.service.ts`)

Nodemailer configured with Azure Communication Services SMTP (SendGrid as fallback).

**Critical:** All email sending is asynchronous — always add to `emailQueue`, never call SMTP directly in the request path.

```typescript
import nodemailer from 'nodemailer'
import { config } from '@config/index'

const transporter = nodemailer.createTransporter({
  host: config.SMTP_HOST,
  port: config.SMTP_PORT,
  auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
  secure: false,  // STARTTLS on port 587
})
```

### Methods

#### `sendTransportDocEmail(to, pdfBuffer, docRef)`
Sends the transport document PDF to the warehouse printer email (`WAREHOUSE_PRINTER_EMAIL`). Attachment: `{docRef}.pdf`, content type `application/pdf`.

#### `sendEscalationEmail(to, deployment, daysOverdue, aiDraft)`
Sends overdue escalation email to manager. Includes AI-drafted message from `overdueClassifier.agent.ts`.

#### `sendReportEmail(to, reportBuffer, reportType, format)`
Sends generated report as email attachment to the scheduled recipient.

### Queue Integration

All email sends are queued via `emailQueue.add('send-email', payload)`. The `emailQueue` BullMQ worker (in `jobs/processors/`) dequeues and calls the appropriate send method. This ensures:
- HTTP responses are never delayed by SMTP
- Failed sends are retried by BullMQ
- Email sending survives pod restarts

---

## Blob Service (`src/services/blob.service.ts`)

Azure Blob Storage SDK wrapper.

```typescript
import { BlobServiceClient, StorageSharedKeyCredential, generateBlobSASQueryParameters } from '@azure/storage-blob'
```

### Methods

#### `uploadTransportDoc(buffer: Buffer, docRef: string): Promise<string>`
Uploads to `transport-docs` container. Path: `{YYYY}/{MM}/{docRef}.pdf`. Returns the **blob path** (not full URL).

#### `uploadSignedCopy(buffer: Buffer, docId: string): Promise<string>`
Uploads to `signed-copies` container. Path: `signed/{docId}/{timestamp}.pdf`. Returns blob path.

#### `uploadReport(buffer: Buffer, reportRef: string): Promise<string>`
Uploads to `audit-reports` container. Returns blob path.

#### `generateSasUrl(containerName: string, blobPath: string, expiryHours = 1): Promise<string>`
Generates a SAS token with `read` permission, 1-hour expiry. Returns the full SAS URL.

**Never store SAS URLs in the database.** Store only the blob path. Call `generateSasUrl()` each time a user needs to download.

#### `deleteBlob(containerName: string, blobPath: string): Promise<void>`
Used for cleanup if a dispatch is cancelled before the document is sent.

### Blob Path Convention

```
transport-docs/2026/05/DOC-20260509-A1B2C3D4.pdf
signed-copies/signed/uuid-doc-id/1715234567890.pdf
audit-reports/2026/05/RPT-20260509-DEPLOYMENT-SUMMARY.xlsx
```

---

## Teams Service (`src/services/teams.service.ts`)

Posts Adaptive Cards to 6 MS Teams channels. Handles retries and failure recording.

### Channel Configuration

```typescript
const CHANNEL_WEBHOOKS = {
  EQC_OPS:          config.TEAMS_EQC_OPS_WEBHOOK,
  LOANER_OVERDUE:   config.TEAMS_LOANER_OVERDUE_WEBHOOK,
  DEMO_ALERTS:      config.TEAMS_DEMO_ALERTS_WEBHOOK,
  ASSET_DEFECTS:    config.TEAMS_ASSET_DEFECTS_WEBHOOK,
  INVENTORY_CRITICAL: config.TEAMS_INVENTORY_CRITICAL_WEBHOOK,
  EXEC_SUMMARY:     config.TEAMS_EXEC_SUMMARY_WEBHOOK,
}
```

### Retry Logic

3 attempts with exponential backoff:
- Attempt 1: immediate
- Attempt 2: 500ms delay
- Attempt 3: 1000ms delay
- Attempt 4: 2000ms delay

On total failure: write to `AlertFailure` table for manual retry via admin dashboard.

```typescript
const postWithRetry = async (webhookUrl: string, payload: AdaptiveCard, maxRetries = 3) => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await axios.post(webhookUrl, payload, { timeout: 5000 })
      return
    } catch (err) {
      if (attempt === maxRetries) {
        await saveAlertFailure(channel, payload, err.message)
        return
      }
      await sleep(500 * Math.pow(2, attempt))
    }
  }
}
```

### Methods

#### `postDispatchCard(deployment, docRef)`
Posts to `#eqc-ops-alerts`. Shows deployment details, doc reference, action buttons (View, Acknowledge).

#### `postOverdueAlert(deployment, severity, aiDraft)`
Posts to `#loaner-overdue` or `#demo-alerts` depending on deployment type. Includes AI-drafted message and severity badge. Action buttons: Acknowledge, Escalate.

#### `postDefectAlert(deployment, component, result, repairCaseId)`
Posts CRIT alert to `#asset-defects`. Shows component failure details and repair case ID. Action: Open Case.

#### `postInventoryWarning(asset)`
Posts to `#inventory-critical` when asset inventory drops below `ConfigThreshold.min_available_count`.

#### `postKpiDigest(kpiData, aiNarrative)`
Posts daily KPI summary to `#exec-summary`. Includes AI trend narrative from `kpiForecast.agent.ts`.

---

## OpenAI Service (`src/services/openai.service.ts`)

Azure OpenAI wrapper used by all 6 AI agents. **Never used in the HTTP request path** — only in BullMQ job processors.

```typescript
import { OpenAIClient, AzureKeyCredential } from '@azure/openai'
import { config } from '@config/index'

const client = new OpenAIClient(
  config.AZURE_OPENAI_ENDPOINT,
  new AzureKeyCredential(config.AZURE_OPENAI_API_KEY)
)
```

### `complete(systemPrompt, userPrompt, maxTokens): Promise<string>`

```typescript
export const complete = async (
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 500
): Promise<string> => {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await client.getChatCompletions(
        config.AZURE_OPENAI_DEPLOYMENT,
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        { maxTokens, temperature: 0.3 }
      )
      return response.choices[0].message?.content ?? ''
    } catch (err: any) {
      if ((err.status === 429 || err.status === 503) && attempt < 2) {
        await sleep(1000 * Math.pow(2, attempt))
        continue
      }
      throw err
    }
  }
}
```

**Retry:** 3× on HTTP 429 (rate limit) and 503 (unavailable) with exponential backoff.

### Token Budgets

| Agent | Max Tokens |
|-------|-----------|
| `overdueClassifier` | 300 |
| `kpiForecast` | 500 |
| `auditNarration` | 800 |
| `receiptMonitor` | 400 |
| `anomalyDetection` | 600 |
| `dispatchPopulation` | 200 |

---

*Back to [CLAUDE.md](../CLAUDE.md)*
