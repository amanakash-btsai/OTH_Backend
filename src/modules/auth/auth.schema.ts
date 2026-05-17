// ─────────────────────────────────────────────────────────────────────────────
// FILE: modules/auth/auth.schema.ts
// Zod validation schemas for auth request bodies.
// These define the shape and rules for data the client sends to auth endpoints.
// The validate() middleware uses these before the controller ever runs.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';

// LoginBodySchema: the body expected by POST /auth/login.
// email must be a valid email format. password must be at least 8 chars.
// If either is wrong, the request is rejected with a 400 before touching the DB.
export const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

// TypeScript type derived automatically from the schema — no need to define it separately.
export type LoginBody = z.infer<typeof LoginBodySchema>;
