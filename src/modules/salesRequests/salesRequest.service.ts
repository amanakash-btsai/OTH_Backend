// ─────────────────────────────────────────────────────────────────────────────
// FILE: modules/salesRequests/salesRequest.service.ts
// Business logic for the sales request lifecycle.
//
// A "sales request" is the formal process a Sales Rep follows when they want
// to borrow an Olympus device (loaner) or take one to a customer for a demo.
// The lifecycle is:
//
//   1. Sales Rep creates request (status: Waiting_Approval)
//   2. Sales Manager approves    (status: Waiting_Reservation)
//   3. EQC prepares BOM + dispatch
//   4. Device shipped to customer (status: Dispatched → With_Customer)
//   5. Device returned + inspected (status: Request_Complete)
//
// This file handles: list, get detail, create (with asset linking), approve,
// and reject operations.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@config/database';
import { AppError } from '@utils/errors';
import { generateId } from '@utils/idGenerator';
import type { CreateSalesRequestBody, SalesRequestFilters } from './salesRequest.schema';

// WITH_RELATIONS: the set of related DB tables to JOIN into every query.
// Reused across all service functions so we always return consistent data.
// Equivalent to SQL: JOIN accounts, users (salesperson), users (approver), deployments → assets
const WITH_RELATIONS = {
  account: { select: { account_id: true, account_name: true } },
  sales_person: { select: { user_id: true, name: true, email: true } },
  approved_by: { select: { user_id: true, name: true } },
  deployments: {
    include: {
      asset: {
        select: {
          asset_id: true,
          asset_name: true,
          serial_number: true,
          model_code: true,
          model_name: true,
        },
      },
    },
  },
};

// generateRequestNumber: creates a human-readable request ID like "DR-2605-123456".
// DR = Demo/loaner Request, YY = year, MM = month, then 6 random digits.
// Used on receipts and dispatch documents so field staff can reference requests easily.
function generateRequestNumber(): string {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const rand = String(Math.floor(Math.random() * 999999)).padStart(6, '0');
  return `DR-${yy}${mm}-${rand}`;
}

// findSalesRequests: list sales requests with optional filters.
// Supports filtering by a single status OR a comma-separated list of statuses
// (useful for e.g. "show me everything that's in progress").
export async function findSalesRequests(filters: SalesRequestFilters) {
  const where: Record<string, unknown> = {};

  if (filters.status) {
    where.status = filters.status;
  } else if (filters.statuses) {
    // "Waiting_Approval,Preparing" → { status: { in: ['Waiting_Approval', 'Preparing'] } }
    where.status = { in: filters.statuses.split(',').map(s => s.trim()) };
  }
  if (filters.sales_person_id) where.sales_person_id = filters.sales_person_id;
  if (filters.account_id)      where.account_id = filters.account_id;

  return prisma.salesRequest.findMany({
    where,
    include: WITH_RELATIONS,
    orderBy: { created_at: 'desc' },  // Newest first
  });
}

// findSalesRequest: get a single request by its UUID primary key.
// Throws 404 if not found so the controller doesn't have to check.
export async function findSalesRequest(request_id: string) {
  const req = await prisma.salesRequest.findUnique({
    where: { request_id },
    include: WITH_RELATIONS,
  });
  if (!req) throw AppError.notFound('REQUEST_NOT_FOUND', 'Sales request not found');
  return req;
}

// createSalesRequest: creates the request record, then optionally links specific
// assets to it by creating DeviceDeployment records and updating asset statuses.
//
// This is a multi-step DB transaction equivalent:
//   1. Insert sales_request row
//   2. Insert device_deployment rows (one per asset)
//   3. Update asset statuses to 'Requested'
//   4. Re-fetch with full relations for the API response
export async function createSalesRequest(
  body: CreateSalesRequestBody,
  created_by_id: string,
) {
  const { asset_ids, ...fields } = body;

  // Determine if this is a demo (show-and-tell at customer site) or a loaner
  // (customer keeps it during a repair). This sets the deployment type label.
  const deploymentType = fields.purpose2 === 'Demonstration' ? 'Demo' : 'Loaner';

  const request = await prisma.salesRequest.create({
    data: {
      request_id:           generateId(),
      request_number:       generateRequestNumber(),
      status:               'Waiting_Approval',
      extension_count:      0,
      record_type:          fields.record_type,
      purpose1:             fields.purpose1,
      purpose2:             fields.purpose2,
      account_id:           fields.account_id,
      sales_person_id:      fields.sales_person_id,
      created_by_id,
      request_date:         new Date(fields.request_date),
      start_use_date:       new Date(fields.start_use_date),
      estimate_return_date: new Date(fields.estimate_return_date),
      department_category:  fields.department_category,
      department_name:      fields.department_name,
      customer_address:     fields.customer_address,
      customer_pic_id:      fields.customer_pic_id,
      event_name:           fields.event_name,
      prospect_name:        fields.prospect_name,
      pcl_number:           fields.pcl_number,
      parent_request_id:    fields.parent_request_id,
    },
  });

  // Link selected assets via DeviceDeployment records
  if (asset_ids && asset_ids.length > 0) {
    await prisma.deviceDeployment.createMany({
      data: asset_ids.map(asset_id => ({
        deployment_id:        generateId(),
        request_id:           request.request_id,
        asset_id,
        deployment_type:      deploymentType,
        status:               'Preparing',
        start_date:           new Date(fields.start_use_date),
        expected_return_date: new Date(fields.estimate_return_date),
      })),
    });

    // Move assets from Available → Requested
    await prisma.asset.updateMany({
      where: { asset_id: { in: asset_ids } },
      data:  { status: 'Requested' },
    });
  }

  // Re-fetch with full relations for the response
  return prisma.salesRequest.findUnique({
    where:   { request_id: request.request_id },
    include: WITH_RELATIONS,
  });
}

// approveSalesRequest: a Sales Manager approves a pending request.
// Guards: only 'Waiting_Approval' requests can be approved — prevents double-approvals.
// Side effect: move all linked assets from 'Requested' → 'Preparing' so the
// EQC team knows to start getting the equipment ready.
export async function approveSalesRequest(request_id: string, approved_by_id: string) {
  const req = await prisma.salesRequest.findUnique({ where: { request_id } });
  if (!req) throw AppError.notFound('REQUEST_NOT_FOUND', 'Sales request not found');
  if (req.status !== 'Waiting_Approval') {
    throw AppError.badRequest('INVALID_STATUS', 'Only Waiting_Approval requests can be approved');
  }

  // Advance linked assets to Preparing status
  const deployments = await prisma.deviceDeployment.findMany({ where: { request_id } });
  if (deployments.length > 0) {
    await prisma.asset.updateMany({
      where: { asset_id: { in: deployments.map(d => d.asset_id) } },
      data:  { status: 'Preparing' },
    });
  }

  return prisma.salesRequest.update({
    where: { request_id },
    data:  {
      status:        'Waiting_Reservation',
      approved_by_id,
      approved_at:   new Date(),
    },
    include: WITH_RELATIONS,
  });
}

// rejectSalesRequest: a Sales Manager rejects a pending request.
// Side effect: release all linked assets back to 'Available' so other requests
// can pick them up — without this, the assets would be "stuck" as Requested forever.
export async function rejectSalesRequest(request_id: string, rejection_reason: string) {
  const req = await prisma.salesRequest.findUnique({ where: { request_id } });
  if (!req) throw AppError.notFound('REQUEST_NOT_FOUND', 'Sales request not found');
  if (req.status !== 'Waiting_Approval') {
    throw AppError.badRequest('INVALID_STATUS', 'Only Waiting_Approval requests can be rejected');
  }

  // Release assets back to Available
  const deployments = await prisma.deviceDeployment.findMany({ where: { request_id } });
  if (deployments.length > 0) {
    await prisma.asset.updateMany({
      where: { asset_id: { in: deployments.map(d => d.asset_id) } },
      data:  { status: 'Available' },
    });
  }

  return prisma.salesRequest.update({
    where: { request_id },
    data:  { status: 'Cancelled', rejection_reason },
    include: WITH_RELATIONS,
  });
}
