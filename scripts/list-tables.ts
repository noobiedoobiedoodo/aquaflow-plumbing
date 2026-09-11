import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('FATAL: DATABASE_URL environment variable is required. Set it before running this script.');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  const res = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log('Tables in public schema:', res.rows.map(r => r.table_name).join(', '));
  
  const members = await client.query('SELECT * FROM "OrganizationMember"');
  console.log('Organization members count:', members.rows.length);
  
  await client.end();
}

main().catch(console.error);
