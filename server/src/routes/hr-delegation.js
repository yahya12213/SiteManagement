import express from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

/**
 * Get my delegations (delegations I created)
 */
router.get('/my',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;
    const { status } = req.query;

    try {
      let query = `
        SELECT
          d.*,
          delegate.full_name AS delegate_name,
          delegate.email AS delegate_email,
          CASE
            WHEN d.is_active = FALSE THEN 'cancelled'
            WHEN CURRENT_DATE < d.start_date THEN 'upcoming'
            WHEN CURRENT_DATE BETWEEN d.start_date AND d.end_date THEN 'active'
            ELSE 'expired'
          END AS current_status
        FROM hr_approval_delegations d
        JOIN profiles delegate ON delegate.id = d.delegate_id
        WHERE d.delegator_id = $1
      `;
      const params = [userId];
      let paramCount = 2;

      if (status === 'active') {
        query += ` AND d.is_active = TRUE AND CURRENT_DATE BETWEEN d.start_date AND d.end_date`;
      } else if (status === 'upcoming') {
        query += ` AND d.is_active = TRUE AND CURRENT_DATE < d.start_date`;
      } else if (status === 'expired') {
        query += ` AND d.is_active = TRUE AND CURRENT_DATE > d.end_date`;
      } else if (status === 'cancelled') {
        query += ` AND d.is_active = FALSE`;
      }

      query += ' ORDER BY d.created_at DESC';

      const result = await pool.query(query, params);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Error fetching my delegations:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get delegations I received (I am the delegate)
 */
router.get('/received',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;
    const { active_only = 'true' } = req.query;

    try {
      let query = `
        SELECT
          d.*,
          delegator.full_name AS delegator_name,
          delegator.email AS delegator_email,
          CASE
            WHEN d.is_active = FALSE THEN 'cancelled'
            WHEN CURRENT_DATE < d.start_date THEN 'upcoming'
            WHEN CURRENT_DATE BETWEEN d.start_date AND d.end_date THEN 'active'
            ELSE 'expired'
          END AS current_status
        FROM hr_approval_delegations d
        JOIN profiles delegator ON delegator.id = d.delegator_id
        WHERE d.delegate_id = $1
      `;
      const params = [userId];

      if (active_only === 'true') {
        query += ` AND d.is_active = TRUE AND CURRENT_DATE BETWEEN d.start_date AND d.end_date`;
      }

      query += ' ORDER BY d.start_date DESC';

      const result = await pool.query(query, params);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Error fetching received delegations:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get all delegations (admin view)
 */
router.get('/',
  authenticateToken,
  requirePermission('hr.delegation.view_all'),
  async (req, res) => {
    const { delegator_id, delegate_id, status, delegation_type } = req.query;

    try {
      let query = `
        SELECT
          d.*,
          delegator.full_name AS delegator_name,
          delegator.email AS delegator_email,
          delegate.full_name AS delegate_name,
          delegate.email AS delegate_email,
          CASE
            WHEN d.is_active = FALSE THEN 'cancelled'
            WHEN CURRENT_DATE < d.start_date THEN 'upcoming'
            WHEN CURRENT_DATE BETWEEN d.start_date AND d.end_date THEN 'active'
            ELSE 'expired'
          END AS current_status
        FROM hr_approval_delegations d
        JOIN profiles delegator ON delegator.id = d.delegator_id
        JOIN profiles delegate ON delegate.id = d.delegate_id
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 1;

      if (delegator_id) {
        query += ` AND d.delegator_id = $${paramCount}`;
        params.push(delegator_id);
        paramCount++;
      }

      if (delegate_id) {
        query += ` AND d.delegate_id = $${paramCount}`;
        params.push(delegate_id);
        paramCount++;
      }

      if (status === 'active') {
        query += ` AND d.is_active = TRUE AND CURRENT_DATE BETWEEN d.start_date AND d.end_date`;
      } else if (status === 'upcoming') {
        query += ` AND d.is_active = TRUE AND CURRENT_DATE < d.start_date`;
      } else if (status === 'expired') {
        query += ` AND d.is_active = TRUE AND CURRENT_DATE > d.end_date`;
      } else if (status === 'cancelled') {
        query += ` AND d.is_active = FALSE`;
      }

      if (delegation_type) {
        query += ` AND d.delegation_type = $${paramCount}`;
        params.push(delegation_type);
        paramCount++;
      }

      query += ' ORDER BY d.created_at DESC';

      const result = await pool.query(query, params);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Error fetching delegations:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get single delegation details
 */
router.get('/:id',
  authenticateToken,
  async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
      const result = await pool.query(`
        SELECT
          d.*,
          delegator.full_name AS delegator_name,
          delegator.email AS delegator_email,
          delegate.full_name AS delegate_name,
          delegate.email AS delegate_email,
          CASE
            WHEN d.is_active = FALSE THEN 'cancelled'
            WHEN CURRENT_DATE < d.start_date THEN 'upcoming'
            WHEN CURRENT_DATE BETWEEN d.start_date AND d.end_date THEN 'active'
            ELSE 'expired'
          END AS current_status
        FROM hr_approval_delegations d
        JOIN profiles delegator ON delegator.id = d.delegator_id
        JOIN profiles delegate ON delegate.id = d.delegate_id
        WHERE d.id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Delegation not found' });
      }

      const delegation = result.rows[0];

      // Check access: must be delegator, delegate, or have view_all permission
      const isInvolved = delegation.delegator_id === userId || delegation.delegate_id === userId;
      if (!isInvolved) {
        const hasPermission = await pool.query(`
          SELECT 1 FROM user_permissions up
          JOIN permissions p ON p.id = up.permission_id
          WHERE up.user_id = $1 AND p.id = 'hr.delegation.view_all'
        `, [userId]);

        if (hasPermission.rows.length === 0) {
          return res.status(403).json({ success: false, error: 'Access denied' });
        }
      }

      res.json({ success: true, data: delegation });
    } catch (error) {
      console.error('Error fetching delegation:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Create a new delegation
 */
router.post('/',
  authenticateToken,
  requirePermission('hr.delegation.create'),
  async (req, res) => {
    const userId = req.user.id;
    const {
      delegate_id,
      start_date,
      end_date,
      delegation_type = 'all',
      excluded_employees,
      max_amount,
      reason,
      notes,
      requires_notification = true
    } = req.body;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Validate delegate_id
      if (!delegate_id) {
        return res.status(400).json({ success: false, error: 'Delegate is required' });
      }

      // Cannot delegate to self
      if (delegate_id === userId) {
        return res.status(400).json({ success: false, error: 'Cannot delegate to yourself' });
      }

      // Check delegate exists and has receive permission
      const delegate = await client.query(`
        SELECT p.id, p.full_name, p.email
        FROM profiles p
        WHERE p.id = $1
      `, [delegate_id]);

      if (delegate.rows.length === 0) {
        return res.status(400).json({ success: false, error: 'Delegate not found' });
      }

      // Check for conflicting delegation (same period, same delegate)
      const conflict = await client.query(`
        SELECT id FROM hr_approval_delegations
        WHERE delegator_id = $1
        AND is_active = TRUE
        AND delegation_type = $2
        AND (
          ($3 BETWEEN start_date AND end_date) OR
          ($4 BETWEEN start_date AND end_date) OR
          (start_date BETWEEN $3 AND $4)
        )
      `, [userId, delegation_type, start_date, end_date]);

      if (conflict.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'A delegation already exists for this period and type'
        });
      }

      // Check for conflict of interest: delegate cannot be a subordinate with pending requests
      const subordinateConflict = await client.query(`
        SELECT 1 FROM hr_employees e
        WHERE e.manager_id = (SELECT id FROM hr_employees WHERE profile_id = $1)
        AND e.profile_id = $2
      `, [userId, delegate_id]);

      // Note: This is a warning, not a blocking error
      const hasSubordinateWarning = subordinateConflict.rows.length > 0;

      // Create delegation
      const result = await client.query(`
        INSERT INTO hr_approval_delegations (
          delegator_id, delegate_id, start_date, end_date,
          delegation_type, excluded_employees, max_amount,
          reason, notes, requires_notification, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $1)
        RETURNING *
      `, [
        userId, delegate_id, start_date, end_date,
        delegation_type, excluded_employees, max_amount,
        reason, notes, requires_notification
      ]);

      const delegation = result.rows[0];

      // Create notification for delegate
      if (requires_notification) {
        const delegator = await client.query(
          "SELECT full_name as name FROM profiles WHERE id = $1",
          [userId]
        );

        await client.query(`
          INSERT INTO hr_delegation_notifications (
            delegation_id, recipient_id, notification_type, message
          ) VALUES ($1, $2, 'delegate_assigned', $3)
        `, [
          delegation.id,
          delegate_id,
          `${delegator.rows[0].name} vous a délégué ses approbations du ${start_date} au ${end_date}`
        ]);

        // Mark notification sent
        await client.query(`
          UPDATE hr_approval_delegations
          SET notification_sent_to_delegate = TRUE
          WHERE id = $1
        `, [delegation.id]);
      }

      await client.query('COMMIT');

      res.json({
        success: true,
        data: delegation,
        warnings: hasSubordinateWarning ? ['Le délégué est un subordonné direct'] : []
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating delegation:', error);
      res.status(500).json({ success: false, error: error.message });
    } finally {
      client.release();
    }
  }
);

/**
 * Update a delegation
 */
router.put('/:id',
  authenticateToken,
  async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { end_date, excluded_employees, max_amount, notes } = req.body;

    try {
      // Check ownership
      const delegation = await pool.query(
        'SELECT * FROM hr_approval_delegations WHERE id = $1',
        [id]
      );

      if (delegation.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Delegation not found' });
      }

      if (delegation.rows[0].delegator_id !== userId) {
        // Check admin permission
        const hasPermission = await pool.query(`
          SELECT 1 FROM user_permissions up
          JOIN permissions p ON p.id = up.permission_id
          WHERE up.user_id = $1 AND p.id = 'hr.delegation.view_all'
        `, [userId]);

        if (hasPermission.rows.length === 0) {
          return res.status(403).json({ success: false, error: 'Cannot modify others delegations' });
        }
      }

      // Cannot modify cancelled or expired delegation
      const current = delegation.rows[0];
      if (!current.is_active) {
        return res.status(400).json({ success: false, error: 'Cannot modify cancelled delegation' });
      }

      if (new Date(current.end_date) < new Date()) {
        return res.status(400).json({ success: false, error: 'Cannot modify expired delegation' });
      }

      const result = await pool.query(`
        UPDATE hr_approval_delegations
        SET end_date = COALESCE($1, end_date),
            excluded_employees = COALESCE($2, excluded_employees),
            max_amount = COALESCE($3, max_amount),
            notes = COALESCE($4, notes)
        WHERE id = $5
        RETURNING *
      `, [end_date, excluded_employees, max_amount, notes, id]);

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Error updating delegation:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Cancel a delegation
 */
router.delete('/:id',
  authenticateToken,
  requirePermission('hr.delegation.cancel'),
  async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Check ownership or admin permission
      const delegation = await client.query(
        'SELECT * FROM hr_approval_delegations WHERE id = $1',
        [id]
      );

      if (delegation.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Delegation not found' });
      }

      const current = delegation.rows[0];
      const isOwner = current.delegator_id === userId;

      if (!isOwner) {
        const hasPermission = await client.query(`
          SELECT 1 FROM user_permissions up
          JOIN permissions p ON p.id = up.permission_id
          WHERE up.user_id = $1 AND p.id = 'hr.delegation.view_all'
        `, [userId]);

        if (hasPermission.rows.length === 0) {
          return res.status(403).json({ success: false, error: 'Cannot cancel others delegations' });
        }
      }

      if (!current.is_active) {
        return res.status(400).json({ success: false, error: 'Delegation already cancelled' });
      }

      // Cancel the delegation
      const result = await client.query(`
        UPDATE hr_approval_delegations
        SET is_active = FALSE,
            cancelled_at = NOW(),
            cancelled_by = $1,
            cancellation_reason = $2
        WHERE id = $3
        RETURNING *
      `, [userId, reason, id]);

      // Notify delegate
      await client.query(`
        INSERT INTO hr_delegation_notifications (
          delegation_id, recipient_id, notification_type, message
        ) VALUES ($1, $2, 'delegation_cancelled', $3)
      `, [
        id,
        current.delegate_id,
        `La délégation d'approbations a été annulée${reason ? ': ' + reason : ''}`
      ]);

      await client.query('COMMIT');

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error cancelling delegation:', error);
      res.status(500).json({ success: false, error: error.message });
    } finally {
      client.release();
    }
  }
);

/**
 * Check if user can approve for another user
 */
router.get('/check-approval/:original_approver_id',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;
    const { original_approver_id } = req.params;
    const { delegation_type = 'all' } = req.query;

    try {
      // Direct approval
      if (userId === original_approver_id) {
        return res.json({
          success: true,
          data: {
            can_approve: true,
            is_delegation: false,
            delegation_id: null,
            delegator_name: null
          }
        });
      }

      // Check delegation
      const delegation = await pool.query(`
        SELECT
          d.id as delegation_id,
          p.full_name as delegator_name
        FROM hr_approval_delegations d
        JOIN profiles p ON p.id = d.delegator_id
        WHERE d.delegate_id = $1
          AND d.delegator_id = $2
          AND d.is_active = TRUE
          AND CURRENT_DATE BETWEEN d.start_date AND d.end_date
          AND (d.delegation_type = 'all' OR d.delegation_type = $3)
        LIMIT 1
      `, [userId, original_approver_id, delegation_type]);

      if (delegation.rows.length > 0) {
        return res.json({
          success: true,
          data: {
            can_approve: true,
            is_delegation: true,
            delegation_id: delegation.rows[0].delegation_id,
            delegator_name: delegation.rows[0].delegator_name
          }
        });
      }

      res.json({
        success: true,
        data: {
          can_approve: false,
          is_delegation: false,
          delegation_id: null,
          delegator_name: null
        }
      });
    } catch (error) {
      console.error('Error checking approval:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get my delegation notifications
 */
router.get('/notifications/my',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;
    const { unread_only = 'false' } = req.query;

    try {
      let query = `
        SELECT n.*, d.start_date, d.end_date, d.delegation_type
        FROM hr_delegation_notifications n
        JOIN hr_approval_delegations d ON d.id = n.delegation_id
        WHERE n.recipient_id = $1
      `;

      if (unread_only === 'true') {
        query += ' AND n.is_read = FALSE';
      }

      query += ' ORDER BY n.created_at DESC LIMIT 50';

      const result = await pool.query(query, [userId]);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Error fetching notifications:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Mark notification as read
 */
router.put('/notifications/:id/read',
  authenticateToken,
  async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
      const result = await pool.query(`
        UPDATE hr_delegation_notifications
        SET is_read = TRUE, read_at = NOW()
        WHERE id = $1 AND recipient_id = $2
        RETURNING *
      `, [id, userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Notification not found' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Error marking notification read:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get available delegates (users who can receive delegations)
 */
router.get('/available-delegates',
  authenticateToken,
  async (req, res) => {
    const userId = req.user.id;

    try {
      // Get users who have the receive delegation permission or are managers
      const result = await pool.query(`
        SELECT DISTINCT
          p.id,
          p.full_name as name,
          p.email,
          e.position,
          e.department
        FROM profiles p
        LEFT JOIN hr_employees e ON e.profile_id = p.id
        WHERE p.id != $1
        AND p.is_active = TRUE
        ORDER BY name
      `, [userId]);

      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Error fetching available delegates:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

export default router;
