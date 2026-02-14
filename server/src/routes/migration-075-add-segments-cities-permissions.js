/**
 * Migration 075: Add segments and cities view_page permissions
 * These permissions are required for frontend hooks (useSegments, useCities)
 * to enable React Query data fetching for dropdown selections
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 075: Adding segments and cities view_page permissions ===\n');

    // 1. Check if permissions already exist
    const existingPerms = await client.query(`
      SELECT code FROM permissions
      WHERE code IN ('accounting.segments.view_page', 'accounting.cities.view_page')
    `);

    if (existingPerms.rows.length > 0) {
      console.log('⚠ Permissions already exist, skipping creation');
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'Permissions already exist'
      });
    }

    // 2. Insert new permissions in system module
    const permissions = [
      {
        module: 'system',
        menu: 'roles',
        action: 'view_segments',
        code: 'accounting.segments.view_page',
        label: 'Voir les segments (dropdowns)',
        sort_order: 504
      },
      {
        module: 'system',
        menu: 'roles',
        action: 'view_cities',
        code: 'accounting.cities.view_page',
        label: 'Voir les villes (dropdowns)',
        sort_order: 505
      }
    ];

    for (const perm of permissions) {
      await client.query(`
        INSERT INTO permissions (module, menu, action, code, label, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (code) DO NOTHING
      `, [perm.module, perm.menu, perm.action, perm.code, perm.label, perm.sort_order]);

      console.log(`✓ Created permission: ${perm.code}`);
    }

    // 3. Get all role IDs (admin, professor, gerant)
    const rolesResult = await client.query(`
      SELECT id, name FROM roles
    `);

    // 4. Assign permissions to all roles
    for (const role of rolesResult.rows) {
      for (const perm of permissions) {
        const permIdResult = await client.query(`
          SELECT id FROM permissions WHERE code = $1
        `, [perm.code]);

        if (permIdResult.rows.length > 0) {
          const permId = permIdResult.rows[0].id;

          await client.query(`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT (role_id, permission_id) DO NOTHING
          `, [role.id, permId]);

          console.log(`✓ Assigned ${perm.code} to role ${role.name}`);
        }
      }
    }

    await client.query('COMMIT');

    console.log('\n✅ Migration 075 completed successfully!');
    console.log('Segments and cities view permissions have been created and assigned to all roles.');

    res.json({
      success: true,
      message: 'Segments and cities view_page permissions added successfully',
      permissions: permissions.map(p => p.code),
      rolesUpdated: rolesResult.rows.length
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 075 failed:', error);
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
    const result = await pool.query(`
      SELECT code FROM permissions
      WHERE code IN ('accounting.segments.view_page', 'accounting.cities.view_page')
    `);

    const applied = result.rows.length === 2;

    res.json({
      status: {
        migrationNeeded: !applied,
        applied
      },
      message: applied
        ? 'Segments and cities view_page permissions exist'
        : 'Permissions missing - run migration to fix segments/cities dropdown access'
    });
  } catch (error) {
    res.status(500).json({
      status: { migrationNeeded: true, applied: false, error: error.message },
      message: `Error checking status: ${error.message}`
    });
  }
});

export default router;
