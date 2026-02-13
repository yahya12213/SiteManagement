import express from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import pool from '../config/database.js';
import { ApprovalService, REQUEST_TYPES } from '../services/approval-service.js';
import { AttendanceCalculator } from '../services/attendance-calculator.js';

const router = express.Router();

/**
 * Helper: Get team member IDs for a manager
 * Includes both direct reports (manager_id) and indirect reports (hr_employee_managers)
 * Admin users get ALL active employees
 */
async function getTeamMemberIds(userId, isAdmin = false) {
  // Admin: return ALL active employees
  if (isAdmin) {
    const allEmployees = await pool.query(`
      SELECT DISTINCT id, profile_id FROM hr_employees
      WHERE employment_status = 'active'
    `);
    return allEmployees.rows;
  }

  // Get the hr_employee for this user
  const managerEmployee = await pool.query(`
    SELECT id FROM hr_employees WHERE profile_id = $1
  `, [userId]);

  if (managerEmployee.rows.length === 0) {
    return [];
  }

  const managerId = managerEmployee.rows[0].id;

  // Get all employees where this user is manager (direct or via hr_employee_managers)
  const team = await pool.query(`
    SELECT DISTINCT id, profile_id FROM hr_employees
    WHERE (
      manager_id = $1
      OR id IN (
        SELECT employee_id FROM hr_employee_managers
        WHERE manager_id = $1 AND is_active = true
      )
    )
    AND employment_status = 'active'
  `, [managerId]);

  return team.rows;
}

/**
 * Get my team members
 */
router.get('/team',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;

    try {
      // 🔧 FIX: Admin voit tous les employés
      const isAdmin = req.user.role === 'admin';

      if (isAdmin) {
        const team = await pool.query(`
          SELECT
            e.id,
            e.id as employee_id,
            e.first_name || ' ' || e.last_name as full_name,
            e.first_name,
            e.last_name,
            e.email,
            e.position,
            e.employee_number,
            e.profile_id,
            p.username,
            s.name as segment_name,
            e.hire_date,
            e.employment_type,
            e.employment_status = 'active' as is_active,
            -- Today's attendance (from unified hr_attendance_daily) - UTC extraction to avoid timezone shift
            (SELECT TO_CHAR(clock_in_at AT TIME ZONE 'Africa/Casablanca', 'HH24:MI') FROM hr_attendance_daily
             WHERE employee_id = e.id AND work_date = CURRENT_DATE
             LIMIT 1) as today_check_in,
            (SELECT TO_CHAR(clock_out_at AT TIME ZONE 'Africa/Casablanca', 'HH24:MI') FROM hr_attendance_daily
             WHERE employee_id = e.id AND work_date = CURRENT_DATE
             LIMIT 1) as today_check_out,
            -- Leave info
            (SELECT COUNT(*) FROM hr_leave_requests
             WHERE employee_id = e.id AND status = 'approved'
             AND CURRENT_DATE BETWEEN start_date AND end_date) as is_on_leave
          FROM hr_employees e
          LEFT JOIN profiles p ON e.profile_id = p.id
          LEFT JOIN segments s ON e.segment_id = s.id
          WHERE e.employment_status = 'active'
          ORDER BY e.last_name, e.first_name
        `);
        return res.json({ success: true, members: team.rows });
      }

      // Non-admin: logique existante
      // D'abord vérifier si l'utilisateur a un employé HR associé
      const managerCheck = await pool.query(
        'SELECT id FROM hr_employees WHERE profile_id = $1',
        [userId]
      );

      if (managerCheck.rows.length === 0) {
        // L'utilisateur n'est pas un employé HR, retourner tableau vide
        console.log(`Manager team: User ${userId} has no hr_employee record`);
        return res.json({ success: true, members: [] });
      }

      const managerId = managerCheck.rows[0].id;

      const team = await pool.query(`
        SELECT
          e.id,
          e.id as employee_id,
          e.first_name || ' ' || e.last_name as full_name,
          e.first_name,
          e.last_name,
          e.email,
          e.position,
          e.employee_number,
          e.profile_id,
          p.username,
          s.name as segment_name,
          e.hire_date,
          e.employment_type,
          e.employment_status = 'active' as is_active,
          -- Today's attendance (from unified hr_attendance_daily) - UTC extraction to avoid timezone shift
          (SELECT TO_CHAR(clock_in_at AT TIME ZONE 'Africa/Casablanca', 'HH24:MI') FROM hr_attendance_daily
           WHERE employee_id = e.id AND work_date = CURRENT_DATE
           LIMIT 1) as today_check_in,
          (SELECT TO_CHAR(clock_out_at AT TIME ZONE 'Africa/Casablanca', 'HH24:MI') FROM hr_attendance_daily
           WHERE employee_id = e.id AND work_date = CURRENT_DATE
           LIMIT 1) as today_check_out,
          -- Leave info
          (SELECT COUNT(*) FROM hr_leave_requests
           WHERE employee_id = e.id AND status = 'approved'
           AND CURRENT_DATE BETWEEN start_date AND end_date) as is_on_leave
        FROM hr_employees e
        LEFT JOIN profiles p ON e.profile_id = p.id
        LEFT JOIN segments s ON e.segment_id = s.id
        WHERE (
          e.manager_id = $1
          OR e.id IN (
            SELECT employee_id FROM hr_employee_managers
            WHERE manager_id = $1 AND is_active = true
          )
        )
        AND e.employment_status = 'active'
        ORDER BY e.last_name, e.first_name
      `, [managerId]);

      res.json({ success: true, members: team.rows });
    } catch (error) {
      console.error('Error fetching team:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get team attendance for a date range
 * Returns aggregated daily records per employee matching TeamAttendanceRecord interface
 */
router.get('/team-attendance',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;
    const { start_date, end_date, employee_id } = req.query;
    const isAdmin = req.user.role === 'admin';

    try {
      const teamMembers = await getTeamMemberIds(userId, isAdmin);
      if (teamMembers.length === 0) {
        return res.json({ success: true, records: [] });
      }

      // If employee_id is specified, filter to that single employee (must be in team)
      // Otherwise use all team members
      let filterEmployeeIds;
      if (employee_id) {
        const employeeIds = teamMembers.map(t => t.id);
        // Verify the requested employee is in the team
        if (employeeIds.includes(employee_id)) {
          filterEmployeeIds = [employee_id];
        } else {
          // Employee not in team, return empty
          return res.json({ success: true, records: [] });
        }
      } else {
        filterEmployeeIds = teamMembers.map(t => t.id);
      }

      // Build query using the new unified hr_attendance_daily table
      // All calculations are pre-done, so the query is much simpler
      // UTC extraction to avoid timezone shift: user enters 10:00 → display 10:00
      let query = `
        SELECT
          ad.id::text,
          ad.employee_id,
          e.first_name || ' ' || e.last_name as employee_name,
          COALESCE(e.hourly_rate, 0) as hourly_rate,
          ad.work_date as date,
          TO_CHAR(ad.clock_in_at AT TIME ZONE 'Africa/Casablanca', 'HH24:MI') as clock_in,
          TO_CHAR(ad.clock_out_at AT TIME ZONE 'Africa/Casablanca', 'HH24:MI') as clock_out,
          ROUND(COALESCE(ad.net_worked_minutes, 0) / 60.0, 2) as worked_hours,
          ad.day_status as status,
          COALESCE(ad.late_minutes, 0) as late_minutes,
          COALESCE(ad.early_leave_minutes, 0) as early_leave_minutes,
          COALESCE(ad.overtime_minutes, 0) as overtime_minutes,
          ad.notes,
          ad.is_anomaly,
          ad.scheduled_start,
          ad.scheduled_end,
          ad.scheduled_break_minutes,
          ad.is_working_day
        FROM hr_attendance_daily ad
        JOIN hr_employees e ON e.id = ad.employee_id
        WHERE ad.employee_id = ANY($1::uuid[])
      `;
      const params = [filterEmployeeIds];
      let paramCount = 2;

      if (start_date) {
        query += ` AND ad.work_date >= $${paramCount}`;
        params.push(start_date);
        paramCount++;
      }

      if (end_date) {
        query += ` AND ad.work_date <= $${paramCount}`;
        params.push(end_date);
        paramCount++;
      }

      query += ` ORDER BY ad.work_date DESC, e.last_name, e.first_name`;

      const result = await pool.query(query, params);

      // Calculate scheduled_hours from schedule for recovery_off OR holiday status
      const records = result.rows.map(row => {
        let scheduled_hours = null;

        // Calculate scheduled hours for special statuses (tous les recovery + holiday)
        if (['recovery_off', 'recovery_paid', 'recovery_unpaid', 'holiday'].includes(row.status)
            && row.scheduled_start && row.scheduled_end) {
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
            scheduled_hours = Math.round((endMin - startMin - breakMin) / 60);
          }
        }

        // Default to 8h if scheduled columns are null (pour tous les recovery + holiday)
        const defaultHours = ['recovery_off', 'recovery_paid', 'recovery_unpaid', 'holiday'].includes(row.status) ? 8 : null;

        return {
          ...row,
          scheduled_hours: scheduled_hours || defaultHours,
          hours_to_recover: scheduled_hours || defaultHours  // Backward compatibility
        };
      });

      res.json({ success: true, records });
    } catch (error) {
      console.error('Error fetching team attendance:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get team attendance summary (today)
 */
router.get('/team-attendance/today',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;

    try {
      // Use the new unified hr_attendance_daily table
      const summary = await pool.query(`
        WITH team AS (
          SELECT e.id, e.first_name, e.last_name, e.employee_number, e.position
          FROM hr_employees e
          WHERE e.manager_id = (SELECT id FROM hr_employees WHERE profile_id = $1)
          AND e.employment_status = 'active'
        )
        SELECT
          t.id,
          t.first_name || ' ' || t.last_name as employee_name,
          t.employee_number,
          t.position,
          TO_CHAR(ad.clock_in_at AT TIME ZONE 'Africa/Casablanca', 'HH24:MI') as first_check_in,
          TO_CHAR(ad.clock_out_at AT TIME ZONE 'Africa/Casablanca', 'HH24:MI') as last_check_out,
          ad.net_worked_minutes as worked_minutes,
          COALESCE(ad.day_status, 'absent') as status,
          COALESCE(ad.late_minutes, 0) as late_minutes
        FROM team t
        LEFT JOIN hr_attendance_daily ad ON ad.employee_id = t.id AND ad.work_date = CURRENT_DATE
        ORDER BY t.last_name, t.first_name
      `, [userId]);

      // Calculate summary stats
      const stats = {
        total: summary.rows.length,
        present: summary.rows.filter(r => r.status === 'present' || r.status === 'completed').length,
        absent: summary.rows.filter(r => r.status === 'absent').length,
        on_leave: summary.rows.filter(r => r.status === 'on_leave').length,
        late: summary.rows.filter(r => r.late_minutes > 0).length
      };

      res.json({
        success: true,
        data: summary.rows,
        stats
      });
    } catch (error) {
      console.error('Error fetching team attendance today:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get team leave requests pending my approval
 */
router.get('/team-requests',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;
    const { status, type } = req.query;

    try {
      // 🔧 FIX: Admin voit toutes les demandes, pas seulement son équipe
      const isAdmin = req.user.role === 'admin';

      if (isAdmin) {
        // Admin: retourner TOUTES les demandes en attente (conges + corrections)
        const allRequests = [];

        // 1. Demandes de conges
        let leaveQuery = `
          SELECT
            lr.id,
            lr.employee_id,
            lr.start_date,
            lr.end_date,
            lr.status,
            lr.reason,
            lr.created_at,
            lr.n1_approver_id,
            lr.n2_approver_id,
            'leave' as request_type,
            lt.name as request_subtype,
            e.first_name || ' ' || e.last_name as employee_name,
            e.employee_number,
            e.position,
            lt.name as leave_type_name,
            lt.requires_justification,
            lr.days_requested as duration_days,
            NULL::integer as duration_hours,
            CASE
              WHEN lr.status = 'approved_n1' THEN (
                SELECT m.first_name || ' ' || m.last_name
                FROM hr_employees m WHERE m.id::text = lr.n1_approver_id
              )
              WHEN lr.status = 'approved_n2' THEN (
                SELECT m.first_name || ' ' || m.last_name
                FROM hr_employees m WHERE m.id::text = lr.n2_approver_id
              )
              ELSE NULL
            END as previous_approver_name
          FROM hr_leave_requests lr
          JOIN hr_employees e ON e.id = lr.employee_id
          LEFT JOIN hr_leave_types lt ON lt.id = lr.leave_type_id
          WHERE 1=1
        `;

        if (status === 'pending') {
          leaveQuery += ` AND lr.status IN ('pending', 'approved_n1', 'approved_n2')`;
        } else if (status) {
          leaveQuery += ` AND lr.status = '${status}'`;
        }

        if (type && type !== 'correction') {
          leaveQuery += ` AND lr.leave_type_id = '${type}'`;
        }

        leaveQuery += ' ORDER BY lr.created_at DESC';

        if (!type || type !== 'correction') {
          const leaveResult = await pool.query(leaveQuery);
          allRequests.push(...leaveResult.rows);
        }

        // 2. Demandes de correction
        if (!type || type === 'correction') {
          let correctionQuery = `
            SELECT
              cr.id,
              cr.employee_id,
              cr.request_date as start_date,
              cr.request_date as end_date,
              cr.status,
              cr.reason,
              cr.created_at,
              cr.n1_approver_id::text,
              cr.n2_approver_id::text,
              'correction' as request_type,
              'Correction pointage' as request_subtype,
              e.first_name || ' ' || e.last_name as employee_name,
              e.employee_number,
              e.position,
              'Correction' as leave_type_name,
              false as requires_justification,
              1 as duration_days,
              NULL::integer as duration_hours,
              cr.original_check_in,
              cr.original_check_out,
              cr.requested_check_in,
              cr.requested_check_out,
              CASE
                WHEN cr.status = 'approved_n1' THEN (
                  SELECT m.first_name || ' ' || m.last_name
                  FROM hr_employees m WHERE m.id = cr.n1_approver_id
                )
                WHEN cr.status = 'approved_n2' THEN (
                  SELECT m.first_name || ' ' || m.last_name
                  FROM hr_employees m WHERE m.id = cr.n2_approver_id
                )
                ELSE NULL
              END as previous_approver_name
            FROM hr_attendance_correction_requests cr
            JOIN hr_employees e ON e.id = cr.employee_id
            WHERE 1=1
          `;

          if (status === 'pending') {
            correctionQuery += ` AND cr.status IN ('pending', 'approved_n1', 'approved_n2')`;
          } else if (status) {
            correctionQuery += ` AND cr.status = '${status}'`;
          }

          correctionQuery += ' ORDER BY cr.created_at DESC';

          const correctionResult = await pool.query(correctionQuery);
          allRequests.push(...correctionResult.rows);
        }

        // Trier par date de creation
        allRequests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        return res.json({ success: true, requests: allRequests });
      }

      // Non-admin: equipe seulement (conges + corrections)
      const teamMembers = await getTeamMemberIds(userId);
      if (teamMembers.length === 0) {
        return res.json({ success: true, requests: [] });
      }

      const employeeIds = teamMembers.map(t => t.id);
      const allRequests = [];

      // 1. Demandes de conges
      if (!type || type !== 'correction') {
        let leaveQuery = `
          SELECT
            lr.id,
            lr.employee_id,
            lr.start_date,
            lr.end_date,
            lr.status,
            lr.reason,
            lr.created_at,
            lr.n1_approver_id,
            lr.n2_approver_id,
            'leave' as request_type,
            lt.name as request_subtype,
            e.first_name || ' ' || e.last_name as employee_name,
            e.employee_number,
            e.position,
            lt.name as leave_type_name,
            lt.requires_justification,
            lr.days_requested as duration_days,
            NULL::integer as duration_hours,
            CASE
              WHEN lr.status = 'approved_n1' THEN (
                SELECT m.first_name || ' ' || m.last_name
                FROM hr_employees m WHERE m.id::text = lr.n1_approver_id
              )
              WHEN lr.status = 'approved_n2' THEN (
                SELECT m.first_name || ' ' || m.last_name
                FROM hr_employees m WHERE m.id::text = lr.n2_approver_id
              )
              ELSE NULL
            END as previous_approver_name
          FROM hr_leave_requests lr
          JOIN hr_employees e ON e.id = lr.employee_id
          LEFT JOIN hr_leave_types lt ON lt.id = lr.leave_type_id
          WHERE lr.employee_id = ANY($1::uuid[])
        `;

        if (status === 'pending') {
          leaveQuery += ` AND lr.status IN ('pending', 'approved_n1', 'approved_n2')`;
        } else if (status) {
          leaveQuery += ` AND lr.status = $2`;
        }

        if (type && type !== 'correction') {
          leaveQuery += ` AND lr.leave_type_id = $${status ? 3 : 2}`;
        }

        leaveQuery += ' ORDER BY lr.created_at DESC';

        const leaveParams = [employeeIds];
        if (status && status !== 'pending') leaveParams.push(status);
        if (type && type !== 'correction') leaveParams.push(type);

        const leaveResult = await pool.query(leaveQuery, leaveParams);
        allRequests.push(...leaveResult.rows);
      }

      // 2. Demandes de correction
      if (!type || type === 'correction') {
        let correctionQuery = `
          SELECT
            cr.id,
            cr.employee_id,
            cr.request_date as start_date,
            cr.request_date as end_date,
            cr.status,
            cr.reason,
            cr.created_at,
            cr.n1_approver_id::text,
            cr.n2_approver_id::text,
            'correction' as request_type,
            'Correction pointage' as request_subtype,
            e.first_name || ' ' || e.last_name as employee_name,
            e.employee_number,
            e.position,
            'Correction' as leave_type_name,
            false as requires_justification,
            1 as duration_days,
            NULL::integer as duration_hours,
            cr.original_check_in,
            cr.original_check_out,
            cr.requested_check_in,
            cr.requested_check_out,
            CASE
              WHEN cr.status = 'approved_n1' THEN (
                SELECT m.first_name || ' ' || m.last_name
                FROM hr_employees m WHERE m.id = cr.n1_approver_id
              )
              WHEN cr.status = 'approved_n2' THEN (
                SELECT m.first_name || ' ' || m.last_name
                FROM hr_employees m WHERE m.id = cr.n2_approver_id
              )
              ELSE NULL
            END as previous_approver_name
          FROM hr_attendance_correction_requests cr
          JOIN hr_employees e ON e.id = cr.employee_id
          WHERE cr.employee_id = ANY($1::uuid[])
        `;

        if (status === 'pending') {
          correctionQuery += ` AND cr.status IN ('pending', 'approved_n1', 'approved_n2')`;
        } else if (status) {
          correctionQuery += ` AND cr.status = $2`;
        }

        correctionQuery += ' ORDER BY cr.created_at DESC';

        const correctionParams = [employeeIds];
        if (status && status !== 'pending') correctionParams.push(status);

        const correctionResult = await pool.query(correctionQuery, correctionParams);
        allRequests.push(...correctionResult.rows);
      }

      // Trier par date de creation
      allRequests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

      res.json({ success: true, requests: allRequests });
    } catch (error) {
      console.error('Error fetching team requests:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get team overtime requests pending my approval
 */
router.get('/team-overtime',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;
    const { status = 'pending' } = req.query;

    try {
      // Check if hr_overtime_requests table exists
      const tableExists = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_name = 'hr_overtime_requests'
        )
      `);

      if (!tableExists.rows[0].exists) {
        return res.json({ success: true, requests: [], message: 'Overtime requests table not found' });
      }

      // 🔧 FIX: Admin voit toutes les demandes d'heures sup
      const isAdmin = req.user.role === 'admin';

      if (isAdmin) {
        let query = `
          SELECT
            ot.*,
            'overtime' as request_type,
            e.first_name || ' ' || e.last_name as employee_name,
            e.employee_number,
            e.position,
            ot.estimated_hours as duration_hours
          FROM hr_overtime_requests ot
          JOIN hr_employees e ON e.id = ot.employee_id
          WHERE 1=1
        `;
        const params = [];
        let paramCount = 1;

        if (status) {
          query += ` AND ot.status = $${paramCount}`;
          params.push(status);
          paramCount++;
        }

        query += ' ORDER BY ot.created_at DESC';

        const result = await pool.query(query, params);
        return res.json({ success: true, requests: result.rows });
      }

      // Non-admin: logique existante (équipe seulement)
      const teamMembers = await getTeamMemberIds(userId);
      if (teamMembers.length === 0) {
        return res.json({ success: true, requests: [] });
      }

      const employeeIds = teamMembers.map(t => t.id);

      let query = `
        SELECT
          ot.*,
          'overtime' as request_type,
          e.first_name || ' ' || e.last_name as employee_name,
          e.employee_number,
          e.position,
          ot.estimated_hours as duration_hours
        FROM hr_overtime_requests ot
        JOIN hr_employees e ON e.id = ot.employee_id
        WHERE ot.employee_id = ANY($1::uuid[])
      `;
      const params = [employeeIds];
      let paramCount = 2;

      if (status) {
        query += ` AND ot.status = $${paramCount}`;
        params.push(status);
        paramCount++;
      }

      query += ' ORDER BY ot.created_at DESC';

      const result = await pool.query(query, params);
      res.json({ success: true, requests: result.rows });
    } catch (error) {
      console.error('Error fetching team overtime:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get team leave calendar (approved leaves)
 */
router.get('/team-calendar',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;
    const { start_date, end_date } = req.query;

    try {
      const teamMembers = await getTeamMemberIds(userId);
      if (teamMembers.length === 0) {
        return res.json({ success: true, data: [] });
      }

      const employeeIds = teamMembers.map(t => t.id);

      let query = `
        SELECT
          lr.id,
          lr.employee_id,
          e.first_name || ' ' || e.last_name as employee_name,
          lr.start_date,
          lr.end_date,
          lr.days_requested,
          lr.status,
          lt.name as leave_type_name,
          lt.color as leave_type_color
        FROM hr_leave_requests lr
        JOIN hr_employees e ON e.id = lr.employee_id
        LEFT JOIN hr_leave_types lt ON lt.id = lr.leave_type_id
        WHERE lr.employee_id = ANY($1::uuid[])
        AND lr.status IN ('approved', 'pending')
      `;
      const params = [employeeIds];
      let paramCount = 2;

      if (start_date) {
        query += ` AND lr.end_date >= $${paramCount}`;
        params.push(start_date);
        paramCount++;
      }

      if (end_date) {
        query += ` AND lr.start_date <= $${paramCount}`;
        params.push(end_date);
        paramCount++;
      }

      query += ' ORDER BY lr.start_date';

      const result = await pool.query(query, params);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Error fetching team calendar:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get team statistics for current month
 */
router.get('/team-stats',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    try {
      // Use the new unified hr_attendance_daily table
      // Admin sees all employees, manager sees their team
      const stats = await pool.query(`
        WITH team AS (
          SELECT e.id
          FROM hr_employees e
          WHERE e.employment_status = 'active'
          AND (
            $2 = true
            OR e.manager_id = (SELECT id FROM hr_employees WHERE profile_id = $1)
            OR e.id IN (
              SELECT employee_id FROM hr_employee_managers
              WHERE manager_id = (SELECT id FROM hr_employees WHERE profile_id = $1)
            )
          )
        ),
        today_present AS (
          SELECT COUNT(DISTINCT employee_id) as count
          FROM hr_attendance_daily
          WHERE employee_id IN (SELECT id FROM team)
          AND work_date = CURRENT_DATE
          AND day_status IN ('present', 'late', 'early_leave', 'partial', 'pending')
        ),
        today_on_leave AS (
          SELECT COUNT(DISTINCT employee_id) as count
          FROM hr_leave_requests
          WHERE employee_id IN (SELECT id FROM team)
          AND status = 'approved'
          AND CURRENT_DATE BETWEEN start_date AND end_date
        ),
        month_late AS (
          SELECT COUNT(*) as count
          FROM hr_attendance_daily
          WHERE employee_id IN (SELECT id FROM team)
          AND work_date >= DATE_TRUNC('month', CURRENT_DATE)
          AND late_minutes > 0
        ),
        pending_requests AS (
          SELECT COUNT(*) as count
          FROM hr_leave_requests
          WHERE employee_id IN (SELECT id FROM team)
          AND status = 'pending'
        )
        SELECT
          (SELECT COUNT(*) FROM team) as total_members,
          (SELECT count FROM today_present) as present_today,
          (SELECT count FROM today_on_leave) as on_leave_today,
          (SELECT count FROM month_late) as late_count_month,
          (SELECT count FROM pending_requests) as pending_requests
      `, [userId, isAdmin]);

      // Calculate attendance rate
      const row = stats.rows[0] || { total_members: 0, present_today: 0, on_leave_today: 0, late_count_month: 0, pending_requests: 0 };
      const totalMembers = parseInt(row.total_members) || 0;
      const presentToday = parseInt(row.present_today) || 0;
      const attendanceRate = totalMembers > 0 ? Math.round((presentToday / totalMembers) * 100) : 0;

      res.json({
        success: true,
        stats: {
          total_members: totalMembers,
          present_today: presentToday,
          on_leave_today: parseInt(row.on_leave_today) || 0,
          late_count_month: parseInt(row.late_count_month) || 0,
          pending_requests: parseInt(row.pending_requests) || 0,
          attendance_rate: attendanceRate
        }
      });
    } catch (error) {
      console.error('Error fetching team stats:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Approve a leave request (as manager)
 * Uses ApprovalService for multi-level approval chain
 */
router.post('/requests/:id/approve',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { comment, request_type = 'leave' } = req.body;

    const approvalService = new ApprovalService(pool);

    try {
      // Use the unified ApprovalService
      const result = await approvalService.approve(
        request_type === 'overtime' ? REQUEST_TYPES.OVERTIME :
        request_type === 'correction' ? REQUEST_TYPES.CORRECTION :
        REQUEST_TYPES.LEAVE,
        id,
        userId,
        comment || ''
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json({
        success: true,
        data: result.request,
        message: result.message,
        is_final: result.is_final,
        next_level: result.next_level
      });
    } catch (error) {
      console.error('Error approving request:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Reject a leave request (as manager)
 * Uses ApprovalService for consistent rejection handling
 */
router.post('/requests/:id/reject',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { comment, reason, request_type = 'leave' } = req.body;
    // Accept both 'reason' (frontend) and 'comment' (legacy) for backward compatibility
    const rejectReason = reason || comment;

    const approvalService = new ApprovalService(pool);

    try {
      // Use the unified ApprovalService
      const result = await approvalService.rejectRequest(
        request_type === 'overtime' ? REQUEST_TYPES.OVERTIME :
        request_type === 'correction' ? REQUEST_TYPES.CORRECTION :
        REQUEST_TYPES.LEAVE,
        id,
        userId,
        rejectReason
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json({
        success: true,
        data: result.request,
        message: result.message
      });
    } catch (error) {
      console.error('Error rejecting request:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Cancel an approved request (admin only)
 * Allows admins to cancel approved leave or correction requests
 */
router.post('/requests/:id/cancel',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { id } = req.params;
    const { reason, request_type = 'leave' } = req.body;

    // Only admins can cancel approved requests
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Seuls les administrateurs peuvent annuler des demandes approuvées'
      });
    }

    if (!reason || !reason.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Une raison est obligatoire pour l\'annulation'
      });
    }

    const approvalService = new ApprovalService(pool);

    try {
      const result = await approvalService.cancelApprovedRequest(
        request_type === 'overtime' ? REQUEST_TYPES.OVERTIME :
        request_type === 'correction' ? REQUEST_TYPES.CORRECTION :
        REQUEST_TYPES.LEAVE,
        id,
        userId,
        reason
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json({
        success: true,
        data: result.request,
        message: result.message
      });
    } catch (error) {
      console.error('Error cancelling request:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Recalculate attendance for a date range
 * Useful after adding holidays, recovery periods, or retroactive attendance entries
 */
router.post('/team-attendance/recalculate',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;
    const userRole = req.user.role;
    const { start_date, end_date, employee_id } = req.body;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'Les dates de début et de fin sont obligatoires'
      });
    }

    try {
      const calculator = new AttendanceCalculator(pool);

      // Determine which employees to recalculate
      let employeeIds = [];

      if (employee_id) {
        // Specific employee requested
        employeeIds = [employee_id];
      } else {
        // Get team members (admin sees all, manager sees team)
        const isAdmin = userRole === 'admin';
        const teamMembers = await getTeamMemberIds(userId, isAdmin);
        employeeIds = teamMembers.map(t => t.id);
      }

      if (employeeIds.length === 0) {
        return res.json({
          success: true,
          message: 'Aucun employé à recalculer',
          stats: { total: 0, updated: 0, unchanged: 0 }
        });
      }

      console.log(`Recalculating attendance for ${employeeIds.length} employees from ${start_date} to ${end_date}`);

      // Get all attendance records for the period
      const records = await pool.query(`
        SELECT
          ad.id,
          ad.employee_id,
          ad.work_date,
          ad.day_status as current_status,
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
        WHERE ad.employee_id = ANY($1::uuid[])
          AND ad.work_date >= $2
          AND ad.work_date <= $3
          AND e.employment_status = 'active'
          AND e.requires_clocking = true
        ORDER BY ad.work_date DESC
      `, [employeeIds, start_date, end_date]);

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
              calcResult.is_working_day !== false,
              `Recalculé: ${row.current_status} → ${newStatus}`,
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

      console.log(`Recalculation complete: ${updatedCount} updated, ${unchangedCount} unchanged`);

      res.json({
        success: true,
        message: `${updatedCount} pointage(s) recalculé(s)`,
        stats: {
          total: records.rows.length,
          updated: updatedCount,
          unchanged: unchangedCount
        },
        changes: changes.slice(0, 50) // Limit response
      });

    } catch (error) {
      console.error('Error recalculating attendance:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

export default router;
