import { Router } from 'express';
import * as controller from './bom.controller';

const router = Router();

// POST /api/bom/snapshots        — freeze a BOM snapshot for a deployment
// POST /api/bom/validate-packing — check all REQUIRED items are packed
router.post('/snapshots',        controller.createSnapshot);
router.post('/validate-packing', controller.validatePacking);

export default router;
