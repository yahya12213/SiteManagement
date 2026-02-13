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
 * Retourne les managers dans l'ordre du rang (N=0, N+1=1, N+2=2, ...)
 */
async function getApprovalChain(pool, employeeId) {
  const result = await pool.query(`
    SELECT
      em.rank,
      em.manager_id,
      m.first_name || ' ' || m.last_name as manager_name,
      me.id as manager_employee_id,
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
 * Détermine le niveau d'approbation actuel basé sur le status de la demande
 * et les approbateurs précédents
 */
function getCurrentApprovalLevel(request) {
  // pending = attente N (rang 0)
  // approved_n1 = attente N+1 (rang 1)
  // approved_n2 = attente N+2 (rang 2)
  // etc.
  if (request.status === 'pending') return 0;
  if (request.status === 'approved_n1') return 1;
  if (request.status === 'approved_n2') return 2;
  // Pour les statuts dynamiques comme approved_n3, approved_n4, etc.
  const match = request.status?.match(/approved_n(\d+)/);
  if (match) return parseInt(match[1]);
  return 0;
}

// GET /api/hr/requests-validation/pending - Get pending requests for current approver
router.get('/pending', authenticateToken, requirePermission('hr.leaves.approve'), async (req, res) => {
  const pool = getPool();

  try {
    const { type } = req.query;
    const userId = req.user.id;

    // D'abord, trouver l'employé HR correspondant à l'utilisateur connecté
    const currentEmployeeResult = await pool.query(`
      SELECT id FROM hr_employees WHERE profile_id = $1
    `, [userId]);

    const currentEmployeeId = currentEmployeeResult.rows[0]?.id;

    // Vérifier si l'utilisateur est admin (peut voir toutes les demandes)
    const isAdmin = req.user.role === 'admin';

    // Get pending leave requests avec informations sur la chaîne d'approbation
    let leaveQuery = `
      SELECT
        lr.id,
        'leave' as request_type,
        lt.code as type_code,
        lt.name as type_name,
        e.id as employee_id,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.department as employee_department,
        lr.start_date,
        lr.end_date,
        lr.days_requested,
        lr.reason as motif,
        lr.status,
        lr.created_at as date_soumission,
        lr.n1_approver_id,
        lr.n2_approver_id,
        lr.current_approver_level
      FROM hr_leave_requests lr
      JOIN hr_leave_types lt ON lr.leave_type_id = lt.id
      JOIN hr_employees e ON lr.employee_id = e.id
      WHERE lr.status IN ('pending', 'approved_n1', 'approved_n2', 'approved_n3', 'approved_n4', 'approved_n5')
      ORDER BY lr.created_at DESC
    `;

    // Get pending overtime requests
    let overtimeQuery = `
      SELECT
        ot.id,
        'overtime' as request_type,
        'heures_sup' as type_code,
        'Heures supplementaires' as type_name,
        e.id as employee_id,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        e.department as employee_department,
        ot.request_date as start_date,
        ot.request_date as end_date,
        ot.estimated_hours as days_requested,
        ot.reason as motif,
        ot.status,
        ot.created_at as date_soumission
      FROM hr_overtime_requests ot
      JOIN hr_employees e ON ot.employee_id = e.id
      WHERE ot.status = 'pending'
      ORDER BY ot.created_at DESC
    `;

    const [leaveResults, overtimeResults] = await Promise.all([
      pool.query(leaveQuery),
      pool.query(overtimeQuery)
    ]);

    // Pour chaque demande de congé, vérifier si l'utilisateur connecté est le prochain approbateur
    const filteredLeaveRequests = [];
    for (const request of leaveResults.rows) {
      // Récupérer la chaîne d'approbation pour cet employé
      const approvalChain = await getApprovalChain(pool, request.employee_id);
      const currentLevel = getCurrentApprovalLevel(request);

      // Trouver le manager actuel dans la chaîne
      const currentApprover = approvalChain.find(m => m.rank === currentLevel);

      // Vérifier si l'utilisateur connecté est le prochain approbateur
      const isNextApprover = currentApprover && currentApprover.manager_id === currentEmployeeId;

      // Calculer l'étape actuelle et totale
      const etapeActuelle = currentLevel + 1;
      const etapeTotale = approvalChain.length;

      if (isAdmin || isNextApprover || !currentEmployeeId) {
        // Admin voit tout, ou si l'utilisateur est le prochain approbateur, ou si pas d'employé HR trouvé
        filteredLeaveRequests.push({
          ...request,
          etape_actuelle: etapeActuelle,
          etape_totale: etapeTotale,
          approval_chain: approvalChain,
          next_approver_name: currentApprover?.manager_name || null,
          is_next_approver: isNextApprover
        });
      }
    }

    // Pour les heures sup, vérifier aussi la chaîne d'approbation
    const filteredOvertimeRequests = [];
    for (const request of overtimeResults.rows) {
      const approvalChain = await getApprovalChain(pool, request.employee_id);
      const directManager = approvalChain.find(m => m.rank === 0);

      const isNextApprover = directManager && directManager.manager_id === currentEmployeeId;

      if (isAdmin || isNextApprover || !currentEmployeeId) {
        filteredOvertimeRequests.push({
          ...request,
          etape_actuelle: 1,
          etape_totale: 1,
          is_next_approver: isNextApprover
        });
      }
    }

    // Combine and filter by type if specified
    let allRequests = [...filteredLeaveRequests, ...filteredOvertimeRequests];

    if (type && type !== 'all') {
      allRequests = allRequests.filter(r => r.type_code === type);
    }

    // Sort by date
    allRequests.sort((a, b) => new Date(b.date_soumission) - new Date(a.date_soumission));

    res.json({
      success: true,
      requests: allRequests,
      count: allRequests.length
    });

  } catch (error) {
    console.error('Error in pending requests:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la recuperation des demandes',
      details: error.message
    });
  } finally {
    await pool.end();
  }
});

// GET /api/hr/requests-validation/history - Get decision history
router.get('/history', authenticateToken, requirePermission('hr.leaves.view_page'), async (req, res) => {
  const pool = getPool();
  const userId = req.user.id;

  try {
    const { limit = 50 } = req.query;

    // Get leave requests where this user made a decision
    const leaveHistory = await pool.query(`
      SELECT
        lr.id,
        'leave' as request_type,
        lt.code as type_code,
        lt.name as type_name,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        lr.status as decision,
        lr.created_at as date_soumission,
        COALESCE(lr.n1_approved_at, lr.n2_approved_at, lr.hr_approved_at, lr.updated_at) as date_decision,
        COALESCE(lr.n1_comment, lr.n2_comment, lr.hr_comment) as commentaire
      FROM hr_leave_requests lr
      JOIN hr_leave_types lt ON lr.leave_type_id = lt.id
      JOIN hr_employees e ON lr.employee_id = e.id
      WHERE lr.status IN ('approved', 'rejected')
        AND (lr.n1_approver_id = $2 OR lr.n2_approver_id = $2 OR lr.hr_approver_id = $2)
      ORDER BY lr.updated_at DESC
      LIMIT $1
    `, [parseInt(limit), userId]);

    // Get overtime requests where this user made a decision
    const overtimeHistory = await pool.query(`
      SELECT
        ot.id,
        'overtime' as request_type,
        'heures_sup' as type_code,
        'Heures supplementaires' as type_name,
        CONCAT(e.first_name, ' ', e.last_name) as employee_name,
        ot.status as decision,
        ot.created_at as date_soumission,
        ot.updated_at as date_decision,
        ot.approver_comment as commentaire
      FROM hr_overtime_requests ot
      JOIN hr_employees e ON ot.employee_id = e.id
      WHERE ot.status IN ('approved', 'rejected')
        AND ot.approver_id = $2
      ORDER BY ot.updated_at DESC
      LIMIT $1
    `, [parseInt(limit), userId]);

    // Combine and sort
    const allHistory = [...leaveHistory.rows, ...overtimeHistory.rows]
      .sort((a, b) => new Date(b.date_decision) - new Date(a.date_decision))
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      history: allHistory
    });

  } catch (error) {
    console.error('Error in history:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la recuperation de l\'historique',
      details: error.message
    });
  } finally {
    await pool.end();
  }
});

// POST /api/hr/requests-validation/:id/approve - Approve a request
router.post('/:id/approve', authenticateToken, requirePermission('hr.leaves.approve'), async (req, res) => {
  const pool = getPool();

  try {
    const { id } = req.params;
    const { request_type, comment } = req.body;
    const userId = req.user.id;

    if (request_type === 'leave') {
      // Récupérer la demande actuelle
      const leaveRequest = await pool.query(`
        SELECT lr.*, e.id as employee_id
        FROM hr_leave_requests lr
        JOIN hr_employees e ON lr.employee_id = e.id
        WHERE lr.id = $1
      `, [id]);

      if (leaveRequest.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Demande non trouvée' });
      }

      const request = leaveRequest.rows[0];
      const currentLevel = getCurrentApprovalLevel(request);

      // Récupérer la chaîne d'approbation
      const approvalChain = await getApprovalChain(pool, request.employee_id);

      // Vérifier s'il y a un niveau suivant
      const nextLevel = currentLevel + 1;
      const hasNextApprover = approvalChain.some(m => m.rank === nextLevel);

      // Verifier que l'utilisateur est l'approbateur attendu pour ce niveau
      const expectedApprover = approvalChain.find(m => m.rank === currentLevel);
      if (!expectedApprover || expectedApprover.manager_profile_id !== userId) {
        console.log('=== APPROVAL BLOCKED ===');
        console.log('User ID:', userId);
        console.log('Expected approver for level', currentLevel, ':', expectedApprover);
        console.log('========================');
        return res.status(403).json({
          success: false,
          error: 'Vous n\'etes pas l\'approbateur attendu pour ce niveau d\'approbation'
        });
      }

      let newStatus;
      let updateFields;

      if (hasNextApprover) {
        // Passer au niveau suivant (approved_n1, approved_n2, etc.)
        newStatus = `approved_n${nextLevel}`;
        updateFields = `
          status = '${newStatus}',
          current_approver_level = 'n${nextLevel}',
          updated_at = NOW()
        `;

        // Enregistrer l'approbation du niveau actuel
        if (currentLevel === 0) {
          updateFields = `
            status = '${newStatus}',
            current_approver_level = 'n${nextLevel}',
            n1_approver_id = $2,
            n1_approved_at = NOW(),
            n1_comment = $3,
            updated_at = NOW()
          `;
        } else if (currentLevel === 1) {
          updateFields = `
            status = '${newStatus}',
            current_approver_level = 'n${nextLevel}',
            n2_approver_id = $2,
            n2_approved_at = NOW(),
            n2_comment = $3,
            updated_at = NOW()
          `;
        }
      } else {
        // C'est le dernier niveau - approbation finale
        newStatus = 'approved';
        if (currentLevel === 0) {
          updateFields = `
            status = 'approved',
            current_approver_level = 'completed',
            n1_approver_id = $2,
            n1_approved_at = NOW(),
            n1_comment = $3,
            updated_at = NOW()
          `;
        } else if (currentLevel === 1) {
          updateFields = `
            status = 'approved',
            current_approver_level = 'completed',
            n2_approver_id = $2,
            n2_approved_at = NOW(),
            n2_comment = $3,
            updated_at = NOW()
          `;
        } else {
          // Pour les niveaux supérieurs, mettre à jour le HR approver
          updateFields = `
            status = 'approved',
            current_approver_level = 'completed',
            hr_approver_id = $2,
            hr_approved_at = NOW(),
            hr_comment = $3,
            updated_at = NOW()
          `;
        }

        // Update leave balance seulement si c'est l'approbation finale
        const { employee_id, leave_type_id, days_requested } = request;
        await pool.query(`
          UPDATE hr_leave_balances
          SET taken = taken + $3, updated_at = NOW()
          WHERE employee_id = $1 AND leave_type_id = $2 AND year = EXTRACT(YEAR FROM CURRENT_DATE)
        `, [employee_id, leave_type_id, days_requested]);
      }

      await pool.query(`
        UPDATE hr_leave_requests
        SET ${updateFields}
        WHERE id = $1
      `, [id, userId, comment || '']);

      res.json({
        success: true,
        message: hasNextApprover
          ? `Demande approuvée. En attente de validation niveau N+${nextLevel}`
          : 'Demande approuvée définitivement',
        next_level: hasNextApprover ? nextLevel : null,
        is_final: !hasNextApprover
      });

    } else if (request_type === 'overtime') {
      // Pour les heures sup, une seule approbation suffit (manager direct)
      await pool.query(`
        UPDATE hr_overtime_requests
        SET
          status = 'approved',
          approver_id = $2,
          approved_at = NOW(),
          approver_comment = $3,
          updated_at = NOW()
        WHERE id = $1
      `, [id, userId, comment || '']);

      res.json({
        success: true,
        message: 'Demande d\'heures supplémentaires approuvée'
      });
    } else {
      res.json({
        success: true,
        message: 'Demande approuvee avec succes'
      });
    }

  } catch (error) {
    console.error('Error in approve:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'approbation',
      details: error.message
    });
  } finally {
    await pool.end();
  }
});

// POST /api/hr/requests-validation/:id/reject - Reject a request
router.post('/:id/reject', authenticateToken, requirePermission('hr.leaves.approve'), async (req, res) => {
  const pool = getPool();

  try {
    const { id } = req.params;
    const { request_type, comment } = req.body;
    const userId = req.user.id;

    if (!comment || !comment.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Un commentaire est obligatoire pour le rejet'
      });
    }

    if (request_type === 'leave') {
      // Récupérer le statut actuel pour déterminer le niveau d'approbation
      const currentRequest = await pool.query(
        `SELECT status FROM hr_leave_requests WHERE id = $1`,
        [id]
      );

      const currentStatus = currentRequest.rows[0]?.status || 'pending';
      const currentLevel = currentStatus === 'pending' ? 0 :
                           currentStatus === 'approved_n1' ? 1 :
                           currentStatus === 'approved_n2' ? 2 :
                           currentStatus === 'approved_n3' ? 3 :
                           currentStatus === 'approved_n4' ? 4 : 0;

      let updateQuery;
      if (currentLevel === 0) {
        // Rejet par N (manager direct)
        updateQuery = `
          UPDATE hr_leave_requests
          SET status = 'rejected',
              n1_approver_id = $2,
              n1_approved_at = NOW(),
              n1_comment = $3,
              updated_at = NOW()
          WHERE id = $1
        `;
      } else if (currentLevel === 1) {
        // Rejet par N+1
        updateQuery = `
          UPDATE hr_leave_requests
          SET status = 'rejected',
              n2_approver_id = $2,
              n2_approved_at = NOW(),
              n2_comment = $3,
              updated_at = NOW()
          WHERE id = $1
        `;
      } else {
        // Rejet par N+2 ou supérieur
        updateQuery = `
          UPDATE hr_leave_requests
          SET status = 'rejected',
              hr_approver_id = $2,
              hr_approved_at = NOW(),
              hr_comment = $3,
              updated_at = NOW()
          WHERE id = $1
        `;
      }

      await pool.query(updateQuery, [id, userId, comment]);
    } else if (request_type === 'overtime') {
      await pool.query(`
        UPDATE hr_overtime_requests
        SET
          status = 'rejected',
          approver_id = $2,
          approved_at = NOW(),
          approver_comment = $3,
          updated_at = NOW()
        WHERE id = $1
      `, [id, userId, comment]);
    }

    res.json({
      success: true,
      message: 'Demande rejetee'
    });

  } catch (error) {
    console.error('Error in reject:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors du rejet',
      details: error.message
    });
  } finally {
    await pool.end();
  }
});

// GET /api/hr/requests-validation/:id - Get request details
router.get('/:id', authenticateToken, requirePermission('hr.leaves.view_page'), async (req, res) => {
  const pool = getPool();

  try {
    const { id } = req.params;
    const { type } = req.query;

    let result;
    if (type === 'leave') {
      result = await pool.query(`
        SELECT
          lr.*,
          lt.code as type_code,
          lt.name as type_name,
          CONCAT(e.first_name, ' ', e.last_name) as employee_name,
          e.department as employee_department
        FROM hr_leave_requests lr
        JOIN hr_leave_types lt ON lr.leave_type_id = lt.id
        JOIN hr_employees e ON lr.employee_id = e.id
        WHERE lr.id = $1
      `, [id]);
    } else {
      result = await pool.query(`
        SELECT
          ot.*,
          'heures_sup' as type_code,
          'Heures supplementaires' as type_name,
          CONCAT(e.first_name, ' ', e.last_name) as employee_name,
          e.department as employee_department
        FROM hr_overtime_requests ot
        JOIN hr_employees e ON ot.employee_id = e.id
        WHERE ot.id = $1
      `, [id]);
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Demande non trouvee'
      });
    }

    res.json({
      success: true,
      request: result.rows[0]
    });

  } catch (error) {
    console.error('Error in get request:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la recuperation',
      details: error.message
    });
  } finally {
    await pool.end();
  }
});

export default router;
