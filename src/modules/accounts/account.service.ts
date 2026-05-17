// ─────────────────────────────────────────────────────────────────────────────
// FILE: modules/accounts/account.service.ts
// Database queries for the Accounts (customers/hospitals) module.
//
// An "account" in this system is a hospital, clinic, or medical facility that
// Olympus does business with. Accounts are referenced by sales requests —
// "which hospital is this equipment going to?".
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '@config/database';

// findAccounts: return a short list of accounts for search dropdowns.
// `take: 50` caps results — this is designed for typeahead/autocomplete,
// not bulk exports. `select` only returns the fields the frontend needs
// (not internal fields like audit timestamps).
export async function findAccounts(filters: { search?: string; area?: string } = {}) {
  const where: Record<string, unknown> = {};
  if (filters.search) where.account_name = { contains: filters.search };
  if (filters.area)   where.area = filters.area;

  return prisma.account.findMany({
    where,
    select: {
      account_id:   true,
      account_name: true,
      area:         true,
      department:   true,
      segmentation: true,
    },
    orderBy: { account_name: 'asc' },
    take: 50,  // Cap at 50 results to keep response size manageable
  });
}

// findAccount: fetch a single account by its UUID primary key.
// Returns null if not found (the controller handles the 404 response).
export async function findAccount(account_id: string) {
  return prisma.account.findUnique({
    where: { account_id },
    select: {
      account_id:   true,
      account_name: true,
      area:         true,
      department:   true,
      segmentation: true,
    },
  });
}
