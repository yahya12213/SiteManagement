/**
 * Migration CRITICAL: Add missing training.certificate_templates.update permission
 * This permission is required but doesn't exist in the database
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration: Add training.certificate_templates.update permission ===\n');

    // 1. Check if permission already exists
    const existingPermResult = await client.query(`
      SELECT id, code FROM permissions
      WHERE code = 'training.certificate_templates.update'
    `);

    let permissionId;

    if (existingPermResult.rows.length > 0) {
      permissionId = existingPermResult.rows[0].id;
      console.log(`✓ Permission already exists: ${permissionId}`);
    } else {
      // 2. Create the permission
      console.log('Creating permission training.certificate_templates.update...');

      const insertResult = await client.query(`
        INSERT INTO permissions (code, module, menu, action, label, description)
        VALUES (
          'training.certificate_templates.update',
          'training',
          'certificate_templates',
          'update',
          'Modifier un template',
          'Permission de modifier/sauvegarder les templates de certificats'
        )
        RETURNING id
      `);

      permissionId = insertResult.rows[0].id;
      console.log(`✓ Permission created with ID: ${permissionId}`);
    }

    // 3. Find gérant role
    const gerantRoleResult = await client.query(`
      SELECT id, name FROM roles
      WHERE LOWER(name) = 'gerant'
      LIMIT 1
    `);

    if (gerantRoleResult.rows.length === 0) {
      throw new Error('Gérant role not found');
    }

    const gerantRoleId = gerantRoleResult.rows[0].id;
    console.log(`✓ Gérant role found: ${gerantRoleId}`);

    // 4. Assign permission to gérant
    await client.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
    `, [gerantRoleId, permissionId]);

    console.log('✓ Permission assigned to gérant role');

    // 5. Verify assignment
    const verifyResult = await client.query(`
      SELECT p.code
      FROM role_permissions rp
      INNER JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = $1 AND p.code = 'training.certificate_templates.update'
    `, [gerantRoleId]);

    if (verifyResult.rows.length > 0) {
      console.log('✅ VERIFICATION PASSED: training.certificate_templates.update is now assigned to gérant');
    } else {
      throw new Error('Verification failed - permission not assigned');
    }

    await client.query('COMMIT');

    console.log('\n✅ Migration completed successfully!');
    console.log('Khalid Fathi must logout and login again to get the new permission.');

    res.json({
      success: true,
      message: 'Permission training.certificate_templates.update created and assigned to gérant',
      permissionId: permissionId,
      gerantRoleId: gerantRoleId
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

router.get('/status', async (req, res) => {
  try {
    // Check if permission exists
    const permResult = await pool.query(`
      SELECT id FROM permissions
      WHERE code = 'training.certificate_templates.update'
    `);

    if (permResult.rows.length === 0) {
      return res.json({
        status: { migrationNeeded: true, applied: false },
        message: 'Permission training.certificate_templates.update does not exist yet'
      });
    }

    // Check if assigned to gérant
    const assignedResult = await pool.query(`
      SELECT 1
      FROM role_permissions rp
      INNER JOIN permissions p ON rp.permission_id = p.id
      INNER JOIN roles r ON rp.role_id = r.id
      WHERE p.code = 'training.certificate_templates.update'
        AND r.name = 'gerant'
    `);

    const isAssigned = assignedResult.rows.length > 0;

    res.json({
      status: {
        migrationNeeded: !isAssigned,
        applied: isAssigned,
        permissionExists: true,
        assignedToGerant: isAssigned
      },
      message: isAssigned
        ? 'Permission exists and is assigned to gérant'
        : 'Permission exists but not assigned to gérant'
    });

  } catch (error) {
    res.status(500).json({
      status: { migrationNeeded: true, applied: false, error: error.message },
      message: `Error checking status: ${error.message}`
    });
  }
});

export default router;
