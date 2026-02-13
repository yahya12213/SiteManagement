/**
 * HR Validation Workflows API
 * Gestion des circuits d'approbation automatiques
 */

import express from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

// ============================================================
// WORKFLOWS CRUD
// ============================================================

/**
 * GET /api/hr/validation-workflows
 * Get all validation workflows
 */
router.get('/', authenticateToken, requirePermission('hr.validation_workflows.view_page'), async (req, res) => {
  try {
    const { trigger_type, active_only } = req.query;

    let query = `
      SELECT
        w.id,
        w.name as nom,
        w.description,
        w.trigger_type as declencheur,
        w.segment_id,
        s.name as segment_nom,
        w.is_active as actif,
        w.priority,
        w.conditions,
        w.created_at,
        w.updated_at,
        (
          SELECT COUNT(*)
          FROM hr_validation_workflow_steps ws
          WHERE ws.workflow_id = w.id
        ) as etapes_count,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', ws.id,
                'ordre', ws.step_order,
                'validateur_type', ws.approver_type,
                'validateur_id', ws.approver_id,
                'validateur_role', ws.approver_role,
                'validateur_nom', ws.approver_name,
                'condition', ws.condition_expression,
                'timeout_hours', ws.timeout_hours
              ) ORDER BY ws.step_order
            )
            FROM hr_validation_workflow_steps ws
            WHERE ws.workflow_id = w.id
          ),
          '[]'
        ) as etapes
      FROM hr_validation_workflows w
      LEFT JOIN segments s ON s.id = w.segment_id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (trigger_type) {
      query += ` AND w.trigger_type = $${paramCount}`;
      params.push(trigger_type);
      paramCount++;
    }

    if (active_only === 'true') {
      query += ` AND w.is_active = true`;
    }

    query += ` ORDER BY w.priority DESC, w.name`;

    const result = await pool.query(query, params);

    res.json({ success: true, workflows: result.rows });
  } catch (error) {
    console.error('Error fetching workflows:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/hr/validation-workflows/:id
 * Get a single workflow with all steps
 */
router.get('/:id', authenticateToken, requirePermission('hr.validation_workflows.view_page'), async (req, res) => {
  try {
    const { id } = req.params;

    const workflow = await pool.query(`
      SELECT
        w.*,
        s.name as segment_nom
      FROM hr_validation_workflows w
      LEFT JOIN segments s ON s.id = w.segment_id
      WHERE w.id = $1
    `, [id]);

    if (workflow.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Workflow non trouvé' });
    }

    const steps = await pool.query(`
      SELECT * FROM hr_validation_workflow_steps
      WHERE workflow_id = $1
      ORDER BY step_order
    `, [id]);

    res.json({
      success: true,
      workflow: {
        ...workflow.rows[0],
        etapes: steps.rows
      }
    });
  } catch (error) {
    console.error('Error fetching workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/hr/validation-workflows
 * Create a new workflow
 */
router.post('/', authenticateToken, requirePermission('hr.validation_workflows.create'), async (req, res) => {
  const client = await pool.connect();

  try {
    const { nom, description, declencheur, segment_id, actif, priority, etapes } = req.body;

    if (!nom || !declencheur) {
      return res.status(400).json({
        success: false,
        error: 'Le nom et le déclencheur sont requis'
      });
    }

    await client.query('BEGIN');

    // Create workflow
    const workflow = await client.query(`
      INSERT INTO hr_validation_workflows (
        name, description, trigger_type, segment_id, is_active, priority, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [
      nom,
      description,
      declencheur,
      segment_id || null,
      actif || false,
      priority || 0,
      req.user.id
    ]);

    const workflowId = workflow.rows[0].id;

    // Create steps if provided
    if (etapes && etapes.length > 0) {
      for (let i = 0; i < etapes.length; i++) {
        const step = etapes[i];
        await client.query(`
          INSERT INTO hr_validation_workflow_steps (
            workflow_id, step_order, approver_type, approver_id, approver_role, approver_name,
            condition_expression, timeout_hours, reminder_hours, allow_delegation
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          workflowId,
          i + 1,
          step.validateur_type || 'role',
          step.validateur_id,
          step.validateur_role,
          step.validateur_nom,
          step.condition,
          step.timeout_hours || 48,
          step.reminder_hours || 24,
          step.allow_delegation !== false
        ]);
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      workflow: {
        ...workflow.rows[0],
        nom: workflow.rows[0].name,
        declencheur: workflow.rows[0].trigger_type,
        actif: workflow.rows[0].is_active
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/hr/validation-workflows/:id
 * Update a workflow
 */
router.put('/:id', authenticateToken, requirePermission('hr.validation_workflows.edit'), async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { nom, description, declencheur, segment_id, actif, priority, etapes } = req.body;

    await client.query('BEGIN');

    // Update workflow
    const workflow = await client.query(`
      UPDATE hr_validation_workflows SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        trigger_type = COALESCE($3, trigger_type),
        segment_id = $4,
        is_active = COALESCE($5, is_active),
        priority = COALESCE($6, priority),
        updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `, [nom, description, declencheur, segment_id || null, actif, priority, id]);

    if (workflow.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Workflow non trouvé' });
    }

    // Update steps if provided
    if (etapes !== undefined) {
      // Delete existing steps
      await client.query('DELETE FROM hr_validation_workflow_steps WHERE workflow_id = $1', [id]);

      // Insert new steps
      for (let i = 0; i < etapes.length; i++) {
        const step = etapes[i];
        await client.query(`
          INSERT INTO hr_validation_workflow_steps (
            workflow_id, step_order, approver_type, approver_id, approver_role, approver_name,
            condition_expression, timeout_hours, reminder_hours, allow_delegation
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `, [
          id,
          i + 1,
          step.validateur_type || 'role',
          step.validateur_id,
          step.validateur_role,
          step.validateur_nom,
          step.condition,
          step.timeout_hours || 48,
          step.reminder_hours || 24,
          step.allow_delegation !== false
        ]);
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      workflow: {
        ...workflow.rows[0],
        nom: workflow.rows[0].name,
        declencheur: workflow.rows[0].trigger_type,
        actif: workflow.rows[0].is_active
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/hr/validation-workflows/:id/toggle
 * Toggle workflow active status
 */
router.put('/:id/toggle', authenticateToken, requirePermission('hr.validation_workflows.edit'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE hr_validation_workflows
      SET is_active = NOT is_active, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Workflow non trouvé' });
    }

    res.json({
      success: true,
      workflow: result.rows[0],
      message: result.rows[0].is_active ? 'Workflow activé' : 'Workflow désactivé'
    });
  } catch (error) {
    console.error('Error toggling workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/hr/validation-workflows/:id
 * Delete a workflow
 */
router.delete('/:id', authenticateToken, requirePermission('hr.validation_workflows.delete'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if workflow has active instances
    const activeInstances = await pool.query(`
      SELECT COUNT(*) FROM hr_validation_instances
      WHERE workflow_id = $1 AND status = 'pending'
    `, [id]);

    if (parseInt(activeInstances.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Ce workflow a des validations en cours et ne peut pas être supprimé'
      });
    }

    const result = await pool.query(
      'DELETE FROM hr_validation_workflows WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Workflow non trouvé' });
    }

    res.json({ success: true, message: 'Workflow supprimé' });
  } catch (error) {
    console.error('Error deleting workflow:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// WORKFLOW STEPS
// ============================================================

/**
 * POST /api/hr/validation-workflows/:id/steps
 * Add a step to workflow
 */
router.post('/:id/steps', authenticateToken, requirePermission('hr.validation_workflows.edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      validateur_type, validateur_id, validateur_role, validateur_nom,
      condition, timeout_hours, reminder_hours, allow_delegation
    } = req.body;

    // Get next step order
    const maxOrder = await pool.query(
      'SELECT COALESCE(MAX(step_order), 0) + 1 as next_order FROM hr_validation_workflow_steps WHERE workflow_id = $1',
      [id]
    );

    const result = await pool.query(`
      INSERT INTO hr_validation_workflow_steps (
        workflow_id, step_order, approver_type, approver_id, approver_role, approver_name,
        condition_expression, timeout_hours, reminder_hours, allow_delegation
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [
      id,
      maxOrder.rows[0].next_order,
      validateur_type || 'role',
      validateur_id,
      validateur_role,
      validateur_nom,
      condition,
      timeout_hours || 48,
      reminder_hours || 24,
      allow_delegation !== false
    ]);

    res.status(201).json({ success: true, step: result.rows[0] });
  } catch (error) {
    console.error('Error adding step:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/hr/validation-workflows/:workflowId/steps/:stepId
 * Update a step
 */
router.put('/:workflowId/steps/:stepId', authenticateToken, requirePermission('hr.validation_workflows.edit'), async (req, res) => {
  try {
    const { stepId } = req.params;
    const {
      validateur_type, validateur_id, validateur_role, validateur_nom,
      condition, timeout_hours, reminder_hours, allow_delegation
    } = req.body;

    const result = await pool.query(`
      UPDATE hr_validation_workflow_steps SET
        approver_type = COALESCE($1, approver_type),
        approver_id = $2,
        approver_role = $3,
        approver_name = COALESCE($4, approver_name),
        condition_expression = $5,
        timeout_hours = COALESCE($6, timeout_hours),
        reminder_hours = COALESCE($7, reminder_hours),
        allow_delegation = COALESCE($8, allow_delegation),
        updated_at = NOW()
      WHERE id = $9
      RETURNING *
    `, [
      validateur_type, validateur_id, validateur_role, validateur_nom,
      condition, timeout_hours, reminder_hours, allow_delegation, stepId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Étape non trouvée' });
    }

    res.json({ success: true, step: result.rows[0] });
  } catch (error) {
    console.error('Error updating step:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/hr/validation-workflows/:workflowId/steps/:stepId
 * Delete a step and reorder remaining
 */
router.delete('/:workflowId/steps/:stepId', authenticateToken, requirePermission('hr.validation_workflows.edit'), async (req, res) => {
  const client = await pool.connect();

  try {
    const { workflowId, stepId } = req.params;

    await client.query('BEGIN');

    // Get step order before deleting
    const step = await client.query(
      'SELECT step_order FROM hr_validation_workflow_steps WHERE id = $1',
      [stepId]
    );

    if (step.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Étape non trouvée' });
    }

    const deletedOrder = step.rows[0].step_order;

    // Delete the step
    await client.query('DELETE FROM hr_validation_workflow_steps WHERE id = $1', [stepId]);

    // Reorder remaining steps
    await client.query(`
      UPDATE hr_validation_workflow_steps
      SET step_order = step_order - 1
      WHERE workflow_id = $1 AND step_order > $2
    `, [workflowId, deletedOrder]);

    await client.query('COMMIT');

    res.json({ success: true, message: 'Étape supprimée' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting step:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/hr/validation-workflows/:workflowId/steps/:stepId/move
 * Move step up or down
 */
router.put('/:workflowId/steps/:stepId/move', authenticateToken, requirePermission('hr.validation_workflows.edit'), async (req, res) => {
  const client = await pool.connect();

  try {
    const { workflowId, stepId } = req.params;
    const { direction } = req.body; // 'up' or 'down'

    await client.query('BEGIN');

    // Get current step
    const current = await client.query(
      'SELECT step_order FROM hr_validation_workflow_steps WHERE id = $1',
      [stepId]
    );

    if (current.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Étape non trouvée' });
    }

    const currentOrder = current.rows[0].step_order;
    const newOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;

    if (newOrder < 1) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Déjà en première position' });
    }

    // Check if there's a step at new position
    const other = await client.query(
      'SELECT id FROM hr_validation_workflow_steps WHERE workflow_id = $1 AND step_order = $2',
      [workflowId, newOrder]
    );

    if (other.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'Déjà en dernière position' });
    }

    // Swap orders
    await client.query(
      'UPDATE hr_validation_workflow_steps SET step_order = $1 WHERE id = $2',
      [currentOrder, other.rows[0].id]
    );

    await client.query(
      'UPDATE hr_validation_workflow_steps SET step_order = $1 WHERE id = $2',
      [newOrder, stepId]
    );

    await client.query('COMMIT');

    res.json({ success: true, message: 'Étape déplacée' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error moving step:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// ============================================================
// STATS
// ============================================================

/**
 * GET /api/hr/validation-workflows/stats
 * Get workflow statistics
 */
router.get('/stats/summary', authenticateToken, requirePermission('hr.validation_workflows.view_page'), async (req, res) => {
  try {
    const [total, active, triggers, instances] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM hr_validation_workflows'),
      pool.query('SELECT COUNT(*) as count FROM hr_validation_workflows WHERE is_active = true'),
      pool.query('SELECT COUNT(DISTINCT trigger_type) as count FROM hr_validation_workflows'),
      pool.query(`SELECT COUNT(*) as count FROM hr_validation_instances WHERE status = 'pending'`)
    ]);

    res.json({
      success: true,
      stats: {
        total: parseInt(total.rows[0].count),
        active: parseInt(active.rows[0].count),
        inactive: parseInt(total.rows[0].count) - parseInt(active.rows[0].count),
        trigger_types: parseInt(triggers.rows[0].count),
        pending_instances: parseInt(instances.rows[0].count)
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
