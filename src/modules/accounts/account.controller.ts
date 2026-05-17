// ─────────────────────────────────────────────────────────────────────────────
// FILE: modules/accounts/account.controller.ts
// HTTP layer for the accounts (customers) module.
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response } from 'express';
import { asyncHandler } from '@middleware/asyncHandler';
import { sendSuccess } from '@utils/response';
import { AppError } from '@utils/errors';
import * as accountService from './account.service';

// GET /api/accounts?search=hospital&area=CENTRAL
// Returns up to 50 matching accounts for the create-request form's account dropdown.
export const listAccounts = asyncHandler(async (req: Request, res: Response) => {
  const { search, area } = req.query as Record<string, string>;
  const accounts = await accountService.findAccounts({ search, area });
  sendSuccess(res, accounts);
});

// GET /api/accounts/:id — get one account's detail.
// The service returns null if not found, so we throw 404 here.
export const getAccount = asyncHandler(async (req: Request, res: Response) => {
  const account = await accountService.findAccount(req.params.id);
  if (!account) throw AppError.notFound('ACCOUNT_NOT_FOUND', 'Account not found');
  sendSuccess(res, account);
});
