import pool from '../config/database.js';

async function checkTables() {
  try {
    console.log('🔍 Checking tables in database...');

    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log(`\n📊 Found ${result.rows.length} tables:\n`);
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

    if (result.rows.length === 0) {
      console.log('\n⚠️  No tables found! Database is empty.');
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkTables();
