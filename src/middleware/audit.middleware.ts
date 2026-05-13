import { Request, Response, NextFunction } from 'express';
import { prisma } from '@config/database';
import { logger } from '@utils/logger';
import { generateId } from '@utils/idGenerator';

export function auditAction(
  entityType: string,
  getEntityId: (req: Request) => string | undefined,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.on('finish', () => {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user?.id) {
        const entityId = getEntityId(req);
        if (!entityId) return;
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
