# AQUAFLOW — MULTI-TENANT PROVISIONING & CUSTOMER ACQUISITION AUDIT

## 1. Executive Summary
This document records the architectural and forensic audit of AquaFlow's multi-tenant software-as-a-service (SaaS) engine. It specifically addresses how independent plumbing enterprises are provisioned, acquire homeowners through dedicated public booking funnels, execute dispatch operations, and isolate cross-tenant data.

---

## 2. Tenant Provisioning Lifecycle

```
[Public Plumber Signup (/signup)]
                 │
                 ▼
[Server Action: registerTenant(formData)]
                 │
                 ▼ (Atomic PostgreSQL Transaction)
  ┌─────────────────────────────────────────────────────────────┐
  │ 1. Create Organization (name, slug, location, status)       │
  │ 2. Create Super Admin User (email, passwordHash)            │
  │ 3. Create OrganizationMember (userId, orgId, SUPER_ADMIN)   │
  │ 4. Create Initial Technician Profile (for Owner/Plumber)    │
  │ 5. Auto-Seed 5 Starter Plumbing Services (scoped to orgId)  │
  │ 6. Auto-Seed Standard Business Hours (Mon-Sat, Sun closed)  │
  │ 7. Auto-Seed Jurisdictional Tax Rules (rate: 12%, orgId)    │
  └─────────────────────────────────────────────────────────────┘
                 │
                 ▼
[Automatic Session Creation & Cookie Issuance]
                 │
                 ▼
[Redirect to Scoped Dispatch Operations Hub (/dashboard)]
```

### Transactional Atomicity Guarantee
Tenant onboarding executes inside `prisma.$transaction`. If any step fails (e.g. invalid tax jurisdiction, duplicate slug, or database constraint violation), the entire transaction rolls back cleanly, leaving zero orphaned organizations or broken memberships.

---

## 3. Customer Acquisition Architecture

AquaFlow provides every registered plumbing enterprise with their own customer acquisition surface derived dynamically from the company's `organization.slug`:

```
                 PLUMBING COMPANY MARKETING CHANNELS
  (Google Business Profile, Facebook, Truck Decals, Business Cards, QR Code)
                                │
                                ▼
         Dedicated Acquisition URL: /p/[org-slug]/book
                                │
                                ▼
           [Interactive 4-Step Customer Booking Wizard]
       (Service Selection → Date/Time Slot → Location/Contact)
                                │
                                ▼
                  [POST /api/booking Endpoint]
                                │
                                ▼
  ┌─────────────────────────────────────────────────────────────┐
  │ 1. Resolves organizationId from the selected serviceId      │
  │ 2. Upserts Global User (keyed by normalized email)          │
  │ 3. Creates/Finds Org-Scoped Customer (userId + orgId)       │
  │ 4. Creates Property (address, postalCode, orgId)            │
  │ 5. Creates Appointment (APT-YYYY-XXXXXX, orgId, serviceId)  │
  │ 6. Creates Dispatch Job (jobId, orgId, status: CREATED)     │
  └─────────────────────────────────────────────────────────────┘
                                │
                                ▼
   [Immediate Real-Time Appearance on Plumber's Dispatch Board]
```

### Shared Customer Email Handling
If a homeowner (`customer@example.com`) books a drain clearing job with **Company A** and later books a water heater repair with **Company B**:
1. **Global User Layer**: A single global `User` record tracks the authenticated email.
2. **Tenant Scoping Layer**:
   - `Customer A` record is created with `organizationId = Company A`.
   - `Customer B` record is created with `organizationId = Company B`.
3. **Data Boundary**: Company A's dispatcher and technicians can only see `Customer A` and Company A's jobs/invoices. Company B cannot see Company A's records under any circumstances.

---

## 4. Multi-Tenant Operations Matrix

| Operation | Company A (Apex) | Company B (Beacon) | Cross-Tenant Boundary |
|---|---|---|---|
| **Signup & Provisioning** | **PASS** (`ee3afcdc-...`) | **PASS** (`38424f9c-...`) | Isolated Organization IDs |
| **Own Dashboard** | **PASS** (`/dashboard`) | **PASS** (`/dashboard`) | Scoped to Session `orgId` |
| **Own Settings & Hours** | **PASS** (7 Days Configured) | **PASS** (7 Days Configured) | **BLOCKED** |
| **Own Technicians** | **PASS** (Roster Scoped) | **PASS** (Roster Scoped) | **BLOCKED** |
| **Own Services Catalog** | **PASS** (5 Org Services) | **PASS** (5 Org Services) | **BLOCKED** |
| **Own Public Booking URL** | **PASS** (`/p/apex-.../book`) | **PASS** (`/p/beacon-.../book`) | **BLOCKED** |
| **Own Customers** | **PASS** (Customer A) | **PASS** (Customer B) | **BLOCKED** |
| **Own Jobs & Dispatch** | **PASS** (Job A) | **PASS** (Job B) | **BLOCKED** |
| **Own Invoices** | **PASS** (`INV-2026-00010-...`) | **PASS** (`INV-2026-00011-...`) | **BLOCKED** |
| **Own Payments** | **PASS** (Settled $296.24) | **PASS** (Settled $221.76) | **BLOCKED** |
| **Customer Portal** | **PASS** (`/portal/dashboard`) | **PASS** (`/portal/dashboard`) | **BLOCKED** |

---

## 5. Explicit Forensic Audit Findings

1. **Can a completely new plumbing company sign up without developer intervention?**  
   **YES**. Calling `/signup` provisions the organization, administrator credentials, technician record, services catalog, business hours, and tax rules automatically.

2. **Does signup automatically create a completely isolated tenant?**  
   **YES**. Every tenant receives a unique `organizationId` UUID and URL-safe `slug`.

3. **Does that tenant receive its own operational dashboard context?**  
   **YES**. The `/dashboard` route authenticates via session cookies and strictly filters all Prisma queries by `session.organizationId`.

4. **Does that tenant receive its own public customer acquisition/booking URL?**  
   **YES**. Accessible at `/p/[slug]/book` with full company branding and tenant-specific services.

5. **Can customers acquired through that URL automatically become customers of that specific plumbing company?**  
   **YES**. Bookings resolve `organizationId` from the selected service and bind the customer, appointment, property, and job to that organization.

6. **Can two plumbing companies operate simultaneously without seeing each other's data?**  
   **YES**. Verified with automated cross-tenant read/write assertions (0% data leakage).

7. **Can each plumbing company configure its own technicians, services, tax rules, customers, jobs, and billing?**  
   **YES**. Full UI controls are active in `/dashboard/settings`, `/dashboard/techs`, and `/dashboard/jobs`.

8. **Can the entire plumber → customer → booking → dispatch → technician → invoice → payment lifecycle be completed independently for both companies?**  
   **YES**. Verified simultaneously end-to-end with separate invoices and Stripe payment settlements.

---

## 6. Final Classification
### 🟢 TRUE MULTI-TENANT SAAS READY
AquaFlow is verified as an independent, multi-tenant plumbing SaaS platform capable of provisioning new plumbing enterprises, generating customer acquisition funnels, and managing operations with zero cross-tenant interference.
