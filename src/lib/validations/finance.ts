import { z } from 'zod';

export const ProcessPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().positive(),
  paymentMethodId: z.string().startsWith('pm_').max(100),
});

export const GenerateInvoiceSchema = z.object({
  jobId: z.string().uuid(),
  items: z.array(z.object({
    description: z.string().min(1).max(200),
    quantity: z.number().positive(),
    unitCost: z.number().positive()
  })).max(100)
});

export const GenerateInvoiceFromJobSchema = z.object({
  jobId: z.string().uuid(),
  laborHourlyRate: z.number().positive().max(1000).optional()
});
