/**
 * Absence Detection Job - Version Refactorisée
 *
 * Utilise la nouvelle table hr_attendance_daily
 * et les services AttendanceCalculator et AttendanceLogger.
 *
 * Jobs:
 * - 20:30 - Finaliser les journées incomplètes (pending → partial)
 * - 21:00 - Détecter les absences (créer records 'absent')
 *
 * Note: Utilise l'horloge système configurable pour les dates
 */

import pg from 'pg';
import cron from 'node-cron';
import { AttendanceCalculator } from '../services/attendance-calculator.js';
import { AttendanceLogger } from '../services/attendance-logger.js';
import { getSystemDate, getSystemTime } from '../services/system-clock.js';

const { Pool } = pg;

const getPool = () => new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Finaliser les journées incomplètes
 * Change 'pending' -> 'partial' si pas de checkout à la fin de la journée
 */
export const finalizePendingDays = async () => {
  const pool = getPool();
  const logger = new AttendanceLogger(pool);

  try {
    // Utiliser l'horloge système configurable
    const today = await getSystemDate(pool);

    console.log(`[FINALIZE JOB] Checking ${today} for pending records...`);

    const result = await pool.query(`
      UPDATE hr_attendance_daily
      SET
        day_status = 'partial',
        notes = COALESCE(notes || ' | ', '') || 'Journée incomplète - pas de sortie enregistrée',
        is_anomaly = true,
        anomaly_type = 'no_check_out',
        updated_at = NOW()
      WHERE work_date = $1
        AND day_status = 'pending'
        AND clock_in_at IS NOT NULL
        AND clock_out_at IS NULL
      RETURNING id, employee_id, work_date
    `, [today]);

    console.log(`[FINALIZE JOB] ${result.rows.length} journée(s) marquée(s) comme partielle(s)`);

    // Log each finalization
    for (const row of result.rows) {
      await logger.logStatusChange(
        row.id,
        row.employee_id,
        row.work_date,
        'pending',
        'partial',
        'Journée incomplète - pas de sortie enregistrée',
        'SYSTEM'
      );
    }

  } catch (error) {
    console.error('[FINALIZE JOB] Error:', error);
  } finally {
    await pool.end();
  }
};

/**
 * Détecter et enregistrer les absences
 * Crée un enregistrement 'absent' pour les employés sans pointage
 */
export const detectAbsences = async () => {
  const pool = getPool();
  const calculator = new AttendanceCalculator(pool);
  const logger = new AttendanceLogger(pool);

  try {
    // Utiliser l'horloge système configurable
    const systemTime = await getSystemTime(pool);
    const yesterday = new Date(systemTime);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    console.log(`[ABSENCE DETECTION] Checking ${yesterdayStr}...`);

    // Get all active employees who require clocking
    const employees = await pool.query(`
      SELECT id, employee_number, first_name, last_name
      FROM hr_employees
      WHERE employment_status = 'active' AND requires_clocking = true
    `);

    console.log(`[ABSENCE DETECTION] Checking ${employees.rows.length} employees...`);

    let absenceCount = 0;
    let skippedCount = 0;

    for (const employee of employees.rows) {
      // Check if already has a record for yesterday
      const existing = await pool.query(`
        SELECT id, day_status FROM hr_attendance_daily
        WHERE employee_id = $1 AND work_date = $2
      `, [employee.id, yesterdayStr]);

      // If record exists, skip
      if (existing.rows.length > 0) {
        continue;
      }

      // Use calculator to determine what the status should be
      // This handles holidays, leaves, recovery days, weekends, etc.
      const calcResult = await calculator.calculateDayStatus(
        employee.id,
        yesterdayStr,
        null,  // no clock in
        null   // no clock out
      );

      // Only create absence record if it's actually an absence
      // (not holiday, leave, recovery, weekend, etc.)
      if (calcResult.day_status === 'absent') {
        const result = await pool.query(`
          INSERT INTO hr_attendance_daily (
            employee_id,
            work_date,
            day_status,
            source,
            notes,
            is_anomaly,
            anomaly_type,
            created_by,
            created_at
          ) VALUES ($1, $2, 'absent', 'system', 'Détecté automatiquement - aucun pointage', true, 'missing_record', 'SYSTEM', NOW())
          RETURNING id
        `, [employee.id, yesterdayStr]);

        // Log the absence
        await logger.logSystemAbsence(
          result.rows[0].id,
          employee.id,
          yesterdayStr
        );

        console.log(`  → ABSENT: ${employee.first_name} ${employee.last_name} (${employee.employee_number})`);
        absenceCount++;
      } else {
        // Create record with special status (holiday, weekend, etc.)
        // but only if it should have a record
        if (['holiday', 'weekend', 'recovery_off', 'leave'].includes(calcResult.day_status)) {
          await pool.query(`
            INSERT INTO hr_attendance_daily (
              employee_id,
              work_date,
              day_status,
              source,
              notes,
              created_by,
              created_at
            ) VALUES ($1, $2, $3, 'system', $4, 'SYSTEM', NOW())
            ON CONFLICT (employee_id, work_date) DO NOTHING
          `, [employee.id, yesterdayStr, calcResult.day_status, calcResult.notes]);
        }
        skippedCount++;
      }
    }

    console.log(`[ABSENCE DETECTION] Complete - ${absenceCount} absences recorded, ${skippedCount} skipped`);
  } catch (error) {
    console.error('[ABSENCE DETECTION] Error:', error);
  } finally {
    await pool.end();
  }
};

/**
 * Démarrer tous les jobs CRON de pointage
 */
export const startAbsenceDetectionJob = () => {
  // Job 1: Finaliser les journées incomplètes à 20:30
  cron.schedule('30 20 * * *', async () => {
    console.log('[CRON] Running pending days finalization...');
    await finalizePendingDays();
  }, {
    scheduled: true,
    timezone: "Africa/Casablanca"
  });

  // Job 2: Détecter les absences à 21:00
  cron.schedule('0 21 * * *', async () => {
    console.log('[CRON] Running absence detection...');
    await detectAbsences();
  }, {
    scheduled: true,
    timezone: "Africa/Casablanca"
  });

  console.log('[CRON] Attendance jobs scheduled:');
  console.log('  - Pending finalization: daily at 20:30 (Africa/Casablanca)');
  console.log('  - Absence detection: daily at 21:00 (Africa/Casablanca)');
};

// Export for manual execution (migrations, testing)
export default {
  detectAbsences,
  finalizePendingDays,
  startAbsenceDetectionJob
};
