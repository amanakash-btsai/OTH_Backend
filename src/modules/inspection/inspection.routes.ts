import { Router } from 'express';
import * as controller from './inspection.controller';

const router = Router();

// GET  /api/inspections                          — list inspections
// POST /api/inspections                          — create inspection from returned deployment
// PATCH /api/inspections/:id/items/:componentId  — record result for one component
// POST /api/inspections/:id/complete             — finalise inspection
router.get('/',                              controller.listInspections);
router.post('/',                             controller.createInspection);
router.patch('/:id/items/:componentId',      controller.updateInspectionItem);
router.post('/:id/complete',                 controller.completeInspection);

export default router;
