import { prisma } from '../src/lib/db';

async function runTests() {
  console.log('--- STARTING BOOKING API TESTS ---');

  const API_URL = 'http://localhost:3000/api/booking';

  // Helper to make requests
  const sendRequest = async (payload: any) => {
    return fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  };

  // Get a valid service ID from DB
  const service = await prisma.service.findFirst({ where: { isActive: true } });
  if (!service) throw new Error("No services found");
  
  const validPayload = {
    serviceId: service.id,
    problemDescription: 'My sink is leaking really badly and I need help right away.',
    urgency: 'NORMAL',
    date: '2026-10-15',
    startTime: '09:00',
    endTime: '11:00',
    address: '123 Test Ave',
    city: 'Winnipeg',
    province: 'MB',
    postalCode: 'R3C 1A1',
    firstName: 'John',
    lastName: 'Test',
    email: 'john.test@example.com',
    phone: '(555) 123-4567'
  };

  try {
    // 1. New customer -> New property
    console.log('\n1. Testing: New customer -> new property');
    let res = await sendRequest(validPayload);
    let data = await res.json();
    console.log('Status:', res.status, data.success ? 'Success' : 'Failed');
    
    // 2. Existing customer -> Existing property
    console.log('\n2. Testing: Existing customer -> existing property');
    res = await sendRequest(validPayload);
    data = await res.json();
    console.log('Status:', res.status, data.success ? 'Success' : 'Failed');

    // 3. Existing customer -> New property
    console.log('\n3. Testing: Existing customer -> new property');
    res = await sendRequest({ ...validPayload, address: '456 Different St' });
    data = await res.json();
    console.log('Status:', res.status, data.success ? 'Success' : 'Failed');

    // 4. Invalid service ID
    console.log('\n4. Testing: Invalid service ID');
    res = await sendRequest({ ...validPayload, serviceId: 'not-a-uuid' });
    data = await res.json();
    console.log('Status:', res.status, data.error ? 'Validation caught it' : 'Failed');

    // 5. Invalid Canadian postal code
    console.log('\n5. Testing: Invalid postal code');
    res = await sendRequest({ ...validPayload, postalCode: '12345' });
    data = await res.json();
    console.log('Status:', res.status, data.error ? 'Validation caught it' : 'Failed');

    // 6. Emergency Booking
    console.log('\n6. Testing: Emergency Booking');
    res = await sendRequest({ ...validPayload, urgency: 'EMERGENCY' });
    data = await res.json();
    console.log('Status:', res.status, data.success ? 'Success' : 'Failed');
    
    // 7. Missing Date
    console.log('\n7. Testing: Missing Date');
    const { date, ...payloadWithoutDate } = validPayload;
    res = await sendRequest(payloadWithoutDate);
    data = await res.json();
    console.log('Status:', res.status, data.error ? 'Validation caught it' : 'Failed');

    console.log('\n--- TESTS COMPLETED ---');
  } catch (error) {
    console.error('Test script error:', error);
  }
}

runTests();
