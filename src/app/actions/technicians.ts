'use server';

import { prisma } from '@/lib/db';
import { requireRoleInOrg } from '@/lib/auth/session';
import { ADMIN_ROLES, ROLES } from '@/lib/constants';
import { hashPassword } from '@/lib/auth/password';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const CreateTechSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export async function createTechnicianManual(formData: FormData) {
  try {
    const { organizationId } = await requireRoleInOrg(ADMIN_ROLES);

    const raw = {
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      email: (formData.get('email') as string)?.trim().toLowerCase(),
      phone: (formData.get('phone') as string)?.trim(),
      password: formData.get('password') as string,
    };

    const parsed = CreateTechSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Validation failed' };
    }

    const { firstName, lastName, email, phone, password } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email } });

      if (!user) {
        const passwordHash = await hashPassword(password);
        user = await tx.user.create({
          data: {
            email,
            passwordHash,
            firstName,
            lastName,
            phone,
          },
        });
      }

      // Check for existing membership in this organization
      const existingMembership = await tx.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId,
          },
        },
      });

      if (!existingMembership) {
        await tx.organizationMember.create({
          data: {
            userId: user.id,
            organizationId,
            role: ROLES.TECHNICIAN,
          },
        });
      }

      // Check if technician profile already exists in this org
      let techProfile = await tx.technician.findFirst({
        where: {
          userId: user.id,
          organizationId,
        },
      });

      if (!techProfile) {
        techProfile = await tx.technician.create({
          data: {
            userId: user.id,
            organizationId,
            firstName,
            lastName,
            phone: phone || null,
            availabilityStatus: 'AVAILABLE',
            isActive: true,
          },
        });
      } else if (!techProfile.isActive) {
        techProfile = await tx.technician.update({
          where: { id: techProfile.id },
          data: { isActive: true },
        });
      }

      return techProfile;
    });

    revalidatePath('/dashboard/techs');
    return { success: true, technicianId: result.id };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create technician' };
  }
}

export async function toggleTechnicianStatus(technicianId: string, isActive: boolean) {
  try {
    const { organizationId } = await requireRoleInOrg(ADMIN_ROLES);

    const tech = await prisma.technician.findFirst({
      where: { id: technicianId, organizationId },
    });

    if (!tech) {
      return { success: false, error: 'Technician not found' };
    }

    await prisma.technician.update({
      where: { id: technicianId },
      data: { isActive },
    });

    revalidatePath('/dashboard/techs');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to update technician status' };
  }
}
