# Architecture Overview

**Project:** EQC Asset Management Platform — Backend  
**Organization:** OTH Equipment Co. | Olympus Thailand Medical Division  
**Version:** 2.0 | May 2026

---

## What This System Does

The EQC backend is a standalone Node.js/Express/TypeScript REST API that replaces fragmented MS Access, Excel, and Salesforce workflows used to manage medical endoscopy device deployments across hospitals in Thailand.

It serves a React frontend, processes inbound webhooks from Salesforce (via MuleSoft) and SAP, sends Adaptive Card alerts to six MS Teams channels, generates A4 PDF transport documents stored in Azure Blob, and runs six AI agents for autonomous operations monitoring.

### Business Domains Managed

- **Sales requests** (Demo/Loaner) replacing Salesforce Demo_Loaner_Request__c as the system of record
- **Device deployments** linking physical assets to requests with their own lifecycle
- **BOM (Bill of Materials) packing and dispatch** with hard server-enforced blocking on incomplete packing
- **Return inspection** with per-item pass/fail and automatic repair case creation
- **Repair case tracking** replacing Salesforce Repair__c
- **Immutable event log** for compliance audit trail

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js 20 LTS | Stable, broad Azure support, active LTS |
| Framework | Express.js | Lightweight HTTP framework |
| Language | TypeScript (strict mode) | Type safety, compile-time error detection |
| ORM | Prisma | Schema-first ORM with Azure SQL (`sqlserver` provider) |
| Database | Azure SQL (SQL Server) | Enterprise managed DB, zone-redundant HA |
| Job Queue | BullMQ + Azure Cache for Redis | Cron-based background jobs, async notifications |
| Authentication | JWT (RS256) + Azure AD OAuth2 | Corporate SSO + email/password fallback |
| PDF Generation | PDFKit | Server-side A4 transport document generation |
| QR Code | qrcode library | QR codes embedded in transport PDFs |
| Email | Nodemailer + Azure Communication Services | Print queue notifications, escalations, reports |
| Blob Storage | Azure Blob Storage SDK | PDFs, signed copies, generated reports |
| AI Services | Azure OpenAI (GPT-4o mini) | 6 autonomous agents for operations monitoring |
| Validation | Zod | Schema validation on all incoming requests |
| Logging | Winston + Azure Application Insights | Structured logs, APM, performance monitoring |
| Security | Helmet, express-rate-limit, CORS | OWASP hardening, rate limiting, origin restriction |
| Testing | Jest + Supertest | Unit tests and integration tests |
| Containerization | Docker + Azure Container Registry | Consistent builds, immutable images |
| Orchestration | Azure Kubernetes Service (AKS) | Autoscaling 2–10 nodes, rolling deployments |
| CI/CD | Azure DevOps Pipelines | Build, test, push to ACR, deploy to AKS |
| Secrets | Azure Key Vault | All credentials managed centrally, never in code |

---

## Key Architectural Principles

These are non-negotiable constraints that must be enforced in every implementation:

1. **State machines enforced in the service layer** — invalid transitions are rejected with HTTP 409. The frontend cannot bypass them.
2. **BOM dispatch block is server-side only** — `dispatch.service` calls `bom.service.validatePacking()` before generating any document. An incomplete BOM returns HTTP 409 `DISPATCH_BLOCKED` regardless of what the frontend sends.
3. **BOM line items are the inspection source** — inspections use `bom_line_items` from the `bom_set_id` assigned to the sales request. Never query BOM data outside the assigned set.
4. **All webhook processing is idempotent** — check `sfdc_request_id` (MuleSoft) or equivalent before creating records. Duplicate calls return existing records.
5. **Audit logging is non-blocking** — always write via `setImmediate`. Never `await` audit writes in the request path.
6. **All secrets managed via Azure Key Vault** — never stored in code, `.env` files in production, or committed to source control.
7. **All email sending is asynchronous** — queued via BullMQ `emailQueue`, never called inline in request handlers.
8. **AI agents run only in background jobs** — never in the HTTP request path. All Azure OpenAI calls are inside BullMQ workers.

---

## High-Level Component Diagram

```
React Frontend
     │
     │  HTTPS / JWT Bearer
     ▼
Express API (AKS)
  ├── /api/auth         → Auth Module
  ├── /api/assets       → Assets Module + State Machine (15 statuses)
  ├── /api/requests     → Sales Requests Module + State Machine
  ├── /api/deployments  → Device Deployments Module + State Machine
  ├── /api/repairs      → Repair Cases Module
  ├── /api/bom          → BOM Module (sets + line items + packing validation)
  ├── /api/dispatch     → Dispatch Module (PDF → Blob → Teams)
  ├── /api/inspections  → Inspection Module (dispatch + return, repair case auto-creation)
  ├── /api/dashboard    → Dashboard Module (role-gated, cached)
  ├── /api/reports      → Reports Module (XLSX/PDF export)
  ├── /api/accounts     → Accounts Module
  ├── /api/users        → Users Module
  ├── /api/audit        → Event Log Module (read-only)
  └── /api/webhooks     → Webhooks (MuleSoft HMAC + Teams card actions)
          │
          ├── Azure SQL (Prisma ORM)        ← all persistent state
          ├── Azure Cache for Redis          ← BullMQ job queues
          ├── Azure Blob Storage             ← PDFs, signed copies
          ├── Azure OpenAI                   ← 6 AI agents (background only)
          ├── MS Teams (6 channels)          ← outbound alerts
          ├── Azure Communication Services   ← email (queued)
          └── Azure Key Vault               ← secrets
```

---

## Deployment Architecture

- **AKS:** 2–10 pods (autoscaling), rolling deployments
- **Docker:** Multi-stage build — compile TypeScript in Stage 1, minimal Alpine image in Stage 2
- **CI/CD:** Azure DevOps Pipelines — build → test → push to ACR → deploy to AKS
- **Health probe:** `GET /api/health` returns DB + Redis status for AKS liveness/readiness checks

---

## Project Folder Map

```
OTH_Backend/
├── CLAUDE.md                    ← you are here (navigation hub)
├── docs/                        ← architecture, module specs, guides
├── prisma/
│   ├── schema.prisma            ← single source of truth for DB schema
│   └── migrations/              ← versioned SQL migration folders
├── src/
│   ├── server.ts                ← HTTP server + graceful shutdown
│   ├── app.ts                   ← Express app + middleware + routers
│   ├── config/                  ← env validation, DB, Redis, Blob, OpenAI, Key Vault
│   ├── types/                   ← TypeScript type definitions and enums
│   ├── middleware/               ← auth, RBAC, audit, validation, rate limit, errors
│   ├── utils/                   ← errors, response helpers, pagination, dates, logger
│   ├── modules/
│   │   ├── auth/
│   │   ├── assets/
│   │   ├── requests/        ← sales_requests + request_extensions
│   │   ├── deployments/     ← device_deployments
│   │   ├── repairs/         ← repair_cases
│   │   ├── bom/             ← bom_sets + bom_line_items + accessory_master
│   │   ├── dispatch/
│   │   ├── inspection/      ← inspection_records + inspection_line_items
│   │   ├── dashboards/
│   │   ├── reports/
│   │   ├── accounts/
│   │   ├── users/
│   │   ├── audit/           ← event_log read endpoints
│   │   └── webhooks/
│   ├── services/                ← email, blob, teams, openai (shared)
│   ├── jobs/
│   │   ├── queue.ts             ← BullMQ queue instances
│   │   ├── scheduler.ts         ← cron registrations
│   │   ├── processors/          ← BullMQ workers
│   │   └── agents/              ← 6 AI agents
│   └── routes/
│       └── index.ts             ← root router, mounts all modules
├── tests/
│   ├── setup.ts
│   ├── helpers/
│   └── unit/ + integration/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
└── jest.config.ts
```

---

*See [CLAUDE.md](../CLAUDE.md) for the full navigation index.*
