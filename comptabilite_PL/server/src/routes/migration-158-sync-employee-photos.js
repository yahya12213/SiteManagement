/**
 * Migration 158: Synchronize employee photos to profiles
 * Copies photo_url from hr_employees to profile_image_url in profiles
 * for employees that have a profile_id linked
 */
import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// Support both GET and POST for compatibility
router.all('/run', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🚀 Starting migration 158: Sync employee photos to profiles...');

    // Update profiles.profile_image_url from hr_employees.photo_url
    // Only for employees that have a profile_id and a photo_url
    const result = await client.query(`
      UPDATE profiles p
      SET profile_image_url = e.photo_url
      FROM hr_employees e
      WHERE e.profile_id = p.id
        AND e.photo_url IS NOT NULL
        AND (p.profile_image_url IS NULL OR p.profile_image_url = '')
    `);

    console.log(`✅ Synchronized ${result.rowCount} employee photos to profiles`);

    await client.query('COMMIT');
    console.log('✅ Migration 158 completed successfully');

    res.json({
      success: true,
      message: `Migration 158 completed: ${result.rowCount} employee photos synchronized to profiles`
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 158 failed:', error);
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
    // Count employees with photos that are not synced to profiles
    const result = await pool.query(`
      SELECT COUNT(*) as unsynced_count
      FROM hr_employees e
      JOIN profiles p ON e.profile_id = p.id
      WHERE e.photo_url IS NOT NULL
        AND (p.profile_image_url IS NULL OR p.profile_image_url = '' OR p.profile_image_url != e.photo_url)
    `);

    const unsyncedCount = parseInt(result.rows[0].unsynced_count);

    res.json({
      success: true,
      migrated: unsyncedCount === 0,
      unsynced_count: unsyncedCount,
      message: unsyncedCount === 0
        ? 'All employee photos are synchronized with profiles'
        : `${unsyncedCount} employee photo(s) need to be synchronized`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
