import { prisma } from '../src/lib/db';
import { generateAppointmentNumber } from '../src/lib/utils';

async function main() {
  const service = await prisma.service.findFirst({
    where: { organization: { slug: 'aquaflow' } }
  });
  console.log('Using service:', service?.id, service?.name);
  const organizationId = service!.organizationId;

  const result = await prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({
      where: { email: 'live.customer@example.com' }
    });
    if (!user) {
      user = await tx.user.create({
        data: {
          email: 'live.customer@example.com',
          firstName: 'Live',
          lastName: 'Pilot Customer',
          phone: '2045550199'
        }
      });
    }

    let customer = await tx.customer.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId
        }
      }
    });

    if (!customer) {
      customer = await tx.customer.create({
        data: {
          organizationId,
          userId: user.id,
          firstName: 'Live',
          lastName: 'Pilot Customer',
          phone: '2045550199'
        }
      });
    }

    const property = await tx.property.create({
      data: {
        organizationId,
        customerId: customer.id,
        address: '123 Main St',
        city: 'Winnipeg',
        province: 'MB',
        postalCode: 'R3C 1A5'
      }
    });

    const appointmentNumber = generateAppointmentNumber();
    const appointment = await tx.appointment.create({
      data: {
        appointmentNumber,
        organizationId,
        customerId: customer.id,
        propertyId: property.id,
        serviceId: service!.id,
        date: new Date('2026-08-25'),
        startTime: '09:00',
        endTime: '11:00',
        status: 'PENDING',
        priority: 'STANDARD',
        isEmergency: false,
        problemDescription: 'Commercial water heater diagnostic'
      }
    });

    const job = await tx.job.create({
      data: {
        appointmentId: appointment.id,
        organizationId,
        status: 'CREATED'
      }
    });

    return { appointmentNumber, jobId: job.id, customerId: customer.id };
  });

  console.log('Booking creation result:', result);
}

main().catch(console.error);
