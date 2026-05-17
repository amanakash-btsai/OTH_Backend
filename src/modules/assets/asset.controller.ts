// ─────────────────────────────────────────────────────────────────────────────
// FILE: modules/assets/asset.controller.ts
// HTTP layer for asset endpoints. Parses request data, calls the service,
// and sends back a consistent JSON response.
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response } from 'express';
import { asyncHandler } from '@middleware/asyncHandler';
import { sendSuccess } from '@utils/response';
import { AssetQuerySchema } from './asset.schema';
import * as assetService from './asset.service';

// GET /api/assets — list assets with optional query-string filters.
// AssetQuerySchema.parse coerces query strings to the right types
// (e.g. "true" → true for is_active) and strips unknown params.
export const listAssets = asyncHandler(async (req: Request, res: Response) => {
  const filters = AssetQuerySchema.parse(req.query);
  const assets = await assetService.findAssets(filters);
  sendSuccess(res, assets);
});

// GET /api/assets/:id — fetch a single asset by its UUID.
// The :id part of the URL is available as req.params.id.
export const getAsset = asyncHandler(async (req: Request, res: Response) => {
  const asset = await assetService.findAsset(req.params.id);
  sendSuccess(res, asset);
});
