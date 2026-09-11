import { Client } from 'pg';

const connectionString = 'postgresql://neondb_owner:npg_vS7DL6wtnKXY@ep-gentle-base-avcskn5x.c-11.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  
  const res = await client.query(`
    SELECT attname as column_name, atttypid::regtype as data_type
    FROM pg_attribute
    WHERE attrelid = '"User"'::regclass
      AND attnum > 0
      AND NOT attisdropped
    ORDER BY attnum;
  `);
  console.log('Exact column names in "User" table:');
  console.log(res.rows);
  
  // Test Prisma client query directly
  const { prisma } = await import('../src/lib/db');
  try {
    const user = await prisma.user.findFirst();
    console.log('Prisma query success! User:', user?.email);
  } catch (err: any) {
    console.error('Prisma query failed:', err.message);
  }
  
  await client.end();
}

main().catch(console.error);
