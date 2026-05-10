# Background Jobs

**Location:** `src/jobs/`

All background processing uses BullMQ with Azure Cache for Redis.

---

## Queue Instances (`src/jobs/queue.ts`)

Six BullMQ queues, all sharing the same Redis connection from `src/config/redis.ts`.

```typescript
import { Queue } from 'bullmq'
import { redisConnection } from '@config/redis'

export const overdueAlertQueue   = new Queue('overdue-alert',    { connection: redisConnection })
export const kpiDigestQueue      = new Queue('kpi-digest',       { connection: redisConnection })
export const receiptMonitorQueue = new Queue('receipt-monitor',  { connection: redisConnection })
export const inventoryAlertQueue = new Queue('inventory-alert',  { connection: redisConnection })
export const reportQueue         = new Queue('report-generation', { connection: redisConnection })
export const emailQueue          = new Queue('email',            { connection: redisConnection })
```

---

## Scheduler (`src/jobs/scheduler.ts`)

Registers cron jobs on application startup. Called from `src/server.ts` after the app is ready.

```typescript
import { overdueAlertQueue, kpiDigestQueue, receiptMonitorQueue, inventoryAlertQueue } from './queue'

export const startScheduler = () => {
  // Overdue alert: every 6 hours
  overdueAlertQueue.add('check-overdue', {}, {
    repeat: { pattern: '0 */6 * * *' },
    jobId: 'overdue-alert-cron',
  })

  // KPI Digest: 07:00 UTC daily
  kpiDigestQueue.add('daily-kpi', {}, {
    repeat: { pattern: '0 7 * * *' },
    jobId: 'kpi-digest-cron',
  })

  // Receipt Monitor: 09:00 UTC daily
  receiptMonitorQueue.add('check-receipts', {}, {
    repeat: { pattern: '0 9 * * *' },
    jobId: 'receipt-monitor-cron',
  })

  // Inventory Alert: 10:00 UTC daily
  inventoryAlertQueue.add('check-inventory', {}, {
    repeat: { pattern: '0 10 * * *' },
    jobId: 'inventory-alert-cron',
  })
}

// For manual admin triggers
export const triggerJobNow = async (queueName: string) => {
  const queue = getQueueByName(queueName)
  await queue.add('manual-trigger', { triggeredAt: new Date().toISOString() })
}
```

---

## Job Processors

### `src/jobs/processors/overdueAlert.processor.ts`

**Schedule:** Every 6 hours  
**Queue:** `overdueAlertQueue`

```
1. Query: DeviceDeployment WHERE status = 'DELIVERED' AND end_date < NOW()
2. For each overdue deployment:
   a. daysOverdue = floor((now - endDate) / 86400000)
   b. Classify severity:
      - 1–3 days → MEDIUM (log only, no Teams)
      - 4–7 days → HIGH
      - 8–14 days → CRIT
      - >14 days → URGENT
   c. Read alert_sent_at + last_alert_severity from deployment
   d. Skip if this severity level was already alerted (avoid duplicates)
   e. For new severity: call overdueClassifier.agent(deployment)
      → receives { severity, suggestedAction, emailDraft }
   f. Call teams.service.postOverdueAlert(deployment, severity, emailDraft)
      → posts to #loaner-overdue or #demo-alerts based on type
   g. Update: deployment.alert_sent_at = now, last_alert_severity = severity
3. Log summary: N deployments checked, M alerts sent
```

### `src/jobs/processors/kpiDigest.processor.ts`

**Schedule:** Daily 07:00 UTC  
**Queue:** `kpiDigestQueue`

```
1. Fetch executive KPI data from dashboardService.getExecutiveDashboard()
2. Call kpiForecast.agent(kpiData) → AI trend narrative (2–3 sentences)
3. Build Adaptive Card with KPI metrics + AI narrative
4. Post to Teams #exec-summary via teams.service.postKpiDigest()
```

### `src/jobs/processors/receiptMonitor.processor.ts`

**Schedule:** Daily 09:00 UTC  
**Queue:** `receiptMonitorQueue`

```
1. Find all DispatchDocuments where status IN ('GENERATED', 'SENT')
   AND createdAt < (NOW() - 3 days)
2. For each unsigned document:
   a. Age 3–7 days → send reminder email to EQC operator
   b. Age > 7 days → send escalation to manager
3. Call receiptMonitor.agent(unsignedDocs) → pattern analysis
   → identifies chronic offenders (accounts/operators with recurring delays)
4. If pattern found: log to Azure Monitor + post summary to #eqc-ops-alerts
```

### `src/jobs/processors/inventoryAlert.processor.ts`

**Schedule:** Daily 10:00 UTC  
**Queue:** `inventoryAlertQueue`

```
1. Fetch all ConfigThreshold records
2. For each threshold (model_code → min_available_count):
   a. Count Asset WHERE model_code = X AND status = 'AVAILABLE'
   b. If count < threshold.min_available_count:
      → Post alert to Teams #inventory-critical
3. Also flag any model with 0 available assets as CRITICAL
```

### `src/jobs/processors/reportGeneration.processor.ts`

**Queue:** `reportQueue` (triggered by scheduleReport or on-demand)

```
1. Receive ReportJobData: { reportType, format, recipientEmail, dateRange }
2. Call reportService.generateReport(type, dateRange, format)
   → returns Buffer
3. Upload to Blob audit-reports container
4. Queue email job: emailQueue.add with report Buffer as attachment
```

### Email Queue Worker

Processes `emailQueue` jobs. Calls the appropriate `emailService` method based on job data. Handles SMTP errors with BullMQ's built-in retry (3 attempts, exponential backoff).

---

## Queue Configuration

| Queue | Concurrency | Attempts | Backoff |
|-------|------------|---------|--------|
| `overdueAlertQueue` | 1 | 3 | exponential 5000ms |
| `kpiDigestQueue` | 1 | 3 | exponential 5000ms |
| `receiptMonitorQueue` | 1 | 2 | fixed 10000ms |
| `inventoryAlertQueue` | 1 | 2 | fixed 5000ms |
| `reportQueue` | 2 | 3 | exponential 2000ms |
| `emailQueue` | 5 | 3 | exponential 1000ms |

---

## Admin Trigger Endpoint

For manual testing and admin intervention:

```
POST /api/admin/agents/{jobName}/trigger
Roles: ADMIN only
```

Calls `triggerJobNow(jobName)` from `scheduler.ts`. Returns 200 when job is queued. In non-production environments, uses mock services (no actual Teams HTTP calls, no real emails).

---

*Back to [CLAUDE.md](../CLAUDE.md)*
