/**
 * Migration 145: Remplacer dates période objectif par jour de coupure paie
 *
 * Au lieu de dates fixes (objective_period_start, objective_period_end),
 * utilise un jour de coupure mensuel (payroll_cutoff_day).
 *
 * Exemple avec payroll_cutoff_day = 18:
 * - Paie janvier 2026 = 19/12/2025 au 18/01/2026
 * - Paie février 2026 = 19/01/2026 au 18/02/2026
 * - Paie mars 2026 = 19/02/2026 au 18/03/2026
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * Check migration status
 */
router.get('/status', async (req, res) => {
  try {
    // Check if payroll_cutoff_day column exists in hr_employees
    const columnCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'hr_employees'
        AND column_name = 'payroll_cutoff_day'
    `);

    const applied = columnCheck.rows.length > 0;

    res.json({
      success: true,
      applied,
      message: applied
        ? 'Migration applied: payroll_cutoff_day column exists'
        : 'Migration needed: payroll_cutoff_day column missing',
      details: {
        payroll_cutoff_day_exists: columnCheck.rows.length > 0
      }
    });
  } catch (error) {
    console.error('Migration 145 status check error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Run migration
 */
router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const results = {
      columns_added: [],
      columns_dropped: [],
      defaults_set: 0
    };

    // 1. Add payroll_cutoff_day column if not exists
    const columnCheck = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'hr_employees'
        AND column_name = 'payroll_cutoff_day'
    `);

    if (columnCheck.rows.length === 0) {
      await client.query(`
        ALTER TABLE hr_employees
        ADD COLUMN payroll_cutoff_day INTEGER DEFAULT 18
        CHECK (payroll_cutoff_day >= 1 AND payroll_cutoff_day <= 28)
      `);
      results.columns_added.push('payroll_cutoff_day');
    }

    // 2. Set default value for existing employees without value
    const updateResult = await client.query(`
      UPDATE hr_employees
      SET payroll_cutoff_day = 18
      WHERE payroll_cutoff_day IS NULL
    `);
    results.defaults_set = updateResult.rowCount;

    // 3. Optionally drop old columns (commented out to preserve data)
    // await client.query(`
    //   ALTER TABLE hr_employees
    //   DROP COLUMN IF EXISTS objective_period_start,
    //   DROP COLUMN IF EXISTS objective_period_end
    // `);
    // results.columns_dropped.push('objective_period_start', 'objective_period_end');

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 145 completed successfully',
      details: results
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 145 run error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

/**
 * Rollback migration
 */
router.post('/rollback', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Drop payroll_cutoff_day column
    await client.query(`
      ALTER TABLE hr_employees
      DROP COLUMN IF EXISTS payroll_cutoff_day
    `);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 145 rolled back successfully'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 145 rollback error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

export default router;
