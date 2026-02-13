/**
 * Migration 069: Fix hr_attendance_records structure for clocking functionality
 *
 * Problem: hr-clocking.js expects 'clock_time' column and specific status/source values
 * that don't exist in the table created by Migration 042.
 *
 * Solution: Add missing column and update CHECK constraints to support both models:
 * - Legacy: attendance_date, check_in/check_out (used by hr-attendance.js)
 * - Clocking: clock_time, status='check_in'/'check_out' (used by hr-clocking.js)
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 069: Fix hr_attendance_records structure ===');

    // Step 1: Add clock_time column
    console.log('Step 1: Adding clock_time column...');
    await client.query(`
      ALTER TABLE hr_attendance_records
        ADD COLUMN IF NOT EXISTS clock_time TIMESTAMP
    `);
    console.log('✓ clock_time column added');

    // Step 1.5: Make attendance_date nullable to allow clocking model
    console.log('Step 1.5: Making attendance_date nullable...');
    await client.query(`
      ALTER TABLE hr_attendance_records
        ALTER COLUMN attendance_date DROP NOT NULL
    `);
    console.log('✓ attendance_date is now nullable');

    // Step 2: Update status CHECK constraint to include 'check_in' and 'check_out'
    console.log('Step 2: Updating status CHECK constraint...');
    await client.query(`
      ALTER TABLE hr_attendance_records
        DROP CONSTRAINT IF EXISTS hr_attendance_records_status_check
    `);
    await client.query(`
      ALTER TABLE hr_attendance_records
        ADD CONSTRAINT hr_attendance_records_status_check
        CHECK (status IN (
          'present', 'absent', 'late', 'half_day', 'holiday',
          'leave', 'weekend', 'mission', 'training',
          'check_in', 'check_out'
        ))
    `);
    console.log('✓ status CHECK constraint updated');

    // Step 3: Update source CHECK constraint to include 'self_service'
    console.log('Step 3: Updating source CHECK constraint...');
    await client.query(`
      ALTER TABLE hr_attendance_records
        DROP CONSTRAINT IF EXISTS hr_attendance_records_source_check
    `);
    await client.query(`
      ALTER TABLE hr_attendance_records
        ADD CONSTRAINT hr_attendance_records_source_check
        CHECK (source IN (
          'system', 'biometric', 'manual', 'import', 'self_service'
        ))
    `);
    console.log('✓ source CHECK constraint updated');

    // Step 4: Remove UNIQUE constraint to allow multiple records per day
    console.log('Step 4: Removing UNIQUE constraint on (employee_id, attendance_date)...');
    await client.query(`
      ALTER TABLE hr_attendance_records
        DROP CONSTRAINT IF EXISTS hr_attendance_records_employee_id_attendance_date_key
    `);
    console.log('✓ UNIQUE constraint removed');

    // Step 5: Create index on clock_time for performance
    console.log('Step 5: Creating index on clock_time...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hr_attendance_clock_time
        ON hr_attendance_records(clock_time)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hr_attendance_employee_clock
        ON hr_attendance_records(employee_id, clock_time)
    `);
    console.log('✓ Indexes created');

    await client.query('COMMIT');

    console.log('=== Migration 069 Complete ===');

    res.json({
      success: true,
      message: 'Migration 069 completed successfully - hr_attendance_records structure fixed',
      changes: [
        'Added clock_time TIMESTAMP column',
        'Made attendance_date nullable to support clocking model',
        'Updated status CHECK constraint to include check_in/check_out',
        'Updated source CHECK constraint to include self_service',
        'Removed UNIQUE(employee_id, attendance_date) constraint',
        'Created performance indexes on clock_time'
      ]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 069 error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Failed to update hr_attendance_records structure'
    });
  } finally {
    client.release();
  }
});

// Rollback migration
router.post('/rollback', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Rolling back Migration 069...');

    // Remove indexes
    await client.query(`
      DROP INDEX IF EXISTS idx_hr_attendance_employee_clock
    `);
    await client.query(`
      DROP INDEX IF EXISTS idx_hr_attendance_clock_time
    `);

    // Restore original constraints
    await client.query(`
      ALTER TABLE hr_attendance_records
        DROP CONSTRAINT IF EXISTS hr_attendance_records_source_check
    `);
    await client.query(`
      ALTER TABLE hr_attendance_records
        ADD CONSTRAINT hr_attendance_records_source_check
        CHECK (source IN ('system', 'biometric', 'manual', 'import'))
    `);

    await client.query(`
      ALTER TABLE hr_attendance_records
        DROP CONSTRAINT IF EXISTS hr_attendance_records_status_check
    `);
    await client.query(`
      ALTER TABLE hr_attendance_records
        ADD CONSTRAINT hr_attendance_records_status_check
        CHECK (status IN (
          'present', 'absent', 'late', 'half_day', 'holiday',
          'leave', 'weekend', 'mission', 'training'
        ))
    `);

    // Restore UNIQUE constraint
    await client.query(`
      ALTER TABLE hr_attendance_records
        ADD CONSTRAINT hr_attendance_records_employee_id_attendance_date_key
        UNIQUE (employee_id, attendance_date)
    `);

    // Restore NOT NULL on attendance_date
    await client.query(`
      ALTER TABLE hr_attendance_records
        ALTER COLUMN attendance_date SET NOT NULL
    `);

    // Remove clock_time column
    await client.query(`
      ALTER TABLE hr_attendance_records
        DROP COLUMN IF EXISTS clock_time
    `);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 069 rolled back successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Rollback 069 error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Check migration status
router.get('/status', async (req, res) => {
  try {
    // Check if clock_time column exists
    const columnCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'hr_attendance_records'
        AND column_name = 'clock_time'
    `);

    const clockTimeExists = columnCheck.rows.length > 0;

    // Check status constraint
    const statusConstraint = await pool.query(`
      SELECT constraint_name
      FROM information_schema.constraint_column_usage
      WHERE table_name = 'hr_attendance_records'
        AND constraint_name = 'hr_attendance_records_status_check'
    `);

    const statusConstraintExists = statusConstraint.rows.length > 0;

    const migrated = clockTimeExists && statusConstraintExists;

    res.json({
      status: {
        migrationNeeded: !migrated,
        applied: migrated,
        clock_time_column: clockTimeExists,
        updated_constraints: statusConstraintExists
      },
      message: migrated
        ? 'Migration 069 applied - hr_attendance_records structure is correct'
        : 'Migration needed - clock_time column or constraints missing'
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
