import { NextRequest, NextResponse } from 'next/server';
import { isAuthorizedAdmin } from '../leads/route';
import { prisma } from '@/lib/db';
import {
  getColdProspects,
  importScrapedProspects,
  ensureColdProspectsTable,
} from '@/lib/services/prospecting-service';

export async function GET(req: NextRequest) {
  try {
    const auth = await isAuthorizedAdmin(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized. Administrator access required.' },
        { status: 401 }
      );
    }

    await ensureColdProspectsTable();
    const prospects = await getColdProspects();
    return NextResponse.json({ success: true, prospects });
  } catch (error) {
    console.error('Failed to fetch cold prospects:', error);
    return NextResponse.json(
      { success: false, message: 'Internal error loading prospects' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await isAuthorizedAdmin(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized. Administrator access required.' },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const stateFilter = body.state || 'ALL';
    const limit = typeof body.limit === 'number' ? body.limit : 50;
    const autoOutreach = body.autoOutreach !== false;

    const result = await importScrapedProspects(stateFilter, limit, autoOutreach);
    const prospects = await getColdProspects();

    return NextResponse.json({
      success: true,
      message: `Scraper & Prospector ran successfully for ${stateFilter}`,
      added: result.added,
      emailed: result.emailed,
      source: result.source,
      total: result.total,
      prospects,
    });
  } catch (error) {
    console.error('Failed to scrape/import prospects:', error);
    return NextResponse.json(
      { success: false, message: 'Internal error running prospector' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await isAuthorizedAdmin(req);
    if (!auth) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized. Administrator access required.' },
        { status: 401 }
      );
    }

    await ensureColdProspectsTable();
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE cold_prospects;`);
    return NextResponse.json({ success: true, message: 'All cold prospects cleared successfully.' });
  } catch (error) {
    console.error('Failed to clear cold prospects:', error);
    return NextResponse.json(
      { success: false, message: 'Internal error clearing prospects' },
      { status: 500 }
    );
  }
}
