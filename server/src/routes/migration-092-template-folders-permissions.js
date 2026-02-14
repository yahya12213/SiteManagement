/**
 * Migration 092 - Add template_folders permissions to gérant role
 *
 * The gérant role has training.certificate_templates.* permissions but
 * is missing training.template_folders.* permissions needed to create,
 * update, and delete folders in the certificate templates page.
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting Migration 092 - Add template_folders permissions to gérant...');
    await client.query('BEGIN');

    // Permissions to add
    const permissionsToAdd = [
      {
        code: 'training.template_folders.create',
        name: 'Créer un dossier',
        module: 'training',
        description: 'Créer un dossier dans les templates de certificats'
      },
      {
        code: 'training.template_folders.update',
        name: 'Renommer un dossier',
        module: 'training',
        description: 'Renommer un dossier dans les templates de certificats'
      },
      {
        code: 'training.template_folders.delete',
        name: 'Supprimer un dossier',
        module: 'training',
        description: 'Supprimer un dossier dans les templates de certificats'
      },
      {
        code: 'training.template_folders.view',
        name: 'Voir les dossiers',
        module: 'training',
        description: 'Voir les dossiers de templates de certificats'
      }
    ];

    // Step 1: Create permissions if they don't exist
    console.log('  📦 Creating permissions if missing...');
    const permissionIds = [];

    for (const perm of permissionsToAdd) {
      // Check if permission exists
      let permResult = await client.query(
        'SELECT id FROM permissions WHERE code = $1',
        [perm.code]
      );

      if (permResult.rows.length === 0) {
        // Create the permission
        permResult = await client.query(
          `INSERT INTO permissions (code, name, module, description)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [perm.code, perm.name, perm.module, perm.description]
        );
        console.log(`    ✅ Created permission: ${perm.code}`);
      } else {
        console.log(`    ℹ️ Permission exists: ${perm.code}`);
      }

      permissionIds.push({
        id: permResult.rows[0].id,
        code: perm.code
      });
    }

    // Step 2: Get gérant role ID
    const gerantResult = await client.query(
      "SELECT id FROM roles WHERE LOWER(name) = 'gerant'"
    );

    if (gerantResult.rows.length === 0) {
      throw new Error('Role "gerant" not found in database');
    }

    const gerantRoleId = gerantResult.rows[0].id;
    console.log(`  📋 Found gérant role: ${gerantRoleId}`);

    // Step 3: Assign permissions to gérant
    console.log('  📦 Assigning permissions to gérant...');
    let assignedCount = 0;

    for (const perm of permissionIds) {
      const result = await client.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         VALUES ($1, $2)
         ON CONFLICT (role_id, permission_id) DO NOTHING
         RETURNING role_id`,
        [gerantRoleId, perm.id]
      );

      if (result.rows.length > 0) {
        console.log(`    ✅ Assigned: ${perm.code}`);
        assignedCount++;
      } else {
        console.log(`    ℹ️ Already assigned: ${perm.code}`);
      }
    }

    // Step 4: Also assign to admin role
    const adminResult = await client.query(
      "SELECT id FROM roles WHERE LOWER(name) = 'admin'"
    );

    if (adminResult.rows.length > 0) {
      const adminRoleId = adminResult.rows[0].id;
      console.log('  📦 Assigning permissions to admin...');

      for (const perm of permissionIds) {
        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           VALUES ($1, $2)
           ON CONFLICT (role_id, permission_id) DO NOTHING`,
          [adminRoleId, perm.id]
        );
      }
    }

    await client.query('COMMIT');

    console.log('✅ Migration 092 completed!');
    console.log(`  - ${permissionIds.length} permissions verified/created`);
    console.log(`  - ${assignedCount} new permissions assigned to gérant`);

    res.json({
      success: true,
      message: 'Template folders permissions added to gérant',
      details: {
        permissionsCreated: permissionIds.map(p => p.code),
        assignedToGerant: assignedCount,
        gerantRoleId: gerantRoleId
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 092 failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Check current status
router.get('/status', async (req, res) => {
  try {
    // Check if gérant has template_folders permissions
    const result = await pool.query(`
      SELECT
        p.code,
        CASE WHEN rp.role_id IS NOT NULL THEN true ELSE false END as assigned
      FROM permissions p
      LEFT JOIN role_permissions rp ON rp.permission_id = p.id
        AND rp.role_id = (SELECT id FROM roles WHERE LOWER(name) = 'gerant')
      WHERE p.code LIKE 'training.template_folders.%'
      ORDER BY p.code
    `);

    const missingPermissions = result.rows.filter(r => !r.assigned);
    const needsRun = missingPermissions.length > 0;

    res.json({
      success: true,
      applied: !needsRun,
      needsRun: needsRun,
      message: needsRun
        ? `Missing ${missingPermissions.length} template_folders permissions for gérant`
        : 'All template_folders permissions assigned to gérant',
      details: {
        permissions: result.rows,
        missing: missingPermissions.map(p => p.code)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
