import { Request, Response, NextFunction } from 'express';
import jwt, { TokenExpiredError } from 'jsonwebtoken';
import { config } from '@config/index';
import { AppError } from '@utils/errors';
import { asyncHandler } from './asyncHandler';
import { UserRole } from '@types/enums';

interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  azureAdObjectId?: string;
}

export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw AppError.unauthorized('UNAUTHORIZED', 'Authorization header missing');
  }
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      azureAdObjectId: payload.azureAdObjectId,
    };
    next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      throw AppError.unauthorized('TOKEN_EXPIRED', 'Token has expired');
    }
    throw AppError.unauthorized('INVALID_TOKEN', 'Invalid token');
  }
});
