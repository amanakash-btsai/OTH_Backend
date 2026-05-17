import { z } from 'zod';

export const CreateSalesRequestSchema = z.object({
  record_type: z.enum(['First_Request', 'Extension_Request']),
  purpose1: z.enum(['Repair', 'Sales', 'Marketing', 'QARA', 'Others']),
  purpose2: z.enum([
    'Normal_Repair_Loaner', 'Q3S_Loaner', 'GI3_Loaner', 'Service_Contract_Loaner',
    'Demonstration', 'VPP_CPP_Rental', 'Operating_Lease', 'Workshop',
  ]),
  account_id: z.string().uuid(),
  sales_person_id: z.string().uuid(),
  request_date: z.string().min(1, 'request_date is required'),
  start_use_date: z.string().min(1, 'start_use_date is required'),
  estimate_return_date: z.string().min(1, 'estimate_return_date is required'),
  department_category: z.string().optional(),
  department_name: z.string().optional(),
  customer_address: z.string().optional(),
  customer_pic_id: z.string().uuid().optional(),
  event_name: z.string().optional(),
  prospect_name: z.string().optional(),
  pcl_number: z.string().optional(),
  parent_request_id: z.string().uuid().optional(),
  // Asset IDs to link to this request via DeviceDeployment
  asset_ids: z.array(z.string().uuid()).optional(),
});

export const RejectRequestSchema = z.object({
  rejection_reason: z.string().min(1, 'rejection_reason is required'),
});

export const SalesRequestFiltersSchema = z.object({
  status: z.string().optional(),
  // Comma-separated list of statuses, e.g. "Waiting_Reservation,Preparing"
  statuses: z.string().optional(),
  sales_person_id: z.string().optional(),
  account_id: z.string().optional(),
});

export type CreateSalesRequestBody = z.infer<typeof CreateSalesRequestSchema>;
export type RejectRequestBody = z.infer<typeof RejectRequestSchema>;
export type SalesRequestFilters = z.infer<typeof SalesRequestFiltersSchema>;
