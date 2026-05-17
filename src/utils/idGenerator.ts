// ─────────────────────────────────────────────────────────────────────────────
// FILE: utils/idGenerator.ts
// Central place to generate unique IDs for every database record we create
// (users, assets, sales requests, deployments, etc.).
//
// Uses UUID v4 — a random 128-bit identifier with astronomically low collision
// probability. Centralising this means we can swap the strategy (e.g. to
// nanoid or ULID) in one place without touching every service file.
// ─────────────────────────────────────────────────────────────────────────────

import { v4 as uuidv4 } from 'uuid';

// Returns a new random UUID string like "550e8400-e29b-41d4-a716-446655440000"
export function generateId(): string {
  return uuidv4();
}
