/**
 * Migration 032 - Remove Role CHECK Constraint
 *
 * Removes the obsolete profiles_role_check constraint that only allows
 * 'admin', 'professor', 'gerant' values. This is necessary because:
 * - The RBAC system now has 6 roles (admin, gerant, professor, assistante, comptable, superviseur)
 * - Role validation is now handled by the roles table with role_id foreign key
 * - The CHECK constraint prevents assigning new roles to users
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting Migration 032 - Remove Role CHECK Constraint...');
    await client.query('BEGIN');

    // Step 1: Check if constraint exists
    const constraintCheck = await client.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'profiles'
      AND constraint_name = 'profiles_role_check'
    `);

    if (constraintCheck.rows.length === 0) {
      console.log('  ℹ️  Constraint profiles_role_check does not exist');
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'Constraint already removed or does not exist',
        details: { constraintRemoved: false }
      });
    }

    // Step 2: Remove the CHECK constraint
    console.log('  📦 Removing profiles_role_check constraint...');
    await client.query('ALTER TABLE profiles DROP CONSTRAINT profiles_role_check');
    console.log('    ✅ Constraint removed successfully');

    // Step 3: Verify removal
    const verifyCheck = await client.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'profiles'
      AND constraint_name = 'profiles_role_check'
    `);

    if (verifyCheck.rows.length > 0) {
      throw new Error('Constraint still exists after removal attempt');
    }

    await client.query('COMMIT');
    console.log('✅ Migration 032 completed successfully!');

    res.json({
      success: true,
      message: 'Role CHECK constraint removed successfully',
      details: {
        constraintRemoved: true,
        note: 'Profiles table now accepts any role value. Role validation is handled by RBAC system.'
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 032 failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

router.get('/status', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT constraint_name
      FROM information_schema.table_constraints
      WHERE table_name = 'profiles'
      AND constraint_name = 'profiles_role_check'
    `);

    const constraintExists = result.rows.length > 0;

    res.json({
      success: true,
      migrationComplete: !constraintExists,
      constraintExists,
      message: constraintExists
        ? 'profiles_role_check constraint exists - migration needed'
        : 'Constraint removed - migration complete'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
