import { Client } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('FATAL: DATABASE_URL environment variable is required. Set it before running this script.');
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  console.log('Connected to Neon PostgreSQL.');
  
  await client.query('ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "passwordSetAt" TIMESTAMP(3);');
  await client.query('ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;');
  
  const res = await client.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'User'");
  console.log('User table columns:', res.rows.map(r => r.column_name).join(', '));
  
  const users = await client.query('SELECT id, email, "passwordHash", "passwordSetAt" FROM "User"');
  console.log('Users in DB:', users.rows);
  
  await client.end();
}

main().catch(console.error);
