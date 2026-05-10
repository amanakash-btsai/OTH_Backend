# Dashboards Module

**Location:** `src/modules/dashboards/`  
**Base route:** `/api/dashboard`

---

## Files

| File | Purpose |
|------|---------|
| `dashboard.routes.ts` | Role-gated route registration |
| `dashboard.controller.ts` | HTTP layer |
| `dashboard.service.ts` | 5 role-gated dashboard queries |
| `dashboard.cache.ts` | node-cache wrapper (5-min TTL) |

---

## Routes (`dashboard.routes.ts`)

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| `GET` | `/sales` | SALES, MANAGER, ADMIN | Sales dashboard |
| `GET` | `/service` | EQC, MANAGER, ADMIN | Service dashboard (revenue at risk) |
| `GET` | `/inventory` | EQC, WAREHOUSE, MANAGER, ADMIN | Inventory dashboard |
| `GET` | `/overdue` | EQC, MANAGER, ADMIN | Overdue deployments feed |
| `GET` | `/executive` | MANAGER, ADMIN | Executive KPI trends |

---

## Dashboard Service (`dashboard.service.ts`)

All queries use explicit Prisma `select`/`include` — **never use implicit eager loading** to avoid N+1 queries.

### `getSalesDashboard(userId, role)`
Returns the sales rep's own deployment pipeline (or all deployments for MANAGER/ADMIN).

```typescript
{
  activeDemos: number,            // DEMO type, DELIVERED status
  activeLoaners: number,          // LOANER type, DELIVERED status
  pendingApproval: number,        // PENDING_EQC status
  overdueCount: number,           // end_date < now, status = DELIVERED
  deploymentsByStatus: Record<DeploymentStatus, number>,
  recentDeployments: DeploymentSummary[],  // last 10
}
```

For SALES role: filter by `assigned_eqc_user_id = userId` or created by user.  
For MANAGER/ADMIN: all deployments.

### `getServiceDashboard()`
EQC operational view focused on active workload and revenue at risk.

```typescript
{
  inPreparation: DeploymentSummary[],
  inTransit: DeploymentSummary[],
  overdueReturns: DeploymentSummary[],
  unsignedDocuments: DispatchDocumentSummary[],
  revenueAtRisk: number,          // sum of rental_rate * days_overdue for overdue billable loaners
  alertFailures: AlertFailure[],  // unresolved Teams alert failures
}
```

### `getInventoryDashboard()`
Asset availability and warehouse status.

```typescript
{
  totalAssets: number,
  byStatus: Record<AssetStatus, number>,
  byModelCode: Array<{ model_code: string; available: number; total: number; threshold: number; belowThreshold: boolean }>,
  assetsNeedingService: Asset[],  // IN_REPAIR or QUARANTINE
  utilizationRate: number,        // (DEMO + LOANER) / total * 100
}
```

### `getOverdueFeed()`
List of all overdue deployments with severity classification.

```typescript
{
  overdue: Array<{
    deployment: DeploymentSummary,
    daysOverdue: number,
    severity: 'MEDIUM' | 'HIGH' | 'CRIT' | 'URGENT',
    lastAlertSent: Date | null,
  }>
}
```

Severity classification:
- 1–3 days → MEDIUM
- 4–7 days → HIGH
- 8–14 days → CRIT
- >14 days → URGENT

### `getExecutiveDashboard()`
KPI trends for management. Uses 90-day window.

```typescript
{
  kpiTrends: {
    deploymentsThisMonth: number,
    deploymentsLastMonth: number,
    revenueThisMonth: number,
    revenueLastMonth: number,
    overdueRate: number,          // %
    avgDeploymentDuration: number, // days
    inspectionPassRate: number,    // %
  },
  topAccounts: Array<{ account: Account; deploymentCount: number; revenue: number }>,
  assetUtilization90d: number,
}
```

---

## Dashboard Cache (`dashboard.cache.ts`)

Uses `node-cache` with a 5-minute TTL to avoid hitting the database on every request.

```typescript
import NodeCache from 'node-cache'

const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 })

export const getCached = async <T>(key: string, fetcher: () => Promise<T>): Promise<T> => {
  const cached = cache.get<T>(key)
  if (cached !== undefined) return cached
  const fresh = await fetcher()
  cache.set(key, fresh)
  return fresh
}

export const invalidateDashboardCache = (keys?: string[]) => {
  if (keys) keys.forEach(k => cache.del(k))
  else cache.flushAll()
}
```

**Cache key pattern:** `dashboard:{type}:{userId}` (e.g., `dashboard:sales:uuid-123`)

**Cache invalidation:** Called from `deployment.service` and `asset.service` whenever a status changes. Only the affected dashboard types need to be invalidated.

```typescript
// In deployment.service.transitionStatus():
invalidateDashboardCache(['dashboard:sales', 'dashboard:service', 'dashboard:executive'])
```

---

## Performance Notes

- All dashboard queries must complete in < 500ms (p95)
- Use Prisma `groupBy()` for count aggregations — avoid loading full record sets and counting in JS
- Revenue at risk: calculate in SQL (`SUM(rental_rate * DATEDIFF(day, end_date, GETDATE()))`) not in application code
- Always filter by `isActive = true` on User joins

---

*Back to [CLAUDE.md](../CLAUDE.md)*
