// ─────────────────────────────────────────────────────────────────────────────
// FILE: modules/auth/auth.controller.ts
// Thin HTTP layer for auth. Controllers receive the HTTP request, extract the
// relevant data, call the auth service, and send back the response.
// They do NOT contain business logic — that lives in auth.service.ts.
// ─────────────────────────────────────────────────────────────────────────────

import { Request, Response } from 'express';
import { config } from '@config/index';
import * as authService from './auth.service';
import { sendSuccess } from '@utils/response';

// Cookie settings for the refresh token:
// httpOnly = JavaScript can't read it (prevents XSS token theft)
// sameSite = 'strict' means the cookie only goes to our own domain
// secure = only sent over HTTPS in production
// maxAge = expires after REFRESH_TOKEN_EXPIRY seconds (default 7 days)
const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: config.NODE_ENV === 'production',
  maxAge: config.REFRESH_TOKEN_EXPIRY * 1000,
  path: '/',
};

// POST /auth/login — email/password login.
// On success, set the refresh token as an httpOnly cookie and return
// the short-lived access token in the response body for the frontend to store.
export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };
  const { accessToken, refreshToken } = await authService.login(email, password);
  res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS);
  sendSuccess(res, { accessToken });
}

// POST /auth/refresh — silently get a new access token using the refresh token cookie.
// Called automatically by the axios interceptor when a 401 is received.
export async function refresh(req: Request, res: Response): Promise<void> {
  const rawRefresh: string | undefined = req.cookies?.refresh_token;
  if (!rawRefresh) {
    res.status(401).json({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'No refresh token' },
    });
    return;
  }
  const { accessToken, refreshToken } = await authService.refreshToken(rawRefresh);
  res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS);
  sendSuccess(res, { accessToken });
}

// POST /auth/logout — invalidate the refresh token in the DB and clear the cookie.
// Even if the frontend forgets to call this, the token hash in the DB is gone
// so it can't be used again.
export async function logout(req: Request, res: Response): Promise<void> {
  const rawRefresh: string | undefined = req.cookies?.refresh_token;
  if (rawRefresh) {
    await authService.logout(rawRefresh);
  }
  res.clearCookie('refresh_token', { path: '/' });
  sendSuccess(res, null);
}

// GET /auth/me — return the authenticated user's profile.
// req.user.id was set by the authenticate middleware.
export async function me(req: Request, res: Response): Promise<void> {
  const user = await authService.getMe(req.user.id);
  sendSuccess(res, user);
}

// POST /auth/sso/exchange — main SSO login endpoint.
// The frontend completes the Azure popup and sends the Azure access token here.
// We verify it, upsert the user, and return our own backend access token.
export async function ssoExchange(req: Request, res: Response): Promise<void> {
  const { azureAccessToken } = req.body as { azureAccessToken?: string };
  if (!azureAccessToken) {
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Missing azureAccessToken' } });
    return;
  }
  const result = await authService.exchangeAzureToken(azureAccessToken);
  sendSuccess(res, result);
}

// GET /auth/sso/azure — OAuth redirect callback (alternative to popup flow).
// Azure redirects the browser here with a one-time `code` query parameter.
// We exchange it for tokens, set the cookie, then redirect the browser to the
// frontend with the access token in the URL query string.
export async function ssoAzureCallback(req: Request, res: Response): Promise<void> {
  const code = req.query.code as string | undefined;
  if (!code) {
    res.status(400).json({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'Missing authorization code' },
    });
    return;
  }
  const { accessToken, refreshToken } = await authService.azureCallback(code);
  res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS);
  const redirectUrl = `${config.FRONTEND_ORIGIN}?token=${encodeURIComponent(accessToken)}`;
  res.redirect(redirectUrl);
}
