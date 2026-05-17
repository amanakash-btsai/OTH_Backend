// ─────────────────────────────────────────────────────────────────────────────
// FILE: utils/response.ts
// Helper functions to send HTTP responses in a consistent shape.
//
// Every successful API response looks like:
//   { success: true, data: { ... } }
//
// Every paginated response adds:
//   { success: true, data: [...], pagination: { page, pageSize, total } }
//
// Centralising this means if we ever want to change the envelope format, we
// change it in one place and every endpoint updates automatically.
// ─────────────────────────────────────────────────────────────────────────────

import { Response } from 'express';
import { PaginationMeta } from '@app-types/api.types';

// Send a successful single-item or list response.
// statusCode defaults to 200 but can be 201 for "created" responses.
export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({ success: true, data });
}

// Send a paginated list response, including metadata the frontend needs to
// render page controls (current page, page size, total record count).
export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
): void {
  res.status(200).json({ success: true, data, pagination });
}
