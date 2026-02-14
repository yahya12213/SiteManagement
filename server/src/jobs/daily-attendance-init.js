/**
 * Daily Attendance Initialization Job
 *
 * Crée automatiquement une ligne de pointage pour chaque employé actif
 * au début de chaque journée.
 *
 * Job:
 * - 00:05 - Initialiser les lignes de pointage pour TODAY
 *
 * Cela permet aux employés de voir le jour dans leur historique
 * même avant de pointer.
 */

import pg from 'pg';
import cron from 'node-cron';
import { AttendanceCalculator } from '../services/attendance-calculator.js';
import { getSystemDate } from '../services/system-clock.js';

const { Pool } = pg;

const getPool = () => new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Initialiser les lignes de pointage pour aujourd'hui
 * Crée une ligne 'pending' ou statut spécial pour chaque employé actif
 */
export const initializeDailyAttendance = async () => {
  const pool = getPool();
  const calculator = new AttendanceCalculator(pool);

  try {
    // Utiliser l'horloge système configurable
    const today = await getSystemDate(pool);

    console.log(`[DAILY INIT] Initializing attendance records for ${today}...`);

    // Get all active employees who require clocking
    const employees = await pool.query(`
      SELECT
        e.id,
        e.employee_number,
        e.first_name,
        e.last_name,
        es.schedule_id,
        ws.start_time as scheduled_start,
        ws.end_time as scheduled_end,
        ws.break_duration_minutes as scheduled_break_minutes
      FROM hr_employees e
      LEFT JOIN hr_employee_schedules es ON es.employee_id = e.id AND es.is_primary = true
      LEFT JOIN hr_work_schedules ws ON ws.id = es.schedule_id
      WHERE e.employment_status = 'active'
        AND e.requires_clocking = true
    `);

    console.log(`[DAILY INIT] Processing ${employees.rows.length} employees...`);

    let createdCount = 0;
    let existingCount = 0;
    let specialDayCount = 0;

    for (const employee of employees.rows) {
      // Check if already has a record for today
      const existing = await pool.query(`
        SELECT id FROM hr_attendance_daily
        WHERE employee_id = $1 AND work_date = $2
      `, [employee.id, today]);

      // If record exists, skip
      if (existing.rows.length > 0) {
        existingCount++;
        continue;
      }

      // Use calculator to determine what the status should be
      // This handles holidays, leaves, recovery days, weekends, etc.
      const calcResult = await calculator.calculateDayStatus(
        employee.id,
        today,
        null,  // no clock in yet
        null   // no clock out yet
      );

      // Determine the initial status
      let dayStatus = 'pending';
      let notes = null;

      // If it's a special day, use that status instead of pending
      if (['holiday', 'weekend', 'leave', 'recovery_off', 'recovery_paid', 'recovery_unpaid', 'sick', 'mission', 'training'].includes(calcResult.day_status)) {
        dayStatus = calcResult.day_status;
        notes = calcResult.notes;
        specialDayCount++;
      }

      // Create the attendance record
      await pool.query(`
        INSERT INTO hr_attendance_daily (
          employee_id,
          work_date,
          day_status,
          scheduled_start,
          scheduled_end,
          scheduled_break_minutes,
          source,
          notes,
          created_by,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, 'system', $7, 'SYSTEM', NOW())
        ON CONFLICT (employee_id, work_date) DO NOTHING
      `, [
        employee.id,
        today,
        dayStatus,
        employee.scheduled_start,
        employee.scheduled_end,
        employee.scheduled_break_minutes || 0,
        notes
      ]);

      createdCount++;
    }

    console.log(`[DAILY INIT] Complete:`);
    console.log(`  - ${createdCount} records created`);
    console.log(`  - ${existingCount} already existed`);
    console.log(`  - ${specialDayCount} special days (holiday, weekend, leave, etc.)`);

    return {
      date: today,
      created: createdCount,
      existing: existingCount,
      specialDays: specialDayCount,
      total: employees.rows.length
    };

  } catch (error) {
    console.error('[DAILY INIT] Error:', error);
    throw error;
  } finally {
    await pool.end();
  }
};

/**
 * Démarrer le job CRON d'initialisation quotidienne
 */
export const startDailyAttendanceInitJob = () => {
  // Job: Initialiser les lignes de pointage à 00:05
  cron.schedule('5 0 * * *', async () => {
    console.log('[CRON] Running daily attendance initialization...');
    await initializeDailyAttendance();
  }, {
    scheduled: true,
    timezone: "Africa/Casablanca"
  });

  console.log('  - Daily attendance init: daily at 00:05 (Africa/Casablanca)');
};

// Export for manual execution (API endpoint, testing)
export default {
  initializeDailyAttendance,
  startDailyAttendanceInitJob
};
