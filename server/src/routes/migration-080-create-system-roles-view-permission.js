/**
 * Migration 080: Créer et assigner system.roles.view_page si manquante
 *
 * Problème: Le diagnostic des permissions nécessite system.roles.view_page
 * mais cette permission n'existe peut-être pas ou n'est pas assignée à admin
 *
 * Solution: Créer la permission et l'assigner à admin ET gerant
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🔧 Migration 080: Creating system.roles.view_page permission...');

    // Step 1: Create or update the permission
    const permissionResult = await client.query(`
      INSERT INTO permissions (module, menu, action, code, label, description, sort_order, created_at)
      VALUES ('system', 'roles', 'view_page', 'system.roles.view_page', 'Voir la page des rôles', 'Permet d''accéder à la page de diagnostic des permissions', 900, NOW())
      ON CONFLICT (code) DO UPDATE SET
        label = EXCLUDED.label,
        description = EXCLUDED.description,
        sort_order = EXCLUDED.sort_order
      RETURNING id, code, (xmax = 0) AS inserted
    `);

    const permission = permissionResult.rows[0];
    const wasInserted = permission.inserted;

    console.log(`${wasInserted ? '✅ Created' : '✅ Updated'} permission: ${permission.code}`);

    // Step 2: Get admin role
    const adminRoleResult = await client.query(`
      SELECT id FROM roles WHERE name = 'admin' LIMIT 1
    `);

    if (adminRoleResult.rows.length === 0) {
      throw new Error('Admin role not found in database!');
    }

    const adminRoleId = adminRoleResult.rows[0].id;

    // Step 3: Assign to admin role
    const adminAssignResult = await client.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      RETURNING *
    `, [adminRoleId, permission.id]);

    const adminWasAssigned = adminAssignResult.rowCount > 0;
    console.log(`${adminWasAssigned ? '✅ Assigned' : 'ℹ️  Already assigned'} to admin role`);

    // Step 4: Get gerant role (if exists)
    const gerantRoleResult = await client.query(`
      SELECT id FROM roles WHERE name = 'gerant' LIMIT 1
    `);

    if (gerantRoleResult.rows.length > 0) {
      const gerantRoleId = gerantRoleResult.rows[0].id;

      // Assign to gerant role
      const gerantAssignResult = await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
        RETURNING *
      `, [gerantRoleId, permission.id]);

      const gerantWasAssigned = gerantAssignResult.rowCount > 0;
      console.log(`${gerantWasAssigned ? '✅ Assigned' : 'ℹ️  Already assigned'} to gerant role`);
    }

    // Step 5: Verify admin user has access
    const adminUsersCheck = await client.query(`
      SELECT
        p.id,
        p.username,
        p.role,
        p.role_id,
        r.name as role_name,
        EXISTS (
          SELECT 1 FROM role_permissions rp
          WHERE rp.role_id = p.role_id
            AND rp.permission_id = $1
        ) as has_permission
      FROM profiles p
      INNER JOIN roles r ON p.role_id = r.id
      WHERE r.name = 'admin'
    `, [permission.id]);

    console.log('👥 Admin users verification:');
    adminUsersCheck.rows.forEach(user => {
      console.log(`   - ${user.username}: has_permission = ${user.has_permission}`);
    });

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 080 completed successfully',
      details: {
        permissionCreated: wasInserted,
        permissionId: permission.id,
        assignedToAdmin: adminWasAssigned,
        adminUsers: adminUsersCheck.rows,
        allHaveAccess: adminUsersCheck.rows.every(u => u.has_permission)
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 080 error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  } finally {
    client.release();
  }
});

// Check migration status
router.get('/status', async (req, res) => {
  try {
    // Check if system.roles.view_page exists
    const permissionResult = await pool.query(`
      SELECT id, code FROM permissions
      WHERE code = 'system.roles.view_page'
    `);

    const permissionExists = permissionResult.rows.length > 0;

    if (!permissionExists) {
      return res.json({
        status: {
          migrationNeeded: true,
          applied: false,
          permissionExists: false
        },
        message: 'Migration needed - system.roles.view_page permission does not exist'
      });
    }

    const permissionId = permissionResult.rows[0].id;

    // Check if assigned to admin role
    const adminAssignCheck = await pool.query(`
      SELECT rp.*
      FROM role_permissions rp
      INNER JOIN roles r ON r.id = rp.role_id
      WHERE r.name = 'admin' AND rp.permission_id = $1
    `, [permissionId]);

    const assignedToAdmin = adminAssignCheck.rows.length > 0;

    res.json({
      status: {
        migrationNeeded: !assignedToAdmin,
        applied: assignedToAdmin,
        permissionExists: true,
        assignedToAdmin: assignedToAdmin
      },
      message: assignedToAdmin
        ? 'system.roles.view_page exists and is assigned to admin'
        : 'Migration needed - permission exists but not assigned to admin role'
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
