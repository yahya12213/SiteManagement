/**
 * Migration 091 - Synchronize role_id for all users
 *
 * This migration fixes the issue where users have a role name in the 'role' column
 * but their 'role_id' is NULL or incorrect.
 *
 * The sync is case-insensitive to handle variations like:
 * - "Assistante Formation en Ligne" vs "assistante formation en ligne"
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting Migration 091 - Sync role_id for all users...');
    await client.query('BEGIN');

    // Step 1: Get all users with their current role and role_id
    const usersResult = await client.query(`
      SELECT p.id, p.username, p.role, p.role_id, r.name as current_role_name
      FROM profiles p
      LEFT JOIN roles r ON p.role_id = r.id
      ORDER BY p.username
    `);

    console.log(`  📋 Found ${usersResult.rows.length} users to check`);

    let updatedCount = 0;
    let alreadyCorrect = 0;
    let noMatchingRole = 0;
    const issues = [];

    for (const user of usersResult.rows) {
      // Find the correct role_id based on role name (case-insensitive)
      const roleResult = await client.query(
        'SELECT id, name FROM roles WHERE LOWER(name) = LOWER($1)',
        [user.role]
      );

      if (roleResult.rows.length === 0) {
        // Role doesn't exist in roles table
        noMatchingRole++;
        issues.push({
          username: user.username,
          role: user.role,
          issue: 'Role not found in roles table'
        });
        continue;
      }

      const correctRoleId = roleResult.rows[0].id;
      const correctRoleName = roleResult.rows[0].name;

      if (user.role_id === correctRoleId) {
        // Already correct
        alreadyCorrect++;
        continue;
      }

      // Update the role_id
      await client.query(
        'UPDATE profiles SET role_id = $1 WHERE id = $2',
        [correctRoleId, user.id]
      );

      console.log(`  ✅ Updated ${user.username}: role="${user.role}" → role_id=${correctRoleId} (${correctRoleName})`);
      updatedCount++;
    }

    await client.query('COMMIT');

    console.log('✅ Migration 091 completed!');
    console.log(`  - ${updatedCount} users updated`);
    console.log(`  - ${alreadyCorrect} users already correct`);
    console.log(`  - ${noMatchingRole} users with no matching role`);

    res.json({
      success: true,
      message: 'Role ID synchronization completed',
      details: {
        totalUsers: usersResult.rows.length,
        updated: updatedCount,
        alreadyCorrect: alreadyCorrect,
        noMatchingRole: noMatchingRole,
        issues: issues
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 091 failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Check current status
router.get('/status', async (req, res) => {
  try {
    // Get users with mismatched or NULL role_id
    const mismatchedResult = await pool.query(`
      SELECT
        p.username,
        p.role as role_text,
        p.role_id,
        r.name as role_name_from_id,
        r2.id as expected_role_id,
        r2.name as expected_role_name
      FROM profiles p
      LEFT JOIN roles r ON p.role_id = r.id
      LEFT JOIN roles r2 ON LOWER(r2.name) = LOWER(p.role)
      WHERE p.role_id IS NULL
         OR p.role_id != r2.id
      ORDER BY p.username
    `);

    const correctResult = await pool.query(`
      SELECT COUNT(*) as count
      FROM profiles p
      JOIN roles r ON p.role_id = r.id
      WHERE LOWER(r.name) = LOWER(p.role)
    `);

    res.json({
      success: true,
      usersWithIssues: mismatchedResult.rows.length,
      usersCorrect: parseInt(correctResult.rows[0].count),
      issues: mismatchedResult.rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
