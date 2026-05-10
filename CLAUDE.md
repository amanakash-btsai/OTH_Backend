# EQC Asset Management Platform — Backend

**Organization:** OTH Equipment Co. | Olympus Thailand Medical Division  
**Stack:** Node.js 20 + Express + TypeScript + Prisma + Azure SQL + BullMQ + AKS  
**Version:** 2.0 | May 2026

> This is the navigation hub for the EQC backend codebase. Every section of the technical specification has a dedicated doc file below. You do not need to refer to EQC_Backend_Technical_Spec.md — all content is covered here.

---

## Quick Start

```bash
cp .env.example .env          # configure environment variables
docker-compose up -d          # start Azure SQL Edge + Redis
npx prisma migrate dev        # apply schema migrations
npm run dev                   # start API with hot reload
npm test                      # run all tests
```

---

## Navigation Index

### Foundation
| Topic | File |
|-------|------|
| Architecture, tech stack, component diagram, folder map | [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) |
| Config files, env variables, Prisma setup | [docs/CONFIG_AND_ENV.md](./docs/CONFIG_AND_ENV.md) |
| Code conventions, naming, patterns | [docs/CONVENTIONS.md](./docs/CONVENTIONS.md) |
| API standards, URL structure, error codes | [docs/API_GUIDELINES.md](./docs/API_GUIDELINES.md) |

### Data & Infrastructure
| Topic | File |
|-------|------|
| All 17 DB tables, enums, indexes, concurrent booking | [docs/DATABASE.md](./docs/DATABASE.md) |
| Middleware stack, execution order, all 8 middleware files | [docs/MIDDLEWARE.md](./docs/MIDDLEWARE.md) |
| Type definitions, enums, utility helpers | [docs/TYPES_AND_UTILS.md](./docs/TYPES_AND_UTILS.md) |

### Feature Modules
| Module | Route | File |
|--------|-------|------|
| Authentication & Authorization (JWT, Azure AD SSO, RBAC, Users) | `/api/auth`, `/api/users` | [docs/AUTH.md](./docs/AUTH.md) |
| Assets (state machine, 15-status lifecycle) | `/api/assets` | [docs/ASSETS_MODULE.md](./docs/ASSETS_MODULE.md) |
| Sales Requests & Device Deployments (lifecycle, state machines, extensions) | `/api/requests`, `/api/deployments` | [docs/DEPLOYMENTS_MODULE.md](./docs/DEPLOYMENTS_MODULE.md) |
| Repair Cases (full repair lifecycle, SAP/SFDC sync) | `/api/repairs` | [docs/DEPLOYMENTS_MODULE.md](./docs/DEPLOYMENTS_MODULE.md) |
| BOM — Bill of Materials (sets, line items, accessory master, **dispatch block**) | `/api/bom` | [docs/BOM_MODULE.md](./docs/BOM_MODULE.md) |
| Dispatch (PDF generation, QR code, Azure Blob, 10-step flow) | `/api/dispatch` | [docs/DISPATCH_MODULE.md](./docs/DISPATCH_MODULE.md) |
| Inspection (per-component results, repair cases) | `/api/inspections` | [docs/INSPECTION_MODULE.md](./docs/INSPECTION_MODULE.md) |
| Dashboards (5 role-gated views, 5-min cache) | `/api/dashboard` | [docs/DASHBOARDS_MODULE.md](./docs/DASHBOARDS_MODULE.md) |
| Reports, Accounts, Users, Audit | `/api/reports`, `/api/accounts`, `/api/users`, `/api/audit` | [docs/REPORTS_ACCOUNTS_USERS_AUDIT.md](./docs/REPORTS_ACCOUNTS_USERS_AUDIT.md) |
| Webhooks (MuleSoft HMAC, Teams card actions) | `/api/webhooks` | [docs/WEBHOOKS_MODULE.md](./docs/WEBHOOKS_MODULE.md) |

### Services, Jobs & AI
| Topic | File |
|-------|------|
| Shared services: Email, Blob Storage, Teams, OpenAI | [docs/SHARED_SERVICES.md](./docs/SHARED_SERVICES.md) |
| BullMQ queues, cron scheduler, 5 job processors | [docs/BACKGROUND_JOBS.md](./docs/BACKGROUND_JOBS.md) |
| 6 AI agents (Azure OpenAI GPT-4o mini) | [docs/AI_AGENTS.md](./docs/AI_AGENTS.md) |

### Integration & External Systems
| Topic | File |
|-------|------|
| Salesforce/MuleSoft, SAP, MS Teams, Azure OpenAI, Blob, Email connectors | [docs/INTEGRATIONS.md](./docs/INTEGRATIONS.md) |

### Flows, Testing & Roadmap
| Topic | File |
|-------|------|
| End-to-end process flows (SSO, Demo lifecycle, Dispatch Block, MuleSoft, Overdue Alerts, Teams) | [docs/PROCESS_FLOWS.md](./docs/PROCESS_FLOWS.md) |
| Unit tests, integration tests, 8-step verification plan | [docs/TESTING.md](./docs/TESTING.md) |
| Sprint roadmap, acceptance criteria per sprint | [docs/ROADMAP.md](./docs/ROADMAP.md) |

### Implementation Guide
| Topic | File |
|-------|------|
| **Step-by-step prompts for implementing each module** | [docs/IMPLEMENTATION_PROMPTS.md](./docs/IMPLEMENTATION_PROMPTS.md) |

---

## Critical Rules (Read Before Writing Any Code)

1. **BOM dispatch block is server-side only.** `dispatch.service` calls `bom.service.validatePacking()` before any PDF generation. Incomplete BOM → HTTP 409 `DISPATCH_BLOCKED`. Frontend cannot bypass this.

2. **State machines enforced in service layer.** Invalid status transitions → HTTP 409. Check asset state machine in `asset.stateMachine.ts` and deployment state machine in `deployment.stateMachine.ts`.

3. **BOM line items are the inspection source.** Inspections read from `bom_line_items` linked to the `bom_set_id` on the sales request — never query live BOM data outside the assigned set.

4. **Webhook processing is idempotent.** Always check `sfdc_request_id` before creating records. Duplicates return 200 with existing record.

5. **Audit logging is non-blocking.** Always write via `setImmediate(() => auditService.write(...).catch(logger.error))`. Never `await` in request path.

6. **All secrets via Azure Key Vault.** Never in code or .env in production. `key-vault.ts` handles the resolution.

7. **All email sending is async.** Always queue via `emailQueue.add()`, never call SMTP inline.

8. **AI agents never in HTTP request path.** Only inside BullMQ workers.

9. **Only `src/config/index.ts` reads `process.env`.** All other files import from `@config/index`.

10. **Always return HTTP 200 from MuleSoft webhook handlers**, even on application errors. Non-200 triggers retry storms.

---

## File Count Reference

| Layer | File Count |
|-------|-----------|
| Root config files | 7 |
| `src/config/` | 6 |
| `src/types/` | 4 |
| `src/utils/` | 6 |
| `src/middleware/` | 8 |
| `src/modules/` (14 modules) | ~56 |
| `src/services/` | 4 |
| `src/jobs/` (queues + scheduler + processors + agents) | 12 |
| `prisma/` | 2+ (schema + migrations) |
| `tests/` (setup + helpers + tests) | 12 |
| **Total** | **~117 files** |

---

## Implementation Order

Follow the sprint plan in [docs/ROADMAP.md](./docs/ROADMAP.md). Use the prompts in [docs/IMPLEMENTATION_PROMPTS.md](./docs/IMPLEMENTATION_PROMPTS.md) for each module.

**Suggested order:**
1. Root config files + Prisma schema (Prompt 1.1, 1.2)
2. Config, types, utils, middleware (Prompt 1.3, 1.4)
3. Auth + Assets + Sales Requests + Deployments + BOM modules (Prompt 2.1–2.5)
4. Dispatch + Inspection + Repair Cases + Webhooks (Prompt 3.1–3.4)
5. Dashboards + Reports (Prompt 4.1–4.2)
6. AI Agents + Background Jobs (Prompt 5.1–5.3)
7. Tests (Prompt 6.1–6.2)
