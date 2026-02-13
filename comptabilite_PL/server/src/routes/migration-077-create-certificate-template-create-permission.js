/**
 * Migration 077: Create missing training.certificate_templates.create permission
 *
 * Problem: Backend route requires 'training.certificate_templates.create' but this permission
 * was never created. Migration 040 created 'create_template' instead, and Migration 064
 * only UPDATES labels (doesn't INSERT missing permissions).
 *
 * This causes gérants to get "Access denied. Required permission: training.certificate_templates.create"
 * even though they have the UI permission visible (which was just a label update attempt on non-existent perm).
 *
 * Solution: Create the permission and assign it to all roles.
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 077: Create certificate template create permission ===\n');

    // 1. Check if permission already exists
    console.log('Step 1: Checking if permission exists...');
    const existingPerm = await client.query(`
      SELECT id, code
      FROM permissions
      WHERE code = 'training.certificate_templates.create'
    `);

    if (existingPerm.rows.length > 0) {
      console.log('⚠ Permission already exists, skipping creation');
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'Permission already exists',
        permissionId: existingPerm.rows[0].id
      });
    }

    console.log('✓ Permission does not exist, proceeding with creation\n');

    // 2. Create the permission
    console.log('Step 2: Creating permission...');

    const permissionData = {
      module: 'training',
      menu: 'certificate_templates',
      action: 'create',
      code: 'training.certificate_templates.create',
      label: 'Créer un template',
      description: 'Permet de créer un nouveau modèle de certificat',
      sort_order: 1501
    };

    const createResult = await client.query(`
      INSERT INTO permissions (module, menu, action, code, label, description, sort_order, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      RETURNING id, code
    `, [
      permissionData.module,
      permissionData.menu,
      permissionData.action,
      permissionData.code,
      permissionData.label,
      permissionData.description,
      permissionData.sort_order
    ]);

    const newPermId = createResult.rows[0].id;
    console.log(`✓ Created permission: ${permissionData.code} (ID: ${newPermId})\n`);

    // 3. Get all roles
    console.log('Step 3: Getting all roles...');
    const rolesResult = await client.query('SELECT id, name FROM roles');
    console.log(`✓ Found ${rolesResult.rows.length} roles\n`);

    // 4. Assign permission to all roles
    console.log('Step 4: Assigning permission to all roles...');
    let assignedCount = 0;

    for (const role of rolesResult.rows) {
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
        ON CONFLICT (role_id, permission_id) DO NOTHING
      `, [role.id, newPermId]);

      console.log(`✓ Assigned to role: ${role.name}`);
      assignedCount++;
    }

    console.log(`\n✓ Permission assigned to ${assignedCount} roles\n`);

    // 5. Verify assignment for gérant role specifically
    console.log('Step 5: Verifying gérant role assignment...');
    const gerantCheck = await client.query(`
      SELECT r.name, p.code
      FROM role_permissions rp
      JOIN roles r ON r.id = rp.role_id
      JOIN permissions p ON p.id = rp.permission_id
      WHERE r.name = 'gerant'
        AND p.code = 'training.certificate_templates.create'
    `);

    if (gerantCheck.rows.length > 0) {
      console.log('✓ Gérant role has the permission\n');
    } else {
      console.log('❌ WARNING: Gérant role does NOT have the permission!\n');
    }

    await client.query('COMMIT');

    console.log('=== Migration 077 completed successfully! ===');
    console.log('\n📋 Summary:');
    console.log(`  - Permission created: ${permissionData.code}`);
    console.log(`  - Permission ID: ${newPermId}`);
    console.log(`  - Assigned to ${assignedCount} roles`);
    console.log('\n⚠ IMPORTANT: Users must logout and login again to get this permission in their JWT token.\n');

    res.json({
      success: true,
      message: 'Certificate template create permission created and assigned to all roles',
      permission: {
        id: newPermId,
        code: permissionData.code,
        label: permissionData.label
      },
      rolesUpdated: assignedCount
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 077 failed:', error);
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
      SELECT id, code, label
      FROM permissions
      WHERE code = 'training.certificate_templates.create'
    `);

    const permissionExists = permResult.rows.length > 0;

    // If permission exists, check if it's assigned to gérant role
    let gerantHasPermission = false;
    if (permissionExists) {
      const gerantCheck = await pool.query(`
        SELECT COUNT(*) as count
        FROM role_permissions rp
        JOIN roles r ON r.id = rp.role_id
        JOIN permissions p ON p.id = rp.permission_id
        WHERE r.name = 'gerant'
          AND p.code = 'training.certificate_templates.create'
      `);

      gerantHasPermission = parseInt(gerantCheck.rows[0].count) > 0;
    }

    const applied = permissionExists && gerantHasPermission;

    res.json({
      status: {
        migrationNeeded: !applied,
        applied,
        permissionExists,
        gerantHasPermission
      },
      message: applied
        ? 'Permission exists and is assigned to gérant role'
        : !permissionExists
        ? 'Permission missing - run migration to create it'
        : 'Permission exists but not assigned to gérant - run migration to fix'
    });
  } catch (error) {
    res.status(500).json({
      status: { migrationNeeded: true, applied: false, error: error.message },
      message: `Error checking status: ${error.message}`
    });
  }
});

export default router;
