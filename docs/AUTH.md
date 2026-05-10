# Authentication & Authorization

---

## Overview

The system supports two authentication methods:
1. **Azure AD SSO** — primary method for Olympus corporate users (OAuth2 authorization code flow)
2. **Email + Password** — fallback for accounts without Azure AD, bcrypt 12 rounds

Both methods issue the same JWT access token + refresh token pair after successful authentication.

---

## Files

| File | Purpose |
|------|---------|
| `src/modules/auth/auth.routes.ts` | Route registration |
| `src/modules/auth/auth.controller.ts` | HTTP layer, cookie management |
| `src/modules/auth/auth.service.ts` | Core auth business logic |
| `src/modules/auth/auth.schema.ts` | Zod request validation schemas |

---

## Routes (`auth.routes.ts`)

All routes mounted at `/api/auth`. **No JWT auth middleware** on any of these routes.

| Method | Path | Rate Limit | Description |
|--------|------|-----------|-------------|
| `POST` | `/login` | 10/min | Email + password login |
| `POST` | `/refresh` | — | Exchange refresh token for new access token |
| `POST` | `/logout` | — | Invalidate refresh token |
| `GET` | `/me` | — | Get current user profile (requires auth middleware) |
| `GET` | `/sso/azure` | — | Azure AD OAuth callback endpoint |

---

## Auth Service (`auth.service.ts`)

### `login(email, password)`
1. Find user by email — throw `NOT_FOUND` if not exists or `isActive = false`
2. Compare password with `bcrypt.compare(password, user.passwordHash)` — throw `UNAUTHORIZED` on mismatch
3. Call `issueTokenPair(user)` → return `{ accessToken, refreshToken }`

### `refreshToken(rawRefreshToken)`
1. SHA-256 hash the incoming token
2. Find user where `refreshTokenHash = hash` — throw `UNAUTHORIZED` if not found
3. **Reuse detection:** if the token was already replaced (hash mismatch pattern), call `revokeAllSessions(userId)` — throw `UNAUTHORIZED`
4. Issue new token pair, update `refreshTokenHash` in DB
5. Return new `{ accessToken, refreshToken }`

### `logout(rawRefreshToken)`
1. SHA-256 hash the incoming token
2. Set `refreshTokenHash = null` for the matching user
3. Clear the HttpOnly cookie

### `azureCallback(code)`
1. POST to Azure AD token endpoint: `https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token` — exchange `code` for Azure AD access token
2. GET `https://graph.microsoft.com/v1.0/me` using the Azure AD access token — fetch `id`, `displayName`, `mail`
3. Call `userService.upsertFromAzureAD(azureAdObjectId, { name, email })` — creates user on first login, updates name/email on subsequent logins
4. Call `issueTokenPair(user)` → return token pair

### `issueTokenPair(user)`
1. Sign JWT access token: `jwt.sign({ sub: user.id, email, role, azureAdObjectId }, JWT_SECRET, { expiresIn: JWT_EXPIRY })`
2. Generate cryptographically random refresh token: `crypto.randomBytes(64).toString('hex')`
3. Store `sha256(refreshToken)` in `user.refreshTokenHash`
4. Return `{ accessToken, refreshToken }`

---

## Auth Controller (`auth.controller.ts`)

HTTP layer responsibilities:
- **Sets HttpOnly cookie** on login/refresh: `res.cookie('refresh_token', refreshToken, { httpOnly: true, sameSite: 'strict', secure: true, maxAge: REFRESH_TOKEN_EXPIRY * 1000 })`
- **Returns access token in JSON body** (not in cookie): `{ success: true, data: { accessToken } }`
- **Clears cookie** on logout: `res.clearCookie('refresh_token')`
- Reads refresh token from `req.cookies.refresh_token` on refresh/logout

---

## Auth Schema (`auth.schema.ts`)

```typescript
export const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})
```

---

## JWT Token Structure

**Access Token Payload:**
```json
{
  "sub": "userId (UUID)",
  "email": "user@olympus.th",
  "role": "EQC",
  "azureAdObjectId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "iat": 1234567890,
  "exp": 1234568790
}
```

| Property | Value |
|----------|-------|
| Access token expiry | **15 minutes** (900 seconds) |
| Refresh token expiry | **7 days** (604800 seconds) |
| Signing algorithm | HS256 using `JWT_SECRET` |
| Refresh token storage | SHA-256 hash in `User.refreshTokenHash` — raw value never persisted |
| Refresh token transport | HttpOnly, SameSite=Strict, Secure cookie |
| Access token storage (frontend) | In-memory only — never localStorage or sessionStorage |

---

## Azure AD SSO Flow (Step-by-Step)

1. User clicks "Sign in with Olympus AD" on the frontend
2. Frontend redirects to Azure AD:
   ```
   https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/authorize
     ?client_id={CLIENT_ID}
     &redirect_uri={AZURE_AD_REDIRECT_URI}
     &response_type=code
     &scope=openid email profile
   ```
3. User authenticates with Olympus corporate credentials inside Azure AD
4. Azure AD redirects to `GET /api/auth/sso/azure?code={auth_code}`
5. `auth.service.azureCallback(code)` exchanges the code for tokens
6. Backend fetches user profile from Microsoft Graph API
7. User record upserted via `userService.upsertFromAzureAD()`
8. Token pair issued and returned
9. HttpOnly cookie set with refresh token; access token returned in body
10. Frontend stores access token in memory only
11. All subsequent API calls: `Authorization: Bearer {access_token}`

---

## User Roles & Permissions

| Role | Description | Key Permissions |
|------|-------------|----------------|
| `SALES` | Sales reps & Field Service Engineers | Create demo/loaner requests, view own deployments, check availability, request extensions |
| `EQC` | Equipment Center operators | BOM packing, dispatch document generation, upload signed copies, perform inspections |
| `MANAGER` | EQC Manager or Sales Manager | All EQC permissions + approve/reject requests, approve extensions, view all-team dashboards |
| `FINANCE` | Finance and billing team | View and manage invoices, access billing reports, view financial KPIs |
| `WAREHOUSE` | Warehouse inventory staff | View inventory dashboard, confirm asset staging, update warehouse location |
| `ADMIN` | IT/Platform administrator | Full system access, user management, BOM configuration, integration monitoring, audit logs |

---

## RBAC Route Guard Usage

```typescript
import { requireRole } from '@middleware/rbac.middleware'

// Single role
router.get('/users', requireRole('ADMIN'), asyncHandler(controller.list))

// Multiple allowed roles
router.patch('/approve', requireRole('MANAGER', 'ADMIN'), asyncHandler(controller.approve))

// EQC or higher
router.post('/dispatch/documents', requireRole('EQC', 'MANAGER', 'ADMIN'), asyncHandler(controller.generate))
```

On failure: HTTP 403
```json
{ "success": false, "error": { "code": "INSUFFICIENT_PERMISSIONS", "message": "Insufficient permissions" } }
```

---

## Users Module (`src/modules/users/user.service.ts`)

| Method | Description |
|--------|-------------|
| `list(filters)` | Paginated user list with role/active filters (ADMIN only) |
| `create(dto)` | Create email/password user — bcrypt 12 rounds on password |
| `updateRole(id, role)` | Change a user's role (ADMIN only) |
| `deactivate(id)` | Soft delete — sets `isActive = false`, nulls `refreshTokenHash` |
| `findByEmail(email)` | Used by login flow |
| `upsertFromAzureAD(objectId, profile)` | Create or update SSO user — called on every SSO login |

---

*Back to [CLAUDE.md](../CLAUDE.md)*
