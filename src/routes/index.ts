import { Router, Request, Response } from 'express';
import { prisma } from '@config/database';
import { logger } from '@utils/logger';
import authRouter from '@modules/auth/auth.routes';
import { authenticate } from '@middleware/auth.middleware';
import { apiRateLimiter } from '@middleware/rateLimiter.middleware';

const router = Router();

// Health check (unauthenticated)
router.get('/health', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ success: true, data: { status: 'ok', db: 'connected' } });
  } catch {
    res.status(503).json({ success: false, data: { status: 'degraded', db: 'disconnected' } });
  }
});

// Auth routes (no JWT required)
router.use('/auth', authRouter);

// All routes below require authentication
router.use(authenticate);
router.use(apiRateLimiter);

// Module stubs — implemented in later sprints
const notImplemented = (_req: Request, res: Response): void => {
  res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Module not yet implemented' } });
};

router.use('/assets', notImplemented);
router.use('/requests', notImplemented);
router.use('/deployments', notImplemented);
router.use('/repairs', notImplemented);
router.use('/bom', notImplemented);
router.use('/dispatch', notImplemented);
router.use('/inspections', notImplemented);
router.use('/dashboard', notImplemented);
router.use('/reports', notImplemented);
router.use('/accounts', notImplemented);
router.use('/users', notImplemented);
router.use('/audit', notImplemented);
router.use('/webhooks', notImplemented);

export default router;
