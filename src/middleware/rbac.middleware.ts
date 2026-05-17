// ─────────────────────────────────────────────────────────────────────────────
// FILE: middleware/rbac.middleware.ts
// RBAC = Role-Based Access Control. This middleware factory creates a "gate"
// that only lets through users with a specific role.
//
// Usage example: router.delete('/assets/:id', requireRole('EQC_Manager', 'System_Admin'), ...)
// That line means "only EQC Managers and Admins can delete assets."
//
// It always runs AFTER authenticate, so req.user is already populated.
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@app-types/enums';
import { AppError } from '@utils/errors';

// requireRole(...roles) returns a middleware function.
// If the logged-in user's role isn't in the allowed list, throw 403 Forbidden.
// If it is, call next() to pass control to the actual route handler.
export const requireRole =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw AppError.forbidden();
    }
    next();
  };
