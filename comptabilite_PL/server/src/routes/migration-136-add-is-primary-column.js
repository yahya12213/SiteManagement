/**
 * Migration 136: Add is_primary column to hr_employee_schedules
 *
 * FIX: The code uses is_primary but the column was never created in migration 042
 * This migration adds the missing column to prevent 500 errors on employee-schedules endpoint
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Migration 136: Adding is_primary column to hr_employee_schedules...');

    // Check if column already exists
    const checkColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'hr_employee_schedules'
        AND column_name = 'is_primary'
    `);

    if (checkColumn.rows.length === 0) {
      // Add the is_primary column
      await client.query(`
        ALTER TABLE hr_employee_schedules
        ADD COLUMN is_primary BOOLEAN DEFAULT false
      `);
      console.log('Migration 136: is_primary column added successfully');
    } else {
      console.log('Migration 136: is_primary column already exists, skipping');
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 136 completed: is_primary column added to hr_employee_schedules',
      changes: [
        'Added is_primary BOOLEAN DEFAULT false to hr_employee_schedules'
      ]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 136 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Check if hr_employee_schedules table exists'
    });
  } finally {
    client.release();
  }
});

// Status endpoint for MigrationPanel
router.get('/status', async (req, res) => {
  try {
    const columnCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'hr_employee_schedules'
        AND column_name = 'is_primary'
    `);

    const hasColumn = columnCheck.rows.length > 0;

    res.json({
      success: true,
      applied: hasColumn,
      message: hasColumn
        ? 'Migration déjà appliquée - colonne is_primary existe'
        : 'Migration non appliquée - colonne is_primary manquante'
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
