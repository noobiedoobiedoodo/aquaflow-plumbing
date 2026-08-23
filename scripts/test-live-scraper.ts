import 'dotenv/config';
import { importScrapedProspects, getColdProspects } from '../src/lib/services/prospecting-service';

async function testLiveScrape() {
  console.log('\n======================================================');
  console.log('⚡ TESTING REAL LIVE SERPAPI GOOGLE MAPS PROSPECTOR');
  console.log('======================================================\n');

  const res = await importScrapedProspects('TX', 10);
  console.log(`✅ Engine Source: ${res.source}`);
  console.log(`✅ Newly Added: ${res.added} | Total Database: ${res.total}`);

  const prospects = await getColdProspects();
  console.log('\n🎯 Real Live Plumbing Contractors Scraped from Google Maps:');
  prospects.slice(0, 5).forEach((p, i) => {
    console.log(`   ${i + 1}. [${p.state}] ${p.companyName}`);
    console.log(`      📞 Phone: ${p.phone}`);
    console.log(`      🌐 Website: ${p.website}`);
    console.log(`      📧 Contact: ${p.contactName} (${p.email})`);
    console.log(`      🚨 Pain Points: ${p.painPoints.join(', ')}\n`);
  });

  console.log('======================================================\n');
}

testLiveScrape();
