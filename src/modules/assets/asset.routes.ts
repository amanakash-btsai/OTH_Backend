// ─────────────────────────────────────────────────────────────────────────────
// FILE: modules/assets/asset.routes.ts
// Route definitions for the /api/assets resource.
// All routes here are already behind the authenticate middleware in routes/index.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import * as assetController from './asset.controller';

const router = Router();

// GET /api/assets         — list all assets (with optional filters via query string)
// GET /api/assets/:id     — get a single asset's full detail
router.get('/', assetController.listAssets);
router.get('/:id', assetController.getAsset);

export default router;
