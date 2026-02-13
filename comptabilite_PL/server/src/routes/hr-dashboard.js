import express from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

// Get global HR statistics
router.get('/stats', authenticateToken, requirePermission('hr.dashboard.view_page'), async (req, res) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // Employee stats
    const employeeStats = await pool.query(`
      SELECT
        COUNT(*) as total_employees,
        COUNT(CASE WHEN employment_status = 'active' THEN 1 END) as active_employees,
        COUNT(CASE WHEN employment_status = 'on_leave' THEN 1 END) as on_leave,
        COUNT(CASE WHEN employment_status = 'suspended' THEN 1 END) as suspended,
        COUNT(CASE WHEN DATE_PART('month', hire_date) = $1 AND DATE_PART('year', hire_date) = $2 THEN 1 END) as new_hires_this_month
      FROM hr_employees
    `, [currentMonth, currentYear]);

    // Attendance stats for current month (using unified hr_attendance_daily)
    const attendanceStats = await pool.query(`
      SELECT
        COUNT(DISTINCT employee_id) as employees_with_records,
        AVG(COALESCE(net_worked_minutes, 0) / 60.0) as avg_hours_per_day,
        COUNT(CASE WHEN day_status = 'late' THEN 1 END) as total_late,
        COUNT(CASE WHEN day_status = 'absent' THEN 1 END) as total_absent
      FROM hr_attendance_daily
      WHERE EXTRACT(YEAR FROM work_date) = $1
        AND EXTRACT(MONTH FROM work_date) = $2
    `, [currentYear, currentMonth]);

    // Leave stats
    const leaveStats = await pool.query(`
      SELECT
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_requests,
        SUM(days_requested) as total_days_requested
      FROM hr_leave_requests
      WHERE EXTRACT(YEAR FROM created_at) = $1
        AND EXTRACT(MONTH FROM created_at) = $2
    `, [currentYear, currentMonth]);

    // Overtime stats
    const overtimeStats = await pool.query(`
      SELECT
        COUNT(*) as total_requests,
        SUM(estimated_hours) as total_hours_requested,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_approval
      FROM hr_overtime_requests
      WHERE EXTRACT(YEAR FROM request_date) = $1
        AND EXTRACT(MONTH FROM request_date) = $2
    `, [currentYear, currentMonth]);

    res.json({
      success: true,
      data: {
        employees: employeeStats.rows[0],
        attendance: attendanceStats.rows[0],
        leaves: leaveStats.rows[0],
        overtime: overtimeStats.rows[0],
        period: { year: currentYear, month: currentMonth },
      },
    });
  } catch (error) {
    console.error('Error fetching HR stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get HR alerts (contracts expiring, negative balances, anomalies)
router.get('/alerts', authenticateToken, requirePermission('hr.dashboard.view_page'), async (req, res) => {
  try {
    const now = new Date();
    const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Contracts expiring soon
    const expiringContracts = await pool.query(`
      SELECT
        c.id,
        c.end_date,
        e.first_name || ' ' || e.last_name as employee_name,
        e.employee_number,
        c.contract_type
      FROM hr_contracts c
      JOIN hr_employees e ON c.employee_id = e.id
      WHERE c.end_date IS NOT NULL
        AND c.end_date BETWEEN NOW() AND $1
        AND e.employment_status = 'active'
      ORDER BY c.end_date ASC
    `, [in30Days]);

    // Attendance anomalies unresolved (using unified hr_attendance_daily)
    const anomalies = await pool.query(`
      SELECT
        a.id,
        a.work_date as attendance_date,
        a.anomaly_type,
        e.first_name || ' ' || e.last_name as employee_name,
        e.employee_number
      FROM hr_attendance_daily a
      JOIN hr_employees e ON a.employee_id = e.id
      WHERE a.is_anomaly = true
        AND a.anomaly_resolved = false
      ORDER BY a.work_date DESC
      LIMIT 20
    `);

    // Pending leave approvals
    const pendingLeaves = await pool.query(`
      SELECT
        r.id,
        r.start_date,
        r.end_date,
        r.days_requested,
        r.current_approver_level,
        e.first_name || ' ' || e.last_name as employee_name,
        e.employee_number,
        t.name as leave_type
      FROM hr_leave_requests r
      JOIN hr_employees e ON r.employee_id = e.id
      JOIN hr_leave_types t ON r.leave_type_id = t.id
      WHERE r.status IN ('pending', 'approved_n1')
      ORDER BY r.created_at ASC
      LIMIT 15
    `);

    // Pending overtime approvals
    const pendingOvertime = await pool.query(`
      SELECT
        o.id,
        o.request_date,
        o.estimated_hours,
        o.priority,
        e.first_name || ' ' || e.last_name as employee_name,
        e.employee_number
      FROM hr_overtime_requests o
      JOIN hr_employees e ON o.employee_id = e.id
      WHERE o.status = 'pending'
      ORDER BY o.priority DESC, o.created_at ASC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        expiring_contracts: expiringContracts.rows,
        attendance_anomalies: anomalies.rows,
        pending_leave_approvals: pendingLeaves.rows,
        pending_overtime_approvals: pendingOvertime.rows,
      },
    });
  } catch (error) {
    console.error('Error fetching HR alerts:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get attendance chart data
router.get('/charts/attendance', authenticateToken, requirePermission('hr.dashboard.view_page'), async (req, res) => {
  const { year, month, type } = req.query;
  const targetYear = year || new Date().getFullYear();
  const targetMonth = month || new Date().getMonth() + 1;

  try {
    if (type === 'daily') {
      // Daily attendance breakdown for the month (using unified hr_attendance_daily)
      const result = await pool.query(`
        SELECT
          work_date as attendance_date,
          COUNT(*) as total,
          COUNT(CASE WHEN day_status = 'present' THEN 1 END) as present,
          COUNT(CASE WHEN day_status = 'late' THEN 1 END) as late,
          COUNT(CASE WHEN day_status = 'absent' THEN 1 END) as absent,
          COUNT(CASE WHEN day_status = 'leave' THEN 1 END) as on_leave
        FROM hr_attendance_daily
        WHERE EXTRACT(YEAR FROM work_date) = $1
          AND EXTRACT(MONTH FROM work_date) = $2
        GROUP BY work_date
        ORDER BY work_date
      `, [targetYear, targetMonth]);

      res.json({ success: true, data: result.rows });
    } else {
      // Status distribution (using unified hr_attendance_daily)
      const result = await pool.query(`
        SELECT
          day_status as status,
          COUNT(*) as count
        FROM hr_attendance_daily
        WHERE EXTRACT(YEAR FROM work_date) = $1
          AND EXTRACT(MONTH FROM work_date) = $2
        GROUP BY day_status
        ORDER BY count DESC
      `, [targetYear, targetMonth]);

      res.json({ success: true, data: result.rows });
    }
  } catch (error) {
    console.error('Error fetching attendance chart data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get leaves chart data
router.get('/charts/leaves', authenticateToken, requirePermission('hr.dashboard.view_page'), async (req, res) => {
  const { year } = req.query;
  const targetYear = year || new Date().getFullYear();

  try {
    // Leaves by type
    const byType = await pool.query(`
      SELECT
        t.name as leave_type,
        t.color,
        COUNT(r.id) as request_count,
        SUM(r.days_requested) as total_days
      FROM hr_leave_types t
      LEFT JOIN hr_leave_requests r ON t.id = r.leave_type_id
        AND EXTRACT(YEAR FROM r.start_date) = $1
        AND r.status = 'approved'
      GROUP BY t.id, t.name, t.color, t.sort_order
      ORDER BY t.sort_order
    `, [targetYear]);

    // Monthly trend
    const monthly = await pool.query(`
      SELECT
        EXTRACT(MONTH FROM start_date) as month,
        COUNT(*) as request_count,
        SUM(days_requested) as total_days
      FROM hr_leave_requests
      WHERE EXTRACT(YEAR FROM start_date) = $1
        AND status = 'approved'
      GROUP BY EXTRACT(MONTH FROM start_date)
      ORDER BY month
    `, [targetYear]);

    res.json({
      success: true,
      data: {
        by_type: byType.rows,
        monthly_trend: monthly.rows,
      },
    });
  } catch (error) {
    console.error('Error fetching leaves chart data:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get monthly summary with export capability
router.get('/monthly-summary/:year/:month', authenticateToken, requirePermission('hr.dashboard.view_page'), async (req, res) => {
  try {
    const { year, month } = req.params;
    const { format } = req.query; // format: 'json' or 'csv'

    // Monthly summary using unified hr_attendance_daily
    const result = await pool.query(`
      SELECT
        e.id,
        e.employee_number,
        e.first_name || ' ' || e.last_name as employee_name,
        e.department,
        e.position,
        COUNT(CASE WHEN a.day_status = 'present' THEN 1 END) as days_present,
        COUNT(CASE WHEN a.day_status = 'absent' THEN 1 END) as days_absent,
        COUNT(CASE WHEN a.day_status = 'late' THEN 1 END) as days_late,
        COUNT(CASE WHEN a.day_status = 'leave' THEN 1 END) as days_leave,
        SUM(COALESCE(a.net_worked_minutes, 0)) / 60.0 as total_hours,
        SUM(COALESCE(a.late_minutes, 0)) as total_late_minutes,
        COUNT(lr.id) as leave_requests,
        SUM(COALESCE(lr.days_requested, 0)) as leave_days_taken,
        COUNT(ot.id) as overtime_requests,
        SUM(COALESCE(ot.estimated_hours, 0)) as overtime_hours
      FROM hr_employees e
      LEFT JOIN hr_attendance_daily a ON e.id = a.employee_id
        AND EXTRACT(YEAR FROM a.work_date) = $1
        AND EXTRACT(MONTH FROM a.work_date) = $2
      LEFT JOIN hr_leave_requests lr ON e.id = lr.employee_id
        AND EXTRACT(YEAR FROM lr.start_date) = $1
        AND EXTRACT(MONTH FROM lr.start_date) = $2
        AND lr.status = 'approved'
      LEFT JOIN hr_overtime_requests ot ON e.id = ot.employee_id
        AND EXTRACT(YEAR FROM ot.request_date) = $1
        AND EXTRACT(MONTH FROM ot.request_date) = $2
        AND ot.status = 'approved'
      WHERE e.employment_status = 'active'
      GROUP BY e.id, e.employee_number, e.first_name, e.last_name, e.department, e.position
      ORDER BY e.last_name, e.first_name
    `, [year, month]);

    if (format === 'csv') {
      // Generate CSV
      const headers = [
        'Matricule',
        'Nom',
        'Département',
        'Poste',
        'Jours Présents',
        'Jours Absents',
        'Jours Retard',
        'Jours Congé',
        'Heures Travaillées',
        'Minutes Retard Total',
        'Demandes Congé',
        'Jours Congé Pris',
        'Demandes H.Sup',
        'Heures Supplémentaires',
      ];

      const rows = result.rows.map(r => [
        r.employee_number,
        r.employee_name,
        r.department || '-',
        r.position || '-',
        r.days_present,
        r.days_absent,
        r.days_late,
        r.days_leave,
        parseFloat(r.total_hours || 0).toFixed(2),
        r.total_late_minutes,
        r.leave_requests,
        parseFloat(r.leave_days_taken || 0).toFixed(1),
        r.overtime_requests,
        parseFloat(r.overtime_hours || 0).toFixed(2),
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=rapport-rh-${year}-${month}.csv`);
      res.send(csv);
    } else {
      res.json({ success: true, data: result.rows });
    }
  } catch (error) {
    console.error('Error fetching monthly summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
