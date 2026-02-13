/**
 * HR Recovery Management API
 * Gestion des récupérations d'heures (Ramadan, ponts, etc.)
 */

import express from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import pool from '../config/database.js';
import { AttendanceCalculator } from '../services/attendance-calculator.js';

const router = express.Router();

/**
 * Synchronise hr_attendance_daily pour une date de récupération donnée
 * Appelé après création/modification/suppression d'une recovery_declaration
 */
async function syncAttendanceForRecoveryDate(recoveryDate, employeeIds = null) {
  console.log(`[RECOVERY SYNC] Synchronizing attendance for ${recoveryDate}...`);

  const calculator = new AttendanceCalculator(pool);

  try {
    // Si pas d'employeeIds fournis, récupérer tous les employés actifs
    let employees;
    if (employeeIds && employeeIds.length > 0) {
      employees = await pool.query(
        'SELECT id FROM hr_employees WHERE id = ANY($1::uuid[]) AND employment_status = $2',
        [employeeIds, 'active']
      );
    } else {
      employees = await pool.query(
        'SELECT id FROM hr_employees WHERE employment_status = $1 AND requires_clocking = true',
        ['active']
      );
    }

    let updatedCount = 0;

    for (const emp of employees.rows) {
      // Vérifier si une ligne existe pour cette date
      const existing = await pool.query(
        'SELECT id, day_status, clock_in_at, clock_out_at FROM hr_attendance_daily WHERE employee_id = $1 AND work_date = $2',
        [emp.id, recoveryDate]
      );

      if (existing.rows.length > 0) {
        const row = existing.rows[0];

        // Recalculer le statut
        const calcResult = await calculator.calculateDayStatus(
          emp.id,
          recoveryDate,
          row.clock_in_at,
          row.clock_out_at
        );

        // Mettre à jour si différent
        if (calcResult.day_status !== row.day_status) {
          await pool.query(`
            UPDATE hr_attendance_daily
            SET day_status = $1, updated_at = NOW()
            WHERE id = $2
          `, [calcResult.day_status, row.id]);

          console.log(`  ✓ Employee ${emp.id}: ${row.day_status} → ${calcResult.day_status}`);
          updatedCount++;
        }
      }
    }

    console.log(`[RECOVERY SYNC] Complete: ${updatedCount} records updated`);
    return updatedCount;
  } catch (error) {
    console.error('[RECOVERY SYNC] Error:', error);
    // Don't throw - this is a background sync, shouldn't fail the main operation
    return 0;
  }
}

// ============================================================
// PÉRIODES DE RÉCUPÉRATION
// ============================================================

/**
 * GET /api/hr/recovery/periods
 * Get all recovery periods
 */
router.get('/periods', authenticateToken, requirePermission('hr.recovery.view'), async (req, res) => {
  try {
    const { status, department_id, segment_id } = req.query;

    let query = `
      SELECT
        id, name, description,
        start_date, end_date,
        total_hours_to_recover,
        hours_recovered,
        hours_remaining,
        department_id, segment_id, centre_id,
        applies_to_all, status,
        created_by, created_at, updated_at
      FROM hr_recovery_periods
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (department_id) {
      query += ` AND (department_id = $${paramCount} OR applies_to_all = true)`;
      params.push(department_id);
      paramCount++;
    }

    if (segment_id) {
      query += ` AND (segment_id = $${paramCount} OR applies_to_all = true)`;
      params.push(segment_id);
      paramCount++;
    }

    query += ` ORDER BY start_date DESC, created_at DESC`;

    const result = await pool.query(query, params);

    res.json({ success: true, periods: result.rows });
  } catch (error) {
    console.error('Error fetching recovery periods:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/hr/recovery/periods/:id
 * Get a single recovery period
 */
router.get('/periods/:id', authenticateToken, requirePermission('hr.recovery.view'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        id, name, description,
        start_date, end_date,
        total_hours_to_recover,
        hours_recovered,
        hours_remaining,
        department_id, segment_id, centre_id,
        applies_to_all, status,
        created_by, created_at, updated_at
      FROM hr_recovery_periods
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Period not found' });
    }

    res.json({ success: true, period: result.rows[0] });
  } catch (error) {
    console.error('Error fetching recovery period:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/hr/recovery/periods
 * Create a new recovery period
 */
router.post('/periods', authenticateToken, requirePermission('hr.recovery.manage'), async (req, res) => {
  try {
    const {
      name,
      description,
      start_date,
      end_date,
      total_hours_to_recover,
      department_id,
      segment_id,
      centre_id,
      applies_to_all
    } = req.body;

    // Validation
    if (!name || !start_date || !end_date || total_hours_to_recover === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Name, start_date, end_date, and total_hours_to_recover are required'
      });
    }

    if (new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({
        success: false,
        error: 'End date must be after start date'
      });
    }

    if (total_hours_to_recover < 0) {
      return res.status(400).json({
        success: false,
        error: 'Total hours to recover must be positive'
      });
    }

    const result = await pool.query(`
      INSERT INTO hr_recovery_periods (
        name, description,
        start_date, end_date,
        total_hours_to_recover,
        department_id, segment_id, centre_id,
        applies_to_all,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      name, description,
      start_date, end_date,
      total_hours_to_recover,
      department_id, segment_id, centre_id,
      applies_to_all || false,
      req.user.profile_id
    ]);

    res.json({ success: true, period: result.rows[0] });
  } catch (error) {
    console.error('Error creating recovery period:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/hr/recovery/periods/:id
 * Update a recovery period
 */
router.put('/periods/:id', authenticateToken, requirePermission('hr.recovery.manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      start_date,
      end_date,
      total_hours_to_recover,
      department_id,
      segment_id,
      centre_id,
      applies_to_all,
      status
    } = req.body;

    // Check if period exists
    const checkResult = await pool.query('SELECT id FROM hr_recovery_periods WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Period not found' });
    }

    // Validation
    if (end_date && start_date && new Date(end_date) < new Date(start_date)) {
      return res.status(400).json({
        success: false,
        error: 'End date must be after start date'
      });
    }

    if (total_hours_to_recover !== undefined && total_hours_to_recover < 0) {
      return res.status(400).json({
        success: false,
        error: 'Total hours to recover must be positive'
      });
    }

    const result = await pool.query(`
      UPDATE hr_recovery_periods
      SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        start_date = COALESCE($3, start_date),
        end_date = COALESCE($4, end_date),
        total_hours_to_recover = COALESCE($5, total_hours_to_recover),
        department_id = COALESCE($6, department_id),
        segment_id = COALESCE($7, segment_id),
        centre_id = COALESCE($8, centre_id),
        applies_to_all = COALESCE($9, applies_to_all),
        status = COALESCE($10, status)
      WHERE id = $11
      RETURNING *
    `, [
      name, description,
      start_date, end_date,
      total_hours_to_recover,
      department_id, segment_id, centre_id,
      applies_to_all, status,
      id
    ]);

    res.json({ success: true, period: result.rows[0] });
  } catch (error) {
    console.error('Error updating recovery period:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/hr/recovery/periods/:id
 * Delete a recovery period (cascade to declarations and employee recoveries)
 */
router.delete('/periods/:id', authenticateToken, requirePermission('hr.recovery.manage'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      DELETE FROM hr_recovery_periods
      WHERE id = $1
      RETURNING id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Period not found' });
    }

    res.json({ success: true, message: 'Period deleted successfully' });
  } catch (error) {
    console.error('Error deleting recovery period:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/hr/recovery/periods/:id/summary
 * Get summary of a recovery period
 */
router.get('/periods/:id/summary', authenticateToken, requirePermission('hr.recovery.view'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get period details
    const periodResult = await pool.query(`
      SELECT * FROM hr_recovery_periods WHERE id = $1
    `, [id]);

    if (periodResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Period not found' });
    }

    const period = periodResult.rows[0];

    // Get declarations summary
    const declarationsResult = await pool.query(`
      SELECT
        COUNT(*) as total_declarations,
        COUNT(CASE WHEN is_day_off = true THEN 1 END) as days_off_count,
        COUNT(CASE WHEN is_day_off = false THEN 1 END) as recovery_days_count,
        SUM(CASE WHEN is_day_off = false THEN hours_to_recover ELSE 0 END) as scheduled_recovery_hours,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_declarations
      FROM hr_recovery_declarations
      WHERE recovery_period_id = $1
    `, [id]);

    // Get employee participation summary
    const participationResult = await pool.query(`
      SELECT
        COUNT(DISTINCT employee_id) as total_employees_affected,
        COUNT(CASE WHEN was_present = true THEN 1 END) as employees_present,
        COUNT(CASE WHEN was_present = false THEN 1 END) as employees_absent,
        SUM(hours_recovered) as actual_hours_recovered,
        SUM(CASE WHEN deduction_applied = true THEN deduction_amount ELSE 0 END) as total_deductions
      FROM hr_employee_recoveries er
      JOIN hr_recovery_declarations rd ON er.recovery_declaration_id = rd.id
      WHERE rd.recovery_period_id = $1
    `, [id]);

    res.json({
      success: true,
      summary: {
        period,
        declarations: declarationsResult.rows[0],
        participation: participationResult.rows[0]
      }
    });
  } catch (error) {
    console.error('Error fetching period summary:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// DÉCLARATIONS DE RÉCUPÉRATION
// ============================================================

/**
 * GET /api/hr/recovery/declarations
 * Get all recovery declarations
 */
router.get('/declarations', authenticateToken, requirePermission('hr.recovery.view'), async (req, res) => {
  try {
    const { period_id, status, is_day_off, start_date, end_date } = req.query;

    let query = `
      SELECT
        d.id, d.recovery_period_id, d.recovery_date,
        d.hours_to_recover, d.is_day_off,
        d.department_id, d.segment_id, d.centre_id,
        d.notes, d.status,
        d.created_by, d.created_at, d.updated_at,
        p.name as period_name
      FROM hr_recovery_declarations d
      JOIN hr_recovery_periods p ON d.recovery_period_id = p.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (period_id) {
      query += ` AND d.recovery_period_id = $${paramCount}`;
      params.push(period_id);
      paramCount++;
    }

    if (status) {
      query += ` AND d.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (is_day_off !== undefined) {
      query += ` AND d.is_day_off = $${paramCount}`;
      params.push(is_day_off === 'true');
      paramCount++;
    }

    if (start_date) {
      query += ` AND d.recovery_date >= $${paramCount}`;
      params.push(start_date);
      paramCount++;
    }

    if (end_date) {
      query += ` AND d.recovery_date <= $${paramCount}`;
      params.push(end_date);
      paramCount++;
    }

    query += ` ORDER BY d.recovery_date DESC`;

    const result = await pool.query(query, params);

    res.json({ success: true, declarations: result.rows });
  } catch (error) {
    console.error('Error fetching recovery declarations:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/hr/recovery/declarations/:id
 * Get a single recovery declaration
 */
router.get('/declarations/:id', authenticateToken, requirePermission('hr.recovery.view'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        d.*,
        p.name as period_name,
        p.total_hours_to_recover,
        p.hours_remaining
      FROM hr_recovery_declarations d
      JOIN hr_recovery_periods p ON d.recovery_period_id = p.id
      WHERE d.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Declaration not found' });
    }

    res.json({ success: true, declaration: result.rows[0] });
  } catch (error) {
    console.error('Error fetching recovery declaration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/hr/recovery/declarations
 * Create a new recovery declaration
 */
router.post('/declarations', authenticateToken, requirePermission('hr.recovery.manage'), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      recovery_period_id,
      recovery_date,
      hours_to_recover,
      is_day_off,
      department_id,
      segment_id,
      centre_id,
      notes
    } = req.body;

    // Validation
    if (!recovery_period_id || !recovery_date || hours_to_recover === undefined || is_day_off === undefined) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'recovery_period_id, recovery_date, hours_to_recover, and is_day_off are required'
      });
    }

    if (hours_to_recover < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'hours_to_recover must be positive'
      });
    }

    // Check if period exists and is active
    const periodCheck = await client.query(`
      SELECT id, status, department_id, segment_id, centre_id, applies_to_all
      FROM hr_recovery_periods
      WHERE id = $1
    `, [recovery_period_id]);

    if (periodCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Recovery period not found' });
    }

    const period = periodCheck.rows[0];

    if (period.status !== 'active') {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Recovery period is not active' });
    }

    // Create declaration
    const declarationResult = await client.query(`
      INSERT INTO hr_recovery_declarations (
        recovery_period_id, recovery_date,
        hours_to_recover, is_day_off,
        department_id, segment_id, centre_id,
        notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      recovery_period_id, recovery_date,
      hours_to_recover, is_day_off,
      department_id || period.department_id,
      segment_id || period.segment_id,
      centre_id || period.centre_id,
      notes,
      req.user.profile_id
    ]);

    const declaration = declarationResult.rows[0];

    // Create employee recoveries for all affected employees
    let employeeQuery = `
      SELECT id, profile_id
      FROM hr_employees
      WHERE employment_status = 'active'
    `;
    const employeeParams = [];
    let paramCount = 1;

    if (declaration.department_id && !period.applies_to_all) {
      employeeQuery += ` AND department = $${paramCount}`;
      employeeParams.push(declaration.department_id);
      paramCount++;
    }

    if (declaration.segment_id && !period.applies_to_all) {
      employeeQuery += ` AND segment_id = $${paramCount}`;
      employeeParams.push(declaration.segment_id);
      paramCount++;
    }

    if (declaration.centre_id && !period.applies_to_all) {
      employeeQuery += ` AND centre_id = $${paramCount}`;
      employeeParams.push(declaration.centre_id);
      paramCount++;
    }

    const employeesResult = await client.query(employeeQuery, employeeParams);

    // Insert employee recoveries
    for (const employee of employeesResult.rows) {
      await client.query(`
        INSERT INTO hr_employee_recoveries (
          employee_id,
          recovery_declaration_id,
          recovery_date,
          is_day_off,
          expected_to_work
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        employee.id,
        declaration.id,
        recovery_date,
        is_day_off,
        !is_day_off  // If not a day off, they're expected to work
      ]);
    }

    await client.query('COMMIT');

    // Sync attendance records for the recovery date (background, non-blocking)
    const employeeIdsToSync = employeesResult.rows.map(e => e.id);
    syncAttendanceForRecoveryDate(recovery_date, employeeIdsToSync).catch(err => {
      console.error('[POST /declarations] Sync error (non-fatal):', err);
    });

    res.json({
      success: true,
      declaration,
      employees_affected: employeesResult.rows.length
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating recovery declaration:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/hr/recovery/declarations/:id
 * Update a recovery declaration
 */
router.put('/declarations/:id', authenticateToken, requirePermission('hr.recovery.manage'), async (req, res) => {
  try {
    const { id } = req.params;
    const { recovery_date, hours_to_recover, notes, status } = req.body;

    // Check if declaration exists
    const checkResult = await pool.query('SELECT id, status FROM hr_recovery_declarations WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Declaration not found' });
    }

    if (checkResult.rows[0].status === 'completed') {
      return res.status(400).json({ success: false, error: 'Cannot modify completed declaration' });
    }

    if (hours_to_recover !== undefined && hours_to_recover < 0) {
      return res.status(400).json({ success: false, error: 'hours_to_recover must be positive' });
    }

    const result = await pool.query(`
      UPDATE hr_recovery_declarations
      SET
        recovery_date = COALESCE($1, recovery_date),
        hours_to_recover = COALESCE($2, hours_to_recover),
        notes = COALESCE($3, notes),
        status = COALESCE($4, status)
      WHERE id = $5
      RETURNING *
    `, [recovery_date, hours_to_recover, notes, status, id]);

    const declaration = result.rows[0];

    // Sync attendance records for the recovery date (background, non-blocking)
    syncAttendanceForRecoveryDate(declaration.recovery_date).catch(err => {
      console.error('[PUT /declarations] Sync error (non-fatal):', err);
    });

    res.json({ success: true, declaration });
  } catch (error) {
    console.error('Error updating recovery declaration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/hr/recovery/declarations/:id
 * Delete a recovery declaration
 */
router.delete('/declarations/:id', authenticateToken, requirePermission('hr.recovery.manage'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if already completed and get recovery_date for sync
    const checkResult = await pool.query(
      'SELECT status, recovery_date FROM hr_recovery_declarations WHERE id = $1',
      [id]
    );
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Declaration not found' });
    }

    if (checkResult.rows[0].status === 'completed') {
      return res.status(400).json({ success: false, error: 'Cannot delete completed declaration' });
    }

    const recoveryDate = checkResult.rows[0].recovery_date;

    const result = await pool.query(`
      DELETE FROM hr_recovery_declarations
      WHERE id = $1
      RETURNING id
    `, [id]);

    // Sync attendance records for the recovery date (background, non-blocking)
    // This will recalculate statuses now that the recovery declaration is gone
    syncAttendanceForRecoveryDate(recoveryDate).catch(err => {
      console.error('[DELETE /declarations] Sync error (non-fatal):', err);
    });

    res.json({ success: true, message: 'Declaration deleted successfully' });
  } catch (error) {
    console.error('Error deleting recovery declaration:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/hr/recovery/declarations/:id/verify
 * Verify presences and apply deductions for a recovery declaration
 */
router.post('/declarations/:id/verify', authenticateToken, requirePermission('hr.recovery.manage'), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Get declaration details
    const declarationResult = await client.query(`
      SELECT * FROM hr_recovery_declarations WHERE id = $1
    `, [id]);

    if (declarationResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Declaration not found' });
    }

    const declaration = declarationResult.rows[0];

    // Get all employee recoveries for this declaration
    const recoveries = await client.query(`
      SELECT * FROM hr_employee_recoveries
      WHERE recovery_declaration_id = $1 AND expected_to_work = true
    `, [id]);

    let presentCount = 0;
    let absentCount = 0;
    let totalDeductions = 0;

    for (const recovery of recoveries.rows) {
      // Check attendance for this employee on this date
      const attendanceResult = await client.query(`
        SELECT id, check_in, check_out, actual_work_minutes
        FROM hr_attendance_records
        WHERE employee_id = $1
          AND attendance_date = $2
          AND status != 'absent'
        LIMIT 1
      `, [recovery.employee_id, declaration.recovery_date]);

      if (attendanceResult.rows.length > 0) {
        // Employee was present
        const attendance = attendanceResult.rows[0];
        const hours_recovered = (attendance.actual_work_minutes || 0) / 60;

        await client.query(`
          UPDATE hr_employee_recoveries
          SET
            was_present = true,
            attendance_record_id = $1,
            hours_recovered = $2,
            deduction_applied = false,
            deduction_amount = 0
          WHERE id = $3
        `, [attendance.id, hours_recovered, recovery.id]);

        presentCount++;
      } else {
        // Employee was absent - apply deduction
        // Get employee's contract to calculate deduction
        const contractResult = await client.query(`
          SELECT salary_gross, working_hours_per_week
          FROM hr_contracts
          WHERE employee_id = $1 AND status = 'active'
          LIMIT 1
        `, [recovery.employee_id]);

        let deduction_amount = 0;
        if (contractResult.rows.length > 0) {
          const contract = contractResult.rows[0];
          const monthly_hours = (contract.working_hours_per_week || 44) * 4.33; // 4.33 weeks per month average
          const hourly_rate = contract.salary_gross / monthly_hours;
          deduction_amount = hourly_rate * declaration.hours_to_recover;
        }

        await client.query(`
          UPDATE hr_employee_recoveries
          SET
            was_present = false,
            hours_recovered = 0,
            deduction_applied = true,
            deduction_amount = $1
          WHERE id = $2
        `, [deduction_amount, recovery.id]);

        absentCount++;
        totalDeductions += deduction_amount;
      }
    }

    // Mark declaration as completed
    await client.query(`
      UPDATE hr_recovery_declarations
      SET status = 'completed'
      WHERE id = $1
    `, [id]);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Verification completed',
      summary: {
        total_employees: recoveries.rows.length,
        present: presentCount,
        absent: absentCount,
        total_deductions: totalDeductions.toFixed(2)
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error verifying recovery declaration:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// ============================================================
// SUIVI EMPLOYÉS
// ============================================================

/**
 * GET /api/hr/recovery/employees/:employee_id
 * Get all recoveries for an employee
 */
router.get('/employees/:employee_id', authenticateToken, requirePermission('hr.recovery.view'), async (req, res) => {
  try {
    const { employee_id } = req.params;

    const result = await pool.query(`
      SELECT
        er.*,
        rd.recovery_date, rd.is_day_off, rd.hours_to_recover as declared_hours,
        rp.name as period_name, rp.start_date as period_start, rp.end_date as period_end
      FROM hr_employee_recoveries er
      JOIN hr_recovery_declarations rd ON er.recovery_declaration_id = rd.id
      JOIN hr_recovery_periods rp ON rd.recovery_period_id = rp.id
      WHERE er.employee_id = $1
      ORDER BY rd.recovery_date DESC
    `, [employee_id]);

    res.json({ success: true, recoveries: result.rows });
  } catch (error) {
    console.error('Error fetching employee recoveries:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/hr/recovery/declarations/:id/employees
 * Get all employees concerned by a declaration
 */
router.get('/declarations/:id/employees', authenticateToken, requirePermission('hr.recovery.view'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        er.*,
        e.employee_number, e.first_name, e.last_name, e.department,
        c.salary_gross
      FROM hr_employee_recoveries er
      JOIN hr_employees e ON er.employee_id = e.id
      LEFT JOIN hr_contracts c ON e.id = c.employee_id AND c.status = 'active'
      WHERE er.recovery_declaration_id = $1
      ORDER BY e.last_name, e.first_name
    `, [id]);

    res.json({ success: true, employees: result.rows });
  } catch (error) {
    console.error('Error fetching declaration employees:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
