/**
 * Migration 079: FIX CRITIQUE - Synchroniser profiles.role avec roles.name pour bypass admin
 *
 * Problème: Le middleware requirePermission vérifie req.user.role === 'admin'
 * mais le champ profiles.role n'est pas synchronisé avec role_id/roles.name
 * Résultat: Les admins reçoivent 403 même avec toutes les permissions
 *
 * Solution: Synchroniser profiles.role avec roles.name pour tous les utilisateurs
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🔧 Migration 079: Synchronizing profiles.role with roles.name...');

    // Step 1: Update profiles.role to match roles.name via role_id
    const updateResult = await client.query(`
      UPDATE profiles p
      SET role = r.name
      FROM roles r
      WHERE p.role_id = r.id
        AND (p.role IS NULL OR p.role != r.name)
      RETURNING p.id, p.username, p.role, r.name as new_role
    `);

    console.log(`✅ Updated ${updateResult.rowCount} user(s) with synchronized roles`);

    if (updateResult.rows.length > 0) {
      console.log('📝 Updated users:');
      updateResult.rows.forEach(user => {
        console.log(`   - ${user.username}: role set to '${user.new_role}'`);
      });
    }

    // Step 2: Check if admin role exists and has users
    const adminCheck = await client.query(`
      SELECT p.id, p.username, p.role, p.role_id, r.name as role_name
      FROM profiles p
      INNER JOIN roles r ON p.role_id = r.id
      WHERE r.name = 'admin'
    `);

    console.log(`✅ Found ${adminCheck.rowCount} admin user(s)`);

    if (adminCheck.rows.length > 0) {
      console.log('👥 Admin users:');
      adminCheck.rows.forEach(user => {
        console.log(`   - ${user.username}: role='${user.role}', role_id=${user.role_id}`);
      });
    }

    // Step 3: Verify all roles are properly synchronized
    const verificationResult = await client.query(`
      SELECT
        r.name as role_name,
        COUNT(CASE WHEN p.role = r.name THEN 1 END) as synchronized_count,
        COUNT(CASE WHEN p.role != r.name OR p.role IS NULL THEN 1 END) as unsynchronized_count
      FROM profiles p
      INNER JOIN roles r ON p.role_id = r.id
      GROUP BY r.name
      ORDER BY r.name
    `);

    console.log('📊 Role Synchronization Status:');
    verificationResult.rows.forEach(row => {
      console.log(`   - ${row.role_name}: ${row.synchronized_count} synced, ${row.unsynchronized_count} unsynced`);
    });

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 079 completed successfully',
      details: {
        usersUpdated: updateResult.rowCount,
        updatedUsers: updateResult.rows,
        adminUsers: adminCheck.rows,
        synchronizationStatus: verificationResult.rows
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 079 error:', error);
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
    // Check if there are users with unsynchronized roles
    const result = await pool.query(`
      SELECT
        COUNT(CASE WHEN p.role != r.name OR p.role IS NULL THEN 1 END) as unsynchronized_count,
        COUNT(*) as total_users_with_roles
      FROM profiles p
      INNER JOIN roles r ON p.role_id = r.id
    `);

    const unsynchronizedCount = parseInt(result.rows[0]?.unsynchronized_count || 0);
    const needsMigration = unsynchronizedCount > 0;

    // Check specifically for admin users
    const adminCheck = await pool.query(`
      SELECT p.username, p.role, p.role_id, r.name as role_name
      FROM profiles p
      INNER JOIN roles r ON p.role_id = r.id
      WHERE r.name = 'admin' AND (p.role IS NULL OR p.role != 'admin')
    `);

    const adminNeedsFix = adminCheck.rowCount > 0;

    res.json({
      status: {
        migrationNeeded: needsMigration || adminNeedsFix,
        applied: !needsMigration && !adminNeedsFix,
        unsynchronizedUsers: unsynchronizedCount,
        totalUsers: parseInt(result.rows[0]?.total_users_with_roles || 0),
        adminUsersNeedingFix: adminCheck.rowCount,
        affectedAdmins: adminCheck.rows
      },
      message: needsMigration || adminNeedsFix
        ? `Migration needed - ${unsynchronizedCount} user(s) have unsynchronized roles${adminNeedsFix ? `, including ${adminCheck.rowCount} admin(s)` : ''}`
        : 'All user roles are synchronized with role_id'
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
