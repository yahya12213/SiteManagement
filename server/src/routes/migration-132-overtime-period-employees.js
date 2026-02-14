/**
 * Migration 132: Créer table hr_overtime_period_employees
 * Permet la sélection manuelle des employés concernés par une période HS
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('🔄 Starting Migration 132 - Overtime Period Employees...');
    await client.query('BEGIN');

    // 1. Créer la table hr_overtime_period_employees
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_overtime_period_employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        period_id UUID NOT NULL REFERENCES hr_overtime_periods(id) ON DELETE CASCADE,
        employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        selected_by TEXT REFERENCES profiles(id),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(period_id, employee_id)
      )
    `);
    console.log('✅ Table hr_overtime_period_employees créée');

    // 2. Créer les index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ot_period_emp_period
      ON hr_overtime_period_employees(period_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_ot_period_emp_employee
      ON hr_overtime_period_employees(employee_id)
    `);
    console.log('✅ Index créés');

    await client.query('COMMIT');
    console.log('✅ Migration 132 completed successfully!');

    res.json({
      success: true,
      message: 'Migration 132 - Table hr_overtime_period_employees créée avec succès',
      details: {
        table_created: 'hr_overtime_period_employees',
        indexes_created: ['idx_ot_period_emp_period', 'idx_ot_period_emp_employee']
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 132 failed:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

router.get('/status', async (req, res) => {
  try {
    // Vérifier si la table existe
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'hr_overtime_period_employees'
      )
    `);

    const applied = tableExists.rows[0].exists;

    // Compter les enregistrements si la table existe
    let recordCount = 0;
    if (applied) {
      const countResult = await pool.query(`
        SELECT COUNT(*) as count FROM hr_overtime_period_employees
      `);
      recordCount = parseInt(countResult.rows[0].count);
    }

    res.json({
      success: true,
      applied,
      needsRun: !applied,
      details: {
        table_exists: applied,
        record_count: recordCount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
