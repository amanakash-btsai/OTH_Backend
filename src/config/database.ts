// ─────────────────────────────────────────────────────────────────────────────
// FILE: config/database.ts
// Creates and exports the Prisma database client as a SINGLETON.
//
// A singleton means: only ONE connection pool to the database is ever created,
// no matter how many times this file is imported. Without this pattern, every
// hot-reload during development would open a new connection, quickly exhausting
// the SQL Server connection limit.
//
// In development: log all SQL queries + warnings so you can debug what's happening.
// In production: log errors only to keep logs clean.
// ─────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

// Store the Prisma client on the global object so it survives hot-reloads.
// `globalThis` is the Node.js equivalent of `window` in the browser.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Reuse the existing instance if it's already on globalThis; otherwise create
// a fresh one. The ?? operator means "use left side if it exists, else right side."
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

// Only save back to globalThis outside of production — in production the server
// never hot-reloads so there's no risk of accumulating connections.
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
