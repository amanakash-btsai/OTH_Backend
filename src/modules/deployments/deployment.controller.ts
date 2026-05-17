import { Request, Response } from 'express';
import { asyncHandler } from '@middleware/asyncHandler';
import { sendSuccess } from '@utils/response';
import { AppError } from '@utils/errors';

const ALLOWED_ROLES_APPROVE = ['EQC_Manager', 'System_Admin'];
const VALID_STATUSES = ['Preparing', 'Dispatched', 'With_Customer', 'Returned', 'In_Inspection', 'In_Repair'];

// GET /api/deployments — list active deployments (demo data)
export const listDeployments = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, [
    {
      deployment_id: 'dep-001',
      request_number: 'REQ-2026-002',
      asset_name: 'CV-1000-004',
      hospital: 'Northside Medical Centre',
      status: 'Preparing',
      sales_request_status: 'Waiting_Reservation',
      start_date: '2026-05-18',
      expected_return_date: '2026-05-25',
    },
    {
      deployment_id: 'dep-002',
      request_number: 'REQ-2026-007',
      asset_name: 'MAJ-971-007',
      hospital: 'Sunrise Health Center',
      status: 'Dispatched',
      sales_request_status: 'Dispatched',
      start_date: '2026-05-17',
      expected_return_date: '2026-05-24',
    },
    {
      deployment_id: 'dep-003',
      request_number: 'REQ-2026-008',
      asset_name: 'CLV-190-006',
      hospital: 'Pioneer General Hospital',
      status: 'Returned',
      sales_request_status: 'Return_Initiated',
      start_date: '2026-05-10',
      expected_return_date: '2026-05-17',
      actual_return_date: '2026-05-16',
    },
    {
      deployment_id: 'dep-004',
      request_number: 'REQ-2026-011',
      asset_name: 'LMD-100-009',
      hospital: 'Eastbrook Clinic',
      status: 'Preparing',
      sales_request_status: 'Waiting_Reservation',
      start_date: '2026-05-19',
      expected_return_date: '2026-05-26',
    },
    {
      deployment_id: 'dep-005',
      request_number: 'REQ-2026-012',
      asset_name: 'WA4-400-010',
      hospital: 'Valley Medical Group',
      status: 'Preparing',
      sales_request_status: 'Waiting_Reservation',
      start_date: '2026-05-20',
      expected_return_date: '2026-05-27',
    },
  ]);
});

// PATCH /api/deployments/:id/approve
// EQC Manager approves: sales_request Waiting_Reservation → Preparing
export const approveDeployment = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!ALLOWED_ROLES_APPROVE.includes(req.user.role)) {
    throw AppError.forbidden('INSUFFICIENT_PERMISSIONS', 'Only EQC Manager or Admin can approve deployments');
  }
  sendSuccess(res, {
    deployment_id: id,
    status: 'Preparing',
    sales_request_status: 'Preparing',
    approved_by_id: req.user.id,
    approved_at: new Date().toISOString(),
    message: 'Deployment approved. Status transitioned to In Preparation.',
  });
});

// PATCH /api/deployments/:id/status
// Update deployment status (e.g., mark as RETURNED)
export const updateDeploymentStatus = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body as { status?: string };
  if (!status || !VALID_STATUSES.includes(status)) {
    throw AppError.badRequest(
      'INVALID_STATUS',
      `status must be one of: ${VALID_STATUSES.join(', ')}`,
    );
  }
  sendSuccess(res, {
    deployment_id: id,
    status,
    updated_by_id: req.user.id,
    updated_at: new Date().toISOString(),
    message: `Deployment status updated to ${status}.`,
  });
});
