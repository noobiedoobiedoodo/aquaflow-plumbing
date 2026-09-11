import 'dotenv/config';
import { prisma } from '../src/lib/db';
import { InvoiceVersioningService } from '../src/lib/services/invoice-versioning-service';

/**
 * Idempotent backfill script for existing historical invoices.
 * Ensures every existing invoice has a corresponding InvoiceVersion (v1) and canonical hash.
 * Completely safe: does NOT mutate or delete existing invoices, payments, jobs, or customer signatures.
 */
async function backfillHistoricalInvoices() {
  console.log('--- Starting FlowLoopOS Historical Invoice Backfill ---');

  const invoicesWithoutVersion = await prisma.invoice.findMany({
    where: {
      versions: {
        none: {},
      },
    },
    select: {
      id: true,
      invoiceNumber: true,
      organizationId: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`Found ${invoicesWithoutVersion.length} invoices requiring Version 1 initialization.`);

  let initializedCount = 0;
  let errorCount = 0;

  for (const inv of invoicesWithoutVersion) {
    try {
      await prisma.$transaction(async (tx) => {
        await InvoiceVersioningService.initializeVersionOne(tx, inv.organizationId, inv.id);
      });
      initializedCount++;
      console.log(`[OK] Initialized Version 1 for ${inv.invoiceNumber} (${inv.id})`);
    } catch (err: any) {
      errorCount++;
      console.error(`[ERROR] Failed to backfill ${inv.invoiceNumber}: ${err.message}`);
    }
  }

  console.log('--- Backfill Summary ---');
  console.log(`Successfully initialized: ${initializedCount}`);
  console.log(`Errors encountered:      ${errorCount}`);
  console.log('--- Finished ---');
}

backfillHistoricalInvoices()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Fatal backfill error:', e);
    process.exit(1);
  });
