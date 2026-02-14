/**
 * Migration 071: Fix de Sécurité - Permission training.sessions.remove_student
 *
 * Problème identifié :
 * - La route DELETE /api/sessions-formation/:sessionId/etudiants/:etudiantId existe
 * - MAIS elle n'est PAS protégée par une permission
 * - Risque : N'importe quel utilisateur authentifié peut supprimer un étudiant d'une session
 *
 * Solution :
 * 1. Ajouter la permission training.sessions.remove_student
 * 2. Assigner automatiquement aux rôles ayant add_student (cohérence)
 * 3. La route sera ensuite protégée manuellement avec requirePermission()
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 071: Permission remove_student ===');

    // Vérifier si la permission existe déjà
    const exists = await client.query(
      'SELECT id FROM permissions WHERE code = $1',
      ['training.sessions.remove_student']
    );

    if (exists.rows.length > 0) {
      console.log('⚠️ Permission already exists, skipping...');
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'Migration 071 skipped - Permission already exists',
        alreadyApplied: true
      });
    }

    // Ajouter la permission
    console.log('Step 1: Adding permission training.sessions.remove_student...');
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
        'training.sessions.remove_student',
        'training',
        'sessions',
        'remove_student',
        'Retirer un étudiant',
        'Permet de retirer un étudiant inscrit à une session',
        7,
        NOW()
      )
      RETURNING id
    `);

    console.log('✓ Permission added with ID:', insertResult.rows[0].id);

    // Assigner automatiquement aux rôles ayant déjà add_student
    console.log('Step 2: Auto-assigning permission to roles having add_student...');
    const assignResult = await client.query(`
      INSERT INTO role_permissions (role_id, permission_id, granted_at)
      SELECT rp.role_id, p_new.id, NOW()
      FROM role_permissions rp
      INNER JOIN permissions p_old ON rp.permission_id = p_old.id
      CROSS JOIN permissions p_new
      WHERE p_old.code = 'training.sessions.add_student'
        AND p_new.code = 'training.sessions.remove_student'
      ON CONFLICT DO NOTHING
      RETURNING role_id
    `);

    const rolesAssigned = assignResult.rows.length;
    console.log(`✓ Permission assigned to ${rolesAssigned} role(s)`);

    await client.query('COMMIT');

    console.log('=== Migration 071 Complete ===');

    res.json({
      success: true,
      message: 'Migration 071 completed successfully - Security fix applied',
      details: {
        permission_added: 'training.sessions.remove_student',
        roles_assigned: rolesAssigned,
        next_step: 'Protect the DELETE route in sessions-formation.js with requirePermission()'
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 071 error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Failed to add remove_student permission'
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

    console.log('Rolling back Migration 071...');

    // Supprimer les assignations de rôles
    await client.query(`
      DELETE FROM role_permissions
      WHERE permission_id IN (
        SELECT id FROM permissions WHERE code = 'training.sessions.remove_student'
      )
    `);

    // Supprimer la permission
    await client.query(`
      DELETE FROM permissions
      WHERE code = 'training.sessions.remove_student'
    `);

    await client.query('COMMIT');

    console.log('✓ Rollback complete');

    res.json({
      success: true,
      message: 'Migration 071 rolled back successfully',
      warning: 'The DELETE route is now unprotected again - security vulnerability restored!'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Rollback 071 error:', error);
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
    // Vérifier si la permission existe
    const permissionResult = await pool.query(`
      SELECT id, code, label, description
      FROM permissions
      WHERE code = 'training.sessions.remove_student'
    `);

    const exists = permissionResult.rows.length > 0;

    // Compter combien de rôles ont cette permission
    let rolesCount = 0;
    if (exists) {
      const rolesResult = await pool.query(`
        SELECT COUNT(DISTINCT role_id) as count
        FROM role_permissions
        WHERE permission_id = $1
      `, [permissionResult.rows[0].id]);
      rolesCount = parseInt(rolesResult.rows[0].count);
    }

    // Vérifier si la route DELETE est protégée (analyse statique impossible ici)
    // Cette vérification doit être manuelle

    res.json({
      status: {
        migrationNeeded: !exists,
        applied: exists,
        permission_exists: exists,
        roles_with_permission: rolesCount
      },
      message: exists
        ? `Migration 071 applied - Permission exists and assigned to ${rolesCount} role(s)`
        : 'Migration needed - Permission training.sessions.remove_student does not exist',
      security_note: exists
        ? 'Permission exists, but verify manually that DELETE route is protected with requirePermission()'
        : '⚠️ SECURITY RISK: DELETE route is unprotected!'
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
