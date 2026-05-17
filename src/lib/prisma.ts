// ─────────────────────────────────────────────────────────────────────────────
// FILE: lib/prisma.ts
// Secondary Prisma singleton (note: the primary is config/database.ts).
// Uses the same pattern — store on globalThis to survive hot reloads.
// Prefer importing from @config/database; this file exists for compatibility.
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
