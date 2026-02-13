/**
 * Migration 146: Ajouter colonne is_working_day pour calcul paie
 *
 * Ajoute une colonne boolean pour indiquer si le jour est un jour ouvrable
 * selon le modèle horaire de l'employé.
 *
 * Règle métier:
 * - Férié sur jour ouvrable → paie calculée
 * - Férié sur weekend → pas de paie
 * - Récupération sur jour ouvrable → paie calculée
 * - Récupération sur weekend → pas de paie
 */

import express from 'express';
import pg from 'pg';

const { Pool } = pg;
const router = express.Router();

const getPool = () => new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Check migration status
 */
router.get('/status', async (req, res) => {
  const pool = getPool();

  try {
    // Check if is_working_day column exists
    const columnCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'hr_attendance_daily'
        AND column_name = 'is_working_day'
    `);

    const applied = columnCheck.rows.length > 0;

    res.json({
      success: true,
      applied,
      message: applied
        ? 'Migration applied: is_working_day column exists'
        : 'Migration needed: is_working_day column missing'
    });
  } catch (error) {
    console.error('Migration 146 status check error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * Run migration
 */
router.post('/run', async (req, res) => {
  const pool = getPool();

  try {
    console.log('Migration 146: Adding is_working_day column...');

    const results = {
      column_added: false,
      defaults_set: 0
    };

    // 1. Add is_working_day column if not exists
    const columnCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'hr_attendance_daily'
        AND column_name = 'is_working_day'
    `);

    if (columnCheck.rows.length === 0) {
      await pool.query(`
        ALTER TABLE hr_attendance_daily
        ADD COLUMN is_working_day BOOLEAN DEFAULT true
      `);
      results.column_added = true;
      console.log('  - Column is_working_day added');
    }

    // 2. Set is_working_day = false for weekend records
    // Weekend = Saturday (6) or Sunday (0) in JavaScript, but we use work_date directly
    const updateWeekends = await pool.query(`
      UPDATE hr_attendance_daily
      SET is_working_day = false
      WHERE EXTRACT(DOW FROM work_date) IN (0, 6)
        AND is_working_day IS NOT false
    `);
    results.weekends_updated = updateWeekends.rowCount;
    console.log(`  - ${updateWeekends.rowCount} weekend records updated to is_working_day=false`);

    // 3. Set is_working_day based on employee's schedule working_days
    // This is more complex - we need to join with schedules
    const updateFromSchedule = await pool.query(`
      WITH employee_schedules AS (
        SELECT DISTINCT ON (es.employee_id)
          es.employee_id,
          ws.working_days
        FROM hr_employee_schedules es
        JOIN hr_work_schedules ws ON ws.id = es.schedule_id
        WHERE ws.is_active = true
        ORDER BY es.employee_id, es.start_date DESC
      )
      UPDATE hr_attendance_daily ad
      SET is_working_day = (
        -- Convert PostgreSQL DOW (0=Sunday) to ISO (1=Monday, 7=Sunday)
        CASE EXTRACT(DOW FROM ad.work_date)
          WHEN 0 THEN 7  -- Sunday
          ELSE EXTRACT(DOW FROM ad.work_date)::integer
        END
      ) = ANY(es.working_days)
      FROM employee_schedules es
      WHERE ad.employee_id = es.employee_id
        AND es.working_days IS NOT NULL
    `);
    results.schedule_based_updates = updateFromSchedule.rowCount;
    console.log(`  - ${updateFromSchedule.rowCount} records updated based on employee schedules`);

    res.json({
      success: true,
      message: 'Migration 146 completed successfully',
      details: results
    });
  } catch (error) {
    console.error('Migration 146 run error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

/**
 * Rollback migration
 */
router.post('/rollback', async (req, res) => {
  const pool = getPool();

  try {
    await pool.query(`
      ALTER TABLE hr_attendance_daily
      DROP COLUMN IF EXISTS is_working_day
    `);

    res.json({
      success: true,
      message: 'Migration 146 rolled back successfully'
    });
  } catch (error) {
    console.error('Migration 146 rollback error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

export default router;
