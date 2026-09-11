import { createHash } from 'crypto';

export interface CanonicalInvoiceLine {
  description: string;
  quantity: number;
  unitCost: number;
  total: number;
}

export interface CanonicalInvoiceTax {
  name: string;
  jurisdiction: string;
  rate: number;
  amount: number;
}

export interface CanonicalInvoicePayload {
  organizationId: string;
  invoiceNumber: string;
  versionNumber: number;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  currency: string;
  issueDate: string;
  dueDate: string | null;
  subtotal: number;
  taxTotal: number;
  total: number;
  lines: CanonicalInvoiceLine[];
  taxes: CanonicalInvoiceTax[];
  terms: string;
}

/**
 * Deterministically sort and format object keys recursively so that identical
 * invoice data always produces the exact same string representation and SHA-256 hash.
 */
function canonicalizeValue(value: any): any {
  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(canonicalizeValue);
  }

  const sortedObj: Record<string, any> = {};
  const keys = Object.keys(value).sort();
  for (const key of keys) {
    sortedObj[key] = canonicalizeValue(value[key]);
  }
  return sortedObj;
}

export class InvoiceCanonicalizer {
  /**
   * Builds the canonical invoice snapshot object with sorted arrays and normalized numbers.
   */
  static buildPayload(data: CanonicalInvoicePayload): CanonicalInvoicePayload {
    const sortedLines = [...data.lines]
      .sort((a, b) => a.description.localeCompare(b.description) || a.unitCost - b.unitCost)
      .map((l) => ({
        description: l.description.trim(),
        quantity: Number(l.quantity.toFixed(2)),
        unitCost: Number(l.unitCost.toFixed(2)),
        total: Number((l.quantity * l.unitCost).toFixed(2)),
      }));

    const sortedTaxes = [...data.taxes]
      .sort((a, b) => a.name.localeCompare(b.name) || a.rate - b.rate)
      .map((t) => ({
        name: t.name.trim(),
        jurisdiction: t.jurisdiction.trim(),
        rate: Number(t.rate.toFixed(4)),
        amount: Number(t.amount.toFixed(2)),
      }));

    return {
      organizationId: data.organizationId,
      invoiceNumber: data.invoiceNumber,
      versionNumber: data.versionNumber,
      customerId: data.customerId,
      customerName: data.customerName.trim(),
      customerEmail: data.customerEmail?.trim() || '',
      currency: data.currency.toUpperCase(),
      issueDate: data.issueDate,
      dueDate: data.dueDate,
      subtotal: Number(data.subtotal.toFixed(2)),
      taxTotal: Number(data.taxTotal.toFixed(2)),
      total: Number(data.total.toFixed(2)),
      lines: sortedLines,
      taxes: sortedTaxes,
      terms: data.terms.trim(),
    };
  }

  /**
   * Serializes the canonical invoice payload to a deterministic JSON string.
   */
  static stringify(payload: CanonicalInvoicePayload): string {
    const canonicalObj = canonicalizeValue(payload);
    return JSON.stringify(canonicalObj);
  }

  /**
   * Calculates the SHA-256 hash of the canonical invoice string.
   */
  static hash(canonicalJson: string): string {
    return createHash('sha256').update(canonicalJson, 'utf8').digest('hex');
  }

  /**
   * Verifies if a given canonical JSON matches an expected hash.
   */
  static verifyHash(canonicalJson: string, expectedHash: string): boolean {
    const computed = this.hash(canonicalJson);
    return computed.toLowerCase() === expectedHash.toLowerCase();
  }
}
