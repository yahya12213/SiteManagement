/**
 * Migration DEBUG: Analyze khalid fathi user role and permissions
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.get('/status', async (req, res) => {
  try {
    const report = {
      user: null,
      role: null,
      totalPermissions: 0,
      certificateTemplatePermissions: [],
      hasUpdatePermission: false,
      allRoles: []
    };

    // 1. Find the user
    const userResult = await pool.query(`
      SELECT id, username, role, role_id
      FROM profiles
      WHERE LOWER(username) LIKE '%khalid%'
    `);

    if (userResult.rows.length === 0) {
      return res.json({
        status: { applied: true, migrationNeeded: false },
        message: 'User "khalid" not found'
      });
    }

    report.user = userResult.rows[0];

    // 2. Get role information
    if (report.user.role_id) {
      const roleResult = await pool.query(`
        SELECT id, name, description
        FROM roles
        WHERE id = $1
      `, [report.user.role_id]);

      if (roleResult.rows.length > 0) {
        report.role = roleResult.rows[0];

        // 3. Count total permissions
        const permCountResult = await pool.query(`
          SELECT COUNT(*) as count
          FROM role_permissions
          WHERE role_id = $1
        `, [report.user.role_id]);

        report.totalPermissions = parseInt(permCountResult.rows[0].count);

        // 4. Get certificate_templates permissions
        const certPermsResult = await pool.query(`
          SELECT p.code, p.label
          FROM role_permissions rp
          INNER JOIN permissions p ON rp.permission_id = p.id
          WHERE rp.role_id = $1
            AND p.code LIKE 'training.certificate_templates.%'
          ORDER BY p.code
        `, [report.user.role_id]);

        report.certificateTemplatePermissions = certPermsResult.rows;
        report.hasUpdatePermission = certPermsResult.rows.some(
          p => p.code === 'training.certificate_templates.update'
        );
      }
    }

    // 5. Get all roles
    const allRolesResult = await pool.query(`
      SELECT r.id, r.name, COUNT(rp.permission_id) as perm_count
      FROM roles r
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      GROUP BY r.id, r.name
      ORDER BY r.name
    `);
    report.allRoles = allRolesResult.rows;

    res.json({
      status: {
        applied: true,
        migrationNeeded: !report.hasUpdatePermission
      },
      message: report.hasUpdatePermission
        ? `User "${report.user.username}" has the update permission`
        : `User "${report.user.username}" is MISSING the update permission!`,
      report: report
    });

  } catch (error) {
    res.status(500).json({
      status: { applied: false, migrationNeeded: true, error: error.message },
      message: `Error: ${error.message}`
    });
  }
});

router.post('/run', async (req, res) => {
  try {
    const report = {
      user: null,
      role: null,
      totalPermissions: 0,
      certificateTemplatePermissions: [],
      hasUpdatePermission: false,
      allRoles: [],
      solution: null
    };

    // 1. Find the user
    const userResult = await pool.query(`
      SELECT id, username, role, role_id
      FROM profiles
      WHERE LOWER(username) LIKE '%khalid%'
    `);

    if (userResult.rows.length === 0) {
      return res.json({
        success: true,
        message: 'User "khalid" not found',
        report: report
      });
    }

    report.user = userResult.rows[0];

    // 2. Get role information
    if (report.user.role_id) {
      const roleResult = await pool.query(`
        SELECT id, name, description
        FROM roles
        WHERE id = $1
      `, [report.user.role_id]);

      if (roleResult.rows.length > 0) {
        report.role = roleResult.rows[0];

        // 3. Count total permissions
        const permCountResult = await pool.query(`
          SELECT COUNT(*) as count
          FROM role_permissions
          WHERE role_id = $1
        `, [report.user.role_id]);

        report.totalPermissions = parseInt(permCountResult.rows[0].count);

        // 4. Get certificate_templates permissions
        const certPermsResult = await pool.query(`
          SELECT p.code, p.label
          FROM role_permissions rp
          INNER JOIN permissions p ON rp.permission_id = p.id
          WHERE rp.role_id = $1
            AND p.code LIKE 'training.certificate_templates.%'
          ORDER BY p.code
        `, [report.user.role_id]);

        report.certificateTemplatePermissions = certPermsResult.rows;
        report.hasUpdatePermission = certPermsResult.rows.some(
          p => p.code === 'training.certificate_templates.update'
        );

        // 5. Provide solution
        if (!report.hasUpdatePermission) {
          report.solution = {
            problem: `User "${report.user.username}" with role "${report.role.name}" is missing permission: training.certificate_templates.update`,
            action: `You need to assign the missing permissions to role "${report.role.name}"`,
            recommendation: 'Run Migration 074 if this is the gerant role, or manually assign permissions in the Roles management page'
          };
        }
      }
    }

    // 6. Get all roles
    const allRolesResult = await pool.query(`
      SELECT r.id, r.name, COUNT(rp.permission_id) as perm_count
      FROM roles r
      LEFT JOIN role_permissions rp ON rp.role_id = r.id
      GROUP BY r.id, r.name
      ORDER BY r.name
    `);
    report.allRoles = allRolesResult.rows;

    res.json({
      success: true,
      message: 'Analysis complete',
      details: report
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
