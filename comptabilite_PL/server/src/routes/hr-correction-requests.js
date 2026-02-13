/**
 * Routes pour les demandes de correction de pointage
 *
 * Permet aux employés de soumettre des demandes de correction pour les pointages incomplets
 * Utilise la chaîne d'approbation multi-niveaux (N → N+1 → N+2...)
 */

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
 * Récupère la chaîne d'approbation d'un employé depuis hr_employee_managers
 */
async function getApprovalChain(pool, employeeId) {
  const result = await pool.query(`
    SELECT
      em.rank,
      em.manager_id,
      m.first_name || ' ' || m.last_name as manager_name,
      me.profile_id as manager_profile_id
    FROM hr_employee_managers em
    JOIN hr_employees m ON em.manager_id = m.id
    LEFT JOIN hr_employees me ON me.id = em.manager_id
    WHERE em.employee_id = $1 AND em.is_active = true
    ORDER BY em.rank ASC
  `, [employeeId]);

  return result.rows;
}

/**
 * Détermine le niveau d'approbation actuel basé sur le status
 */
function getCurrentApprovalLevel(status) {
  if (status === 'pending') return 0;
  if (status === 'approved_n1') return 1;
  if (status === 'approved_n2') return 2;
  const match = status?.match(/approved_n(\d+)/);
  if (match) return parseInt(match[1]);
  return 0;
}

// POST /api/hr/my/correction-requests - Soumettre une demande de correction
router.post('/my/correction-requests', authenticateToken, async (req, res) => {
  const pool = getPool();

  try {
    const userId = req.user.id;
    const { request_date, requested_check_in, requested_check_out, reason } = req.body;

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

    // Trouver l'employé HR correspondant à l'utilisateur
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

    // Vérifier si une demande existe déjà pour cette date
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

    // Créer la demande
    const result = await pool.query(`
      INSERT INTO hr_attendance_correction_requests
        (employee_id, request_date, requested_check_in, requested_check_out, reason, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *
    `, [employeeId, request_date, requested_check_in || null, requested_check_out || null, reason]);

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
  } finally {
    await pool.end();
  }
});

// GET /api/hr/my/correction-requests - Mes demandes de correction
router.get('/my/correction-requests', authenticateToken, async (req, res) => {
  const pool = getPool();

  try {
    const userId = req.user.id;

    // Trouver l'employé HR correspondant
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
  } finally {
    await pool.end();
  }
});

// GET /api/hr/manager/correction-requests - Demandes à approuver (manager)
router.get('/manager/correction-requests', authenticateToken, requirePermission('hr.leaves.approve'), async (req, res) => {
  const pool = getPool();

  try {
    const userId = req.user.id;

    // Trouver l'employé HR correspondant
    const currentEmployeeResult = await pool.query(`
      SELECT id FROM hr_employees WHERE profile_id = $1
    `, [userId]);

    const currentEmployeeId = currentEmployeeResult.rows[0]?.id;

    // Récupérer toutes les demandes en attente
    const result = await pool.query(`
      SELECT
        cr.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.department as employee_department,
        n1.first_name || ' ' || n1.last_name as n1_approver_name,
        n2.first_name || ' ' || n2.last_name as n2_approver_name
      FROM hr_attendance_correction_requests cr
      JOIN hr_employees e ON cr.employee_id = e.id
      LEFT JOIN hr_employees n1 ON cr.n1_approver_id = n1.id
      LEFT JOIN hr_employees n2 ON cr.n2_approver_id = n2.id
      WHERE cr.status IN ('pending', 'approved_n1', 'approved_n2', 'approved_n3', 'approved_n4', 'approved_n5')
      ORDER BY cr.created_at DESC
    `);

    // Filtrer les demandes où l'utilisateur connecté est le prochain approbateur
    const filteredRequests = [];
    for (const request of result.rows) {
      const approvalChain = await getApprovalChain(pool, request.employee_id);
      const currentLevel = getCurrentApprovalLevel(request.status);
      const currentApprover = approvalChain.find(m => m.rank === currentLevel);

      const isNextApprover = currentApprover && currentApprover.manager_id === currentEmployeeId;

      // Calculer l'étape actuelle et totale
      const etapeActuelle = currentLevel + 1;
      const etapeTotale = approvalChain.length;

      if (isNextApprover || !currentEmployeeId) {
        filteredRequests.push({
          ...request,
          etape_actuelle: etapeActuelle,
          etape_totale: etapeTotale,
          approval_chain: approvalChain,
          next_approver_name: currentApprover?.manager_name || null,
          is_next_approver: isNextApprover
        });
      }
    }

    res.json({
      success: true,
      requests: filteredRequests,
      count: filteredRequests.length
    });

  } catch (error) {
    console.error('Error fetching manager correction requests:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des demandes',
      details: error.message
    });
  } finally {
    await pool.end();
  }
});

// PUT /api/hr/manager/correction-requests/:id/approve - Approuver une demande
router.put('/manager/correction-requests/:id/approve', authenticateToken, requirePermission('hr.leaves.approve'), async (req, res) => {
  const pool = getPool();

  try {
    const { id } = req.params;
    const { comment } = req.body;
    const userId = req.user.id;

    // Récupérer la demande - TO_CHAR garantit le format YYYY-MM-DD
    const requestResult = await pool.query(`
      SELECT
        cr.*,
        TO_CHAR(cr.request_date, 'YYYY-MM-DD') as request_date_iso,
        e.id as employee_id
      FROM hr_attendance_correction_requests cr
      JOIN hr_employees e ON cr.employee_id = e.id
      WHERE cr.id = $1
    `, [id]);

    if (requestResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Demande non trouvée' });
    }

    const request = requestResult.rows[0];
    const currentLevel = getCurrentApprovalLevel(request.status);

    // Récupérer la chaîne d'approbation
    const approvalChain = await getApprovalChain(pool, request.employee_id);

    // Vérifier s'il y a un niveau suivant
    const nextLevel = currentLevel + 1;
    const hasNextApprover = approvalChain.some(m => m.rank === nextLevel);

    let newStatus;
    let updateQuery;

    if (hasNextApprover) {
      // Passer au niveau suivant
      newStatus = `approved_n${nextLevel}`;

      if (currentLevel === 0) {
        updateQuery = `
          UPDATE hr_attendance_correction_requests
          SET status = $2, n1_approver_id = $3, n1_approved_at = NOW(), n1_comment = $4, updated_at = NOW()
          WHERE id = $1
        `;
      } else if (currentLevel === 1) {
        updateQuery = `
          UPDATE hr_attendance_correction_requests
          SET status = $2, n2_approver_id = $3, n2_approved_at = NOW(), n2_comment = $4, updated_at = NOW()
          WHERE id = $1
        `;
      } else {
        updateQuery = `
          UPDATE hr_attendance_correction_requests
          SET status = $2, n3_approver_id = $3, n3_approved_at = NOW(), n3_comment = $4, updated_at = NOW()
          WHERE id = $1
        `;
      }

      // Récupérer l'employé approuveur
      const approverResult = await pool.query(`
        SELECT id FROM hr_employees WHERE profile_id = $1
      `, [userId]);
      const approverId = approverResult.rows[0]?.id;

      await pool.query(updateQuery, [id, newStatus, approverId, comment || '']);

      res.json({
        success: true,
        message: `Demande approuvée. En attente de validation niveau N+${nextLevel}`,
        next_level: nextLevel,
        is_final: false
      });

    } else {
      // Approbation finale - créer/modifier les enregistrements de pointage
      newStatus = 'approved';

      // Récupérer l'employé approuveur
      const approverResult = await pool.query(`
        SELECT id FROM hr_employees WHERE profile_id = $1
      `, [userId]);
      const approverId = approverResult.rows[0]?.id;

      if (currentLevel === 0) {
        await pool.query(`
          UPDATE hr_attendance_correction_requests
          SET status = 'approved', n1_approver_id = $2, n1_approved_at = NOW(), n1_comment = $3, updated_at = NOW()
          WHERE id = $1
        `, [id, approverId, comment || '']);
      } else if (currentLevel === 1) {
        await pool.query(`
          UPDATE hr_attendance_correction_requests
          SET status = 'approved', n2_approver_id = $2, n2_approved_at = NOW(), n2_comment = $3, updated_at = NOW()
          WHERE id = $1
        `, [id, approverId, comment || '']);
      } else {
        await pool.query(`
          UPDATE hr_attendance_correction_requests
          SET status = 'approved', n3_approver_id = $2, n3_approved_at = NOW(), n3_comment = $3, updated_at = NOW()
          WHERE id = $1
        `, [id, approverId, comment || '']);
      }

      // Créer/mettre à jour les enregistrements de pointage corrigés (unified hr_attendance_daily)
      const { employee_id, request_date_iso, requested_check_in, requested_check_out } = request;

      // La date est déjà au format YYYY-MM-DD grâce à TO_CHAR dans SQL
      const formattedDate = request_date_iso;

      // Normaliser l'heure en HH:MM:SS (éviter HH:MM:SS:SS si secondes déjà présentes)
      const normalizeTime = (time) => {
        if (!time) return null;
        const timeStr = String(time);
        // Si format HH:MM, ajouter :00
        if (/^\d{2}:\d{2}$/.test(timeStr)) {
          return timeStr + ':00';
        }
        // Si format HH:MM:SS ou plus long, extraire HH:MM:SS
        const match = timeStr.match(/^(\d{2}:\d{2}:\d{2})/);
        return match ? match[1] : timeStr;
      };

      const checkInTime = normalizeTime(requested_check_in);
      const checkOutTime = normalizeTime(requested_check_out);

      // Build timestamps en format datetime (sans timezone explicite)
      const clockInAt = checkInTime ? `${formattedDate} ${checkInTime}` : null;
      const clockOutAt = checkOutTime ? `${formattedDate} ${checkOutTime}` : null;

      console.log(`[Correction Apply] Date: ${formattedDate}, ClockIn: ${clockInAt}, ClockOut: ${clockOutAt}`);

      // Upsert into hr_attendance_daily
      // Utiliser AT TIME ZONE pour interpréter l'heure en timezone locale Maroc
      // Note: $3::text::timestamp - le cast text résout le problème "could not determine data type"
      await pool.query(`
        INSERT INTO hr_attendance_daily (
          employee_id, work_date, clock_in_at, clock_out_at, day_status, source, notes, created_by, created_at
        )
        VALUES (
          $1, $2,
          ($3::text)::timestamp AT TIME ZONE 'Africa/Casablanca',
          ($4::text)::timestamp AT TIME ZONE 'Africa/Casablanca',
          'present', 'correction', 'Correction approuvée', $5, NOW()
        )
        ON CONFLICT (employee_id, work_date) DO UPDATE SET
          clock_in_at = COALESCE(
            ($3::text)::timestamp AT TIME ZONE 'Africa/Casablanca',
            hr_attendance_daily.clock_in_at
          ),
          clock_out_at = COALESCE(
            ($4::text)::timestamp AT TIME ZONE 'Africa/Casablanca',
            hr_attendance_daily.clock_out_at
          ),
          source = 'correction',
          notes = COALESCE(hr_attendance_daily.notes, '') || ' | Correction approuvée',
          updated_at = NOW()
      `, [employee_id, formattedDate, clockInAt, clockOutAt, approverId]);

      res.json({
        success: true,
        message: 'Demande approuvée définitivement. Les pointages ont été corrigés.',
        is_final: true
      });
    }

  } catch (error) {
    console.error('Error approving correction request:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'approbation',
      details: error.message
    });
  } finally {
    await pool.end();
  }
});

// PUT /api/hr/manager/correction-requests/:id/reject - Rejeter une demande
router.put('/manager/correction-requests/:id/reject', authenticateToken, requirePermission('hr.leaves.approve'), async (req, res) => {
  const pool = getPool();

  try {
    const { id } = req.params;
    const { comment } = req.body;
    const userId = req.user.id;

    if (!comment || !comment.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Un commentaire est obligatoire pour le rejet'
      });
    }

    // Récupérer l'employé approuveur
    const approverResult = await pool.query(`
      SELECT id FROM hr_employees WHERE profile_id = $1
    `, [userId]);
    const approverId = approverResult.rows[0]?.id;

    await pool.query(`
      UPDATE hr_attendance_correction_requests
      SET status = 'rejected', n1_approver_id = $2, n1_approved_at = NOW(), n1_comment = $3, updated_at = NOW()
      WHERE id = $1
    `, [id, approverId, comment]);

    res.json({
      success: true,
      message: 'Demande rejetée'
    });

  } catch (error) {
    console.error('Error rejecting correction request:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du rejet',
      details: error.message
    });
  } finally {
    await pool.end();
  }
});

// PUT /api/hr/manager/correction-requests/:id/reapply - Ré-appliquer une correction approuvée
// Utilisé si la correction a été approuvée mais pas appliquée à cause d'une erreur
router.put('/manager/correction-requests/:id/reapply', authenticateToken, requirePermission('hr.leaves.approve'), async (req, res) => {
  const pool = getPool();

  try {
    const { id } = req.params;

    // Récupérer la demande approuvée - TO_CHAR garantit le format YYYY-MM-DD
    const requestResult = await pool.query(`
      SELECT
        cr.*,
        TO_CHAR(cr.request_date, 'YYYY-MM-DD') as request_date_iso,
        e.id as employee_id
      FROM hr_attendance_correction_requests cr
      JOIN hr_employees e ON cr.employee_id = e.id
      WHERE cr.id = $1 AND cr.status = 'approved'
    `, [id]);

    if (requestResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Demande non trouvée ou non approuvée'
      });
    }

    const request = requestResult.rows[0];
    const { employee_id, request_date_iso, requested_check_in, requested_check_out } = request;

    // La date est déjà au format YYYY-MM-DD grâce à TO_CHAR dans SQL
    const formattedDate = request_date_iso;

    // Normaliser l'heure en HH:MM:SS (éviter HH:MM:SS:SS si secondes déjà présentes)
    const normalizeTime = (time) => {
      if (!time) return null;
      const timeStr = String(time);
      // Si format HH:MM, ajouter :00
      if (/^\d{2}:\d{2}$/.test(timeStr)) {
        return timeStr + ':00';
      }
      // Si format HH:MM:SS ou plus long, extraire HH:MM:SS
      const match = timeStr.match(/^(\d{2}:\d{2}:\d{2})/);
      return match ? match[1] : timeStr;
    };

    const checkInTime = normalizeTime(requested_check_in);
    const checkOutTime = normalizeTime(requested_check_out);

    const clockInAt = checkInTime ? `${formattedDate}T${checkInTime}+00:00` : null;
    const clockOutAt = checkOutTime ? `${formattedDate}T${checkOutTime}+00:00` : null;

    console.log(`[Reapply Correction] ID: ${id}, Date: ${formattedDate}, ClockIn: ${clockInAt}, ClockOut: ${clockOutAt}`);

    // Upsert into hr_attendance_daily
    await pool.query(`
      INSERT INTO hr_attendance_daily (
        employee_id, work_date, clock_in_at, clock_out_at, day_status, source, notes, created_at
      )
      VALUES ($1, $2, $3, $4, 'present', 'correction', 'Correction ré-appliquée', NOW())
      ON CONFLICT (employee_id, work_date) DO UPDATE SET
        clock_in_at = COALESCE($3, hr_attendance_daily.clock_in_at),
        clock_out_at = COALESCE($4, hr_attendance_daily.clock_out_at),
        source = 'correction',
        notes = COALESCE(hr_attendance_daily.notes, '') || ' | Correction ré-appliquée',
        updated_at = NOW()
    `, [employee_id, formattedDate, clockInAt, clockOutAt]);

    res.json({
      success: true,
      message: 'Correction ré-appliquée avec succès',
      applied: {
        date: formattedDate,
        check_in: requested_check_in,
        check_out: requested_check_out
      }
    });

  } catch (error) {
    console.error('Error reapplying correction:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la ré-application',
      details: error.message
    });
  } finally {
    await pool.end();
  }
});

export default router;
