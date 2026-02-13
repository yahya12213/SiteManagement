/**
 * Migration 154: Add initial_leave_balance to hr_employees
 * Allows tracking initial leave balance per employee for payslip display
 */
import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.get('/run', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🚀 Starting migration 154: Add initial_leave_balance to hr_employees...');

    // Check if column already exists
    const checkColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'hr_employees' AND column_name = 'initial_leave_balance'
    `);

    if (checkColumn.rows.length === 0) {
      // Add initial_leave_balance column (in days)
      await client.query(`
        ALTER TABLE hr_employees
        ADD COLUMN initial_leave_balance DECIMAL(5,2) DEFAULT 0
      `);
      console.log('✅ Added initial_leave_balance column to hr_employees table');

      // Also add leave_balance_updated_at for tracking
      await client.query(`
        ALTER TABLE hr_employees
        ADD COLUMN IF NOT EXISTS leave_balance_updated_at TIMESTAMP
      `);
      console.log('✅ Added leave_balance_updated_at column');
    } else {
      console.log('ℹ️ initial_leave_balance column already exists in hr_employees table');
    }

    await client.query('COMMIT');
    console.log('✅ Migration 154 completed successfully');

    res.json({
      success: true,
      message: 'Migration 154 completed: initial_leave_balance column added to hr_employees table'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 154 failed:', error);
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
      WHERE table_name = 'hr_employees' AND column_name = 'initial_leave_balance'
    `);

    res.json({
      success: true,
      migrated: result.rows.length > 0,
      message: result.rows.length > 0
        ? 'initial_leave_balance column exists in hr_employees table'
        : 'initial_leave_balance column does not exist'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
