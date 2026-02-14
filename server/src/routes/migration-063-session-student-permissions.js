/**
 * Migration 063: Add session student permissions
 * Creates dedicated permissions for adding and editing students in sessions
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Add new permissions for session student management
    const permissions = [
      {
        module: 'training',
        menu: 'sessions',
        action: 'add_student',
        code: 'training.sessions.add_student',
        label: 'Ajouter étudiant',
        description: 'Inscrire un étudiant à une session de formation',
        sort_order: 50
      },
      {
        module: 'training',
        menu: 'sessions',
        action: 'edit_student',
        code: 'training.sessions.edit_student',
        label: 'Modifier étudiant',
        description: 'Modifier l\'inscription d\'un étudiant dans une session',
        sort_order: 51
      },
    ];

    for (const perm of permissions) {
      await client.query(`
        INSERT INTO permissions (module, menu, action, code, label, description, sort_order, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (code) DO NOTHING
      `, [perm.module, perm.menu, perm.action, perm.code, perm.label, perm.description, perm.sort_order]);
    }
    console.log('✅ Session student permissions added');

    // Get the permission IDs we just inserted
    const permissionIds = await client.query(`
      SELECT id, code FROM permissions
      WHERE code IN ('training.sessions.add_student', 'training.sessions.edit_student')
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
      message: 'Migration 063 completed successfully',
      permissions: permissions.map(p => p.code)
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 063 error:', error);
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
      WHERE code IN ('training.sessions.add_student', 'training.sessions.edit_student')
    `);

    const allPermissionsExist = permissionsResult.rows.length === 2;

    res.json({
      status: {
        migrationNeeded: !allPermissionsExist,
        applied: allPermissionsExist,
        existingPermissions: permissionsResult.rows.map(r => r.code)
      },
      message: allPermissionsExist
        ? 'Migration 063 already applied - permissions exist'
        : 'Migration needed - session student permissions missing'
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
