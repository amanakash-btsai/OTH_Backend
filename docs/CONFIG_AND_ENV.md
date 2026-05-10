# Configuration Files & Environment Variables

---

## Root-Level Config Files

### `.env.example`
Template showing all required environment variables with placeholder values. **Commit this to source control.** Developers use it as a reference for local setup. Never commit the actual `.env` file.

### `.gitignore`
Must exclude:
```
node_modules/
dist/
.env
coverage/
*.log
```
Also exclude Azure-specific local credential files.

### `Dockerfile`
Multi-stage build:
- **Stage 1:** Install all dependencies (`npm ci`), compile TypeScript (`npm run build`)
- **Stage 2:** Copy only `dist/` and `node_modules/` (production only) into a minimal `node:20-alpine` image

Final image exposes port 3000, runs `node dist/server.js`.

### `docker-compose.yml`
Local development environment. Services:
- `api` — the backend (this app), depends on `db` and `redis`
- `db` — Azure SQL Edge (local SQL Server equivalent for macOS/Linux dev), port 1433
- `redis` — Redis, port 6379

Injects environment variables from `.env` file.

### `package.json`
NPM scripts:
| Script | Command |
|--------|---------|
| `build` | `tsc` |
| `start` | `node dist/server.js` |
| `dev` | `ts-node-dev --respawn src/server.ts` |
| `test` | `jest` |
| `migrate` | `prisma migrate dev` |
| `generate` | `prisma generate` |

### `tsconfig.json`
```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "paths": {
      "@config/*": ["./src/config/*"],
      "@middleware/*": ["./src/middleware/*"],
      "@modules/*": ["./src/modules/*"],
      "@services/*": ["./src/services/*"],
      "@utils/*": ["./src/utils/*"],
      "@types/*": ["./src/types/*"]
    },
    "esModuleInterop": true,
    "experimentalDecorators": false
  }
}
```

### `jest.config.ts`
- Preset: `ts-jest`
- Coverage thresholds: 80% across lines, branches, functions, statements
- Two test environments: `unit` (mocked services) and `integration` (real test DB)

---

## `src/config/index.ts` — Startup Env Validation

The **single source of truth** for all environment variables. This is the **only file** that reads `process.env`.

- Uses Zod to validate all env vars at startup
- Crashes immediately with a descriptive error message if any required variable is missing or malformed
- Exports a **frozen config object** — all other files import from here, never from `process.env` directly

```typescript
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRY: z.coerce.number().default(900),
  REFRESH_TOKEN_EXPIRY: z.coerce.number().default(604800),
  // ... all other variables
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().default(3000),
})

export const config = Object.freeze(envSchema.parse(process.env))
```

---

## `src/config/database.ts` — Prisma Singleton

- Creates a single `PrismaClient` instance (lazy-initialized)
- Enables query logging in `development` mode only
- Exported as `prisma` — imported by all service files

```typescript
import { PrismaClient } from '@prisma/client'
import { config } from './index'

const prisma = new PrismaClient({
  log: config.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

export { prisma }
```

---

## `src/config/redis.ts` — BullMQ Redis Connection

- Creates BullMQ-compatible Redis connection from `REDIS_URL`
- Handles connection errors without crashing the process
- Exported as `redisConnection` — used by all BullMQ Queue and Worker instances

---

## `src/config/azure-blob.ts` — Blob Storage Client

Exports helper functions to get container clients:
- `getTransportDocsContainer()` → `transport-docs` container
- `getSignedCopiesContainer()` → `signed-copies` container
- `getAuditReportsContainer()` → `audit-reports` container

Uses `BlobServiceClient` from `@azure/storage-blob`.

---

## `src/config/azure-openai.ts` — OpenAI Client

- Initializes `OpenAIClient` with `AZURE_OPENAI_ENDPOINT` and `AZURE_OPENAI_API_KEY`
- Exported as `openaiClient` — used only by AI agents in `src/jobs/agents/`

---

## `src/config/key-vault.ts` — Secret Resolution

- **Production:** Fetches secrets from Azure Key Vault using Managed Identity (no credentials in code)
- **Development:** Falls back to `.env` values
- Called by `config/index.ts` at startup before Zod validation runs

---

## Environment Variable Reference

All variables are validated at startup. The app crashes immediately if any is missing.

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Azure SQL connection string | `sqlserver://server.database.windows.net;database=eqc_db;...` |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | `a-long-random-secret-string` |
| `JWT_EXPIRY` | Access token expiry in seconds | `900` |
| `REFRESH_TOKEN_EXPIRY` | Refresh token expiry in seconds | `604800` |
| `AZURE_AD_TENANT_ID` | Azure AD tenant ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `AZURE_AD_CLIENT_ID` | App registration client ID | `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx` |
| `AZURE_AD_CLIENT_SECRET` | App registration client secret | `<from Key Vault>` |
| `AZURE_AD_REDIRECT_URI` | OAuth callback URL | `https://api.eqc.olympus.th/api/auth/sso/azure` |
| `AZURE_STORAGE_CONNECTION_STRING` | Blob Storage connection string | `<from Key Vault>` |
| `AZURE_STORAGE_CONTAINER_TRANSPORT` | Blob container for dispatch PDFs | `transport-docs` |
| `AZURE_STORAGE_CONTAINER_SIGNED` | Blob container for signed copies | `signed-copies` |
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI resource endpoint | `https://<resource>.openai.azure.com` |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key | `<from Key Vault>` |
| `AZURE_OPENAI_DEPLOYMENT` | GPT deployment name | `gpt-4o-mini` |
| `AZURE_APP_INSIGHTS_CONNECTION_STRING` | Application Insights telemetry | `<from Key Vault>` |
| `REDIS_URL` | Azure Cache for Redis connection string | `rediss://<name>.redis.cache.windows.net:6380` |
| `MULESOFT_WEBHOOK_SECRET` | HMAC secret for MuleSoft validation | `<shared secret>` |
| `TEAMS_EQC_OPS_WEBHOOK` | Teams `#eqc-ops-alerts` webhook URL | `https://xxx.webhook.office.com/...` |
| `TEAMS_LOANER_OVERDUE_WEBHOOK` | Teams `#loaner-overdue` webhook URL | `https://xxx.webhook.office.com/...` |
| `TEAMS_DEMO_ALERTS_WEBHOOK` | Teams `#demo-alerts` webhook URL | `https://xxx.webhook.office.com/...` |
| `TEAMS_ASSET_DEFECTS_WEBHOOK` | Teams `#asset-defects` webhook URL | `https://xxx.webhook.office.com/...` |
| `TEAMS_INVENTORY_CRITICAL_WEBHOOK` | Teams `#inventory-critical` webhook URL | `https://xxx.webhook.office.com/...` |
| `TEAMS_EXEC_SUMMARY_WEBHOOK` | Teams `#exec-summary` webhook URL | `https://xxx.webhook.office.com/...` |
| `SMTP_HOST` | SMTP server hostname | `smtp.sendgrid.net` |
| `SMTP_PORT` | SMTP port | `587` |
| `SMTP_USER` | SMTP username | `apikey` |
| `SMTP_PASS` | SMTP password / API key | `<from Key Vault>` |
| `WAREHOUSE_PRINTER_EMAIL` | Warehouse printer email address | `printer@warehouse.eqc.olympus.th` |
| `NODE_ENV` | Runtime environment | `production` |
| `PORT` | HTTP port | `3000` |
| `LOG_LEVEL` | Minimum log level | `info` |
| `FRONTEND_ORIGIN` | Allowed CORS origin (frontend URL) | `https://app.eqc.olympus.th` |

---

## `prisma/schema.prisma`

The single source of truth for the database schema. Key configuration:

```prisma
datasource db {
  provider = "sqlserver"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}
```

Defines all 13 models, enums, fields, relations, and indexes. See [DATABASE.md](./DATABASE.md) for full schema details.

### `prisma/migrations/`
Auto-generated versioned SQL migration folders created by `prisma migrate dev`. Each folder contains the SQL to apply incremental schema changes to Azure SQL. Never edit migration files manually.

---

*Back to [CLAUDE.md](../CLAUDE.md)*
