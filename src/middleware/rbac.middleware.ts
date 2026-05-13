import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@types/enums';
import { AppError } from '@utils/errors';

export const requireRole =
  (...roles: UserRole[]) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw AppError.forbidden();
    }
    next();
  };
