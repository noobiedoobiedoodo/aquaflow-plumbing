# AquaFlow — Production Deployment Runbook & Infrastructure Verification Gates

**Deployment Target**: First 3 Pilot Commercial Plumbing Companies ($199/month)  
**Codebase Status**: 🟢 **APPROVED** (288/288 tests passed, 0 type errors, clean Turbopack build)  
**Deployment Status**: 🟡 **CONDITIONAL APPROVAL** (Requires passing all 14 live infrastructure gates below)

---

## 1. MANDATORY INFRASTRUCTURE GATES

```
+-------------------------------------------------------------------------------+
|                        PRODUCTION DEPLOYMENT RUNBOOK                          |
+-------------------------------------------------------------------------------+
| 1. ENVIRONMENT  --> Strict production credentials, no hardcoded secrets       |
| 2. DATABASE     --> Run `npm run db:migrate` against PostgreSQL 15+           |
| 3. WORKER       --> Launch `npm run worker` daemon (BullMQ + Outbox Queues)   |
| 4. WEB APP      --> Run `npm run build` followed by `npm start` (Port 3000)   |
| 5. S3 STORAGE   --> S3-only persistence; zero local filesystem fallback       |
| 6. STRIPE       --> Stripe Connect Standard + double idempotency webhooks     |
| 7. WEBHOOKS     --> Fail-closed verification (Stripe, Resend Svix, Twilio)   |
| 8. ISOLATION    --> Live 2-tenant adversarial boundary test (Tenant A vs B)   |
| 9. CUSTOMER     --> Portal scoping, non-enumerating reset, single-use links   |
| 10. TECHNICIAN  --> Assigned-job-only mutations & immutable signatures        |
| 11. MONITORING  --> Structured logging, audit trails, error categorization    |
| 12. ROLLBACK    --> Version-controlled release & schema rollback runbook      |
| 13. SMOKE TEST  --> 16-step golden path live execution                       |
| 14. DECISION    --> Final GO / HOLD / NO-GO sign-off                         |
+-------------------------------------------------------------------------------+
```

---

## GATE 1: Environment & Secrets Verification

Supply all environment variables through the hosting platform's secure key/vault storage:

```bash
# Core Runtime
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://app.aquaflowplumbing.com
SESSION_SECRET=<64-byte cryptographically secure random string>

# Database & Cache
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<database>?sslmode=require
REDIS_URL=rediss://<user>:<password>@<host>:6379

# Object Storage (AWS S3)
AWS_S3_BUCKET_NAME=<production-bucket-name>
AWS_REGION=ca-central-1
AWS_ACCESS_KEY_ID=<production-access-key>
AWS_SECRET_ACCESS_KEY=<production-secret-key>

# Billing & Stripe Connect
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Communications & Webhooks
RESEND_API_KEY=re_...
RESEND_WEBHOOK_SECRET=whsec_...
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+12045550199
```

> [!IMPORTANT]
> **Fail-Closed Rule**: If `AWS_S3_BUCKET_NAME`, `RESEND_WEBHOOK_SECRET`, or `TWILIO_AUTH_TOKEN` is missing in production, the application will fail closed and reject operations with 500 errors to prevent data loss or security bypass.

---

## GATE 2: Database Gate (`npm run db:migrate`)

Execute migrations against the production PostgreSQL instance before enabling web traffic:

```bash
# 1. Run migrations deterministically
npm run db:migrate

# 2. Verify schema status
npx prisma migrate status
```

**Verification Checklist**:
- [ ] Database provider is PostgreSQL (not SQLite).
- [ ] All migrations applied successfully without drift.
- [ ] Database connection pool limits configured (e.g. `connection_limit=20`).

---

## GATE 3: Dedicated Worker Gate (`npm run worker`)

Launch the background worker process as a persistent daemon (e.g. systemd / ECS / Railway Worker):

```bash
# Launch background worker process
npm run worker
```

**Verification Checklist**:
- [ ] Redis connection established via `ioredis`.
- [ ] BullMQ workers initialized:
  - `outbox-dispatcher` (Polls and queues pending `Event` records).
  - `event-processor` (Processes `job.completed`, `invoice.created`, etc.).
  - `notification-sender` (Dispatches Resend emails & Twilio SMS).
- [ ] Graceful shutdown verified on `SIGTERM` / `SIGINT`.

---

## GATE 4: Web Application Gate (`npm run build` & `npm start`)

```bash
# 1. Compile optimized production build
npm run build

# 2. Start HTTP server
npm start
```

**Verification Checklist**:
- [ ] Web application starts listening on target port (default 3000).
- [ ] Static pages (24 routes) pre-rendered cleanly.
- [ ] Dynamic API routes (18 endpoints) initialized.

---

## GATE 5: Object Storage (AWS S3) Gate

Perform live storage verification:
1. Upload a technician job photo from the technician workspace.
2. Confirm the raw object exists in the S3 bucket under `uploads/` prefix.
3. Access the photo through `/api/files/<storageKey>` as the assigned technician (HTTP 200).
4. Attempt to access the same storage key as an unassigned technician from another organization (HTTP 404 / 403 Forbidden).
5. Local disk fallback is strictly disabled in production.

---

## GATE 6 & 7: Stripe Connect & Webhooks Gate

1. **Stripe Connect Onboarding**:
   - Organization admin connects their Stripe Standard account.
   - Status transitions from `PENDING` to `ACTIVE`.
2. **Webhook Verification**:
   - `STRIPE_WEBHOOK_SECRET` validates incoming events.
   - Idempotency guaranteed via `StripeWebhookEvent` and `Payment` unique constraints.
   - Cross-tenant spoofing rejected (`event.account === organization.stripeAccountId`).
   - Partial payment produces `PARTIALLY_PAID`; full payment produces `PAID`.
3. **Resend & Twilio Webhooks**:
   - Svix and Twilio signature verification fail closed if secrets are missing in production.

---

## GATE 8, 9 & 10: Multi-Tenant & RBAC Isolation Gate

Execute a live two-tenant isolation smoke test on production:
- **Tenant A** (`pilot-plumbing-a`) vs **Tenant B** (`pilot-plumbing-b`).
- Verify Tenant A administrator, dispatcher, and technician cannot view or mutate any customer, property, job, invoice, note, photo, or signature belonging to Tenant B.
- Verify customer portal login at `/p/tenant-a/login` rejects Tenant B customer credentials.
- Verify technician can only execute actions on jobs explicitly assigned to them (`job.technicianId === actor.technicianId`).

---

## GATE 11: Production Monitoring & Observability

Ensure log streams capture structured JSON logs containing:
- `timestamp`, `level`, `operation`, `metadata` (including `organizationId`, `jobId`, `invoiceId`).
- Sentry error monitoring active (with sensitive PII scrubbed).
- Realtime SSE heartbeat monitored at `/api/realtime`.

---

## GATE 12: Rollback Procedure

In the event of an infrastructure anomaly:

1. **Application Rollback**:
   - Re-deploy previous stable container / commit hash.
2. **Worker Rollback**:
   - Stop worker daemon, clear stuck queue locks in Redis if necessary, restart previous worker build.
3. **Database Schema Strategy**:
   - **Never blindly roll back database schema migrations.**
   - All migrations are forward-compatible and additive. If a rollback is necessary, deploy a forward migration (`prisma migrate dev --name rollback_...` then `prisma migrate deploy`).

---

## GATE 13: End-to-End Live Production Smoke Test

Follow this 16-step golden path sequence in production:

```
 1. Public Landing Page (/ & /book)          --> Verified
 2. Tenant Provisioning (/signup)             --> Super Admin + Org Created
 3. Admin Login (/login)                     --> Authenticated Dashboard Loaded
 4. Dispatch Schedule (/dashboard/jobs)      --> Business Hours & Techs Visible
 5. Customer Creation (/dashboard/customers) --> Customer & Property Created
 6. Technician Creation (/dashboard/techs)   --> Tech Profile Provisioned
 7. Job Dispatch (/dashboard/jobs)           --> Assigned to Tech
 8. Tech Mobile Workspace (/tech/jobs/[id])  --> En Route -> Arrived -> Working
 9. Time Clock (/tech/jobs/[id])             --> Clock In / Clock Out Recorded
10. Job Parts & Notes (/tech/jobs/[id])      --> Material Costs Logged
11. Customer Signature (/tech/jobs/[id])     --> Signature Captured & S3 Persisted
12. Job Completion (/tech/jobs/[id])         --> Status COMPLETED; Outbox Event Created
13. Worker Processing (Background)           --> Event Dispatched & Notification Sent
14. Invoice Generation (/dashboard/invoices) --> Labor + Materials + Taxes Calculated
15. Customer Portal (/p/[slug]/login)        --> Customer Views Job & Invoice
16. Stripe Payment (/pay/[token])            --> Webhook Received; Invoice Marked PAID
```

---

## GATE 14: Final Decision Framework

| Decision | Condition |
|---|---|
| 🟢 **GO** | All 13 gates verified in the live production deployment. Ready for 3 pilot plumbing companies. |
| 🟡 **HOLD** | Application tests pass, but live cloud environment has unverified S3 credentials, Redis queues, or Stripe Connect webhooks. Complete live verification before admitting users. |
| 🔴 **NO-GO** | Any cross-tenant data leak, webhook signature bypass, payment reconciliation error, or database connection failure occurs. Immediate halt and investigate. |
