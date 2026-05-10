# Types & Utility Helpers

---

## Type Definitions (`src/types/`)

### `src/types/express.d.ts`
Augments the Express `Request` interface to include `req.user` after `auth.middleware` attaches it.

```typescript
declare global {
  namespace Express {
    interface Request {
      user: {
        id: string
        email: string
        role: UserRole  // Sales_Rep | FSE | EQC_Operator | EQC_Manager | Sales_Manager | Executive | System_Admin | Integration_Service
        sfdc_user_id?: string
      }
    }
  }
}
```

This makes `req.user` type-safe throughout all controllers and middleware.

---

### `src/types/enums.ts`
All application enums — mirrors the Prisma schema enums exactly. Import from here in service and middleware files (not from `@prisma/client`) to avoid circular dependencies.

```typescript
export enum UserRole {
  Sales_Rep = 'Sales_Rep',
  FSE = 'FSE',
  EQC_Operator = 'EQC_Operator',
  EQC_Manager = 'EQC_Manager',
  Sales_Manager = 'Sales_Manager',
  Executive = 'Executive',
  System_Admin = 'System_Admin',
  Integration_Service = 'Integration_Service',
}

export enum AssetStatus {
  Available = 'Available',
  Requested = 'Requested',
  Preparing = 'Preparing',
  BOM_Confirmed = 'BOM_Confirmed',
  Dispatched = 'Dispatched',
  In_Transit = 'In_Transit',
  With_Customer = 'With_Customer',
  Return_Initiated = 'Return_Initiated',
  In_Inspection = 'In_Inspection',
  Cleaning = 'Cleaning',
  Under_Repair = 'Under_Repair',
  Quarantine = 'Quarantine',
  Extension_Used = 'Extension_Used',
  Overdue = 'Overdue',
  Retired = 'Retired',
}

export enum DemoLoanerType {
  Demo_Asset = 'Demo_Asset',
  Loaner_Asset = 'Loaner_Asset',
  MBA_Asset = 'MBA_Asset',
  Service_Center = 'Service_Center',
  Rental = 'Rental',
  Operating_Lease = 'Operating_Lease',
  Workshop = 'Workshop',
  MKTS = 'MKTS',
  Comprehensive_Contract = 'Comprehensive_Contract',
}

export enum ConditionGrade {
  New = 'New',
  Good = 'Good',
  Needs_Service = 'Needs_Service',
  Defective = 'Defective',
}

export enum FDAStatus {
  Not_Enrolled = 'Not_Enrolled',
  Enrolled = 'Enrolled',
  Approved = 'Approved',
}

export enum AssetAgeGroup {
  Young = 'Young',
  Mature = 'Mature',
  Old = 'Old',
}

export enum RecordType {
  First_Request = 'First_Request',
  Extension_Request = 'Extension_Request',
}

export enum SalesRequestStatus {
  Draft = 'Draft',
  Waiting_Approval = 'Waiting_Approval',
  Waiting_Reservation = 'Waiting_Reservation',
  Preparing = 'Preparing',
  BOM_Confirmed = 'BOM_Confirmed',
  Ready_for_Dispatch = 'Ready_for_Dispatch',
  Dispatched = 'Dispatched',
  With_Customer = 'With_Customer',
  Return_Initiated = 'Return_Initiated',
  Request_Complete = 'Request_Complete',
  Cancelled = 'Cancelled',
}

export enum Purpose1 {
  Repair = 'Repair',
  Sales = 'Sales',
  Marketing = 'Marketing',
  QARA = 'QARA',
  Others = 'Others',
}

export enum Purpose2 {
  Normal_Repair_Loaner = 'Normal_Repair_Loaner',
  Q3S_Loaner = 'Q3S_Loaner',
  GI3_Loaner = 'GI3_Loaner',
  Service_Contract_Loaner = 'Service_Contract_Loaner',
  Demonstration = 'Demonstration',
  VPP_CPP_Rental = 'VPP_CPP_Rental',
  Operating_Lease = 'Operating_Lease',
  Workshop = 'Workshop',
}

export enum ExtensionStatus {
  Waiting_Approval = 'Waiting_Approval',
  Approved = 'Approved',
  Rejected = 'Rejected',
}

export enum DeploymentType {
  Demo = 'Demo',
  Loaner = 'Loaner',
  Rental = 'Rental',
  Operating_Lease = 'Operating_Lease',
}

export enum DeploymentStatus {
  Preparing = 'Preparing',
  Dispatched = 'Dispatched',
  With_Customer = 'With_Customer',
  Returned = 'Returned',
  In_Inspection = 'In_Inspection',
  In_Repair = 'In_Repair',
}

export enum ConditionOnDispatch {
  New = 'New',
  Good = 'Good',
  Needs_Service = 'Needs_Service',
}

export enum ConditionOnReturn {
  Good = 'Good',
  Needs_Cleaning = 'Needs_Cleaning',
  Defective = 'Defective',
  Missing = 'Missing',
}

export enum BillingCycle {
  Daily = 'Daily',
  Weekly = 'Weekly',
  Monthly = 'Monthly',
}

export enum DocumentType {
  First_Request = 'First_Request',
  Extension = 'Extension',
  Item_List = 'Item_List',
  Return_Receipt = 'Return_Receipt',
}

export enum DispatchDocStatus {
  Generated = 'Generated',
  Sent_to_Print = 'Sent_to_Print',
  Signed = 'Signed',
  Uploaded = 'Uploaded',
  Archived = 'Archived',
}

export enum InspectionResult {
  Pass = 'Pass',
  Fail = 'Fail',
  Missing = 'Missing',
}

export enum InspectionType {
  DISPATCH = 'DISPATCH',
  RETURN = 'RETURN',
}

export enum RepairCaseStatus {
  Quoted = 'Quoted',
  IQ_Quoted = 'IQ_Quoted',
  PO_Received = 'PO_Received',
  Parts_Arranged = 'Parts_Arranged',
  Confirmed = 'Confirmed',
  Completed = 'Completed',
}

export enum RepairType {
  Normal_Repair = 'Normal_Repair',
  Q3S_Repair = 'Q3S_Repair',
  GI_Repair = 'GI_Repair',
  Service_Contract = 'Service_Contract',
}

export enum EventEntityType {
  asset = 'asset',
  sales_request = 'sales_request',
  deployment = 'deployment',
  dispatch_doc = 'dispatch_doc',
  inspection = 'inspection',
  repair_case = 'repair_case',
  bom_set = 'bom_set',
}

export enum ActorType {
  User = 'User',
  System = 'System',
  AI_Agent = 'AI_Agent',
  Integration = 'Integration',
}

export enum AlertDeliveryStatus {
  Sent = 'Sent',
  Delivered = 'Delivered',
  Failed = 'Failed',
  Retry = 'Retry',
}
```

---

### `src/types/api.types.ts`
Standardized response shape interfaces.

```typescript
export interface ApiResponse<T> {
  success: true
  data: T
  meta?: Record<string, unknown>
}

export interface PaginatedResponse<T> {
  success: true
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface ErrorResponse {
  success: false
  error: {
    code: string
    message: string
    details?: unknown
  }
}
```

---

### `src/types/job.types.ts`
BullMQ job payload interfaces — type-safe job data for all queues.

```typescript
export interface OverdueAlertJobData {
  triggeredAt: string  // ISO timestamp
}

export interface KpiDigestJobData {
  date: string  // YYYY-MM-DD
}

export interface ReportJobData {
  reportType: 'DeploymentSummary' | 'LoanerBilling' | 'InspectionDefects' | 'AssetUtilization'
  format: 'xlsx' | 'pdf'
  recipientEmail: string
  dateRange: { from: string; to: string }
}

export interface EmailJobData {
  to: string | string[]
  subject: string
  html: string
  attachments?: Array<{ filename: string; content: Buffer; contentType: string }>
}
```

---

## Utility Helpers (`src/utils/`)

### `src/utils/errors.ts`
`AppError` class with factory methods for all common error types.

```typescript
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    message: string,
    public details?: unknown
  ) { super(message) }

  static notFound(message = 'Resource not found') {
    return new AppError(404, 'NOT_FOUND', message)
  }
  static unauthorized(code: string, message = 'Unauthorized') {
    return new AppError(401, code, message)
  }
  static forbidden(code = 'INSUFFICIENT_PERMISSIONS') {
    return new AppError(403, code, 'Insufficient permissions')
  }
  static conflict(code: string, message = 'Conflict') {
    return new AppError(409, code, message)
  }
  static badRequest(code: string, details?: unknown) {
    return new AppError(400, code, 'Bad request', details)
  }
  static dispatchBlocked(missingItems: MissingItem[]) {
    return new AppError(409, 'DISPATCH_BLOCKED',
      'Cannot dispatch — missing required BOM items',
      { missingItems }
    )
  }
}
```

---

### `src/utils/response.ts`
Helpers to send standardized success responses. Always use these — never `res.json()` directly.

```typescript
export const sendSuccess = <T>(res: Response, data: T, meta?: Record<string, unknown>) => {
  res.json({ success: true, data, ...(meta ? { meta } : {}) })
}

export const sendPaginated = <T>(res: Response, data: T[], total: number, page: number, limit: number) => {
  res.json({
    success: true,
    data,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) }
  })
}
```

---

### `src/utils/pagination.ts`
Parse and build pagination parameters from query strings.

```typescript
export const parsePagination = (query: Record<string, unknown>) => {
  const page = Math.max(1, Number(query.page) || 1)
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20))
  return { skip: (page - 1) * limit, take: limit, page, limit }
}

export const buildPaginationMeta = (total: number, page: number, limit: number) => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
})
```

Default page size: 20. Maximum page size: 100.

---

### `src/utils/dateUtils.ts`
Date helpers used across services and job processors.

```typescript
export const isOverdue = (date: Date): boolean => date < new Date()
export const daysOverdue = (date: Date): number =>
  Math.floor((Date.now() - date.getTime()) / 86_400_000)
export const addDays = (date: Date, n: number): Date =>
  new Date(date.getTime() + n * 86_400_000)
export const formatDateTH = (date: Date): string =>
  date.toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })
export const toUTC = (date: Date): Date => new Date(date.toISOString())
```

---

### `src/utils/idGenerator.ts`
Human-readable ID generation for requests, repair cases, and dispatch documents.

```typescript
import { v4 as uuidv4 } from 'uuid'

let repairSeq = 0
let requestSeq = 0

export const generateRequestNumber = (): string => {
  const now = new Date()
  const yymm = now.toISOString().slice(2, 7).replace('-', '')  // e.g., "2602"
  return `DR-${yymm}-${String(++requestSeq).padStart(6, '0')}`
}

export const generateRepairCaseId = (): string => {
  const now = new Date()
  const yyyymm = now.toISOString().slice(0, 7).replace('-', '')  // e.g., "202602"
  return `RS-${yyyymm}-${String(++repairSeq).padStart(6, '0')}`
}

export const generateDocumentRef = (): string => {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  return `DOC-${date}-${uuidv4().slice(0, 8).toUpperCase()}`
}
```

Format examples:
- Request number: `DR-2602-106504`
- Repair case: `RS-202602-099595`
- Document reference: `DOC-20260509-A1B2C3D4`

---

### `src/utils/logger.ts`
Winston logger — the **only** logging mechanism in the codebase. Never use `console.log`.

```typescript
import winston from 'winston'
import { ApplicationInsightsTransport } from 'winston-azure-application-insights'
import { config } from '@config/index'

export const logger = winston.createLogger({
  level: config.LOG_LEVEL,
  format: config.NODE_ENV === 'production'
    ? winston.format.json()
    : winston.format.combine(winston.format.colorize(), winston.format.simple()),
  transports: [
    new winston.transports.Console(),
    ...(config.NODE_ENV === 'production'
      ? [new ApplicationInsightsTransport({ connectionString: config.AZURE_APP_INSIGHTS_CONNECTION_STRING })]
      : []),
  ],
})
```

Usage:
```typescript
logger.info('Deployment approved', { deploymentId, userId })
logger.error('Teams alert failed', { channel, error: err.message })
logger.warn('Overdue deployment detected', { deploymentId, daysOverdue })
```

---

*Back to [CLAUDE.md](../CLAUDE.md)*
