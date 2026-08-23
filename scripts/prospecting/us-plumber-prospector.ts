/**
 * AQUAFLOW — US PLUMBING PROSPECTOR & OUTBOUND AUTOMATION ENGINE
 * 
 * Target: 2–15 technician independent plumbing companies in high-volume US states.
 * Generates structured lead data, personalized cold email copy, phone call scripts,
 * and trackable acquisition links for the $199/mo Founding Pilot offer.
 */

import fs from 'fs/promises';
import path from 'path';
import { createPilotLead } from '../../src/lib/services/pilot-lead-service';

export interface ProspectCompany {
  companyName: string;
  contactName: string;
  title: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  website: string;
  technicianCount: string;
  painPoints: string[];
}

export const US_PLUMBING_PROSPECTS: ProspectCompany[] = [
  // TEXAS (High Growth / Fast Dispatches)
  {
    companyName: 'Lone Star Flow Plumbing Co.',
    contactName: 'Travis Walker',
    title: 'Owner / Master Plumber',
    phone: '(713) 555-0142',
    email: 'travis@lonestarflow.com',
    city: 'Houston',
    state: 'TX',
    website: 'https://lonestarflow.com',
    technicianCount: '4–10 Technicians',
    painPoints: ['Technician dispatch phone tag', 'Unpaid / delayed invoices', 'Paper job tickets'],
  },
  {
    companyName: 'Alamo City Drain & Pipe',
    contactName: 'Hector Ramirez',
    title: 'Managing Partner',
    phone: '(210) 555-0198',
    email: 'hector@alamocitydrain.com',
    city: 'San Antonio',
    state: 'TX',
    website: 'https://alamocitydrain.com',
    technicianCount: '4–10 Technicians',
    painPoints: ['Emergency scheduling chaos', 'Manual payment chasing'],
  },
  {
    companyName: 'Barton Springs Plumbing Solutions',
    contactName: 'Clayton Miller',
    title: 'Founder & Operator',
    phone: '(512) 555-0183',
    email: 'clayton@bartonspringsplumbing.com',
    city: 'Austin',
    state: 'TX',
    website: 'https://bartonspringsplumbing.com',
    technicianCount: '2–3 Technicians',
    painPoints: ['Software too complicated / expensive', 'Technicians losing parts on jobs'],
  },
  {
    companyName: 'Metroplex Hydro Plumbing',
    contactName: 'Marcus Vance',
    title: 'Owner',
    phone: '(214) 555-0129',
    email: 'marcus@metroplexhydro.com',
    city: 'Dallas',
    state: 'TX',
    website: 'https://metroplexhydro.com',
    technicianCount: '11–25 Technicians',
    painPoints: ['Multi-app fragmentation', 'Customer text updates manual'],
  },

  // FLORIDA (High Volume Emergency / Water Heater)
  {
    companyName: 'Sunshine Coast Plumbing Pros',
    contactName: 'Dave Higgins',
    title: 'Owner',
    phone: '(813) 555-0164',
    email: 'dave@sunshinecoastplumbing.com',
    city: 'Tampa',
    state: 'FL',
    website: 'https://sunshinecoastplumbing.com',
    technicianCount: '4–10 Technicians',
    painPoints: ['Emergency dispatches after hours', 'Delayed card payments on site'],
  },
  {
    companyName: 'Everglades Jetting & Pipe Specialists',
    contactName: 'Carlos Morales',
    title: 'President',
    phone: '(305) 555-0177',
    email: 'carlos@evergladesjetting.com',
    city: 'Miami',
    state: 'FL',
    website: 'https://evergladesjetting.com',
    technicianCount: '4–10 Technicians',
    painPoints: ['Commercial jetting estimates take too long', 'Invoicing from truck is messy'],
  },
  {
    companyName: 'Orange County Pro Plumbers',
    contactName: 'Brian Foster',
    title: 'Master Plumber',
    phone: '(407) 555-0131',
    email: 'brian@orangecountyproplumbing.com',
    city: 'Orlando',
    state: 'FL',
    website: 'https://orangecountyproplumbing.com',
    technicianCount: '2–3 Technicians',
    painPoints: ['Running business from cellphone notes', 'Double booking jobs'],
  },

  // CALIFORNIA (High Ticket / Leak & Replacement)
  {
    companyName: 'Pacific Crest Plumbing & Rooter',
    contactName: 'Justin Brooks',
    title: 'Founder',
    phone: '(619) 555-0155',
    email: 'justin@pacificcrestrooter.com',
    city: 'San Diego',
    state: 'CA',
    website: 'https://pacificcrestrooter.com',
    technicianCount: '4–10 Technicians',
    painPoints: ['ServiceTitan is \$1,200/mo and too bloated', 'Need fast simple dispatching'],
  },
  {
    companyName: 'Golden Gate Emergency Plumbing',
    contactName: 'Kenji Tanaka',
    title: 'Operations Director',
    phone: '(415) 555-0192',
    email: 'kenji@goldengateplumbing.com',
    city: 'San Francisco',
    state: 'CA',
    website: 'https://goldengateplumbing.com',
    technicianCount: '4–10 Technicians',
    painPoints: ['Technician clock-in tracking', 'Instant online credit card deposits'],
  },

  // MIDWEST / OHIO & ILLINOIS
  {
    companyName: 'Buckeye State Plumbing & Heating',
    contactName: 'Dan Sullivan',
    title: 'Owner',
    phone: '(614) 555-0148',
    email: 'dan@buckeyestateplumbing.com',
    city: 'Columbus',
    state: 'OH',
    website: 'https://buckeyestateplumbing.com',
    technicianCount: '4–10 Technicians',
    painPoints: ['Paper invoices getting lost in trucks', 'Customers calling where is the tech'],
  },
  {
    companyName: 'Windy City Sewer & Drain',
    contactName: 'Anthony DeLuca',
    title: 'Owner',
    phone: '(312) 555-0118',
    email: 'anthony@windycitydrain.com',
    city: 'Chicago',
    state: 'IL',
    website: 'https://windycitydrain.com',
    technicianCount: '4–10 Technicians',
    painPoints: ['Scheduling board takes 2 hours every morning', 'Late invoices'],
  },

  // SOUTHEAST (GEORGIA / NORTH CAROLINA / TENNESSEE)
  {
    companyName: 'Peachtree Elite Plumbing',
    contactName: 'Lamar Jackson',
    title: 'Master Plumber',
    phone: '(404) 555-0185',
    email: 'lamar@peachtreeeliteplumbing.com',
    city: 'Atlanta',
    state: 'GA',
    website: 'https://peachtreeeliteplumbing.com',
    technicianCount: '4–10 Technicians',
    painPoints: ['Technicians not recording job parts', 'Dispatching via group SMS'],
  },
  {
    companyName: 'Queen City Pipe & Valve',
    contactName: 'Greg Thornton',
    title: 'Managing Director',
    phone: '(704) 555-0163',
    email: 'greg@queencitypipe.com',
    city: 'Charlotte',
    state: 'NC',
    website: 'https://queencitypipe.com',
    technicianCount: '4–10 Technicians',
    painPoints: ['Manual quote generation', 'Delayed customer reviews'],
  },
  {
    companyName: 'Music City Drain Cleaning',
    contactName: 'Cody Vance',
    title: 'Owner',
    phone: '(615) 555-0122',
    email: 'cody@musiccitydrain.com',
    city: 'Nashville',
    state: 'TN',
    website: 'https://musiccitydrain.com',
    technicianCount: '2–3 Technicians',
    painPoints: ['Expensive software with 12-month lock-in contracts', 'Phone dispatches'],
  },
];

export function generateColdEmail(p: ProspectCompany): { subject: string; body: string } {
  const companySlug = p.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const pilotLink = `https://aquaflow-plumbing-theta.vercel.app/pilot?utm_source=outbound_email&utm_campaign=us_plumber_pilot_cohort&utm_content=${companySlug}`;

  const subject = `Quick question about ${p.companyName}'s dispatches in ${p.city}`;
  const body = `Hi ${p.contactName},

I noticed ${p.companyName} is running a strong team in ${p.city}. 

Are you guys still coordinating your ${p.technicianCount} through text messages, whiteboards, or clunky legacy software?

We built AquaFlow specifically for independent plumbing owners who are sick of:
1. Dispatch phone tag & double-booking jobs
2. Waiting days for customers to pay paper invoices
3. Paying \$800–\$1,500/month for bloated software that takes 3 months to learn

We are selecting our Founding 3 US Plumbing Partners for our $199/month Pilot Cohort. 

You get:
• The complete operating system (Bookings ➔ Dispatch ➔ Field Tech Mobile ➔ Invoices & Payments)
• Direct founder onboarding (we set up your entire service catalog and tech schedule in 20 mins)
• Price locked at $199/month for life (no per-seat penalties or contracts)

You can check out the live preview and submit a quick 60-second application here:
${pilotLink}

Best regards,
AquaFlow Founding Team
Direct: (555) 019-2834
https://aquaflow-plumbing-theta.vercel.app/pilot`;

  return { subject, body };
}

export function generatePhoneScript(p: ProspectCompany): string {
  return `=== PHONE CALL SCRIPT: ${p.companyName} (${p.contactName} - ${p.phone}) ===
[Gatekeeper / Dispatcher]:
"Hi, I'm trying to reach ${p.contactName} regarding technician dispatching and software setup for ${p.companyName}. Is he around?"

[When ${p.contactName} Answers]:
"Hey ${p.contactName}, I know you're busy running jobs in ${p.city} so I'll be brief. 
I'm calling with AquaFlow. We built an all-in-one dispatch, technician scheduling, and instant payment platform built specifically for growing plumbing shops with ${p.technicianCount}.

We're opening a founding pilot for 3 plumbing companies at $199/month with direct founder onboarding and no long-term contracts. 

Are you guys currently looking for a cleaner way to handle your daily dispatches and payments without paying ServiceTitan prices?"

[If Yes / Interested]:
"Great. I'll shoot you a quick link to our interactive preview at https://aquaflow-plumbing-theta.vercel.app/pilot so you can see how the job board works. What's the best email for you?"
===========================================================`;
}

async function main() {
  const args = process.argv.slice(2);
  const isSeed = args.includes('--seed');
  const isExport = args.includes('--export') || true;

  console.log('====================================================');
  console.log('🚀 AQUAFLOW US PLUMBING PROSPECTOR & OUTREACH ENGINE');
  console.log(`Loaded ${US_PLUMBING_PROSPECTS.length} targeted US plumbing companies`);
  console.log('====================================================');

  // 1. Export CSV
  const storageDir = path.join(process.cwd(), 'storage');
  await fs.mkdir(storageDir, { recursive: true });
  const csvPath = path.join(storageDir, 'us-plumber-prospects.csv');

  const headers = [
    'Company Name',
    'Contact Name',
    'Title',
    'Phone',
    'Email',
    'City',
    'State',
    'Website',
    'Fleet Size',
    'Pain Points',
    'Subject Line',
    'Direct Pilot Link',
  ];

  const rows = US_PLUMBING_PROSPECTS.map((p) => {
    const email = generateColdEmail(p);
    const companySlug = p.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const pilotLink = `https://aquaflow-plumbing-theta.vercel.app/pilot?utm_source=outbound_csv&utm_campaign=us_plumber_pilot_cohort&utm_content=${companySlug}`;
    return [
      `"${p.companyName}"`,
      `"${p.contactName}"`,
      `"${p.title}"`,
      `"${p.phone}"`,
      `"${p.email}"`,
      `"${p.city}"`,
      `"${p.state}"`,
      `"${p.website}"`,
      `"${p.technicianCount}"`,
      `"${p.painPoints.join('; ')}"`,
      `"${email.subject}"`,
      `"${pilotLink}"`,
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  await fs.writeFile(csvPath, csvContent, 'utf-8');
  console.log(`✅ Exported CSV to: ${csvPath}`);

  // 2. Export Outreach Playbook Markdown
  const playbookPath = path.join(storageDir, 'OUTREACH-PLAYBOOK.md');
  let mdContent = `# AQUAFLOW — US PLUMBING OUTBOUND RECRUITMENT PLAYBOOK\n\n`;
  mdContent += `Targeting 3–10 Van Independent US Plumbing Contractors for $199/mo Founding Pilot.\n\n`;

  US_PLUMBING_PROSPECTS.forEach((p, i) => {
    const { subject, body } = generateColdEmail(p);
    const phoneScript = generatePhoneScript(p);
    mdContent += `## ${i + 1}. ${p.companyName} (${p.city}, ${p.state})\n`;
    mdContent += `**Contact:** ${p.contactName} (${p.title}) | **Phone:** ${p.phone} | **Fleet:** ${p.technicianCount}\n\n`;
    mdContent += `### Cold Email:\n**Subject:** ${subject}\n\n\`\`\`text\n${body}\n\`\`\`\n\n`;
    mdContent += `### Phone Script:\n\`\`\`text\n${phoneScript}\n\`\`\`\n\n---\n\n`;
  });

  await fs.writeFile(playbookPath, mdContent, 'utf-8');
  console.log(`✅ Exported Outreach Playbook to: ${playbookPath}`);

  // 3. If --seed flag passed, inject into database / pilot leads
  if (isSeed) {
    console.log('\n📥 Seeding sample prospects into live Pilot Lead pipeline...');
    for (const p of US_PLUMBING_PROSPECTS.slice(0, 5)) {
      const companySlug = p.companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      await createPilotLead({
        companyName: p.companyName,
        contactName: p.contactName,
        email: p.email,
        phone: p.phone,
        website: p.website,
        city: p.city,
        province: p.state,
        technicianCount: p.technicianCount,
        painPoints: p.painPoints,
        notes: `Outbound Prospect via Automated Engine. Role: ${p.title}`,
        source: 'outbound_prospector',
        utmSource: 'outbound_prospector',
        utmCampaign: 'us_pilot_cohort_1',
        utmContent: companySlug,
      });
      console.log(`   + Added: ${p.companyName} (${p.city}, ${p.state})`);
    }
    console.log('✅ Pipeline seeded successfully.');
  }

  console.log('\n✨ Prospector run complete!');
}

main().catch(console.error);
