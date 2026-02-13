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

    console.log('=== Migration 120: Nullable Schedule Config (Phase 2 - Incohérence #5) ===');
    console.log('Purpose: Allow NULL values in hr_work_schedules to enable fallback to global settings');

    // Step 1: Remove DEFAULT constraints and allow NULL
    console.log('Step 1: Removing DEFAULT constraints...');

    await client.query(`
      ALTER TABLE hr_work_schedules
        ALTER COLUMN tolerance_late_minutes DROP DEFAULT,
        ALTER COLUMN tolerance_early_leave_minutes DROP DEFAULT,
        ALTER COLUMN min_hours_for_half_day DROP DEFAULT
    `);

    console.log('✓ DEFAULT constraints removed');

    // Step 2: Verify the changes
    console.log('Step 2: Verifying schema changes...');

    const schemaCheck = await client.query(`
      SELECT
        column_name,
        column_default,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'hr_work_schedules'
        AND column_name IN ('tolerance_late_minutes', 'tolerance_early_leave_minutes', 'min_hours_for_half_day')
      ORDER BY column_name
    `);

    console.log('Schema verification:');
    schemaCheck.rows.forEach(row => {
      console.log(`  - ${row.column_name}: default=${row.column_default || 'NULL'}, nullable=${row.is_nullable}`);
    });

    // Step 3: Count existing schedules and their configurations
    console.log('Step 3: Analyzing existing schedules...');

    const stats = await client.query(`
      SELECT
        COUNT(*) as total_schedules,
        COUNT(tolerance_late_minutes) as has_tolerance_late,
        COUNT(tolerance_early_leave_minutes) as has_tolerance_early,
        COUNT(min_hours_for_half_day) as has_min_hours
      FROM hr_work_schedules
    `);

    console.log('Existing schedule statistics:');
    console.log(`  - Total schedules: ${stats.rows[0].total_schedules}`);
    console.log(`  - With tolerance_late_minutes: ${stats.rows[0].has_tolerance_late}`);
    console.log(`  - With tolerance_early_leave_minutes: ${stats.rows[0].has_tolerance_early}`);
    console.log(`  - With min_hours_for_half_day: ${stats.rows[0].has_min_hours}`);

    await client.query('COMMIT');

    console.log('=== Migration 120 Complete ===');
    console.log('NOTE: hr-clocking.js and hr-attendance.js now need fallback logic for NULL values');

    res.json({
      success: true,
      message: 'Migration 120 completed - Schedule config columns are now nullable with fallback support',
      schema_changes: schemaCheck.rows,
      statistics: stats.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 120 Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  } finally {
    client.release();
    await pool.end();
  }
});

export default router;
