// ─────────────────────────────────────────────────────────────────────────────
// FILE: modules/auth/auth.routes.ts
// Maps HTTP method + path to the correct controller function for auth.
// Also stacks middleware — rate limiter and validator run BEFORE the controller.
//
// All routes here are PUBLIC (no authenticate middleware) except /me.
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { asyncHandler } from '@middleware/asyncHandler';
import { validate } from '@middleware/validate.middleware';
import { authenticate } from '@middleware/auth.middleware';
import { authRateLimiter } from '@middleware/rateLimiter.middleware';
import { LoginBodySchema } from './auth.schema';
import * as controller from './auth.controller';

const router = Router();

// POST /api/auth/login
// authRateLimiter: max 10 attempts/min (brute force protection)
// validate(LoginBodySchema): reject requests missing email/password before even hitting the DB
router.post('/login', authRateLimiter, validate(LoginBodySchema), asyncHandler(controller.login));

// POST /api/auth/refresh — exchange a refresh token cookie for a new access token
router.post('/refresh', asyncHandler(controller.refresh));

// POST /api/auth/logout — invalidate session
router.post('/logout', asyncHandler(controller.logout));

// GET /api/auth/me — get current user profile (requires a valid JWT)
router.get('/me', authenticate, asyncHandler(controller.me));

// POST /api/auth/sso/exchange — main Azure SSO login (frontend sends Azure token)
router.post('/sso/exchange', asyncHandler(controller.ssoExchange));

// GET /api/auth/sso/azure — OAuth redirect callback from Azure (code → token → cookie → redirect)
router.get('/sso/azure', asyncHandler(controller.ssoAzureCallback));

export default router;
