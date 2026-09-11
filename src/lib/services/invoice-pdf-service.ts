import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { createHash } from 'crypto';

export interface GenerateInvoicePdfOptions {
  invoice: {
    invoiceNumber: string;
    versionNumber: number;
    issueDate: Date | string;
    dueDate: Date | string | null;
    currency: string;
    subtotal: number;
    taxTotal: number;
    total: number;
    amountPaid?: number;
    terms?: string;
  };
  organization: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    province?: string | null;
    postalCode?: string | null;
  };
  customer: {
    name: string;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  };
  lines: Array<{
    description: string;
    quantity: number;
    unitCost: number;
    total: number;
  }>;
  taxes: Array<{
    name: string;
    rate: number;
    amount: number;
  }>;
  signature?: {
    signerName: string;
    signerEmail: string;
    signatureDate: Date | string;
    consentAccepted: boolean;
    consentVersion: string;
    signatureId: string;
    canonicalDocumentHash: string;
    signatureData?: string | null; // Base64 PNG image or null
  };
}

export class InvoicePdfService {
  /**
   * Generates an immutable, static PDF snapshot representing the exact invoice.
   * Calculates the SHA-256 hash of the generated PDF buffer.
   */
  static async generateInvoicePdf(options: GenerateInvoicePdfOptions): Promise<{ buffer: Buffer; pdfHash: string }> {
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Standard US Letter (8.5 x 11 inches)
    const { width, height } = page.getSize();

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

    const primaryColor = rgb(0.08, 0.2, 0.38); // Deep Navy
    const neutralDark = rgb(0.12, 0.14, 0.18); // Almost Black
    const neutralMuted = rgb(0.45, 0.48, 0.53); // Slate Grey
    const lightBg = rgb(0.96, 0.97, 0.98); // Off-white
    const borderColor = rgb(0.85, 0.88, 0.92);

    let y = height - 50;

    // 1. Header: Organization & Invoice Badge
    page.drawText(options.organization.name || 'FlowLoopOS Merchant', {
      x: 50,
      y,
      size: 20,
      font: fontBold,
      color: primaryColor,
    });

    const invBadgeText = `INVOICE #${options.invoice.invoiceNumber}`;
    const badgeWidth = fontBold.widthOfTextAtSize(invBadgeText, 12);
    page.drawText(invBadgeText, {
      x: width - 50 - badgeWidth,
      y: y + 4,
      size: 12,
      font: fontBold,
      color: primaryColor,
    });

    const verText = `Version ${options.invoice.versionNumber}`;
    const verWidth = fontRegular.widthOfTextAtSize(verText, 9);
    page.drawText(verText, {
      x: width - 50 - verWidth,
      y: y - 10,
      size: 9,
      font: fontRegular,
      color: neutralMuted,
    });

    y -= 25;

    // Org Sub-details
    const orgLines = [
      options.organization.address,
      [options.organization.city, options.organization.province, options.organization.postalCode].filter(Boolean).join(', '),
      options.organization.phone,
      options.organization.email,
    ].filter(Boolean) as string[];

    for (const line of orgLines) {
      page.drawText(line, { x: 50, y, size: 9, font: fontRegular, color: neutralMuted });
      y -= 12;
    }

    y -= 15;

    // 2. Metadata Grid (Bill To vs Invoice Dates)
    const billToY = y;
    page.drawText('BILLED TO:', { x: 50, y: billToY, size: 9, font: fontBold, color: neutralMuted });
    page.drawText(options.customer.name, { x: 50, y: billToY - 14, size: 11, font: fontBold, color: neutralDark });
    
    let custOffset = 28;
    if (options.customer.address) {
      page.drawText(options.customer.address, { x: 50, y: billToY - custOffset, size: 9, font: fontRegular, color: neutralDark });
      custOffset += 13;
    }
    if (options.customer.email) {
      page.drawText(options.customer.email, { x: 50, y: billToY - custOffset, size: 9, font: fontRegular, color: neutralDark });
      custOffset += 13;
    }

    // Dates Column
    const dateColX = width - 200;
    const issueDateStr = typeof options.invoice.issueDate === 'string' 
      ? options.invoice.issueDate 
      : options.invoice.issueDate.toISOString().split('T')[0];
    const dueDateStr = options.invoice.dueDate 
      ? (typeof options.invoice.dueDate === 'string' ? options.invoice.dueDate : options.invoice.dueDate.toISOString().split('T')[0])
      : 'Upon Receipt';

    page.drawText('INVOICE DATE:', { x: dateColX, y: billToY, size: 9, font: fontBold, color: neutralMuted });
    page.drawText(issueDateStr, { x: dateColX + 90, y: billToY, size: 9, font: fontRegular, color: neutralDark });

    page.drawText('DUE DATE:', { x: dateColX, y: billToY - 15, size: 9, font: fontBold, color: neutralMuted });
    page.drawText(dueDateStr, { x: dateColX + 90, y: billToY - 15, size: 9, font: fontRegular, color: neutralDark });

    y = billToY - Math.max(custOffset, 35) - 20;

    // 3. Line Items Table Header
    page.drawRectangle({
      x: 50,
      y: y - 6,
      width: width - 100,
      height: 22,
      color: lightBg,
    });

    page.drawText('DESCRIPTION', { x: 58, y: y, size: 9, font: fontBold, color: primaryColor });
    page.drawText('QTY', { x: 360, y: y, size: 9, font: fontBold, color: primaryColor });
    page.drawText('UNIT PRICE', { x: 420, y: y, size: 9, font: fontBold, color: primaryColor });
    page.drawText('TOTAL', { x: 510, y: y, size: 9, font: fontBold, color: primaryColor });

    y -= 20;

    // 4. Line Items Rows
    for (const item of options.lines) {
      page.drawLine({
        start: { x: 50, y: y + 14 },
        end: { x: width - 50, y: y + 14 },
        thickness: 0.5,
        color: borderColor,
      });

      page.drawText(item.description.slice(0, 50), { x: 58, y, size: 9, font: fontRegular, color: neutralDark });
      page.drawText(item.quantity.toFixed(2), { x: 360, y, size: 9, font: fontRegular, color: neutralDark });
      page.drawText(`$${item.unitCost.toFixed(2)}`, { x: 420, y, size: 9, font: fontRegular, color: neutralDark });
      page.drawText(`$${item.total.toFixed(2)}`, { x: 510, y, size: 9, font: fontBold, color: neutralDark });

      y -= 20;
    }

    y -= 10;

    // 5. Totals Box
    const totalsX = width - 240;
    page.drawLine({ start: { x: totalsX, y: y + 10 }, end: { x: width - 50, y: y + 10 }, thickness: 1, color: borderColor });

    page.drawText('Subtotal:', { x: totalsX, y, size: 9, font: fontRegular, color: neutralMuted });
    page.drawText(`$${options.invoice.subtotal.toFixed(2)}`, { x: width - 50 - fontRegular.widthOfTextAtSize(`$${options.invoice.subtotal.toFixed(2)}`, 9), y, size: 9, font: fontRegular, color: neutralDark });
    y -= 14;

    for (const tax of options.taxes) {
      page.drawText(`${tax.name} (${(tax.rate * 100).toFixed(1)}%):`, { x: totalsX, y, size: 9, font: fontRegular, color: neutralMuted });
      const taxVal = `$${tax.amount.toFixed(2)}`;
      page.drawText(taxVal, { x: width - 50 - fontRegular.widthOfTextAtSize(taxVal, 9), y, size: 9, font: fontRegular, color: neutralDark });
      y -= 14;
    }

    if (options.invoice.amountPaid && options.invoice.amountPaid > 0) {
      page.drawText('Amount Paid:', { x: totalsX, y, size: 9, font: fontRegular, color: rgb(0.1, 0.6, 0.2) });
      const paidVal = `-$${options.invoice.amountPaid.toFixed(2)}`;
      page.drawText(paidVal, { x: width - 50 - fontRegular.widthOfTextAtSize(paidVal, 9), y, size: 9, font: fontRegular, color: rgb(0.1, 0.6, 0.2) });
      y -= 14;
    }

    page.drawLine({ start: { x: totalsX, y: y + 5 }, end: { x: width - 50, y: y + 5 }, thickness: 1, color: borderColor });
    page.drawText('Total Due (CAD):', { x: totalsX, y: y - 8, size: 11, font: fontBold, color: primaryColor });
    const totalDueVal = `$${(options.invoice.total - (options.invoice.amountPaid || 0)).toFixed(2)}`;
    page.drawText(totalDueVal, { x: width - 50 - fontBold.widthOfTextAtSize(totalDueVal, 12), y: y - 8, size: 12, font: fontBold, color: primaryColor });

    y -= 45;

    // 6. Electronic Signature & Verification Certificate Section (Only customer-permitted metadata)
    if (options.signature) {
      const certBoxHeight = 110;
      page.drawRectangle({
        x: 50,
        y: y - certBoxHeight + 14,
        width: width - 100,
        height: certBoxHeight,
        color: rgb(0.98, 0.99, 1.0),
        borderColor: rgb(0.75, 0.85, 0.95),
        borderWidth: 1,
      });

      page.drawText('FLOWLOOPOS ELECTRONIC SIGNATURE & VERIFICATION CERTIFICATE', {
        x: 62,
        y,
        size: 8.5,
        font: fontBold,
        color: primaryColor,
      });

      y -= 16;
      page.drawText(`Electronically Signed By: ${options.signature.signerName} (${options.signature.signerEmail})`, {
        x: 62,
        y,
        size: 8,
        font: fontRegular,
        color: neutralDark,
      });

      const sigDateStr = typeof options.signature.signatureDate === 'string'
        ? options.signature.signatureDate
        : options.signature.signatureDate.toUTCString();

      y -= 12;
      page.drawText(`Date & Time:             ${sigDateStr}`, {
        x: 62,
        y,
        size: 8,
        font: fontRegular,
        color: neutralDark,
      });

      y -= 12;
      page.drawText(`Electronic Consent:       AFFIRMATIVELY ACCEPTED (Version ${options.signature.consentVersion})`, {
        x: 62,
        y,
        size: 8,
        font: fontRegular,
        color: neutralDark,
      });

      y -= 12;
      page.drawText(`FlowLoopOS Signature ID:  ${options.signature.signatureId}`, {
        x: 62,
        y,
        size: 8,
        font: fontMono,
        color: neutralDark,
      });

      y -= 12;
      page.drawText(`Canonical Snapshot Hash:  ${options.signature.canonicalDocumentHash}`, {
        x: 62,
        y,
        size: 7.5,
        font: fontMono,
        color: neutralMuted,
      });

      // Optional signature image rendering if provided
      if (options.signature.signatureData && options.signature.signatureData.startsWith('data:image/png;base64,')) {
        try {
          const pngBase64 = options.signature.signatureData.replace(/^data:image\/png;base64,/, '');
          const pngBytes = Buffer.from(pngBase64, 'base64');
          const embeddedImage = await pdfDoc.embedPng(pngBytes);
          page.drawImage(embeddedImage, {
            x: width - 180,
            y: y + 2,
            width: 110,
            height: 40,
          });
        } catch {
          // Fallback to text signature if image embedding fails
        }
      }

      y -= 30;
    }

    // 7. Standard Product Posture / Disclaimer (Refinement #14)
    const disclaimer = 'FlowLoopOS provides electronic signing, document integrity controls, and an auditable electronic record designed to support electronic transactions and evidentiary requirements. FlowLoopOS does not provide legal advice or guarantee enforceability in a particular dispute or jurisdiction.';
    page.drawText(disclaimer, {
      x: 50,
      y: 35,
      size: 6.5,
      font: fontRegular,
      color: neutralMuted,
      maxWidth: width - 100,
      lineHeight: 8.5,
    });

    const pdfBytes = await pdfDoc.save();
    const buffer = Buffer.from(pdfBytes);
    const pdfHash = createHash('sha256').update(buffer).digest('hex');

    return { buffer, pdfHash };
  }
}
