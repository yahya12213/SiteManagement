/**
 * Migration 096: Add training.certificates.generate permission to gérant role
 * FIX: Allows gérant users to generate certificates/documents
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

export async function runMigration() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 096: Add certificates.generate permission to gérant ===');

    // 1. Find gérant role
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

    // 2. Find the permission
    const permResult = await client.query(`
      SELECT id, code FROM permissions
      WHERE code = 'training.certificates.generate'
    `);

    if (permResult.rows.length === 0) {
      // Create the permission if it doesn't exist
      console.log('Permission training.certificates.generate non trouvée, création...');
      const insertPermResult = await client.query(`
        INSERT INTO permissions (code, module, menu, action, label, description)
        VALUES (
          'training.certificates.generate',
          'training',
          'certificates',
          'generate',
          'Générer un certificat',
          'Permet de générer un certificat pour un étudiant'
        )
        ON CONFLICT (code) DO NOTHING
        RETURNING id
      `);

      if (insertPermResult.rows.length === 0) {
        // Permission was already there, fetch it
        const fetchPerm = await client.query(`
          SELECT id FROM permissions WHERE code = 'training.certificates.generate'
        `);
        permResult.rows = fetchPerm.rows;
      } else {
        permResult.rows = insertPermResult.rows;
      }
    }

    const permissionId = permResult.rows[0].id;
    console.log(`✓ Permission trouvée/créée: ${permissionId}`);

    // 3. Check if already assigned
    const existingResult = await client.query(`
      SELECT 1 FROM role_permissions
      WHERE role_id = $1 AND permission_id = $2
    `, [gerantRoleId, permissionId]);

    if (existingResult.rows.length > 0) {
      console.log('✓ Permission déjà assignée au gérant');
    } else {
      // 4. Assign permission to gérant
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [gerantRoleId, permissionId]);
      console.log('✓ Permission assignée au gérant');
    }

    // 5. Also assign ALL training.certificates.* permissions
    const allCertPermsResult = await client.query(`
      SELECT id, code FROM permissions
      WHERE code LIKE 'training.certificates.%'
    `);

    console.log(`\n📋 Toutes les permissions training.certificates.*: ${allCertPermsResult.rows.length}`);

    let assignedCount = 0;
    for (const perm of allCertPermsResult.rows) {
      const result = await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        RETURNING 1
      `, [gerantRoleId, perm.id]);

      if (result.rows.length > 0) {
        console.log(`  + ${perm.code}`);
        assignedCount++;
      } else {
        console.log(`  ✓ ${perm.code} (déjà assignée)`);
      }
    }

    // 6. Verify
    const verifyResult = await client.query(`
      SELECT p.code
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = $1 AND p.code LIKE 'training.certificates.%'
      ORDER BY p.code
    `, [gerantRoleId]);

    console.log(`\n✅ Permissions training.certificates.* du gérant:`);
    verifyResult.rows.forEach(row => console.log(`  ✓ ${row.code}`));

    await client.query('COMMIT');

    return {
      success: true,
      message: 'Permission training.certificates.generate ajoutée au gérant',
      gerantRoleId,
      permissionsAssigned: assignedCount,
      totalCertificatePermissions: verifyResult.rows.length,
      permissions: verifyResult.rows.map(r => r.code)
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 096 failed:', error);
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

// GET endpoint (also runs migration for convenience)
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
        ? 'Migration 096 déjà appliquée - permission certificates.generate assignée au gérant'
        : 'Migration 096 nécessaire - permission à ajouter au gérant'
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
