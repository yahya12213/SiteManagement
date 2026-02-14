import express from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import pool from '../config/database.js';
import { uploadDeclarationAttachment } from '../middleware/upload.js';
import { checkLeaveOverlap } from '../utils/leave-validation.js';
import { deductLeaveBalance, accrueMonthlyLeave, getCurrentLeaveBalance } from '../services/leaveBalanceService.js';

const router = express.Router();

// Get leave types
router.get('/types', authenticateToken, requirePermission('hr.leaves.view_page'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM hr_leave_types
      WHERE is_active = true
      ORDER BY sort_order
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching leave types:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get leave requests
router.get('/requests', authenticateToken, requirePermission('hr.leaves.view_page'), async (req, res) => {
  const { employee_id, status, start_date, end_date } = req.query;

  try {
    let query = `
      SELECT
        r.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.employee_number,
        t.name as leave_type_name,
        t.code as leave_type_code,
        t.color as leave_type_color
      FROM hr_leave_requests r
      JOIN hr_employees e ON r.employee_id = e.id
      JOIN hr_leave_types t ON r.leave_type_id = t.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (employee_id) {
      query += ` AND r.employee_id = $${paramCount}`;
      params.push(employee_id);
      paramCount++;
    }

    if (status) {
      query += ` AND r.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (start_date) {
      query += ` AND r.start_date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += ` AND r.end_date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    query += ' ORDER BY r.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching leave requests:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create leave request
router.post('/requests', authenticateToken, requirePermission('hr.leaves.create'), uploadDeclarationAttachment, async (req, res) => {
  try {
    const {
      employee_id,
      leave_type_id,
      start_date,
      end_date,
      start_half_day,
      end_half_day,
      reason,
      contact_during_leave,
      handover_notes
    } = req.body;

    // Calculate days requested
    const start = new Date(start_date);
    const end = new Date(end_date);
    let days_requested = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;

    // Adjust for half days
    if (start_half_day) days_requested -= 0.5;
    if (end_half_day) days_requested -= 0.5;

    // Get justification file path if uploaded
    const justification_url = req.file ? `/uploads/declarations/${req.file.filename}` : null;

    // Check for overlapping requests
    const overlapCheck = await checkLeaveOverlap(pool, employee_id, start_date, end_date);
    if (overlapCheck.hasOverlap) {
      const overlapping = overlapCheck.overlappingRequests[0];
      return res.status(400).json({
        success: false,
        error: 'Une demande existe déjà pour cette période',
        details: {
          existing_request_id: overlapping.id,
          existing_dates: `${overlapping.start_date} - ${overlapping.end_date}`,
          existing_type: overlapping.leave_type_name,
          existing_status: overlapping.status
        }
      });
    }

    const result = await pool.query(`
      INSERT INTO hr_leave_requests (
        employee_id, leave_type_id, start_date, end_date,
        start_half_day, end_half_day, days_requested, reason,
        contact_during_leave, handover_notes, justification_url, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      employee_id, leave_type_id, start_date, end_date,
      start_half_day || false, end_half_day || false,
      days_requested, reason, contact_during_leave,
      handover_notes, justification_url, req.user.id
    ]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating leave request:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Approve leave request
router.put('/requests/:id/approve', authenticateToken, requirePermission('hr.leaves.approve'), async (req, res) => {
  try {
    const { id } = req.params;
    const { level, comment } = req.body; // level: 'n1', 'n2', or 'hr'

    const request = await pool.query(
      'SELECT * FROM hr_leave_requests WHERE id = $1',
      [id]
    );

    if (request.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    let updateQuery = '';
    let newStatus = request.rows[0].status;

    if (level === 'n1') {
      updateQuery = `
        n1_approver_id = $2,
        n1_status = 'approved',
        n1_comment = $3,
        n1_action_at = NOW(),
        current_approver_level = 'n2'
      `;
      newStatus = 'approved_n1';
    } else if (level === 'n2') {
      updateQuery = `
        n2_approver_id = $2,
        n2_status = 'approved',
        n2_comment = $3,
        n2_action_at = NOW(),
        current_approver_level = 'completed',
        status = 'approved'
      `;
      newStatus = 'approved';
    } else if (level === 'hr') {
      updateQuery = `
        hr_approver_id = $2,
        hr_status = 'approved',
        hr_comment = $3,
        hr_action_at = NOW(),
        status = 'approved'
      `;
      newStatus = 'approved';
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(`
        UPDATE hr_leave_requests
        SET ${updateQuery}, status = $4, updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [id, req.user.id, comment, newStatus]);

      // Si le congé est approuvé définitivement, déduire du solde
      if (newStatus === 'approved') {
        try {
          await deductLeaveBalance(id, req.user.id, client);
          console.log(`✅ Leave balance deducted for request ${id}`);
        } catch (deductError) {
          console.error('Error deducting leave balance:', deductError);
          // Ne pas bloquer l'approbation si la déduction échoue
        }
      }

      await client.query('COMMIT');
      res.json({ success: true, data: result.rows[0] });
    } catch (txError) {
      await client.query('ROLLBACK');
      throw txError;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error approving leave:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reject leave request
router.put('/requests/:id/reject', authenticateToken, requirePermission('hr.leaves.approve'), async (req, res) => {
  try {
    const { id } = req.params;
    const { level, comment } = req.body;

    let updateQuery = '';
    if (level === 'n1') {
      updateQuery = `
        n1_approver_id = $2,
        n1_status = 'rejected',
        n1_comment = $3,
        n1_action_at = NOW()
      `;
    } else if (level === 'n2') {
      updateQuery = `
        n2_approver_id = $2,
        n2_status = 'rejected',
        n2_comment = $3,
        n2_action_at = NOW()
      `;
    }

    const result = await pool.query(`
      UPDATE hr_leave_requests
      SET ${updateQuery}, status = 'rejected', updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, req.user.id, comment]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error rejecting leave:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get leave balances for employee
router.get('/balances/:employee_id', authenticateToken, requirePermission('hr.leaves.view_page'), async (req, res) => {
  try {
    const { employee_id } = req.params;
    const year = new Date().getFullYear();

    const result = await pool.query(`
      SELECT
        b.*,
        t.name as leave_type_name,
        t.code as leave_type_code,
        t.color as leave_type_color
      FROM hr_leave_balances b
      JOIN hr_leave_types t ON b.leave_type_id = t.id
      WHERE b.employee_id = $1 AND b.year = $2
      ORDER BY t.sort_order
    `, [employee_id, year]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching balances:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update leave balance (adjustment)
router.put('/balances/:id/adjust', authenticateToken, requirePermission('hr.leaves.edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const { adjustment, reason } = req.body;

    const result = await pool.query(`
      UPDATE hr_leave_balances
      SET
        adjusted = adjusted + $2,
        adjustment_reason = $3,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, adjustment, reason]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Balance not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error adjusting balance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get holidays
router.get('/holidays', authenticateToken, requirePermission('hr.leaves.view_page'), async (req, res) => {
  const { year } = req.query;
  const targetYear = year || new Date().getFullYear();

  try {
    const result = await pool.query(`
      SELECT * FROM hr_holidays
      WHERE year = $1
      ORDER BY holiday_date
    `, [targetYear]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching holidays:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Add holiday
router.post('/holidays', authenticateToken, requirePermission('hr.leaves.create'), async (req, res) => {
  try {
    const {
      name,
      description,
      holiday_date,
      holiday_type,
      is_recurring,
      recurring_month,
      recurring_day
    } = req.body;

    const year = new Date(holiday_date).getFullYear();

    const result = await pool.query(`
      INSERT INTO hr_holidays (
        name, description, holiday_date, holiday_type,
        year, is_recurring, recurring_month, recurring_day,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      name, description, holiday_date, holiday_type || 'paid',
      year, is_recurring || false, recurring_month, recurring_day,
      req.user.id
    ]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating holiday:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Leave calendar data
router.get('/calendar', authenticateToken, requirePermission('hr.leaves.view_page'), async (req, res) => {
  const { start_date, end_date } = req.query;

  try {
    const result = await pool.query(`
      SELECT
        r.id,
        r.start_date,
        r.end_date,
        r.status,
        e.first_name || ' ' || e.last_name as employee_name,
        t.name as leave_type,
        t.color
      FROM hr_leave_requests r
      JOIN hr_employees e ON r.employee_id = e.id
      JOIN hr_leave_types t ON r.leave_type_id = t.id
      WHERE r.start_date <= $2 AND r.end_date >= $1
        AND r.status IN ('approved', 'approved_n1', 'approved_n2')
      ORDER BY r.start_date
    `, [start_date, end_date]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching calendar:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get accrual periods
router.get('/periods', authenticateToken, requirePermission('hr.leaves.view_page'), async (req, res) => {
  const { year } = req.query;
  const targetYear = year || new Date().getFullYear();

  try {
    const result = await pool.query(`
      SELECT p.*,
        (SELECT COUNT(*) FROM hr_leave_balance_history h WHERE h.period_id = p.id AND h.movement_type = 'accrual') as accruals_count
      FROM hr_leave_accrual_periods p
      WHERE p.year = $1
      ORDER BY p.month
    `, [targetYear]);

    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching periods:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Run monthly accrual for all active employees in a period
router.post('/accrue/:periodId', authenticateToken, requirePermission('hr.leaves.edit'), async (req, res) => {
  const { periodId } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Vérifier que la période existe et est terminée
    const periodCheck = await client.query(`
      SELECT * FROM hr_leave_accrual_periods WHERE id = $1
    `, [periodId]);

    if (periodCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: `Période ${periodId} non trouvée` });
    }

    const period = periodCheck.rows[0];
    const today = new Date();

    if (today <= new Date(period.end_date)) {
      return res.status(400).json({
        success: false,
        error: `La période ${period.label} n'est pas encore terminée (fin: ${period.end_date})`
      });
    }

    // Récupérer tous les employés actifs
    const employees = await client.query(`
      SELECT id, first_name, last_name, employee_number
      FROM hr_employees
      WHERE employment_status = 'active'
    `);

    const results = [];
    const errors = [];

    for (const emp of employees.rows) {
      try {
        const result = await accrueMonthlyLeave(emp.id, periodId, client);
        if (result) {
          results.push({
            employeeId: emp.id,
            employeeName: `${emp.first_name} ${emp.last_name}`,
            employeeNumber: emp.employee_number,
            ...result
          });
        }
      } catch (empError) {
        errors.push({
          employeeId: emp.id,
          employeeName: `${emp.first_name} ${emp.last_name}`,
          error: empError.message
        });
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      period: period.label,
      totalEmployees: employees.rows.length,
      accrued: results.length,
      skipped: employees.rows.length - results.length - errors.length,
      errors: errors.length,
      details: results,
      errorDetails: errors
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error running accrual:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// Get current leave balance for an employee (detailed)
router.get('/balance/:employeeId', authenticateToken, requirePermission('hr.leaves.view_page'), async (req, res) => {
  const { employeeId } = req.params;

  try {
    const balance = await getCurrentLeaveBalance(employeeId);

    // Get balance history
    const history = await pool.query(`
      SELECT h.*, lt.name as leave_type_name
      FROM hr_leave_balance_history h
      LEFT JOIN hr_leave_types lt ON h.leave_type_id = lt.id
      WHERE h.employee_id = $1
      ORDER BY h.created_at DESC
      LIMIT 20
    `, [employeeId]);

    res.json({
      success: true,
      data: {
        ...balance,
        history: history.rows
      }
    });
  } catch (error) {
    console.error('Error fetching balance:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
