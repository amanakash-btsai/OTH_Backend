import { z } from 'zod';

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

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('❌ Invalid environment variables:\n', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = Object.freeze(parsed.data);
