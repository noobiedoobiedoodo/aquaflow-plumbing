import { prisma } from '../db';
import { randomUUID } from 'crypto';
import { ensurePilotLeadTable } from './pilot-lead-service';

export type InterestLevel = 'GREEN' | 'YELLOW' | 'RED' | 'UNDECIDED';
export type OutreachStatus =
  | 'NOT_CONTACTED'
  | 'EMAIL_SENT'
  | 'CALLED'
  | 'IN_CONVERSATION'
  | 'PROVISIONED';

export interface ColdProspect {
  id: string;
  companyName: string;
  contactName: string;
  title: string;
  email: string;
  phone: string;
  website?: string | null;
  city: string;
  state: string;
  technicianCount: string;
  painPoints: string[];
  interestLevel: InterestLevel;
  outreachStatus: OutreachStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const US_PROSPECTS_DATABASE: Array<Omit<ColdProspect, 'id' | 'createdAt' | 'updatedAt' | 'interestLevel' | 'outreachStatus' | 'notes'>> = [
  // TEXAS
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
  {
    companyName: 'Fort Worth Premier Rooter',
    contactName: 'Jake Thompson',
    title: 'President',
    phone: '(817) 555-0195',
    email: 'jake@fwpremierrooter.com',
    city: 'Fort Worth',
    state: 'TX',
    website: 'https://fwpremierrooter.com',
    technicianCount: '4–10 Technicians',
    painPoints: ['Double booked service windows', 'Paper receipts'],
  },

  // FLORIDA
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
  {
    companyName: 'First Coast Drain & Sewer',
    contactName: 'Kenny Rogers',
    title: 'Managing Director',
    phone: '(904) 555-0144',
    email: 'kenny@firstcoastdrain.com',
    city: 'Jacksonville',
    state: 'FL',
    website: 'https://firstcoastdrain.com',
    technicianCount: '4–10 Technicians',
    painPoints: ['Chasing invoices for 30 days', 'Tech schedule gaps'],
  },

  // CALIFORNIA
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
    painPoints: ['ServiceTitan is $1,200/mo and too bloated', 'Need fast simple dispatching'],
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
  {
    companyName: 'Angel City Pipe & Drain',
    contactName: 'Raymond Cole',
    title: 'Owner',
    phone: '(213) 555-0188',
    email: 'raymond@angelcitypipe.com',
    city: 'Los Angeles',
    state: 'CA',
    website: 'https://angelcitypipe.com',
    technicianCount: '4–10 Technicians',
    painPoints: ['Traffic routing dispatch chaos', 'Invoicing delay'],
  },

  // OHIO & MIDWEST
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
    companyName: 'Queen City Sewer & Water',
    contactName: 'Eric Meyer',
    title: 'Co-Owner',
    phone: '(513) 555-0172',
    email: 'eric@queencitysewer.com',
    city: 'Cincinnati',
    state: 'OH',
    website: 'https://queencitysewer.com',
    technicianCount: '4–10 Technicians',
    painPoints: ['Estimates take 45 mins each', 'Card reader hardware issues'],
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

  // SOUTHEAST (GEORGIA / CAROLINAS / TENNESSEE)
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

export async function ensureColdProspectsTable(): Promise<void> {
  await ensurePilotLeadTable();
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS cold_prospects (
        id VARCHAR(64) PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        contact_name VARCHAR(255) NOT NULL,
        title VARCHAR(100) DEFAULT 'Owner',
        email VARCHAR(255) NOT NULL UNIQUE,
        phone VARCHAR(100) NOT NULL,
        website VARCHAR(255),
        city VARCHAR(100) NOT NULL,
        state VARCHAR(50) NOT NULL,
        technician_count VARCHAR(100) NOT NULL,
        pain_points TEXT NOT NULL,
        interest_level VARCHAR(20) DEFAULT 'UNDECIDED',
        outreach_status VARCHAR(50) DEFAULT 'NOT_CONTACTED',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_cold_prospects_state ON cold_prospects(state);
      CREATE INDEX IF NOT EXISTS idx_cold_prospects_interest ON cold_prospects(interest_level);
    `);
  } catch (err: any) {
    console.warn('Cold prospects table init note:', err.message);
  }
}

export async function getColdProspects(): Promise<ColdProspect[]> {
  await ensureColdProspectsTable();
  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM cold_prospects ORDER BY created_at DESC`
    );
    return rows.map((r) => ({
      id: r.id,
      companyName: r.company_name,
      contactName: r.contact_name,
      title: r.title || 'Owner',
      email: r.email,
      phone: r.phone,
      website: r.website,
      city: r.city,
      state: r.state,
      technicianCount: r.technician_count,
      painPoints: typeof r.pain_points === 'string' ? JSON.parse(r.pain_points) : r.pain_points,
      interestLevel: (r.interest_level || 'UNDECIDED') as InterestLevel,
      outreachStatus: (r.outreach_status || 'NOT_CONTACTED') as OutreachStatus,
      notes: r.notes,
      createdAt: r.created_at?.toISOString?.() || r.created_at,
      updatedAt: r.updated_at?.toISOString?.() || r.updated_at,
    }));
  } catch {
    return [];
  }
}

export async function importScrapedProspects(stateFilter?: string): Promise<{ added: number; total: number }> {
  await ensureColdProspectsTable();
  const pool = stateFilter && stateFilter !== 'ALL'
    ? US_PROSPECTS_DATABASE.filter((p) => p.state === stateFilter)
    : US_PROSPECTS_DATABASE;

  let added = 0;
  for (const p of pool) {
    try {
      const id = randomUUID();
      const now = new Date();
      await prisma.$executeRawUnsafe(
        `INSERT INTO cold_prospects (
          id, company_name, contact_name, title, email, phone, website, city, state, technician_count, pain_points, interest_level, outreach_status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (email) DO NOTHING`,
        id,
        p.companyName,
        p.contactName,
        p.title,
        p.email.toLowerCase().trim(),
        p.phone,
        p.website,
        p.city,
        p.state,
        p.technicianCount,
        JSON.stringify(p.painPoints),
        'UNDECIDED',
        'NOT_CONTACTED',
        now,
        now
      );
      added++;
    } catch (e) {
      console.warn('Import duplicate or error:', e);
    }
  }

  const all = await getColdProspects();
  return { added, total: all.length };
}

export async function updateColdProspectQualification(
  id: string,
  update: { interestLevel?: InterestLevel; outreachStatus?: OutreachStatus; notes?: string }
): Promise<ColdProspect | null> {
  await ensureColdProspectsTable();
  const now = new Date();
  try {
    const sets: string[] = ['updated_at = $1'];
    const values: any[] = [now];
    let idx = 2;

    if (update.interestLevel) {
      sets.push(`interest_level = $${idx++}`);
      values.push(update.interestLevel);
    }
    if (update.outreachStatus) {
      sets.push(`outreach_status = $${idx++}`);
      values.push(update.outreachStatus);
    }
    if (update.notes !== undefined) {
      sets.push(`notes = $${idx++}`);
      values.push(update.notes);
    }

    values.push(id);
    await prisma.$executeRawUnsafe(
      `UPDATE cold_prospects SET ${sets.join(', ')} WHERE id = $${idx}`,
      ...values
    );

    const list = await getColdProspects();
    return list.find((p) => p.id === id) || null;
  } catch (e) {
    console.error('Failed to update prospect qualification:', e);
    return null;
  }
}
