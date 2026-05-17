// ─────────────────────────────────────────────────────────────────────────────
// FILE: modules/salesRequests/salesRequest.routes.ts
// Route definitions for the /api/sales-requests resource.
// All routes are behind the authenticate middleware in routes/index.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import * as controller from './salesRequest.controller';

const router = Router();

// GET  /api/sales-requests          — list (filtered)
// POST /api/sales-requests          — create new request
// GET  /api/sales-requests/:id      — get single request detail
// POST /api/sales-requests/:id/approve — manager approves
// POST /api/sales-requests/:id/reject  — manager rejects
router.get('/',       controller.listSalesRequests);
router.post('/',      controller.createSalesRequest);
router.get('/:id',    controller.getSalesRequest);
router.post('/:id/approve', controller.approveSalesRequest);
router.post('/:id/reject',  controller.rejectSalesRequest);

export default router;
