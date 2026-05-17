import { Router } from 'express';
import * as controller from './dispatch.controller';

const router = Router();

// GET  /api/dispatch           — list dispatch documents
// POST /api/dispatch/documents — generate dispatch document (validates packing, returns 409 if blocked)
router.get('/',           controller.listDispatchDocs);
router.post('/documents', controller.generateDispatchDocument);

export default router;
