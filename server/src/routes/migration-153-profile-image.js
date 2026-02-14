/**
 * Migration 153: Add profile_image_url to profiles table
 * Allows users to have a profile photo displayed in the UI
 */
import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.get('/run', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🚀 Starting migration 153: Add profile_image_url to profiles...');

    // Check if column already exists
    const checkColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'profiles' AND column_name = 'profile_image_url'
    `);

    if (checkColumn.rows.length === 0) {
      // Add profile_image_url column to profiles table
      await client.query(`
        ALTER TABLE profiles
        ADD COLUMN profile_image_url TEXT
      `);
      console.log('✅ Added profile_image_url column to profiles table');
    } else {
      console.log('ℹ️ profile_image_url column already exists in profiles table');
    }

    await client.query('COMMIT');
    console.log('✅ Migration 153 completed successfully');

    res.json({
      success: true,
      message: 'Migration 153 completed: profile_image_url column added to profiles table'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 153 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Status check
router.get('/status', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'profiles' AND column_name = 'profile_image_url'
    `);

    res.json({
      success: true,
      migrated: result.rows.length > 0,
      message: result.rows.length > 0
        ? 'profile_image_url column exists in profiles table'
        : 'profile_image_url column does not exist'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
