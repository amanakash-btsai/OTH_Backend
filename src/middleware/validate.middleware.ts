// ─────────────────────────────────────────────────────────────────────────────
// FILE: middleware/validate.middleware.ts
// Input validation middleware. Before a route handler runs, this checks that
// the incoming request body matches the expected Zod schema.
//
// If the body is invalid, it throws a 400 error listing exactly which fields
// are wrong — so the frontend can show useful error messages to the user.
//
// As a bonus, Zod strips out any extra fields the client sent (like someone
// injecting a role: 'Admin' field into the body).
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '@utils/errors';

// validate(schema) returns a middleware. Usage:
//   router.post('/login', validate(LoginBodySchema), controller.login)
// This ensures login never even reaches the controller with bad data.
export const validate =
  (schema: ZodSchema) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw AppError.badRequest(
        'VALIDATION_ERROR',
        'Validation failed',
        { fieldErrors: result.error.flatten().fieldErrors } as Record<string, unknown>,
      );
    }
    // Replace req.body with the clean, coerced data from Zod
    // (e.g. string "true" becomes boolean true, extra fields are removed).
    req.body = result.data;
    next();
  };
