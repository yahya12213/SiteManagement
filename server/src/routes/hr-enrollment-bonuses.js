/**
 * API Routes pour les primes d'inscription
 *
 * Endpoints:
 * - GET /rates - Liste des taux par formation
 * - PUT /rates/:type - Modifier un taux
 * - GET / - Liste des primes
 * - POST / - Créer une prime
 * - PUT /:id/validate - Valider une prime
 * - PUT /:id/cancel - Annuler une prime
 * - DELETE /:id - Supprimer une prime
 */

import express from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import pool from '../config/database.js';

const router = express.Router();

// ===============================
// CONFIGURATION DES TAUX
// ===============================

/**
 * Liste des taux de primes par formation
 */
router.get('/rates',
  authenticateToken,
  requirePermission('hr.enrollment_bonuses.view'),
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT * FROM hr_enrollment_bonus_rates
        ORDER BY bonus_amount DESC
      `);

      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Error fetching bonus rates:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Modifier un taux de prime
 */
router.put('/rates/:type',
  authenticateToken,
  requirePermission('hr.enrollment_bonuses.config'),
  async (req, res) => {
    const { type } = req.params;
    const { bonus_amount, is_active, description } = req.body;

    try {
      const result = await pool.query(`
        UPDATE hr_enrollment_bonus_rates
        SET bonus_amount = COALESCE($1, bonus_amount),
            is_active = COALESCE($2, is_active),
            description = COALESCE($3, description),
            updated_at = NOW()
        WHERE formation_type = $4
        RETURNING *
      `, [bonus_amount, is_active, description, type]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Type de formation non trouvé' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Error updating bonus rate:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Ajouter un nouveau type de formation
 */
router.post('/rates',
  authenticateToken,
  requirePermission('hr.enrollment_bonuses.config'),
  async (req, res) => {
    const { formation_type, formation_label, bonus_amount, description } = req.body;

    try {
      const result = await pool.query(`
        INSERT INTO hr_enrollment_bonus_rates (formation_type, formation_label, bonus_amount, description)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [formation_type, formation_label, bonus_amount || 0, description]);

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      if (error.code === '23505') {
        return res.status(400).json({ success: false, error: 'Ce type de formation existe déjà' });
      }
      console.error('Error creating bonus rate:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ===============================
// PRIMES D'INSCRIPTION
// ===============================

/**
 * Liste des primes d'inscription
 */
router.get('/',
  authenticateToken,
  requirePermission('hr.enrollment_bonuses.view'),
  async (req, res) => {
    const { employee_id, status, period_id, from_date, to_date } = req.query;

    try {
      let query = `
        SELECT
          b.*,
          e.first_name || ' ' || e.last_name as employee_name,
          e.employee_number,
          e.department,
          p.name as period_name,
          pr.first_name || ' ' || pr.last_name as validated_by_name,
          cr.first_name || ' ' || cr.last_name as created_by_name
        FROM hr_enrollment_bonuses b
        JOIN hr_employees e ON e.id = b.employee_id
        LEFT JOIN hr_payroll_periods p ON p.id = b.payroll_period_id
        LEFT JOIN profiles pr ON pr.id = b.validated_by
        LEFT JOIN profiles cr ON cr.id = b.created_by
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 1;

      if (employee_id) {
        query += ` AND b.employee_id = $${paramCount}`;
        params.push(employee_id);
        paramCount++;
      }

      if (status) {
        query += ` AND b.status = $${paramCount}`;
        params.push(status);
        paramCount++;
      }

      if (period_id) {
        query += ` AND b.payroll_period_id = $${paramCount}`;
        params.push(period_id);
        paramCount++;
      }

      if (from_date) {
        query += ` AND b.enrollment_date >= $${paramCount}`;
        params.push(from_date);
        paramCount++;
      }

      if (to_date) {
        query += ` AND b.enrollment_date <= $${paramCount}`;
        params.push(to_date);
        paramCount++;
      }

      query += ' ORDER BY b.created_at DESC';

      const result = await pool.query(query, params);

      // Calculer les totaux
      const totals = result.rows.reduce((acc, row) => {
        acc.total += parseFloat(row.bonus_amount) || 0;
        acc.count++;
        if (row.status === 'pending') acc.pending++;
        if (row.status === 'validated') acc.validated++;
        if (row.status === 'paid') acc.paid++;
        return acc;
      }, { total: 0, count: 0, pending: 0, validated: 0, paid: 0 });

      res.json({
        success: true,
        data: result.rows,
        totals
      });
    } catch (error) {
      console.error('Error fetching enrollment bonuses:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Détails d'une prime
 */
router.get('/:id',
  authenticateToken,
  requirePermission('hr.enrollment_bonuses.view'),
  async (req, res) => {
    const { id } = req.params;

    try {
      const result = await pool.query(`
        SELECT
          b.*,
          e.first_name || ' ' || e.last_name as employee_name,
          e.employee_number,
          e.department,
          p.name as period_name,
          pr.first_name || ' ' || pr.last_name as validated_by_name,
          cr.first_name || ' ' || cr.last_name as created_by_name
        FROM hr_enrollment_bonuses b
        JOIN hr_employees e ON e.id = b.employee_id
        LEFT JOIN hr_payroll_periods p ON p.id = b.payroll_period_id
        LEFT JOIN profiles pr ON pr.id = b.validated_by
        LEFT JOIN profiles cr ON cr.id = b.created_by
        WHERE b.id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Prime non trouvée' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Error fetching enrollment bonus:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Créer une prime d'inscription
 */
router.post('/',
  authenticateToken,
  requirePermission('hr.enrollment_bonuses.create'),
  async (req, res) => {
    const {
      employee_id,
      enrollment_id,
      student_name,
      student_cin,
      formation_type,
      formation_name,
      academic_year,
      enrollment_date,
      notes
    } = req.body;
    const userId = req.user.id;

    try {
      // Récupérer le montant de la prime selon le type de formation
      const rateResult = await pool.query(`
        SELECT bonus_amount FROM hr_enrollment_bonus_rates
        WHERE formation_type = $1 AND is_active = true
      `, [formation_type]);

      if (rateResult.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: `Type de formation "${formation_type}" non trouvé ou inactif`
        });
      }

      const bonus_amount = rateResult.rows[0].bonus_amount;

      // Créer la prime
      const result = await pool.query(`
        INSERT INTO hr_enrollment_bonuses (
          employee_id, enrollment_id, student_name, student_cin,
          formation_type, formation_name, academic_year,
          bonus_amount, enrollment_date, notes, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `, [
        employee_id, enrollment_id, student_name, student_cin,
        formation_type, formation_name, academic_year,
        bonus_amount, enrollment_date, notes, userId
      ]);

      // Récupérer les infos de l'employé
      const empResult = await pool.query(`
        SELECT first_name || ' ' || last_name as employee_name
        FROM hr_employees WHERE id = $1
      `, [employee_id]);

      res.json({
        success: true,
        data: {
          ...result.rows[0],
          employee_name: empResult.rows[0]?.employee_name
        }
      });
    } catch (error) {
      console.error('Error creating enrollment bonus:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Valider une prime
 */
router.put('/:id/validate',
  authenticateToken,
  requirePermission('hr.enrollment_bonuses.validate'),
  async (req, res) => {
    const { id } = req.params;
    const { payroll_period_id } = req.body;
    const userId = req.user.id;

    try {
      const result = await pool.query(`
        UPDATE hr_enrollment_bonuses
        SET status = 'validated',
            validated_by = $1,
            validated_at = NOW(),
            payroll_period_id = $2
        WHERE id = $3 AND status = 'pending'
        RETURNING *
      `, [userId, payroll_period_id, id]);

      if (result.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Prime non trouvée ou déjà validée'
        });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Error validating enrollment bonus:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Valider plusieurs primes en lot
 */
router.post('/validate-batch',
  authenticateToken,
  requirePermission('hr.enrollment_bonuses.validate'),
  async (req, res) => {
    const { bonus_ids, payroll_period_id } = req.body;
    const userId = req.user.id;

    if (!bonus_ids || !Array.isArray(bonus_ids) || bonus_ids.length === 0) {
      return res.status(400).json({ success: false, error: 'Liste de primes requise' });
    }

    try {
      const result = await pool.query(`
        UPDATE hr_enrollment_bonuses
        SET status = 'validated',
            validated_by = $1,
            validated_at = NOW(),
            payroll_period_id = $2
        WHERE id = ANY($3) AND status = 'pending'
        RETURNING id
      `, [userId, payroll_period_id, bonus_ids]);

      res.json({
        success: true,
        validated_count: result.rowCount,
        message: `${result.rowCount} prime(s) validée(s)`
      });
    } catch (error) {
      console.error('Error batch validating bonuses:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Annuler une prime
 */
router.put('/:id/cancel',
  authenticateToken,
  requirePermission('hr.enrollment_bonuses.validate'),
  async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;

    try {
      const result = await pool.query(`
        UPDATE hr_enrollment_bonuses
        SET status = 'cancelled',
            notes = COALESCE(notes, '') || ' | Annulée: ' || $1
        WHERE id = $2 AND status IN ('pending', 'validated')
        RETURNING *
      `, [reason || 'Aucune raison spécifiée', id]);

      if (result.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Prime non trouvée ou déjà payée/annulée'
        });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Error cancelling enrollment bonus:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Supprimer une prime (uniquement si pending)
 */
router.delete('/:id',
  authenticateToken,
  requirePermission('hr.enrollment_bonuses.create'),
  async (req, res) => {
    const { id } = req.params;

    try {
      const result = await pool.query(`
        DELETE FROM hr_enrollment_bonuses
        WHERE id = $1 AND status = 'pending'
        RETURNING id
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Prime non trouvée ou ne peut pas être supprimée (déjà validée)'
        });
      }

      res.json({ success: true, message: 'Prime supprimée' });
    } catch (error) {
      console.error('Error deleting enrollment bonus:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Statistiques des primes par employé
 */
router.get('/stats/by-employee',
  authenticateToken,
  requirePermission('hr.enrollment_bonuses.view'),
  async (req, res) => {
    const { from_date, to_date } = req.query;

    try {
      let query = `
        SELECT
          e.id as employee_id,
          e.first_name || ' ' || e.last_name as employee_name,
          e.employee_number,
          e.department,
          COUNT(b.id) as total_bonuses,
          COALESCE(SUM(b.bonus_amount), 0) as total_amount,
          COUNT(*) FILTER (WHERE b.status = 'pending') as pending,
          COUNT(*) FILTER (WHERE b.status = 'validated') as validated,
          COUNT(*) FILTER (WHERE b.status = 'paid') as paid
        FROM hr_employees e
        LEFT JOIN hr_enrollment_bonuses b ON b.employee_id = e.id
      `;
      const params = [];
      let paramCount = 1;

      if (from_date || to_date) {
        query += ` AND b.enrollment_date IS NOT NULL`;
        if (from_date) {
          query += ` AND b.enrollment_date >= $${paramCount}`;
          params.push(from_date);
          paramCount++;
        }
        if (to_date) {
          query += ` AND b.enrollment_date <= $${paramCount}`;
          params.push(to_date);
          paramCount++;
        }
      }

      query += `
        WHERE e.employment_status = 'active'
        GROUP BY e.id, e.first_name, e.last_name, e.employee_number, e.department
        HAVING COUNT(b.id) > 0
        ORDER BY total_amount DESC
      `;

      const result = await pool.query(query, params);

      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Error fetching bonus stats:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

export default router;
