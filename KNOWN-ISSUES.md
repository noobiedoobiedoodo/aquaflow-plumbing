# KNOWN ISSUES & ACCEPTED RISKS

## 1. Prisma Build-Time Dependency Vulnerability (`deepmerge-ts`)

- **Advisory**: [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx)
- **Affected Dependency**: `deepmerge-ts` (< 8.0.0) transitive dependency in `@prisma/config` via `prisma` CLI (v7.9.1).
- **Upstream Severity**: High
- **AquaFlow Contextual Runtime Risk**: Low
- **Affected Component**: Prisma CLI/config build-time dependency (`@prisma/config`)
- **Runtime Exposure**: Not identified
- **Risk Assessment**: No identified production application-runtime attack path; residual risk is confined to trusted build/deployment execution.
- **Mitigation**: Static trusted Prisma configuration (`prisma.config.ts`); runtime uses `@prisma/client` + `@prisma/adapter-pg`.
- **Remediation Trigger**: When Prisma releases a compatible patched dependency for `@prisma/config`.
- **Monitoring Plan**:
  1. Record exact advisory (GHSA-ggr8-5vv4-36mx).
  2. Monitor Prisma release notes for patch availability.
  3. Run the full 277+ automated test suite, typecheck, and production build upon upgrade.
  4. Update this document upon resolution.

---

## 2. Pinned Engine Dependencies

- **Node.js**: Pinned to `>=20.0.0 <23.0.0` (validated against Node v22.14.0 LTS).
- **Next.js**: 16.3.1 (Turbopack).
- **PostgreSQL**: Requires PostgreSQL 15+ with `pgcrypto` / UUID support.
- **Redis**: Requires Redis 6.2+ / Upstash Redis for BullMQ atomic scripts.
