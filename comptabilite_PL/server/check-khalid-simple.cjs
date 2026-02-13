// Script de diagnostic simplifié pour vérifier les utilisateurs khalid
const pg = require('pg');
require('dotenv').config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkUsers() {
  try {
    console.log('\n========================================');
    console.log('DIAGNOSTIC: Utilisateurs nommés "khalid"');
    console.log('========================================\n');

    // 1. Chercher tous les users "khalid"
    const allKhalids = await pool.query(`
      SELECT id, username, full_name, role, created_at
      FROM profiles
      WHERE full_name ILIKE '%khalid%' OR username ILIKE '%khalid%'
      ORDER BY full_name, role
    `);

    console.log(`Nombre total d'utilisateurs "khalid": ${allKhalids.rows.length}\n`);

    if (allKhalids.rows.length === 0) {
      console.log('❌ Aucun utilisateur trouvé.');
    } else {
      allKhalids.rows.forEach((user, index) => {
        console.log(`[${index + 1}] ${user.full_name}`);
        console.log(`    Username: ${user.username}`);
        console.log(`    Role: ${user.role}`);
        console.log(`    ID: ${user.id.substring(0, 8)}...`);
        console.log('');
      });
    }

    // 2. Chercher seulement les professeurs nommés "khalid"
    console.log('\n========================================');
    console.log('PROFESSEURS nommés "khalid" (role=\'professor\')');
    console.log('========================================\n');

    const professorKhalids = await pool.query(`
      SELECT id, username, full_name, role
      FROM profiles
      WHERE role = 'professor'
        AND (full_name ILIKE '%khalid%' OR username ILIKE '%khalid%')
    `);

    console.log(`Nombre de professeurs: ${professorKhalids.rows.length}\n`);

    if (professorKhalids.rows.length === 0) {
      console.log('❌ AUCUN professeur nommé "khalid".');
      console.log('   → Le dropdown NE DEVRAIT PAS montrer "khalid" !');
    } else {
      professorKhalids.rows.forEach((user, index) => {
        console.log(`[${index + 1}] ${user.full_name} (${user.username})`);
      });
    }

    // 3. Chercher les gérants nommés "khalid"
    console.log('\n========================================');
    console.log('GÉRANTS nommés "khalid" (role=\'gerant\')');
    console.log('========================================\n');

    const gerantKhalids = await pool.query(`
      SELECT id, username, full_name, role
      FROM profiles
      WHERE role = 'gerant'
        AND (full_name ILIKE '%khalid%' OR username ILIKE '%khalid%')
    `);

    console.log(`Nombre de gérants: ${gerantKhalids.rows.length}\n`);

    if (gerantKhalids.rows.length > 0) {
      gerantKhalids.rows.forEach((user, index) => {
        console.log(`[${index + 1}] ${user.full_name} (${user.username})`);
      });
    } else {
      console.log('Aucun gérant trouvé.');
    }

    await pool.end();
    console.log('\n✓ Diagnostic terminé.\n');

  } catch (error) {
    console.error('\n❌ ERREUR:', error.message);
    console.error(error.stack);
    await pool.end();
    process.exit(1);
  }
}

checkUsers();
