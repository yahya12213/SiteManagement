/**
 * HR Attendance Routes - Version Unifiée
 *
 * Route unique pour tout le système de pointage.
 * Utilise la table hr_attendance_daily (1 ligne = 1 jour = 1 employé)
 *
 * Principes:
 * - Horloge = Système configurable (via getSystemTime/getSystemDate)
 * - Calculs = backend uniquement (via AttendanceCalculator)
 * - Audit = complet (via AttendanceLogger)
 */

import express from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import pool from '../config/database.js';
import { AttendanceCalculator } from '../services/attendance-calculator.js';
import { AttendanceLogger } from '../services/attendance-logger.js';
import { getSystemTime, getSystemDate, getSystemTimestamp } from '../services/system-clock.js';
import { initializeDailyAttendance } from '../jobs/daily-attendance-init.js';

const router = express.Router();

// Initialize services
const calculator = new AttendanceCalculator(pool);
const logger = new AttendanceLogger(pool);

// =====================================================
// HELPERS
// =====================================================

/**
 * Extract HH:MM time from timestamp string (avoids timezone issues)
 * @param {string|Date} timestamp - Timestamp in ISO format or Date object
 * @returns {string|null} Time in HH:MM format
 */
function extractTime(timestamp) {
  if (!timestamp) return null;
  // If it's already a string in ISO format, extract time part
  const str = typeof timestamp === 'string' ? timestamp : timestamp.toISOString();
  const match = str.match(/T(\d{2}:\d{2})/);
  return match ? match[1] : null;
}

/**
 * Get employee by profile_id
 */
async function getEmployeeByProfileId(profileId) {
  const result = await pool.query(`
    SELECT id, first_name, last_name, requires_clocking, employee_number, profile_id
    FROM hr_employees
    WHERE profile_id = $1
  `, [profileId]);
  return result.rows[0] || null;
}

/**
 * Get employee by id
 */
async function getEmployeeById(employeeId) {
  const result = await pool.query(`
    SELECT id, first_name, last_name, requires_clocking, employee_number, profile_id
    FROM hr_employees
    WHERE id = $1
  `, [employeeId]);
  return result.rows[0] || null;
}

/**
 * Validate time format HH:MM
 */
function validateTimeFormat(timeString) {
  if (!timeString) return true;
  return /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/.test(timeString);
}

/**
 * Get current date in YYYY-MM-DD format
 * @deprecated Use getSystemDate(pool) from system-clock.js instead for clock-in/out
 */
function getCurrentDate() {
  return new Date().toISOString().split('T')[0];
}

/**
 * Get IP address from request
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || req.socket?.remoteAddress || null;
}

// =====================================================
// LECTURE - Liste des pointages (admin/manager)
// =====================================================

router.get('/', authenticateToken, requirePermission('hr.attendance.view_page'), async (req, res) => {
  const { employee_id, start_date, end_date, status, limit = 500, offset = 0 } = req.query;

  try {
    let query = `
      SELECT
        a.id,
        a.employee_id,
        a.work_date,
        a.clock_in_at,
        a.clock_out_at,
        TO_CHAR(a.clock_in_at AT TIME ZONE 'Africa/Casablanca', 'HH24:MI') as check_in_time,
        TO_CHAR(a.clock_out_at AT TIME ZONE 'Africa/Casablanca', 'HH24:MI') as check_out_time,
        a.scheduled_start,
        a.scheduled_end,
        a.scheduled_break_minutes,
        a.gross_worked_minutes,
        a.net_worked_minutes,
        a.late_minutes,
        a.early_leave_minutes,
        a.overtime_minutes,
        a.day_status,
        a.source,
        a.notes,
        a.is_anomaly,
        a.anomaly_type,
        a.anomaly_resolved,
        a.is_corrected,
        a.corrected_by,
        a.correction_reason,
        e.first_name || ' ' || e.last_name as employee_name,
        e.employee_number,
        -- Recovery hours for recovery_off status
        (
          SELECT rd.hours_to_recover
          FROM hr_recovery_declarations rd
          JOIN hr_recovery_periods rp ON rd.recovery_period_id = rp.id
          WHERE rd.recovery_date = a.work_date
            AND rd.status = 'active'
            AND rp.status = 'active'
          LIMIT 1
        ) as hours_to_recover
      FROM hr_attendance_daily a
      JOIN hr_employees e ON a.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (employee_id) {
      query += ` AND a.employee_id = $${paramCount}`;
      params.push(employee_id);
      paramCount++;
    }

    if (start_date) {
      query += ` AND a.work_date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += ` AND a.work_date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    if (status) {
      query += ` AND a.day_status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    query += ` ORDER BY a.work_date DESC, e.last_name`;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Format response with calculated fields (check_in_time and check_out_time come from TO_CHAR in query)
    // Helper: Parse time string HH:MM:SS or HH:MM to minutes
    const parseTime = (t) => {
      if (!t) return null;
      const str = typeof t === 'string' ? t : t.toString();
      const parts = str.split(':');
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    };

    const data = result.rows.map(row => {
      // Calculate hours_to_recover from schedule for recovery_off status
      let hoursToRecover = null;
      if (row.day_status === 'recovery_off' && row.scheduled_start && row.scheduled_end) {
        const startMin = parseTime(row.scheduled_start);
        const endMin = parseTime(row.scheduled_end);
        const breakMin = row.scheduled_break_minutes || 0;
        if (startMin !== null && endMin !== null) {
          hoursToRecover = Math.round((endMin - startMin - breakMin) / 60);
        }
      }

      return {
        ...row,
        worked_minutes: row.net_worked_minutes,
        attendance_date: row.work_date, // Alias for backward compatibility
        hours_to_recover: hoursToRecover || (row.hours_to_recover ? parseFloat(row.hours_to_recover) : null)
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    console.error('[GET /hr/attendance] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// SELF-SERVICE - Statut du jour (my-today)
// =====================================================

router.get('/my-today', authenticateToken, async (req, res) => {
  try {
    console.log(`[GET /my-today] Starting for user ${req.user?.id}`);

    const employee = await getEmployeeByProfileId(req.user.id);
    console.log(`[GET /my-today] Employee lookup result:`, employee ? `Found: ${employee.id} (${employee.first_name})` : 'NOT FOUND');

    if (!employee) {
      console.log(`[GET /my-today] No employee found for profile ${req.user.id}`);
      return res.json({
        success: true,
        requires_clocking: false,
        message: 'Aucun employé trouvé'
      });
    }

    if (!employee.requires_clocking) {
      console.log(`[GET /my-today] Clocking not required for employee ${employee.id}`);
      return res.json({
        success: true,
        requires_clocking: false,
        message: 'Pointage non requis'
      });
    }

    // Utiliser l'horloge système configurable
    console.log(`[GET /my-today] Getting system date...`);
    const today = await getSystemDate(pool);
    console.log(`[GET /my-today] System date: ${today}`);

    // Get today's record
    console.log(`[GET /my-today] Querying attendance for ${employee.id} on ${today}...`);
    const result = await pool.query(`
      SELECT *
      FROM hr_attendance_daily
      WHERE employee_id = $1 AND work_date = $2
    `, [employee.id, today]);
    console.log(`[GET /my-today] Attendance query result: ${result.rows.length} rows`);

    const record = result.rows[0] || null;

    // Get day info (schedule, holidays, etc.)
    console.log(`[GET /my-today] Getting day info...`);
    const dayInfo = await calculator.getDayInfo(employee.id, today);
    console.log(`[GET /my-today] Day info result:`, dayInfo ? 'OK' : 'NULL');

    // FIX: Quand record=null, record?.clock_in_at retourne undefined, et undefined !== null = true (BUG)
    // Solution: verifier explicitement que record existe ET que clock_in_at n'est pas null
    const hasCheckIn = record !== null && record.clock_in_at !== null;
    const hasCheckOut = record !== null && record.clock_out_at !== null;

    // Récupérer l'heure système actuelle pour affichage frontend
    console.log(`[GET /my-today] Getting system time...`);
    const systemTime = await getSystemTime(pool);
    console.log(`[GET /my-today] System time: ${systemTime?.toISOString()}`);

    console.log(`[GET /my-today] Sending successful response`);
    res.json({
      success: true,
      requires_clocking: true,
      system_time: systemTime.toISOString(),
      employee: {
        id: employee.id,
        name: `${employee.first_name} ${employee.last_name}`,
        employee_number: employee.employee_number
      },
      today: {
        date: today,
        record,
        day_info: dayInfo,
        can_check_in: !hasCheckIn,
        can_check_out: hasCheckIn && !hasCheckOut,
        is_complete: hasCheckIn && hasCheckOut,
        worked_minutes: record?.net_worked_minutes || 0,
        day_status: record?.day_status || 'pending'
      }
    });

  } catch (error) {
    console.error('[GET /hr/attendance/my-today] FULL ERROR:', {
      message: error.message,
      name: error.name,
      code: error.code,
      stack: error.stack
    });
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// SELF-SERVICE - Historique (my-records)
// =====================================================

router.get('/my-records', authenticateToken, async (req, res) => {
  try {
    const { start_date, end_date, limit = 100, offset = 0 } = req.query;

    const employee = await getEmployeeByProfileId(req.user.id);

    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employé non trouvé' });
    }

    let query = `
      SELECT
        a.*,
        TO_CHAR(a.clock_in_at AT TIME ZONE 'Africa/Casablanca', 'HH24:MI') as check_in_time,
        TO_CHAR(a.clock_out_at AT TIME ZONE 'Africa/Casablanca', 'HH24:MI') as check_out_time,
        (
          SELECT json_build_object(
            'id', cr.id,
            'status', cr.status,
            'requested_check_in', cr.requested_check_in,
            'requested_check_out', cr.requested_check_out,
            'reason', cr.reason
          )
          FROM hr_attendance_correction_requests cr
          WHERE cr.employee_id = a.employee_id AND cr.request_date = a.work_date
          ORDER BY cr.created_at DESC
          LIMIT 1
        ) as correction_request,
        -- Recovery info: hours to recover for recovery_off status
        (
          SELECT rd.hours_to_recover
          FROM hr_recovery_declarations rd
          JOIN hr_recovery_periods rp ON rd.recovery_period_id = rp.id
          WHERE rd.recovery_date = a.work_date
            AND rd.status = 'active'
            AND rp.status = 'active'
          LIMIT 1
        ) as hours_to_recover
      FROM hr_attendance_daily a
      WHERE a.employee_id = $1
    `;
    const params = [employee.id];
    let paramCount = 2;

    if (start_date) {
      query += ` AND a.work_date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += ` AND a.work_date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    query += ` ORDER BY a.work_date DESC`;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await pool.query(query, params);

    // Format records for frontend (check_in_time and check_out_time come from TO_CHAR in query)
    const records = result.rows.map(row => {
      // Format work_date as YYYY-MM-DD string to avoid timezone issues
      let workDateStr;
      if (row.work_date instanceof Date) {
        // Convert to local date string (YYYY-MM-DD) to match PostgreSQL's date
        workDateStr = row.work_date.toLocaleDateString('en-CA'); // en-CA gives YYYY-MM-DD format
      } else {
        workDateStr = row.work_date;
      }

      // Calculer hours_to_recover depuis le planning (scheduled columns)
      // Inclure tous les statuts recovery (recovery_off, recovery_paid, recovery_unpaid)
      let hoursToRecover = null;
      if (['recovery_off', 'recovery_paid', 'recovery_unpaid'].includes(row.day_status) && row.scheduled_start && row.scheduled_end) {
        // Parse time strings HH:MM:SS or HH:MM
        const parseTime = (t) => {
          if (!t) return null;
          const str = typeof t === 'string' ? t : t.toString();
          const parts = str.split(':');
          return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        };
        const startMin = parseTime(row.scheduled_start);
        const endMin = parseTime(row.scheduled_end);
        const breakMin = row.scheduled_break_minutes || 0;
        if (startMin !== null && endMin !== null) {
          hoursToRecover = Math.round((endMin - startMin - breakMin) / 60);
        }
      }

      return {
        id: row.id,
        work_date: workDateStr,
        clock_in_at: row.clock_in_at,
        clock_out_at: row.clock_out_at,
        check_in_time: row.check_in_time,
        check_out_time: row.check_out_time,
        net_worked_minutes: row.net_worked_minutes,
        scheduled_break_minutes: row.scheduled_break_minutes || 0,
        late_minutes: row.late_minutes || 0,
        early_leave_minutes: row.early_leave_minutes || 0,
        overtime_minutes: row.overtime_minutes || 0,
        day_status: row.day_status,
        is_complete: row.clock_in_at && row.clock_out_at,
        is_anomaly: row.is_anomaly && !row.anomaly_resolved,
        correction_request: row.correction_request,
        hours_to_recover: hoursToRecover || (row.hours_to_recover ? parseFloat(row.hours_to_recover) : 8)
      };
    });

    res.json({
      success: true,
      employee: {
        id: employee.id,
        name: `${employee.first_name} ${employee.last_name}`
      },
      records
    });

  } catch (error) {
    console.error('[GET /hr/attendance/my-records] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// SELF-SERVICE - Pointer entrée (clock-in)
// =====================================================

router.post('/clock-in', authenticateToken, async (req, res) => {
  // BUG #3 FIX: Use transaction with SELECT FOR UPDATE to prevent race condition
  const client = await pool.connect();

  try {
    const employee = await getEmployeeByProfileId(req.user.id);

    if (!employee) {
      client.release();
      return res.status(404).json({ success: false, error: 'Aucun employé trouvé' });
    }

    if (!employee.requires_clocking) {
      client.release();
      return res.status(403).json({ success: false, error: 'Pointage non autorisé' });
    }

    // Utiliser l'horloge système configurable (TOUT utilise cette horloge, pas le serveur)
    const today = await getSystemDate(pool);
    const now = await getSystemTime(pool);
    const clockTimestamp = await getSystemTimestamp(pool); // Timestamp formaté Africa/Casablanca

    // BUG #3 FIX: Start transaction
    await client.query('BEGIN');

    // BUG #3 FIX: Check with FOR UPDATE to lock the row (or use advisory lock for missing row)
    // First, try to get advisory lock on employee_id + date hash to prevent concurrent inserts
    const lockKey = Math.abs(employee.id.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0) % 2147483647);
    await client.query('SELECT pg_advisory_xact_lock($1)', [lockKey]);

    // Check if already has record for today (now safely within transaction)
    const existing = await client.query(`
      SELECT id, clock_in_at FROM hr_attendance_daily
      WHERE employee_id = $1 AND work_date = $2
      FOR UPDATE
    `, [employee.id, today]);

    if (existing.rows.length > 0 && existing.rows[0].clock_in_at) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        error: 'Entrée déjà pointée aujourd\'hui',
        existing_clock_in: existing.rows[0].clock_in_at
      });
    }

    // Calculate day status
    const calcResult = await calculator.calculateDayStatus(employee.id, today, now, null);

    let result;

    // Check for special days (holiday, leave, etc.)
    if (['holiday', 'leave', 'recovery_off', 'sick', 'mission', 'training'].includes(calcResult.day_status)) {
      // Create or update record with special status
      result = await client.query(`
        INSERT INTO hr_attendance_daily (
          employee_id, work_date, clock_in_at,
          scheduled_start, scheduled_end, scheduled_break_minutes,
          day_status, source, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'self_service', $8, $9)
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
          clock_in_at = COALESCE(hr_attendance_daily.clock_in_at, EXCLUDED.clock_in_at),
          day_status = EXCLUDED.day_status,
          notes = EXCLUDED.notes,
          updated_at = NOW()
        RETURNING *
      `, [
        employee.id, today, clockTimestamp,
        calcResult.scheduled_start, calcResult.scheduled_end, calcResult.scheduled_break_minutes,
        calcResult.day_status, calcResult.notes, req.user.id
      ]);

      await client.query('COMMIT');
      client.release();

      await logger.logClockIn(result.rows[0].id, employee.id, today, result.rows[0], req.user.id, getClientIP(req));

      return res.json({
        success: true,
        message: calcResult.notes || `Journée: ${calcResult.day_status}`,
        record: result.rows[0],
        special_day: calcResult.special_day
      });
    }

    // Normal check-in - BUG #3 FIX: Use COALESCE to never overwrite existing clock_in_at
    result = await client.query(`
      INSERT INTO hr_attendance_daily (
        employee_id, work_date, clock_in_at,
        scheduled_start, scheduled_end, scheduled_break_minutes,
        late_minutes, day_status, source, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'self_service', $9)
      ON CONFLICT (employee_id, work_date) DO UPDATE SET
        clock_in_at = COALESCE(hr_attendance_daily.clock_in_at, EXCLUDED.clock_in_at),
        late_minutes = CASE WHEN hr_attendance_daily.clock_in_at IS NULL THEN EXCLUDED.late_minutes ELSE hr_attendance_daily.late_minutes END,
        day_status = CASE WHEN hr_attendance_daily.clock_in_at IS NULL THEN EXCLUDED.day_status ELSE hr_attendance_daily.day_status END,
        updated_at = NOW()
      RETURNING *
    `, [
      employee.id, today, clockTimestamp,
      calcResult.scheduled_start, calcResult.scheduled_end, calcResult.scheduled_break_minutes,
      calcResult.late_minutes, calcResult.day_status, req.user.id
    ]);

    await client.query('COMMIT');
    client.release();

    await logger.logClockIn(result.rows[0].id, employee.id, today, result.rows[0], req.user.id, getClientIP(req));

    res.json({
      success: true,
      message: calcResult.late_minutes > 0
        ? `Entrée enregistrée (${calcResult.late_minutes} min de retard)`
        : 'Entrée enregistrée avec succès',
      record: result.rows[0],
      late_minutes: calcResult.late_minutes,
      scheduled_start: calcResult.scheduled_start
    });

  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // Ignore rollback errors
    }
    client.release();
    console.error('[POST /hr/attendance/clock-in] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// SELF-SERVICE - Pointer sortie (clock-out)
// =====================================================

router.post('/clock-out', authenticateToken, async (req, res) => {
  // BUG #3 FIX: Use transaction with SELECT FOR UPDATE to prevent race condition
  const client = await pool.connect();

  try {
    const employee = await getEmployeeByProfileId(req.user.id);

    if (!employee) {
      client.release();
      return res.status(404).json({ success: false, error: 'Aucun employé trouvé' });
    }

    if (!employee.requires_clocking) {
      client.release();
      return res.status(403).json({ success: false, error: 'Pointage non autorisé' });
    }

    // Utiliser l'horloge système configurable (TOUT utilise cette horloge, pas le serveur)
    const today = await getSystemDate(pool);
    const now = await getSystemTime(pool);
    const clockTimestamp = await getSystemTimestamp(pool); // Timestamp formaté Africa/Casablanca

    // BUG #3 FIX: Start transaction
    await client.query('BEGIN');

    // BUG #3 FIX: Get today's record with FOR UPDATE to lock the row
    const existing = await client.query(`
      SELECT * FROM hr_attendance_daily
      WHERE employee_id = $1 AND work_date = $2
      FOR UPDATE
    `, [employee.id, today]);

    if (existing.rows.length === 0 || !existing.rows[0].clock_in_at) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ success: false, error: 'Vous devez d\'abord pointer l\'entrée' });
    }

    const record = existing.rows[0];

    if (record.clock_out_at) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        error: 'Sortie déjà pointée aujourd\'hui',
        existing_clock_out: record.clock_out_at
      });
    }

    // Calculate with clock-out
    const calcResult = await calculator.calculateDayStatus(employee.id, today, record.clock_in_at, now);

    // Update record
    const result = await client.query(`
      UPDATE hr_attendance_daily SET
        clock_out_at = $2,
        gross_worked_minutes = $3,
        net_worked_minutes = $4,
        early_leave_minutes = $5,
        overtime_minutes = $6,
        day_status = $7,
        updated_at = NOW()
      WHERE id = $1 AND clock_out_at IS NULL
      RETURNING *
    `, [
      record.id, clockTimestamp,
      calcResult.gross_worked_minutes,
      calcResult.net_worked_minutes,
      calcResult.early_leave_minutes,
      calcResult.overtime_minutes,
      calcResult.day_status
    ]);

    // BUG #3 FIX: Check if update actually happened (another thread may have updated)
    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({
        success: false,
        error: 'Sortie déjà pointée (concurrent request)',
      });
    }

    // BUG #11 FIX: Handle overtime records insertion with error handling per iteration
    const overtimeErrors = [];
    if (calcResult.overtime_minutes > 0 && calcResult.overtime_periods && calcResult.overtime_periods.length > 0) {
      for (const period of calcResult.overtime_periods) {
        try {
          // Calculer les minutes pour cette période spécifique
          const clockInMinutes = calculator.timestampToMinutes(record.clock_in_at);
          const clockOutMinutes = calculator.timestampToMinutes(now);
          const periodMinutes = calculator.calculateOverlap(clockInMinutes, clockOutMinutes, period.start_time, period.end_time);

          if (periodMinutes > 0) {
            await client.query(`
              INSERT INTO hr_overtime_records
                (employee_id, overtime_date, period_id, actual_minutes, approved_minutes, rate_type, validated_for_payroll)
              VALUES ($1, $2, $3, $4, $4, $5, true)
              ON CONFLICT (employee_id, overtime_date, period_id)
              DO UPDATE SET
                actual_minutes = EXCLUDED.actual_minutes,
                approved_minutes = EXCLUDED.approved_minutes,
                rate_type = EXCLUDED.rate_type,
                validated_for_payroll = true,
                updated_at = NOW()
            `, [employee.id, today, period.id, periodMinutes, period.rate_type]);
          }
        } catch (otError) {
          // BUG #11 FIX: Continue with other periods even if one fails
          console.error(`[clock-out] Overtime record error for period ${period.id}:`, otError.message);
          overtimeErrors.push({ period_id: period.id, error: otError.message });
        }
      }
      console.log(`[clock-out] Created overtime records for employee ${employee.id}: ${calcResult.overtime_minutes} minutes`);
    }

    await client.query('COMMIT');
    client.release();

    await logger.logClockOut(record.id, employee.id, today, record, result.rows[0], req.user.id, getClientIP(req));

    const hours = Math.floor((calcResult.net_worked_minutes || 0) / 60);
    const minutes = (calcResult.net_worked_minutes || 0) % 60;

    const response = {
      success: true,
      message: 'Sortie enregistrée avec succès',
      record: result.rows[0],
      summary: {
        worked_hours: hours,
        worked_minutes: minutes,
        formatted: `${hours}h ${minutes}min`,
        late_minutes: record.late_minutes,
        early_leave_minutes: calcResult.early_leave_minutes,
        overtime_minutes: calcResult.overtime_minutes,
        day_status: calcResult.day_status
      }
    };

    // Add warnings if some overtime records failed
    if (overtimeErrors.length > 0) {
      response.warnings = overtimeErrors;
    }

    res.json(response);

  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      // Ignore rollback errors
    }
    client.release();
    console.error('[POST /hr/attendance/clock-out] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// LECTURE - Pointage par employé et date
// =====================================================

router.get('/by-date', authenticateToken, requirePermission('hr.attendance.view_page'), async (req, res) => {
  try {
    const { employee_id, date } = req.query;

    if (!employee_id || !date) {
      return res.status(400).json({ success: false, error: 'employee_id et date sont requis' });
    }

    // Get employee info
    const employee = await getEmployeeById(employee_id);
    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employé non trouvé' });
    }

    // Get day info
    const dayInfo = await calculator.getDayInfo(employee_id, date);

    // Get attendance record - use TO_CHAR to extract time directly from PostgreSQL (avoids timezone issues)
    const result = await pool.query(`
      SELECT *,
        TO_CHAR(clock_in_at AT TIME ZONE 'Africa/Casablanca', 'HH24:MI') as check_in_time,
        TO_CHAR(clock_out_at AT TIME ZONE 'Africa/Casablanca', 'HH24:MI') as check_out_time
      FROM hr_attendance_daily
      WHERE employee_id = $1 AND work_date = $2
    `, [employee_id, date]);

    // Format records for frontend compatibility
    const records = result.rows.map(row => ({
      ...row,
      status: row.day_status,
      worked_minutes: row.net_worked_minutes,
      attendance_date: row.work_date
    }));

    // Get pending correction request
    const correctionResult = await pool.query(`
      SELECT * FROM hr_attendance_correction_requests
      WHERE employee_id = $1 AND request_date = $2
        AND status IN ('pending', 'approved_n1', 'approved_n2')
      ORDER BY created_at DESC
      LIMIT 1
    `, [employee_id, date]);

    res.json({
      success: true,
      data: {
        employee: {
          id: employee.id,
          name: `${employee.first_name} ${employee.last_name}`,
          employee_number: employee.employee_number
        },
        date,
        day_info: dayInfo,
        has_records: records.length > 0,
        records,
        pending_correction_request: correctionResult.rows[0] || null,
        // Backward compatibility
        break_duration_minutes: dayInfo.schedule?.break_duration_minutes || 0,
        public_holiday: dayInfo.holiday,
        recovery_day: dayInfo.recovery
      }
    });

  } catch (error) {
    console.error('[GET /hr/attendance/by-date] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// ADMIN - Édition/Déclaration de pointage
// =====================================================

router.put('/admin/edit', authenticateToken, requirePermission('hr.attendance.edit'), async (req, res) => {
  try {
    const {
      employee_id,
      date,
      action, // 'edit' or 'declare'
      check_in_time,
      check_out_time,
      status,
      absence_status,
      notes,
      correction_reason
    } = req.body;

    // Validation
    if (!employee_id || !date) {
      return res.status(400).json({ success: false, error: 'employee_id et date sont requis' });
    }

    if (!action || !['edit', 'declare'].includes(action)) {
      return res.status(400).json({ success: false, error: 'action doit être "edit" ou "declare"' });
    }

    if (check_in_time && !validateTimeFormat(check_in_time)) {
      return res.status(400).json({ success: false, error: 'Format check_in_time invalide (HH:MM)' });
    }

    if (check_out_time && !validateTimeFormat(check_out_time)) {
      return res.status(400).json({ success: false, error: 'Format check_out_time invalide (HH:MM)' });
    }

    // Check employee exists
    const employee = await getEmployeeById(employee_id);
    if (!employee) {
      return res.status(404).json({ success: false, error: 'Employé non trouvé' });
    }

    // Build timestamps - utiliser Africa/Casablanca (+01:00) pour que l'heure affichée = heure entrée
    // User enters 10:00 → store as 10:00+01:00 → display as 10:00 (pas de transformation)
    const clockInAt = check_in_time ? `${date}T${check_in_time}:00+01:00` : null;
    const clockOutAt = check_out_time ? `${date}T${check_out_time}:00+01:00` : null;

    // Validate times
    if (clockInAt && clockOutAt && clockOutAt <= clockInAt) {
      return res.status(400).json({ success: false, error: 'L\'heure de sortie doit être après l\'heure d\'entrée' });
    }

    // Get existing record
    const existing = await pool.query(`
      SELECT * FROM hr_attendance_daily
      WHERE employee_id = $1 AND work_date = $2
    `, [employee_id, date]);

    if (action === 'edit') {
      // EDIT existing record
      if (!correction_reason || correction_reason.trim().length < 10) {
        return res.status(400).json({ success: false, error: 'Raison de correction requise (min 10 caractères)' });
      }

      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Aucun pointage trouvé pour cette date' });
      }

      const oldRecord = existing.rows[0];

      // Calculate new values
      const calcResult = await calculator.calculateDayStatus(employee_id, date, clockInAt, clockOutAt);

      // Determine final status
      // Protéger les statuts spéciaux qui ne doivent pas être écrasés
      const protectedStatuses = ['weekend', 'holiday', 'leave', 'recovery_off', 'recovery_paid', 'recovery_unpaid', 'mission', 'training', 'sick'];
      const finalStatus = protectedStatuses.includes(calcResult.day_status)
        ? calcResult.day_status
        : (status && !['check_in', 'check_out'].includes(status))
          ? status
          : calcResult.day_status;

      // Update record
      const result = await pool.query(`
        UPDATE hr_attendance_daily SET
          clock_in_at = $2,
          clock_out_at = $3,
          gross_worked_minutes = $4,
          net_worked_minutes = $5,
          late_minutes = $6,
          early_leave_minutes = $7,
          day_status = $8,
          source = 'manual',
          notes = $9,
          is_corrected = true,
          corrected_by = $10,
          correction_reason = $11,
          corrected_at = NOW(),
          original_clock_in = COALESCE(original_clock_in, $12),
          original_clock_out = COALESCE(original_clock_out, $13),
          is_anomaly = false,
          anomaly_resolved = true,
          anomaly_resolved_by = $10,
          anomaly_resolved_at = NOW(),
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [
        oldRecord.id,
        clockInAt, clockOutAt,
        calcResult.gross_worked_minutes,
        calcResult.net_worked_minutes,
        calcResult.late_minutes,
        calcResult.early_leave_minutes,
        finalStatus,
        notes,
        req.user.id, correction_reason,
        extractTime(oldRecord.clock_in_at),
        extractTime(oldRecord.clock_out_at)
      ]);

      // Log audit
      await logger.logManualEdit(
        oldRecord.id, employee_id, date,
        {
          clock_in_at: oldRecord.clock_in_at,
          clock_out_at: oldRecord.clock_out_at,
          day_status: oldRecord.day_status
        },
        {
          clock_in_at: clockInAt,
          clock_out_at: clockOutAt,
          day_status: finalStatus
        },
        correction_reason,
        req.user.id
      );

      // Cancel pending correction requests
      await pool.query(`
        UPDATE hr_attendance_correction_requests
        SET status = 'cancelled',
            admin_cancelled_at = NOW(),
            admin_cancelled_by = $3,
            admin_cancellation_reason = 'Remplacée par correction admin directe'
        WHERE employee_id = $1 AND request_date = $2
          AND status IN ('pending', 'approved_n1', 'approved_n2')
      `, [employee_id, date, req.user.id]);

      return res.json({
        success: true,
        message: 'Pointage corrigé avec succès',
        data: result.rows[0]
      });

    } else if (action === 'declare') {
      // DECLARE new record
      console.log('[DECLARE] Starting for employee:', employee_id, 'date:', date);

      if (!notes || notes.trim().length < 5) {
        return res.status(400).json({ success: false, error: 'Notes requises (min 5 caractères)' });
      }

      if (existing.rows.length > 0) {
        return res.status(409).json({
          success: false,
          error: 'Des pointages existent déjà. Utilisez action="edit" pour modifier.'
        });
      }

      // Calculate values
      console.log('[DECLARE] Calculating day status with clockIn:', clockInAt, 'clockOut:', clockOutAt);
      const calcResult = await calculator.calculateDayStatus(employee_id, date, clockInAt, clockOutAt);
      console.log('[DECLARE] Calculator result:', JSON.stringify(calcResult));

      // Determine final status
      // Statuts spéciaux: TOUJOURS utiliser le résultat du calculateur (pas d'override)
      const specialStatuses = ['weekend', 'holiday', 'leave', 'recovery_off', 'recovery_paid', 'recovery_unpaid', 'mission', 'training'];

      let finalStatus;
      if (specialStatuses.includes(calcResult.day_status)) {
        // Jours spéciaux: impossible d'override manuellement
        finalStatus = calcResult.day_status;
        console.log(`[DECLARE] Special day detected: ${calcResult.day_status} for ${date}`);
      } else {
        // Jours normaux: permettre absence_status ou status de la requête
        finalStatus = absence_status || status || calcResult.day_status;
        if (['check_in', 'check_out'].includes(finalStatus)) {
          finalStatus = 'present';
        }
      }

      // Insert new record
      console.log('[DECLARE] Inserting with finalStatus:', finalStatus);
      console.log('[DECLARE] Insert params:', {
        employee_id, date, clockInAt, clockOutAt,
        scheduled_start: calcResult.scheduled_start,
        scheduled_end: calcResult.scheduled_end,
        scheduled_break_minutes: calcResult.scheduled_break_minutes,
        gross_worked_minutes: calcResult.gross_worked_minutes,
        net_worked_minutes: calcResult.net_worked_minutes,
        late_minutes: calcResult.late_minutes,
        early_leave_minutes: calcResult.early_leave_minutes,
        finalStatus, notes
      });

      const result = await pool.query(`
        INSERT INTO hr_attendance_daily (
          employee_id, work_date, clock_in_at, clock_out_at,
          scheduled_start, scheduled_end, scheduled_break_minutes,
          gross_worked_minutes, net_worked_minutes,
          late_minutes, early_leave_minutes,
          day_status, source, notes, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'manual', $13, $14)
        RETURNING *
      `, [
        employee_id, date, clockInAt, clockOutAt,
        calcResult.scheduled_start, calcResult.scheduled_end, calcResult.scheduled_break_minutes,
        calcResult.gross_worked_minutes, calcResult.net_worked_minutes,
        calcResult.late_minutes, calcResult.early_leave_minutes,
        finalStatus, notes, req.user.id
      ]);
      console.log('[DECLARE] Insert success, record id:', result.rows[0]?.id);

      // Log audit
      await logger.logManualCreate(
        result.rows[0].id, employee_id, date,
        result.rows[0],
        notes,
        req.user.id
      );

      return res.json({
        success: true,
        message: 'Journée déclarée avec succès',
        data: result.rows[0]
      });
    }

  } catch (error) {
    console.error('[PUT /hr/attendance/admin/edit] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// ADMIN - Supprimer pointage
// =====================================================

router.delete('/admin/delete', authenticateToken, requirePermission('hr.attendance.edit'), async (req, res) => {
  try {
    const { employee_id, date } = req.query;

    if (!employee_id || !date) {
      return res.status(400).json({ success: false, error: 'employee_id et date sont requis' });
    }

    // Get existing record for audit
    const existing = await pool.query(`
      SELECT * FROM hr_attendance_daily
      WHERE employee_id = $1 AND work_date = $2
    `, [employee_id, date]);

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Aucun pointage trouvé' });
    }

    // Delete correction requests first
    await pool.query(`
      DELETE FROM hr_attendance_correction_requests
      WHERE employee_id = $1 AND request_date = $2
    `, [employee_id, date]);

    // Delete attendance record
    await pool.query(`
      DELETE FROM hr_attendance_daily
      WHERE employee_id = $1 AND work_date = $2
    `, [employee_id, date]);

    // Log audit
    await logger.logDeleted(
      existing.rows[0].id, employee_id, date,
      existing.rows[0],
      'Suppression admin',
      req.user.id
    );

    res.json({
      success: true,
      message: 'Pointage supprimé'
    });

  } catch (error) {
    console.error('[DELETE /hr/attendance/admin/delete] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// ANOMALIES
// =====================================================

router.get('/anomalies', authenticateToken, requirePermission('hr.attendance.view_page'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        a.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.employee_number
      FROM hr_attendance_daily a
      JOIN hr_employees e ON a.employee_id = e.id
      WHERE a.is_anomaly = true AND a.anomaly_resolved = false
      ORDER BY a.work_date DESC
    `);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[GET /hr/attendance/anomalies] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/anomalies/:id/resolve', authenticateToken, requirePermission('hr.attendance.edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution_note } = req.body;

    const result = await pool.query(`
      UPDATE hr_attendance_daily SET
        anomaly_resolved = true,
        anomaly_resolved_by = $2,
        anomaly_resolved_at = NOW(),
        anomaly_resolution_note = $3,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, req.user.id, resolution_note]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Enregistrement non trouvé' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('[PUT /hr/attendance/anomalies/:id/resolve] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// SCHEDULES & SUMMARY
// =====================================================

router.get('/schedules', authenticateToken, requirePermission('hr.attendance.view_page'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM hr_work_schedules
      WHERE is_active = true
      ORDER BY name
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[GET /hr/attendance/schedules] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/summary/:year/:month', authenticateToken, requirePermission('hr.attendance.view_page'), async (req, res) => {
  try {
    const { year, month } = req.params;

    const result = await pool.query(`
      SELECT
        e.id,
        e.first_name || ' ' || e.last_name as employee_name,
        e.employee_number,
        COUNT(CASE WHEN a.day_status = 'present' THEN 1 END) as days_present,
        COUNT(CASE WHEN a.day_status = 'absent' THEN 1 END) as days_absent,
        COUNT(CASE WHEN a.day_status = 'late' THEN 1 END) as days_late,
        COUNT(CASE WHEN a.day_status = 'leave' THEN 1 END) as days_leave,
        COALESCE(SUM(COALESCE(a.net_worked_minutes, 0)), 0) / 60.0 as total_hours,
        COALESCE(SUM(CASE WHEN a.late_minutes > 0 THEN a.late_minutes ELSE 0 END), 0) as total_late_minutes
      FROM hr_employees e
      LEFT JOIN hr_attendance_daily a ON e.id = a.employee_id
        AND EXTRACT(YEAR FROM a.work_date) = $1
        AND EXTRACT(MONTH FROM a.work_date) = $2
      WHERE e.employment_status = 'active'
      GROUP BY e.id, e.first_name, e.last_name, e.employee_number
      ORDER BY e.last_name
    `, [year, month]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('[GET /hr/attendance/summary] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// AUDIT LOG
// =====================================================

router.get('/audit/:id', authenticateToken, requirePermission('hr.attendance.view_page'), async (req, res) => {
  try {
    const { id } = req.params;
    const auditHistory = await logger.getAuditHistory(id);
    res.json({ success: true, data: auditHistory });
  } catch (error) {
    console.error('[GET /hr/attendance/audit/:id] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/audit', authenticateToken, requirePermission('hr.attendance.view_page'), async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    const recentActions = await logger.getRecentActions(parseInt(limit));
    res.json({ success: true, data: recentActions });
  } catch (error) {
    console.error('[GET /hr/attendance/audit] Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// =====================================================
// ADMIN: MANUAL JOB EXECUTION
// =====================================================

/**
 * POST /jobs/init-daily-attendance
 * Exécuter manuellement l'initialisation quotidienne des pointages
 * Crée une ligne 'pending' pour chaque employé actif pour aujourd'hui
 */
router.post('/jobs/init-daily-attendance',
  authenticateToken,
  requirePermission('hr.attendance.admin'),
  async (req, res) => {
    try {
      console.log('[MANUAL] Running daily attendance initialization...');
      const result = await initializeDailyAttendance();

      res.json({
        success: true,
        message: `Initialisation terminée pour ${result.date}`,
        data: result
      });
    } catch (error) {
      console.error('[MANUAL] Daily init error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

export default router;
