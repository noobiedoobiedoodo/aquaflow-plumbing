import { requireRole, requireAuth } from './session';
import { ADMIN_ROLES, TECH_ROLES } from '../constants';
import { prisma } from '../db';

/**
 * Ensures the user has ADMIN or SUPER_ADMIN role in the specified organization.
 */
export async function requireAdmin(organizationId: string) {
  return requireRole(['SUPER_ADMIN', 'ADMIN'], organizationId);
}

/**
 * Ensures the user has DISPATCHER, ADMIN, or SUPER_ADMIN role in the specified organization.
 */
export async function requireDispatcher(organizationId: string) {
  return requireRole(ADMIN_ROLES, organizationId);
}

/**
 * Ensures the user has TECHNICIAN, DISPATCHER, ADMIN, or SUPER_ADMIN role in the specified organization.
 */
export async function requireTechnician(organizationId: string) {
  return requireRole(TECH_ROLES, organizationId);
}

/**
 * Ensures the user belongs to the organization (any role).
 */
export async function requireOrganizationMember(organizationId: string) {
  const current = await requireAuth();
  
  const isMember = current.user.memberships.some((m) => m.organizationId === organizationId);
  
  if (!isMember) {
    throw new Error('Forbidden: Not a member of this organization');
  }
  
  return current;
}

/**
 * Ensures the current user owns the specified customer record.
 */
export async function requireCustomerOwnership(customerId: string) {
  const current = await requireAuth();
  
  const customer = await prisma.customer.findUnique({
    where: { id: customerId }
  });
  
  if (!customer) {
    throw new Error('Customer not found');
  }
  
  // A user owns the customer record if their userId matches the customer's userId
  if (customer.userId !== current.user.id) {
    throw new Error('Forbidden: You do not own this customer profile');
  }
  
  return { ...current, customer };
}
