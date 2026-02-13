/**
 * Migration 067: HR Permissions Alignment with Sidebar
 * Creates permissions for HR menus that match the sidebar structure
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Define HR permissions aligned with sidebar menus
    const permissions = [
      // validation_workflows (Boucles de Validation)
      {
        module: 'hr',
        menu: 'validation_workflows',
        action: 'view_page',
        code: 'hr.validation_workflows.view_page',
        label: 'Voir les boucles de validation',
        description: 'Permet d\'accéder à la gestion des workflows de validation RH',
        sort_order: 500
      },
      {
        module: 'hr',
        menu: 'validation_workflows',
        action: 'create',
        code: 'hr.validation_workflows.create',
        label: 'Créer une boucle',
        description: 'Permet de créer un nouveau workflow de validation',
        sort_order: 501
      },
      {
        module: 'hr',
        menu: 'validation_workflows',
        action: 'update',
        code: 'hr.validation_workflows.update',
        label: 'Modifier une boucle',
        description: 'Permet de modifier un workflow de validation existant',
        sort_order: 502
      },
      {
        module: 'hr',
        menu: 'validation_workflows',
        action: 'delete',
        code: 'hr.validation_workflows.delete',
        label: 'Supprimer une boucle',
        description: 'Permet de supprimer un workflow de validation',
        sort_order: 503
      },

      // schedules (Gestion des Horaires)
      {
        module: 'hr',
        menu: 'schedules',
        action: 'view_page',
        code: 'hr.schedules.view_page',
        label: 'Voir les horaires',
        description: 'Permet d\'accéder à la gestion des plannings horaires',
        sort_order: 510
      },
      {
        module: 'hr',
        menu: 'schedules',
        action: 'create',
        code: 'hr.schedules.create',
        label: 'Créer un horaire',
        description: 'Permet de créer un nouveau planning horaire',
        sort_order: 511
      },
      {
        module: 'hr',
        menu: 'schedules',
        action: 'update',
        code: 'hr.schedules.update',
        label: 'Modifier un horaire',
        description: 'Permet de modifier un planning horaire existant',
        sort_order: 512
      },
      {
        module: 'hr',
        menu: 'schedules',
        action: 'delete',
        code: 'hr.schedules.delete',
        label: 'Supprimer un horaire',
        description: 'Permet de supprimer un planning horaire',
        sort_order: 513
      },

      // payroll (Gestion de Paie)
      {
        module: 'hr',
        menu: 'payroll',
        action: 'view_page',
        code: 'hr.payroll.view_page',
        label: 'Voir la paie',
        description: 'Permet d\'accéder au module de gestion de la paie',
        sort_order: 520
      },
      {
        module: 'hr',
        menu: 'payroll',
        action: 'create',
        code: 'hr.payroll.create',
        label: 'Créer une fiche de paie',
        description: 'Permet de générer une nouvelle fiche de paie',
        sort_order: 521
      },
      {
        module: 'hr',
        menu: 'payroll',
        action: 'update',
        code: 'hr.payroll.update',
        label: 'Modifier une fiche de paie',
        description: 'Permet de modifier une fiche de paie existante',
        sort_order: 522
      },
      {
        module: 'hr',
        menu: 'payroll',
        action: 'export',
        code: 'hr.payroll.export',
        label: 'Exporter la paie',
        description: 'Permet d\'exporter les données de paie',
        sort_order: 523
      },

      // requests_validation (Validation des Demandes)
      {
        module: 'hr',
        menu: 'requests_validation',
        action: 'view_page',
        code: 'hr.requests_validation.view_page',
        label: 'Voir les demandes',
        description: 'Permet d\'accéder à la validation des demandes RH',
        sort_order: 530
      },
      {
        module: 'hr',
        menu: 'requests_validation',
        action: 'approve',
        code: 'hr.requests_validation.approve',
        label: 'Approuver une demande',
        description: 'Permet d\'approuver les demandes de congés et absences',
        sort_order: 531
      },
      {
        module: 'hr',
        menu: 'requests_validation',
        action: 'reject',
        code: 'hr.requests_validation.reject',
        label: 'Rejeter une demande',
        description: 'Permet de rejeter les demandes de congés et absences',
        sort_order: 532
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
      message: 'Migration 067 completed successfully',
      details: {
        inserted: insertedCount,
        updated: updatedCount,
        permissions: permissions.map(p => p.code)
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 067 error:', error);
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
      'hr.validation_workflows.view_page',
      'hr.schedules.view_page',
      'hr.payroll.view_page',
      'hr.requests_validation.view_page'
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
        ? 'Migration 067 already applied - all HR sidebar permissions exist'
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
