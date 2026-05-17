// ─────────────────────────────────────────────────────────────────────────────
// FILE: modules/assets/asset.service.ts
// Business logic for querying assets from the database.
//
// An "asset" is a physical piece of Olympus medical equipment (e.g. a
// gastroscope with a serial number). This service lets you:
//   - List assets with optional filters (status, serial number, location, etc.)
//   - Get a single asset by ID, optionally with its active deployments
//
// "include_deployments" adds the active DeviceDeployment records — these tell
// you WHERE an asset currently is (which customer has it, when it's due back).
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@config/database';
import { AppError } from '@utils/errors';
import type { AssetQuery } from './asset.schema';

// findAssets: builds a dynamic SQL WHERE clause from whatever filters the
// client provided, then queries the database.
// `{ contains: ... }` performs a SQL LIKE '%value%' search (partial match).
// Only apply a filter condition if the filter was actually provided in the query.
export async function findAssets(filters: AssetQuery = {}) {
  const where: Record<string, unknown> = {};

  if (filters.status)                where.status = filters.status;
  if (filters.asset_name)            where.asset_name = { contains: filters.asset_name };
  if (filters.serial_number)         where.serial_number = { contains: filters.serial_number };
  if (filters.sap_asset_number)      where.sap_asset_number = { contains: filters.sap_asset_number };
  if (filters.installation_location) where.installation_location = { contains: filters.installation_location };
  if (filters.demo_loaner_type)      where.demo_loaner_type = filters.demo_loaner_type;
  if (filters.warehouse_code)        where.warehouse_code = filters.warehouse_code;
  if (filters.is_active !== undefined) where.is_active = filters.is_active;

  return prisma.asset.findMany({
    where,
    // Optionally JOIN in active deployments (status != 'Returned') so the
    // dashboard calendar can show which assets are currently out with customers.
    include: filters.include_deployments
      ? {
          deployments: {
            where: { status: { not: 'Returned' } },
            select: {
              deployment_id: true,
              start_date: true,
              expected_return_date: true,
              status: true,
              request_id: true,
              // Include the parent request to determine if it belongs to the calling user
              sales_request: {
                select: { sales_person_id: true, status: true },
              },
            },
          },
        }
      : undefined,
    orderBy: { asset_name: 'asc' },
  });
}

// findAsset: fetch a single asset by its primary key, including its active
// deployments so the detail page can show where the equipment currently is.
// Throws 404 if the asset_id doesn't exist.
export async function findAsset(asset_id: string) {
  const asset = await prisma.asset.findUnique({
    where: { asset_id },
    include: {
      deployments: {
        where: { status: { not: 'Returned' } },
        select: {
          deployment_id: true,
          start_date: true,
          expected_return_date: true,
          status: true,
          request_id: true,
          sales_request: {
            select: { sales_person_id: true, status: true },
          },
        },
      },
    },
  });
  if (!asset) throw AppError.notFound('ASSET_NOT_FOUND', 'Asset not found');
  return asset;
}
