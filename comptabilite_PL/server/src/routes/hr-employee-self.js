import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import pool from '../config/database.js';
import { checkLeaveOverlap } from '../utils/leave-validation.js';

const router = express.Router();

/**
 * Get my employee profile
 */
router.get('/profile',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;

    try {
      const result = await pool.query(`
        SELECT
          e.*,
          s.name as segment_name,
          m.first_name || ' ' || m.last_name as manager_name,
          c.contract_type,
          c.start_date as contract_start_date,
          c.end_date as contract_end_date,
          c.salary_gross,
          c.working_hours_per_week
        FROM hr_employees e
        LEFT JOIN segments s ON e.segment_id = s.id
        LEFT JOIN hr_employees m ON e.manager_id = m.id
        LEFT JOIN hr_contracts c ON c.employee_id = e.id AND c.status = 'active'
        WHERE e.profile_id = $1
      `, [userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Employee profile not found' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get my requests (leave + correction)
 * Unified endpoint that returns all request types
 */
router.get('/requests',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;
    const { status, year, type } = req.query;

    try {
      // Get employee ID
      const employee = await pool.query(
        'SELECT id FROM hr_employees WHERE profile_id = $1',
        [userId]
      );

      if (employee.rows.length === 0) {
        return res.json({ success: true, data: [] });
      }

      const employeeId = employee.rows[0].id;

      // Build unified query with UNION ALL for all request types
      let query = `
        WITH all_requests AS (
          -- Leave requests
          SELECT
            lr.id,
            'leave' as request_type,
            lt.name as request_subtype,
            lr.start_date,
            lr.end_date,
            lr.days_requested as duration_days,
            NULL::numeric as duration_hours,
            lr.reason,
            lr.status,
            lr.created_at,
            lr.updated_at,
            lt.name as leave_type_name,
            lt.color as leave_type_color,
            lt.requires_justification,
            p.full_name as approved_by_name
          FROM hr_leave_requests lr
          LEFT JOIN hr_leave_types lt ON lt.id = lr.leave_type_id
          LEFT JOIN profiles p ON p.id = lr.approved_by
          WHERE lr.employee_id = $1

          UNION ALL

          -- Correction requests
          SELECT
            cr.id,
            'correction' as request_type,
            'Correction pointage' as request_subtype,
            cr.request_date as start_date,
            cr.request_date as end_date,
            NULL as duration_days,
            NULL as duration_hours,
            cr.reason,
            cr.status,
            cr.created_at,
            cr.updated_at,
            NULL as leave_type_name,
            NULL as leave_type_color,
            false as requires_justification,
            NULL as approved_by_name
          FROM hr_attendance_correction_requests cr
          WHERE cr.employee_id = $1
        )
        SELECT * FROM all_requests
        WHERE 1=1
      `;
      const params = [employeeId];
      let paramCount = 2;

      if (status) {
        query += ` AND status = $${paramCount}`;
        params.push(status);
        paramCount++;
      }

      if (year) {
        query += ` AND EXTRACT(YEAR FROM start_date) = $${paramCount}`;
        params.push(parseInt(year));
        paramCount++;
      }

      if (type) {
        query += ` AND request_type = $${paramCount}`;
        params.push(type);
        paramCount++;
      }

      query += ' ORDER BY created_at DESC';

      const result = await pool.query(query, params);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Error fetching my requests:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Submit a new leave request
 */
router.post('/requests',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;
    const {
      leave_type_id,
      start_date,
      end_date,
      days_requested,
      reason,
      contact_during_leave,
      interim_person_id,
      justification_url
    } = req.body;

    try {
      // Get employee ID
      const employee = await pool.query(
        'SELECT id FROM hr_employees WHERE profile_id = $1',
        [userId]
      );

      if (employee.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Employee profile not found' });
      }

      const employeeId = employee.rows[0].id;

      // Check leave type requirements
      const leaveType = await pool.query(
        'SELECT * FROM hr_leave_types WHERE id = $1',
        [leave_type_id]
      );

      if (leaveType.rows.length === 0) {
        return res.status(400).json({ success: false, error: 'Invalid leave type' });
      }

      if (leaveType.rows[0].requires_justification && !justification_url) {
        return res.status(400).json({ success: false, error: 'Justification is required for this leave type' });
      }

      // Check for overlapping requests
      const overlapCheck = await checkLeaveOverlap(pool, employeeId, start_date, end_date);
      if (overlapCheck.hasOverlap) {
        const overlapping = overlapCheck.overlappingRequests[0];
        return res.status(400).json({
          success: false,
          error: 'Vous avez déjà une demande pour cette période',
          details: {
            existing_request_id: overlapping.id,
            existing_dates: `${overlapping.start_date} - ${overlapping.end_date}`,
            existing_type: overlapping.leave_type_name,
            existing_status: overlapping.status
          }
        });
      }

      // Get leave balance
      const balance = await pool.query(`
        SELECT
          COALESCE(lb.total_days, 0) as total_days,
          COALESCE(lb.used_days, 0) as used_days,
          COALESCE(lb.total_days, 0) - COALESCE(lb.used_days, 0) as available_days
        FROM hr_leave_balances lb
        WHERE lb.employee_id = $1 AND lb.leave_type_id = $2 AND lb.year = EXTRACT(YEAR FROM $3::date)
      `, [employeeId, leave_type_id, start_date]);

      const availableDays = balance.rows[0]?.available_days || 0;
      if (days_requested > availableDays && leaveType.rows[0].deducts_from_balance) {
        return res.status(400).json({
          success: false,
          error: `Insufficient balance. Available: ${availableDays} days, Requested: ${days_requested} days`
        });
      }

      // Create request
      const result = await pool.query(`
        INSERT INTO hr_leave_requests (
          employee_id, leave_type_id, start_date, end_date, days_requested,
          reason, contact_during_leave, interim_person_id, justification_url,
          status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending', $10)
        RETURNING *
      `, [
        employeeId, leave_type_id, start_date, end_date, days_requested,
        reason, contact_during_leave, interim_person_id, justification_url, userId
      ]);

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Error creating request:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Cancel a pending request (DELETE method - legacy)
 */
router.delete('/requests/:id',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
      // Get employee ID
      const employee = await pool.query(
        'SELECT id FROM hr_employees WHERE profile_id = $1',
        [userId]
      );

      if (employee.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Employee profile not found' });
      }

      const result = await pool.query(`
        UPDATE hr_leave_requests
        SET status = 'cancelled', cancelled_at = NOW()
        WHERE id = $1 AND employee_id = $2 AND status = 'pending'
        RETURNING *
      `, [id, employee.rows[0].id]);

      if (result.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Request not found or cannot be cancelled'
        });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Error cancelling request:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Cancel a pending request (POST method - supports all request types)
 * Allows employee to cancel their own pending/in-progress requests
 * Works for leave requests, correction requests, and other types
 */
router.post('/requests/:id/cancel',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { request_type } = req.body; // Optional: can specify type if known

    try {
      // Get employee ID
      const employee = await pool.query(
        'SELECT id FROM hr_employees WHERE profile_id = $1',
        [userId]
      );

      if (employee.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Profil employé non trouvé' });
      }

      const employeeId = employee.rows[0].id;
      let result;
      let requestType = request_type;

      // If request_type not specified, try to find the request in both tables
      if (!requestType) {
        // Check leave requests first
        const leaveCheck = await pool.query(
          'SELECT id FROM hr_leave_requests WHERE id = $1 AND employee_id = $2',
          [id, employeeId]
        );
        if (leaveCheck.rows.length > 0) {
          requestType = 'leave';
        } else {
          // Check correction requests
          const correctionCheck = await pool.query(
            'SELECT id FROM hr_attendance_correction_requests WHERE id = $1 AND employee_id = $2',
            [id, employeeId]
          );
          if (correctionCheck.rows.length > 0) {
            requestType = 'correction';
          }
        }
      }

      if (!requestType) {
        return res.status(404).json({
          success: false,
          error: 'Demande non trouvée'
        });
      }

      if (requestType === 'leave') {
        // Cancel leave request
        result = await pool.query(`
          UPDATE hr_leave_requests
          SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND employee_id = $2
            AND (status = 'pending' OR status LIKE 'approved_n%')
          RETURNING *
        `, [id, employeeId]);
      } else if (requestType === 'correction') {
        // Cancel correction request
        result = await pool.query(`
          UPDATE hr_attendance_correction_requests
          SET status = 'cancelled', updated_at = NOW()
          WHERE id = $1 AND employee_id = $2
            AND (status = 'pending' OR status LIKE 'approved_n%')
          RETURNING *
        `, [id, employeeId]);
      } else {
        return res.status(400).json({
          success: false,
          error: 'Type de demande non supporté'
        });
      }

      if (result.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Demande non trouvée ou ne peut pas être annulée (déjà validée ou refusée)'
        });
      }

      res.json({
        success: true,
        message: 'Demande annulée avec succès',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error cancelling request:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get my leave balances
 */
router.get('/leave-balances',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;
    const { year = new Date().getFullYear() } = req.query;

    try {
      const employee = await pool.query(
        'SELECT id FROM hr_employees WHERE profile_id = $1',
        [userId]
      );

      if (employee.rows.length === 0) {
        return res.json({ success: true, data: [] });
      }

      const result = await pool.query(`
        SELECT
          lb.*,
          lt.name as leave_type_name,
          lt.color as leave_type_color,
          lb.total_days - lb.used_days as available_days
        FROM hr_leave_balances lb
        JOIN hr_leave_types lt ON lt.id = lb.leave_type_id
        WHERE lb.employee_id = $1 AND lb.year = $2
        ORDER BY lt.name
      `, [employee.rows[0].id, parseInt(year)]);

      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Error fetching leave balances:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get my payslips
 */
router.get('/payslips',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;
    const { year, limit = 12 } = req.query;

    try {
      const employee = await pool.query(
        'SELECT id FROM hr_employees WHERE profile_id = $1',
        [userId]
      );

      if (employee.rows.length === 0) {
        return res.json({ success: true, data: [] });
      }

      let query = `
        SELECT
          ps.id,
          ps.period_id,
          p.year,
          p.month,
          p.name as period_name,
          ps.base_salary,
          ps.gross_salary,
          ps.net_salary,
          ps.status,
          ps.generated_at,
          ps.validated_at,
          ps.pdf_url
        FROM hr_payslips ps
        JOIN hr_payroll_periods p ON p.id = ps.period_id
        WHERE ps.employee_id = $1 AND ps.status IN ('validated', 'paid')
      `;
      const params = [employee.rows[0].id];
      let paramCount = 2;

      if (year) {
        query += ` AND p.year = $${paramCount}`;
        params.push(parseInt(year));
        paramCount++;
      }

      query += ` ORDER BY p.year DESC, p.month DESC LIMIT $${paramCount}`;
      params.push(parseInt(limit));

      const result = await pool.query(query, params);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Error fetching payslips:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get single payslip details
 */
router.get('/payslips/:id',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    try {
      const employee = await pool.query(
        'SELECT id FROM hr_employees WHERE profile_id = $1',
        [userId]
      );

      if (employee.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Employee profile not found' });
      }

      // Get payslip
      const payslip = await pool.query(`
        SELECT ps.*, p.year, p.month, p.name as period_name
        FROM hr_payslips ps
        JOIN hr_payroll_periods p ON p.id = ps.period_id
        WHERE ps.id = $1 AND ps.employee_id = $2 AND ps.status IN ('validated', 'paid')
      `, [id, employee.rows[0].id]);

      if (payslip.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Payslip not found' });
      }

      // Get payslip lines
      const lines = await pool.query(`
        SELECT * FROM hr_payslip_lines
        WHERE payslip_id = $1
        ORDER BY display_order, line_type
      `, [id]);

      // Audit log
      await pool.query(`
        INSERT INTO hr_payroll_audit_logs (entity_type, entity_id, action, performed_by)
        VALUES ('payslip', $1, 'view', $2)
      `, [id, userId]);

      res.json({
        success: true,
        data: {
          ...payslip.rows[0],
          lines: lines.rows
        }
      });
    } catch (error) {
      console.error('Error fetching payslip:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get my attendance history
 * Returns formatted data for display:
 * - check_in: formatted time string (HH:MI) or '-'
 * - check_out: formatted time string (HH:MI) or '-'
 * - status: 'present' if check_in exists, 'absent' otherwise
 * - worked_minutes: calculated from check_in to check_out
 * - has_anomaly: true if check_in exists but no check_out
 */
router.get('/attendance',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;
    const { start_date, end_date, limit = 30 } = req.query;

    try {
      const employee = await pool.query(
        'SELECT id FROM hr_employees WHERE profile_id = $1',
        [userId]
      );

      if (employee.rows.length === 0) {
        return res.json({ success: true, data: [] });
      }

      let query = `
        SELECT
          DATE(clock_time) as date,
          TO_CHAR(MIN(CASE WHEN status IN ('check_in', 'late') THEN clock_time END), 'HH24:MI') as check_in,
          TO_CHAR(MAX(CASE WHEN status = 'check_out' THEN clock_time END), 'HH24:MI') as check_out,
          CASE
            WHEN COUNT(CASE WHEN status IN ('check_in', 'late') THEN 1 END) > 0 THEN 'present'
            ELSE 'absent'
          END as status,
          CASE
            WHEN MAX(CASE WHEN status = 'check_out' THEN clock_time END) IS NOT NULL
             AND MIN(CASE WHEN status IN ('check_in', 'late') THEN clock_time END) IS NOT NULL
            THEN EXTRACT(EPOCH FROM (
              MAX(CASE WHEN status = 'check_out' THEN clock_time END) -
              MIN(CASE WHEN status IN ('check_in', 'late') THEN clock_time END)
            ))::int / 60
            ELSE NULL
          END as worked_minutes,
          CASE
            WHEN COUNT(CASE WHEN status IN ('check_in', 'late') THEN 1 END) > 0
             AND COUNT(CASE WHEN status = 'check_out' THEN 1 END) = 0
            THEN true
            ELSE false
          END as has_anomaly
        FROM hr_attendance_records
        WHERE employee_id = $1
      `;
      const params = [employee.rows[0].id];
      let paramCount = 2;

      if (start_date) {
        query += ` AND DATE(clock_time) >= $${paramCount}`;
        params.push(start_date);
        paramCount++;
      }

      if (end_date) {
        query += ` AND DATE(clock_time) <= $${paramCount}`;
        params.push(end_date);
        paramCount++;
      }

      query += ` GROUP BY DATE(clock_time) ORDER BY DATE(clock_time) DESC LIMIT $${paramCount}`;
      params.push(parseInt(limit));

      const result = await pool.query(query, params);

      // Format results: replace null with '-' for display
      const formattedData = result.rows.map(row => ({
        ...row,
        check_in: row.check_in || '-',
        check_out: row.check_out || '-'
      }));

      res.json({ success: true, data: formattedData });
    } catch (error) {
      console.error('Error fetching attendance:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get my documents
 */
router.get('/documents',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;

    try {
      const employee = await pool.query(
        'SELECT id FROM hr_employees WHERE profile_id = $1',
        [userId]
      );

      if (employee.rows.length === 0) {
        return res.json({ success: true, data: [] });
      }

      const result = await pool.query(`
        SELECT *
        FROM hr_employee_documents
        WHERE employee_id = $1
        ORDER BY uploaded_at DESC
      `, [employee.rows[0].id]);

      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Error fetching documents:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get my contract
 */
router.get('/contract',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;

    try {
      const employee = await pool.query(
        'SELECT id FROM hr_employees WHERE profile_id = $1',
        [userId]
      );

      if (employee.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Employee profile not found' });
      }

      const result = await pool.query(`
        SELECT *
        FROM hr_contracts
        WHERE employee_id = $1
        ORDER BY start_date DESC
        LIMIT 1
      `, [employee.rows[0].id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'No contract found' });
      }

      // Hide sensitive salary info if needed
      const contract = result.rows[0];
      // contract.salary_gross = undefined; // Uncomment to hide

      res.json({ success: true, data: contract });
    } catch (error) {
      console.error('Error fetching contract:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get available leave types
 */
router.get('/leave-types',
  authenticateToken,
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT id, name, description, color, requires_justification, max_days_per_request
        FROM hr_leave_types
        WHERE is_active = TRUE
        ORDER BY name
      `);

      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Error fetching leave types:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get colleagues for interim selection
 */
router.get('/colleagues',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;

    try {
      // Get colleagues (same department/segment)
      const result = await pool.query(`
        SELECT
          e.id,
          e.first_name || ' ' || e.last_name as name,
          e.position,
          e.department
        FROM hr_employees e
        WHERE e.profile_id != $1
        AND e.employment_status = 'active'
        AND (
          e.department = (SELECT department FROM hr_employees WHERE profile_id = $1)
          OR e.segment_id = (SELECT segment_id FROM hr_employees WHERE profile_id = $1)
        )
        ORDER BY e.last_name, e.first_name
      `, [userId]);

      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Error fetching colleagues:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ============================================================
// CORRECTION REQUESTS - Demandes de correction de pointage
// ============================================================

/**
 * Submit a correction request for incomplete clocking
 * POST /api/hr/my/correction-requests
 */
router.post('/correction-requests',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;
    const { request_date, requested_check_in, requested_check_out, original_check_in, original_check_out, reason } = req.body;

    try {
      // Validation
      if (!request_date || !reason) {
        return res.status(400).json({
          success: false,
          error: 'La date et le motif sont obligatoires'
        });
      }

      if (!requested_check_in && !requested_check_out) {
        return res.status(400).json({
          success: false,
          error: 'Veuillez spécifier au moins une heure (entrée ou sortie)'
        });
      }

      // Find HR employee linked to this user
      const employeeResult = await pool.query(`
        SELECT id FROM hr_employees WHERE profile_id = $1
      `, [userId]);

      if (employeeResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Employé non trouvé'
        });
      }

      const employeeId = employeeResult.rows[0].id;

      // Check if a request already exists for this date
      const existingRequest = await pool.query(`
        SELECT id FROM hr_attendance_correction_requests
        WHERE employee_id = $1 AND request_date = $2 AND status NOT IN ('rejected', 'cancelled')
      `, [employeeId, request_date]);

      if (existingRequest.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Une demande de correction existe déjà pour cette date'
        });
      }

      // Récupérer automatiquement les pointages originaux depuis hr_attendance_daily si non fournis
      let finalOriginalCheckIn = original_check_in || null;
      let finalOriginalCheckOut = original_check_out || null;

      // Si les originaux ne sont pas fournis ou sont vides, les récupérer depuis la BDD
      if (!finalOriginalCheckIn || !finalOriginalCheckOut) {
        const existingRecord = await pool.query(`
          SELECT
            (clock_in_at AT TIME ZONE 'Africa/Casablanca')::time as check_in_time,
            (clock_out_at AT TIME ZONE 'Africa/Casablanca')::time as check_out_time
          FROM hr_attendance_daily
          WHERE employee_id = $1 AND work_date = $2
          LIMIT 1
        `, [employeeId, request_date]);

        if (existingRecord.rows.length > 0) {
          const rec = existingRecord.rows[0];
          if (!finalOriginalCheckIn && rec.check_in_time) {
            finalOriginalCheckIn = rec.check_in_time.substring(0, 5);
          }
          if (!finalOriginalCheckOut && rec.check_out_time) {
            finalOriginalCheckOut = rec.check_out_time.substring(0, 5);
          }
        }
      }

      // Create the request
      const result = await pool.query(`
        INSERT INTO hr_attendance_correction_requests
          (employee_id, request_date, requested_check_in, requested_check_out, original_check_in, original_check_out, reason, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
        RETURNING *
      `, [employeeId, request_date, requested_check_in || null, requested_check_out || null, finalOriginalCheckIn, finalOriginalCheckOut, reason]);

      res.json({
        success: true,
        message: 'Demande de correction soumise avec succès',
        request: result.rows[0]
      });

    } catch (error) {
      console.error('Error creating correction request:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la création de la demande',
        details: error.message
      });
    }
  }
);

/**
 * Get my correction requests
 * GET /api/hr/my/correction-requests
 */
router.get('/correction-requests',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;

    try {
      // Find HR employee
      const employeeResult = await pool.query(`
        SELECT id FROM hr_employees WHERE profile_id = $1
      `, [userId]);

      if (employeeResult.rows.length === 0) {
        return res.json({ success: true, requests: [] });
      }

      const employeeId = employeeResult.rows[0].id;

      const result = await pool.query(`
        SELECT
          cr.*,
          n1.first_name || ' ' || n1.last_name as n1_approver_name,
          n2.first_name || ' ' || n2.last_name as n2_approver_name
        FROM hr_attendance_correction_requests cr
        LEFT JOIN hr_employees n1 ON cr.n1_approver_id = n1.id
        LEFT JOIN hr_employees n2 ON cr.n2_approver_id = n2.id
        WHERE cr.employee_id = $1
        ORDER BY cr.created_at DESC
      `, [employeeId]);

      res.json({
        success: true,
        requests: result.rows
      });

    } catch (error) {
      console.error('Error fetching my correction requests:', error);
      res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des demandes',
        details: error.message
      });
    }
  }
);

export default router;
