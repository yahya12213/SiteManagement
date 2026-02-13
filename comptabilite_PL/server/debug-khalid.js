import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: join(__dirname, '.env') });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkKhalidUsers() {
  try {
    console.log('\n=== Diagnostic: Users nommés Khalid ===\n');

    const result = await pool.query(`
      SELECT id, username, full_name, role
      FROM profiles
      WHERE full_name ILIKE '%khalid%' OR username ILIKE '%khalid%'
      ORDER BY full_name, role
    `);

    if (result.rows.length === 0) {
      console.log('❌ Aucun utilisateur "khalid" trouvé dans la base de données.');
    } else {
      console.log(`✓ Trouvé ${result.rows.length} utilisateur(s):\n`);
      result.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row.full_name}`);
        console.log(`   Username: ${row.username}`);
        console.log(`   Role: ${row.role}`);
        console.log(`   ID: ${row.id}`);
        console.log('');
      });
    }

    // Test du nouvel endpoint
    console.log('\n=== Test: Query avec WHERE role=\'professor\' ===\n');
    const professorsResult = await pool.query(`
      SELECT id, username, full_name, role
      FROM profiles
      WHERE role = 'professor' AND (full_name ILIKE '%khalid%' OR username ILIKE '%khalid%')
    `);

    if (professorsResult.rows.length === 0) {
      console.log('❌ Aucun professeur nommé "khalid" trouvé.');
      console.log('   → Le dropdown NE DOIT PAS montrer "khalid fathi" si son role n\'est pas "professor"');
    } else {
      console.log(`✓ Trouvé ${professorsResult.rows.length} professeur(s) nommé(s) khalid:\n`);
      professorsResult.rows.forEach((row, index) => {
        console.log(`${index + 1}. ${row.full_name} (${row.username})`);
      });
    }

    await pool.end();
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    await pool.end();
    process.exit(1);
  }
}

checkKhalidUsers();
