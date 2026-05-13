import { Request, Response } from 'express';
import { config } from '@config/index';
import * as authService from './auth.service';
import { sendSuccess } from '@utils/response';

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'strict' as const,
  secure: config.NODE_ENV === 'production',
  maxAge: config.REFRESH_TOKEN_EXPIRY * 1000,
  path: '/',
};

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };
  const { accessToken, refreshToken } = await authService.login(email, password);
  res.cookie('refresh_token', refreshToken, COOKIE_OPTIONS);
  sendSuccess(res, { accessToken });
}

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

export async function logout(req: Request, res: Response): Promise<void> {
  const rawRefresh: string | undefined = req.cookies?.refresh_token;
  if (rawRefresh) {
    await authService.logout(rawRefresh);
  }
  res.clearCookie('refresh_token', { path: '/' });
  sendSuccess(res, null);
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await authService.getMe(req.user.id);
  sendSuccess(res, user);
}

export async function ssoExchange(req: Request, res: Response): Promise<void> {
  const { azureAccessToken } = req.body as { azureAccessToken?: string };
  if (!azureAccessToken) {
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Missing azureAccessToken' } });
    return;
  }
  const result = await authService.exchangeAzureToken(azureAccessToken);
  sendSuccess(res, result);
}

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
