/**
 * Script pour vérifier les permissions de récupération et les rôles
 * Usage: node server/src/scripts/verify-recovery-permissions.js
 */

import pg from 'pg';
const { Pool } = pg;

// Configuration de la connexion PostgreSQL
const pool = new Pool({
  host: process.env.PGHOST || 'maglev.proxy.rlwy.net',
  port: process.env.PGPORT || 17589,
  database: process.env.PGDATABASE || 'railway',
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'kMfsYpEZqZorPiMaUPvQnOoBqysrEjQx',
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function verify() {
  const client = await pool.connect();

  try {
    console.log('🔍 Vérification des permissions de récupération...\n');

    // 1. Vérifier si les permissions existent
    const permissionsResult = await client.query(`
      SELECT id, code, label, description, permission_type
      FROM permissions
      WHERE code LIKE '%recuperation%'
      ORDER BY code
    `);

    console.log('📋 Permissions de récupération:');
    console.log('─'.repeat(100));
    if (permissionsResult.rows.length > 0) {
      permissionsResult.rows.forEach(perm => {
        console.log(`ID: ${perm.id}`);
        console.log(`Code: ${perm.code}`);
        console.log(`Label: ${perm.label}`);
        console.log(`Type: ${perm.permission_type}`);
        console.log(`Description: ${perm.description}`);
        console.log('─'.repeat(100));
      });
    } else {
      console.log('❌ Aucune permission de récupération trouvée!');
    }

    // 2. Lister tous les rôles
    const rolesResult = await client.query(`
      SELECT id, name, description
      FROM roles
      ORDER BY name
    `);

    console.log('\n👥 Rôles disponibles:');
    console.log('─'.repeat(100));
    rolesResult.rows.forEach(role => {
      console.log(`ID: ${role.id} | Nom: ${role.name} | Description: ${role.description || 'N/A'}`);
    });
    console.log('─'.repeat(100));

    // 3. Vérifier les rôles qui ont déjà des permissions de gestion horaires
    const rolesWithSchedulePerms = await client.query(`
      SELECT DISTINCT r.id, r.name, p.code
      FROM roles r
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE p.module = 'ressources_humaines'
        OR p.code LIKE 'ressources_humaines.gestion_horaires%'
      ORDER BY r.name, p.code
    `);

    console.log('\n🔐 Rôles avec permissions RH/Horaires:');
    console.log('─'.repeat(100));
    if (rolesWithSchedulePerms.rows.length > 0) {
      let currentRole = null;
      rolesWithSchedulePerms.rows.forEach(row => {
        if (row.name !== currentRole) {
          if (currentRole !== null) console.log('');
          console.log(`\n📌 ${row.name}:`);
          currentRole = row.name;
        }
        console.log(`   - ${row.code}`);
      });
    } else {
      console.log('ℹ️  Aucun rôle avec permissions RH/Horaires');
    }
    console.log('\n' + '─'.repeat(100));

    // 4. Vérifier les attributions actuelles de récupération
    const recoveryAssignments = await client.query(`
      SELECT r.name, p.code, p.label
      FROM roles r
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE p.code LIKE '%recuperation%'
      ORDER BY r.name, p.code
    `);

    console.log('\n✅ Attributions actuelles de permissions récupération:');
    console.log('─'.repeat(100));
    if (recoveryAssignments.rows.length > 0) {
      recoveryAssignments.rows.forEach(row => {
        console.log(`${row.name.padEnd(30)} | ${row.code}`);
      });
    } else {
      console.log('⚠️  Aucune attribution trouvée - les permissions doivent être assignées manuellement');
    }
    console.log('─'.repeat(100));

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    console.error(error);
  } finally {
    client.release();
    await pool.end();
  }
}

verify()
  .then(() => {
    console.log('\n✨ Vérification terminée!');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Erreur fatale:', error);
    process.exit(1);
  });
