-- FlowLoopOS Electronic Invoice Signing, Versioning & Evidence Subsystem
-- Migration: 20260911210000_electronic_invoice_signing_and_evidence

-- 1. Alter Invoice Table with Versioning & Immutability Fields
ALTER TABLE "Invoice" 
ADD COLUMN IF NOT EXISTS "currentVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN IF NOT EXISTS "isImmutable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT,
ADD COLUMN IF NOT EXISTS "stripeInvoiceId" TEXT,
ADD COLUMN IF NOT EXISTS "stripePaymentIntentId" TEXT;

-- 2. Create InvoiceVersion Table
CREATE TABLE IF NOT EXISTS "InvoiceVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL DEFAULT 1,
    "snapshotData" TEXT NOT NULL,
    "canonicalDocumentHash" TEXT NOT NULL,
    "signedPdfHash" TEXT,
    "signedPdfKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "signingLockId" TEXT,
    "signingLockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceVersion_pkey" PRIMARY KEY ("id")
);

-- 3. Create InvoiceConsentRecord Table
CREATE TABLE IF NOT EXISTS "InvoiceConsentRecord" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "invoiceVersionId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "consentText" TEXT NOT NULL,
    "consentTextVersion" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "sessionId" TEXT,
    "requestId" TEXT,

    CONSTRAINT "InvoiceConsentRecord_pkey" PRIMARY KEY ("id")
);

-- 4. Create InvoiceSignature Table
CREATE TABLE IF NOT EXISTS "InvoiceSignature" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "invoiceVersionId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "consentRecordId" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerEmail" TEXT NOT NULL,
    "signatureMethod" TEXT NOT NULL,
    "signatureData" TEXT,
    "canonicalDocumentHash" TEXT NOT NULL,
    "signedPdfHash" TEXT NOT NULL,
    "signedPdfKey" TEXT NOT NULL,
    "signatureTimestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipAddress" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Winnipeg',
    "requestId" TEXT,
    "sessionId" TEXT,
    "authenticationMethod" TEXT NOT NULL,
    "signatureStatus" TEXT NOT NULL DEFAULT 'VALID',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceSignature_pkey" PRIMARY KEY ("id")
);

-- 5. Create InvoiceAuditEvent Table
CREATE TABLE IF NOT EXISTS "InvoiceAuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "invoiceVersionId" TEXT,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventDetails" TEXT NOT NULL,
    "canonicalDocumentHash" TEXT,
    "signedPdfHash" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceAuditEvent_pkey" PRIMARY KEY ("id")
);

-- 6. Indexes
CREATE INDEX IF NOT EXISTS "InvoiceVersion_organizationId_idx" ON "InvoiceVersion"("organizationId");
CREATE INDEX IF NOT EXISTS "InvoiceVersion_canonicalDocumentHash_idx" ON "InvoiceVersion"("canonicalDocumentHash");
CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceVersion_invoiceId_versionNumber_key" ON "InvoiceVersion"("invoiceId", "versionNumber");

CREATE INDEX IF NOT EXISTS "InvoiceConsentRecord_organizationId_idx" ON "InvoiceConsentRecord"("organizationId");
CREATE INDEX IF NOT EXISTS "InvoiceConsentRecord_invoiceId_idx" ON "InvoiceConsentRecord"("invoiceId");
CREATE INDEX IF NOT EXISTS "InvoiceConsentRecord_invoiceVersionId_idx" ON "InvoiceConsentRecord"("invoiceVersionId");

CREATE INDEX IF NOT EXISTS "InvoiceSignature_organizationId_idx" ON "InvoiceSignature"("organizationId");
CREATE INDEX IF NOT EXISTS "InvoiceSignature_invoiceId_idx" ON "InvoiceSignature"("invoiceId");
CREATE INDEX IF NOT EXISTS "InvoiceSignature_canonicalDocumentHash_idx" ON "InvoiceSignature"("canonicalDocumentHash");
CREATE INDEX IF NOT EXISTS "InvoiceSignature_signedPdfHash_idx" ON "InvoiceSignature"("signedPdfHash");
CREATE UNIQUE INDEX IF NOT EXISTS "InvoiceSignature_organizationId_invoiceVersionId_key" ON "InvoiceSignature"("organizationId", "invoiceVersionId");

CREATE INDEX IF NOT EXISTS "InvoiceAuditEvent_organizationId_invoiceId_idx" ON "InvoiceAuditEvent"("organizationId", "invoiceId");
CREATE INDEX IF NOT EXISTS "InvoiceAuditEvent_invoiceId_createdAt_idx" ON "InvoiceAuditEvent"("invoiceId", "createdAt");

-- 7. Foreign Key Constraints
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceVersion_invoiceId_fkey') THEN
        ALTER TABLE "InvoiceVersion" ADD CONSTRAINT "InvoiceVersion_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceVersion_organizationId_fkey') THEN
        ALTER TABLE "InvoiceVersion" ADD CONSTRAINT "InvoiceVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceConsentRecord_invoiceId_fkey') THEN
        ALTER TABLE "InvoiceConsentRecord" ADD CONSTRAINT "InvoiceConsentRecord_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceConsentRecord_invoiceVersionId_fkey') THEN
        ALTER TABLE "InvoiceConsentRecord" ADD CONSTRAINT "InvoiceConsentRecord_invoiceVersionId_fkey" FOREIGN KEY ("invoiceVersionId") REFERENCES "InvoiceVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceConsentRecord_organizationId_fkey') THEN
        ALTER TABLE "InvoiceConsentRecord" ADD CONSTRAINT "InvoiceConsentRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceConsentRecord_customerId_fkey') THEN
        ALTER TABLE "InvoiceConsentRecord" ADD CONSTRAINT "InvoiceConsentRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceSignature_invoiceId_fkey') THEN
        ALTER TABLE "InvoiceSignature" ADD CONSTRAINT "InvoiceSignature_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceSignature_invoiceVersionId_fkey') THEN
        ALTER TABLE "InvoiceSignature" ADD CONSTRAINT "InvoiceSignature_invoiceVersionId_fkey" FOREIGN KEY ("invoiceVersionId") REFERENCES "InvoiceVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceSignature_organizationId_fkey') THEN
        ALTER TABLE "InvoiceSignature" ADD CONSTRAINT "InvoiceSignature_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceSignature_customerId_fkey') THEN
        ALTER TABLE "InvoiceSignature" ADD CONSTRAINT "InvoiceSignature_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceSignature_consentRecordId_fkey') THEN
        ALTER TABLE "InvoiceSignature" ADD CONSTRAINT "InvoiceSignature_consentRecordId_fkey" FOREIGN KEY ("consentRecordId") REFERENCES "InvoiceConsentRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceAuditEvent_invoiceId_fkey') THEN
        ALTER TABLE "InvoiceAuditEvent" ADD CONSTRAINT "InvoiceAuditEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceAuditEvent_invoiceVersionId_fkey') THEN
        ALTER TABLE "InvoiceAuditEvent" ADD CONSTRAINT "InvoiceAuditEvent_invoiceVersionId_fkey" FOREIGN KEY ("invoiceVersionId") REFERENCES "InvoiceVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InvoiceAuditEvent_organizationId_fkey') THEN
        ALTER TABLE "InvoiceAuditEvent" ADD CONSTRAINT "InvoiceAuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
