/**
 * Migration 066: Add missing permissions for HR employee portal, leaves approval, and system roles
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Define all missing permissions
    const permissions = [
      // HR Employee Portal permissions
      {
        module: 'hr',
        menu: 'employee_portal',
        action: 'view_page',
        code: 'hr.employee_portal.view_page',
        label: 'Voir le portail employé',
        description: 'Permet d\'accéder au portail employé pour le pointage et les demandes',
        sort_order: 460
      },
      {
        module: 'hr',
        menu: 'employee_portal',
        action: 'clock_in_out',
        code: 'hr.employee_portal.clock_in_out',
        label: 'Pointer entrée/sortie',
        description: 'Permet d\'enregistrer les pointages d\'entrée et de sortie',
        sort_order: 461
      },
      {
        module: 'hr',
        menu: 'employee_portal',
        action: 'submit_requests',
        code: 'hr.employee_portal.submit_requests',
        label: 'Soumettre des demandes',
        description: 'Permet de soumettre des demandes de congés, absences, etc.',
        sort_order: 462
      },
      {
        module: 'hr',
        menu: 'employee_portal',
        action: 'view_history',
        code: 'hr.employee_portal.view_history',
        label: 'Voir l\'historique',
        description: 'Permet de consulter l\'historique des pointages et demandes',
        sort_order: 463
      },
      // HR Leaves generic approve permission (used by hr-requests-validation.js)
      {
        module: 'hr',
        menu: 'leaves',
        action: 'approve',
        code: 'hr.leaves.approve',
        label: 'Approuver les demandes',
        description: 'Permet d\'approuver ou rejeter les demandes de congés et absences',
        sort_order: 437
      },
      // System Roles permissions (if not exist)
      {
        module: 'system',
        menu: 'roles',
        action: 'view_page',
        code: 'system.roles.view_page',
        label: 'Voir la page des rôles',
        description: 'Permet d\'accéder à la gestion des rôles et permissions',
        sort_order: 900
      },
      {
        module: 'system',
        menu: 'roles',
        action: 'create',
        code: 'system.roles.create',
        label: 'Créer un rôle',
        description: 'Permet de créer un nouveau rôle avec des permissions personnalisées',
        sort_order: 901
      },
      {
        module: 'system',
        menu: 'roles',
        action: 'update',
        code: 'system.roles.update',
        label: 'Modifier un rôle',
        description: 'Permet de modifier les permissions d\'un rôle existant',
        sort_order: 902
      },
      {
        module: 'system',
        menu: 'roles',
        action: 'delete',
        code: 'system.roles.delete',
        label: 'Supprimer un rôle',
        description: 'Permet de supprimer un rôle (si aucun utilisateur n\'y est assigné)',
        sort_order: 903
      },
      // Commercialisation Clients permissions
      {
        module: 'commercialisation',
        menu: 'clients',
        action: 'view_page',
        code: 'commercialisation.clients.view_page',
        label: 'Voir la page des clients',
        description: 'Permet d\'accéder à la liste des clients',
        sort_order: 700
      },
      {
        module: 'commercialisation',
        menu: 'clients',
        action: 'create',
        code: 'commercialisation.clients.create',
        label: 'Créer un client',
        description: 'Permet de créer une nouvelle fiche client',
        sort_order: 701
      },
      {
        module: 'commercialisation',
        menu: 'clients',
        action: 'update',
        code: 'commercialisation.clients.update',
        label: 'Modifier un client',
        description: 'Permet de modifier les informations d\'un client',
        sort_order: 702
      },
      {
        module: 'commercialisation',
        menu: 'clients',
        action: 'delete',
        code: 'commercialisation.clients.delete',
        label: 'Supprimer un client',
        description: 'Permet de supprimer un client',
        sort_order: 703
      },
      {
        module: 'commercialisation',
        menu: 'clients',
        action: 'export',
        code: 'commercialisation.clients.export',
        label: 'Exporter les clients',
        description: 'Permet d\'exporter la liste des clients',
        sort_order: 704
      }
    ];

    let insertedCount = 0;
    let updatedCount = 0;

    for (const perm of permissions) {
      const result = await client.query(`
        INSERT INTO permissions (module, menu, action, code, label, description, sort_order, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (code) DO UPDATE SET
          label = EXCLUDED.label,
          description = EXCLUDED.description,
          sort_order = EXCLUDED.sort_order
        RETURNING (xmax = 0) AS inserted
      `, [perm.module, perm.menu, perm.action, perm.code, perm.label, perm.description, perm.sort_order]);

      if (result.rows[0]?.inserted) {
        insertedCount++;
      } else {
        updatedCount++;
      }
    }
    console.log(`✅ Inserted ${insertedCount} new permissions, updated ${updatedCount}`);

    // Get the permission IDs we just inserted
    const permissionIds = await client.query(`
      SELECT id, code FROM permissions
      WHERE code IN (${permissions.map((_, i) => `$${i + 1}`).join(', ')})
    `, permissions.map(p => p.code));

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
      message: 'Migration 066 completed successfully',
      details: {
        inserted: insertedCount,
        updated: updatedCount,
        permissions: permissions.map(p => p.code)
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 066 error:', error);
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
    // Check for key permissions that should exist after this migration
    const keyPermissions = [
      'hr.employee_portal.view_page',
      'hr.leaves.approve',
      'system.roles.view_page',
      'commercialisation.clients.view_page'
    ];

    const result = await pool.query(`
      SELECT code FROM permissions
      WHERE code = ANY($1)
    `, [keyPermissions]);

    const existingCodes = result.rows.map(r => r.code);
    const allExist = keyPermissions.every(code => existingCodes.includes(code));

    res.json({
      status: {
        migrationNeeded: !allExist,
        applied: allExist,
        existingPermissions: existingCodes,
        missingPermissions: keyPermissions.filter(code => !existingCodes.includes(code))
      },
      message: allExist
        ? 'Migration 066 already applied - all key permissions exist'
        : `Migration needed - missing: ${keyPermissions.filter(code => !existingCodes.includes(code)).join(', ')}`
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
