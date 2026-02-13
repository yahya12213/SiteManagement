const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 1
});

async function getGerants() {
  try {
    console.log('Connexion à la base de données Railway...');

    const result = await pool.query(`
      SELECT
        p.id,
        p.username,
        p.full_name,
        p.role,
        p.role_id,
        r.name as role_name_from_role_id,
        p.created_at,
        (SELECT COUNT(*) FROM gerant_segments WHERE gerant_id = p.id) as assigned_segments,
        (SELECT COUNT(*) FROM gerant_cities WHERE gerant_id = p.id) as assigned_cities
      FROM profiles p
      LEFT JOIN roles r ON p.role_id = r.id
      WHERE p.role = 'gerant' OR r.name = 'gerant'
      ORDER BY p.created_at DESC
    `);

    console.log('\n=== UTILISATEURS AVEC LE RÔLE GÉRANT ===\n');
    console.log('Total:', result.rows.length, 'utilisateur(s)\n');

    if (result.rows.length === 0) {
      console.log('Aucun utilisateur trouvé avec le rôle gérant.\n');
    } else {
      result.rows.forEach((user, index) => {
        console.log(`[${index + 1}] ID: ${user.id}`);
        console.log(`    Username: ${user.username}`);
        console.log(`    Nom complet: ${user.full_name || 'N/A'}`);
        console.log(`    Rôle (texte): ${user.role}`);
        console.log(`    Rôle ID: ${user.role_id || 'N/A'}`);
        console.log(`    Rôle (via role_id): ${user.role_name_from_role_id || 'N/A'}`);
        console.log(`    Segments assignés: ${user.assigned_segments}`);
        console.log(`    Villes assignées: ${user.assigned_cities}`);
        console.log(`    Créé le: ${user.created_at}`);
        console.log('');
      });
    }

    await pool.end();
  } catch (error) {
    console.error('Erreur de connexion:', error.message);
    console.error('Code:', error.code);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

getGerants();
