/**
 * Routes API pour la Gestion de Projet
 * - Projects: CRUD pour les projets
 * - Actions: CRUD pour les actions du plan d'action
 */

import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { nanoid } from 'nanoid';
import { validateProjectForeignKeys } from '../utils/fk-validator.js';

const router = express.Router();

// ============================================
// PROJECTS ROUTES
// ============================================

// GET all projects
router.get('/', authenticateToken, requirePermission('accounting.projects.view_page'), async (req, res) => {
  try {
    const { status, priority, manager_id, search } = req.query;

    let query = `
      SELECT
        p.*,
        pr.full_name as manager_name,
        s.name as segment_name,
        c.name as city_name,
        cr.full_name as created_by_name,
        (SELECT COUNT(*) FROM project_actions pa WHERE pa.project_id = p.id) as total_actions,
        (SELECT COUNT(*) FROM project_actions pa WHERE pa.project_id = p.id AND pa.status = 'termine') as completed_actions
      FROM projects p
      LEFT JOIN profiles pr ON p.manager_id = pr.id
      LEFT JOIN segments s ON p.segment_id = s.id
      LEFT JOIN cities c ON p.city_id = c.id
      LEFT JOIN profiles cr ON p.created_by = cr.id
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      params.push(status);
      query += ` AND p.status = $${params.length}`;
    }

    if (priority) {
      params.push(priority);
      query += ` AND p.priority = $${params.length}`;
    }

    if (manager_id) {
      params.push(manager_id);
      query += ` AND p.manager_id = $${params.length}`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (p.name ILIKE $${params.length} OR p.description ILIKE $${params.length})`;
    }

    query += ' ORDER BY p.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET single project by ID
router.get('/:id', authenticateToken, requirePermission('accounting.projects.view_page'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        p.*,
        pr.full_name as manager_name,
        s.name as segment_name,
        c.name as city_name,
        cr.full_name as created_by_name
      FROM projects p
      LEFT JOIN profiles pr ON p.manager_id = pr.id
      LEFT JOIN segments s ON p.segment_id = s.id
      LEFT JOIN cities c ON p.city_id = c.id
      LEFT JOIN profiles cr ON p.created_by = cr.id
      WHERE p.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to convert empty strings to null for FK fields
const emptyToNull = (value) => (value === '' || value === undefined) ? null : value;

// POST create project
router.post('/', authenticateToken, requirePermission('accounting.projects.create'), async (req, res) => {
  try {
    const { name, description, status, priority, start_date, end_date, budget, color } = req.body;
    // Convert empty strings to null for FK fields
    const manager_id = emptyToNull(req.body.manager_id);
    const segment_id = emptyToNull(req.body.segment_id);
    const city_id = emptyToNull(req.body.city_id);
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({ error: 'Le nom du projet est obligatoire' });
    }

    // Validate color format if provided
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return res.status(400).json({ error: 'Format couleur invalide (doit être #RRGGBB)' });
    }

    // Validate foreign keys before INSERT
    const fkValidation = await validateProjectForeignKeys({ manager_id, segment_id, city_id });
    if (!fkValidation.valid) {
      return res.status(400).json({
        error: 'Validation des références échouée',
        details: fkValidation.errors
      });
    }

    const id = `proj-${nanoid(10)}`;

    const result = await pool.query(`
      INSERT INTO projects (id, name, description, status, priority, start_date, end_date, budget, manager_id, segment_id, city_id, color, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `, [id, name, description, status || 'planning', priority || 'normale', emptyToNull(start_date), emptyToNull(end_date), emptyToNull(budget), manager_id, segment_id, city_id, color || '#3b82f6', userId]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating project:', error);

    // Handle FK constraint violation as fallback
    if (error.code === '23503') {
      return res.status(400).json({
        error: 'Référence invalide',
        details: ['Une ou plusieurs références sont invalides']
      });
    }

    res.status(500).json({ error: error.message });
  }
});

// PUT update project
router.put('/:id', authenticateToken, requirePermission('accounting.projects.update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, status, priority, start_date, end_date, budget, color } = req.body;
    // Convert empty strings to null for FK fields
    const manager_id = emptyToNull(req.body.manager_id);
    const segment_id = emptyToNull(req.body.segment_id);
    const city_id = emptyToNull(req.body.city_id);

    // Validate color format if provided
    if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
      return res.status(400).json({ error: 'Format couleur invalide (doit être #RRGGBB)' });
    }

    // Only validate FK fields that are being updated (not undefined)
    const fkFields = {};
    if (req.body.manager_id !== undefined) fkFields.manager_id = manager_id;
    if (req.body.segment_id !== undefined) fkFields.segment_id = segment_id;
    if (req.body.city_id !== undefined) fkFields.city_id = city_id;

    // Validate foreign keys if any FK field is being updated
    if (Object.keys(fkFields).length > 0) {
      const fkValidation = await validateProjectForeignKeys(fkFields);
      if (!fkValidation.valid) {
        return res.status(400).json({
          error: 'Validation des références échouée',
          details: fkValidation.errors
        });
      }
    }

    const result = await pool.query(`
      UPDATE projects
      SET name = COALESCE($1, name),
          description = COALESCE($2, description),
          status = COALESCE($3, status),
          priority = COALESCE($4, priority),
          start_date = COALESCE($5, start_date),
          end_date = COALESCE($6, end_date),
          budget = COALESCE($7, budget),
          manager_id = COALESCE($8, manager_id),
          segment_id = COALESCE($9, segment_id),
          city_id = COALESCE($10, city_id),
          color = COALESCE($11, color),
          updated_at = NOW()
      WHERE id = $12
      RETURNING *
    `, [name, description, status, priority, emptyToNull(start_date), emptyToNull(end_date), emptyToNull(budget), manager_id, segment_id, city_id, color, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating project:', error);

    // Handle FK constraint violation as fallback
    if (error.code === '23503') {
      return res.status(400).json({
        error: 'Référence invalide',
        details: ['Une ou plusieurs références sont invalides']
      });
    }

    res.status(500).json({ error: error.message });
  }
});

// DELETE project
router.delete('/:id', authenticateToken, requirePermission('accounting.projects.delete'), async (req, res) => {
  try {
    const { id } = req.params;

    // First unlink all actions from this project
    await pool.query('UPDATE project_actions SET project_id = NULL WHERE project_id = $1', [id]);

    const result = await pool.query('DELETE FROM projects WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Projet non trouvé' });
    }

    res.json({ message: 'Projet supprimé avec succès', project: result.rows[0] });
  } catch (error) {
    console.error('Error deleting project:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// ACTIONS ROUTES
// ============================================

// GET all actions
router.get('/actions/list', authenticateToken, requirePermission('accounting.actions.view_page'), async (req, res) => {
  try {
    const { status, pilote_id, project_id, overdue, search } = req.query;

    let query = `
      SELECT
        a.*,
        p.full_name as pilote_name,
        ab.full_name as assigned_by_name,
        pr.name as project_name,
        s.name as segment_name,
        c.name as city_name
      FROM project_actions a
      LEFT JOIN profiles p ON a.pilote_id = p.id
      LEFT JOIN profiles ab ON a.assigned_by = ab.id
      LEFT JOIN projects pr ON a.project_id = pr.id
      LEFT JOIN segments s ON a.segment_id = s.id
      LEFT JOIN cities c ON a.city_id = c.id
      WHERE 1=1
    `;

    const params = [];

    if (status) {
      params.push(status);
      query += ` AND a.status = $${params.length}`;
    }

    if (pilote_id) {
      params.push(pilote_id);
      query += ` AND a.pilote_id = $${params.length}`;
    }

    if (project_id) {
      params.push(project_id);
      query += ` AND a.project_id = $${params.length}`;
    }

    if (overdue === 'true') {
      query += ` AND a.deadline < CURRENT_DATE AND a.status != 'termine'`;
    }

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (a.description ILIKE $${params.length} OR a.description_detail ILIKE $${params.length})`;
    }

    query += ' ORDER BY a.deadline ASC NULLS LAST, a.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching actions:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET actions stats for dashboard
router.get('/actions/stats', authenticateToken, requirePermission('accounting.actions.view_page'), async (req, res) => {
  try {
    const statsResult = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'termine') as completed,
        COUNT(*) FILTER (WHERE status = 'en_cours') as in_progress,
        COUNT(*) FILTER (WHERE status = 'a_faire') as todo,
        COUNT(*) FILTER (WHERE deadline < CURRENT_DATE AND status != 'termine') as overdue,
        COUNT(*) FILTER (WHERE deadline BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '3 days' AND status != 'termine') as due_soon
      FROM project_actions
    `);

    // Top pilotes
    const pilotesResult = await pool.query(`
      SELECT
        p.id,
        p.full_name,
        COUNT(*) FILTER (WHERE a.status != 'termine') as pending_actions,
        COUNT(*) FILTER (WHERE a.status = 'termine') as completed_actions
      FROM project_actions a
      JOIN profiles p ON a.pilote_id = p.id
      GROUP BY p.id, p.full_name
      ORDER BY pending_actions DESC
      LIMIT 5
    `);

    res.json({
      ...statsResult.rows[0],
      top_pilotes: pilotesResult.rows
    });
  } catch (error) {
    console.error('Error fetching action stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET single action
router.get('/actions/:id', authenticateToken, requirePermission('accounting.actions.view_page'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        a.*,
        p.full_name as pilote_name,
        ab.full_name as assigned_by_name,
        pr.name as project_name
      FROM project_actions a
      LEFT JOIN profiles p ON a.pilote_id = p.id
      LEFT JOIN profiles ab ON a.assigned_by = ab.id
      LEFT JOIN projects pr ON a.project_id = pr.id
      WHERE a.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Action non trouvée' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching action:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST create action
router.post('/actions', authenticateToken, requirePermission('accounting.actions.create'), async (req, res) => {
  try {
    const { description, description_detail, pilote_id, deadline, commentaire, project_id, segment_id, city_id } = req.body;
    const userId = req.user.id;

    if (!description) {
      return res.status(400).json({ error: 'La description de l\'action est obligatoire' });
    }

    if (!pilote_id) {
      return res.status(400).json({ error: 'Le pilote (responsable) est obligatoire' });
    }

    const id = `action-${nanoid(10)}`;

    const result = await pool.query(`
      INSERT INTO project_actions (id, description, description_detail, pilote_id, assigned_by, deadline, commentaire, project_id, segment_id, city_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [id, description, description_detail, pilote_id, userId, deadline, commentaire, project_id, segment_id, city_id]);

    // Fetch the complete action with joins
    const completeResult = await pool.query(`
      SELECT
        a.*,
        p.full_name as pilote_name,
        ab.full_name as assigned_by_name,
        pr.name as project_name
      FROM project_actions a
      LEFT JOIN profiles p ON a.pilote_id = p.id
      LEFT JOIN profiles ab ON a.assigned_by = ab.id
      LEFT JOIN projects pr ON a.project_id = pr.id
      WHERE a.id = $1
    `, [id]);

    res.status(201).json(completeResult.rows[0]);
  } catch (error) {
    console.error('Error creating action:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT update action
router.put('/actions/:id', authenticateToken, requirePermission('accounting.actions.update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { description, description_detail, pilote_id, deadline, status, commentaire, project_id } = req.body;
    const userId = req.user.id;

    // Check if user can edit this action (pilote or assigned_by)
    const actionCheck = await pool.query(
      'SELECT pilote_id, assigned_by FROM project_actions WHERE id = $1',
      [id]
    );

    if (actionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Action non trouvée' });
    }

    const action = actionCheck.rows[0];
    // Allow edit if user is pilote, assigned_by, or has admin permission
    // For now, we'll allow any user with update permission to edit

    const result = await pool.query(`
      UPDATE project_actions
      SET description = COALESCE($1, description),
          description_detail = COALESCE($2, description_detail),
          pilote_id = COALESCE($3, pilote_id),
          deadline = COALESCE($4, deadline),
          status = COALESCE($5, status),
          commentaire = COALESCE($6, commentaire),
          project_id = $7,
          updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `, [description, description_detail, pilote_id, deadline, status, commentaire, project_id, id]);

    // Fetch the complete action with joins
    const completeResult = await pool.query(`
      SELECT
        a.*,
        p.full_name as pilote_name,
        ab.full_name as assigned_by_name,
        pr.name as project_name
      FROM project_actions a
      LEFT JOIN profiles p ON a.pilote_id = p.id
      LEFT JOIN profiles ab ON a.assigned_by = ab.id
      LEFT JOIN projects pr ON a.project_id = pr.id
      WHERE a.id = $1
    `, [id]);

    res.json(completeResult.rows[0]);
  } catch (error) {
    console.error('Error updating action:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE action
router.delete('/actions/:id', authenticateToken, requirePermission('accounting.actions.delete'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM project_actions WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Action non trouvée' });
    }

    res.json({ message: 'Action supprimée avec succès', action: result.rows[0] });
  } catch (error) {
    console.error('Error deleting action:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST link actions to project
router.post('/:id/link-actions', authenticateToken, requirePermission('accounting.projects.update'), async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { action_ids } = req.body;

    if (!action_ids || !Array.isArray(action_ids)) {
      return res.status(400).json({ error: 'action_ids doit être un tableau' });
    }

    // First, unlink all actions from this project
    await pool.query('UPDATE project_actions SET project_id = NULL WHERE project_id = $1', [projectId]);

    // Then link the specified actions
    if (action_ids.length > 0) {
      await pool.query(`
        UPDATE project_actions
        SET project_id = $1, updated_at = NOW()
        WHERE id = ANY($2)
      `, [projectId, action_ids]);
    }

    // Return updated project with actions
    const projectResult = await pool.query(`
      SELECT
        p.*,
        pr.full_name as manager_name,
        (SELECT COUNT(*) FROM project_actions pa WHERE pa.project_id = p.id) as total_actions,
        (SELECT COUNT(*) FROM project_actions pa WHERE pa.project_id = p.id AND pa.status = 'termine') as completed_actions
      FROM projects p
      LEFT JOIN profiles pr ON p.manager_id = pr.id
      WHERE p.id = $1
    `, [projectId]);

    res.json(projectResult.rows[0]);
  } catch (error) {
    console.error('Error linking actions:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET project's actions
router.get('/:id/actions', authenticateToken, requirePermission('accounting.projects.view_page'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`
      SELECT
        a.*,
        p.full_name as pilote_name,
        ab.full_name as assigned_by_name
      FROM project_actions a
      LEFT JOIN profiles p ON a.pilote_id = p.id
      LEFT JOIN profiles ab ON a.assigned_by = ab.id
      WHERE a.project_id = $1
      ORDER BY a.deadline ASC NULLS LAST
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching project actions:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
