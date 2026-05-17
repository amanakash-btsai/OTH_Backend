import { Router } from 'express';
import * as controller from './deployment.controller';

const router = Router();

// GET  /api/deployments            — list deployments
// PATCH /api/deployments/:id/approve — EQC Manager approves (Waiting_Reservation → Preparing)
// PATCH /api/deployments/:id/status  — update status (e.g. → Returned)
router.get('/',                     controller.listDeployments);
router.patch('/:id/approve',        controller.approveDeployment);
router.patch('/:id/status',         controller.updateDeploymentStatus);

export default router;
