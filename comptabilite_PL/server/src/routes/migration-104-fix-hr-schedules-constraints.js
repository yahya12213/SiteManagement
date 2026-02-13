/**
 * Migration 104: Fix hr_work_schedules constraints
 *
 * Problem: The start_time and end_time columns are NOT NULL but the new code
 * uses day-specific columns (monday_start, tuesday_start, etc.) instead.
 * This causes INSERT failures when creating new schedules.
 *
 * Solution: Make start_time and end_time nullable with default values.
 */

import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 104: Fix hr_work_schedules constraints ===');

    // Step 1: Check if start_time and end_time columns exist and have NOT NULL constraint
    console.log('Step 1: Checking start_time and end_time constraints...');

    const checkConstraints = await client.query(`
      SELECT column_name, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'hr_work_schedules'
        AND column_name IN ('start_time', 'end_time')
    `);

    console.log('Current constraints:', checkConstraints.rows);

    // Step 2: Make start_time nullable with default
    const startTimeCol = checkConstraints.rows.find(r => r.column_name === 'start_time');
    if (startTimeCol) {
      if (startTimeCol.is_nullable === 'NO') {
        console.log('Step 2: Making start_time nullable...');
        await client.query(`
          ALTER TABLE hr_work_schedules
          ALTER COLUMN start_time DROP NOT NULL
        `);
        console.log('  ✓ start_time is now nullable');
      } else {
        console.log('  ✓ start_time is already nullable');
      }

      // Set default value
      await client.query(`
        ALTER TABLE hr_work_schedules
        ALTER COLUMN start_time SET DEFAULT '08:30'
      `);
      console.log('  ✓ start_time default set to 08:30');
    } else {
      console.log('  ✓ start_time column does not exist (skipping)');
    }

    // Step 3: Make end_time nullable with default
    const endTimeCol = checkConstraints.rows.find(r => r.column_name === 'end_time');
    if (endTimeCol) {
      if (endTimeCol.is_nullable === 'NO') {
        console.log('Step 3: Making end_time nullable...');
        await client.query(`
          ALTER TABLE hr_work_schedules
          ALTER COLUMN end_time DROP NOT NULL
        `);
        console.log('  ✓ end_time is now nullable');
      } else {
        console.log('  ✓ end_time is already nullable');
      }

      // Set default value
      await client.query(`
        ALTER TABLE hr_work_schedules
        ALTER COLUMN end_time SET DEFAULT '17:30'
      `);
      console.log('  ✓ end_time default set to 17:30');
    } else {
      console.log('  ✓ end_time column does not exist (skipping)');
    }

    await client.query('COMMIT');

    console.log('=== Migration 104 Complete ===');

    res.json({
      success: true,
      message: 'Migration 104 completed successfully - hr_work_schedules constraints fixed',
      details: {
        start_time: startTimeCol ? 'Now nullable with default 08:30' : 'Column not found',
        end_time: endTimeCol ? 'Now nullable with default 17:30' : 'Column not found'
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 104 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
    await pool.end();
  }
});

export default router;
