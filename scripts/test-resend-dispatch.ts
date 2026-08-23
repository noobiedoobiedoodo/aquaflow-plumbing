import 'dotenv/config';
import { sendProspectOutreachEmail } from '../src/lib/services/outreach-service';

async function testSend() {
  console.log('\n======================================================');
  console.log('⚡ TESTING LIVE RESEND COLD OUTREACH DISPATCH');
  console.log('======================================================\n');

  const res = await sendProspectOutreachEmail({
    id: 'test-prospect-1',
    companyName: 'Berkeys Plumbing & A/C',
    contactName: 'Dan Campbell',
    title: 'Owner',
    email: 'service@berkeys.com',
    phone: '(214) 612-0133',
    website: 'https://www.berkeys.com',
    city: 'Dallas',
    state: 'TX',
    technicianCount: '11–25 Technicians',
    painPoints: ['Technician dispatch phone tag', 'Unpaid invoices'],
    interestLevel: 'UNDECIDED',
    outreachStatus: 'NOT_CONTACTED',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  console.log('Dispatched Outcome:', res);
  console.log('\n======================================================\n');
}

testSend();
