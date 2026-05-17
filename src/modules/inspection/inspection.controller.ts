import { Request, Response } from 'express';
import { asyncHandler } from '@middleware/asyncHandler';
import { sendSuccess } from '@utils/response';
import { AppError } from '@utils/errors';

const VALID_RESULTS = ['Pass', 'Fail', 'Missing'];

const DEMO_COMPONENTS = [
  { component_id: 'comp-001', name: 'Main Scope Unit',     item_type: 'REQUIRED' },
  { component_id: 'comp-002', name: 'Light Source Cable',  item_type: 'REQUIRED' },
  { component_id: 'comp-003', name: 'Cleaning Brush Kit',  item_type: 'REQUIRED' },
  { component_id: 'comp-004', name: 'Carrying Case',       item_type: 'OPTIONAL' },
  { component_id: 'comp-005', name: 'Biopsy Channel Caps', item_type: 'CONSUMABLE' },
];

// GET /api/inspections — list inspections (demo data)
export const listInspections = asyncHandler(async (_req: Request, res: Response) => {
  sendSuccess(res, [
    {
      inspection_id: 'insp-001',
      request_number: 'REQ-2026-003',
      asset_name: 'CLV-190-006',
      hospital: 'Pioneer General Hospital',
      status: 'Completed',
      overall_condition: 'Good',
      inspected_at: '2026-05-12T10:00:00Z',
    },
    {
      inspection_id: 'insp-002',
      request_number: 'REQ-2026-004',
      asset_name: 'HX-1-012',
      hospital: 'Eastbrook Clinic',
      status: 'In_Progress',
      overall_condition: null,
      inspected_at: '2026-05-14T15:30:00Z',
    },
    {
      inspection_id: 'insp-003',
      request_number: 'REQ-2026-008',
      asset_name: 'CLV-190-006',
      hospital: 'Northside Medical Centre',
      status: 'Pending',
      overall_condition: null,
      inspected_at: null,
    },
  ]);
});

// POST /api/inspections — create inspection from returned deployment
export const createInspection = asyncHandler(async (req: Request, res: Response) => {
  const { deploymentId } = req.body as { deploymentId?: string };
  if (!deploymentId) {
    throw AppError.badRequest('MISSING_FIELDS', 'deploymentId is required');
  }
  const inspectionId = `insp-${Date.now()}`;
  sendSuccess(res, {
    inspection_id: inspectionId,
    deployment_id: deploymentId,
    status: 'In_Progress',
    components: DEMO_COMPONENTS.map(c => ({ ...c, result: null, condition_note: null })),
    created_at: new Date().toISOString(),
    inspected_by_id: req.user.id,
  }, 201);
});

// PATCH /api/inspections/:id/items/:componentId — record result for one component
export const updateInspectionItem = asyncHandler(async (req: Request, res: Response) => {
  const { id, componentId } = req.params;
  const { result, conditionNote } = req.body as { result?: string; conditionNote?: string };

  if (!result || !VALID_RESULTS.includes(result)) {
    throw AppError.badRequest('INVALID_RESULT', `result must be one of: ${VALID_RESULTS.join(', ')}`);
  }

  let repairCaseId: string | null = null;
  if (result === 'Fail' || result === 'Missing') {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    repairCaseId = `RC-${dateStr}-${Math.floor(Math.random() * 900 + 100)}`;
  }

  sendSuccess(res, {
    inspection_id: id,
    component_id: componentId,
    result,
    condition_note: conditionNote ?? null,
    repair_case_id: repairCaseId,
    updated_at: new Date().toISOString(),
    ...(repairCaseId ? { alert: `Repair case ${repairCaseId} raised. Teams alert posted to #asset-defects.` } : {}),
  });
});

// POST /api/inspections/:id/complete — finalise inspection; set asset/deployment status
export const completeInspection = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  // Demo: treat as all-pass scenario
  sendSuccess(res, {
    inspection_id: id,
    status: 'Completed',
    overall_condition: 'Good',
    asset_status: 'Available',
    deployment_status: 'Completed',
    completed_at: new Date().toISOString(),
    message: 'Inspection completed. All components passed. Asset returned to Available.',
  });
});
