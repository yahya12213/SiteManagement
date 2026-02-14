/**
 * Migration 074: Assign ALL Permissions to Gérant Role
 * CRITICAL FIX: Ensures gérant role has complete access to ALL permissions
 * including training.certificate_templates.* that were added after migration 054
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 074: Assign ALL Permissions to Gérant Role ===');

    // 1. Find the gérant role (try multiple variations)
    const gerantRoleResult = await client.query(`
      SELECT id, name FROM roles
      WHERE LOWER(name) IN ('gerant', 'gérant', 'manager', 'gestionnaire')
      LIMIT 1
    `);

    if (gerantRoleResult.rows.length === 0) {
      // Show available roles for debugging
      const allRoles = await client.query(`SELECT id, name FROM roles ORDER BY name`);
      console.log('Available roles:', allRoles.rows.map(r => r.name).join(', '));

      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: `Gérant role not found. Available roles: ${allRoles.rows.map(r => r.name).join(', ')}. Please specify the correct role name or run migration 054 first.`,
        availableRoles: allRoles.rows
      });
    }

    const gerantRoleId = gerantRoleResult.rows[0].id;
    const gerantRoleName = gerantRoleResult.rows[0].name;
    console.log(`  ✓ Found role "${gerantRoleName}" with ID: ${gerantRoleId}`);

    // 2. Get ALL permissions from ALL modules
    const allPermissionsResult = await client.query(`
      SELECT id, code, module, menu, action
      FROM permissions
      ORDER BY module, menu, action
    `);

    console.log(`\n📊 Found ${allPermissionsResult.rows.length} total permissions in database`);

    // 3. Get currently assigned permissions for gérant
    const currentPermsResult = await client.query(`
      SELECT p.code
      FROM role_permissions rp
      INNER JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = $1
    `, [gerantRoleId]);

    const currentPermCodes = new Set(currentPermsResult.rows.map(r => r.code));
    console.log(`  - Currently assigned: ${currentPermCodes.size} permissions`);

    // 4. Find missing permissions
    const missingPermissions = allPermissionsResult.rows.filter(
      perm => !currentPermCodes.has(perm.code)
    );

    console.log(`  - Missing: ${missingPermissions.length} permissions`);

    if (missingPermissions.length > 0) {
      console.log('\n🔧 Missing permissions include:');
      const sampleMissing = missingPermissions.slice(0, 10);
      sampleMissing.forEach(perm => {
        console.log(`    - ${perm.code}`);
      });
      if (missingPermissions.length > 10) {
        console.log(`    ... and ${missingPermissions.length - 10} more`);
      }
    }

    // 5. Assign ALL missing permissions to gérant role
    let assignedCount = 0;

    for (const permission of missingPermissions) {
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [gerantRoleId, permission.id]);
      assignedCount++;
    }

    console.log(`\n✅ Assigned ${assignedCount} new permissions to gérant role`);

    // 6. Verify final permission count for gérant
    const verifyResult = await client.query(`
      SELECT COUNT(*) as total
      FROM role_permissions
      WHERE role_id = $1
    `, [gerantRoleId]);

    const totalPermissions = parseInt(verifyResult.rows[0].total);
    console.log(`📊 Gérant role now has ${totalPermissions} total permissions`);

    // 7. Verify specific certificate templates permissions
    const certTemplatePermsResult = await client.query(`
      SELECT p.code
      FROM role_permissions rp
      INNER JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = $1
        AND p.code LIKE 'training.certificate_templates.%'
      ORDER BY p.code
    `, [gerantRoleId]);

    console.log(`\n✅ Certificate Templates Permissions (${certTemplatePermsResult.rows.length}):`);
    certTemplatePermsResult.rows.forEach(row => {
      console.log(`    ✓ ${row.code}`);
    });

    // 8. List modules with their permission counts
    const moduleCountsResult = await client.query(`
      SELECT p.module, COUNT(*) as count
      FROM role_permissions rp
      INNER JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = $1
      GROUP BY p.module
      ORDER BY p.module
    `, [gerantRoleId]);

    console.log('\n📋 Permissions by module for gérant role:');
    moduleCountsResult.rows.forEach(row => {
      console.log(`    - ${row.module}: ${row.count} permissions`);
    });

    await client.query('COMMIT');

    console.log('\n✅ Migration 074 completed successfully!');
    console.log('Gérant role now has COMPLETE access to ALL modules');

    res.json({
      success: true,
      message: 'Migration 074 completed - ALL permissions assigned to gérant role',
      gerantRoleId: gerantRoleId,
      permissionsAssigned: assignedCount,
      totalPermissions: totalPermissions,
      certificateTemplatePermissions: certTemplatePermsResult.rows.map(r => r.code),
      moduleBreakdown: moduleCountsResult.rows
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 074 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    client.release();
  }
});

// Check migration status
router.get('/status', async (req, res) => {
  try {
    // Check if gérant role exists
    const gerantRoleResult = await pool.query(`
      SELECT id FROM roles WHERE name = 'gerant' LIMIT 1
    `);

    if (gerantRoleResult.rows.length === 0) {
      return res.json({
        status: {
          migrationNeeded: true,
          applied: false
        },
        message: 'Gérant role does not exist yet'
      });
    }

    const gerantRoleId = gerantRoleResult.rows[0].id;

    // Count total available permissions
    const totalPermResult = await pool.query(`
      SELECT COUNT(*) as count FROM permissions
    `);
    const totalAvailablePerms = parseInt(totalPermResult.rows[0].count);

    // Count permissions assigned to gérant
    const gerantPermResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM role_permissions
      WHERE role_id = $1
    `, [gerantRoleId]);
    const gerantPermCount = parseInt(gerantPermResult.rows[0].count);

    // Check if gérant has training.certificate_templates.update permission
    const hasUpdatePerm = await pool.query(`
      SELECT 1
      FROM role_permissions rp
      INNER JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = $1
        AND p.code = 'training.certificate_templates.update'
    `, [gerantRoleId]);

    // Check if gérant has training.certificate_templates.delete permission
    const hasDeletePerm = await pool.query(`
      SELECT 1
      FROM role_permissions rp
      INNER JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = $1
        AND p.code = 'training.certificate_templates.delete'
    `, [gerantRoleId]);

    const hasAllPerms = gerantPermCount >= totalAvailablePerms;
    const hasCriticalPerms = hasUpdatePerm.rows.length > 0 && hasDeletePerm.rows.length > 0;

    const migrationNeeded = !hasAllPerms || !hasCriticalPerms;

    res.json({
      status: {
        migrationNeeded: migrationNeeded,
        applied: !migrationNeeded,
        gerantPermissions: gerantPermCount,
        totalAvailablePermissions: totalAvailablePerms,
        completionPercentage: Math.round((gerantPermCount / totalAvailablePerms) * 100),
        hasCertificateTemplatesUpdate: hasUpdatePerm.rows.length > 0,
        hasCertificateTemplatesDelete: hasDeletePerm.rows.length > 0
      },
      message: migrationNeeded
        ? `Migration needed - Gérant has ${gerantPermCount}/${totalAvailablePerms} permissions (${Math.round((gerantPermCount / totalAvailablePerms) * 100)}%)`
        : 'Migration 074 already applied - Gérant has ALL permissions'
    });

  } catch (error) {
    res.status(500).json({
      status: {
        migrationNeeded: true,
        applied: false,
        error: error.message
      },
      message: `Error checking status: ${error.message}`
    });
  }
});

export default router;
