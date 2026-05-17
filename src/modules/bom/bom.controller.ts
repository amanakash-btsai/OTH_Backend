import { Request, Response } from 'express';
import { asyncHandler } from '@middleware/asyncHandler';
import { sendSuccess } from '@utils/response';
import { AppError } from '@utils/errors';

// Demo BOM component definitions (keyed by model code prefix)
const DEMO_COMPONENTS = [
  { component_id: 'comp-001', name: 'Main Scope Unit',     item_type: 'REQUIRED',   quantity: 1 },
  { component_id: 'comp-002', name: 'Light Source Cable',  item_type: 'REQUIRED',   quantity: 1 },
  { component_id: 'comp-003', name: 'Cleaning Brush Kit',  item_type: 'REQUIRED',   quantity: 1 },
  { component_id: 'comp-004', name: 'Carrying Case',       item_type: 'OPTIONAL',   quantity: 1 },
  { component_id: 'comp-005', name: 'Biopsy Channel Caps', item_type: 'CONSUMABLE', quantity: 5 },
  { component_id: 'comp-006', name: 'Water Bottle',        item_type: 'CONSUMABLE', quantity: 1 },
];

const REQUIRED_IDS = DEMO_COMPONENTS
  .filter(c => c.item_type === 'REQUIRED')
  .map(c => c.component_id);

// POST /api/bom/snapshots — create frozen BOM snapshot for a deployment
export const createSnapshot = asyncHandler(async (req: Request, res: Response) => {
  const { deploymentId, modelCode } = req.body as { deploymentId?: string; modelCode?: string };
  if (!deploymentId) {
    throw AppError.badRequest('MISSING_FIELDS', 'deploymentId is required');
  }
  const snapshotId = `snap-${Date.now()}`;
  sendSuccess(res, {
    snapshot_id: snapshotId,
    deployment_id: deploymentId,
    model_code: modelCode ?? 'GENERIC',
    components: DEMO_COMPONENTS,
    frozen_at: new Date().toISOString(),
    created_by_id: req.user.id,
  }, 201);
});

// POST /api/bom/validate-packing — check all REQUIRED items are packed
export const validatePacking = asyncHandler(async (req: Request, res: Response) => {
  const { snapshotId, packedItemIds } = req.body as {
    snapshotId?: string;
    packedItemIds?: string[];
  };
  if (!snapshotId || !packedItemIds) {
    throw AppError.badRequest('MISSING_FIELDS', 'snapshotId and packedItemIds[] are required');
  }
  const missing = REQUIRED_IDS.filter(id => !packedItemIds.includes(id));
  const missingItems = missing.map(id => DEMO_COMPONENTS.find(c => c.component_id === id)!);
  sendSuccess(res, {
    snapshot_id: snapshotId,
    isComplete: missing.length === 0,
    missingItems,
    packedCount: packedItemIds.length,
    requiredCount: REQUIRED_IDS.length,
  });
});
