// ─────────────────────────────────────────────────────────────────────────────
// FILE: modules/assets/asset.schema.ts
// Zod schema for the GET /api/assets query string parameters.
// All filters are optional — if none are provided, all assets are returned.
//
// z.coerce.boolean() converts the string "true" from the URL query string into
// the boolean `true` that Prisma expects. Without coercion, everything in a
// URL query string arrives as a string.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';

export const AssetQuerySchema = z.object({
  status: z.string().optional(),
  asset_name: z.string().optional(),
  serial_number: z.string().optional(),
  sap_asset_number: z.string().optional(),
  installation_location: z.string().optional(),
  demo_loaner_type: z.string().optional(),
  warehouse_code: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
  // When true, each asset includes its active DeviceDeployment records for calendar rendering
  include_deployments: z.coerce.boolean().optional(),
});

export type AssetQuery = z.infer<typeof AssetQuerySchema>;
