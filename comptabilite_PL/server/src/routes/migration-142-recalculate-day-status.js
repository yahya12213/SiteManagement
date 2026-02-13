/**
 * Migration 142: Recalculer les statuts de pointage (day_status)
 *
 * Recalcule day_status pour toutes les lignes hr_attendance_daily
 * basé sur les déclarations de récupération et jours fériés.
 *
 * Utile pour corriger les désynchronisations entre:
 * - Vue employé et vue admin
 * - Pointages créés avant les déclarations de récupération
 */

import express from 'express';
import pg from 'pg';
import { AttendanceCalculator } from '../services/attendance-calculator.js';

const { Pool } = pg;
const router = express.Router();

const getPool = () => new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Run migration
router.post('/run', async (req, res) => {
  const pool = getPool();
  const calculator = new AttendanceCalculator(pool);

  try {
    console.log('Migration 142: Recalculating day_status for all attendance records...');

    // Get all attendance records that might need recalculation
    // Note: Format timestamps with Morocco timezone to get local time directly
    const records = await pool.query(`
      SELECT
        ad.id,
        ad.employee_id,
        ad.work_date,
        ad.day_status as current_status,
        -- Formater avec timezone Maroc pour obtenir l'heure locale directement
        TO_CHAR(ad.clock_in_at AT TIME ZONE 'Africa/Casablanca', 'YYYY-MM-DD"T"HH24:MI:SS"+01:00"') as clock_in_at,
        TO_CHAR(ad.clock_out_at AT TIME ZONE 'Africa/Casablanca', 'YYYY-MM-DD"T"HH24:MI:SS"+01:00"') as clock_out_at,
        ad.scheduled_start,
        ad.scheduled_end,
        ad.early_leave_minutes,
        ad.late_minutes,
        ad.net_worked_minutes,
        ad.gross_worked_minutes
      FROM hr_attendance_daily ad
      JOIN hr_employees e ON ad.employee_id = e.id
      WHERE e.employment_status = 'active'
        AND e.requires_clocking = true
      ORDER BY ad.work_date DESC
    `);

    console.log(`  - Found ${records.rows.length} records to check`);

    let updatedCount = 0;
    let unchangedCount = 0;
    const changes = [];

    for (const row of records.rows) {
      try {
        // Recalculate status using AttendanceCalculator
        const calcResult = await calculator.calculateDayStatus(
          row.employee_id,
          row.work_date instanceof Date
            ? row.work_date.toISOString().split('T')[0]
            : row.work_date,
          row.clock_in_at,
          row.clock_out_at
        );

        const newStatus = calcResult.day_status;

        // Check if status or values changed
        const needsUpdate = newStatus !== row.current_status ||
          calcResult.scheduled_start !== row.scheduled_start ||
          calcResult.scheduled_end !== row.scheduled_end ||
          calcResult.early_leave_minutes !== row.early_leave_minutes ||
          calcResult.late_minutes !== row.late_minutes ||
          calcResult.net_worked_minutes !== row.net_worked_minutes ||
          calcResult.gross_worked_minutes !== row.gross_worked_minutes;

        if (needsUpdate) {
          // Update the record with all calculated values
          await pool.query(`
            UPDATE hr_attendance_daily
            SET
              day_status = $1,
              scheduled_start = $2,
              scheduled_end = $3,
              scheduled_break_minutes = $4,
              gross_worked_minutes = $5,
              net_worked_minutes = $6,
              late_minutes = $7,
              early_leave_minutes = $8,
              overtime_minutes = $9,
              is_working_day = $10,
              notes = COALESCE(notes || ' | ', '') || $11,
              updated_at = NOW()
            WHERE id = $12
          `, [
            newStatus,
            calcResult.scheduled_start,
            calcResult.scheduled_end,
            calcResult.scheduled_break_minutes || 0,
            calcResult.gross_worked_minutes,
            calcResult.net_worked_minutes,
            calcResult.late_minutes || 0,
            calcResult.early_leave_minutes || 0,
            calcResult.overtime_minutes || 0,
            calcResult.is_working_day !== false, // Default to true if undefined
            `Recalculé: ${row.current_status} → ${newStatus} (Migration 142)`,
            row.id
          ]);

          const dateStr = row.work_date instanceof Date
            ? row.work_date.toISOString().split('T')[0]
            : row.work_date;

          changes.push({
            date: dateStr,
            employee_id: row.employee_id,
            old_status: row.current_status,
            new_status: newStatus
          });

          updatedCount++;
          console.log(`  ✓ ${dateStr}: ${row.current_status} → ${newStatus}`);
        } else {
          unchangedCount++;
        }
      } catch (err) {
        console.error(`  ✗ Error processing record ${row.id}:`, err.message);
      }
    }

    console.log(`Migration 142 complete:`);
    console.log(`  - ${updatedCount} records updated`);
    console.log(`  - ${unchangedCount} records unchanged`);

    res.json({
      success: true,
      message: `Migration 142: ${updatedCount} statuts recalculés`,
      stats: {
        total: records.rows.length,
        updated: updatedCount,
        unchanged: unchangedCount
      },
      changes: changes.slice(0, 50) // Limit to first 50 changes in response
    });

  } catch (error) {
    console.error('Migration 142 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Vérifiez que AttendanceCalculator est correctement importé'
    });
  } finally {
    await pool.end();
  }
});

// Status endpoint
router.get('/status', async (req, res) => {
  const pool = getPool();

  try {
    // Count records by status
    const stats = await pool.query(`
      SELECT
        day_status,
        COUNT(*) as count
      FROM hr_attendance_daily
      GROUP BY day_status
      ORDER BY count DESC
    `);

    // Count records that might be out of sync
    // (have clock data but status is 'absent' or vice versa)
    const anomalies = await pool.query(`
      SELECT COUNT(*) as count
      FROM hr_attendance_daily
      WHERE (day_status = 'absent' AND clock_in_at IS NOT NULL)
         OR (day_status = 'present' AND clock_in_at IS NULL)
    `);

    res.json({
      success: true,
      applied: true,
      message: 'Migration exécutable à tout moment pour synchroniser les statuts',
      stats: {
        by_status: stats.rows,
        potential_anomalies: parseInt(anomalies.rows[0].count)
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

export default router;
