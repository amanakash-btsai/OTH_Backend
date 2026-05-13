export type UserRole =
  | 'Sales_Rep'
  | 'FSE'
  | 'EQC_Operator'
  | 'EQC_Manager'
  | 'Sales_Manager'
  | 'Executive'
  | 'System_Admin'
  | 'Integration_Service';

export type AssetStatus =
  | 'Available'
  | 'Requested'
  | 'Preparing'
  | 'BOM_Confirmed'
  | 'Dispatched'
  | 'In_Transit'
  | 'With_Customer'
  | 'Return_Initiated'
  | 'In_Inspection'
  | 'Cleaning'
  | 'Under_Repair'
  | 'Quarantine'
  | 'Extension_Used'
  | 'Overdue'
  | 'Retired';

export type DemoLoanerType =
  | 'Demo_Asset'
  | 'Loaner_Asset'
  | 'MBA_Asset'
  | 'Service_Center'
  | 'Rental'
  | 'Operating_Lease'
  | 'Workshop'
  | 'MKTS'
  | 'Comprehensive_Contract';

export type SalesRequestStatus =
  | 'Draft'
  | 'Waiting_Approval'
  | 'Waiting_Reservation'
  | 'Preparing'
  | 'BOM_Confirmed'
  | 'Ready_for_Dispatch'
  | 'Dispatched'
  | 'With_Customer'
  | 'Return_Initiated'
  | 'Request_Complete'
  | 'Cancelled';

export type DeploymentStatus =
  | 'Preparing'
  | 'Dispatched'
  | 'With_Customer'
  | 'Returned'
  | 'In_Inspection'
  | 'In_Repair';

export type DeploymentType = 'Demo' | 'Loaner' | 'Rental' | 'Operating_Lease';

export type DispatchDocStatus =
  | 'Generated'
  | 'Sent_to_Print'
  | 'Signed'
  | 'Uploaded'
  | 'Archived';

export type DocumentType = 'First_Request' | 'Extension' | 'Item_List' | 'Return_Receipt';

export type InspectionType = 'DISPATCH' | 'RETURN';

export type InspectionResult = 'Pass' | 'Fail' | 'Missing';

export type ConditionOnDispatch = 'New' | 'Good' | 'Needs_Service';

export type ConditionOnReturn = 'Good' | 'Needs_Cleaning' | 'Defective' | 'Missing';

export type ConditionGrade = 'New' | 'Good' | 'Needs_Service' | 'Defective';

export type RepairCaseStatus =
  | 'Quoted'
  | 'IQ_Quoted'
  | 'PO_Received'
  | 'Parts_Arranged'
  | 'Confirmed'
  | 'Completed';

export type RepairType = 'Normal_Repair' | 'Q3S_Repair' | 'GI_Repair' | 'Service_Contract';

export type ExtensionStatus = 'Waiting_Approval' | 'Approved' | 'Rejected';

export type ActorType = 'User' | 'System' | 'AI_Agent' | 'Integration';

export type EventEntityType =
  | 'asset'
  | 'sales_request'
  | 'deployment'
  | 'dispatch_doc'
  | 'inspection'
  | 'repair_case'
  | 'bom_set';

export type AIPredictionType =
  | 'OVERDUE_FORECAST'
  | 'ANOMALY_DETECTION'
  | 'AUDIT_NARRATION';

export type AlertDeliveryStatus = 'Sent' | 'Delivered' | 'Failed' | 'Retry';

export type BillingCycle = 'Daily' | 'Weekly' | 'Monthly';

export type AnnualInspectionStatus =
  | '1_Target'
  | '2_Scheduled'
  | '3_Completed'
  | '4_Not_Target';

export type FDAStatus = 'Not_Enrolled' | 'Enrolled' | 'Approved';

export type RecordType = 'First_Request' | 'Extension_Request';

export type Purpose1 = 'Repair' | 'Sales' | 'Marketing' | 'QARA' | 'Others';

export type Purpose2 =
  | 'Normal_Repair_Loaner'
  | 'Q3S_Loaner'
  | 'GI3_Loaner'
  | 'Service_Contract_Loaner'
  | 'Demonstration'
  | 'VPP_CPP_Rental'
  | 'Operating_Lease'
  | 'Workshop';
