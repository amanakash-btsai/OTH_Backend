// ─────────────────────────────────────────────────────────────────────────────
// FILE: middleware/rateLimiter.middleware.ts
// Rate limiting prevents abuse by capping how many requests a client can make
// in a given time window. Three separate limiters with different caps:
//
//   authRateLimiter    — login endpoint: strict (10/min) to block brute-force
//   apiRateLimiter     — all authenticated routes: moderate (100/min)
//   webhookRateLimiter — Teams/MuleSoft integrations: generous (200/min)
// ─────────────────────────────────────────────────────────────────────────────

import rateLimit from 'express-rate-limit';

// Login is the most sensitive endpoint — if someone tries 1000 passwords per
// minute, this blocks them after 10 attempts. windowMs = 60 seconds.
export const authRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
  standardHeaders: true,
  legacyHeaders: false,
});

// General API cap — normal users won't hit 100 requests/minute, but scrapers
// or runaway frontend loops will.
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
  standardHeaders: true,
  legacyHeaders: false,
});

// Webhook integrations (Teams bot, MuleSoft) can fire many events in bursts,
// so they get a higher cap.
export const webhookRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' } },
  standardHeaders: true,
  legacyHeaders: false,
});
