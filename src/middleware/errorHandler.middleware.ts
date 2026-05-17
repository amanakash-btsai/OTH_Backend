// ─────────────────────────────────────────────────────────────────────────────
// FILE: middleware/errorHandler.middleware.ts
// The global "safety net" — catches every error thrown anywhere in the app
// and converts it into a clean, consistent JSON response. Without this, an
// unhandled error would crash the request or return a raw HTML error page.
//
// It recognises three categories of "expected" errors and handles them cleanly,
// then falls back to a generic 500 for anything completely unexpected.
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { AppError } from '@utils/errors';
import { logger } from '@utils/logger';

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // Category 1: AppError — errors we deliberately throw in our own code
  // (e.g. "user not found", "not authorised"). We already know the right
  // HTTP status code and a user-friendly message.
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.errorCode,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Category 2: ZodError — the request body or query params failed schema
  // validation. Return 400 Bad Request and list exactly which fields are wrong.
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: { fieldErrors: err.flatten().fieldErrors },
      },
    });
    return;
  }

  // Category 3: Prisma database errors for known constraint violations.
  // P2002 = unique constraint (e.g. duplicate email). → 409 Conflict.
  // P2025 = record not found during an update/delete. → 404 Not Found.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'A record with this value already exists' },
      });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Record not found' },
      });
      return;
    }
  }

  // Catch-all: something completely unexpected happened. Log the full error
  // for debugging, but only return a vague message to the client (never
  // expose stack traces or internal details in production).
  logger.error({ message: 'Unhandled error', error: err, path: req.path, method: req.method });
  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' },
  });
}
