'use server';

import { prisma } from '@/lib/db';
import { requireRoleInOrg } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/constants';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { emailSchema, phoneSchema, postalCodeSchema } from '@/lib/validation/common.schema';

const CreateCustomerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: z.string().trim().min(1, 'Last name is required').max(100),
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal('')),
  notes: z.string().trim().max(2000).optional(),
  address: z.string().trim().min(1, 'Street address is required').max(200),
  unit: z.string().trim().max(50).optional(),
  city: z.string().trim().min(1, 'City is required').max(100),
  province: z.string().trim().min(2).max(2).default('MB'),
  postalCode: postalCodeSchema,
});

export async function createCustomerManually(formData: FormData) {
  // 1. Verify dispatcher/admin session & derive organizationId
  const { user: actor, organizationId } = await requireRoleInOrg(ADMIN_ROLES);

  const rawData = {
    firstName: formData.get('firstName'),
    lastName: formData.get('lastName'),
    email: (formData.get('email') as string)?.toLowerCase().trim(),
    phone: formData.get('phone') || undefined,
    notes: formData.get('notes') || undefined,
    address: formData.get('address'),
    unit: formData.get('unit') || undefined,
    city: formData.get('city'),
    province: formData.get('province') || 'MB',
    postalCode: formData.get('postalCode'),
  };

  const parsed = CreateCustomerSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues.map((i) => i.message).join(', '),
    };
  }

  const data = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find or create global User
      let user = await tx.user.findUnique({
        where: { email: data.email },
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone || null,
            passwordHash: 'manual_intake_no_password',
          },
        });
      }

      // 2. Find or create Customer in this organization
      let customer = await tx.customer.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId,
          },
        },
      });

      if (customer) {
        // Update existing customer info
        customer = await tx.customer.update({
          where: { id: customer.id },
          data: {
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone || customer.phone,
            notes: data.notes || customer.notes,
          },
        });
      } else {
        customer = await tx.customer.create({
          data: {
            organizationId,
            userId: user.id,
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone || null,
            notes: data.notes || null,
          },
        });
      }

      // 3. Create Property for Customer
      const property = await tx.property.create({
        data: {
          organizationId,
          customerId: customer.id,
          address: data.address,
          unit: data.unit || null,
          city: data.city,
          province: data.province,
          postalCode: data.postalCode,
        },
      });

      // 4. Audit Log
      await tx.auditLog.create({
        data: {
          organizationId,
          userId: actor.id,
          action: 'CUSTOMER_CREATED_MANUALLY',
          entity: 'Customer',
          entityId: customer.id,
          metadata: JSON.stringify({
            customerId: customer.id,
            propertyId: property.id,
            email: data.email,
          }),
        },
      });

      return { customer, property };
    });

    revalidatePath('/dashboard/customers');
    return { success: true, customerId: result.customer.id };
  } catch (error: any) {
    console.error('Failed to create customer manually:', error);
    return { success: false, error: error.message || 'Failed to create customer' };
  }
}
