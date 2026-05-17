// ─────────────────────────────────────────────────────────────────────────────
// FILE: modules/accounts/account.routes.ts
// Route definitions for the /api/accounts resource (hospitals / customers).
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import * as accountController from './account.controller';

const router = Router();

// GET /api/accounts         — list accounts (search by name or area)
// GET /api/accounts/:id     — get single account detail
router.get('/',    accountController.listAccounts);
router.get('/:id', accountController.getAccount);

export default router;
