/**
 * Migration 098: Add training.certificates.view permission to gérant
 * FIX: Allows gérant to view/download individual certificates
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

export async function runMigration() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 098: Add certificates.view permission ===');

    // 1. Check if permission exists, create if not
    let permResult = await client.query(`
      SELECT id FROM permissions WHERE code = 'training.certificates.view'
    `);

    let permissionId;

    if (permResult.rows.length === 0) {
      console.log('Creating training.certificates.view permission...');
      const insertResult = await client.query(`
        INSERT INTO permissions (code, module, menu, action, label, description)
        VALUES (
          'training.certificates.view',
          'training',
          'certificates',
          'view',
          'Voir un certificat',
          'Permet de visualiser et télécharger un certificat spécifique'
        )
        RETURNING id
      `);
      permissionId = insertResult.rows[0].id;
      console.log(`✓ Permission créée: ${permissionId}`);
    } else {
      permissionId = permResult.rows[0].id;
      console.log(`✓ Permission existe: ${permissionId}`);
    }

    // 2. Find gérant role
    const gerantResult = await client.query(`
      SELECT id FROM roles WHERE LOWER(name) IN ('gerant', 'gérant') LIMIT 1
    `);

    if (gerantResult.rows.length === 0) {
      throw new Error('Rôle gérant introuvable');
    }

    const gerantRoleId = gerantResult.rows[0].id;
    console.log(`✓ Gérant role: ${gerantRoleId}`);

    // 3. Assign permission
    await client.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [gerantRoleId, permissionId]);

    console.log('✓ Permission assignée au gérant');

    // 4. Also assign to admin
    const adminResult = await client.query(`
      SELECT id FROM roles WHERE LOWER(name) = 'admin' LIMIT 1
    `);

    if (adminResult.rows.length > 0) {
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [adminResult.rows[0].id, permissionId]);
      console.log('✓ Permission assignée à admin');
    }

    // 5. Verify all certificates permissions for gérant
    const allPerms = await client.query(`
      SELECT p.code, p.label
      FROM permissions p
      LEFT JOIN role_permissions rp ON p.id = rp.permission_id AND rp.role_id = $1
      WHERE p.code LIKE 'training.certificates.%'
      ORDER BY p.code
    `, [gerantRoleId]);

    console.log('\n📋 Toutes les permissions certificates du gérant:');
    allPerms.rows.forEach(p => console.log(`  ✓ ${p.code} - ${p.label}`));

    await client.query('COMMIT');

    return {
      success: true,
      message: 'Permission training.certificates.view ajoutée au gérant',
      permissionId,
      gerantRoleId,
      allCertificatesPermissions: allPerms.rows
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 098 failed:', error);
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
    res.status(500).json({ success: false, error: error.message });
  }
});

// /run endpoint for MigrationPanel
router.post('/run', async (req, res) => {
  try {
    const result = await runMigration();
    res.json({ success: true, details: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET endpoint
router.get('/', async (req, res) => {
  try {
    const result = await runMigration();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// /status endpoint
router.get('/status', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 1 FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      JOIN roles r ON rp.role_id = r.id
      WHERE p.code = 'training.certificates.view'
      AND LOWER(r.name) IN ('gerant', 'gérant')
    `);

    const applied = result.rows.length > 0;
    res.json({
      applied,
      status: { migrationNeeded: !applied },
      message: applied
        ? 'Migration 098 appliquée - permission certificates.view assignée'
        : 'Migration 098 nécessaire - permission à ajouter'
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
