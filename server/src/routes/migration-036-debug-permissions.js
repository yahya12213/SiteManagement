/**
 * Migration 036 - Debug Permissions Assignment
 *
 * Direct SQL to assign permissions to Gestionnaire role
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.get('/status', async (req, res) => {
  try {
    // Get the role info
    const roleResult = await pool.query(
      "SELECT * FROM roles WHERE name ILIKE '%gestionnaire%'"
    );

    // Get all permissions
    const permsResult = await pool.query('SELECT * FROM permissions LIMIT 10');

    // Get role_permissions for this role
    const rolePermsResult = await pool.query(`
      SELECT rp.*, p.code, p.name as perm_name
      FROM role_permissions rp
      JOIN permissions p ON p.id = rp.permission_id
      WHERE rp.role_id IN (SELECT id FROM roles WHERE name ILIKE '%gestionnaire%')
    `);

    res.json({
      success: true,
      role: roleResult.rows,
      samplePermissions: permsResult.rows,
      rolePermissions: rolePermsResult.rows,
      rolePermissionsCount: rolePermsResult.rows.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting Migration 036 - Direct Permission Assignment...');
    await client.query('BEGIN');

    // Get the role ID
    const roleResult = await client.query(
      "SELECT id, name FROM roles WHERE name ILIKE '%gestionnaire%'"
    );

    if (roleResult.rows.length === 0) {
      throw new Error('Role Gestionnaire not found');
    }

    const roleId = roleResult.rows[0].id;
    const roleName = roleResult.rows[0].name;
    console.log(`  📦 Found role: ${roleName} (${roleId})`);

    // Get all available permissions
    const allPermsResult = await client.query('SELECT id, code FROM permissions');
    console.log(`  📦 Total permissions in database: ${allPermsResult.rows.length}`);

    if (allPermsResult.rows.length === 0) {
      throw new Error('No permissions found in database');
    }

    // List of permission codes to assign
    const targetCodes = [
      'menu.tableau_bord.voir',
      'menu.gerer_declarations.voir',
      'menu.gerer_declarations.modifier',
      'menu.gerer_declarations.approuver',
      'menu.creer_declaration.creer',
      'menu.fiches_calcul.voir',
      'menu.sessions.voir',
      'menu.sessions.creer',
      'menu.sessions.modifier',
      'menu.sessions.gerer_etudiants',
      'menu.certificats.voir',
      'menu.certificats.generer',
      'menu.certificats.telecharger',
      'menu.rapports.voir',
      'menu.rapports.exporter',
    ];

    // Find matching permissions
    const matchingPerms = allPermsResult.rows.filter(p => targetCodes.includes(p.code));
    console.log(`  📦 Found ${matchingPerms.length} matching permissions out of ${targetCodes.length} requested`);

    if (matchingPerms.length === 0) {
      // Log available codes to debug
      const availableCodes = allPermsResult.rows.map(p => p.code).slice(0, 20);
      throw new Error(`No matching permissions found. Available codes: ${availableCodes.join(', ')}`);
    }

    // Clear existing permissions for this role first
    const clearResult = await client.query(
      'DELETE FROM role_permissions WHERE role_id = $1',
      [roleId]
    );
    console.log(`  📦 Cleared ${clearResult.rowCount} existing permissions`);

    // Insert permissions
    let insertedCount = 0;
    for (const perm of matchingPerms) {
      const insertResult = await client.query(
        `INSERT INTO role_permissions (role_id, permission_id)
         VALUES ($1, $2)
         RETURNING *`,
        [roleId, perm.id]
      );
      if (insertResult.rows.length > 0) {
        insertedCount++;
        console.log(`    ✅ Assigned: ${perm.code}`);
      }
    }

    await client.query('COMMIT');
    console.log(`✅ Migration 036 completed! Assigned ${insertedCount} permissions`);

    res.json({
      success: true,
      message: 'Permissions directly assigned',
      details: {
        roleId,
        roleName,
        permissionsRequested: targetCodes.length,
        permissionsFound: matchingPerms.length,
        permissionsAssigned: insertedCount,
        assignedCodes: matchingPerms.map(p => p.code),
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 036 failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    client.release();
  }
});

export default router;
