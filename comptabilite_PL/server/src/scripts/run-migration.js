import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const runMigration = async () => {
  const client = new Client({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully');

    console.log('📖 Reading migration file...');
    const sqlPath = join(__dirname, 'migrate-data.sql');
    const sql = readFileSync(sqlPath, 'utf8');

    console.log('🚀 Executing migration...');
    await client.query(sql);

    console.log('✅ Migration completed successfully!');

    // Verify data
    const counts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM profiles) as profiles_count,
        (SELECT COUNT(*) FROM segments) as segments_count,
        (SELECT COUNT(*) FROM cities) as cities_count,
        (SELECT COUNT(*) FROM calculation_sheets) as sheets_count,
        (SELECT COUNT(*) FROM professor_segments) as prof_segments_count,
        (SELECT COUNT(*) FROM professor_cities) as prof_cities_count
    `);

    console.log('\n📊 Migration results:');
    console.log('  - Profiles:', counts.rows[0].profiles_count);
    console.log('  - Segments:', counts.rows[0].segments_count);
    console.log('  - Cities:', counts.rows[0].cities_count);
    console.log('  - Calculation sheets:', counts.rows[0].sheets_count);
    console.log('  - Professor-Segment links:', counts.rows[0].prof_segments_count);
    console.log('  - Professor-City links:', counts.rows[0].prof_cities_count);

    await client.end();
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Error details:', error);
    await client.end();
    process.exit(1);
  }
};

runMigration();
