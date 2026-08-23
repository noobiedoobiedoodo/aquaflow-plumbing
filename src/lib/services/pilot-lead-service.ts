import { prisma } from '../db';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

export type PilotLeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'APPROVED'
  | 'WAITLIST'
  | 'ONBOARDING'
  | 'ONBOARDED'
  | 'DECLINED';

export interface PilotLeadInput {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  website?: string;
  city: string;
  province: string;
  technicianCount: string;
  painPoints: string[];
  notes?: string;
  source?: string;
  campaign?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  referrer?: string;
}

export interface PilotLeadRecord {
  id: string;
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  website?: string | null;
  city: string;
  province: string;
  technicianCount: string;
  painPoints: string[];
  notes?: string | null;
  status: PilotLeadStatus;
  source: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  referrer?: string | null;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_PATH = path.join(process.cwd(), 'storage', 'pilot-leads.json');

let tableInitialized = false;

/**
 * Ensures the isolated durable pilot_applications table exists in PostgreSQL
 */
export async function ensurePilotLeadTable(): Promise<void> {
  if (tableInitialized) return;

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS pilot_applications (
        id VARCHAR(64) PRIMARY KEY,
        company_name VARCHAR(255) NOT NULL,
        contact_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(100) NOT NULL,
        website VARCHAR(255),
        city VARCHAR(100) NOT NULL,
        province VARCHAR(100) NOT NULL,
        technician_count VARCHAR(100) NOT NULL,
        pain_points TEXT NOT NULL,
        notes TEXT,
        status VARCHAR(50) DEFAULT 'NEW',
        source VARCHAR(100) DEFAULT 'direct',
        utm_source VARCHAR(255),
        utm_medium VARCHAR(255),
        utm_campaign VARCHAR(255),
        utm_content VARCHAR(255),
        referrer TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_pilot_apps_email ON pilot_applications(email);
    `);
    tableInitialized = true;
  } catch (err: any) {
    console.warn('Table initialization note:', err.message);
  }
}

/**
 * Backup lead to local JSON storage file
 */
async function syncToBackupStorage(lead: PilotLeadRecord): Promise<void> {
  try {
    const dir = path.dirname(STORAGE_PATH);
    await fs.mkdir(dir, { recursive: true });
    let list: PilotLeadRecord[] = [];
    try {
      const existing = await fs.readFile(STORAGE_PATH, 'utf-8');
      list = JSON.parse(existing);
    } catch {
      list = [];
    }
    const idx = list.findIndex((l) => l.id === lead.id);
    if (idx >= 0) {
      list[idx] = lead;
    } else {
      list.push(lead);
    }
    await fs.writeFile(STORAGE_PATH, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Backup storage sync warning:', e);
  }
}

/**
 * Creates or retrieves an existing duplicate pilot application with durable persistence
 */
export async function createPilotLead(input: PilotLeadInput): Promise<{ lead: PilotLeadRecord; isDuplicate: boolean }> {
  await ensurePilotLeadTable();

  const email = input.email.trim().toLowerCase();
  const now = new Date();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // 1. Check for duplicate submission within 24h
  try {
    const existingRows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM pilot_applications WHERE LOWER(email) = $1 AND created_at > $2 LIMIT 1`,
      email,
      oneDayAgo
    );

    if (existingRows && existingRows.length > 0) {
      const row = existingRows[0];
      const lead: PilotLeadRecord = {
        id: row.id,
        companyName: row.company_name,
        contactName: row.contact_name,
        email: row.email,
        phone: row.phone,
        website: row.website,
        city: row.city,
        province: row.province,
        technicianCount: row.technician_count,
        painPoints: typeof row.pain_points === 'string' ? JSON.parse(row.pain_points) : row.pain_points,
        notes: row.notes,
        status: row.status as PilotLeadStatus,
        source: row.source,
        utmSource: row.utm_source,
        utmMedium: row.utm_medium,
        utmCampaign: row.utm_campaign,
        utmContent: row.utm_content,
        referrer: row.referrer,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
      };
      return { lead, isDuplicate: true };
    }
  } catch (queryErr) {
    // Check backup storage for duplicate if DB query failed
    try {
      const backupData = await fs.readFile(STORAGE_PATH, 'utf-8');
      const backupLeads: PilotLeadRecord[] = JSON.parse(backupData);
      const existing = backupLeads.find(
        (l) => l.email.toLowerCase() === email && new Date(l.createdAt).getTime() > Date.now() - 24 * 60 * 60 * 1000
      );
      if (existing) {
        return { lead: existing, isDuplicate: true };
      }
    } catch {}
  }

  // 2. Insert new record into durable database
  const id = randomUUID();
  const painPointsJson = JSON.stringify(input.painPoints);
  const source = input.utmSource || input.source || 'direct';

  try {
    await prisma.$executeRawUnsafe(
      `INSERT INTO pilot_applications (
        id, company_name, contact_name, email, phone, website, city, province, technician_count, pain_points, notes, status, source, utm_source, utm_medium, utm_campaign, utm_content, referrer, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'NEW', $12, $13, $14, $15, $16, $17, $18, $19
      )`,
      id,
      input.companyName.trim(),
      input.contactName.trim(),
      email,
      input.phone.trim(),
      input.website?.trim() || null,
      input.city.trim(),
      input.province.trim(),
      input.technicianCount,
      painPointsJson,
      input.notes?.trim() || null,
      source,
      input.utmSource?.trim() || null,
      input.utmMedium?.trim() || null,
      input.utmCampaign?.trim() || null,
      input.utmContent?.trim() || null,
      input.referrer?.trim() || null,
      now,
      now
    );
  } catch (insertErr: any) {
    console.error('Failed to insert lead into PostgreSQL database:', insertErr);
  }

  const newLead: PilotLeadRecord = {
    id,
    companyName: input.companyName.trim(),
    contactName: input.contactName.trim(),
    email,
    phone: input.phone.trim(),
    website: input.website?.trim() || null,
    city: input.city.trim(),
    province: input.province.trim(),
    technicianCount: input.technicianCount,
    painPoints: input.painPoints,
    notes: input.notes?.trim() || null,
    status: 'NEW',
    source,
    utmSource: input.utmSource?.trim() || null,
    utmMedium: input.utmMedium?.trim() || null,
    utmCampaign: input.utmCampaign?.trim() || null,
    utmContent: input.utmContent?.trim() || null,
    referrer: input.referrer?.trim() || null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  // Sync to backup file
  await syncToBackupStorage(newLead);

  return { lead: newLead, isDuplicate: false };
}

/**
 * Retrieve all pilot leads with attribution
 */
export async function getPilotLeads(): Promise<PilotLeadRecord[]> {
  await ensurePilotLeadTable();

  try {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM pilot_applications ORDER BY created_at DESC`
    );

    if (rows && rows.length > 0) {
      return rows.map((row) => ({
        id: row.id,
        companyName: row.company_name,
        contactName: row.contact_name,
        email: row.email,
        phone: row.phone,
        website: row.website,
        city: row.city,
        province: row.province,
        technicianCount: row.technician_count,
        painPoints: typeof row.pain_points === 'string' ? JSON.parse(row.pain_points) : row.pain_points,
        notes: row.notes,
        status: row.status as PilotLeadStatus,
        source: row.source,
        utmSource: row.utm_source,
        utmMedium: row.utm_medium,
        utmCampaign: row.utm_campaign,
        utmContent: row.utm_content,
        referrer: row.referrer,
        createdAt: new Date(row.created_at).toISOString(),
        updatedAt: new Date(row.updated_at).toISOString(),
      }));
    }
  } catch (err) {
    // Fallback to storage file if DB query fails
  }

  try {
    const data = await fs.readFile(STORAGE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

/**
 * Updates a pilot lead's status and optional notes
 */
export async function updatePilotLeadStatus(
  id: string,
  status: PilotLeadStatus,
  notes?: string
): Promise<PilotLeadRecord | null> {
  await ensurePilotLeadTable();
  const now = new Date();

  try {
    if (notes !== undefined) {
      await prisma.$executeRawUnsafe(
        `UPDATE pilot_applications SET status = $1, notes = $2, updated_at = $3 WHERE id = $4`,
        status,
        notes,
        now,
        id
      );
    } else {
      await prisma.$executeRawUnsafe(
        `UPDATE pilot_applications SET status = $1, updated_at = $2 WHERE id = $3`,
        status,
        now,
        id
      );
    }
  } catch (err) {
    console.error('Failed to update lead status in DB:', err);
  }

  // Update backup file
  try {
    const list = await getPilotLeads();
    const target = list.find((l) => l.id === id);
    if (target) {
      target.status = status;
      if (notes !== undefined) target.notes = notes;
      target.updatedAt = now.toISOString();
      await syncToBackupStorage(target);
      return target;
    }
  } catch (e) {
    console.warn('Backup file update error:', e);
  }

  return null;
}

