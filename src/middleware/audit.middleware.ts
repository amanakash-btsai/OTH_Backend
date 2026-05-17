// ─────────────────────────────────────────────────────────────────────────────
// FILE: middleware/audit.middleware.ts
// Creates an audit trail — every successful state-changing action (POST, PUT,
// PATCH, DELETE that returns 2xx) writes a record to the `event_log` table:
// who did it, what they did, and when.
//
// This is critical for compliance: "who approved this sales request?" or
// "who changed this asset's status?" can always be answered from the audit log.
//
// setImmediate is used so the audit write doesn't delay the HTTP response —
// it fires after the response is sent but before Node picks up the next event.
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import { prisma } from '@config/database';
import { logger } from '@utils/logger';
import { generateId } from '@utils/idGenerator';

// auditAction(entityType, getEntityId) returns a middleware.
// entityType = e.g. 'sales_request', 'asset'
// getEntityId = a function that extracts the relevant ID from the request
//               (e.g. from req.params.id or the created record's ID)
export function auditAction(
  entityType: string,
  getEntityId: (req: Request) => string | undefined,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      // Only log if the action succeeded (2xx) and we know who did it
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user?.id) {
        const entityId = getEntityId(req);
        if (!entityId) return;

        // setImmediate defers the DB write to the next tick — the HTTP response
        // is already sent by this point so the user doesn't wait for the audit write.
        setImmediate(() => {
          prisma.eventLog
            .create({
              data: {
                log_id: generateId(),
                entity_type: entityType,
                entity_id: entityId,
                event_type: `${req.method} ${req.path}`,
                actor_id: req.user.id,
                actor_type: 'User',
                timestamp: new Date(),
                narrative: `${req.method} ${req.path} by ${req.user.email}`,
              },
            })
            .catch((err: unknown) => logger.error({ message: 'Audit write failed', error: err }));
        });
      }
    });
    next();
  };
}
