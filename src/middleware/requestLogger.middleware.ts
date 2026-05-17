// ─────────────────────────────────────────────────────────────────────────────
// FILE: middleware/requestLogger.middleware.ts
// Logs every HTTP request that passes through the API — what method (GET/POST),
// which path, the response status code, how long it took, and who made it.
//
// This is essential for debugging ("why did this request fail?") and monitoring
// performance ("which endpoint is slow?"). The 'finish' event fires after the
// response has been fully sent back to the client, so we capture the real time.
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { logger } from '@utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Record the time the request arrived.
  const start = Date.now();

  // 'finish' fires after the response is sent. At that point we know the
  // status code and can calculate the total time the request took.
  res.on('finish', () => {
    logger.info({
      method: req.method,
      path: req.path,
      status: res.statusCode,
      responseTimeMs: Date.now() - start,
      userId: req.user?.id,   // Who made the request (undefined if unauthenticated)
    });
  });

  // Move on to the next middleware without waiting — logging is non-blocking.
  next();
}
