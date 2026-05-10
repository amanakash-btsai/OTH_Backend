# AI Agents

**Location:** `src/jobs/agents/`  
**Runtime:** Azure OpenAI GPT-4o mini  
**Key principle:** All agents run only inside BullMQ background workers — **never in the HTTP request path**

---

## Overview

There are 6 AI agents. Each is a standalone module that:
1. Takes structured data as input
2. Builds a system prompt + user prompt
3. Calls `openai.service.complete(systemPrompt, userPrompt, maxTokens)`
4. Returns a typed result object

All agents require human confirmation or display outputs in Teams cards — **no agent takes autonomous action on production data** without human review.

---

## `src/jobs/agents/overdueClassifier.agent.ts`

**Called by:** `overdueAlert.processor.ts`  
**Max tokens:** 300

Analyzes a single overdue deployment and produces an alert message with severity classification and suggested action.

```typescript
interface OverdueClassifierInput {
  deployment: DeploymentSummary
  daysOverdue: number
  account: AccountSummary
  deviceModel: string
  lastActivity: string
}

interface OverdueClassifierOutput {
  severity: 'HIGH' | 'CRIT' | 'URGENT'
  suggestedAction: string   // e.g., "Contact account manager immediately"
  emailDraft: string        // Short email body for the escalation
}
```

**System prompt template:**
```
You are an operations assistant for OTH Equipment Co., managing medical device deployments in Thailand.
Analyze the overdue deployment and provide:
1. A suggested action (1 sentence)
2. A professional email draft (2–3 sentences) to the hospital contact

Be concise. Use professional Thai/English mixed tone appropriate for the healthcare sector.
```

---

## `src/jobs/agents/kpiForecast.agent.ts`

**Called by:** `kpiDigest.processor.ts`  
**Max tokens:** 500

Generates a 2–3 sentence trend analysis and short-term forecast from 90-day KPI data. Used in the daily executive Teams digest.

```typescript
interface KpiForecastInput {
  currentMonth: KpiSnapshot
  lastMonth: KpiSnapshot
  last90Days: KpiTrend[]
}

interface KpiForecastOutput {
  narrative: string  // 2–3 sentences of executive-level analysis
  keyInsights: string[]  // 2–3 bullet points
}
```

**System prompt:**
```
You are a business analyst for OTH Equipment Co., a medical device distribution company in Thailand.
Analyze the 90-day deployment and revenue trends. Write 2–3 sentences of executive-level analysis
suitable for a morning briefing card. Focus on meaningful changes, not just numbers.
Highlight risks or opportunities. Keep language clear and concise.
```

---

## `src/jobs/agents/auditNarration.agent.ts`

**Called by:** Admin-triggered endpoint or report generation  
**Max tokens:** 800

Fetches the `AuditLog` timeline for a specific entity and generates a compliance-ready narrative paragraph describing the history of actions taken on that record.

```typescript
interface AuditNarrationInput {
  entityType: string
  entityId: string
  auditEntries: AuditLogEntry[]
}

interface AuditNarrationOutput {
  narrative: string  // Compliance-ready paragraph describing the audit trail
}
```

**System prompt:**
```
You are a compliance documentation assistant for a medical device company regulated under Thai FDA standards.
Given the audit trail of actions on a device deployment record, write a clear, factual, chronological
narrative paragraph suitable for a compliance report. Use passive voice where appropriate.
Do not add information not present in the audit trail.
```

---

## `src/jobs/agents/receiptMonitor.agent.ts`

**Called by:** `receiptMonitor.processor.ts`  
**Max tokens:** 400

Analyzes patterns in unsigned dispatch documents — identifies which accounts and operators have chronic delays in signing return receipts.

```typescript
interface ReceiptMonitorInput {
  unsignedDocuments: Array<{
    document: DispatchDocumentSummary
    deployment: DeploymentSummary
    account: AccountSummary
    operator: UserSummary
    ageInDays: number
  }>
}

interface ReceiptMonitorOutput {
  hasPattern: boolean
  patternDescription: string | null
  chronicAccounts: string[]   // Account names with repeated delays
  chronicOperators: string[]  // Operator names with repeated delays
  recommendation: string
}
```

---

## `src/jobs/agents/anomalyDetection.agent.ts`

**Called by:** Scheduled (weekly) or admin-triggered  
**Max tokens:** 600

Analyzes 90-day inspection failure rates by component type and warehouse. Identifies statistically unusual patterns (e.g., a specific component failing at 3× the baseline rate at one warehouse).

```typescript
interface AnomalyDetectionInput {
  inspectionData: Array<{
    component: BOMComponentSummary
    warehouse_code: string
    failureRate: number   // FAIL / total inspections
    sampleSize: number
    baseline: number      // historical average failure rate
  }>
}

interface AnomalyDetectionOutput {
  anomalies: Array<{
    component: string
    warehouse: string
    observedRate: number
    baselineRate: number
    severity: 'LOW' | 'MEDIUM' | 'HIGH'
    description: string
  }>
  summary: string
}
```

Results posted to `#asset-defects` Teams channel.

---

## `src/jobs/agents/dispatchPopulation.agent.ts`

**Called by:** `POST /api/dispatch/suggest-courier` (on-demand)  
**Max tokens:** 200

Suggests a courier or driver based on the last 5 dispatches to the same account. **Always requires human confirmation** — the suggestion is displayed in the UI for the EQC operator to accept or override. The agent never auto-fills form data.

```typescript
interface DispatchPopulationInput {
  account: AccountSummary
  recentDispatches: Array<{
    courier: string
    driver: string
    date: Date
    deliveryTime: number  // hours from dispatch to DELIVERED
  }>
}

interface DispatchPopulationOutput {
  suggestedCourier: string | null
  suggestedDriver: string | null
  confidence: 'HIGH' | 'MEDIUM' | 'LOW'
  reasoning: string  // 1 sentence explaining the suggestion
  requiresConfirmation: true  // always true — immutable rule
}
```

**System prompt:**
```
You are an assistant helping EQC operators select a courier for a medical device dispatch.
Based on recent dispatch history to this account, suggest the most appropriate courier and driver.
Consider delivery time performance. Always state this is a suggestion requiring human confirmation.
```

---

## Agent Implementation Pattern

All agents follow the same structure:

```typescript
import { complete } from '@services/openai.service'
import { logger } from '@utils/logger'

export const runAgent = async (input: AgentInput): Promise<AgentOutput> => {
  const systemPrompt = buildSystemPrompt()
  const userPrompt = buildUserPrompt(input)
  
  try {
    const rawResponse = await complete(systemPrompt, userPrompt, MAX_TOKENS)
    return parseResponse(rawResponse)
  } catch (err) {
    logger.error(`[AgentName] Failed`, { error: err.message, input })
    throw err  // Let the BullMQ processor handle retry
  }
}
```

**Error handling:** Agents throw on failure — the BullMQ processor's retry logic handles transient failures. On final failure, the processor continues without the AI enhancement (posts a generic Teams alert instead).

---

## Cost Management

| Agent | Frequency | Est. Calls/Day | Max Tokens |
|-------|-----------|----------------|-----------|
| `overdueClassifier` | Per overdue deployment, 4× daily | 10–40 | 300 |
| `kpiForecast` | Once daily | 1 | 500 |
| `receiptMonitor` | Once daily | 1 | 400 |
| `anomalyDetection` | Once weekly | ~0.14/day | 600 |
| `auditNarration` | On demand | Variable | 800 |
| `dispatchPopulation` | On demand | Variable | 200 |

GPT-4o mini is chosen for cost optimization — it handles all these tasks at ~10× lower cost than GPT-4o.

---

*Back to [CLAUDE.md](../CLAUDE.md)*
