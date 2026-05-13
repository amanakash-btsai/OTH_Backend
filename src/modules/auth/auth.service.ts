import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { JwtHeader } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { config } from '@config/index';
import { prisma } from '@config/database';
import { AppError } from '@utils/errors';
import { generateId } from '@utils/idGenerator';
import { UserRole } from '@types/enums';

interface AzureTokenClaims {
  oid: string;
  preferred_username?: string;
  unique_name?: string;
  upn?: string;
  email?: string;
  name?: string;
  roles?: string[];
}

// Maps Azure AD app role values to backend UserRole.
// Unrecognised Azure roles leave the DB role unchanged (for updates)
// or default to Sales_Rep (for new users).
const AZURE_ROLE_MAP: Partial<Record<string, UserRole>> = {
  Admin: 'System_Admin',
  System_Admin: 'System_Admin',
  EQC_Manager: 'EQC_Manager',
  EQC_Operator: 'EQC_Operator',
  Sales_Manager: 'Sales_Manager',
  Sales_Rep: 'Sales_Rep',
  FSE: 'FSE',
  Executive: 'Executive',
};

function mapAzureRole(azureRoles?: string[]): UserRole | null {
  for (const r of azureRoles ?? []) {
    const mapped = AZURE_ROLE_MAP[r];
    if (mapped) return mapped;
  }
  return null;
}

const jwks = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${config.AZURE_AD_TENANT_ID}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxAge: 86_400_000,
  rateLimit: true,
});

function getAzureSigningKey(header: JwtHeader, callback: (err: Error | null, key?: string) => void): void {
  jwks.getSigningKey(header.kid ?? '', (err, key) => {
    callback(err as Error | null, key?.getPublicKey());
  });
}

function verifyAzureAccessToken(token: string): Promise<AzureTokenClaims> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getAzureSigningKey,
      {
        audience: [`api://${config.AZURE_AD_CLIENT_ID}`, config.AZURE_AD_CLIENT_ID],
        issuer: [
          `https://sts.windows.net/${config.AZURE_AD_TENANT_ID}/`,
          `https://login.microsoftonline.com/${config.AZURE_AD_TENANT_ID}/v2.0`,
        ],
      },
      (err, decoded) => {
        if (err) reject(AppError.unauthorized('INVALID_TOKEN', 'Invalid Azure AD token'));
        else resolve(decoded as AzureTokenClaims);
      },
    );
  });
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function signAccessToken(user: {
  user_id: string;
  email: string;
  role: string;
  azure_ad_object_id?: string | null;
}): string {
  return jwt.sign(
    {
      sub: user.user_id,
      email: user.email,
      role: user.role as UserRole,
      azureAdObjectId: user.azure_ad_object_id ?? undefined,
    },
    config.JWT_SECRET,
    { expiresIn: config.JWT_EXPIRY },
  );
}

async function issueTokenPair(user: {
  user_id: string;
  email: string;
  role: string;
  azure_ad_object_id?: string | null;
}): Promise<TokenPair> {
  const accessToken = signAccessToken(user);
  const rawRefresh = crypto.randomBytes(64).toString('hex');
  const refreshHash = sha256(rawRefresh);

  await prisma.user.update({
    where: { user_id: user.user_id },
    data: { refresh_token_hash: refreshHash },
  });

  return { accessToken, refreshToken: rawRefresh };
}

export async function login(email: string, password: string): Promise<TokenPair> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.is_active) {
    throw AppError.unauthorized('UNAUTHORIZED', 'Invalid credentials');
  }
  if (!user.password_hash) {
    throw AppError.unauthorized('UNAUTHORIZED', 'Password login not available for this account');
  }
  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw AppError.unauthorized('UNAUTHORIZED', 'Invalid credentials');
  }
  return issueTokenPair(user);
}

export async function refreshToken(rawRefreshToken: string): Promise<TokenPair> {
  const hash = sha256(rawRefreshToken);
  const user = await prisma.user.findFirst({ where: { refresh_token_hash: hash } });
  if (!user) {
    throw AppError.unauthorized('UNAUTHORIZED', 'Invalid refresh token');
  }
  return issueTokenPair(user);
}

export async function logout(rawRefreshToken: string): Promise<void> {
  const hash = sha256(rawRefreshToken);
  await prisma.user.updateMany({
    where: { refresh_token_hash: hash },
    data: { refresh_token_hash: null },
  });
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { user_id: userId },
    select: {
      user_id: true,
      name: true,
      email: true,
      role: true,
      team: true,
      area: true,
      is_active: true,
      azure_ad_object_id: true,
    },
  });
  if (!user) throw AppError.notFound('NOT_FOUND', 'User not found');
  return user;
}

export async function exchangeAzureToken(azureAccessToken: string): Promise<{ accessToken: string }> {
  const claims = await verifyAzureAccessToken(azureAccessToken);

  const email = claims.preferred_username ?? claims.unique_name ?? claims.upn ?? claims.email;
  const name = claims.name ?? email ?? 'Unknown User';
  const oid = claims.oid;

  if (!email || !oid) {
    throw AppError.unauthorized('INVALID_TOKEN', 'Token missing required identity claims');
  }

  const mappedRole = mapAzureRole(claims.roles);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      azure_ad_object_id: oid,
      // Only sync role from Azure when it maps to a recognised backend role;
      // otherwise preserve whatever was manually set in the DB.
      ...(mappedRole ? { role: mappedRole } : {}),
    },
    create: {
      user_id: generateId(),
      name,
      email,
      role: mappedRole ?? 'Sales_Rep',
      is_active: true,
      azure_ad_object_id: oid,
    },
  });

  if (!user.is_active) {
    throw AppError.unauthorized('UNAUTHORIZED', 'Account is inactive. Contact your administrator.');
  }

  return { accessToken: signAccessToken(user) };
}

export async function azureCallback(code: string): Promise<TokenPair> {
  const tokenEndpoint = `https://login.microsoftonline.com/${config.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: config.AZURE_AD_CLIENT_ID,
    client_secret: config.AZURE_AD_CLIENT_SECRET,
    code,
    grant_type: 'authorization_code',
    redirect_uri: config.AZURE_AD_REDIRECT_URI,
    scope: 'openid email profile',
  });

  const tokenRes = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!tokenRes.ok) {
    throw AppError.unauthorized('SSO_FAILED', 'Azure AD token exchange failed');
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };

  const graphRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!graphRes.ok) {
    throw AppError.unauthorized('SSO_FAILED', 'Failed to fetch Azure AD user profile');
  }

  const profile = (await graphRes.json()) as { id: string; displayName: string; mail: string };

  const user = await prisma.user.upsert({
    where: { email: profile.mail },
    update: { name: profile.displayName, azure_ad_object_id: profile.id },
    create: {
      user_id: generateId(),
      name: profile.displayName,
      email: profile.mail,
      role: 'Sales_Rep',
      is_active: true,
      azure_ad_object_id: profile.id,
    },
  });

  return issueTokenPair(user);
}
