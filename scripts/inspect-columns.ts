import { Client } from 'pg';

const connectionString = 'postgresql://neondb_owner:npg_vS7DL6wtnKXY@ep-gentle-base-avcskn5x.c-11.us-east-1.aws.neon.tech/neondb?sslmode=require';

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  
  const res = await client.query(`
    SELECT table_schema, table_name, column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name ILIKE '%user%'
    ORDER BY table_schema, table_name, column_name;
  `);
  console.log('Columns for user tables:');
  console.table(res.rows);
  
  await client.end();
}

main().catch(console.error);
