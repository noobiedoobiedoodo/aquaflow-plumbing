'use server';

import { prisma } from '@/lib/db';
import { requireRoleInOrg } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/lib/constants';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const ServiceSchema = z.object({
  name: z.string().min(2, 'Service name is required'),
  description: z.string().min(5, 'Description is required'),
  basePrice: z.coerce.number().min(0, 'Base price must be positive'),
  estimatedDuration: z.coerce.number().min(15, 'Duration must be at least 15 minutes'),
  isEmergency: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export async function createServiceManual(formData: FormData) {
  try {
    const { organizationId } = await requireRoleInOrg(ADMIN_ROLES);

    const raw = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      basePrice: formData.get('basePrice'),
      estimatedDuration: formData.get('estimatedDurationMinutes') || formData.get('estimatedDuration'),
      isEmergency: formData.get('isEmergency') === 'true' || formData.get('isEmergency') === 'on',
      isActive: true,
    };

    const parsed = ServiceSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Validation failed' };
    }

    const baseSlug = parsed.data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;

    const newService = await prisma.service.create({
      data: {
        organizationId,
        slug: uniqueSlug,
        ...parsed.data,
      },
    });

    revalidatePath('/dashboard/settings');
    revalidatePath('/p/[slug]/book', 'page');
    return { success: true, serviceId: newService.id };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create service' };
  }
}

export async function toggleServiceStatus(serviceId: string, isActive: boolean) {
  try {
    const { organizationId } = await requireRoleInOrg(ADMIN_ROLES);

    const service = await prisma.service.findFirst({
      where: { id: serviceId, organizationId },
    });

    if (!service) {
      return { success: false, error: 'Service not found' };
    }

    await prisma.service.update({
      where: { id: serviceId },
      data: { isActive },
    });

    revalidatePath('/dashboard/settings');
    revalidatePath('/p/[slug]/book', 'page');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update service' };
  }
}

export async function updateCompanyProfile(formData: FormData) {
  try {
    const { organizationId } = await requireRoleInOrg(ADMIN_ROLES);

    const name = formData.get('name') as string;
    const phone = formData.get('phone') as string;
    const address = formData.get('address') as string;
    const emergencyPhone = formData.get('emergencyPhone') as string;

    if (!name || name.trim().length === 0) {
      return { success: false, error: 'Company name cannot be empty' };
    }

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        name,
        phone: phone || null,
        address: address || null,
        emergencyPhone: emergencyPhone || null,
      },
    });

    revalidatePath('/dashboard/settings');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update company profile' };
  }
}
