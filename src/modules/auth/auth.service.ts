// ─────────────────────────────────────────────────────────────────────────────
// FILE: modules/auth/auth.service.ts
// All authentication business logic lives here. It handles two login paths:
//
//   Path A — Email/password:  hash comparison with bcrypt, issue JWT pair.
//   Path B — Azure SSO:       verify Azure's JWT, upsert the user in our DB,
//                             issue our own shorter-lived backend JWT.
//
// Key concepts:
//   - "Access token"  — short-lived JWT (15 min) sent in every API request header.
//   - "Refresh token" — long-lived random string (7 days) stored in a cookie;
//                       used to silently get a new access token without re-login.
//   - JWKS            — Azure publishes public keys at a URL; we use them to
//                       verify the signature of tokens Azure issued.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { JwtHeader } from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { config } from '@config/index';
import { prisma } from '@config/database';
import { AppError } from '@utils/errors';
import { generateId } from '@utils/idGenerator';
import { UserRole } from '@app-types/enums';

// The shape of claims we expect inside an Azure AD access token.
// Azure puts the user's object ID in `oid`, their email in `preferred_username`.
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

// Try each Azure role string in order and return the first one that maps to a
// known backend role. Returns null if none match (DB role stays unchanged).
function mapAzureRole(azureRoles?: string[]): UserRole | null {
  for (const r of azureRoles ?? []) {
    const mapped = AZURE_ROLE_MAP[r];
    if (mapped) return mapped;
  }
  return null;
}

// JWKS client: fetches Azure's public signing keys from the well-known URL.
// `cache: true` means we download the keys once and reuse them (they rarely
// change). This avoids an HTTP call on every single login request.
const jwks = jwksClient({
  jwksUri: `https://login.microsoftonline.com/${config.AZURE_AD_TENANT_ID}/discovery/v2.0/keys`,
  cache: true,
  cacheMaxAge: 86_400_000,  // Cache keys for 24 hours (in milliseconds)
  rateLimit: true,
});

// getAzureSigningKey: called by jwt.verify to get the public key for the
// specific key ID (`kid`) embedded in the Azure token's header.
function getAzureSigningKey(header: JwtHeader, callback: (err: Error | null, key?: string) => void): void {
  jwks.getSigningKey(header.kid ?? '', (err, key) => {
    callback(err as Error | null, key?.getPublicKey());
  });
}

// verifyAzureAccessToken: uses Azure's public key to verify the token's
// cryptographic signature AND checks it's for our app (audience) and tenant (issuer).
// This prevents someone from using a valid Azure token for a different application.
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

// sha256: one-way hash function. We store the HASH of the refresh token in the
// DB, not the token itself. This way, if the DB is compromised, attackers can't
// use the stored values to impersonate users (same principle as password hashing).
function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

// signAccessToken: creates a short-lived JWT containing the user's ID, email,
// and role. The JWT_SECRET is the key — only our server can produce or verify it.
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
    { expiresIn: config.JWT_EXPIRY },  // Default: 900 seconds (15 minutes)
  );
}

// issueTokenPair: creates both tokens and stores the refresh token hash in DB.
// The raw refresh token is returned to the client (as an httpOnly cookie).
// We only store the hash so we can validate it on refresh without storing a
// recoverable secret.
async function issueTokenPair(user: {
  user_id: string;
  email: string;
  role: string;
  azure_ad_object_id?: string | null;
}): Promise<TokenPair> {
  const accessToken = signAccessToken(user);
  const rawRefresh = crypto.randomBytes(64).toString('hex');  // 64 bytes of randomness
  const refreshHash = sha256(rawRefresh);

  // Store the hash in the users table — this is how we "bind" the refresh token
  // to a specific user and invalidate it on logout.
  await prisma.user.update({
    where: { user_id: user.user_id },
    data: { refresh_token_hash: refreshHash },
  });

  return { accessToken, refreshToken: rawRefresh };
}

// login: Path A — email + password authentication.
// We never store the plain-text password, only the bcrypt hash.
// bcrypt.compare handles the slow hashing comparison (makes brute force expensive).
// We always give the same error whether the user doesn't exist or password is wrong
// to prevent "user enumeration" attacks (attacker can't tell which one failed).
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

// refreshToken: silently exchange an expiring access token for a new pair.
// The client sends the raw refresh token; we hash it and look it up in the DB.
// If found, issue a brand-new token pair (rotating the refresh token too).
export async function refreshToken(rawRefreshToken: string): Promise<TokenPair> {
  const hash = sha256(rawRefreshToken);
  const user = await prisma.user.findFirst({ where: { refresh_token_hash: hash } });
  if (!user) {
    throw AppError.unauthorized('UNAUTHORIZED', 'Invalid refresh token');
  }
  return issueTokenPair(user);
}

// logout: nullify the refresh token hash in the DB.
// Even if an attacker has the old refresh token cookie, it will no longer match
// any record in the DB, so it can't be used to get new access tokens.
export async function logout(rawRefreshToken: string): Promise<void> {
  const hash = sha256(rawRefreshToken);
  await prisma.user.updateMany({
    where: { refresh_token_hash: hash },
    data: { refresh_token_hash: null },
  });
}

// getMe: return the current user's profile from the DB using the ID
// embedded in the JWT (req.user.id). Called on page load to populate the UI.
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

// exchangeAzureToken: Path B (main login path) — the frontend obtained an Azure
// access token via MSAL popup and sends it here. We verify it with Azure's public
// key, extract the user's identity, and upsert them in our DB.
// "Upsert" = insert if first time, update if returning user.
// Returns only an access token (not a full pair) — the frontend stores it in
// sessionStorage for fast API calls.
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
      role: mappedRole ?? 'Sales_Rep',  // New users default to Sales_Rep until manually promoted
      is_active: true,
      azure_ad_object_id: oid,
    },
  });

  if (!user.is_active) {
    throw AppError.unauthorized('UNAUTHORIZED', 'Account is inactive. Contact your administrator.');
  }

  return { accessToken: signAccessToken(user) };
}

// azureCallback: Path C — the traditional OAuth redirect flow (used for
// non-popup scenarios). Azure calls our redirect_uri with a one-time `code`;
// we exchange it for an access token at Azure's token endpoint, then fetch
// the user profile from Microsoft Graph API, upsert the user, and redirect
// the browser to the frontend with the access token in the URL.
export async function azureCallback(code: string): Promise<TokenPair> {
  const tokenEndpoint = `https://login.microsoftonline.com/${config.AZURE_AD_TENANT_ID}/oauth2/v2.0/token`;

  // Exchange the authorization code for an access token at Azure's token endpoint.
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

  // Use the access token to call Microsoft Graph API and get the user's profile.
  const graphRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!graphRes.ok) {
    throw AppError.unauthorized('SSO_FAILED', 'Failed to fetch Azure AD user profile');
  }

  const profile = (await graphRes.json()) as { id: string; displayName: string; mail: string };

  // Upsert user: create on first login, update display name on subsequent logins.
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
