'use server';

import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { getCustomerSession } from '@/lib/auth/customer-session';
import { getSessionFromCookies, validateSession } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/constants';
import { InvoiceSigningService } from '@/lib/services/invoice-signing-service';
import { InvoiceIntegrityService } from '@/lib/services/invoice-integrity-service';

/**
 * Extracts client IP and User Agent securely from request headers.
 */
async function getClientContext() {
  const headerList = await headers();
  const forwardedFor = headerList.get('x-forwarded-for');
  const ipAddress = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1';
  const userAgent = headerList.get('user-agent') || 'Unknown User-Agent';
  return { ipAddress, userAgent };
}

/**
 * Authenticates either customer session or payment capability token,
 * resolving customerId and organizationId securely (STRENGTHENED TENANT ISOLATION).
 */
async function resolvePrincipalForInvoice(invoiceId: string, paymentToken?: string) {
  const customerSession = await getCustomerSession();
  const { ipAddress, userAgent } = await getClientContext();

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { customer: true, organization: true },
  });

  if (!invoice) {
    throw new Error('Invoice not found.');
  }

  // Path 1: Authenticated Customer Portal Session
  if (customerSession) {
    if (customerSession.customerId !== invoice.customerId) {
      throw new Error('Unauthorized: This invoice does not belong to your customer account.');
    }
    return {
      organizationId: invoice.organizationId,
      customerId: invoice.customerId,
      authenticationMethod: 'CUSTOMER_PORTAL_SESSION' as const,
      sessionId: customerSession.sessionId,
      ipAddress,
      userAgent,
      invoice,
    };
  }

  // Path 2: Public Secure Capability Token
  if (paymentToken && paymentToken === invoice.paymentToken) {
    return {
      organizationId: invoice.organizationId,
      customerId: invoice.customerId,
      authenticationMethod: 'SECURE_TOKEN_LINK' as const,
      sessionId: undefined,
      ipAddress,
      userAgent,
      invoice,
    };
  }

  throw new Error('Unauthorized: Active customer session or valid capability token is required.');
}

/**
 * Server Action: Records affirmative electronic transaction consent.
 */
export async function recordElectronicConsentAction(
  invoiceId: string,
  versionNumber: number,
  consented: boolean,
  paymentToken?: string
) {
  const principal = await resolvePrincipalForInvoice(invoiceId, paymentToken);

  const consentRecord = await InvoiceSigningService.recordConsent({
    organizationId: principal.organizationId,
    invoiceId,
    versionNumber,
    customerId: principal.customerId,
    consented,
    ipAddress: principal.ipAddress,
    userAgent: principal.userAgent,
    sessionId: principal.sessionId,
  });

  return { success: true, consentRecordId: consentRecord.id };
}

/**
 * Server Action: Signs an invoice version with affirmative consent,
 * creating an immutable static PDF snapshot and recording cryptographic hashes.
 */
export async function signInvoiceAction(
  invoiceId: string,
  versionNumber: number,
  consentRecordId: string,
  signerName: string,
  signerEmail: string,
  signatureMethod: 'DRAWN_CANVAS' | 'TYPED' | 'DIGITAL_CLICK',
  signatureData?: string | null,
  paymentToken?: string,
  timezone?: string
) {
  const principal = await resolvePrincipalForInvoice(invoiceId, paymentToken);

  const result = await InvoiceSigningService.signInvoice({
    organizationId: principal.organizationId,
    invoiceId,
    versionNumber,
    customerId: principal.customerId,
    consentRecordId,
    signerName,
    signerEmail,
    signatureMethod,
    signatureData,
    ipAddress: principal.ipAddress,
    userAgent: principal.userAgent,
    sessionId: principal.sessionId,
    authenticationMethod: principal.authenticationMethod,
    timezone: timezone || 'America/Winnipeg',
  });

  return result;
}

/**
 * Server Action: Dynamically verifies the cryptographic integrity of an invoice version and its stored PDF.
 */
export async function verifyInvoiceIntegrityAction(invoiceId: string, versionNumber: number) {
  // Staff or Customer verification
  const staffToken = await getSessionFromCookies();
  const customerSession = await getCustomerSession();

  let targetOrgId: string | null = null;

  if (staffToken) {
    const session = await validateSession(staffToken);
    if (session) {
      const activeOrg = session.user.memberships.find((m) => ADMIN_ROLES.includes(m.role as any));
      if (activeOrg) targetOrgId = activeOrg.organizationId;
    }
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { organizationId: true, customerId: true },
  });

  if (!invoice) throw new Error('Invoice not found.');

  if (!targetOrgId && customerSession) {
    if (customerSession.customerId === invoice.customerId) {
      targetOrgId = invoice.organizationId;
    }
  }

  if (!targetOrgId || targetOrgId !== invoice.organizationId) {
    throw new Error('Unauthorized or cross-tenant access denied.');
  }

  return await InvoiceIntegrityService.verifyComprehensiveEvidence(targetOrgId, invoiceId, versionNumber);
}

/**
 * Server Action: Fetches the read-only audit timeline for an invoice.
 */
export async function getInvoiceAuditTimelineAction(invoiceId: string) {
  const staffToken = await getSessionFromCookies();
  if (!staffToken) throw new Error('Staff authentication required.');
  const session = await validateSession(staffToken);
  if (!session) throw new Error('Invalid session.');

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { organizationId: true },
  });
  if (!invoice) throw new Error('Invoice not found.');

  const hasMembership = session.user.memberships.some(
    (m) => m.organizationId === invoice.organizationId && ADMIN_ROLES.includes(m.role as any)
  );
  if (!hasMembership) throw new Error('Forbidden: Cross-tenant access denied.');

  const events = await prisma.invoiceAuditEvent.findMany({
    where: { invoiceId, organizationId: invoice.organizationId },
    orderBy: { createdAt: 'desc' },
  });

  return events;
}
