// ─────────────────────────────────────────────────────────────────────────────
// FILE: middleware/asyncHandler.ts
// A tiny but essential utility. Express route handlers can be async functions,
// but Express itself doesn't know how to catch errors thrown from async code.
//
// Without this wrapper, an `await prisma.user.findUnique()` that throws would
// crash the request silently. With this wrapper, any thrown error is passed to
// next(err), which routes it to the global errorHandler.
//
// Usage: router.get('/me', asyncHandler(async (req, res) => { ... }))
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<unknown>;

// Wraps an async function so any unhandled promise rejection is forwarded to
// Express's error-handling chain (the global errorHandler middleware).
export const asyncHandler =
  (fn: AsyncRequestHandler): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
