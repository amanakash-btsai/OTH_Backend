// ─────────────────────────────────────────────────────────────────────────────
// FILE: middleware/auth.middleware.ts
// The "bouncer" for every protected API route. Before any request reaches a
// route handler, this middleware checks: "does this request carry a valid JWT?"
// If yes, it stamps the user's identity onto `req.user` so route handlers can
// see WHO is making the request. If no, it rejects with a 401 error.
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import jwt, { TokenExpiredError } from 'jsonwebtoken';
import { config } from '@config/index';
import { AppError } from '@utils/errors';
import { asyncHandler } from './asyncHandler';
import { UserRole } from '@app-types/enums';

// The shape of data we expect to find inside the JWT once decoded.
// `sub` (subject) is the user's ID. `role` controls what they're allowed to do.
interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  azureAdObjectId?: string;
}

// authenticate: runs before any protected route handler.
// Step 1 — Check the Authorization header looks like "Bearer <token>".
// Step 2 — Extract the token string after "Bearer ".
// Step 3 — Verify the token's signature using our JWT_SECRET.
//           If tampered with or from a different server, verification fails.
// Step 4 — Attach decoded user info to req.user so downstream handlers can use it.
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
    // TokenExpiredError means the token was valid once but its 15-min lifetime
    // has passed. The frontend should silently refresh and retry the request.
    if (err instanceof TokenExpiredError) {
      throw AppError.unauthorized('TOKEN_EXPIRED', 'Token has expired');
    }
    throw AppError.unauthorized('INVALID_TOKEN', 'Invalid token');
  }
});
