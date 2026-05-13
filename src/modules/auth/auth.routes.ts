import { Router } from 'express';
import { asyncHandler } from '@middleware/asyncHandler';
import { validate } from '@middleware/validate.middleware';
import { authenticate } from '@middleware/auth.middleware';
import { authRateLimiter } from '@middleware/rateLimiter.middleware';
import { LoginBodySchema } from './auth.schema';
import * as controller from './auth.controller';

const router = Router();

router.post('/login', authRateLimiter, validate(LoginBodySchema), asyncHandler(controller.login));
router.post('/refresh', asyncHandler(controller.refresh));
router.post('/logout', asyncHandler(controller.logout));
router.get('/me', authenticate, asyncHandler(controller.me));
router.post('/sso/exchange', asyncHandler(controller.ssoExchange));
router.get('/sso/azure', asyncHandler(controller.ssoAzureCallback));

export default router;
