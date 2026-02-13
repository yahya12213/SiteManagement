/**
 * Migration 076: Fix segment/city view permissions visibility
 *
 * Problem: Migration 075 created permissions with module='system' but code='accounting.*'
 * This causes them to not appear in the Roles UI interface
 *
 * Solution: Delete old permissions and create new ones with correct module/code alignment
 * - system.roles.view_segments → Appears in "Système > Rôles & Permissions"
 * - system.roles.view_cities → Appears in "Système > Rôles & Permissions"
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 076: Fix segment/city permission visibility ===\n');

    // 1. Delete incorrectly configured permissions from Migration 075
    console.log('Step 1: Removing incorrectly configured permissions...');

    const deleteResult = await client.query(`
      DELETE FROM permissions
      WHERE code IN ('accounting.segments.view_page', 'accounting.cities.view_page')
      RETURNING id, code
    `);

    if (deleteResult.rowCount > 0) {
      console.log(`✓ Deleted ${deleteResult.rowCount} old permissions`);
      deleteResult.rows.forEach(row => {
        console.log(`  - ${row.code}`);
      });
    } else {
      console.log('⚠ No old permissions found (already cleaned up)');
    }

    // 2. Create new permissions with correct structure
    console.log('\nStep 2: Creating correctly configured permissions...');

    const permissions = [
      {
        module: 'system',
        menu: 'roles',
        action: 'view_segments',
        code: 'system.roles.view_segments',
        label: 'Voir les segments (dropdowns)',
        description: 'Permet de voir les segments dans les dropdowns de sélection (requis pour React Query)',
        sort_order: 505
      },
      {
        module: 'system',
        menu: 'roles',
        action: 'view_cities',
        code: 'system.roles.view_cities',
        label: 'Voir les villes (dropdowns)',
        description: 'Permet de voir les villes dans les dropdowns de sélection (requis pour React Query)',
        sort_order: 506
      }
    ];

    for (const perm of permissions) {
      const result = await client.query(`
        INSERT INTO permissions (module, menu, action, code, label, description, sort_order, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (code) DO NOTHING
        RETURNING id
      `, [perm.module, perm.menu, perm.action, perm.code, perm.label, perm.description, perm.sort_order]);

      if (result.rowCount > 0) {
        console.log(`✓ Created permission: ${perm.code}`);
      } else {
        console.log(`⚠ Permission already exists: ${perm.code}`);
      }
    }

    // 3. Assign permissions to all roles
    console.log('\nStep 3: Assigning permissions to all roles...');

    const rolesResult = await client.query('SELECT id, name FROM roles');

    for (const role of rolesResult.rows) {
      for (const perm of permissions) {
        const permIdResult = await client.query(
          'SELECT id FROM permissions WHERE code = $1',
          [perm.code]
        );

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

    console.log('\n✅ Migration 076 completed successfully!');
    console.log('Permissions are now visible in Système > Rôles & Permissions in the UI');

    res.json({
      success: true,
      message: 'Permission visibility fixed - now visible in System module',
      permissions: permissions.map(p => p.code),
      rolesUpdated: rolesResult.rows.length
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 076 failed:', error);
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
      WHERE code IN ('system.roles.view_segments', 'system.roles.view_cities')
    `);

    const applied = result.rows.length === 2;

    res.json({
      status: {
        migrationNeeded: !applied,
        applied
      },
      message: applied
        ? 'System permissions exist and are visible in UI'
        : 'Run migration to fix permission visibility in Roles interface'
    });
  } catch (error) {
    res.status(500).json({
      status: { migrationNeeded: true, applied: false, error: error.message },
      message: `Error checking status: ${error.message}`
    });
  }
});

export default router;
