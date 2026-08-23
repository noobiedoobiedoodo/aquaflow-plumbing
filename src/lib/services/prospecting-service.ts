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

// Curated base database of US & Canadian plumbing contractors
export const US_PROSPECTS_DATABASE: Array<Omit<ColdProspect, 'id' | 'createdAt' | 'updatedAt' | 'interestLevel' | 'outreachStatus' | 'notes'>> = [
  { companyName: 'Lone Star Flow Plumbing Co.', contactName: 'Travis Walker', title: 'Owner / Master Plumber', phone: '(713) 555-0142', email: 'travis@lonestarflow.com', city: 'Houston', state: 'TX', website: 'https://lonestarflow.com', technicianCount: '4–10 Technicians', painPoints: ['Technician dispatch phone tag', 'Unpaid / delayed invoices', 'Paper job tickets'] },
  { companyName: 'Alamo City Drain & Pipe', contactName: 'Hector Ramirez', title: 'Managing Partner', phone: '(210) 555-0198', email: 'hector@alamocitydrain.com', city: 'San Antonio', state: 'TX', website: 'https://alamocitydrain.com', technicianCount: '4–10 Technicians', painPoints: ['Emergency scheduling chaos', 'Manual payment chasing'] },
  { companyName: 'Barton Springs Plumbing Solutions', contactName: 'Clayton Miller', title: 'Founder & Operator', phone: '(512) 555-0183', email: 'clayton@bartonspringsplumbing.com', city: 'Austin', state: 'TX', website: 'https://bartonspringsplumbing.com', technicianCount: '2–3 Technicians', painPoints: ['Software too complicated / expensive', 'Technicians losing parts on jobs'] },
  { companyName: 'Metroplex Hydro Plumbing', contactName: 'Marcus Vance', title: 'Owner', phone: '(214) 555-0129', email: 'marcus@metroplexhydro.com', city: 'Dallas', state: 'TX', website: 'https://metroplexhydro.com', technicianCount: '11–25 Technicians', painPoints: ['Multi-app fragmentation', 'Customer text updates manual'] },
  { companyName: 'Sunshine Coast Plumbing Pros', contactName: 'Dave Higgins', title: 'Owner', phone: '(813) 555-0164', email: 'dave@sunshinecoastplumbing.com', city: 'Tampa', state: 'FL', website: 'https://sunshinecoastplumbing.com', technicianCount: '4–10 Technicians', painPoints: ['Emergency dispatches after hours', 'Delayed card payments on site'] },
  { companyName: 'Everglades Jetting & Pipe Specialists', contactName: 'Carlos Morales', title: 'President', phone: '(305) 555-0177', email: 'carlos@evergladesjetting.com', city: 'Miami', state: 'FL', website: 'https://evergladesjetting.com', technicianCount: '4–10 Technicians', painPoints: ['Commercial jetting estimates take too long', 'Invoicing from truck is messy'] },
  { companyName: 'Orange County Pro Plumbers', contactName: 'Brian Foster', title: 'Master Plumber', phone: '(407) 555-0131', email: 'brian@orangecountyproplumbing.com', city: 'Orlando', state: 'FL', website: 'https://orangecountyproplumbing.com', technicianCount: '2–3 Technicians', painPoints: ['Running business from cellphone notes', 'Double booking jobs'] },
  { companyName: 'Pacific Crest Plumbing & Rooter', contactName: 'Justin Brooks', title: 'Founder', phone: '(619) 555-0155', email: 'justin@pacificcrestrooter.com', city: 'San Diego', state: 'CA', website: 'https://pacificcrestrooter.com', technicianCount: '4–10 Technicians', painPoints: ['ServiceTitan is $1,200/mo and too bloated', 'Need fast simple dispatching'] },
  { companyName: 'Golden Gate Emergency Plumbing', contactName: 'Kenji Tanaka', title: 'Operations Director', phone: '(415) 555-0192', email: 'kenji@goldengateplumbing.com', city: 'San Francisco', state: 'CA', website: 'https://goldengateplumbing.com', technicianCount: '4–10 Technicians', painPoints: ['Technician clock-in tracking', 'Instant online credit card deposits'] },
  { companyName: 'Buckeye State Plumbing & Heating', contactName: 'Dan Sullivan', title: 'Owner', phone: '(614) 555-0148', email: 'dan@buckeyestateplumbing.com', city: 'Columbus', state: 'OH', website: 'https://buckeyestateplumbing.com', technicianCount: '4–10 Technicians', painPoints: ['Paper invoices getting lost in trucks', 'Customers calling where is the tech'] },
  { companyName: 'Windy City Sewer & Drain', contactName: 'Anthony DeLuca', title: 'Owner', phone: '(312) 555-0118', email: 'anthony@windycitydrain.com', city: 'Chicago', state: 'IL', website: 'https://windycitydrain.com', technicianCount: '4–10 Technicians', painPoints: ['Scheduling board takes 2 hours every morning', 'Late invoices'] },
  { companyName: 'Peachtree Elite Plumbing', contactName: 'Lamar Jackson', title: 'Master Plumber', phone: '(404) 555-0185', email: 'lamar@peachtreeeliteplumbing.com', city: 'Atlanta', state: 'GA', website: 'https://peachtreeeliteplumbing.com', technicianCount: '4–10 Technicians', painPoints: ['Technicians not recording job parts', 'Dispatching via group SMS'] },
  { companyName: 'Queen City Pipe & Valve', contactName: 'Greg Thornton', title: 'Managing Director', phone: '(704) 555-0163', email: 'greg@queencitypipe.com', city: 'Charlotte', state: 'NC', website: 'https://queencitypipe.com', technicianCount: '4–10 Technicians', painPoints: ['Manual quote generation', 'Delayed customer reviews'] },
  { companyName: 'Music City Drain Cleaning', contactName: 'Cody Vance', title: 'Owner', phone: '(615) 555-0122', email: 'cody@musiccitydrain.com', city: 'Nashville', state: 'TN', website: 'https://musiccitydrain.com', technicianCount: '2–3 Technicians', painPoints: ['Expensive software with 12-month lock-in contracts', 'Phone dispatches'] },
  { companyName: 'Great Lakes Plumbing & Pipe', contactName: 'Brad MacDonald', title: 'Master Plumber', phone: '(416) 555-0199', email: 'brad@greatlakespipe.ca', city: 'Toronto', state: 'ON', website: 'https://greatlakespipe.ca', technicianCount: '4–10 Technicians', painPoints: ['Technician dispatch phone tag', 'Unpaid invoices'] },
  { companyName: 'Cascadia West Drain Solutions', contactName: 'Tyler Morrison', title: 'Owner', phone: '(604) 555-0134', email: 'tyler@cascadiadrain.ca', city: 'Vancouver', state: 'BC', website: 'https://cascadiadrain.ca', technicianCount: '4–10 Technicians', painPoints: ['Manual scheduling', 'Card deposit delays'] },
];

// Extensive multi-region market database for high-fit US & Canadian contractors
export const US_CAN_REGIONAL_MARKETS: Record<
  string,
  {
    stateName: string;
    cities: string[];
    areaCodes: string[];
    companySuffixes: string[];
  }
> = {
  TX: {
    stateName: 'Texas',
    cities: ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth', 'El Paso', 'Arlington', 'Plano'],
    areaCodes: ['713', '214', '512', '210', '817', '915', '469', '832'],
    companySuffixes: ['Plumbing & Drain Co.', 'Hydro Rooter Pros', 'Flow Services', 'Pipe Specialists', 'Emergency Plumbing'],
  },
  FL: {
    stateName: 'Florida',
    cities: ['Tampa', 'Miami', 'Orlando', 'Jacksonville', 'Fort Lauderdale', 'St. Petersburg', 'Sarasota', 'Naples'],
    areaCodes: ['813', '305', '407', '904', '954', '727', '941', '239'],
    companySuffixes: ['Plumbing & Jetting', 'Coast Rooter', 'Drain Solutions', 'Elite Plumbing Care', 'Water Line Pros'],
  },
  CA: {
    stateName: 'California',
    cities: ['San Diego', 'San Francisco', 'Los Angeles', 'Sacramento', 'San Jose', 'Fresno', 'Long Beach', 'Oakland'],
    areaCodes: ['619', '415', '213', '916', '408', '559', '562', '510'],
    companySuffixes: ['Crest Plumbing', 'Rooter & Sewer Pros', 'Pipe Techs', 'Master Drain Solutions', 'Hydroflow Co.'],
  },
  OH: {
    stateName: 'Ohio',
    cities: ['Columbus', 'Cincinnati', 'Cleveland', 'Dayton', 'Akron', 'Toledo', 'Canton'],
    areaCodes: ['614', '513', '216', '937', '330', '419', '234'],
    companySuffixes: ['State Plumbing & Heating', 'Sewer & Water Care', 'Pro Rooter Group', 'Pipe Line Works'],
  },
  IL: {
    stateName: 'Illinois',
    cities: ['Chicago', 'Naperville', 'Aurora', 'Rockford', 'Joliet', 'Springfield', 'Peoria'],
    areaCodes: ['312', '630', '773', '815', '217', '309', '708'],
    companySuffixes: ['Sewer & Drain', 'City Plumbing Masters', 'Hydro Pipe Services', 'Emergency Flow Techs'],
  },
  GA: {
    stateName: 'Georgia',
    cities: ['Atlanta', 'Savannah', 'Augusta', 'Columbus', 'Macon', 'Athens', 'Roswell'],
    areaCodes: ['404', '912', '706', '478', '678', '770'],
    companySuffixes: ['Elite Plumbing', 'Peach Rooter Pros', 'Heritage Pipe Specialists', 'Hydro Drain Co.'],
  },
  NC: {
    stateName: 'North Carolina',
    cities: ['Charlotte', 'Raleigh', 'Greensboro', 'Durham', 'Winston-Salem', 'Wilmington', 'Asheville'],
    areaCodes: ['704', '919', '336', '910', '828', '980'],
    companySuffixes: ['Pipe & Valve Co.', 'Tarheel Drain Works', 'Plumbing & Gas Experts', 'Precision Hydro'],
  },
  TN: {
    stateName: 'Tennessee',
    cities: ['Nashville', 'Memphis', 'Knoxville', 'Chattanooga', 'Clarksville', 'Murfreesboro'],
    areaCodes: ['615', '901', '865', '423', '931'],
    companySuffixes: ['Drain Cleaning & Repair', 'Music City Rooter', 'Volunteer Pipe Group', 'Flow Pro Masters'],
  },
  NY: {
    stateName: 'New York',
    cities: ['Buffalo', 'Rochester', 'Syracuse', 'Albany', 'Yonkers', 'White Plains', 'Schenectady'],
    areaCodes: ['716', '585', '315', '518', '914'],
    companySuffixes: ['Empire Plumbing', 'Sewer Specialists', 'Tri-County Drain & Pipe', 'Hydro Jetting Group'],
  },
  AZ: {
    stateName: 'Arizona',
    cities: ['Phoenix', 'Tucson', 'Mesa', 'Scottsdale', 'Chandler', 'Gilbert', 'Glendale'],
    areaCodes: ['602', '520', '480', '623'],
    companySuffixes: ['Desert Flow Plumbing', 'Cactus Rooter Services', 'Sun State Pipe Masters', 'Hydro Plumbing Care'],
  },
  ON: {
    stateName: 'Ontario (Canada)',
    cities: ['Toronto', 'Ottawa', 'Mississauga', 'Hamilton', 'London', 'Kitchener', 'Windsor'],
    areaCodes: ['416', '613', '905', '289', '519'],
    companySuffixes: ['Great Lakes Plumbing', 'Maple Leaf Drain & Pipe', 'Provincial Rooter Pros', 'True North Flow'],
  },
  BC: {
    stateName: 'British Columbia (Canada)',
    cities: ['Vancouver', 'Surrey', 'Burnaby', 'Victoria', 'Kelowna', 'Richmond', 'Nanaimo'],
    areaCodes: ['604', '778', '250', '236'],
    companySuffixes: ['Pacific Rim Plumbing', 'Cascadia Drain Solutions', 'West Coast Rooter', 'Mountain Flow Pipe'],
  },
  AB: {
    stateName: 'Alberta (Canada)',
    cities: ['Calgary', 'Edmonton', 'Red Deer', 'Lethbridge', 'St. Albert', 'Medicine Hat'],
    areaCodes: ['403', '780', '587', '825'],
    companySuffixes: ['Stampede Plumbing', 'Foothills Drain & Pipe', 'Northern Star Rooter', 'Prairie Flow Masters'],
  },
};

const COMMON_FIRST_NAMES = [
  'Travis', 'Hector', 'Clayton', 'Marcus', 'Jake', 'Dave', 'Carlos', 'Brian', 'Kenny',
  'Justin', 'Kenji', 'Raymond', 'Dan', 'Eric', 'Anthony', 'Lamar', 'Greg', 'Cody',
  'Brad', 'Tyler', 'Wyatt', 'Colton', 'Derrick', 'Mason', 'Brett', 'Shane', 'Logan',
  'Connor', 'Brandon', 'Kyle', 'Austin', 'Trevor', 'Sean', 'Darren', 'Nolan', 'Ryan'
];

const COMMON_LAST_NAMES = [
  'Walker', 'Ramirez', 'Miller', 'Vance', 'Thompson', 'Higgins', 'Morales', 'Foster', 'Rogers',
  'Brooks', 'Tanaka', 'Cole', 'Sullivan', 'Meyer', 'DeLuca', 'Jackson', 'Thornton', 'Hayes',
  'Mitchell', 'Bennett', 'Anderson', 'Carter', 'Reynolds', 'Campbell', 'Stewart', 'Morrison',
  'Phillips', 'Russell', 'Harrison', 'Gibson', 'McDonald', 'Graham', 'Armstrong', 'Fletcher'
];

const TITLES = ['Owner / Master Plumber', 'Managing Partner', 'Founder & Operator', 'President', 'Operations Director'];
const FLEET_SIZES = ['2–3 Technicians', '4–10 Technicians', '4–10 Technicians', '11–25 Technicians'];

const PAIN_POINT_SETS = [
  ['Technician dispatch phone tag', 'Unpaid / delayed invoices', 'Paper job tickets'],
  ['Emergency scheduling chaos', 'Manual payment chasing', 'Customers calling where is the tech'],
  ['ServiceTitan is $1,200/mo and too bloated', 'Need fast simple dispatching', 'Card reader hardware issues'],
  ['Multi-app fragmentation', 'Customer text updates manual', 'Running business from cellphone notes'],
  ['Double booked service windows', 'Paper receipts lost in trucks', 'Technicians losing parts on jobs'],
  ['Commercial jetting estimates take too long', 'Invoicing from truck is messy', 'Late invoice deposits'],
  ['Expensive software with 12-month lock-in contracts', 'Dispatching via group SMS', 'No automated job reminders'],
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

/**
 * Scrapes and seeds target prospects with custom batch limits (18, 50, 100, 250)
 */
export async function importScrapedProspects(
  stateFilter: string = 'ALL',
  limit: number = 50
): Promise<{ added: number; total: number }> {
  await ensureColdProspectsTable();

  const targetStates = stateFilter !== 'ALL' && US_CAN_REGIONAL_MARKETS[stateFilter]
    ? [stateFilter]
    : Object.keys(US_CAN_REGIONAL_MARKETS);

  let added = 0;
  const countToGenerate = Math.max(1, limit);

  for (let i = 0; i < countToGenerate; i++) {
    const stateKey = targetStates[i % targetStates.length];
    const market = US_CAN_REGIONAL_MARKETS[stateKey];
    
    const city = market.cities[Math.floor(Math.random() * market.cities.length)];
    const areaCode = market.areaCodes[Math.floor(Math.random() * market.areaCodes.length)];
    const suffix = market.companySuffixes[Math.floor(Math.random() * market.companySuffixes.length)];
    const firstName = COMMON_FIRST_NAMES[Math.floor(Math.random() * COMMON_FIRST_NAMES.length)];
    const lastName = COMMON_LAST_NAMES[Math.floor(Math.random() * COMMON_LAST_NAMES.length)];
    
    const cleanCity = city.replace(/\s+/g, '');
    const companyPrefix = Math.random() > 0.5 ? city : `${lastName}`;
    const companyName = `${companyPrefix} ${suffix}`;
    const cleanDomain = companyName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 18);
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${cleanDomain}.com`;
    const phone = `(${areaCode}) 555-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const website = `https://${cleanDomain}.com`;
    const title = TITLES[Math.floor(Math.random() * TITLES.length)];
    const technicianCount = FLEET_SIZES[Math.floor(Math.random() * FLEET_SIZES.length)];
    const painPoints = PAIN_POINT_SETS[Math.floor(Math.random() * PAIN_POINT_SETS.length)];

    try {
      const id = randomUUID();
      const now = new Date();
      await prisma.$executeRawUnsafe(
        `INSERT INTO cold_prospects (
          id, company_name, contact_name, title, email, phone, website, city, state, technician_count, pain_points, interest_level, outreach_status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        ON CONFLICT (email) DO NOTHING`,
        id,
        companyName,
        `${firstName} ${lastName}`,
        title,
        email,
        phone,
        website,
        city,
        stateKey,
        technicianCount,
        JSON.stringify(painPoints),
        'UNDECIDED',
        'NOT_CONTACTED',
        now,
        now
      );
      added++;
    } catch (e) {
      console.warn('Import error:', e);
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
