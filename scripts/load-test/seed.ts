import { prisma } from '../../src/lib/db';
import { hashPassword } from '../../src/lib/auth/password';
import { ROLES } from '../../src/lib/constants';
import { LoadTestConfig } from './config';
import { TestRegistry, RegisteredCompany, RegisteredCustomer } from './registry';

export async function seedSyntheticTenants(
  config: LoadTestConfig,
  registry: TestRegistry
): Promise<void> {
  console.log(`[Seed] Generating ${config.companies} synthetic plumbing companies with prefix: ${config.prefix}`);

  const defaultPasswordHash = await hashPassword('TestPassword123!');

  for (let c = 0; c < config.companies; c++) {
    const orgIndex = (c + 1).toString().padStart(2, '0');
    const slug = `${config.prefix}company_${orgIndex}`.toLowerCase().replace(/_/g, '-');
    const companyName = `LoadTest Plumbing Co ${orgIndex}`;
    const companyEmail = `info@${slug}.test`;
    const stripeAccountId = `acct_loadtest_${config.runId}_${orgIndex}`;

    // 1. Create Organization
    const org = await prisma.organization.create({
      data: {
        name: companyName,
        slug,
        phone: `204-555-${(1000 + c).toString()}`,
        email: companyEmail,
        stripeAccountId,
        taxRate: 0.12,
        businessHours: {
          createMany: {
            data: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
              dayOfWeek: day,
              openTime: '08:00',
              closeTime: '17:00',
              isClosed: day === 0 || day === 6,
            })),
          },
        },
      },
    });

    // 2. Create Default Services
    const defaultServices = [
      { name: 'Standard Drain Cleaning', slug: 'drain-cleaning', durationMinutes: 60, price: 150.0 },
      { name: 'Emergency Pipe Repair', slug: 'pipe-repair', durationMinutes: 90, price: 250.0 },
      { name: 'Water Heater Diagnostic', slug: 'water-heater', durationMinutes: 45, price: 120.0 },
      { name: 'Faucet & Fixture Install', slug: 'fixture-install', durationMinutes: 60, price: 180.0 },
    ];

    for (const s of defaultServices) {
      await prisma.service.create({
        data: {
          organizationId: org.id,
          name: s.name,
          slug: `${s.slug}-${config.runId}`,
          estimatedDuration: s.durationMinutes,
          basePrice: s.price,
          isActive: true,
        },
      });
    }

    // 3. Create Company Owner
    const ownerEmail = `owner_${orgIndex}@${slug}.test`;
    const ownerUser = await prisma.user.create({
      data: {
        email: ownerEmail,
        firstName: 'Owner',
        lastName: `Company${orgIndex}`,
        passwordHash: defaultPasswordHash,
        passwordSetAt: new Date(),
        emailVerified: true,
        memberships: {
          create: {
            organizationId: org.id,
            role: ROLES.SUPER_ADMIN,
          },
        },
      },
    });

    const companyEntity: RegisteredCompany = {
      organizationId: org.id,
      slug: org.slug,
      name: org.name,
      phone: org.phone || '',
      email: org.email || companyEmail,
      stripeAccountId,
      ownerUserId: ownerUser.id,
      dispatchers: [],
      technicians: [],
      customers: [],
      jobs: [],
      invoices: [],
      estimates: [],
      photos: [],
    };

    // 4. Create Dispatchers
    for (let d = 1; d <= config.dispatchersPerCompany; d++) {
      const dIndex = d.toString().padStart(2, '0');
      const dEmail = `dispatcher_${dIndex}@${slug}.test`;

      const dUser = await prisma.user.create({
        data: {
          email: dEmail,
          firstName: `Dispatcher${dIndex}`,
          lastName: `Staff`,
          passwordHash: defaultPasswordHash,
          passwordSetAt: new Date(),
          emailVerified: true,
          memberships: {
            create: {
              organizationId: org.id,
              role: ROLES.DISPATCHER,
            },
          },
        },
      });

      companyEntity.dispatchers.push({
        userId: dUser.id,
        email: dUser.email,
      });
    }

    // 5. Create Technicians
    for (let t = 1; t <= config.techniciansPerCompany; t++) {
      const tIndex = t.toString().padStart(2, '0');
      const tEmail = `tech_${tIndex}@${slug}.test`;

      const tUser = await prisma.user.create({
        data: {
          email: tEmail,
          firstName: `Tech${tIndex}`,
          lastName: `Field`,
          passwordHash: defaultPasswordHash,
          passwordSetAt: new Date(),
          emailVerified: true,
          memberships: {
            create: {
              organizationId: org.id,
              role: ROLES.TECHNICIAN,
            },
          },
        },
      });

      const techProfile = await prisma.technician.create({
        data: {
          organizationId: org.id,
          userId: tUser.id,
          firstName: `Tech${tIndex}`,
          lastName: `Field`,
          phone: `204-555-20${tIndex}`,
          availabilityStatus: 'AVAILABLE',
          isActive: true,
        },
      });

      companyEntity.technicians.push({
        userId: tUser.id,
        technicianId: techProfile.id,
        email: tUser.email,
      });
    }

    // 6. Create Customers & Properties
    for (let cust = 1; cust <= config.customersPerCompany; cust++) {
      const custIndex = cust.toString().padStart(3, '0');
      const isSharedCustomer = cust <= config.sharedCustomersCount;

      let custEmail: string;
      if (isSharedCustomer) {
        // Shared homeowner across odd/even companies
        custEmail = `shared_${custIndex}@aquaflow-loadtest.test`;
      } else {
        custEmail = `customer_${custIndex}@${slug}.test`;
      }

      // Find or create global user
      let custUser = await prisma.user.findUnique({ where: { email: custEmail } });
      if (!custUser) {
        custUser = await prisma.user.create({
          data: {
            email: custEmail,
            firstName: `Customer${custIndex}`,
            lastName: isSharedCustomer ? 'SharedHomeowner' : 'Homeowner',
            passwordHash: isSharedCustomer ? defaultPasswordHash : null,
            passwordSetAt: isSharedCustomer ? new Date() : null,
            emailVerified: isSharedCustomer,
          },
        });
      }

      // Create tenant-scoped Customer
      const customerRecord = await prisma.customer.create({
        data: {
          organizationId: org.id,
          userId: custUser.id,
          firstName: `Customer${custIndex}`,
          lastName: isSharedCustomer ? 'SharedHomeowner' : 'Homeowner',
          phone: `204-555-3${custIndex}`,
        },
      });

      // Create 1-2 properties for this customer
      const prop1 = await prisma.property.create({
        data: {
          organizationId: org.id,
          customerId: customerRecord.id,
          address: `${100 + cust} Portage Avenue`,
          city: 'Winnipeg',
          province: 'MB',
          postalCode: 'R3C 0G1',
        },
      });

      const registeredCustomer: RegisteredCustomer = {
        userId: custUser.id,
        customerId: customerRecord.id,
        email: custEmail,
        password: isSharedCustomer ? 'TestPassword123!' : undefined,
        isActivated: isSharedCustomer,
        properties: [
          {
            id: prop1.id,
            address: prop1.address,
            city: prop1.city,
            postalCode: prop1.postalCode,
          },
        ],
      };

      companyEntity.customers.push(registeredCustomer);

      if (isSharedCustomer) {
        registry.registerSharedCustomer(custEmail, registeredCustomer);
      }
    }

    registry.registerCompany(companyEntity);
  }

  const summary = registry.getSummaryCounts();
  console.log(`[Seed Complete] Successfully seeded:
    • Organizations: ${summary.companiesCount}
    • Dispatchers:   ${summary.totalDispatchers}
    • Technicians:   ${summary.totalTechnicians}
    • Customers:     ${summary.totalCustomers}
    • Properties:    ${summary.totalProperties}`);
}
