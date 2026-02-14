/**
 * Migration 039 - Sync role_id with role text
 *
 * Fixes mismatch between role (text field) and role_id (UUID field)
 * When a user's role text doesn't match their role_id, update role_id
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.get('/status', async (req, res) => {
  try {
    // Find profiles where role text doesn't match role_id
    const mismatchResult = await pool.query(`
      SELECT p.id, p.username, p.full_name, p.role as role_text, r.name as role_from_id
      FROM profiles p
      LEFT JOIN roles r ON p.role_id = r.id
      WHERE p.role IS NOT NULL AND r.name IS NOT NULL AND LOWER(p.role) != LOWER(r.name)
    `);

    res.json({
      success: true,
      mismatchedProfiles: mismatchResult.rows,
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
    console.log('🔄 Starting Migration 039 - Sync role_id with role text...');
    await client.query('BEGIN');

    // Get all roles
    const rolesResult = await client.query('SELECT id, name FROM roles');
    const roleMap = {};
    rolesResult.rows.forEach(r => {
      roleMap[r.name.toLowerCase()] = r.id;
    });

    console.log('  📦 Available roles:', Object.keys(roleMap));

    // Find profiles where role text doesn't match role_id
    const mismatchResult = await client.query(`
      SELECT p.id, p.username, p.full_name, p.role as role_text, r.name as role_from_id
      FROM profiles p
      LEFT JOIN roles r ON p.role_id = r.id
      WHERE p.role IS NOT NULL
    `);

    console.log(`  📦 Checking ${mismatchResult.rows.length} profiles...`);

    let updatedCount = 0;
    const updates = [];

    for (const profile of mismatchResult.rows) {
      const roleText = profile.role_text.toLowerCase();
      const roleFromId = profile.role_from_id?.toLowerCase() || '';

      // If role text doesn't match role_id, update role_id
      if (roleText !== roleFromId) {
        const correctRoleId = roleMap[roleText];
        if (correctRoleId) {
          await client.query(
            'UPDATE profiles SET role_id = $1 WHERE id = $2',
            [correctRoleId, profile.id]
          );
          updatedCount++;
          updates.push({
            username: profile.username,
            fullName: profile.full_name,
            roleText: profile.role_text,
            oldRoleName: profile.role_from_id || 'NULL',
            newRoleId: correctRoleId,
          });
          console.log(`    ✅ ${profile.full_name}: ${profile.role_from_id || 'NULL'} → ${profile.role_text}`);
        } else {
          console.log(`    ⚠️ ${profile.full_name}: No role found for "${profile.role_text}"`);
        }
      }
    }

    await client.query('COMMIT');
    console.log(`✅ Migration 039 completed! Updated ${updatedCount} profiles`);

    res.json({
      success: true,
      message: 'role_id synchronized with role text',
      details: {
        profilesChecked: mismatchResult.rows.length,
        profilesUpdated: updatedCount,
        updates,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 039 failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    client.release();
  }
});

export default router;
