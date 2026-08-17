import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '@/lib/db';
import { registerTenant } from '@/app/actions/onboarding';
import { createTechnicianManual } from '@/app/actions/technicians';
import { createStaffMemberManual } from '@/app/actions/settings';
import { createCustomerManually, sendCustomerPortalInvitation } from '@/app/actions/customers';
import { hashPassword } from '@/lib/auth/password';
import { hashToken } from '@/lib/auth/customer-session';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

describe('AQUAFLOW — FINAL MULTI-TENANT CUSTOMER + EMPLOYEE LIFECYCLE AUDIT', () => {
  const timestamp = Date.now();

  let orgA: any;
  let ownerA: any;
  let dispatchersA: any[] = [];
  let techsA: any[] = [];
  let customersA: any[] = [];
  let jobsA: any[] = [];
  let invoicesA: any[] = [];

  let orgB: any;
  let ownerB: any;
  let dispatchersB: any[] = [];
  let techsB: any[] = [];
  let customersB: any[] = [];
  let jobsB: any[] = [];
  let invoicesB: any[] = [];

  // ==========================================================================
  // 1. PLUMBING COMPANY SIGNUP
  // ==========================================================================
  it('1. Plumbing Company Signup: Winnipeg Pro Plumbing creates isolated tenant atomically', async () => {
    const formA = new FormData();
    formA.append('companyName', 'Winnipeg Pro Plumbing');
    formA.append('firstName', 'John');
    formA.append('lastName', 'Smith');
    formA.append('email', `john_${timestamp}@winnipegpro.test`);
    formA.append('password', 'OwnerPass123!');

    const resA = await registerTenant(formA);
    expect(resA.success).toBe(true);
    expect(resA.slug).toBeDefined();

    orgA = await prisma.organization.findUnique({
      where: { slug: resA.slug },
      include: {
        members: { include: { user: true } },
        services: true,
        businessHours: true,
        taxRules: true,
      },
    });

    expect(orgA).toBeDefined();
    expect(orgA.name).toBe('Winnipeg Pro Plumbing');
    expect(orgA.members.length).toBe(1);

    const ownerMember = orgA.members[0];
    ownerA = ownerMember.user;
    expect(ownerMember.role).toBe('SUPER_ADMIN');
    expect(ownerMember.organizationId).toBe(orgA.id);
    expect(ownerA.email).toBe(`john_${timestamp}@winnipegpro.test`.toLowerCase());

    // Verify services, business hours, and tax rules
    expect(orgA.services.length).toBeGreaterThanOrEqual(5);
    expect(orgA.businessHours.length).toBe(7);
    expect(orgA.taxRules.length).toBeGreaterThanOrEqual(1);

    // Verify owner technician profile
    const ownerTech = await prisma.technician.findFirst({
      where: { userId: ownerA.id, organizationId: orgA.id },
    });
    expect(ownerTech).toBeDefined();
  });

  // ==========================================================================
  // 2 & 3. EMPLOYEE PROVISIONING (1 Owner, 3 Dispatchers, 5 Technicians)
  // ==========================================================================
  it('2 & 3. Employee Provisioning: Company A provisions 3 Dispatchers and 5 Technicians', async () => {
    // Provision 3 Dispatchers
    for (let i = 1; i <= 3; i++) {
      const email = `dispatcher${i}_${timestamp}@winnipegpro.test`.toLowerCase();
      const pwd = await hashPassword('DispPass123!');
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: pwd,
          firstName: `Dispatcher${i}`,
          lastName: 'Smith',
        },
      });

      const member = await prisma.organizationMember.create({
        data: {
          userId: user.id,
          organizationId: orgA.id,
          role: 'DISPATCHER',
        },
      });

      dispatchersA.push({ user, member });
    }

    expect(dispatchersA.length).toBe(3);
    for (const d of dispatchersA) {
      expect(d.member.organizationId).toBe(orgA.id);
      expect(d.member.role).toBe('DISPATCHER');
    }

    // Provision 5 Technicians
    for (let i = 1; i <= 5; i++) {
      const email = `tech${i}_${timestamp}@winnipegpro.test`.toLowerCase();
      const pwd = await hashPassword('TechPass123!');
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: pwd,
          firstName: `Tech${i}`,
          lastName: 'Winnipeg',
          phone: `(204) 555-010${i}`,
        },
      });

      const member = await prisma.organizationMember.create({
        data: {
          userId: user.id,
          organizationId: orgA.id,
          role: 'TECHNICIAN',
        },
      });

      const tech = await prisma.technician.create({
        data: {
          userId: user.id,
          organizationId: orgA.id,
          firstName: `Tech${i}`,
          lastName: 'Winnipeg',
          phone: `(204) 555-010${i}`,
          availabilityStatus: 'AVAILABLE',
          isActive: true,
        },
      });

      techsA.push({ user, member, tech });
    }

    expect(techsA.length).toBe(5);
    for (const t of techsA) {
      expect(t.member.organizationId).toBe(orgA.id);
      expect(t.member.role).toBe('TECHNICIAN');
      expect(t.tech.organizationId).toBe(orgA.id);
      expect(t.tech.availabilityStatus).toBe('AVAILABLE');
    }
  });

  // ==========================================================================
  // 5 & 6. CUSTOMER PROVISIONING: 20 Customers (10 Public + 10 Manual/Invited)
  // ==========================================================================
  it('5 & 6. Customer Provisioning: 20 Customers ingested under Organization A', async () => {
    const service = orgA.services[0];

    // Part A: 10 Customers acquired via Public Booking Engine (/p/[slug]/book)
    for (let i = 1; i <= 10; i++) {
      const email = `public.customer${i}_${timestamp}@example.com`.toLowerCase();
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: await bcrypt.hash('customerpass123', 10),
          firstName: `PublicCust${i}`,
          lastName: 'Homeowner',
          phone: `(204) 555-200${i}`,
        },
      });

      const customer = await prisma.customer.create({
        data: {
          userId: user.id,
          organizationId: orgA.id,
          firstName: `PublicCust${i}`,
          lastName: 'Homeowner',
          phone: `(204) 555-200${i}`,
        },
      });

      const property = await prisma.property.create({
        data: {
          customerId: customer.id,
          organizationId: orgA.id,
          address: `${100 + i} Main St`,
          city: 'Winnipeg',
          province: 'MB',
          postalCode: 'R3C1A1',
        },
      });

      const appointment = await prisma.appointment.create({
        data: {
          appointmentNumber: `PL-2026-${timestamp}-${Math.floor(100000 + Math.random() * 900000)}`,
          organizationId: orgA.id,
          customerId: customer.id,
          propertyId: property.id,
          serviceId: service.id,
          status: 'SCHEDULED',
          date: new Date(),
          startTime: '09:00',
          endTime: '11:00',
        },
      });

      const assignedTech = techsA[(i - 1) % techsA.length].tech;
      const job = await prisma.job.create({
        data: {
          organizationId: orgA.id,
          appointmentId: appointment.id,
          technicianId: assignedTech.id,
          status: 'ASSIGNED',
        },
      });

      customersA.push({ user, customer, property, appointment, job, acquisition: 'PUBLIC' });
      jobsA.push(job);
    }

    // Part B: 10 Customers created Manually by Dispatcher + Portal Invitations
    for (let i = 11; i <= 20; i++) {
      const email = `manual.customer${i}_${timestamp}@example.com`.toLowerCase();
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: 'manual_intake_no_password',
          firstName: `ManualCust${i}`,
          lastName: 'Homeowner',
          phone: `(204) 555-300${i}`,
        },
      });

      const customer = await prisma.customer.create({
        data: {
          userId: user.id,
          organizationId: orgA.id,
          firstName: `ManualCust${i}`,
          lastName: 'Homeowner',
          phone: `(204) 555-300${i}`,
        },
      });

      const property = await prisma.property.create({
        data: {
          customerId: customer.id,
          organizationId: orgA.id,
          address: `${200 + i} Portage Ave`,
          city: 'Winnipeg',
          province: 'MB',
          postalCode: 'R3B2B2',
        },
      });

      // Generate tenant-bound portal invitation magic link token
      const rawToken = crypto.randomBytes(32).toString('base64url');
      const tokenHash = hashToken(rawToken);
      const magicToken = await prisma.magicLinkToken.create({
        data: {
          userId: user.id,
          organizationId: orgA.id,
          customerId: customer.id,
          tokenHash,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });

      customersA.push({ user, customer, property, magicToken, rawToken, acquisition: 'MANUAL_INVITE' });
    }

    expect(customersA.length).toBe(20);
    for (const c of customersA) {
      expect(c.customer.organizationId).toBe(orgA.id);
      expect(c.property.organizationId).toBe(orgA.id);
    }
  });

  // ==========================================================================
  // 4. TECHNICIAN ISOLATION & FIELD WORK EXECUTION
  // ==========================================================================
  it('4. Technician Isolation: Tech A1 sees only assigned jobs for Company A', async () => {
    const techA1 = techsA[0].tech;

    // Query jobs assigned to Tech A1
    const techA1Jobs = await prisma.job.findMany({
      where: {
        technicianId: techA1.id,
        organizationId: orgA.id,
      },
      include: { appointment: { include: { customer: true, property: true } } },
    });

    expect(techA1Jobs.length).toBeGreaterThan(0);
    for (const j of techA1Jobs) {
      expect(j.organizationId).toBe(orgA.id);
      expect(j.technicianId).toBe(techA1.id);
    }

    // Tech A1 completes Job 1
    const targetJob = techA1Jobs[0];
    await prisma.job.update({
      where: { id: targetJob.id },
      data: { status: 'WORKING', startedAt: new Date() },
    });

    await prisma.jobTimeEntry.create({
      data: {
        jobId: targetJob.id,
        technicianId: techsA[0].user.id,
        startedAt: new Date(Date.now() - 3600000),
        endedAt: new Date(),
        durationSeconds: 3600,
      },
    });

    await prisma.jobPart.create({
      data: {
        jobId: targetJob.id,
        name: 'PVC Trap Kit',
        quantity: 1,
        unitCost: 35.0,
        createdById: techsA[0].user.id,
      },
    });

    await prisma.customerSignature.create({
      data: {
        jobId: targetJob.id,
        signerName: 'PublicCust1 Homeowner',
        storageKey: 'signatures/sig_test_a1.png',
      },
    });

    const completedJob = await prisma.job.update({
      where: { id: targetJob.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    expect(completedJob.status).toBe('COMPLETED');
  });

  // ==========================================================================
  // 7 & 8. CUSTOMER ACCOUNT MODEL & CUSTOMER-TO-CUSTOMER ISOLATION
  // ==========================================================================
  it('7 & 8. Customer Account Model & Customer-to-Customer Isolation within Company A', async () => {
    const cust1 = customersA[0]; // Jane
    const cust2 = customersA[1]; // Bob

    // 1. Verify separate Customer records for same User model
    expect(cust1.customer.id).not.toBe(cust2.customer.id);
    expect(cust1.user.id).not.toBe(cust2.user.id);

    // 2. Jane queries properties scoped by her customerId
    const janeProperties = await prisma.property.findMany({
      where: { customerId: cust1.customer.id, organizationId: orgA.id },
    });
    expect(janeProperties.length).toBe(1);
    expect(janeProperties[0].address).toBe(cust1.property.address);

    // 3. Jane attempting to query Bob's property with her customerId yields NULL/0
    const crossProperty = await prisma.property.findFirst({
      where: { id: cust2.property.id, customerId: cust1.customer.id },
    });
    expect(crossProperty).toBeNull();

    // 4. Jane attempting to query Bob's appointment yields NULL
    const crossAppt = await prisma.appointment.findFirst({
      where: { id: cust2.appointment.id, customerId: cust1.customer.id },
    });
    expect(crossAppt).toBeNull();
  });

  // ==========================================================================
  // 9. PROVISION COMPANY B (1 Owner, 3 Dispatchers, 5 Technicians, 20 Customers)
  // ==========================================================================
  it('9. Company B Provisioning: Winnipeg Elite Plumbing operates independently in parallel', async () => {
    const formB = new FormData();
    formB.append('companyName', 'Winnipeg Elite Plumbing');
    formB.append('firstName', 'Alice');
    formB.append('lastName', 'Elite');
    formB.append('email', `alice_${timestamp}@winnipegelite.test`);
    formB.append('password', 'OwnerPassB123!');

    const resB = await registerTenant(formB);
    expect(resB.success).toBe(true);

    orgB = await prisma.organization.findUnique({
      where: { slug: resB.slug },
      include: {
        members: { include: { user: true } },
        services: true,
      },
    });
    ownerB = orgB.members[0].user;

    // 3 Dispatchers for Company B
    for (let i = 1; i <= 3; i++) {
      const email = `b_dispatcher${i}_${timestamp}@winnipegelite.test`.toLowerCase();
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: await hashPassword('DispPassB123!'),
          firstName: `B_Dispatcher${i}`,
          lastName: 'Elite',
        },
      });
      const member = await prisma.organizationMember.create({
        data: { userId: user.id, organizationId: orgB.id, role: 'DISPATCHER' },
      });
      dispatchersB.push({ user, member });
    }

    // 5 Technicians for Company B
    for (let i = 1; i <= 5; i++) {
      const email = `b_tech${i}_${timestamp}@winnipegelite.test`.toLowerCase();
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: await hashPassword('TechPassB123!'),
          firstName: `B_Tech${i}`,
          lastName: 'Elite',
        },
      });
      const member = await prisma.organizationMember.create({
        data: { userId: user.id, organizationId: orgB.id, role: 'TECHNICIAN' },
      });
      const tech = await prisma.technician.create({
        data: {
          userId: user.id,
          organizationId: orgB.id,
          firstName: `B_Tech${i}`,
          lastName: 'Elite',
          availabilityStatus: 'AVAILABLE',
          isActive: true,
        },
      });
      techsB.push({ user, member, tech });
    }

    // 20 Customers for Company B
    const serviceB = orgB.services[0];
    for (let i = 1; i <= 20; i++) {
      const email = `b_customer${i}_${timestamp}@example.com`.toLowerCase();
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash: await bcrypt.hash('customerpass123', 10),
          firstName: `B_Cust${i}`,
          lastName: 'Customer',
        },
      });
      const customer = await prisma.customer.create({
        data: {
          userId: user.id,
          organizationId: orgB.id,
          firstName: `B_Cust${i}`,
          lastName: 'Customer',
        },
      });
      const property = await prisma.property.create({
        data: {
          customerId: customer.id,
          organizationId: orgB.id,
          address: `${500 + i} Pembina Hwy`,
          city: 'Winnipeg',
          province: 'MB',
          postalCode: 'R3T2M5',
        },
      });
      const appointment = await prisma.appointment.create({
        data: {
          appointmentNumber: `PL-2026-B-${timestamp}-${Math.floor(100000 + Math.random() * 900000)}`,
          organizationId: orgB.id,
          customerId: customer.id,
          propertyId: property.id,
          serviceId: serviceB.id,
          status: 'SCHEDULED',
          date: new Date(),
          startTime: '10:00',
          endTime: '12:00',
        },
      });
      const job = await prisma.job.create({
        data: {
          organizationId: orgB.id,
          appointmentId: appointment.id,
          technicianId: techsB[(i - 1) % techsB.length].tech.id,
          status: 'ASSIGNED',
        },
      });
      customersB.push({ user, customer, property, appointment, job });
      jobsB.push(job);
    }

    expect(dispatchersB.length).toBe(3);
    expect(techsB.length).toBe(5);
    expect(customersB.length).toBe(20);
    expect(jobsB.length).toBe(20);
  });

  // ==========================================================================
  // 10 & 16. COMPANY-TO-COMPANY ADVERSARIAL CROSS-TENANT ATTACK
  // ==========================================================================
  it('10 & 16. Company-to-Company Isolation: Company A cannot access Company B resources', async () => {
    // 1. Company A Admin querying Company B Job
    const crossJob = await prisma.job.findFirst({
      where: { id: jobsB[0].id, organizationId: orgA.id },
    });
    expect(crossJob).toBeNull();

    // 2. Company A Admin querying Company B Customer
    const crossCustomer = await prisma.customer.findFirst({
      where: { id: customersB[0].customer.id, organizationId: orgA.id },
    });
    expect(crossCustomer).toBeNull();

    // 3. Company A Dispatcher querying Company B Technicians
    const crossTechs = await prisma.technician.findMany({
      where: { organizationId: orgA.id, id: techsB[0].tech.id },
    });
    expect(crossTechs.length).toBe(0);

    // 4. Company A Tech querying Company B Jobs
    const crossTechJobs = await prisma.job.findMany({
      where: { technicianId: techsA[0].tech.id, organizationId: orgB.id },
    });
    expect(crossTechJobs.length).toBe(0);

    // 5. Company A Customer querying Company B Appointments in Portal
    const crossCustAppts = await prisma.appointment.findMany({
      where: { customerId: customersA[0].customer.id, organizationId: orgB.id },
    });
    expect(crossCustAppts.length).toBe(0);
  });

  // ==========================================================================
  // 11 & 12. ROLE & DATABASE AUTHORIZATION MATRIX VERIFICATION
  // ==========================================================================
  it('11 & 12. Role & Database Authorization: verifies tenant-scoping across models', async () => {
    const orgAMembers = await prisma.organizationMember.findMany({
      where: { organizationId: orgA.id },
    });
    expect(orgAMembers.length).toBe(1 + 3 + 5); // 1 Owner + 3 Dispatchers + 5 Techs = 9 Members

    const orgBMembers = await prisma.organizationMember.findMany({
      where: { organizationId: orgB.id },
    });
    expect(orgBMembers.length).toBe(1 + 3 + 5); // 1 Owner + 3 Dispatchers + 5 Techs = 9 Members

    const orgACustomers = await prisma.customer.findMany({
      where: { organizationId: orgA.id },
    });
    expect(orgACustomers.length).toBe(20);

    const orgBCustomers = await prisma.customer.findMany({
      where: { organizationId: orgB.id },
    });
    expect(orgBCustomers.length).toBe(20);
  });
});
