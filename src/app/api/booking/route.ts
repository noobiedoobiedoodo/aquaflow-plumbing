import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { bookingSubmitSchema } from '@/lib/validation/booking.schema';
import { normalizeAddress } from '@/lib/address';
import { generateAppointmentNumber } from '@/lib/utils';
import { RateLimiter, RATE_LIMITS } from '@/lib/security/rate-limiter';

export async function POST(request: Request) {
  try {
    const ip = await RateLimiter.getClientIp(request);

    const body = await request.json();
    
    // 1. Zod Validation
    const result = bookingSubmitSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: result.error.format() },
        { status: 400 }
      );
    }

    const data = result.data;

    // 1.5 Rate Limiting (IP + Email)
    const isAllowed = await RateLimiter.checkMulti([ip, data.email.toLowerCase()], RATE_LIMITS.BOOKING);
    if (!isAllowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // 1.7 Derive Organization ID from the requested Service
    // This removes the hardcoded tenant resolution and ensures the booking is routed correctly.
    const service = await prisma.service.findUnique({
      where: { id: data.serviceId },
      select: { organizationId: true }
    });
    
    if (!service) {
      return NextResponse.json({ error: 'Invalid service selected' }, { status: 400 });
    }
    
    const organizationId = service.organizationId;

    // 2. Normalize Address
    const { normStreet, normCity, normProvince, normPostalCode } = normalizeAddress(
      data.address,
      data.city,
      data.province,
      data.postalCode
    );

    // Run the entire booking process in an atomic transaction
    const bookingResult = await prisma.$transaction(async (tx) => {
      
      // 3. Find or Create Global User and Org-Scoped Customer
      let user = await tx.user.findUnique({
        where: { email: data.email.toLowerCase() }
      });

      if (!user) {
        user = await tx.user.create({
          data: {
            email: data.email.toLowerCase(),
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone,
            passwordHash: null,
            passwordSetAt: null,
          }
        });
      }

      // Find or create the customer record specifically for this organization
      let customer = await tx.customer.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId,
          }
        }
      });

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            organizationId,
            userId: user.id,
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone,
          }
        });
      }

      // 4. Find or Create Property
      const customerProperties = await tx.property.findMany({
        where: {
          customerId: customer.id,
          organizationId,
        },
      });

      let property = customerProperties.find((p) => {
        const existingNorm = normalizeAddress(p.address, p.city, p.province, p.postalCode);
        const unitMatch = (p.unit || '').trim().toLowerCase() === (data.unit || '').trim().toLowerCase();
        return (
          existingNorm.normStreet === normStreet &&
          existingNorm.normPostalCode === normPostalCode &&
          unitMatch
        );
      });

      if (!property) {
        property = await tx.property.create({
          data: {
            organizationId,
            customerId: customer.id,
            address: data.address, // Save original formatted address
            unit: data.unit,
            city: data.city,
            province: data.province,
            postalCode: data.postalCode,
          }
        });
      }

      // 5. Create Appointment
      const appointmentNumber = generateAppointmentNumber();
      const isEmergency = data.urgency === 'EMERGENCY';
      
      const appointment = await tx.appointment.create({
        data: {
          appointmentNumber,
          organizationId,
          customerId: customer.id,
          propertyId: property.id,
          serviceId: data.serviceId,
          date: new Date(data.date),
          startTime: data.startTime,
          endTime: data.endTime,
          status: 'PENDING',
          priority: data.urgency,
          isEmergency,
          problemDescription: data.problemDescription,
          customerNotes: data.customerNotes,
        }
      });

      // 6. Create Job
      await tx.job.create({
        data: {
          appointmentId: appointment.id,
          organizationId,
          status: 'CREATED',
        }
      });

      return { appointmentNumber, appointmentId: appointment.id };
    });

    return NextResponse.json({
      success: true,
      appointmentNumber: bookingResult.appointmentNumber
    }, { status: 201 });

  } catch (error) {
    console.error('Booking submission error:', error);
    return NextResponse.json(
      { error: 'Failed to process booking request' },
      { status: 500 }
    );
  }
}
