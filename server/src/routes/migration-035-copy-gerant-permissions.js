/**
 * Migration 035 - Copy Gerant Permissions to Custom Roles
 *
 * Copies permissions from the "gerant" role to any custom role that
 * has the same base purpose (like "Gestionnaire de session et d impression").
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting Migration 035 - Copy Gerant Permissions...');
    await client.query('BEGIN');

    // Define the specific permissions for a "Gestionnaire" role
    // These are the key permissions for session and declaration management
    const gestionnairePermCodes = [
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

    // Get permission IDs for these codes
    const permsResult = await client.query(
      'SELECT id FROM permissions WHERE code = ANY($1)',
      [gestionnairePermCodes]
    );

    const gestionnairePermissions = permsResult.rows.map(r => r.id);
    console.log(`  📦 Found ${gestionnairePermissions.length} permissions for Gestionnaire role`);

    // Find all roles that have "gestionnaire" in the name (case insensitive)
    const customRolesResult = await client.query(
      "SELECT id, name FROM roles WHERE LOWER(name) LIKE '%gestionnaire%'"
    );

    let totalAssigned = 0;
    for (const role of customRolesResult.rows) {
      console.log(`  📦 Assigning permissions to: ${role.name}`);

      // Check how many permissions the role already has
      const existingPermsResult = await client.query(
        'SELECT COUNT(*) as count FROM role_permissions WHERE role_id = $1',
        [role.id]
      );

      const existingCount = parseInt(existingPermsResult.rows[0].count);

      // Only assign if the role has few or no permissions
      if (existingCount < 5) {
        for (const permId of gestionnairePermissions) {
          await client.query(
            `INSERT INTO role_permissions (role_id, permission_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [role.id, permId]
          );
        }
        totalAssigned += gestionnairePermissions.length;
        console.log(`    ✅ Assigned ${gestionnairePermissions.length} permissions to ${role.name}`);
      } else {
        console.log(`    ⏭️ Skipping ${role.name} - already has ${existingCount} permissions`);
      }
    }

    await client.query('COMMIT');
    console.log('✅ Migration 035 completed successfully!');

    res.json({
      success: true,
      message: 'Gestionnaire permissions assigned to custom roles',
      details: {
        permissionsCount: gestionnairePermissions.length,
        rolesUpdated: customRolesResult.rows.map(r => r.name),
        totalAssigned,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 035 failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    client.release();
  }
});

export default router;
