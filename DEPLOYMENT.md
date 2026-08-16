# AquaFlow Production Deployment Pipeline

To ensure reliability for paying customers, the deployment pipeline strictly separates environments and enforces security verifications before code reaches production.

## Environment Architecture

1. **Local Development (`dev`)**: SQLite database. Unstable. Used by engineers.
2. **Staging / CI (`staging`)**: PostgreSQL database (ephemeral or shared). Mirrors production data shapes. Used for automated tests.
3. **Production (`prod`)**: High-availability PostgreSQL. Used by actual plumbing organizations.

## Deployment Pipeline (CI/CD)

The pipeline is triggered automatically on merge to the `main` branch.

### 1. Build & Lint (CI)
- `npm run lint` (ESLint)
- `npm run type-check` (tsc)
- `npm run build` (Next.js production build)

### 2. Automated Testing (CI)
- **Unit Tests**: `npm run test` (Vitest)
- **Security Regression**: Executes the tenant isolation suite against a fresh DB schema.
  - Validates cross-tenant boundaries.
  - Ensures password hashing and secret redaction works.

### 3. Database Migration Rehearsal (Staging)
- An automated process restores a scrubbed nightly backup of Production into a temporary Staging database.
- `npx prisma migrate deploy` is run against this restored database.
- If the migration fails or takes longer than 15 minutes, the pipeline HALTS to prevent production downtime.

### 4. Production Release (CD)
- Once steps 1-3 pass, the build artifact is promoted to the Production environment (e.g., Vercel, AWS).
- **Zero-Downtime DB Migration**: `npx prisma migrate deploy` is executed on the production database *before* the new application code goes live.

## Incident Recovery

### Database Recovery
1. Automated daily snapshots are maintained by the database provider.
2. Point-in-time recovery (PITR) is enabled for the last 7 days.
3. To recover, run the `scripts/test-db-restore.ts` procedure (adapted for pg_restore) pointing to the snapshot URL.

### Queue Failure
1. BullMQ automatically retries failed events with exponential backoff.
2. If a job fails 3 times, it is sent to the `DEAD_LETTER` state in the database.
3. Engineering can manually replay Dead Letter jobs from the Admin Dashboard after fixing the underlying provider issue (e.g. Stripe API down).
