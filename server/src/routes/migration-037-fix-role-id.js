/**
 * Migration 037 - Fix role_id Assignment
 *
 * Updates profiles to use role_id (new RBAC system) instead of just role (text)
 * Maps existing role text values to corresponding role_id UUIDs
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.get('/status', async (req, res) => {
  try {
    // Get profiles with role but no role_id
    const missingRoleId = await pool.query(`
      SELECT id, username, full_name, role, role_id
      FROM profiles
      WHERE role IS NOT NULL AND role_id IS NULL
    `);

    // Get all roles
    const allRoles = await pool.query('SELECT id, name FROM roles');

    res.json({
      success: true,
      profilesWithoutRoleId: missingRoleId.rows,
      availableRoles: allRoles.rows,
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
    console.log('🔄 Starting Migration 037 - Fix role_id Assignment...');
    await client.query('BEGIN');

    // Get all roles from database
    const rolesResult = await client.query('SELECT id, name FROM roles');
    const roleMap = {};
    rolesResult.rows.forEach(r => {
      roleMap[r.name.toLowerCase()] = r.id;
    });

    console.log('  📦 Available roles:', Object.keys(roleMap));

    // Get profiles with role text but no role_id
    const profilesResult = await client.query(`
      SELECT id, username, full_name, role
      FROM profiles
      WHERE role IS NOT NULL AND role_id IS NULL
    `);

    console.log(`  📦 Found ${profilesResult.rows.length} profiles without role_id`);

    let updatedCount = 0;
    const updates = [];

    for (const profile of profilesResult.rows) {
      const roleName = profile.role.toLowerCase();
      const roleId = roleMap[roleName];

      if (roleId) {
        await client.query(
          'UPDATE profiles SET role_id = $1 WHERE id = $2',
          [roleId, profile.id]
        );
        updatedCount++;
        updates.push({
          username: profile.username,
          fullName: profile.full_name,
          oldRole: profile.role,
          newRoleId: roleId,
        });
        console.log(`    ✅ ${profile.full_name}: ${profile.role} → ${roleId}`);
      } else {
        console.log(`    ⚠️ ${profile.full_name}: No matching role for "${profile.role}"`);
      }
    }

    await client.query('COMMIT');
    console.log(`✅ Migration 037 completed! Updated ${updatedCount} profiles`);

    res.json({
      success: true,
      message: 'role_id assignments fixed',
      details: {
        profilesChecked: profilesResult.rows.length,
        profilesUpdated: updatedCount,
        updates,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 037 failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    client.release();
  }
});

export default router;
