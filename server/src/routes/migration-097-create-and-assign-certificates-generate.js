/**
 * Migration 097: Create and Assign training.certificates.generate permission
 * This migration ensures the permission exists AND is assigned to gérant
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

export async function runMigration() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 097: Create and Assign certificates.generate ===');

    // 1. Check if permission exists
    let permResult = await client.query(`
      SELECT id, code, label FROM permissions
      WHERE code = 'training.certificates.generate'
    `);

    let permissionId;

    if (permResult.rows.length === 0) {
      console.log('Permission training.certificates.generate NOT FOUND - Creating...');

      // Create the permission
      const insertResult = await client.query(`
        INSERT INTO permissions (code, module, menu, action, label, description)
        VALUES (
          'training.certificates.generate',
          'training',
          'certificates',
          'generate',
          'Générer un certificat',
          'Permet de générer un certificat pour un étudiant'
        )
        RETURNING id
      `);

      permissionId = insertResult.rows[0].id;
      console.log(`✓ Permission créée avec ID: ${permissionId}`);
    } else {
      permissionId = permResult.rows[0].id;
      console.log(`✓ Permission existe déjà: ${permResult.rows[0].label} (ID: ${permissionId})`);
    }

    // 2. Find gérant role
    const gerantRoleResult = await client.query(`
      SELECT id, name FROM roles
      WHERE LOWER(name) IN ('gerant', 'gérant')
      LIMIT 1
    `);

    if (gerantRoleResult.rows.length === 0) {
      throw new Error('Rôle gérant introuvable');
    }

    const gerantRoleId = gerantRoleResult.rows[0].id;
    console.log(`✓ Rôle gérant trouvé: ${gerantRoleId}`);

    // 3. Check if already assigned
    const existingAssignment = await client.query(`
      SELECT 1 FROM role_permissions
      WHERE role_id = $1 AND permission_id = $2
    `, [gerantRoleId, permissionId]);

    if (existingAssignment.rows.length > 0) {
      console.log('✓ Permission DÉJÀ assignée au gérant');
    } else {
      // Assign to gérant
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
      `, [gerantRoleId, permissionId]);
      console.log('✓ Permission ASSIGNÉE au gérant');
    }

    // 4. Also find and assign admin role
    const adminRoleResult = await client.query(`
      SELECT id FROM roles WHERE LOWER(name) = 'admin' LIMIT 1
    `);

    if (adminRoleResult.rows.length > 0) {
      const adminRoleId = adminRoleResult.rows[0].id;
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [adminRoleId, permissionId]);
      console.log('✓ Permission aussi assignée à admin');
    }

    // 5. List ALL certificates permissions for gérant
    const allCertPerms = await client.query(`
      SELECT p.code, p.label,
             CASE WHEN rp.role_id IS NOT NULL THEN 'OUI' ELSE 'NON' END as assigned
      FROM permissions p
      LEFT JOIN role_permissions rp ON p.id = rp.permission_id AND rp.role_id = $1
      WHERE p.code LIKE 'training.certificates.%'
      ORDER BY p.code
    `, [gerantRoleId]);

    console.log('\n📋 Permissions training.certificates.* pour gérant:');
    allCertPerms.rows.forEach(row => {
      const icon = row.assigned === 'OUI' ? '✅' : '❌';
      console.log(`  ${icon} ${row.code} - ${row.label}`);
    });

    // 6. If any certificates permission is not assigned, assign them all
    const missingPerms = allCertPerms.rows.filter(r => r.assigned === 'NON');
    if (missingPerms.length > 0) {
      console.log(`\n🔧 ${missingPerms.length} permissions manquantes, assignation...`);

      for (const perm of missingPerms) {
        const permIdResult = await client.query(`
          SELECT id FROM permissions WHERE code = $1
        `, [perm.code]);

        if (permIdResult.rows.length > 0) {
          await client.query(`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [gerantRoleId, permIdResult.rows[0].id]);
          console.log(`  + ${perm.code}`);
        }
      }
    }

    // 7. Final verification
    const finalCheck = await client.query(`
      SELECT p.code, p.label
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = $1 AND p.code = 'training.certificates.generate'
    `, [gerantRoleId]);

    const success = finalCheck.rows.length > 0;

    if (success) {
      console.log('\n✅ SUCCÈS: training.certificates.generate est maintenant assignée au gérant');
    } else {
      console.log('\n❌ ÉCHEC: La permission n\'a pas été assignée');
    }

    await client.query('COMMIT');

    return {
      success: success,
      message: success
        ? 'Permission training.certificates.generate créée et assignée au gérant'
        : 'Échec de l\'assignation',
      permissionId,
      gerantRoleId,
      certificatesPermissions: allCertPerms.rows
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 097 failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// POST endpoint
router.post('/', async (req, res) => {
  try {
    const result = await runMigration();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// /run endpoint for MigrationPanel compatibility
router.post('/run', async (req, res) => {
  try {
    const result = await runMigration();
    res.json({ success: true, details: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET endpoint
router.get('/', async (req, res) => {
  try {
    const result = await runMigration();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// /status endpoint for MigrationPanel
router.get('/status', async (req, res) => {
  try {
    // Check if permission exists and is assigned to gérant
    const result = await pool.query(`
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      JOIN roles r ON rp.role_id = r.id
      WHERE p.code = 'training.certificates.generate'
      AND LOWER(r.name) IN ('gerant', 'gérant')
    `);

    const applied = result.rows.length > 0;
    res.json({
      applied,
      status: { migrationNeeded: !applied },
      message: applied
        ? 'Migration 097 déjà appliquée - permission certificates.generate existe et assignée au gérant'
        : 'Migration 097 nécessaire - permission à créer et assigner'
    });
  } catch (error) {
    res.status(500).json({
      applied: false,
      status: { migrationNeeded: true },
      message: error.message
    });
  }
});

export default router;
