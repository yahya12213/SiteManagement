/**
 * Migration 073: Audit de Sécurité - 5 Permissions Manquantes
 *
 * Résultats de l'audit de sécurité (2025-12-05) :
 * - 8 vulnérabilités critiques identifiées dans 3 fichiers
 * - Score de sécurité : 7.5/10 (89% routes protégées)
 *
 * Permissions à ajouter :
 * 1. training.sessions.delete_payment - Supprimer un paiement (permission spécifique vs edit_student)
 * 2. hr.attendance.approve_overtime - Approuver heures sup (permission dédiée vs leaves.approve)
 * 3. hr.attendance.reject_overtime - Rejeter heures sup
 * 4. hr.holidays.view_page - Voir les jours fériés
 * 5. hr.holidays.manage - Gérer les jours fériés
 *
 * Auto-assignation :
 * - delete_payment → rôles ayant edit_student
 * - approve_overtime → rôles ayant leaves.approve
 * - reject_overtime → rôles ayant leaves.approve
 * - holidays.* → rôles RH (à déterminer)
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 073: Security Audit Fixes ===');

    const stats = {
      added: 0,
      skipped: 0,
      roles_assigned: 0
    };

    const permissionsToAdd = [
      {
        code: 'training.sessions.delete_payment',
        module: 'training',
        menu: 'sessions',
        action: 'delete_payment',
        label: 'Supprimer un paiement',
        description: 'Permet de supprimer un paiement enregistré (opération sensible)',
        sort_order: 8,
        assign_from: 'training.sessions.edit_student'
      },
      {
        code: 'hr.attendance.approve_overtime',
        module: 'hr',
        menu: 'attendance',
        action: 'approve_overtime',
        label: 'Approuver heures supplémentaires',
        description: 'Permet d\'approuver les demandes d\'heures supplémentaires',
        sort_order: 7,
        assign_from: 'hr.leaves.approve'
      },
      {
        code: 'hr.attendance.reject_overtime',
        module: 'hr',
        menu: 'attendance',
        action: 'reject_overtime',
        label: 'Rejeter heures supplémentaires',
        description: 'Permet de rejeter les demandes d\'heures supplémentaires',
        sort_order: 8,
        assign_from: 'hr.leaves.approve'
      },
      {
        code: 'hr.holidays.view_page',
        module: 'hr',
        menu: 'holidays',
        action: 'view_page',
        label: 'Voir les jours fériés',
        description: 'Permet de consulter la liste des jours fériés',
        sort_order: 1,
        assign_from: null // Tous les rôles RH (assignation manuelle recommandée)
      },
      {
        code: 'hr.holidays.manage',
        module: 'hr',
        menu: 'holidays',
        action: 'manage',
        label: 'Gérer les jours fériés',
        description: 'Permet de créer, modifier et supprimer des jours fériés',
        sort_order: 2,
        assign_from: null // Admin uniquement (assignation manuelle recommandée)
      }
    ];

    // Ajouter chaque permission
    for (const perm of permissionsToAdd) {
      console.log(`\nProcessing: ${perm.code}`);

      // Vérifier si existe déjà
      const exists = await client.query(
        'SELECT id FROM permissions WHERE code = $1',
        [perm.code]
      );

      if (exists.rows.length > 0) {
        console.log(`⚠️  Already exists, skipping...`);
        stats.skipped++;
        continue;
      }

      // Insérer la permission
      const insertResult = await client.query(`
        INSERT INTO permissions (
          id,
          code,
          module,
          menu,
          action,
          label,
          description,
          sort_order,
          created_at
        ) VALUES (
          gen_random_uuid(),
          $1, $2, $3, $4, $5, $6, $7,
          NOW()
        )
        RETURNING id
      `, [
        perm.code,
        perm.module,
        perm.menu,
        perm.action,
        perm.label,
        perm.description,
        perm.sort_order
      ]);

      console.log(`✓ Permission added with ID: ${insertResult.rows[0].id}`);
      stats.added++;

      // Auto-assigner si assign_from est spécifié
      if (perm.assign_from) {
        const assignResult = await client.query(`
          INSERT INTO role_permissions (role_id, permission_id, granted_at)
          SELECT rp.role_id, p_new.id, NOW()
          FROM role_permissions rp
          INNER JOIN permissions p_old ON rp.permission_id = p_old.id
          CROSS JOIN permissions p_new
          WHERE p_old.code = $1
            AND p_new.code = $2
          ON CONFLICT DO NOTHING
          RETURNING role_id
        `, [perm.assign_from, perm.code]);

        const assigned = assignResult.rows.length;
        stats.roles_assigned += assigned;
        console.log(`✓ Auto-assigned to ${assigned} role(s) from ${perm.assign_from}`);
      } else {
        console.log(`ℹ️  No auto-assignment (manual assignment recommended)`);
      }
    }

    await client.query('COMMIT');

    console.log('\n=== Migration 073 Complete ===');
    console.log(`Permissions added: ${stats.added}`);
    console.log(`Permissions skipped: ${stats.skipped}`);
    console.log(`Total roles assigned: ${stats.roles_assigned}`);

    res.json({
      success: true,
      message: `Migration 073 completed successfully - ${stats.added} permissions added`,
      stats,
      next_steps: [
        'Protect routes in sessions-formation.js (6 routes)',
        'Protect routes in hr-attendance.js (2 routes)',
        'Protect routes in hr-public-holidays.js (1 route)',
        'Fix /bulk route order in hr-public-holidays.js'
      ]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 073 error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Failed to complete security audit fixes'
    });
  } finally {
    client.release();
  }
});

// ============================================================
// ROLLBACK MIGRATION
// ============================================================
router.post('/rollback', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Rolling back Migration 073...');

    const permissionCodes = [
      'training.sessions.delete_payment',
      'hr.attendance.approve_overtime',
      'hr.attendance.reject_overtime',
      'hr.holidays.view_page',
      'hr.holidays.manage'
    ];

    // Supprimer les assignations de rôles
    await client.query(`
      DELETE FROM role_permissions
      WHERE permission_id IN (
        SELECT id FROM permissions WHERE code = ANY($1)
      )
    `, [permissionCodes]);

    // Supprimer les permissions
    const deleteResult = await client.query(`
      DELETE FROM permissions
      WHERE code = ANY($1)
      RETURNING code
    `, [permissionCodes]);

    await client.query('COMMIT');

    console.log('✓ Rollback complete');

    res.json({
      success: true,
      message: 'Migration 073 rolled back successfully',
      deleted_permissions: deleteResult.rows.map(r => r.code),
      warning: 'Routes are now unprotected again - security vulnerabilities restored!'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Rollback 073 error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// ============================================================
// CHECK MIGRATION STATUS
// ============================================================
router.get('/status', async (req, res) => {
  try {
    const permissionCodes = [
      'training.sessions.delete_payment',
      'hr.attendance.approve_overtime',
      'hr.attendance.reject_overtime',
      'hr.holidays.view_page',
      'hr.holidays.manage'
    ];

    // Vérifier quelles permissions existent
    const permissionsResult = await pool.query(`
      SELECT code, label
      FROM permissions
      WHERE code = ANY($1)
      ORDER BY code
    `, [permissionCodes]);

    const existingPermissions = permissionsResult.rows.map(r => r.code);
    const missingPermissions = permissionCodes.filter(code => !existingPermissions.includes(code));

    const migrationNeeded = missingPermissions.length > 0;

    // Compter les rôles avec chaque permission
    const roleCountsResult = await pool.query(`
      SELECT p.code, COUNT(DISTINCT rp.role_id) as role_count
      FROM permissions p
      LEFT JOIN role_permissions rp ON rp.permission_id = p.id
      WHERE p.code = ANY($1)
      GROUP BY p.code
    `, [permissionCodes]);

    res.json({
      status: {
        migrationNeeded,
        applied: !migrationNeeded,
        permissions_exist: existingPermissions.length,
        permissions_missing: missingPermissions.length,
        existing_permissions: permissionsResult.rows,
        missing_permissions: missingPermissions,
        role_counts: roleCountsResult.rows
      },
      message: migrationNeeded
        ? `Migration needed - ${missingPermissions.length} permission(s) missing`
        : `Migration 073 applied - All ${permissionCodes.length} permissions exist`
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
