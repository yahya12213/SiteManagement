/**
 * Migration DEBUG: Vérifier les permissions du rôle gérant en détail
 * Affiche TOUTES les permissions training.certificate_templates.* et vérifie l'assignation
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== DEBUG: Vérification complète des permissions gérant ===\n');

    // 1. Trouver le rôle gérant
    const gerantRoleResult = await client.query(`
      SELECT id, name FROM roles
      WHERE LOWER(name) = 'gerant'
      LIMIT 1
    `);

    if (gerantRoleResult.rows.length === 0) {
      throw new Error('Rôle gérant introuvable');
    }

    const gerantRoleId = gerantRoleResult.rows[0].id;
    console.log(`✓ Rôle gérant trouvé: ${gerantRoleId}\n`);

    // 2. Vérifier TOUTES les permissions training.certificate_templates.* dans la table permissions
    console.log('📋 Permissions training.certificate_templates.* dans la table permissions:');
    const allCertPermsResult = await client.query(`
      SELECT id, code, module, menu, action
      FROM permissions
      WHERE code LIKE 'training.certificate_templates.%'
      ORDER BY code
    `);

    console.log(`   Total: ${allCertPermsResult.rows.length} permissions\n`);
    allCertPermsResult.rows.forEach(perm => {
      console.log(`   - ${perm.code} (ID: ${perm.id})`);
    });

    // 3. Vérifier lesquelles sont assignées au gérant
    console.log('\n📊 Permissions assignées au gérant:');
    const assignedCertPermsResult = await client.query(`
      SELECT p.code, rp.role_id, rp.permission_id
      FROM role_permissions rp
      INNER JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = $1
        AND p.code LIKE 'training.certificate_templates.%'
      ORDER BY p.code
    `, [gerantRoleId]);

    console.log(`   Total assignées: ${assignedCertPermsResult.rows.length}\n`);
    assignedCertPermsResult.rows.forEach(perm => {
      console.log(`   ✓ ${perm.code}`);
    });

    // 4. Trouver les permissions manquantes
    const assignedCodes = new Set(assignedCertPermsResult.rows.map(r => r.code));
    const missingPerms = allCertPermsResult.rows.filter(p => !assignedCodes.has(p.code));

    if (missingPerms.length > 0) {
      console.log('\n❌ PERMISSIONS MANQUANTES:');
      missingPerms.forEach(perm => {
        console.log(`   ✗ ${perm.code} (ID: ${perm.id})`);
      });

      // 5. Assigner les permissions manquantes
      console.log('\n⏳ Attribution des permissions manquantes...');
      for (const perm of missingPerms) {
        await client.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [gerantRoleId, perm.id]);
        console.log(`   ✓ Assigné: ${perm.code}`);
      }
    } else {
      console.log('\n✅ TOUTES les permissions training.certificate_templates.* sont assignées au gérant');
    }

    // 6. Vérifier spécifiquement training.certificate_templates.update
    console.log('\n🔍 Vérification spécifique: training.certificate_templates.update');
    const updatePermResult = await client.query(`
      SELECT
        p.id as perm_id,
        p.code,
        rp.role_id,
        CASE WHEN rp.role_id IS NOT NULL THEN true ELSE false END as is_assigned
      FROM permissions p
      LEFT JOIN role_permissions rp ON rp.permission_id = p.id AND rp.role_id = $1
      WHERE p.code = 'training.certificate_templates.update'
    `, [gerantRoleId]);

    if (updatePermResult.rows.length === 0) {
      console.log('   ❌ La permission training.certificate_templates.update N\'EXISTE PAS dans la table permissions !');
    } else {
      const updatePerm = updatePermResult.rows[0];
      console.log(`   - Permission ID: ${updatePerm.perm_id}`);
      console.log(`   - Code: ${updatePerm.code}`);
      console.log(`   - Assignée au gérant: ${updatePerm.is_assigned ? '✅ OUI' : '❌ NON'}`);
    }

    // 7. Vérifier l'utilisateur khalid fathi
    console.log('\n👤 Vérification utilisateur: khalid fathi');
    const userResult = await client.query(`
      SELECT
        p.id,
        p.username,
        p.role,
        p.role_id,
        r.name as role_name_from_id
      FROM profiles p
      LEFT JOIN roles r ON p.role_id = r.id
      WHERE p.username = 'khalid fathi'
    `);

    if (userResult.rows.length === 0) {
      console.log('   ❌ Utilisateur khalid fathi introuvable');
    } else {
      const user = userResult.rows[0];
      console.log(`   - ID: ${user.id}`);
      console.log(`   - Username: ${user.username}`);
      console.log(`   - role (texte): ${user.role}`);
      console.log(`   - role_id: ${user.role_id}`);
      console.log(`   - Rôle via role_id: ${user.role_name_from_id}`);
      console.log(`   - Correspondance: ${user.role === 'gerant' && user.role_name_from_id === 'gerant' ? '✅ CORRECT' : '❌ INCOHÉRENT'}`);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Vérification terminée',
      summary: {
        totalCertTemplatePerms: allCertPermsResult.rows.length,
        assignedToGerant: assignedCertPermsResult.rows.length,
        missingCount: missingPerms.length,
        missingPermissions: missingPerms.map(p => p.code),
        updatePermExists: updatePermResult.rows.length > 0,
        updatePermAssigned: updatePermResult.rows.length > 0 && updatePermResult.rows[0].is_assigned
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

router.get('/status', async (req, res) => {
  res.json({
    status: { migrationNeeded: true, applied: false },
    message: 'This is a debug migration - always run it to check current state'
  });
});

export default router;
