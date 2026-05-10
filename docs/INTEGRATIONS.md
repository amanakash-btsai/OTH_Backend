# Integration Connectors

All external system integrations are documented here. For implementation details see [WEBHOOKS_MODULE.md](./WEBHOOKS_MODULE.md) and [SHARED_SERVICES.md](./SHARED_SERVICES.md).

---

## Salesforce / MuleSoft Connector

**Direction:** Bi-directional  
**Method:** HMAC-SHA256 signed webhooks via MuleSoft Experience API

### Inbound Endpoints

| Endpoint | Trigger | Description |
|----------|---------|-------------|
| `POST /api/webhooks/mulesoft/new-request` | New Salesforce demo/loaner request | Create deployment + upsert account |
| `POST /api/webhooks/mulesoft/status-update` | Salesforce status change | Sync deployment status |
| `POST /api/webhooks/mulesoft/asset-sync` | Daily SAP batch | Upsert assets and BOM components |

### Security
- HMAC-SHA256 signed with `MULESOFT_WEBHOOK_SECRET` (from Azure Key Vault)
- Validated using `crypto.timingSafeEqual()` on every request
- Invalid signature → 401, logged to Azure Monitor

### Idempotency
- `sfdc_request_id` checked before creating any record
- Duplicate calls return 200 with the existing record

### Error Handling
- Always return HTTP 200 to MuleSoft (even on application errors)
- Log errors to Azure Monitor
- Reason: Non-200 responses trigger MuleSoft retry storms

---

## SAP S/4HANA Connector

**Direction:** Read-only inbound  
**Method:** Daily batch via MuleSoft `asset-sync` webhook endpoint  
**Schedule:** Daily at 02:00 UTC

### Data Synchronized

| SAP Data | EQC Table | Field Mapping |
|----------|-----------|--------------|
| Material Master | `BOMComponent` | `sap_component_material` → material number |
| Equipment Asset | `Asset` | `sap_asset_number` → SAP equipment ID |

### Notes
- All SAP data is reference-only — **no writes back to SAP in current phase**
- `last_synced_from_sap` timestamp updated on every sync
- Processed by `webhook.service.processAssetSyncBatch()`

---

## MS Teams Connector

**Direction:** Outbound alerts + inbound action callbacks

### 6 Channels

| Channel | Variable | Used For |
|---------|---------|---------|
| `#eqc-ops-alerts` | `TEAMS_EQC_OPS_WEBHOOK` | Deployment approvals, dispatch notifications |
| `#loaner-overdue` | `TEAMS_LOANER_OVERDUE_WEBHOOK` | Overdue loaner alerts |
| `#demo-alerts` | `TEAMS_DEMO_ALERTS_WEBHOOK` | Overdue demo alerts |
| `#asset-defects` | `TEAMS_ASSET_DEFECTS_WEBHOOK` | Inspection FAIL/MISSING alerts |
| `#inventory-critical` | `TEAMS_INVENTORY_CRITICAL_WEBHOOK` | Low inventory warnings |
| `#exec-summary` | `TEAMS_EXEC_SUMMARY_WEBHOOK` | Daily KPI digest |

### Outbound (Incoming Webhooks)
- Constructs Adaptive Card JSON and POSTs to channel webhook URL
- 3× exponential backoff retry (500ms, 1000ms, 2000ms)
- On total failure: writes to `AlertFailure` table for manual retry via admin dashboard

### Inbound (Card Action Callbacks)
- Teams POSTs to `POST /api/webhooks/teams` when user clicks a card button
- Validates Teams HMAC signature
- Routes to appropriate service method
- Returns 200 immediately (Teams requires < 5 second response)

---

## Azure OpenAI Connector

**Direction:** Outbound (backend calls Azure OpenAI REST API)  
**Model:** GPT-4o mini  
**Deployment name:** configured in `AZURE_OPENAI_DEPLOYMENT` env var

### Configuration
```
Endpoint: AZURE_OPENAI_ENDPOINT (e.g., https://<resource>.openai.azure.com)
API Key:  AZURE_OPENAI_API_KEY (from Key Vault)
Model:    gpt-4o-mini
```

### Usage
- **6 AI agents** running as BullMQ background workers
- **Never in the HTTP request path**
- Token budgets: 200–800 tokens per call depending on agent

### Retry
- 3× retry on HTTP 429 (rate limit) and 503 (unavailable)
- Exponential backoff: 1s, 2s, 4s

### Cost Model
GPT-4o mini chosen for cost optimization (~10× cheaper than GPT-4o) while handling all use cases adequately.

---

## Azure Blob Storage Connector

**Direction:** Outbound (backend writes/reads blobs)

### Containers

| Container | Env Variable | Purpose |
|-----------|-------------|---------|
| `transport-docs` | `AZURE_STORAGE_CONTAINER_TRANSPORT` | Generated dispatch PDFs |
| `signed-copies` | `AZURE_STORAGE_CONTAINER_SIGNED` | Uploaded signed physical copies |
| `audit-reports` | (hardcoded) | Generated compliance reports |

### Access Pattern
- **Private storage** — no public blob access
- **SAS tokens** generated on demand with 1-hour expiry (`read` permission only)
- SAS tokens are **NOT stored in the database** — generated fresh when user requests a download
- Only blob paths are stored in DB (allows SAS generation for any environment/URL)

### Authentication
- Local dev: Connection string from `.env`
- Production: Connection string from Azure Key Vault via Managed Identity

---

## Email / SMTP Connector

**Provider:** Azure Communication Services SMTP (primary), SendGrid (fallback)  
**Transport:** Nodemailer

### Configuration
```
Host:  SMTP_HOST
Port:  SMTP_PORT (587 for STARTTLS)
User:  SMTP_USER
Pass:  SMTP_PASS (from Key Vault)
```

### Key Rule
**All email sending is asynchronous.** Jobs are added to `emailQueue`, never sent inline during request processing. This ensures HTTP responses are never delayed by SMTP.

### Use Cases

| Email Type | Recipient | Trigger |
|-----------|----------|--------|
| Transport document | `WAREHOUSE_PRINTER_EMAIL` | Dispatch document generated |
| Overdue escalation | Manager email | Alert severity crosses threshold |
| Report delivery | Configured recipient | Scheduled or on-demand report |

---

## Azure Application Insights

**Direction:** Outbound (backend → Azure Monitor)

Telemetry sent via Winston transport. Captures:
- HTTP request logs (method, path, status, response time)
- Application errors with stack traces
- Custom events (webhook validation failures, Teams alert failures)
- Performance counters

Configure with `AZURE_APP_INSIGHTS_CONNECTION_STRING`.

---

*Back to [CLAUDE.md](../CLAUDE.md)*
