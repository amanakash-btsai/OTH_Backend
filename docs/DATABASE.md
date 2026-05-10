# Database Schema Reference

**Database:** Azure SQL (SQL Server)  
**ORM:** Prisma (provider: `sqlserver`)  
**Schema file:** `prisma/schema.prisma`  
**Tables:** 17  
**Schema version:** 2.0 | May 2026

---

## All 17 Tables

### users
System users with role, team, and area assignments. Salesforce is master for user data; SFDC user ID links records.

| Field | Type | Notes |
|-------|------|-------|
| `user_id` | UUID (PK) | Auto-generated |
| `name` | VARCHAR(200) | Full name |
| `email` | VARCHAR(200) UNIQUE | Corporate email address |
| `role` | Enum `UserRole` | Sales_Rep \| FSE \| EQC_Operator \| EQC_Manager \| Sales_Manager \| Executive \| System_Admin \| Integration_Service |
| `team` | VARCHAR(100)? | Team assignment |
| `area` | VARCHAR(50)? | CENTRAL \| EAST \| NORTH \| SOUTH \| LAOS |
| `sfdc_user_id` | VARCHAR(20)? | Salesforce user ID — SFDC is master |
| `is_active` | BOOLEAN | Active user flag |

---

### accounts
Hospital organization records. Synced from Salesforce via MuleSoft.

| Field | Type | Notes |
|-------|------|-------|
| `account_id` | UUID (PK) | |
| `account_name` | VARCHAR(200) | Hospital / organization name |
| `address` | TEXT? | Full address |
| `area` | VARCHAR(20)? | CENTRAL \| EAST \| NORTH \| SOUTH \| LAOS |
| `department` | VARCHAR(200)? | Primary department |
| `segmentation` | VARCHAR(100)? | Hospital segmentation group |
| `group_wave` | VARCHAR(100)? | SFDC group/wave classification |
| `created_at` | TIMESTAMP | Record creation timestamp |

---

### assets
Physical equipment units — master record for all lifecycle operations. Migrated from Salesforce Asset.

| Field | Type | Notes |
|-------|------|-------|
| `asset_id` | UUID (PK) | System-generated UUID |
| `asset_name` | VARCHAR(100) | Human-readable name (e.g., CH-S700-XZ-EA) |
| `serial_number` | VARCHAR(50) UNIQUE | Physical serial number |
| `model_code` | VARCHAR(50) | Equipment model code (e.g., GIF-Q158, OTV-S200) |
| `model_name` | VARCHAR(200)? | Full model description |
| `sap_asset_number` | VARCHAR(30)? | SAP ERP asset number for master data sync |
| `sfdc_asset_id` | VARCHAR(20)? | Salesforce Asset record ID (18-char) |
| `status` | Enum `AssetStatus` | See status enum below |
| `demo_loaner_type` | Enum `DemoLoanerType` | Demo_Asset \| Loaner_Asset \| MBA_Asset \| Service_Center \| Rental \| Operating_Lease \| Workshop \| MKTS \| Comprehensive_Contract |
| `warehouse_code` | VARCHAR(50)? | Current warehouse/storage location (e.g., 1.TEC EQC Store) |
| `installation_location` | VARCHAR(200)? | Specific installation location at hospital or store |
| `account_id` | UUID FK → accounts? | Current owning or hosting hospital account |
| `fse_owner_id` | UUID FK → users? | Assigned Field Service Engineer |
| `business_unit` | VARCHAR(30)? | e.g., SE (Surgical Endoscopy), GI (Gastrointestinal) |
| `oth_tier1` | VARCHAR(100)? | Product hierarchy level 1 |
| `oth_tier2` | VARCHAR(100)? | Product hierarchy level 2 |
| `oth_tier3` | VARCHAR(100)? | Product hierarchy level 3 |
| `install_date` | DATE? | Commissioning date |
| `warranty_start` | DATE? | Warranty start date |
| `warranty_end` | DATE? | Warranty end date |
| `invoice_date` | DATE? | Invoice/purchase date |
| `asset_age_group` | Enum `AssetAgeGroup`? | Young \| Mature \| Old |
| `fda_status` | Enum `FDAStatus`? | Not_Enrolled \| Enrolled \| Approved |
| `fda_approved_no` | VARCHAR(50)? | Thailand FDA approval number |
| `service_contract_id` | UUID FK → service_contracts? | Linked service contract |
| `total_repair_count` | INT? | Cumulative number of repair jobs |
| `total_repair_amount_thb` | DECIMAL(12,2)? | Total FOB repair cost in Thai Baht |
| `last_pm_date` | DATE? | Last preventive maintenance date |
| `annual_inspection_status` | Enum `AnnualInspectionStatus`? | 1_Target \| 2_Scheduled \| 3_Completed \| 4_Not_Target |
| `condition_grade` | Enum `ConditionGrade`? | New \| Good \| Needs_Service \| Defective |
| `is_active` | BOOLEAN | Soft delete flag — false = retired/condemned |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**Indexes:** `serial_number`, `status`, `model_code`, `demo_loaner_type`

---

### sales_requests
Core Demo/Loaner request record — system of record replacing Salesforce Demo_Loaner_Request__c. Central entity for the entire request lifecycle.

| Field | Type | Notes |
|-------|------|-------|
| `request_id` | UUID (PK) | System-generated UUID |
| `request_number` | VARCHAR(20) UNIQUE | Auto-number: DR-YYYY-NNNNNN (e.g., DR-2602-106504) |
| `sfdc_request_id` | VARCHAR(20)? | Salesforce Demo_Loaner_Request__c ID — idempotency key |
| `record_type` | Enum `RecordType` | First_Request \| Extension_Request |
| `status` | Enum `SalesRequestStatus` | See status enum below |
| `purpose1` | Enum `Purpose1` | Repair \| Sales \| Marketing \| QARA \| Others |
| `purpose2` | Enum `Purpose2` | Normal_Repair_Loaner \| Q3S_Loaner \| GI3_Loaner \| Service_Contract_Loaner \| Demonstration \| VPP_CPP_Rental \| Operating_Lease \| Workshop |
| `account_id` | UUID FK → accounts | Requesting hospital account |
| `department_category` | VARCHAR(200)? | Hospital department category |
| `department_name` | VARCHAR(200)? | Specific department |
| `customer_address` | TEXT? | Full delivery address |
| `customer_pic_id` | UUID FK → users? | Customer person in charge (Contact) |
| `sales_person_id` | UUID FK → users | Assigned Sales / FSE user |
| `request_date` | DATE | Date request was submitted |
| `start_use_date` | DATE | Requested start date for equipment use |
| `estimate_return_date` | DATE | Requested return date |
| `actual_return_date` | DATE? | Actual return date (set on return) |
| `repair_case_id` | UUID FK → repair_cases? | Linked repair case (for repair-triggered loaners) |
| `parent_request_id` | UUID FK → sales_requests? | For extension requests: links to original request |
| `internal_so_number` | VARCHAR(50)? | SAP sales order reference |
| `pr_number` | VARCHAR(50)? | Purchase request number |
| `event_name` | VARCHAR(200)? | Associated medical event or conference |
| `prospect_name` | VARCHAR(200)? | Prospect account name |
| `pcl_number` | VARCHAR(50)? | Product Code List reference |
| `total_loan_period_days` | INT COMPUTED? | Calculated: actual_return_date - start_use_date |
| `extension_count` | INT DEFAULT 0 | Number of approved extensions for this request |
| `approved_by_id` | UUID FK → users? | User who approved the request |
| `approved_at` | TIMESTAMP? | Approval timestamp |
| `rejection_reason` | TEXT? | Reason if rejected |
| `bom_set_id` | UUID FK → bom_sets? | BOM set used for picking (Demo only) |
| `dispatch_doc_id` | UUID FK → dispatch_documents? | Associated transport document |
| `inspection_record_id` | UUID FK → inspection_records? | Return inspection record |
| `created_by_id` | UUID FK → users | User who created the request |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**Indexes:** `request_number`, `sfdc_request_id`, `status`, `account_id`, `sales_person_id`

---

### request_extensions
Extension records linked to parent sales_request; maintains extension history.

| Field | Type | Notes |
|-------|------|-------|
| `extension_id` | UUID (PK) | |
| `parent_request_id` | UUID FK → sales_requests | Parent sales request |
| `new_return_date` | DATE | Requested new return date |
| `reason_code` | VARCHAR(50) | Extension reason code |
| `reason_text` | TEXT? | Detailed reason for extension |
| `status` | Enum `ExtensionStatus` | Waiting_Approval \| Approved \| Rejected |
| `approved_by_id` | UUID FK → users? | Manager who approved/rejected |
| `created_at` | TIMESTAMP | |

---

### bom_sets
BOM set definitions A–D with model code and version control. Replaces MS Access BOM management.

| Field | Type | Notes |
|-------|------|-------|
| `set_id` | UUID (PK) | |
| `set_name` | VARCHAR(50) UNIQUE | e.g., Set A, Set B, Set C, Set D |
| `model_code` | VARCHAR(50) | Applicable device model code |
| `version` | VARCHAR(10) | Version string (e.g., v1.2) for change tracking |
| `effective_date` | DATE | Date this version became active |
| `expiry_date` | DATE? | Date this version expires (NULL = current) |
| `is_active` | BOOLEAN | Active set flag |
| `description` | TEXT? | Set description and usage notes |
| `created_by_id` | UUID FK → users | User who created/modified the set |
| `created_at` | TIMESTAMP | |

---

### bom_line_items
Individual accessory per BOM set with required/optional/consumable flags. Replaces MS Access component records.

| Field | Type | Notes |
|-------|------|-------|
| `line_id` | UUID (PK) | |
| `set_id` | UUID FK → bom_sets | Parent BOM set |
| `accessory_id` | UUID FK → accessory_master | Accessory master record |
| `sequence_no` | INT? | Display order within the set |
| `quantity_required` | INT | Expected quantity of this accessory |
| `is_required` | BOOLEAN | True = dispatch blocked if missing |
| `is_optional` | BOOLEAN | Optional item — warning only if missing |
| `is_consumable` | BOOLEAN | Single-use consumable — no return expected |
| `storage_location` | VARCHAR(100)? | Warehouse location for picking |

---

### accessory_master
Master catalog of all accessories with codes and device model mapping.

| Field | Type | Notes |
|-------|------|-------|
| `accessory_id` | UUID (PK) | |
| `accessory_code` | VARCHAR(50) UNIQUE | Accessory code (e.g., MAJ-1435) |
| `accessory_name` | VARCHAR(200) | Descriptive name (e.g., Water Supply Tube) |
| `device_model_code` | VARCHAR(50)? | Compatible device model code |
| `is_active` | BOOLEAN | Active in catalog flag |
| `created_at` | TIMESTAMP | |

---

### device_deployments
Active deployment linking asset to a sales_request with dates and status.

| Field | Type | Notes |
|-------|------|-------|
| `deployment_id` | UUID (PK) | |
| `request_id` | UUID FK → sales_requests | Linked sales request |
| `asset_id` | UUID FK → assets | Deployed equipment asset |
| `deployment_type` | Enum `DeploymentType` | Demo \| Loaner \| Rental \| Operating_Lease |
| `status` | Enum `DeploymentStatus` | Preparing \| Dispatched \| With_Customer \| Returned \| In_Inspection \| In_Repair |
| `start_date` | DATE | Actual dispatch date |
| `expected_return_date` | DATE | Expected return date (updated on extension) |
| `actual_return_date` | DATE? | Actual return date |
| `days_outstanding` | INT COMPUTED? | TODAY - expected_return_date (for overdue calc) |
| `condition_on_dispatch` | Enum `ConditionOnDispatch`? | New \| Good \| Needs_Service |
| `condition_on_return` | Enum `ConditionOnReturn`? | Good \| Needs_Cleaning \| Defective \| Missing |
| `is_billable` | BOOLEAN? | Whether rental billing applies |
| `rental_rate_thb` | DECIMAL(10,2)? | Daily rental rate if billable |
| `billing_cycle` | Enum `BillingCycle`? | Daily \| Weekly \| Monthly |
| `responsible_eqc_id` | UUID FK → users? | EQC operator responsible for this deployment |
| `created_at` | TIMESTAMP | |
| `updated_at` | TIMESTAMP | |

**Indexes:** `(status)`, `(start_date, expected_return_date)`, `(asset_id, status)`  
**Filtered index:** `(status, expected_return_date) WHERE status = 'Dispatched'` — optimizes overdue query

---

### dispatch_documents
PDF transport documents with QR code, signature tracking, and printer routing.

| Field | Type | Notes |
|-------|------|-------|
| `doc_id` | UUID (PK) | |
| `deployment_id` | UUID FK → device_deployments | Associated deployment |
| `document_type` | Enum `DocumentType` | First_Request \| Extension \| Item_List \| Return_Receipt |
| `pdf_blob_url` | VARCHAR(500)? | Azure Blob Storage URL for the PDF file |
| `qr_code_value` | VARCHAR(200)? | QR code data (links to deployment record in WebApp) |
| `qr_code_image_url` | VARCHAR(500)? | Blob URL for QR code image |
| `generated_by_id` | UUID FK → users | EQC user who triggered generation |
| `generated_at` | TIMESTAMP | PDF generation timestamp |
| `printer_sent_at` | TIMESTAMP? | Time sent to warehouse printer (email-to-print) |
| `signed_copy_url` | VARCHAR(500)? | Blob URL for uploaded signed copy |
| `signed_by_name` | VARCHAR(100)? | Warehouse staff who signed (free text) |
| `signed_at` | TIMESTAMP? | Signature timestamp |
| `status` | Enum `DispatchDocStatus` | Generated \| Sent_to_Print \| Signed \| Uploaded \| Archived |
| `sap_gi_triggered` | BOOLEAN DEFAULT false | SAP Goods Issue triggered on upload |
| `sap_gi_triggered_at` | TIMESTAMP? | SAP GI trigger timestamp |

**Important:** `pdf_blob_url` and `signed_copy_url` store **full blob URLs** — SAS tokens generated on demand with 1-hour expiry and never stored.

**Indexes:** `(status, generated_at)`, `(deployment_id)`

---

### inspection_records
Return inspection result per deployment with overall condition assessment.

| Field | Type | Notes |
|-------|------|-------|
| `inspection_id` | UUID (PK) | |
| `deployment_id` | UUID FK → device_deployments | Associated deployment |
| `overall_condition` | Enum `ConditionOnReturn`? | Good \| Needs_Cleaning \| Defective \| Missing |
| `notes` | TEXT? | Inspector notes |
| `inspected_by_id` | UUID FK → users | EQC operator who performed inspection |
| `inspected_at` | TIMESTAMP | Inspection completion timestamp |
| `repair_case_id` | UUID FK → repair_cases? | Auto-created repair case if defect found |
| `created_at` | TIMESTAMP | |

---

### inspection_line_items
Per-item inspection result (Pass/Fail/Missing) linked to BOM line item.

| Field | Type | Notes |
|-------|------|-------|
| `item_id` | UUID (PK) | |
| `inspection_id` | UUID FK → inspection_records | Parent inspection record |
| `bom_line_id` | UUID FK → bom_line_items | BOM line item being inspected |
| `result` | Enum `InspectionResult` | Pass \| Fail \| Missing |
| `quantity_actual` | INT? | Actual quantity returned |
| `notes` | TEXT? | Notes on this specific item |
| `inspection_type` | Enum `InspectionType` | DISPATCH \| RETURN |

---

### repair_cases
Repair job record auto-created on inspection fail or damage. Migrated from Salesforce Repair__c.

| Field | Type | Notes |
|-------|------|-------|
| `repair_id` | UUID (PK) | |
| `rs_number` | VARCHAR(30) UNIQUE | Repair case number (e.g., RS-202602-099595) |
| `eas_no` | VARCHAR(20)? | EAS system number |
| `asset_id` | UUID FK → assets | Asset under repair |
| `account_id` | UUID FK → accounts | Hospital where repair is based |
| `sfdc_repair_id` | VARCHAR(20)? | Salesforce Repair__c record ID for sync |
| `status` | Enum `RepairCaseStatus` | Quoted \| IQ_Quoted \| PO_Received \| Parts_Arranged \| Confirmed \| Completed |
| `repair_type` | Enum `RepairType` | Normal_Repair \| Q3S_Repair \| GI_Repair \| Service_Contract |
| `area` | VARCHAR(20)? | CENTRAL \| EAST \| NORTH \| SOUTH \| LAOS |
| `repair_cost_thb` | DECIMAL(12,2)? | Total repair cost in Thai Baht |
| `fse_assigned_id` | UUID FK → users? | Assigned FSE for repair |
| `created_at` | TIMESTAMP | |

---

### event_log
Immutable audit trail for all status transitions across all entities. Append-only — never UPDATE or DELETE rows.

| Field | Type | Notes |
|-------|------|-------|
| `log_id` | UUID (PK) | Primary key — immutable |
| `entity_type` | Enum `EventEntityType` | asset \| sales_request \| deployment \| dispatch_doc \| inspection \| repair_case \| bom_set |
| `entity_id` | UUID | Record ID of the affected entity |
| `event_type` | VARCHAR(100) | STATUS_CHANGE \| FIELD_UPDATE \| APPROVAL \| EXTENSION \| DISPATCH \| RETURN |
| `old_value` | TEXT? | Previous value (JSON for complex changes) |
| `new_value` | TEXT? | New value (JSON for complex changes) |
| `actor_id` | UUID FK → users? | User who caused the event (NULL = system/AI) |
| `actor_type` | Enum `ActorType` | User \| System \| AI_Agent \| Integration |
| `timestamp` | TIMESTAMP | Event timestamp — UTC |
| `narrative` | TEXT | Human-readable: "[User] changed status from X → Y on [Date]" |
| `ip_address` | VARCHAR(50)? | Client IP for security audit |
| `session_id` | VARCHAR(100)? | User session identifier |

**Indexes:** `(entity_type, entity_id)`, `(timestamp DESC)`  
**Rule:** Only `INSERT` operations allowed on this table. Service layer uses `setImmediate` for non-blocking writes.

---

### teams_alert_log
Record of all Teams adaptive card alerts sent with delivery status.

| Field | Type | Notes |
|-------|------|-------|
| `alert_id` | UUID (PK) | |
| `alert_type` | VARCHAR(100) | e.g., OVERDUE, DISPATCH_UNSIGNED, LOW_INVENTORY |
| `channel` | VARCHAR(100) | Teams channel (e.g., #demo-alerts, #eqc-ops-alerts) |
| `payload` | TEXT? | Adaptive card JSON payload |
| `delivery_status` | Enum `AlertDeliveryStatus` | Sent \| Delivered \| Failed \| Retry |
| `message_id` | VARCHAR(100)? | Teams message ID |
| `created_at` | TIMESTAMP | Alert creation timestamp |

---

### service_contracts
Maintenance/warranty contracts per asset. Migrated from Salesforce ServiceContract.

| Field | Type | Notes |
|-------|------|-------|
| `contract_id` | UUID (PK) | |
| `contract_number` | VARCHAR(50) UNIQUE | Contract reference number |
| `asset_id` | UUID FK → assets | Asset covered by this contract |
| `contract_type` | VARCHAR(100) | Maintenance \| Warranty \| Comprehensive |
| `start_date` | DATE | Contract start date |
| `end_date` | DATE | Contract end date |

---

### ai_prediction_log
Overdue forecast and AI agent output history.

| Field | Type | Notes |
|-------|------|-------|
| `prediction_id` | UUID (PK) | |
| `prediction_type` | VARCHAR(100) | OVERDUE_FORECAST \| ANOMALY_DETECTION \| AUDIT_NARRATION |
| `entity_id` | UUID | Referenced entity ID |
| `entity_type` | VARCHAR(50) | Entity type (asset/deployment/request) |
| `prediction_output` | TEXT | AI prediction result / suggested action |
| `confidence_score` | DECIMAL(5,4)? | Confidence score 0.0000–1.0000 |

---

## Enums

```prisma
enum UserRole {
  Sales_Rep
  FSE
  EQC_Operator
  EQC_Manager
  Sales_Manager
  Executive
  System_Admin
  Integration_Service
}

enum AssetStatus {
  Available
  Requested
  Preparing
  BOM_Confirmed
  Dispatched
  In_Transit
  With_Customer
  Return_Initiated
  In_Inspection
  Cleaning
  Under_Repair
  Quarantine
  Extension_Used
  Overdue
  Retired
}

enum DemoLoanerType {
  Demo_Asset
  Loaner_Asset
  MBA_Asset
  Service_Center
  Rental
  Operating_Lease
  Workshop
  MKTS
  Comprehensive_Contract
}

enum AssetAgeGroup {
  Young
  Mature
  Old
}

enum FDAStatus {
  Not_Enrolled
  Enrolled
  Approved
}

enum AnnualInspectionStatus {
  One_Target       // 1_Target
  Two_Scheduled    // 2_Scheduled
  Three_Completed  // 3_Completed
  Four_Not_Target  // 4_Not_Target
}

enum ConditionGrade {
  New
  Good
  Needs_Service
  Defective
}

enum RecordType {
  First_Request
  Extension_Request
}

enum SalesRequestStatus {
  Draft
  Waiting_Approval
  Waiting_Reservation
  Preparing
  BOM_Confirmed
  Ready_for_Dispatch
  Dispatched
  With_Customer
  Return_Initiated
  Request_Complete
  Cancelled
}

enum Purpose1 {
  Repair
  Sales
  Marketing
  QARA
  Others
}

enum Purpose2 {
  Normal_Repair_Loaner
  Q3S_Loaner
  GI3_Loaner
  Service_Contract_Loaner
  Demonstration
  VPP_CPP_Rental
  Operating_Lease
  Workshop
}

enum ExtensionStatus {
  Waiting_Approval
  Approved
  Rejected
}

enum DeploymentType {
  Demo
  Loaner
  Rental
  Operating_Lease
}

enum DeploymentStatus {
  Preparing
  Dispatched
  With_Customer
  Returned
  In_Inspection
  In_Repair
}

enum ConditionOnDispatch {
  New
  Good
  Needs_Service
}

enum ConditionOnReturn {
  Good
  Needs_Cleaning
  Defective
  Missing
}

enum BillingCycle {
  Daily
  Weekly
  Monthly
}

enum DocumentType {
  First_Request
  Extension
  Item_List
  Return_Receipt
}

enum DispatchDocStatus {
  Generated
  Sent_to_Print
  Signed
  Uploaded
  Archived
}

enum InspectionResult {
  Pass
  Fail
  Missing
}

enum InspectionType {
  DISPATCH
  RETURN
}

enum RepairCaseStatus {
  Quoted
  IQ_Quoted
  PO_Received
  Parts_Arranged
  Confirmed
  Completed
}

enum RepairType {
  Normal_Repair
  Q3S_Repair
  GI_Repair
  Service_Contract
}

enum EventEntityType {
  asset
  sales_request
  deployment
  dispatch_doc
  inspection
  repair_case
  bom_set
}

enum ActorType {
  User
  System
  AI_Agent
  Integration
}

enum AlertDeliveryStatus {
  Sent
  Delivered
  Failed
  Retry
}

enum AIPredictionType {
  OVERDUE_FORECAST
  ANOMALY_DETECTION
  AUDIT_NARRATION
}
```

---

## Critical Performance Indexes

Defined in `schema.prisma` using `@@index`:

- **device_deployments:** `(status)`, `(start_date, expected_return_date)`, `(asset_id, status)`
- **assets:** `(serial_number)`, `(status)`, `(model_code)`
- **sales_requests:** `(request_number)`, `(sfdc_request_id)`, `(status)`, `(account_id)`
- **event_log:** `(entity_type, entity_id)`, `(timestamp DESC)`
- **dispatch_documents:** `(status, generated_at)`, `(deployment_id)`
- **Overdue scan:** filtered index on `device_deployments(status, expected_return_date) WHERE status = 'Dispatched'`

---

## Concurrent Booking Prevention

To prevent two simultaneous deployments of the same asset for overlapping dates:

- `deployment.service.create()` wraps the overlap check + insert in `prisma.$transaction()` with **serializable isolation level**
- Within the transaction: query for any active `device_deployment` on the same `asset_id` with date overlap
- If found: throw `AppError.conflict('BOOKING_CONFLICT')`
- Azure SQL handles row-level locking within serializable transactions

```typescript
await prisma.$transaction(async (tx) => {
  const overlap = await tx.deviceDeployment.findFirst({
    where: {
      asset_id: dto.asset_id,
      status: { notIn: ['Returned', 'In_Repair'] },
      AND: [
        { start_date: { lte: dto.expected_return_date } },
        { expected_return_date: { gte: dto.start_date } },
      ],
    },
  })
  if (overlap) throw AppError.conflict('BOOKING_CONFLICT')
  return tx.deviceDeployment.create({ data: dto })
}, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
```

---

## ID Number Formats

| Entity | Format | Example |
|--------|--------|---------|
| Sales Request | DR-YYMM-NNNNNN | DR-2602-106504 |
| Repair Case | RS-YYYYMM-NNNNNN | RS-202602-099595 |

Generated by `idGenerator.ts` utilities.

---

*Back to [CLAUDE.md](../CLAUDE.md)*
