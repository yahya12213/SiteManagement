/**
 * Migration 135: Fix hr_overtime_records rate_type constraint
 *
 * BUG #2 FIX: Add 'extended' to allowed rate_type values
 * This allows the 50% rate to be properly tracked and calculated in payroll
 *
 * Before: rate_type IN ('normal', 'night', 'weekend', 'holiday')
 * After: rate_type IN ('normal', 'extended', 'night', 'weekend', 'holiday')
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Migration 135: Fixing hr_overtime_records rate_type constraint...');

    // Drop the existing CHECK constraint
    await client.query(`
      ALTER TABLE hr_overtime_records
      DROP CONSTRAINT IF EXISTS hr_overtime_records_rate_type_check
    `);

    // Add new CHECK constraint with 'extended' included
    await client.query(`
      ALTER TABLE hr_overtime_records
      ADD CONSTRAINT hr_overtime_records_rate_type_check
      CHECK (rate_type IN ('normal', 'extended', 'night', 'weekend', 'holiday'))
    `);

    console.log('Migration 135: rate_type constraint updated successfully');

    // Also update hr_overtime_periods to ensure consistency
    // This table already allows: 'normal', 'extended', 'special'
    // No changes needed there

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 135 completed: hr_overtime_records rate_type now accepts extended',
      changes: [
        "Added 'extended' to hr_overtime_records rate_type CHECK constraint",
        "Rate type values now: normal (25%), extended (50%), night/weekend/holiday (100%)"
      ]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 135 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Check if there are existing records with invalid rate_type values'
    });
  } finally {
    client.release();
  }
});

// Status endpoint for MigrationPanel
router.get('/status', async (req, res) => {
  try {
    // Check if constraint already includes 'extended'
    const constraintCheck = await pool.query(`
      SELECT pg_get_constraintdef(oid) as constraint_def
      FROM pg_constraint
      WHERE conrelid = 'hr_overtime_records'::regclass
        AND contype = 'c'
        AND conname LIKE '%rate_type%'
    `);

    const hasExtended = constraintCheck.rows[0]?.constraint_def?.includes('extended');

    res.json({
      success: true,
      applied: hasExtended,
      message: hasExtended
        ? 'Migration déjà appliquée - rate_type accepte "extended"'
        : 'Migration non appliquée - rate_type n\'accepte pas "extended"'
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Check current state
router.get('/check', async (req, res) => {
  try {
    // Check current constraint definition
    const constraintCheck = await pool.query(`
      SELECT
        conname as constraint_name,
        pg_get_constraintdef(oid) as constraint_def
      FROM pg_constraint
      WHERE conrelid = 'hr_overtime_records'::regclass
        AND contype = 'c'
        AND conname LIKE '%rate_type%'
    `);

    // Check existing rate_type values
    const valuesCheck = await pool.query(`
      SELECT rate_type, COUNT(*) as count
      FROM hr_overtime_records
      GROUP BY rate_type
      ORDER BY rate_type
    `);

    res.json({
      success: true,
      current_constraint: constraintCheck.rows,
      existing_values: valuesCheck.rows,
      migration_needed: !constraintCheck.rows[0]?.constraint_def?.includes('extended')
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
