-- DropRedundantIndexes
DROP INDEX IF EXISTS "Appointment_appointmentNumber_idx";
DROP INDEX IF EXISTS "Invoice_paymentToken_idx";
DROP INDEX IF EXISTS "Payment_providerPaymentId_idx";

-- CreateQueueAndFKIndexes
CREATE INDEX IF NOT EXISTS "JobTimeEntry_technicianId_idx" ON "JobTimeEntry"("technicianId");
CREATE INDEX IF NOT EXISTS "Event_status_createdAt_idx" ON "Event"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Notification_status_scheduledFor_idx" ON "Notification"("status", "scheduledFor");
CREATE INDEX IF NOT EXISTS "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateTable pilot_applications
CREATE TABLE IF NOT EXISTS "pilot_applications" (
    "id" TEXT NOT NULL,
    "company_name" VARCHAR(255) NOT NULL,
    "contact_name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(100) NOT NULL,
    "website" VARCHAR(255),
    "city" VARCHAR(100) NOT NULL,
    "province" VARCHAR(100) NOT NULL,
    "technician_count" VARCHAR(100) NOT NULL,
    "pain_points" TEXT NOT NULL,
    "notes" TEXT,
    "status" VARCHAR(50) NOT NULL DEFAULT 'NEW',
    "source" VARCHAR(100) NOT NULL DEFAULT 'direct',
    "utm_source" VARCHAR(255),
    "utm_medium" VARCHAR(255),
    "utm_campaign" VARCHAR(255),
    "utm_content" VARCHAR(255),
    "referrer" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pilot_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable cold_prospects
CREATE TABLE IF NOT EXISTS "cold_prospects" (
    "id" TEXT NOT NULL,
    "company_name" VARCHAR(255) NOT NULL,
    "contact_name" VARCHAR(255) NOT NULL,
    "title" VARCHAR(100) NOT NULL DEFAULT 'Owner',
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(100) NOT NULL,
    "website" VARCHAR(255),
    "city" VARCHAR(100) NOT NULL,
    "state" VARCHAR(50) NOT NULL,
    "technician_count" VARCHAR(100) NOT NULL,
    "pain_points" TEXT NOT NULL,
    "interest_level" VARCHAR(20) NOT NULL DEFAULT 'UNDECIDED',
    "outreach_status" VARCHAR(50) NOT NULL DEFAULT 'NOT_CONTACTED',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cold_prospects_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes on lead tables
CREATE INDEX IF NOT EXISTS "pilot_applications_email_idx" ON "pilot_applications"("email");
CREATE INDEX IF NOT EXISTS "pilot_applications_status_idx" ON "pilot_applications"("status");
CREATE UNIQUE INDEX IF NOT EXISTS "cold_prospects_email_key" ON "cold_prospects"("email");
CREATE INDEX IF NOT EXISTS "cold_prospects_state_idx" ON "cold_prospects"("state");
CREATE INDEX IF NOT EXISTS "cold_prospects_interest_level_idx" ON "cold_prospects"("interest_level");
