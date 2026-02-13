import express from 'express';
import pg from 'pg';
import { authenticateToken, requirePermission } from '../middleware/auth.js';

const { Pool } = pg;
const router = express.Router();

// Get pool connection
const getPool = () => new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * GET /api/hr/overtime/requests
 * Get all overtime requests with optional filters
 */
router.get('/requests', authenticateToken, requirePermission('hr.overtime.view'), async (req, res) => {
  const pool = getPool();

  try {
    const { status, year, month } = req.query;

    let query = `
      SELECT
        o.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.employee_number,
        TO_CHAR(o.request_date, 'Month YYYY') as period
      FROM hr_overtime_requests o
      JOIN hr_employees e ON o.employee_id = e.id
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND o.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    if (year) {
      query += ` AND EXTRACT(YEAR FROM o.request_date) = $${paramCount}`;
      params.push(parseInt(year));
      paramCount++;
    }

    if (month) {
      query += ` AND EXTRACT(MONTH FROM o.request_date) = $${paramCount}`;
      params.push(parseInt(month));
      paramCount++;
    }

    query += ' ORDER BY o.request_date DESC, o.created_at DESC';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching overtime requests:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

/**
 * POST /api/hr/overtime/requests
 * Create an overtime request
 */
router.post('/requests', authenticateToken, requirePermission('hr.overtime.create'), async (req, res) => {
  const pool = getPool();

  try {
    const {
      employee_id,
      request_date,
      start_time,
      end_time,
      reason,
      project_code,
      request_type,
      priority
    } = req.body;

    if (!employee_id || !request_date || !start_time || !end_time) {
      return res.status(400).json({
        success: false,
        error: 'Employé, date, heure de début et de fin sont requis'
      });
    }

    // Calculate estimated hours
    const [startH, startM] = start_time.split(':').map(Number);
    const [endH, endM] = end_time.split(':').map(Number);
    const estimated_hours = ((endH * 60 + endM) - (startH * 60 + startM)) / 60;

    const result = await pool.query(`
      INSERT INTO hr_overtime_requests (
        employee_id, request_date, start_time, end_time,
        estimated_hours, reason, project_code, request_type,
        priority, requested_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      employee_id, request_date, start_time, end_time,
      estimated_hours, reason, project_code,
      request_type || 'planned', priority || 'normal',
      req.user.id
    ]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating overtime request:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

/**
 * PUT /api/hr/overtime/requests/:id/approve
 * Approve an overtime request
 */
router.put('/requests/:id/approve', authenticateToken, requirePermission('hr.overtime.approve'), async (req, res) => {
  const pool = getPool();

  try {
    const { id } = req.params;
    const { level, comment } = req.body; // level: 'n1' or 'n2'

    // Default to 'n1' if not specified
    const approvalLevel = level || 'n1';

    let updateField, statusField, commentField;
    if (approvalLevel === 'n1') {
      updateField = 'n1_approver_id';
      statusField = 'n1_approved_at';
      commentField = 'n1_comment';
    } else if (approvalLevel === 'n2') {
      updateField = 'n2_approver_id';
      statusField = 'n2_approved_at';
      commentField = 'n2_comment';
    } else {
      return res.status(400).json({
        success: false,
        error: 'Invalid approval level. Must be "n1" or "n2"'
      });
    }

    const result = await pool.query(`
      UPDATE hr_overtime_requests
      SET
        ${updateField} = $2,
        ${statusField} = NOW(),
        ${commentField} = $3,
        status = CASE
          WHEN $4 = 'n2' THEN 'approved'
          WHEN $4 = 'n1' THEN 'approved_n1'
          ELSE status
        END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, req.user.id, comment, approvalLevel]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error approving overtime:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

/**
 * PUT /api/hr/overtime/requests/:id/reject
 * Reject an overtime request
 */
router.put('/requests/:id/reject', authenticateToken, requirePermission('hr.overtime.approve'), async (req, res) => {
  const pool = getPool();

  try {
    const { id } = req.params;
    const { level, comment } = req.body;

    const commentField = level === 'n2' ? 'n2_comment' : 'n1_comment';

    const result = await pool.query(`
      UPDATE hr_overtime_requests
      SET
        status = 'rejected',
        ${commentField} = $2,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id, comment]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Request not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error rejecting overtime:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

/**
 * DELETE /api/hr/overtime/requests/:id
 * Delete an overtime request (only if pending)
 */
router.delete('/requests/:id', authenticateToken, requirePermission('hr.overtime.delete'), async (req, res) => {
  const pool = getPool();

  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM hr_overtime_requests WHERE id = $1 AND status = $2 RETURNING id',
      [id, 'pending']
    );

    if (result.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Seules les demandes en attente peuvent être supprimées'
      });
    }

    res.json({ success: true, message: 'Demande supprimée' });
  } catch (error) {
    console.error('Error deleting overtime request:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

export default router;
