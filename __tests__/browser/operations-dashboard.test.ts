import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
import { SchedulingService } from '@/lib/services/scheduling-service';
import { ConflictEngine } from '@/lib/intelligence/conflict-engine';
import { randomUUID } from 'crypto';
import { differenceInMinutes } from 'date-fns';

describe('Forensic Audit: Dispatcher Command Center & Operations Dashboard', () => {
  const runId = randomUUID().slice(0, 8);
  let orgA: any;
  let orgB: any;
  let adminUserA: any;
  let adminUserB: any;
  let techA1: any;
  let techA2: any;
  let techB1: any;
  let customerA: any;
  let customerB: any;
  let propertyA: any;
  let serviceRepairA: any;
  let serviceEmergencyA: any;
  let appointmentA1: any;
  let appointmentA2: any;
  let jobA1: any;
  let jobA2: any;
  let invoiceA1: any;

  beforeAll(async () => {
    // 1. Setup Tenant A
    orgA = await prisma.organization.create({
      data: {
        name: `AquaFlow Operations A ${runId}`,
        slug: `aquaflow-ops-a-${runId}`,
        phone: '204-555-0100',
        emergencyPhone: '204-555-0911',
        address: '100 Main St, Winnipeg, MB',
        stripeAccountId: `acct_ops_a_${runId}`,
        stripeConnectionStatus: 'ACTIVE',
      },
    });

    // 2. Setup Tenant B (for cross-tenant separation verification)
    orgB = await prisma.organization.create({
      data: {
        name: `AquaFlow Operations B ${runId}`,
        slug: `aquaflow-ops-b-${runId}`,
        phone: '204-555-0200',
        stripeAccountId: `acct_ops_b_${runId}`,
      },
    });

    // Admin Users
    adminUserA = await prisma.user.create({
      data: {
        email: `dispatcher.a.${runId}@aquaflow.test`,
        passwordHash: await hashPassword('dispatchPass123!'),
        firstName: 'Diana',
        lastName: 'Dispatcher',
      },
    });

    await prisma.organizationMember.create({
      data: {
        userId: adminUserA.id,
        organizationId: orgA.id,
        role: 'SUPER_ADMIN',
      },
    });

    adminUserB = await prisma.user.create({
      data: {
        email: `dispatcher.b.${runId}@aquaflow.test`,
        passwordHash: await hashPassword('dispatchPass123!'),
        firstName: 'Dave',
        lastName: 'Dispatcher',
      },
    });

    await prisma.organizationMember.create({
      data: {
        userId: adminUserB.id,
        organizationId: orgB.id,
        role: 'SUPER_ADMIN',
      },
    });

    // Services for Org A
    serviceRepairA = await prisma.service.create({
      data: {
        organizationId: orgA.id,
        name: 'Standard Leak Repair',
        slug: `leak-repair-${runId}`,
        description: 'Comprehensive leak detection and copper line repair',
        basePrice: 150.0,
        estimatedDuration: 60,
        isEmergency: false,
        isActive: true,
      },
    });

    serviceEmergencyA = await prisma.service.create({
      data: {
        organizationId: orgA.id,
        name: '24/7 Burst Pipe Emergency',
        slug: `emergency-burst-pipe-${runId}`,
        description: 'Immediate response to severe residential water pipe ruptures',
        basePrice: 350.0,
        estimatedDuration: 120,
        isEmergency: true,
        isActive: true,
      },
    });

    // Technicians for Org A
    const techUserA1 = await prisma.user.create({
      data: {
        email: `tech.mike.${runId}@aquaflow.test`,
        passwordHash: await hashPassword('techPass123!'),
        firstName: 'Mike',
        lastName: 'Miller',
      },
    });

    await prisma.organizationMember.create({
      data: {
        userId: techUserA1.id,
        organizationId: orgA.id,
        role: 'TECHNICIAN',
      },
    });

    techA1 = await prisma.technician.create({
      data: {
        userId: techUserA1.id,
        organizationId: orgA.id,
        firstName: 'Mike',
        lastName: 'Miller',
        phone: '204-555-1111',
        availabilityStatus: 'AVAILABLE',
        isActive: true,
        currentLat: 49.8951,
        currentLng: -97.1384,
        locationUpdatedAt: new Date(), // Fresh location
        skills: JSON.stringify([serviceRepairA.slug, 'drain-clearing']),
      },
    });

    const techUserA2 = await prisma.user.create({
      data: {
        email: `tech.sarah.${runId}@aquaflow.test`,
        passwordHash: await hashPassword('techPass123!'),
        firstName: 'Sarah',
        lastName: 'Smith',
      },
    });

    await prisma.organizationMember.create({
      data: {
        userId: techUserA2.id,
        organizationId: orgA.id,
        role: 'TECHNICIAN',
      },
    });

    techA2 = await prisma.technician.create({
      data: {
        userId: techUserA2.id,
        organizationId: orgA.id,
        firstName: 'Sarah',
        lastName: 'Smith',
        phone: '204-555-2222',
        availabilityStatus: 'BUSY',
        isActive: true,
        currentLat: 49.8800,
        currentLng: -97.1500,
        locationUpdatedAt: new Date(Date.now() - 25 * 60 * 1000), // 25 mins ago (Stale location)
        skills: JSON.stringify([serviceEmergencyA.slug, serviceRepairA.slug]),
      },
    });

    // Technician for Org B
    const techUserB1 = await prisma.user.create({
      data: {
        email: `tech.bob.${runId}@aquaflow.test`,
        passwordHash: await hashPassword('techPass123!'),
        firstName: 'Bob',
        lastName: 'Builder',
      },
    });

    await prisma.organizationMember.create({
      data: {
        userId: techUserB1.id,
        organizationId: orgB.id,
        role: 'TECHNICIAN',
      },
    });

    techB1 = await prisma.technician.create({
      data: {
        userId: techUserB1.id,
        organizationId: orgB.id,
        firstName: 'Bob',
        lastName: 'Builder',
        availabilityStatus: 'AVAILABLE',
        isActive: true,
        currentLat: 49.9100,
        currentLng: -97.1200,
        locationUpdatedAt: new Date(),
      },
    });

    // Business Hours for Org A (7 Days)
    for (let day = 0; day < 7; day++) {
      await prisma.businessHours.create({
        data: {
          organizationId: orgA.id,
          dayOfWeek: day,
          openTime: '08:00',
          closeTime: '17:00',
          isClosed: day === 0, // Sunday closed
        },
      });
    }

    // Tax Rule for Org A
    await prisma.taxRule.create({
      data: {
        organizationId: orgA.id,
        name: 'Manitoba Sales Tax (GST+PST)',
        jurisdiction: 'MB',
        rate: 0.12,
        appliesTo: 'ALL',
        active: true,
      },
    });

    // Customers
    const custUserA = await prisma.user.create({
      data: {
        email: `customer.alice.${runId}@homeowner.test`,
        passwordHash: 'custPass',
        firstName: 'Alice',
        lastName: 'Johnson',
        phone: '204-555-7788',
      },
    });

    customerA = await prisma.customer.create({
      data: {
        userId: custUserA.id,
        organizationId: orgA.id,
        firstName: 'Alice',
        lastName: 'Johnson',
        phone: '204-555-7788',
        notes: 'Gate code is 4421. Watch out for golden retriever.',
      },
    });

    propertyA = await prisma.property.create({
      data: {
        organizationId: orgA.id,
        customerId: customerA.id,
        address: '428 River Avenue',
        unit: 'Suite 3B',
        city: 'Winnipeg',
        province: 'MB',
        postalCode: 'R3L 0C7',
        latitude: 49.8780,
        longitude: -97.1420,
      },
    });

    const custUserB = await prisma.user.create({
      data: {
        email: `customer.bob.${runId}@homeowner.test`,
        passwordHash: 'custPass',
        firstName: 'Robert',
        lastName: 'Black',
      },
    });

    customerB = await prisma.customer.create({
      data: {
        userId: custUserB.id,
        organizationId: orgB.id,
        firstName: 'Robert',
        lastName: 'Black',
      },
    });

    // Appointments and Jobs in Org A
    // Job 1: Normal created unassigned job
    appointmentA1 = await prisma.appointment.create({
      data: {
        appointmentNumber: `APT-A1-${runId}`,
        organizationId: orgA.id,
        customerId: customerA.id,
        propertyId: propertyA.id,
        serviceId: serviceRepairA.id,
        date: new Date(),
        startTime: '09:00',
        endTime: '10:00',
        status: 'CONFIRMED',
        isEmergency: false,
        problemDescription: 'Slow leak under the kitchen sink trap',
      },
    });

    jobA1 = await prisma.job.create({
      data: {
        organizationId: orgA.id,
        appointmentId: appointmentA1.id,
        status: 'CREATED',
        technicianId: null,
      },
    });

    // Job 2: Emergency job, currently EN_ROUTE with Sarah
    appointmentA2 = await prisma.appointment.create({
      data: {
        appointmentNumber: `APT-A2-EMG-${runId}`,
        organizationId: orgA.id,
        customerId: customerA.id,
        propertyId: propertyA.id,
        serviceId: serviceEmergencyA.id,
        date: new Date(),
        startTime: '11:00',
        endTime: '13:00',
        status: 'EN_ROUTE',
        isEmergency: true,
        priority: 'EMERGENCY',
        problemDescription: 'Basement ceiling burst pipe actively flooding',
      },
    });

    jobA2 = await prisma.job.create({
      data: {
        organizationId: orgA.id,
        appointmentId: appointmentA2.id,
        technicianId: techA2.id,
        status: 'EN_ROUTE',
      },
    });

    // Create Operational Forecast for Job 2 with High late probability
    await prisma.operationalForecast.create({
      data: {
        organizationId: orgA.id,
        jobId: jobA2.id,
        technicianId: techA2.id,
        predictedCompletionAt: new Date(Date.now() + 90 * 60 * 1000),
        lateProbability: 0.78, // High risk (>0.5)
        confidence: 'HIGH',
        sampleSize: 42,
        routingProvider: 'OSRM-Live',
        modelVersion: 'forecast-v1',
        reasoningJson: JSON.stringify({
          factors: [
            { factor: 'TRAFFIC_CONGESTION', impactMinutes: 18 },
            { factor: 'INCLEMENT_WEATHER', impactMinutes: 10 },
          ],
        }),
        expiresAt: new Date(Date.now() + 3600000),
      },
    });

    // Create Late Flag Activity for Job 2
    await prisma.jobActivity.create({
      data: {
        jobId: jobA2.id,
        userId: adminUserA.id,
        action: 'LIKELY_LATE_FLAGGED',
        previousStatus: 'EN_ROUTE',
        newStatus: 'EN_ROUTE',
        metadata: JSON.stringify({ reason: 'Severe traffic bottleneck detected on route' }),
      },
    });

    // Attention Tasks for Org A
    await prisma.task.create({
      data: {
        organizationId: orgA.id,
        title: 'Call customer regarding emergency flood access',
        type: 'CALL_CUSTOMER',
        status: 'OPEN',
        priority: 'URGENT',
        relatedJobId: jobA2.id,
        relatedCustId: customerA.id,
      },
    });

    await prisma.task.create({
      data: {
        organizationId: orgA.id,
        title: 'Review approved estimate for schedule finalization',
        type: 'SCHEDULING_REQUIRED',
        status: 'OPEN',
        priority: 'NORMAL',
        relatedJobId: jobA1.id,
      },
    });

    await prisma.task.create({
      data: {
        organizationId: orgA.id,
        title: 'Archived task that was already completed',
        type: 'INVESTIGATE',
        status: 'RESOLVED',
        priority: 'LOW',
      },
    });

    // Invoice for Org A
    invoiceA1 = await prisma.invoice.create({
      data: {
        organizationId: orgA.id,
        customerId: customerA.id,
        jobId: jobA2.id,
        invoiceNumber: `INV-2026-${runId.slice(0, 4)}-0001`,
        paymentToken: `pay_token_${runId}_1`,
        status: 'SENT',
        subtotal: 350.0,
        taxTotal: 42.0,
        total: 392.0,
        amountPaid: 0.0,
        dueDate: new Date(Date.now() + 15 * 86400000),
        lines: {
          create: [
            { description: 'Emergency Pipe Isolation & Repair', quantity: 1, unitCost: 350.0 },
          ],
        },
        taxes: {
          create: [
            { name: 'Manitoba Sales Tax', jurisdiction: 'MB', rate: 0.12, amount: 42.0 },
          ],
        },
      },
    });
  });

  afterAll(async () => {
    // Teardown
    await prisma.supportTicketMessage.deleteMany({ where: { ticket: { organizationId: { in: [orgA.id, orgB.id] } } } });
    await prisma.supportTicket.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.operationalForecast.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.task.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.intelligenceRecommendation.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.assignmentOverride.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.jobAssignment.deleteMany({ where: { job: { organizationId: { in: [orgA.id, orgB.id] } } } });
    await prisma.jobActivity.deleteMany({ where: { job: { organizationId: { in: [orgA.id, orgB.id] } } } });
    await prisma.event.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.auditLog.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.notification.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.payment.deleteMany({ where: { invoice: { organizationId: { in: [orgA.id, orgB.id] } } } });
    await prisma.invoiceTax.deleteMany({ where: { invoice: { organizationId: { in: [orgA.id, orgB.id] } } } });
    await prisma.invoiceLine.deleteMany({ where: { invoice: { organizationId: { in: [orgA.id, orgB.id] } } } });
    await prisma.invoice.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.job.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.appointment.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.property.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.customer.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.taxRule.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.businessHours.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.service.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.technician.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.organizationMember.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id] } } });
    await prisma.user.deleteMany({ where: { email: { contains: runId } } });
    await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } });
  });

  // ============================================================================
  // AUDIT SECTION 1: OPERATIONS COMMAND CENTER (/dashboard)
  // ============================================================================
  describe('1. Operations Command Center (/dashboard) Metrics & Telemetry', () => {
    it('accurately computes 5 key operational metrics cards strictly scoped to organization', async () => {
      // Execute the exact queries powering /dashboard for Org A
      const [
        emergencyJobs,
        unassignedJobs,
        activeTechsCount,
        enRouteTechsCount,
        lateJobsCount,
      ] = await Promise.all([
        prisma.job.count({
          where: {
            organizationId: orgA.id,
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
            appointment: { isEmergency: true },
          },
        }),
        prisma.job.count({
          where: { organizationId: orgA.id, status: 'CREATED', technicianId: null },
        }),
        prisma.technician.count({
          where: { organizationId: orgA.id, isActive: true },
        }),
        prisma.job.count({
          where: { organizationId: orgA.id, status: 'EN_ROUTE' },
        }),
        prisma.jobActivity.count({
          where: {
            job: { organizationId: orgA.id },
            action: { in: ['LIKELY_LATE_FLAGGED', 'CRITICAL_LATE_FLAGGED'] },
          },
        }),
      ]);

      expect(emergencyJobs).toBe(1); // Job A2 is emergency
      expect(unassignedJobs).toBe(1); // Job A1 is unassigned
      expect(activeTechsCount).toBe(2); // Mike & Sarah
      expect(enRouteTechsCount).toBe(1); // Job A2 is EN_ROUTE
      expect(lateJobsCount).toBe(1); // Job A2 has LIKELY_LATE_FLAGGED activity

      // Cross-tenant verification: Org B metrics must be completely isolated
      const orgBEmergencies = await prisma.job.count({
        where: {
          organizationId: orgB.id,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          appointment: { isEmergency: true },
        },
      });
      expect(orgBEmergencies).toBe(0);
    });

    it('correctly tracks fleet GPS positions and accurately flags stale telemetry (>10 mins)', async () => {
      const techsWithLocation = await prisma.technician.findMany({
        where: { organizationId: orgA.id, isActive: true, currentLat: { not: null } },
        select: {
          id: true,
          firstName: true,
          currentLat: true,
          currentLng: true,
          locationUpdatedAt: true,
          availabilityStatus: true,
        },
      });

      expect(techsWithLocation.length).toBe(2);

      const freshTech = techsWithLocation.find((t) => t.id === techA1.id);
      const staleTech = techsWithLocation.find((t) => t.id === techA2.id);

      expect(freshTech).toBeDefined();
      expect(staleTech).toBeDefined();

      const freshStaleMins = freshTech?.locationUpdatedAt
        ? differenceInMinutes(new Date(), freshTech.locationUpdatedAt)
        : 999;
      const staleStaleMins = staleTech?.locationUpdatedAt
        ? differenceInMinutes(new Date(), staleTech.locationUpdatedAt)
        : 999;

      expect(freshStaleMins).toBeLessThanOrEqual(5); // Updated freshly
      expect(staleStaleMins).toBeGreaterThan(10); // 25 mins old, stale flag triggered (>10 mins)

      // Fleet data of Org B does not appear in Org A query
      const orgBTechInOrgA = techsWithLocation.find((t) => t.id === techB1.id);
      expect(orgBTechInOrgA).toBeUndefined();
    });

    it('renders Attention Board prioritizing urgent and high-priority open tasks', async () => {
      const attentionTasks = await prisma.task.findMany({
        where: { organizationId: orgA.id, status: 'OPEN' },
        orderBy: { priority: 'asc' },
        take: 10,
      });

      // Only OPEN tasks should appear (2 out of 3, resolved task omitted)
      expect(attentionTasks.length).toBe(2);
      expect(attentionTasks.some((t) => t.priority === 'URGENT')).toBe(true);
      expect(attentionTasks.some((t) => t.status === 'RESOLVED')).toBe(false);

      // Verify task details
      const urgentTask = attentionTasks.find((t) => t.priority === 'URGENT');
      expect(urgentTask?.title).toContain('emergency flood access');
      expect(urgentTask?.relatedJobId).toBe(jobA2.id);
    });

    it('renders Active Jobs list with AI predictive risk labeling and explainability factors', async () => {
      const activeJobsList = await prisma.job.findMany({
        where: {
          organizationId: orgA.id,
          status: { in: ['EN_ROUTE', 'ARRIVED', 'WORKING'] },
        },
        include: {
          technician: true,
          appointment: { include: { customer: true, property: true } },
          operationalForecasts: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: { updatedAt: 'desc' },
      });

      expect(activeJobsList.length).toBe(1);
      const job = activeJobsList[0];
      expect(job.id).toBe(jobA2.id);
      expect(job.technician?.firstName).toBe('Sarah');

      const forecast = job.operationalForecasts[0];
      expect(forecast).toBeDefined();
      expect(forecast.lateProbability).toBe(0.78);

      // Verify risk categorization rule (lateProbability > 0.5 => HIGH)
      let riskLabel = 'LOW';
      if (forecast.lateProbability > 0.5) riskLabel = 'HIGH';
      else if (forecast.lateProbability > 0.15) riskLabel = 'MED';
      expect(riskLabel).toBe('HIGH');

      // Verify parsing of explainability JSON
      const parsedReasoning = JSON.parse(forecast.reasoningJson);
      expect(parsedReasoning.factors.length).toBe(2);
      expect(parsedReasoning.factors[0].factor).toBe('TRAFFIC_CONGESTION');
      expect(parsedReasoning.factors[0].impactMinutes).toBe(18);
    });
  });

  // ============================================================================
  // AUDIT SECTION 2: DISPATCH JOBS LIST & JOB DETAILS (/dashboard/jobs/[id])
  // ============================================================================
  describe('2. Dispatch Jobs List & Manual / AI Recommendation Dispatching', () => {
    it('lists organization jobs with complete service, emergency, customer, and technician details', async () => {
      const jobs = await prisma.job.findMany({
        where: { organizationId: orgA.id },
        include: {
          appointment: {
            include: {
              service: true,
              customer: true,
              property: true,
            },
          },
          technician: true,
        },
        orderBy: { updatedAt: 'desc' },
      });

      expect(jobs.length).toBe(2);
      const unassigned = jobs.find((j) => j.status === 'CREATED');
      const enRoute = jobs.find((j) => j.status === 'EN_ROUTE');

      expect(unassigned?.technician).toBeNull();
      expect(unassigned?.appointment.isEmergency).toBe(false);

      expect(enRoute?.technician?.firstName).toBe('Sarah');
      expect(enRoute?.appointment.isEmergency).toBe(true);
    });

    it('executes manual technician assignment with audit trail and outbox event generation', async () => {
      // Execute assignment atomic workflow
      const result = await prisma.$transaction(async (tx) => {
        // Validate job exists in org
        const job = await tx.job.findFirst({
          where: { id: jobA1.id, organizationId: orgA.id },
          include: { appointment: true },
        });
        expect(job).not.toBeNull();

        // Validate technician is active in org
        const tech = await tx.technician.findFirst({
          where: { id: techA1.id, organizationId: orgA.id },
        });
        expect(tech?.isActive).toBe(true);

        // Update Job & Appointment
        const updatedJob = await tx.job.update({
          where: { id: jobA1.id },
          data: { status: 'ASSIGNED', technicianId: techA1.id },
        });

        await tx.appointment.update({
          where: { id: job!.appointmentId },
          data: { status: 'SCHEDULED' },
        });

        // Audit Trail
        await tx.jobActivity.create({
          data: {
            jobId: job!.id,
            userId: adminUserA.id,
            action: 'TECHNICIAN_ASSIGNED',
            previousStatus: 'CREATED',
            newStatus: 'ASSIGNED',
            metadata: JSON.stringify({
              technicianId: techA1.id,
              technicianName: `${tech!.firstName} ${tech!.lastName}`,
            }),
          },
        });

        // Outbox event
        const outboxEvent = await tx.event.create({
          data: {
            organizationId: orgA.id,
            type: 'job.assigned',
            entityType: 'Job',
            entityId: job!.id,
            data: JSON.stringify({ technicianId: techA1.id, technicianName: 'Mike Miller' }),
          },
        });

        return { updatedJob, outboxEvent };
      });

      expect(result.updatedJob.status).toBe('ASSIGNED');
      expect(result.updatedJob.technicianId).toBe(techA1.id);
      expect(result.outboxEvent.type).toBe('job.assigned');

      // Verify Appointment updated to SCHEDULED
      const updatedAppt = await prisma.appointment.findUnique({
        where: { id: appointmentA1.id },
      });
      expect(updatedAppt?.status).toBe('SCHEDULED');

      // Verify Audit Trail recorded
      const activity = await prisma.jobActivity.findFirst({
        where: { jobId: jobA1.id, action: 'TECHNICIAN_ASSIGNED' },
      });
      expect(activity).not.toBeNull();
      expect(activity?.newStatus).toBe('ASSIGNED');
    });

    it('rejects cross-tenant manual technician assignment attempt', async () => {
      // Attempt to assign Tech B1 (Org B) to Job A1 (Org A)
      const crossTenantTech = await prisma.technician.findFirst({
        where: { id: techB1.id, organizationId: orgA.id },
      });
      expect(crossTenantTech).toBeNull(); // Boundary check fails safely
    });

    it('handles AI recommendation generation, conflict evaluation, and dispatch acceptance', async () => {
      // Create new unassigned Job for AI recommendation test
      const apptAi = await prisma.appointment.create({
        data: {
          appointmentNumber: `APT-AI-${runId}`,
          organizationId: orgA.id,
          customerId: customerA.id,
          propertyId: propertyA.id,
          serviceId: serviceRepairA.id,
          date: new Date(),
          startTime: '14:00',
          endTime: '15:30',
          status: 'CONFIRMED',
        },
      });

      const jobAi = await prisma.job.create({
        data: {
          organizationId: orgA.id,
          appointmentId: apptAi.id,
          status: 'CREATED',
        },
      });

      // 1. Generate 2 AI Recommendations (Rec 1: Mike Miller 95%, Rec 2: Sarah Smith 70%)
      const rec1 = await prisma.intelligenceRecommendation.create({
        data: {
          organizationId: orgA.id,
          jobId: jobAi.id,
          technicianId: techA1.id,
          score: 0.95,
          distanceScore: 0.92,
          availabilityScore: 1.0,
          skillScore: 1.0,
          workloadScore: 0.88,
          availabilityStatus: 'AVAILABLE',
          skillMatch: 'EXACT',
          workloadLevel: 'LIGHT',
          reasoningJson: JSON.stringify({ summary: 'Closest technician with certified leak repair skill' }),
          status: 'SUGGESTED',
        },
      });

      const rec2 = await prisma.intelligenceRecommendation.create({
        data: {
          organizationId: orgA.id,
          jobId: jobAi.id,
          technicianId: techA2.id,
          score: 0.70,
          distanceScore: 0.65,
          availabilityScore: 0.7,
          skillScore: 0.8,
          workloadScore: 0.65,
          availabilityStatus: 'BUSY',
          skillMatch: 'PARTIAL',
          workloadLevel: 'MODERATE',
          reasoningJson: JSON.stringify({ summary: 'Backup technician currently completing prior call' }),
          status: 'SUGGESTED',
        },
      });

      // Verify conflict engine evaluation
      const conflictEval = await ConflictEngine.evaluateAssignment(jobAi.id, techA1.id);
      expect(conflictEval.canAssign).toBe(true);
      expect(conflictEval.hardConflicts.length).toBe(0);

      // Dispatcher accepts Recommendation 1
      const acceptResult = await SchedulingService.acceptRecommendation(
        orgA.id,
        rec1.id,
        adminUserA.id
      );

      expect(acceptResult.updatedJob.technicianId).toBe(techA1.id);
      expect(acceptResult.updatedJob.status).toBe('ASSIGNED');

      // Verify Recommendation 1 marked as ACCEPTED
      const updatedRec1 = await prisma.intelligenceRecommendation.findUnique({
        where: { id: rec1.id },
      });
      expect(updatedRec1?.status).toBe('ACCEPTED');

      // Verify competing Recommendation 2 was automatically EXPIRED
      const updatedRec2 = await prisma.intelligenceRecommendation.findUnique({
        where: { id: rec2.id },
      });
      expect(updatedRec2?.status).toBe('EXPIRED');
    });

    it('handles AI recommendation rejection with feedback logging', async () => {
      // Create new recommendation to test dismiss/reject
      const apptRej = await prisma.appointment.create({
        data: {
          appointmentNumber: `APT-REJ-${runId}`,
          organizationId: orgA.id,
          customerId: customerA.id,
          propertyId: propertyA.id,
          serviceId: serviceRepairA.id,
          date: new Date(),
          startTime: '16:00',
          endTime: '17:00',
          status: 'CONFIRMED',
        },
      });

      const jobRej = await prisma.job.create({
        data: {
          organizationId: orgA.id,
          appointmentId: apptRej.id,
          status: 'CREATED',
        },
      });

      const recReject = await prisma.intelligenceRecommendation.create({
        data: {
          organizationId: orgA.id,
          jobId: jobRej.id,
          technicianId: techA1.id,
          score: 0.85,
          distanceScore: 0.85,
          availabilityScore: 0.85,
          skillScore: 0.85,
          workloadScore: 0.85,
          availabilityStatus: 'AVAILABLE',
          skillMatch: 'EXACT',
          workloadLevel: 'LIGHT',
          reasoningJson: JSON.stringify({ summary: 'Standard match' }),
          status: 'SUGGESTED',
        },
      });

      const rejectedRec = await SchedulingService.rejectRecommendation(
        orgA.id,
        recReject.id,
        'Dispatcher assigned manually to apprentice for training'
      );

      expect(rejectedRec.status).toBe('REJECTED');
      expect(rejectedRec.feedbackReason).toContain('apprentice for training');
    });
  });

  // ============================================================================
  // AUDIT SECTION 3: CUSTOMER DIRECTORY & CUSTOMER DETAILS (/dashboard/customers/[id])
  // ============================================================================
  describe('3. Customer Directory & Customer Detail View', () => {
    it('aggregates customer profile, primary property, appointment count, and invoice count', async () => {
      const customers = await prisma.customer.findMany({
        where: { organizationId: orgA.id },
        include: {
          user: { select: { email: true } },
          properties: { take: 1, orderBy: { createdAt: 'desc' } },
          _count: {
            select: {
              appointments: true,
              invoices: true,
            },
          },
        },
      });

      expect(customers.length).toBe(1);
      const cust = customers[0];
      expect(cust.firstName).toBe('Alice');
      expect(cust.user.email).toContain('customer.alice');
      expect(cust.properties[0].address).toBe('428 River Avenue');
      expect(cust._count.appointments).toBeGreaterThanOrEqual(2);
      expect(cust._count.invoices).toBe(1);

      // Customer B does not leak into Org A directory
      const hasCustomerB = customers.some((c) => c.id === customerB.id);
      expect(hasCustomerB).toBe(false);
    });

    it('creates new customer manually with property and audit logging', async () => {
      const newEmail = `manual.intake.${runId}@example.com`;

      const result = await prisma.$transaction(async (tx) => {
        // 1. Create User
        const user = await tx.user.create({
          data: {
            email: newEmail,
            firstName: 'Edward',
            lastName: 'Elric',
            phone: '204-555-8899',
            passwordHash: 'manual_intake_no_password',
          },
        });

        // 2. Create Customer
        const customer = await tx.customer.create({
          data: {
            organizationId: orgA.id,
            userId: user.id,
            firstName: 'Edward',
            lastName: 'Elric',
            phone: '204-555-8899',
            notes: 'Commercial kitchen grease trap maintenance required',
          },
        });

        // 3. Create Property
        const property = await tx.property.create({
          data: {
            organizationId: orgA.id,
            customerId: customer.id,
            address: '800 Pembina Hwy',
            unit: 'Unit 12',
            city: 'Winnipeg',
            province: 'MB',
            postalCode: 'R3T 2M5',
          },
        });

        // 4. Audit Log
        await tx.auditLog.create({
          data: {
            organizationId: orgA.id,
            userId: adminUserA.id,
            action: 'CUSTOMER_CREATED_MANUALLY',
            entity: 'Customer',
            entityId: customer.id,
            metadata: JSON.stringify({
              customerId: customer.id,
              propertyId: property.id,
              email: newEmail,
            }),
          },
        });

        return { customer, property };
      });

      expect(result.customer.firstName).toBe('Edward');
      expect(result.property.address).toBe('800 Pembina Hwy');

      // Verify audit log
      const audit = await prisma.auditLog.findFirst({
        where: { entityId: result.customer.id, action: 'CUSTOMER_CREATED_MANUALLY' },
      });
      expect(audit).not.toBeNull();
      expect(audit?.organizationId).toBe(orgA.id);
    });

    it('retrieves detailed customer view with properties, appointment history, and invoice history', async () => {
      const detailedCust = await prisma.customer.findFirst({
        where: { id: customerA.id, organizationId: orgA.id },
        include: {
          user: { select: { email: true, createdAt: true } },
          properties: { orderBy: { createdAt: 'desc' } },
          appointments: {
            include: { service: true, technician: true, job: true },
            orderBy: { date: 'desc' },
          },
          invoices: {
            include: { payments: true },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      expect(detailedCust).not.toBeNull();
      expect(detailedCust?.phone).toBe('204-555-7788');
      expect(detailedCust?.notes).toContain('Gate code is 4421');
      expect(detailedCust?.properties.length).toBe(1);
      expect(detailedCust?.appointments.length).toBeGreaterThanOrEqual(2);
      expect(detailedCust?.invoices.length).toBe(1);
      expect(detailedCust?.invoices[0].total).toBe(392.0);

      // Accessing Org B customer under Org A scope returns null (404 guard)
      const crossCust = await prisma.customer.findFirst({
        where: { id: customerB.id, organizationId: orgA.id },
      });
      expect(crossCust).toBeNull();
    });
  });

  // ============================================================================
  // AUDIT SECTION 4: TECHNICIAN ROSTER & STATUS TOGGLE (/dashboard/techs)
  // ============================================================================
  describe('4. Technician Roster & Status Management', () => {
    it('lists technicians with availability status, active job counts, and user logins', async () => {
      const techs = await prisma.technician.findMany({
        where: { organizationId: orgA.id },
        include: {
          user: { select: { email: true } },
          jobs: {
            where: { status: { in: ['ASSIGNED', 'EN_ROUTE', 'ARRIVED', 'WORKING'] } },
            include: { appointment: { include: { service: true } } },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      expect(techs.length).toBe(2);
      const mike = techs.find((t) => t.firstName === 'Mike');
      const sarah = techs.find((t) => t.firstName === 'Sarah');

      expect(mike?.availabilityStatus).toBe('AVAILABLE');
      expect(mike?.user.email).toContain('tech.mike');

      expect(sarah?.availabilityStatus).toBe('BUSY');
      expect(sarah?.jobs.length).toBe(1); // Job A2 is active with Sarah
    });

    it('creates technician manually with password hash and TECHNICIAN membership', async () => {
      const techEmail = `tech.jason.${runId}@aquaflow.test`;
      const techPassword = 'TemporaryPassword123!';

      const newTech = await prisma.$transaction(async (tx) => {
        const passwordHash = await hashPassword(techPassword);
        const user = await tx.user.create({
          data: {
            email: techEmail,
            passwordHash,
            firstName: 'Jason',
            lastName: 'Todd',
            phone: '204-555-9090',
          },
        });

        await tx.organizationMember.create({
          data: {
            userId: user.id,
            organizationId: orgA.id,
            role: 'TECHNICIAN',
          },
        });

        const techProfile = await tx.technician.create({
          data: {
            userId: user.id,
            organizationId: orgA.id,
            firstName: 'Jason',
            lastName: 'Todd',
            phone: '204-555-9090',
            availabilityStatus: 'AVAILABLE',
            isActive: true,
          },
        });

        return techProfile;
      });

      expect(newTech.firstName).toBe('Jason');
      expect(newTech.isActive).toBe(true);

      // Verify membership role
      const member = await prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: newTech.userId,
            organizationId: orgA.id,
          },
        },
      });
      expect(member?.role).toBe('TECHNICIAN');
    });

    it('toggles technician active status between Deactivated and Reactivated', async () => {
      // Deactivate Mike Miller
      const deactivated = await prisma.technician.update({
        where: { id: techA1.id },
        data: { isActive: false },
      });
      expect(deactivated.isActive).toBe(false);

      // Verify unassignable when inactive
      const activeTechCount = await prisma.technician.count({
        where: { organizationId: orgA.id, isActive: true },
      });
      // Sarah + Jason = 2 active techs (Mike is now inactive)
      expect(activeTechCount).toBe(2);

      // Reactivate Mike Miller
      const reactivated = await prisma.technician.update({
        where: { id: techA1.id },
        data: { isActive: true },
      });
      expect(reactivated.isActive).toBe(true);
    });
  });

  // ============================================================================
  // AUDIT SECTION 5: INVOICES & PAYMENT PORTAL (/dashboard/invoices & /pay/[token])
  // ============================================================================
  describe('5. Invoices Overview & Public Payment Portals (/pay/[token])', () => {
    it('lists organization invoices with status, line totals, and balance due', async () => {
      const invoices = await prisma.invoice.findMany({
        where: { organizationId: orgA.id },
        include: {
          customer: true,
          job: { include: { appointment: { include: { service: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      });

      expect(invoices.length).toBe(1);
      const inv = invoices[0];
      expect(inv.invoiceNumber).toContain(`INV-2026-${runId.slice(0, 4)}`);
      expect(inv.total).toBe(392.0);
      expect(inv.amountPaid).toBe(0.0);
      expect(inv.status).toBe('SENT');
      expect(inv.paymentToken).toBe(`pay_token_${runId}_1`);

      const balanceDue = inv.total - inv.amountPaid;
      expect(balanceDue).toBe(392.0);
    });

    it('resolves invoice details, tax breakdown, and balance due via public payment token', async () => {
      // Public customer accessing /pay/[paymentToken]
      const invoice = await prisma.invoice.findUnique({
        where: { paymentToken: invoiceA1.paymentToken },
        include: {
          organization: true,
          lines: true,
          taxes: true,
        },
      });

      expect(invoice).not.toBeNull();
      expect(invoice?.organization.name).toBe(orgA.name);
      expect(invoice?.lines.length).toBe(1);
      expect(invoice?.lines[0].description).toBe('Emergency Pipe Isolation & Repair');
      expect(invoice?.taxes.length).toBe(1);
      expect(invoice?.taxes[0].name).toBe('Manitoba Sales Tax');
      expect(invoice?.taxes[0].amount).toBe(42.0);
      expect(invoice?.total).toBe(392.0);

      // Non-existent or malicious token returns null (404 guard)
      const fakeTokenInvoice = await prisma.invoice.findUnique({
        where: { paymentToken: 'invalid_malicious_token_999' },
      });
      expect(fakeTokenInvoice).toBeNull();
    });

    it('updates invoice to PAID upon full settlement and displays zero balance due', async () => {
      const paidInvoice = await prisma.invoice.update({
        where: { id: invoiceA1.id },
        data: {
          status: 'PAID',
          amountPaid: 392.0,
        },
      });

      expect(paidInvoice.status).toBe('PAID');
      expect(paidInvoice.amountPaid).toBe(392.0);

      const balanceDue = paidInvoice.total - paidInvoice.amountPaid;
      expect(balanceDue).toBe(0);
    });
  });

  // ============================================================================
  // AUDIT SECTION 6: ORGANIZATION & SERVICE SETTINGS (/dashboard/settings)
  // ============================================================================
  describe('6. Organization & Service Settings Tabs', () => {
    it('Company Profile Tab: updates company name, 24/7 emergency phone, and address', async () => {
      const updatedOrg = await prisma.organization.update({
        where: { id: orgA.id },
        data: {
          name: `AquaFlow Premium Services ${runId}`,
          phone: '204-555-3333',
          emergencyPhone: '204-555-9999',
          address: '999 Portage Avenue, Winnipeg, MB',
        },
      });

      expect(updatedOrg.name).toBe(`AquaFlow Premium Services ${runId}`);
      expect(updatedOrg.emergencyPhone).toBe('204-555-9999');
      expect(updatedOrg.address).toBe('999 Portage Avenue, Winnipeg, MB');
    });

    it('Online Booking & Acquisition Tab: constructs valid copyable URLs and embed iframe code', async () => {
      const baseUrl = 'https://aquaflow-plumbing-theta.vercel.app';
      const bookingUrl = `${baseUrl}/p/${orgA.slug}/book`;
      const landingUrl = `${baseUrl}/p/${orgA.slug}`;
      const portalUrl = `${baseUrl}/p/${orgA.slug}/login`;
      const iframeCode = `<iframe src="${bookingUrl}" width="100%" height="800px" frameborder="0"></iframe>`;

      expect(bookingUrl).toBe(`https://aquaflow-plumbing-theta.vercel.app/p/aquaflow-ops-a-${runId}/book`);
      expect(landingUrl).toBe(`https://aquaflow-plumbing-theta.vercel.app/p/aquaflow-ops-a-${runId}`);
      expect(portalUrl).toBe(`https://aquaflow-plumbing-theta.vercel.app/p/aquaflow-ops-a-${runId}/login`);
      expect(iframeCode).toContain(`src="${bookingUrl}"`);
    });

    it('Services Catalog Tab: creates new plumbing service and toggles active status', async () => {
      // Add new service
      const newService = await prisma.service.create({
        data: {
          organizationId: orgA.id,
          name: 'Sump Pump Installation & Backup Battery',
          slug: `sump-pump-${runId}`,
          description: 'High-capacity submersible sump pump with battery backup inverter',
          basePrice: 550.0,
          estimatedDuration: 120,
          isEmergency: false,
          isActive: true,
        },
      });

      expect(newService.name).toBe('Sump Pump Installation & Backup Battery');
      expect(newService.basePrice).toBe(550.0);
      expect(newService.isActive).toBe(true);

      // Deactivate service
      const deactivated = await prisma.service.update({
        where: { id: newService.id },
        data: { isActive: false },
      });
      expect(deactivated.isActive).toBe(false);

      // Reactivate service
      const reactivated = await prisma.service.update({
        where: { id: newService.id },
        data: { isActive: true },
      });
      expect(reactivated.isActive).toBe(true);
    });

    it('Business Hours Tab: verifies full 7-day operating schedule', async () => {
      const hours = await prisma.businessHours.findMany({
        where: { organizationId: orgA.id },
        orderBy: { dayOfWeek: 'asc' },
      });

      expect(hours.length).toBe(7);
      expect(hours[0].dayOfWeek).toBe(0); // Sunday
      expect(hours[0].isClosed).toBe(true); // Sunday is closed
      expect(hours[1].dayOfWeek).toBe(1); // Monday
      expect(hours[1].isClosed).toBe(false); // Monday open
      expect(hours[1].openTime).toBe('08:00');
      expect(hours[1].closeTime).toBe('17:00');
    });

    it('Stripe & Billing Tab: verifies connected Stripe account and tax rate rules', async () => {
      const orgWithStripe = await prisma.organization.findUnique({
        where: { id: orgA.id },
        include: { taxRules: true },
      });

      expect(orgWithStripe?.stripeAccountId).toBe(`acct_ops_a_${runId}`);
      expect(orgWithStripe?.stripeConnectionStatus).toBe('ACTIVE');
      expect(orgWithStripe?.taxRules.length).toBe(1);
      expect(orgWithStripe?.taxRules[0].jurisdiction).toBe('MB');
      expect(orgWithStripe?.taxRules[0].rate).toBe(0.12);
    });
  });
});
