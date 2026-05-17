// ─────────────────────────────────────────────────────────────────────────────
// FILE: config/index.ts
// Central configuration file. Reads ALL environment variables (from the .env
// file or Azure App Service settings), validates them with Zod, and exports a
// single frozen `config` object that every other file imports from.
//
// If a required variable is missing or wrong type, the server REFUSES to start
// and prints exactly which variable is broken. This prevents mysterious crashes
// at runtime due to bad configuration.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod';

// Define the "shape" and rules for every environment variable.
// z.string().min(1) = must be a non-empty string.
// z.coerce.number() = convert the string "900" to the number 900.
// .default(x) = use x if the variable is not set.
const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.coerce.number().default(900),
  REFRESH_TOKEN_EXPIRY: z.coerce.number().default(604800),

  AZURE_AD_TENANT_ID: z.string().min(1),
  AZURE_AD_CLIENT_ID: z.string().min(1),
  AZURE_AD_CLIENT_SECRET: z.string().min(1),
  AZURE_AD_REDIRECT_URI: z.string().url(),

  AZURE_STORAGE_CONNECTION_STRING: z.string().optional(),
  AZURE_STORAGE_CONTAINER_TRANSPORT: z.string().default('transport-docs'),
  AZURE_STORAGE_CONTAINER_SIGNED: z.string().default('signed-copies'),

  AZURE_OPENAI_ENDPOINT: z.string().optional(),
  AZURE_OPENAI_API_KEY: z.string().optional(),
  AZURE_OPENAI_DEPLOYMENT: z.string().default('gpt-4o-mini'),

  AZURE_APP_INSIGHTS_CONNECTION_STRING: z.string().optional(),

  REDIS_URL: z.string().default('redis://localhost:6379'),

  MULESOFT_WEBHOOK_SECRET: z.string().optional(),

  // Graph API / Teams notifications
  GRAPH_TENANT_ID: z.string().optional(),
  GRAPH_CLIENT_ID: z.string().optional(),
  GRAPH_CLIENT_SECRET: z.string().optional(),
  TEAMS_BOT_APP_ID: z.string().optional(),
  TEAMS_APP_EXTERNAL_ID: z.string().default('com.olympus.eqc.oth'),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
  EQC_TEAMS_CHANNEL_WEBHOOK: z.string().optional(),

  TEAMS_EQC_OPS_WEBHOOK: z.string().optional(),
  TEAMS_LOANER_OVERDUE_WEBHOOK: z.string().optional(),
  TEAMS_DEMO_ALERTS_WEBHOOK: z.string().optional(),
  TEAMS_ASSET_DEFECTS_WEBHOOK: z.string().optional(),
  TEAMS_INVENTORY_CRITICAL_WEBHOOK: z.string().optional(),
  TEAMS_EXEC_SUMMARY_WEBHOOK: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  WAREHOUSE_PRINTER_EMAIL: z.string().optional(),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.string().default('info'),
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),
});

// Try to parse process.env against the schema.
// safeParse won't throw — it returns { success: true, data } or { success: false, error }.
const parsed = envSchema.safeParse(process.env);

// If validation fails, print the exact bad variables and kill the process.
// A server with missing config is useless — better to fail loudly at startup.
if (!parsed.success) {
  console.error('❌ Invalid environment variables:\n', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

// Object.freeze makes this config immutable — nothing can accidentally
// overwrite DATABASE_URL or JWT_SECRET at runtime.
export const config = Object.freeze(parsed.data);
