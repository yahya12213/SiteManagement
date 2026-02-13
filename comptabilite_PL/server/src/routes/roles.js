/**
 * Roles and Permissions Management API Routes
 * Allows admin users to create, modify, and assign roles and permissions
 */

import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireRole, requirePermission, EN_TO_FR_PERMISSION_MAP, EN_TO_FR_ACTION_MAP } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/roles
 * Get all roles with their permission counts
 */
router.get('/', requirePermission('system.roles.view_page'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        r.*,
        COUNT(DISTINCT rp.permission_id) as permission_count,
        COUNT(DISTINCT p.id) as user_count
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      LEFT JOIN profiles p ON p.role_id = r.id
      GROUP BY r.id
      ORDER BY r.is_system_role DESC, r.name ASC
    `);

    res.json({
      success: true,
      roles: result.rows,
    });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/roles/validate-mappings
 * Validate that all EN permission codes map correctly to FR codes in the database
 */
router.get('/validate-mappings', requirePermission('system.roles.view_page'), async (req, res) => {
  try {
    // Liste de TOUS les codes EN utilisés dans les routes backend
    const ROUTE_PERMISSIONS = [
      // sessions-formation.js
      'training.sessions.view_page',
      'training.sessions.create',
      'training.sessions.update',
      'training.sessions.delete',
      'training.sessions.add_student',
      'training.sessions.edit_student',
      'training.sessions.remove_student',
      'training.sessions.delete_payment',
      'training.sessions.transfer_student',
      // formations/cours.js
      'training.formations.view_page',
      'training.formations.create',
      'training.formations.update',
      'training.formations.delete',
      'training.formations.edit_content',
      'training.formations.create_pack',
      'training.formations.duplicate',
      // students.js
      'training.students.view_page',
      'training.students.create',
      'training.students.update',
      'training.students.delete',
      // certificate-templates.js
      'training.certificate_templates.view_page',
      'training.certificate_templates.create',
      'training.certificate_templates.update',
      'training.certificate_templates.delete',
      // certificates.js
      'training.certificates.view_page',
      'training.certificates.view',
      'training.certificates.generate',
      'training.certificates.update',
      'training.certificates.delete',
      // forums.js
      'training.forums.view_page',
      'training.forums.view',
      'training.forums.create_thread',
      'training.forums.update_thread',
      'training.forums.reply',
      'training.forums.delete',
      'training.forums.manage',
      'training.forums.react',
      // analytics.js
      'training.analytics.view_page',
      // centres.js
      'training.centres.view_page',
      'training.centres.create',
      // corps-formation.js
      'training.corps.view_page',
      'training.corps.create',
      'training.corps.update',
      'training.corps.delete',
      // hr-attendance.js
      'hr.attendance.view_page',
      'hr.attendance.create',
      'hr.attendance.edit',
      'hr.attendance.approve_overtime',
      'hr.attendance.reject_overtime',
      // hr-leaves.js
      'hr.leaves.view_page',
      'hr.leaves.create',
      'hr.leaves.approve',
      'hr.leaves.edit',
      // hr-dashboard.js
      'hr.dashboard.view_page',
      // hr-settings.js
      'hr.settings.view_page',
      'hr.settings.edit',
      // hr-validation-workflows.js
      'hr.validation_workflows.view_page',
      // hr-public-holidays.js
      'hr.holidays.view_page',
      'hr.holidays.manage',
      // accounting - declarations.js
      'accounting.declarations.view_page',
      'accounting.declarations.view_all',
      'accounting.declarations.create',
      'accounting.declarations.fill_data',
      'accounting.declarations.edit_metadata',
      'accounting.declarations.approve',
      'accounting.declarations.delete',
      // accounting - cities.js
      'accounting.cities.create',
      'accounting.cities.update',
      'accounting.cities.delete',
      // accounting - segments.js
      'accounting.segments.create',
      'accounting.segments.update',
      'accounting.segments.delete',
      // accounting - calculationSheets.js
      'accounting.calculation_sheets.create',
      'accounting.calculation_sheets.update',
      'accounting.calculation_sheets.delete',
      'accounting.calculation_sheets.publish',
      // accounting - admin.js (dashboard)
      'accounting.dashboard.view_page',
      // system
      'system.roles.view_page',
    ];

    // Fonction de conversion (même logique que auth.js)
    function convertToFrench(code) {
      let converted = code;

      const sortedPrefixes = Object.entries(EN_TO_FR_PERMISSION_MAP)
        .sort((a, b) => b[0].length - a[0].length);

      for (const [en, fr] of sortedPrefixes) {
        if (converted.includes(en)) {
          converted = converted.replace(en, fr);
          break;
        }
      }

      const sortedActions = Object.entries(EN_TO_FR_ACTION_MAP)
        .sort((a, b) => b[0].length - a[0].length);

      for (const [en, fr] of sortedActions) {
        if (converted.endsWith(en)) {
          converted = converted.slice(0, -en.length) + fr;
          break;
        }
      }

      return converted;
    }

    // Récupérer tous les codes de la DB
    const { rows } = await pool.query('SELECT code FROM permissions');
    const dbCodes = new Set(rows.map(r => r.code));

    // Valider chaque permission
    const results = [];
    let errors = 0;

    for (const enCode of ROUTE_PERMISSIONS) {
      const frCode = convertToFrench(enCode);
      const exists = dbCodes.has(frCode);

      if (!exists) {
        errors++;
        results.push({
          en: enCode,
          fr: frCode,
          status: 'error',
          message: 'Code FR non trouvé dans la DB'
        });
      }
    }

    res.json({
      success: true,
      data: {
        total: ROUTE_PERMISSIONS.length,
        errors,
        valid: ROUTE_PERMISSIONS.length - errors,
        details: results
      }
    });

  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/roles/:id
 * Get a specific role with its permissions
 */
router.get('/:id', requirePermission('system.roles.view_page'), async (req, res) => {
  try {
    const { id } = req.params;

    const roleResult = await pool.query('SELECT * FROM roles WHERE id = $1', [id]);
    if (roleResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Role not found',
      });
    }

    const permissionsResult = await pool.query(`
      SELECT p.*
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = $1
      ORDER BY p.module, p.name
    `, [id]);

    const usersResult = await pool.query(`
      SELECT id, username, full_name
      FROM profiles
      WHERE role_id = $1
      ORDER BY full_name
    `, [id]);

    res.json({
      success: true,
      role: roleResult.rows[0],
      permissions: permissionsResult.rows,
      users: usersResult.rows,
    });
  } catch (error) {
    console.error('Error fetching role:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/roles
 * Create a new role
 */
router.post('/', requirePermission('system.roles.create'), async (req, res) => {
  const client = await pool.connect();

  try {
    const { name, description, permission_ids } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Role name is required',
      });
    }

    await client.query('BEGIN');

    // Create the role
    const roleResult = await client.query(
      `INSERT INTO roles (name, description, is_system_role)
       VALUES ($1, $2, false)
       RETURNING *`,
      [name.trim(), description || null]
    );

    const newRole = roleResult.rows[0];

    // Assign permissions if provided
    if (permission_ids && Array.isArray(permission_ids) && permission_ids.length > 0) {
      for (const permId of permission_ids) {
        await client.query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
          [newRole.id, permId]
        );
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      role: newRole,
      message: 'Role created successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'A role with this name already exists',
      });
    }

    console.error('Error creating role:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/roles/:id
 * Update a role's details and permissions
 */
router.put('/:id', requirePermission('system.roles.update'), async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { name, description, permission_ids } = req.body;

    // Check if role exists and is not a system role
    const existingRole = await client.query('SELECT * FROM roles WHERE id = $1', [id]);
    if (existingRole.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Role not found',
      });
    }

    if (existingRole.rows[0].is_system_role && name !== existingRole.rows[0].name) {
      return res.status(400).json({
        success: false,
        error: 'Cannot rename system roles',
      });
    }

    await client.query('BEGIN');

    // Update role details
    const updateResult = await client.query(
      `UPDATE roles
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [name?.trim(), description, id]
    );

    // Update permissions if provided
    if (permission_ids && Array.isArray(permission_ids)) {
      // Remove existing permissions
      await client.query('DELETE FROM role_permissions WHERE role_id = $1', [id]);

      // Add new permissions
      for (const permId of permission_ids) {
        await client.query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
          [id, permId]
        );
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      role: updateResult.rows[0],
      message: 'Role updated successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');

    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        error: 'A role with this name already exists',
      });
    }

    console.error('Error updating role:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/roles/:id
 * Delete a role (only non-system roles with no users)
 */
router.delete('/:id', requirePermission('system.roles.delete'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if role exists and is not a system role
    const roleResult = await pool.query('SELECT * FROM roles WHERE id = $1', [id]);
    if (roleResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Role not found',
      });
    }

    if (roleResult.rows[0].is_system_role) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete system roles',
      });
    }

    // Check if any users have this role
    const usersResult = await pool.query('SELECT COUNT(*) FROM profiles WHERE role_id = $1', [id]);
    if (parseInt(usersResult.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete role that is assigned to users. Reassign users first.',
      });
    }

    // Delete the role (role_permissions will be cascaded)
    await pool.query('DELETE FROM roles WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/roles/:id/duplicate
 * Duplicate a role with all its permissions
 */
router.post('/:id/duplicate', requirePermission('system.roles.create'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { name, description } = req.body;

    // Check if source role exists
    const sourceRoleResult = await client.query('SELECT * FROM roles WHERE id = $1', [id]);
    if (sourceRoleResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Rôle source introuvable',
      });
    }

    const sourceRole = sourceRoleResult.rows[0];

    // Generate new name if not provided
    const newName = name || `${sourceRole.name} (copie)`;

    // Check if new name already exists
    const existingRole = await client.query('SELECT id FROM roles WHERE name = $1', [newName]);
    if (existingRole.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Un rôle avec le nom "${newName}" existe déjà`,
      });
    }

    await client.query('BEGIN');

    // 1. Create the new role
    const newRoleResult = await client.query(`
      INSERT INTO roles (name, description, is_system_role, created_at, updated_at)
      VALUES ($1, $2, false, NOW(), NOW())
      RETURNING *
    `, [newName, description || sourceRole.description]);

    const newRole = newRoleResult.rows[0];

    // 2. Copy all permissions from source role to new role
    const permissionsCopyResult = await client.query(`
      INSERT INTO role_permissions (role_id, permission_id, granted_at)
      SELECT $1, permission_id, NOW()
      FROM role_permissions
      WHERE role_id = $2
      RETURNING permission_id
    `, [newRole.id, sourceRole.id]);

    await client.query('COMMIT');

    console.log(`✅ Role duplicated: "${sourceRole.name}" -> "${newRole.name}" with ${permissionsCopyResult.rowCount} permissions`);

    res.json({
      success: true,
      message: `Rôle dupliqué avec succès`,
      role: newRole,
      permissions_count: permissionsCopyResult.rowCount,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error duplicating role:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    client.release();
  }
});

/**
 * GET /api/roles/permissions/all
 * Get all available permissions grouped by module
 */
router.get('/permissions/all', requirePermission('system.roles.view_page'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM permissions
      ORDER BY module, name
    `);

    // Group by module
    const grouped = {};
    for (const perm of result.rows) {
      if (!grouped[perm.module]) {
        grouped[perm.module] = [];
      }
      grouped[perm.module].push(perm);
    }

    res.json({
      success: true,
      permissions: result.rows,
      grouped,
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * PUT /api/roles/user/:userId/role
 * Assign a role to a user
 */
router.put('/user/:userId/role', requirePermission('accounting.users.assign_roles'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { role_id } = req.body;

    if (!role_id) {
      return res.status(400).json({
        success: false,
        error: 'role_id is required',
      });
    }

    // Check if role exists
    const roleExists = await pool.query('SELECT * FROM roles WHERE id = $1', [role_id]);
    if (roleExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Role not found',
      });
    }

    // Update user's role
    const result = await pool.query(
      `UPDATE profiles
       SET role_id = $1, role = $2
       WHERE id = $3
       RETURNING id, username, full_name, role, role_id`,
      [role_id, roleExists.rows[0].name, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    res.json({
      success: true,
      user: result.rows[0],
      message: 'User role updated successfully',
    });
  } catch (error) {
    console.error('Error assigning role to user:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
