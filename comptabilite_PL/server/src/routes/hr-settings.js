import express from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import pool from '../config/database.js';
import {
  getClockConfig,
  getSystemTime,
  updateClockConfig,
  setAbsoluteTime,
  resetClock
} from '../services/system-clock.js';

const router = express.Router();

// Get all settings
router.get('/', authenticateToken, requirePermission('hr.settings.view_page'), async (req, res) => {
  const { category } = req.query;

  try {
    let query = 'SELECT * FROM hr_settings WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (category) {
      query += ` AND category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    query += ' ORDER BY category, setting_key';

    const result = await pool.query(query, params);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// === LEAVE TYPES MANAGEMENT ===

// Get all leave types
router.get('/leave-types/all', authenticateToken, requirePermission('hr.settings.view_page'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM hr_leave_types
      ORDER BY sort_order
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching leave types:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create leave type
router.post('/leave-types', authenticateToken, requirePermission('hr.settings.edit'), async (req, res) => {
  try {
    const {
      name,
      code,
      description,
      default_days,
      max_days_per_request,
      requires_approval,
      approval_workflow,
      deducts_from_balance,
      color,
      icon,
      sort_order,
    } = req.body;

    const result = await pool.query(`
      INSERT INTO hr_leave_types (
        name, code, description, default_days,
        max_days_per_request, requires_approval, approval_workflow,
        deducts_from_balance, color, icon, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      name, code, description, default_days || 0,
      max_days_per_request, requires_approval !== false, approval_workflow || 'n1',
      deducts_from_balance !== false, color || '#3B82F6', icon, sort_order || 99,
    ]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating leave type:', error);
    if (error.code === '23505') {
      res.status(400).json({ success: false, error: 'Leave type code already exists' });
    } else {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

// Update leave type
router.put('/leave-types/:id', authenticateToken, requirePermission('hr.settings.edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const fields = Object.keys(updates).filter(k => k !== 'id');
    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const setClause = fields.map((field, i) => `${field} = $${i + 2}`).join(', ');
    const values = fields.map(f => updates[f]);

    const result = await pool.query(
      `UPDATE hr_leave_types SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Leave type not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating leave type:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete leave type
router.delete('/leave-types/:id', authenticateToken, requirePermission('hr.settings.edit'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if leave type is in use
    const inUse = await pool.query(
      'SELECT COUNT(*) FROM hr_leave_requests WHERE leave_type_id = $1',
      [id]
    );

    if (parseInt(inUse.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete leave type that is in use',
      });
    }

    const result = await pool.query(
      'DELETE FROM hr_leave_types WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Leave type not found' });
    }

    res.json({ success: true, message: 'Leave type deleted' });
  } catch (error) {
    console.error('Error deleting leave type:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// === WORK SCHEDULES MANAGEMENT ===

// Get all work schedules
router.get('/schedules/all', authenticateToken, requirePermission('hr.settings.view_page'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM hr_work_schedules
      ORDER BY is_default DESC, name
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching work schedules:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create work schedule
router.post('/schedules', authenticateToken, requirePermission('hr.settings.edit'), async (req, res) => {
  try {
    const {
      name,
      description,
      monday_start, monday_end,
      tuesday_start, tuesday_end,
      wednesday_start, wednesday_end,
      thursday_start, thursday_end,
      friday_start, friday_end,
      saturday_start, saturday_end,
      sunday_start, sunday_end,
      weekly_hours,
      tolerance_late_minutes,
      tolerance_early_leave_minutes,
      min_hours_for_half_day,
      valid_from,
      valid_to,
      is_default,
      segment_id,
    } = req.body;

    // If setting as default, unset other defaults
    if (is_default) {
      await pool.query('UPDATE hr_work_schedules SET is_default = false');
    }

    const result = await pool.query(`
      INSERT INTO hr_work_schedules (
        name, description,
        monday_start, monday_end, tuesday_start, tuesday_end,
        wednesday_start, wednesday_end, thursday_start, thursday_end,
        friday_start, friday_end, saturday_start, saturday_end,
        sunday_start, sunday_end, weekly_hours,
        tolerance_late_minutes, tolerance_early_leave_minutes,
        min_hours_for_half_day, valid_from, valid_to,
        is_default, segment_id, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
      ) RETURNING *
    `, [
      name, description,
      monday_start, monday_end, tuesday_start, tuesday_end,
      wednesday_start, wednesday_end, thursday_start, thursday_end,
      friday_start, friday_end, saturday_start, saturday_end,
      sunday_start, sunday_end, weekly_hours || 44,
      tolerance_late_minutes || 15, tolerance_early_leave_minutes || 10,
      min_hours_for_half_day || 4, valid_from, valid_to,
      is_default || false, segment_id, req.user.id,
    ]);

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating work schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update work schedule
router.put('/schedules/:id', authenticateToken, requirePermission('hr.settings.edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // If setting as default, unset other defaults
    if (updates.is_default === true) {
      await pool.query('UPDATE hr_work_schedules SET is_default = false WHERE id != $1', [id]);
    }

    const fields = Object.keys(updates).filter(k => k !== 'id');
    if (fields.length === 0) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const setClause = fields.map((field, i) => `${field} = $${i + 2}`).join(', ');
    const values = fields.map(f => updates[f]);

    const result = await pool.query(
      `UPDATE hr_work_schedules SET ${setClause}, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [id, ...values]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Work schedule not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating work schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete work schedule
router.delete('/schedules/:id', authenticateToken, requirePermission('hr.settings.edit'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if schedule is in use
    const inUse = await pool.query(
      'SELECT COUNT(*) FROM hr_employee_schedules WHERE schedule_id = $1',
      [id]
    );

    if (parseInt(inUse.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete work schedule that is assigned to employees',
      });
    }

    const result = await pool.query(
      'DELETE FROM hr_work_schedules WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Work schedule not found' });
    }

    res.json({ success: true, message: 'Work schedule deleted' });
  } catch (error) {
    console.error('Error deleting work schedule:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// === SYSTEM CLOCK (Horloge système configurable) ===

/**
 * Get current system time
 * Retourne l'heure système utilisée pour tous les pointages
 * Si l'horloge personnalisée est activée, applique le temps configuré
 */
router.get('/system-clock/current-time', authenticateToken, async (req, res) => {
  try {
    const config = await getClockConfig(pool);
    const systemTime = await getSystemTime(pool);
    const serverTimeResult = await pool.query('SELECT NOW() as now');
    const isEnabled = config.enabled && config.desired_time && config.reference_server_time;

    res.json({
      success: true,
      data: {
        system_time: systemTime,
        server_time: serverTimeResult.rows[0].now,
        is_custom: isEnabled,
        offset_minutes: config.offset_minutes || 0,
        message: isEnabled
          ? `Horloge personnalisée active`
          : 'Horloge système PostgreSQL (NOW())'
      }
    });
  } catch (error) {
    console.error('Error fetching current system time:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get system clock configuration
 * Retourne la configuration complète de l'horloge système
 */
router.get('/system-clock', authenticateToken, requirePermission('hr.settings.view_page'), async (req, res) => {
  try {
    const config = await getClockConfig(pool);
    const systemTime = await getSystemTime(pool);
    const serverTimeResult = await pool.query('SELECT NOW() as now');
    const isEnabled = config.enabled && config.desired_time && config.reference_server_time;

    res.json({
      success: true,
      data: {
        enabled: isEnabled,
        offset_minutes: config.offset_minutes || 0,
        current_server_time: serverTimeResult.rows[0].now,
        current_system_time: systemTime,
        desired_time: config.desired_time || null,
        reference_server_time: config.reference_server_time || null,
        updated_at: config.updated_at || null,
        updated_by: config.updated_by || null
      }
    });
  } catch (error) {
    console.error('Error fetching system clock config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update system clock configuration
 * Accepte soit:
 * - { enabled: true, desired_datetime: "2026-01-22T10:30:00" } - NOUVELLE méthode (temps absolu)
 * - { enabled: true, offset_minutes: 60 } - Ancienne méthode (compatibilité)
 * - { enabled: false } - Désactiver
 */
router.put('/system-clock', authenticateToken, requirePermission('hr.settings.edit'), async (req, res) => {
  try {
    const { enabled, desired_datetime, offset_minutes } = req.body;

    let config;

    if (!enabled) {
      // Désactiver l'horloge personnalisée
      config = await resetClock(pool, req.user.id);
    } else if (desired_datetime) {
      // NOUVELLE méthode: temps absolu (préféré)
      config = await setAbsoluteTime(pool, true, desired_datetime, req.user.id);
    } else if (offset_minutes !== undefined && offset_minutes !== null) {
      // Ancienne méthode: offset en minutes (compatibilité)
      config = await updateClockConfig(pool, true, offset_minutes, req.user.id);
    } else {
      return res.status(400).json({
        success: false,
        error: 'desired_datetime ou offset_minutes est requis quand enabled est true'
      });
    }

    const systemTime = await getSystemTime(pool);
    const serverTimeResult = await pool.query('SELECT NOW() as now');

    res.json({
      success: true,
      message: config.enabled
        ? `Horloge personnalisée activée`
        : 'Horloge réinitialisée à l\'heure serveur',
      data: {
        enabled: config.enabled,
        current_system_time: systemTime,
        current_server_time: serverTimeResult.rows[0].now,
        desired_time: config.desired_time,
        reference_server_time: config.reference_server_time
      }
    });
  } catch (error) {
    console.error('Error updating system clock config:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Reset system clock to server time
 * Désactive l'horloge personnalisée et remet l'offset à 0
 */
router.post('/system-clock/reset', authenticateToken, requirePermission('hr.settings.edit'), async (req, res) => {
  try {
    const config = await resetClock(pool, req.user.id);
    const serverTimeResult = await pool.query('SELECT NOW() as now');

    res.json({
      success: true,
      message: 'Horloge système réinitialisée à l\'heure serveur',
      data: {
        ...config,
        server_time: serverTimeResult.rows[0].now,
        system_time: serverTimeResult.rows[0].now
      }
    });
  } catch (error) {
    console.error('Error resetting system clock:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// === GENERIC SETTING ROUTES (must be last to avoid catching specific routes) ===

// Get single setting by key
router.get('/:key', authenticateToken, requirePermission('hr.settings.view_page'), async (req, res) => {
  try {
    const { key } = req.params;
    const result = await pool.query(
      'SELECT * FROM hr_settings WHERE setting_key = $1',
      [key]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Setting not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching setting:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update setting by key
router.put('/:key', authenticateToken, requirePermission('hr.settings.edit'), async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    // Check if setting exists and is editable
    const existing = await pool.query(
      'SELECT * FROM hr_settings WHERE setting_key = $1',
      [key]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Setting not found' });
    }

    if (!existing.rows[0].is_editable) {
      return res.status(403).json({ success: false, error: 'This setting is not editable' });
    }

    const result = await pool.query(`
      UPDATE hr_settings
      SET setting_value = $2, updated_at = NOW(), updated_by = $3
      WHERE setting_key = $1
      RETURNING *
    `, [key, JSON.stringify(value), req.user.id]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating setting:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
