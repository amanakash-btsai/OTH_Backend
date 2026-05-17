// ─────────────────────────────────────────────────────────────────────────────
// FILE: modules/salesRequests/salesRequest.controller.ts
// HTTP layer for sales request endpoints. One controller function per HTTP route.
// Validates input, calls the service, sends the response, and fires Microsoft
// Teams notifications (fire-and-forget — if they fail, the API still succeeds).
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response } from 'express';
import { asyncHandler } from '@middleware/asyncHandler';
import { sendSuccess } from '@utils/response';
import { logger } from '@utils/logger';
import {
  CreateSalesRequestSchema,
  RejectRequestSchema,
  SalesRequestFiltersSchema,
} from './salesRequest.schema';
import * as service from './salesRequest.service';
import {
  notifyManagerOfNewRequest,
  notifyEqcTeamOfApproval,
  type RequestForNotification,
} from '@services/teams.service';

// GET /api/sales-requests — list requests, optionally filtered by status/owner/account.
export const listSalesRequests = asyncHandler(async (req: Request, res: Response) => {
  const filters = SalesRequestFiltersSchema.parse(req.query);
  const requests = await service.findSalesRequests(filters);
  sendSuccess(res, requests);
});

// GET /api/sales-requests/:id — get full detail of one request (including assets).
export const getSalesRequest = asyncHandler(async (req: Request, res: Response) => {
  const request = await service.findSalesRequest(req.params.id);
  sendSuccess(res, request);
});

// POST /api/sales-requests — create a new request.
// Returns 201 (Created) and fires a Teams notification to the Sales Manager.
// The Teams notification uses .catch() so a Teams failure doesn't roll back the request.
export const createSalesRequest = asyncHandler(async (req: Request, res: Response) => {
  const body = CreateSalesRequestSchema.parse(req.body);
  const request = await service.createSalesRequest(body, req.user.id);
  sendSuccess(res, request, 201);

  // Use the sales rep's email (not necessarily the creator's) for the manager lookup
  const salesPersonEmail = (request as unknown as { sales_person?: { email: string } })?.sales_person?.email ?? req.user.email;
  console.log('[SalesRequest] createSalesRequest → firing Teams notification');
  console.log('[SalesRequest]   request_number:', (request as unknown as { request_number: string })?.request_number);
  console.log('[SalesRequest]   salesPersonEmail:', salesPersonEmail);
  console.log('[SalesRequest]   creator email (req.user.email):', req.user.email);
  // Fire-and-forget: send a Teams message to the manager. Failure is logged but doesn't affect the API response.
  notifyManagerOfNewRequest(request as unknown as RequestForNotification, salesPersonEmail)
    .catch(err => {
      console.error('[SalesRequest] ❌ Teams notification FAILED:', (err as Error).message);
      logger.error({ message: 'Teams notification failed after request creation', error: (err as Error).message });
    });
});

// POST /api/sales-requests/:id/approve — manager approves the request.
// Sends a Teams notification to the EQC team so they know to prepare the equipment.
export const approveSalesRequest = asyncHandler(async (req: Request, res: Response) => {
  const request = await service.approveSalesRequest(req.params.id, req.user.id);
  sendSuccess(res, request);

  const approverName = (request as unknown as { approved_by?: { name: string } })?.approved_by?.name ?? req.user.email;
  console.log('[SalesRequest] approveSalesRequest → firing EQC Teams notification');
  console.log('[SalesRequest]   approverName:', approverName);
  notifyEqcTeamOfApproval(request as unknown as RequestForNotification, approverName)
    .catch(err => {
      console.error('[SalesRequest] ❌ EQC Teams notification FAILED:', (err as Error).message);
      logger.error({ message: 'Teams EQC notification failed', error: (err as Error).message });
    });
});

// POST /api/sales-requests/:id/reject — manager rejects the request with a reason.
export const rejectSalesRequest = asyncHandler(async (req: Request, res: Response) => {
  const body = RejectRequestSchema.parse(req.body);
  const request = await service.rejectSalesRequest(req.params.id, body.rejection_reason);
  sendSuccess(res, request);
});
