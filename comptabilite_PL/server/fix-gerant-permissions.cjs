const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function fixGerantPermissions() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('\n=== FIX: Assigner TOUTES les permissions au rôle Gérant ===\n');

    // 1. Trouver le rôle gérant
    const gerantRoleResult = await client.query(`
      SELECT id, name FROM roles
      WHERE LOWER(name) IN ('gerant', 'gérant')
      LIMIT 1
    `);

    if (gerantRoleResult.rows.length === 0) {
      console.error('❌ Rôle gérant introuvable !');
      await client.query('ROLLBACK');
      process.exit(1);
    }

    const gerantRoleId = gerantRoleResult.rows[0].id;
    const gerantRoleName = gerantRoleResult.rows[0].name;
    console.log(`✓ Rôle trouvé: "${gerantRoleName}" (ID: ${gerantRoleId})`);

    // 2. Récupérer TOUTES les permissions
    const allPermissionsResult = await client.query(`
      SELECT id, code, module, menu, action
      FROM permissions
      ORDER BY module, menu, action
    `);

    console.log(`\n📊 Total permissions dans la DB: ${allPermissionsResult.rows.length}`);

    // 3. Récupérer les permissions actuelles du gérant
    const currentPermsResult = await client.query(`
      SELECT p.code
      FROM role_permissions rp
      INNER JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = $1
    `, [gerantRoleId]);

    const currentPermCodes = new Set(currentPermsResult.rows.map(r => r.code));
    console.log(`   - Actuellement assignées: ${currentPermCodes.size}`);

    // 4. Trouver les permissions manquantes
    const missingPermissions = allPermissionsResult.rows.filter(
      perm => !currentPermCodes.has(perm.code)
    );

    console.log(`   - Manquantes: ${missingPermissions.length}\n`);

    if (missingPermissions.length === 0) {
      console.log('✅ Le gérant a déjà TOUTES les permissions !');
      await client.query('COMMIT');
      await pool.end();
      return;
    }

    // 5. Afficher quelques permissions manquantes
    console.log('🔧 Exemples de permissions manquantes:');
    missingPermissions.slice(0, 10).forEach(perm => {
      console.log(`   - ${perm.code}`);
    });
    if (missingPermissions.length > 10) {
      console.log(`   ... et ${missingPermissions.length - 10} autres\n`);
    }

    // 6. Assigner TOUTES les permissions manquantes
    console.log('⏳ Attribution des permissions manquantes...');
    let assignedCount = 0;

    for (const permission of missingPermissions) {
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [gerantRoleId, permission.id]);
      assignedCount++;
    }

    console.log(`✅ ${assignedCount} nouvelles permissions assignées\n`);

    // 7. Vérifier le résultat final
    const finalCountResult = await client.query(`
      SELECT COUNT(*) as total
      FROM role_permissions
      WHERE role_id = $1
    `, [gerantRoleId]);

    const totalPerms = parseInt(finalCountResult.rows[0].total);
    console.log(`📊 Le gérant a maintenant ${totalPerms} permissions au total`);

    // 8. Vérifier spécifiquement les permissions certificate_templates
    const certPermsResult = await client.query(`
      SELECT p.code
      FROM role_permissions rp
      INNER JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = $1
        AND p.code LIKE 'training.certificate_templates.%'
      ORDER BY p.code
    `, [gerantRoleId]);

    console.log(`\n✅ Permissions Certificate Templates (${certPermsResult.rows.length}):`);
    certPermsResult.rows.forEach(row => {
      console.log(`   ✓ ${row.code}`);
    });

    // 9. Récapitulatif par module
    const moduleCountsResult = await client.query(`
      SELECT p.module, COUNT(*) as count
      FROM role_permissions rp
      INNER JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = $1
      GROUP BY p.module
      ORDER BY p.module
    `, [gerantRoleId]);

    console.log('\n📋 Récapitulatif par module:');
    moduleCountsResult.rows.forEach(row => {
      console.log(`   - ${row.module}: ${row.count} permissions`);
    });

    await client.query('COMMIT');

    console.log('\n✅ FIX TERMINÉ AVEC SUCCÈS !');
    console.log('Khalid Fathi peut maintenant sauvegarder les templates de certificats.\n');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ ERREUR:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

fixGerantPermissions();
