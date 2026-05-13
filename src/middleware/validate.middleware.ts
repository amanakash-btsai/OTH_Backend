import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { AppError } from '@utils/errors';

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
    req.body = result.data;
    next();
  };
