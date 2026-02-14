/**
 * Migration 065: Add professor management permissions
 * Creates permissions for managing professors in the training module
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Add new permissions for professor management
    const permissions = [
      {
        module: 'training',
        menu: 'professors',
        action: 'view_page',
        code: 'training.professors.view_page',
        label: 'Voir la page des professeurs',
        description: 'Permet d\'accéder à la liste des professeurs',
        sort_order: 100
      },
      {
        module: 'training',
        menu: 'professors',
        action: 'create',
        code: 'training.professors.create',
        label: 'Créer un professeur',
        description: 'Permet de créer un nouveau compte professeur',
        sort_order: 101
      },
      {
        module: 'training',
        menu: 'professors',
        action: 'edit',
        code: 'training.professors.edit',
        label: 'Modifier un professeur',
        description: 'Permet de modifier les informations d\'un professeur',
        sort_order: 102
      },
      {
        module: 'training',
        menu: 'professors',
        action: 'delete',
        code: 'training.professors.delete',
        label: 'Supprimer un professeur',
        description: 'Permet de supprimer définitivement un compte professeur',
        sort_order: 103
      },
      {
        module: 'training',
        menu: 'professors',
        action: 'assign_segments',
        code: 'training.professors.assign_segments',
        label: 'Affecter des segments',
        description: 'Permet d\'attribuer des segments à un professeur',
        sort_order: 104
      },
      {
        module: 'training',
        menu: 'professors',
        action: 'assign_cities',
        code: 'training.professors.assign_cities',
        label: 'Affecter des villes',
        description: 'Permet d\'attribuer des villes à un professeur',
        sort_order: 105
      },
    ];

    for (const perm of permissions) {
      await client.query(`
        INSERT INTO permissions (module, menu, action, code, label, description, sort_order, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (code) DO UPDATE SET
          label = EXCLUDED.label,
          description = EXCLUDED.description,
          sort_order = EXCLUDED.sort_order
      `, [perm.module, perm.menu, perm.action, perm.code, perm.label, perm.description, perm.sort_order]);
    }
    console.log('✅ Professor permissions added');

    // Get the permission IDs we just inserted
    const permissionIds = await client.query(`
      SELECT id, code FROM permissions
      WHERE code LIKE 'training.professors.%'
    `);

    // Auto-assign to admin role
    const adminRoleResult = await client.query(
      "SELECT id FROM roles WHERE name = 'admin' LIMIT 1"
    );

    if (adminRoleResult.rows.length > 0) {
      const adminRoleId = adminRoleResult.rows[0].id;

      for (const perm of permissionIds.rows) {
        await client.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [adminRoleId, perm.id]);
      }
      console.log('✅ Permissions assigned to admin role');
    }

    // Auto-assign to gerant role if exists
    const gerantRoleResult = await client.query(
      "SELECT id FROM roles WHERE name = 'gerant' LIMIT 1"
    );

    if (gerantRoleResult.rows.length > 0) {
      const gerantRoleId = gerantRoleResult.rows[0].id;

      for (const perm of permissionIds.rows) {
        await client.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [gerantRoleId, perm.id]);
      }
      console.log('✅ Permissions assigned to gerant role');
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 065 completed successfully',
      permissions: permissions.map(p => p.code)
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 065 error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Check migration status
router.get('/status', async (req, res) => {
  try {
    const permissionsResult = await pool.query(`
      SELECT code FROM permissions
      WHERE code LIKE 'training.professors.%'
    `);

    const allPermissionsExist = permissionsResult.rows.length >= 6;

    res.json({
      status: {
        migrationNeeded: !allPermissionsExist,
        applied: allPermissionsExist,
        existingPermissions: permissionsResult.rows.map(r => r.code)
      },
      message: allPermissionsExist
        ? 'Migration 065 already applied - professor permissions exist'
        : 'Migration needed - professor permissions missing'
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
