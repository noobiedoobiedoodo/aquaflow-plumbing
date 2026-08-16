import { prisma } from '../src/lib/db';
import bcryptjs from 'bcryptjs';

// ============================================================================
// SEED DATA DEFINITIONS
// ============================================================================

const DEFAULT_SERVICES = [
  {
    name: 'Emergency Plumbing',
    slug: 'emergency-plumbing',
    shortDescription: 'Immediate response for urgent plumbing emergencies.',
    description:
      'When a plumbing emergency strikes, every minute counts. Our emergency plumbing team provides rapid response for burst pipes, major leaks, sewage backups, and other urgent situations that require immediate professional attention.',
    category: 'Emergency',
    icon: 'AlertTriangle',
    estimatedDuration: 120,
    basePrice: 150.0,
    isEmergency: true,
    sortOrder: 0,
  },
  {
    name: 'Drain Cleaning',
    slug: 'drain-cleaning',
    shortDescription: 'Professional clearing of clogged and slow drains.',
    description:
      'Our professional drain cleaning service uses advanced equipment to clear stubborn blockages, remove buildup, and restore proper drainage throughout your home. We handle kitchen drains, bathroom drains, floor drains, and main sewer lines.',
    category: 'Drain',
    icon: 'ArrowDownToLine',
    estimatedDuration: 90,
    basePrice: 120.0,
    isEmergency: false,
    sortOrder: 1,
  },
  {
    name: 'Sewer Services',
    slug: 'sewer-services',
    shortDescription: 'Comprehensive sewer line inspection, repair, and replacement.',
    description:
      'From camera inspections to full sewer line replacements, our team handles all aspects of sewer service. We identify problems accurately with video inspection technology and provide lasting solutions for damaged, blocked, or aging sewer lines.',
    category: 'Sewer',
    icon: 'ScanLine',
    estimatedDuration: 180,
    basePrice: 200.0,
    isEmergency: false,
    sortOrder: 2,
  },
  {
    name: 'Leak Detection',
    slug: 'leak-detection',
    shortDescription: 'Advanced technology to locate hidden leaks.',
    description:
      'Hidden leaks can cause significant damage to your property. Our leak detection service uses advanced acoustic and thermal technology to pinpoint leaks behind walls, under floors, and in underground pipes without unnecessary demolition.',
    category: 'Detection',
    icon: 'Search',
    estimatedDuration: 120,
    basePrice: 140.0,
    isEmergency: false,
    sortOrder: 3,
  },
  {
    name: 'Water Heaters',
    slug: 'water-heaters',
    shortDescription: 'Installation, repair, and replacement of water heaters.',
    description:
      'Whether you need a new water heater installed, your existing unit repaired, or an upgrade to a more efficient system, our technicians handle all types of water heaters including traditional tank and heat pump systems.',
    category: 'Water Heater',
    icon: 'Flame',
    estimatedDuration: 180,
    basePrice: 160.0,
    isEmergency: false,
    sortOrder: 4,
  },
  {
    name: 'Tankless Water Heaters',
    slug: 'tankless-water-heaters',
    shortDescription: 'On-demand hot water with tankless systems.',
    description:
      'Tankless water heaters provide endless hot water on demand while saving energy and space. We install, maintain, and repair all major brands of tankless water heating systems.',
    category: 'Water Heater',
    icon: 'Zap',
    estimatedDuration: 240,
    basePrice: 220.0,
    isEmergency: false,
    sortOrder: 5,
  },
  {
    name: 'Toilet Repair',
    slug: 'toilet-repair',
    shortDescription: 'Expert repair and replacement for all toilet issues.',
    description:
      'From running toilets and weak flushes to complete replacements, we handle all toilet repairs efficiently. Our technicians diagnose the issue accurately and provide lasting solutions.',
    category: 'Fixtures',
    icon: 'Droplets',
    estimatedDuration: 60,
    basePrice: 95.0,
    isEmergency: false,
    sortOrder: 6,
  },
  {
    name: 'Faucet Repair',
    slug: 'faucet-repair',
    shortDescription: 'Repair and installation of kitchen and bathroom faucets.',
    description:
      'Dripping faucets waste water and money. We repair and replace all types of faucets including kitchen, bathroom, utility, and outdoor faucets with quality fixtures that last.',
    category: 'Fixtures',
    icon: 'Droplet',
    estimatedDuration: 60,
    basePrice: 85.0,
    isEmergency: false,
    sortOrder: 7,
  },
  {
    name: 'Sump Pumps',
    slug: 'sump-pumps',
    shortDescription: 'Installation, repair, and maintenance of sump pump systems.',
    description:
      'Protect your basement from flooding with a properly functioning sump pump system. We install new systems, repair existing pumps, and provide backup power solutions for reliable protection.',
    category: 'Pumps',
    icon: 'ArrowUpFromLine',
    estimatedDuration: 120,
    basePrice: 130.0,
    isEmergency: false,
    sortOrder: 8,
  },
  {
    name: 'Garbage Disposals',
    slug: 'garbage-disposals',
    shortDescription: 'Installation and repair of garbage disposal units.',
    description:
      'We install and repair all major brands of garbage disposals. Whether your unit needs a quick fix or a complete replacement, our technicians get your kitchen back to full functionality.',
    category: 'Fixtures',
    icon: 'RotateCcw',
    estimatedDuration: 60,
    basePrice: 90.0,
    isEmergency: false,
    sortOrder: 9,
  },
  {
    name: 'Pipe Repair',
    slug: 'pipe-repair',
    shortDescription: 'Professional repair of damaged, leaking, or corroded pipes.',
    description:
      'From minor leaks to major pipe damage, our pipe repair service addresses all types of pipe problems. We work with copper, PEX, PVC, and cast iron piping systems throughout your property.',
    category: 'Pipes',
    icon: 'Wrench',
    estimatedDuration: 120,
    basePrice: 130.0,
    isEmergency: false,
    sortOrder: 10,
  },
  {
    name: 'Pipe Replacement',
    slug: 'pipe-replacement',
    shortDescription: 'Full pipe replacement and repiping services.',
    description:
      'When repairs are no longer sufficient, our pipe replacement service provides comprehensive repiping solutions. We replace aging, corroded, or damaged pipes with modern, durable materials.',
    category: 'Pipes',
    icon: 'Replace',
    estimatedDuration: 480,
    basePrice: 350.0,
    isEmergency: false,
    sortOrder: 11,
  },
  {
    name: 'Frozen Pipes',
    slug: 'frozen-pipes',
    shortDescription: 'Safe thawing and protection against frozen pipes.',
    description:
      'Frozen pipes can burst and cause extensive water damage. Our team safely thaws frozen pipes and installs preventive measures to protect your plumbing from future freezing.',
    category: 'Emergency',
    icon: 'Snowflake',
    estimatedDuration: 120,
    basePrice: 175.0,
    isEmergency: true,
    sortOrder: 12,
  },
  {
    name: 'Commercial Plumbing',
    slug: 'commercial-plumbing',
    shortDescription: 'Professional plumbing services for commercial properties.',
    description:
      'We provide comprehensive plumbing services for commercial properties including offices, retail spaces, restaurants, and industrial facilities. Our commercial team handles installations, repairs, maintenance, and emergency services.',
    category: 'Commercial',
    icon: 'Building',
    estimatedDuration: 240,
    basePrice: 250.0,
    isEmergency: false,
    sortOrder: 13,
  },
];

const DEFAULT_SERVICE_AREAS = [
  { name: 'Winnipeg', slug: 'winnipeg', description: 'Serving all areas of Winnipeg with professional plumbing services.', sortOrder: 0 },
  { name: 'Headingley', slug: 'headingley', description: 'Professional plumbing services in Headingley and surrounding areas.', sortOrder: 1 },
  { name: 'East St. Paul', slug: 'east-st-paul', description: 'Reliable plumbing services for East St. Paul residents.', sortOrder: 2 },
  { name: 'West St. Paul', slug: 'west-st-paul', description: 'Expert plumbing services in West St. Paul.', sortOrder: 3 },
  { name: 'Oak Bluff', slug: 'oak-bluff', description: 'Professional plumbing services in Oak Bluff.', sortOrder: 4 },
  { name: 'St. Andrews', slug: 'st-andrews', description: 'Trusted plumbing services for St. Andrews.', sortOrder: 5 },
  { name: 'Selkirk', slug: 'selkirk', description: 'Quality plumbing services in Selkirk.', sortOrder: 6 },
  { name: 'Stonewall', slug: 'stonewall', description: 'Professional plumbing services for Stonewall and area.', sortOrder: 7 },
];

const DEFAULT_BUSINESS_HOURS = [
  { dayOfWeek: 0, openTime: '10:00', closeTime: '16:00', isClosed: false }, // Sunday
  { dayOfWeek: 1, openTime: '07:00', closeTime: '18:00', isClosed: false }, // Monday
  { dayOfWeek: 2, openTime: '07:00', closeTime: '18:00', isClosed: false }, // Tuesday
  { dayOfWeek: 3, openTime: '07:00', closeTime: '18:00', isClosed: false }, // Wednesday
  { dayOfWeek: 4, openTime: '07:00', closeTime: '18:00', isClosed: false }, // Thursday
  { dayOfWeek: 5, openTime: '07:00', closeTime: '18:00', isClosed: false }, // Friday
  { dayOfWeek: 6, openTime: '08:00', closeTime: '16:00', isClosed: false }, // Saturday
];

const SAMPLE_REVIEWS = [
  {
    customerName: 'Sarah M.',
    rating: 5,
    content:
      'AquaFlow came to our rescue when a pipe burst in our basement during the winter freeze. Mike arrived within 45 minutes, fixed the break quickly, and was extremely professional. Highly recommended!',
    isPublished: true,
    isFeatured: true,
    source: 'google',
  },
  {
    customerName: 'David K.',
    rating: 5,
    content:
      'Had a tankless water heater installed last month. The entire process from quote to completion was seamless. The water heater works perfectly and our energy bills have already gone down.',
    isPublished: true,
    isFeatured: true,
    source: 'direct',
  },
  {
    customerName: 'Jennifer L.',
    rating: 5,
    content:
      'Called them for a stubborn kitchen drain clog that other plumbers could not clear. The technician used a camera to diagnose the root issue and had it flowing like new in under an hour.',
    isPublished: true,
    isFeatured: false,
    source: 'google',
  },
  {
    customerName: 'Robert T.',
    rating: 4,
    content:
      'Prompt and courteous service for our bathroom fixture replacement. Cleaned up everything afterwards and explained the warranty clearly.',
    isPublished: true,
    isFeatured: false,
    source: 'direct',
  },
  {
    customerName: 'Amanda P.',
    rating: 5,
    content:
      'Excellent sump pump installation. They walked me through the battery backup system and tested everything thoroughly. Gives me great peace of mind during spring thaw.',
    isPublished: true,
    isFeatured: true,
    source: 'google',
  },
  {
    customerName: 'Chris B.',
    rating: 5,
    content:
      'Very transparent pricing with no surprise fees. Diagnosed our leak without tearing down our drywall unnecessarily. Will definitely use AquaFlow again!',
    isPublished: true,
    isFeatured: false,
    source: 'direct',
  },
];

// ============================================================================
// MAIN SEED FUNCTION
// ============================================================================

async function main() {
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_PROD_SEED !== 'true') {
    console.error('CRITICAL: Cannot run seed script in production without ALLOW_PROD_SEED=true.');
    console.error('Aborting seed to prevent injection of default credentials.');
    process.exit(1);
  }

  console.log('🌱 Starting database seed...');

  // 1. Create or update default Organization
  console.log('🏢 Seeding Organization...');
  const org = await prisma.organization.upsert({
    where: { slug: 'aquaflow' },
    update: {
      name: 'AquaFlow Plumbing' /* PLACEHOLDER */,
      phone: '(204) 555-0199' /* PLACEHOLDER */,
      emergencyPhone: '(204) 555-0911' /* PLACEHOLDER */,
      email: 'info@aquaflowplumbing.com' /* PLACEHOLDER */,
      address: '123 Main Street' /* PLACEHOLDER */,
      city: 'Winnipeg',
      province: 'MB',
      postalCode: 'R3C 1A1' /* PLACEHOLDER */,
      timezone: 'America/Winnipeg',
      taxRate: 0.05,
      currency: 'CAD',
      isActive: true,
    },
    create: {
      name: 'AquaFlow Plumbing' /* PLACEHOLDER */,
      slug: 'aquaflow',
      phone: '(204) 555-0199' /* PLACEHOLDER */,
      emergencyPhone: '(204) 555-0911' /* PLACEHOLDER */,
      email: 'info@aquaflowplumbing.com' /* PLACEHOLDER */,
      address: '123 Main Street' /* PLACEHOLDER */,
      city: 'Winnipeg',
      province: 'MB',
      postalCode: 'R3C 1A1' /* PLACEHOLDER */,
      country: 'CA',
      timezone: 'America/Winnipeg',
      taxRate: 0.05,
      currency: 'CAD',
      isActive: true,
    },
  });
  console.log(`   ✓ Organization ready: ${org.name} (${org.id})`);

  // 2. Create or update Admin User
  console.log('👤 Seeding Admin User...');
  const adminPasswordHash = await bcryptjs.hash('admin123', 10);
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@aquaflowplumbing.com' /* PLACEHOLDER */ },
    update: {
      passwordHash: adminPasswordHash,
      firstName: 'Admin',
      lastName: 'User',
      emailVerified: true,
      isActive: true,
    },
    create: {
      email: 'admin@aquaflowplumbing.com' /* PLACEHOLDER */,
      passwordHash: adminPasswordHash,
      firstName: 'Admin',
      lastName: 'User',
      emailVerified: true,
      isActive: true,
    },
  });

  // Link Admin to Organization as SUPER_ADMIN
  await prisma.organizationMember.upsert({
    where: {
      userId_organizationId: {
        userId: adminUser.id,
        organizationId: org.id,
      },
    },
    update: {
      role: 'SUPER_ADMIN',
      isActive: true,
    },
    create: {
      userId: adminUser.id,
      organizationId: org.id,
      role: 'SUPER_ADMIN',
      isActive: true,
    },
  });
  console.log(`   ✓ Admin user ready: ${adminUser.email} (SUPER_ADMIN)`);

  // 3. Create or update Services
  console.log('🛠️  Seeding Services...');
  let serviceCount = 0;
  for (const service of DEFAULT_SERVICES) {
    await prisma.service.upsert({
      where: {
        organizationId_slug: {
          organizationId: org.id,
          slug: service.slug,
        },
      },
      update: {
        name: service.name,
        shortDescription: service.shortDescription,
        description: service.description,
        category: service.category,
        icon: service.icon,
        estimatedDuration: service.estimatedDuration,
        basePrice: service.basePrice,
        isEmergency: service.isEmergency,
        sortOrder: service.sortOrder,
        isActive: true,
      },
      create: {
        organizationId: org.id,
        name: service.name,
        slug: service.slug,
        shortDescription: service.shortDescription,
        description: service.description,
        category: service.category,
        icon: service.icon,
        estimatedDuration: service.estimatedDuration,
        basePrice: service.basePrice,
        isEmergency: service.isEmergency,
        sortOrder: service.sortOrder,
        isActive: true,
      },
    });
    serviceCount++;
  }
  console.log(`   ✓ ${serviceCount} services seeded`);

  // 4. Create or update Service Areas
  console.log('📍 Seeding Service Areas...');
  let areaCount = 0;
  for (const area of DEFAULT_SERVICE_AREAS) {
    await prisma.serviceArea.upsert({
      where: {
        organizationId_slug: {
          organizationId: org.id,
          slug: area.slug,
        },
      },
      update: {
        name: area.name,
        description: area.description,
        sortOrder: area.sortOrder,
        isActive: true,
      },
      create: {
        organizationId: org.id,
        name: area.name,
        slug: area.slug,
        description: area.description,
        sortOrder: area.sortOrder,
        isActive: true,
      },
    });
    areaCount++;
  }
  console.log(`   ✓ ${areaCount} service areas seeded`);

  // 5. Create or update Business Hours
  console.log('⏰ Seeding Business Hours...');
  let hoursCount = 0;
  for (const hours of DEFAULT_BUSINESS_HOURS) {
    await prisma.businessHours.upsert({
      where: {
        organizationId_dayOfWeek: {
          organizationId: org.id,
          dayOfWeek: hours.dayOfWeek,
        },
      },
      update: {
        openTime: hours.openTime,
        closeTime: hours.closeTime,
        isClosed: hours.isClosed,
      },
      create: {
        organizationId: org.id,
        dayOfWeek: hours.dayOfWeek,
        openTime: hours.openTime,
        closeTime: hours.closeTime,
        isClosed: hours.isClosed,
      },
    });
    hoursCount++;
  }
  console.log(`   ✓ ${hoursCount} business hour schedules seeded`);

  // 6. Create Demo Technician User & Record
  console.log('🔧 Seeding Demo Technician...');
  const techPasswordHash = await bcryptjs.hash('tech123', 10);
  const techUser = await prisma.user.upsert({
    where: { email: 'tech@aquaflowplumbing.com' /* PLACEHOLDER */ },
    update: {
      passwordHash: techPasswordHash,
      firstName: 'Mike',
      lastName: 'Johnson',
      phone: '(204) 555-0199' /* PLACEHOLDER */,
      emailVerified: true,
      isActive: true,
    },
    create: {
      email: 'tech@aquaflowplumbing.com' /* PLACEHOLDER */,
      passwordHash: techPasswordHash,
      firstName: 'Mike',
      lastName: 'Johnson',
      phone: '(204) 555-0199' /* PLACEHOLDER */,
      emailVerified: true,
      isActive: true,
    },
  });

  // Link Tech to Organization as TECHNICIAN
  await prisma.organizationMember.upsert({
    where: {
      userId_organizationId: {
        userId: techUser.id,
        organizationId: org.id,
      },
    },
    update: {
      role: 'TECHNICIAN',
      isActive: true,
    },
    create: {
      userId: techUser.id,
      organizationId: org.id,
      role: 'TECHNICIAN',
      isActive: true,
    },
  });

  // Create or update Technician profile
  const techRecord = await prisma.technician.upsert({
    where: { userId: techUser.id },
    update: {
      organizationId: org.id,
      firstName: 'Mike',
      lastName: 'Johnson',
      phone: '(204) 555-0199' /* PLACEHOLDER */,
      skills: JSON.stringify([
        'emergency-plumbing',
        'drain-cleaning',
        'water-heaters',
        'tankless-water-heaters',
        'pipe-repair',
        'leak-detection',
        'sump-pumps',
      ]),
      isActive: true,
    },
    create: {
      userId: techUser.id,
      organizationId: org.id,
      firstName: 'Mike',
      lastName: 'Johnson',
      phone: '(204) 555-0199' /* PLACEHOLDER */,
      skills: JSON.stringify([
        'emergency-plumbing',
        'drain-cleaning',
        'water-heaters',
        'tankless-water-heaters',
        'pipe-repair',
        'leak-detection',
        'sump-pumps',
      ]),
      isActive: true,
    },
  });

  // Seed Technician Schedule (Monday through Friday, 08:00 - 17:00)
  for (let day = 1; day <= 5; day++) {
    await prisma.technicianSchedule.upsert({
      where: {
        technicianId_dayOfWeek: {
          technicianId: techRecord.id,
          dayOfWeek: day,
        },
      },
      update: {
        startTime: '08:00',
        endTime: '17:00',
        isActive: true,
      },
      create: {
        technicianId: techRecord.id,
        dayOfWeek: day,
        startTime: '08:00',
        endTime: '17:00',
        isActive: true,
      },
    });
  }
  console.log(`   ✓ Demo technician ready: ${techUser.email} (${techRecord.firstName} ${techRecord.lastName}) with Mon-Fri schedule`);

  // 7. Seed Sample Reviews
  console.log('⭐ Seeding Sample Customer Reviews...');
  const existingReviews = await prisma.review.findMany({
    where: { organizationId: org.id },
  });

  if (existingReviews.length === 0) {
    for (const review of SAMPLE_REVIEWS) {
      await prisma.review.create({
        data: {
          organizationId: org.id,
          customerName: review.customerName,
          rating: review.rating,
          content: review.content,
          isPublished: review.isPublished,
          isFeatured: review.isFeatured,
          source: review.source,
        },
      });
    }
    console.log(`   ✓ ${SAMPLE_REVIEWS.length} customer reviews created`);
  } else {
    console.log(`   ✓ Customer reviews already present (${existingReviews.length} found)`);
  }

  // Final Summary
  console.log('\n============================================================');
  console.log('✅ DATABASE SEED COMPLETE');
  console.log('============================================================');
  console.log(`Organization:  ${org.name} (${org.slug})`);
  console.log(`Admin Login:   admin@aquaflowplumbing.com / admin123`);
  console.log(`Tech Login:    tech@aquaflowplumbing.com / tech123`);
  console.log(`Services:      ${serviceCount} services`);
  console.log(`Service Areas: ${areaCount} areas`);
  console.log(`Hours:         7 days configured`);
  console.log('============================================================\n');
}

main()
  .catch((e) => {
    console.error('❌ Database seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
