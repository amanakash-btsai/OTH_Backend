// ─────────────────────────────────────────────────────────────────────────────
// FILE: routes/index.ts
// The master router — the "switchboard" that wires every URL prefix to its
// module router. Think of it as a table of contents for all API endpoints.
//
// Important ordering:
//   1. /health    — no auth needed (Azure load balancer pings this)
//   2. /auth      — no auth needed (login/register happen here)
//   3. /webhooks  — uses its own Teams bot JWT, not our JWT
//   4. authenticate middleware — EVERY route after this line requires a valid JWT
//   5. apiRateLimiter — caps requests per user
//   6. Module routers — the actual business logic
// ─────────────────────────────────────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import { prisma } from '@config/database';
import authRouter from '@modules/auth/auth.routes';
import assetRouter from '@modules/assets/asset.routes';
import salesRequestRouter from '@modules/salesRequests/salesRequest.routes';
import accountRouter from '@modules/accounts/account.routes';
import webhookRouter from '@modules/webhooks/webhook.routes';
import deploymentRouter from '@modules/deployments/deployment.routes';
import bomRouter from '@modules/bom/bom.routes';
import dispatchRouter from '@modules/dispatch/dispatch.routes';
import inspectionRouter from '@modules/inspection/inspection.routes';
import { authenticate } from '@middleware/auth.middleware';
import { apiRateLimiter } from '@middleware/rateLimiter.middleware';

const router = Router();

// Health check (unauthenticated)
// Runs a trivial SQL query. If it fails, the DB is down → return 503 so
// Azure knows the instance is unhealthy and can route traffic away from it.
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

// Webhooks — Teams bot invokes carry their own bot-framework JWT; must be
// before the authenticate middleware so our JWT check doesn't reject them
router.use('/webhooks', webhookRouter);

// All routes below require authentication
router.use(authenticate);
router.use(apiRateLimiter);

// ── Implemented modules ──────────────────────────────────────────────────────
router.use('/assets',        assetRouter);
router.use('/sales-requests', salesRequestRouter);
router.use('/accounts',      accountRouter);

// ── Stub modules — implemented in later sprints ──────────────────────────────
// These routes exist so the frontend can reference them without getting 404.
// They return 501 Not Implemented until the module is built.
const notImplemented = (_req: Request, res: Response): void => {
  res.status(501).json({ success: false, error: { code: 'NOT_IMPLEMENTED', message: 'Module not yet implemented' } });
};

router.use('/deployments', deploymentRouter);
router.use('/repairs',     notImplemented);
router.use('/bom',         bomRouter);
router.use('/dispatch',    dispatchRouter);
router.use('/inspections', inspectionRouter);
router.use('/dashboard',   notImplemented);
router.use('/reports',     notImplemented);
router.use('/users',       notImplemented);
router.use('/audit',       notImplemented);

export default router;
