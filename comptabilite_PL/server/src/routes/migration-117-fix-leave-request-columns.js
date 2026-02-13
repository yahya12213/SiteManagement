/**
 * Migration 117: Add missing approval timestamp columns to hr_leave_requests
 *
 * Problem: The code uses n1_approved_at, n2_approved_at, hr_approved_at
 * but migration 043 created the table with n1_action_at, n2_action_at, hr_action_at
 *
 * Solution: Add the missing columns to fix the "column does not exist" error
 */

import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.post('/run',
  authenticateToken,
  requireRole('admin', 'gerant'),
  async (req, res) => {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      console.log('=== Migration 117: Fix hr_leave_requests columns ===');

      // Add missing columns to hr_leave_requests
      console.log('Adding n1_approved_at column...');
      await client.query(`
        ALTER TABLE hr_leave_requests
        ADD COLUMN IF NOT EXISTS n1_approved_at TIMESTAMP
      `);

      console.log('Adding n2_approved_at column...');
      await client.query(`
        ALTER TABLE hr_leave_requests
        ADD COLUMN IF NOT EXISTS n2_approved_at TIMESTAMP
      `);

      console.log('Adding hr_approved_at column...');
      await client.query(`
        ALTER TABLE hr_leave_requests
        ADD COLUMN IF NOT EXISTS hr_approved_at TIMESTAMP
      `);

      // Copy data from action_at columns if they exist and approved_at columns are empty
      console.log('Copying data from action_at to approved_at columns...');
      await client.query(`
        UPDATE hr_leave_requests
        SET
          n1_approved_at = COALESCE(n1_approved_at, n1_action_at),
          n2_approved_at = COALESCE(n2_approved_at, n2_action_at),
          hr_approved_at = COALESCE(hr_approved_at, hr_action_at)
        WHERE n1_action_at IS NOT NULL OR n2_action_at IS NOT NULL OR hr_action_at IS NOT NULL
      `);

      await client.query('COMMIT');

      // Verify columns exist
      const columnsCheck = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'hr_leave_requests'
        AND column_name IN ('n1_approved_at', 'n2_approved_at', 'hr_approved_at')
      `);

      console.log('=== Migration 117 Complete ===');

      res.json({
        success: true,
        message: 'Migration 117 completed - Added approval timestamp columns',
        columns_added: columnsCheck.rows.map(r => r.column_name)
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Migration 117 failed:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    } finally {
      client.release();
    }
  }
);

router.get('/status',
  authenticateToken,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'hr_leave_requests'
        AND column_name IN ('n1_approved_at', 'n2_approved_at', 'hr_approved_at')
      `);

      const hasAllColumns = result.rows.length === 3;

      res.json({
        success: true,
        migrated: hasAllColumns,
        columns: result.rows.map(r => r.column_name)
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

export default router;
