/**
 * ApprovalService - Unified approval system for all HR requests
 * Handles: Leave requests, Overtime requests, Correction requests
 * Uses hr_employee_managers table for multi-level approval chain
 */

import pg from 'pg';

const { Pool } = pg;

// Get pool connection
const getPool = () => new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

/**
 * Request types supported by this service
 */
export const REQUEST_TYPES = {
  LEAVE: 'leave',
  OVERTIME: 'overtime',
  CORRECTION: 'correction'
};

/**
 * Request statuses
 */
export const REQUEST_STATUS = {
  PENDING: 'pending',
  APPROVED_N1: 'approved_n1',
  APPROVED_N2: 'approved_n2',
  APPROVED_N3: 'approved_n3',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled'
};

/**
 * ApprovalService class for unified request approval
 */
export class ApprovalService {
  constructor(existingPool = null) {
    this.pool = existingPool;
    this.ownPool = false;
  }

  /**
   * Get or create pool connection
   */
  async getConnection() {
    if (!this.pool) {
      this.pool = getPool();
      this.ownPool = true;
    }
    return this.pool;
  }

  /**
   * Close pool if we created it
   */
  async close() {
    if (this.ownPool && this.pool) {
      await this.pool.end();
    }
  }

  /**
   * Get the approval chain for an employee
   * @param {string} employeeId - The employee ID
   * @returns {Array} Array of managers ordered by rank (N=0, N+1=1, N+2=2, etc.)
   */
  async getApprovalChain(employeeId) {
    const pool = await this.getConnection();

    const result = await pool.query(`
      SELECT
        em.rank,
        em.manager_id,
        m.first_name || ' ' || m.last_name as manager_name,
        m.profile_id as manager_profile_id
      FROM hr_employee_managers em
      JOIN hr_employees m ON em.manager_id = m.id
      WHERE em.employee_id = $1 AND em.is_active = true
      ORDER BY em.rank ASC
    `, [employeeId]);

    return result.rows;
  }

  /**
   * Determine the current approval level based on request status
   * @param {Object} request - The request object with status field
   * @returns {number} Current approval level (0 = pending at N, 1 = pending at N+1, etc.)
   */
  getCurrentApprovalLevel(request) {
    if (request.status === 'pending') return 0;
    if (request.status === 'approved_n1') return 1;
    if (request.status === 'approved_n2') return 2;

    // For dynamic statuses like approved_n3, approved_n4, etc.
    const match = request.status?.match(/approved_n(\d+)/);
    if (match) return parseInt(match[1]);

    return 0;
  }

  /**
   * Get the next status after approval at current level
   * @param {number} currentLevel - Current approval level
   * @param {boolean} hasNextApprover - Whether there's a next approver in the chain
   * @returns {string} Next status
   */
  getNextStatus(currentLevel, hasNextApprover) {
    if (!hasNextApprover) {
      return REQUEST_STATUS.APPROVED;
    }
    const nextLevel = currentLevel + 1;
    return `approved_n${nextLevel}`;
  }

  /**
   * Check if a user can approve a request
   * @param {string} userId - Profile ID of the user
   * @param {string} employeeId - Employee ID who made the request
   * @param {number} currentLevel - Current approval level of the request
   * @returns {Object} { canApprove: boolean, managerInfo: object }
   */
  async canUserApprove(userId, employeeId, currentLevel) {
    const pool = await this.getConnection();

    // First, find the employee record for this user
    const userEmployee = await pool.query(`
      SELECT id FROM hr_employees WHERE profile_id = $1
    `, [userId]);

    if (userEmployee.rows.length === 0) {
      return { canApprove: false, reason: 'User is not an employee', managerInfo: null };
    }

    const userEmployeeId = userEmployee.rows[0].id;

    // Get the approval chain
    const approvalChain = await this.getApprovalChain(employeeId);

    // Find if the user is the current approver
    const currentApprover = approvalChain.find(m => m.rank === currentLevel);

    if (!currentApprover) {
      return { canApprove: false, reason: 'No approver at this level', managerInfo: null };
    }

    if (currentApprover.manager_id !== userEmployeeId) {
      return { canApprove: false, reason: 'User is not the current approver', managerInfo: currentApprover };
    }

    return { canApprove: true, reason: null, managerInfo: currentApprover };
  }

  /**
   * Approve a leave request
   * @param {string} requestId - Request ID
   * @param {string} approverId - Profile ID of the approver
   * @param {string} comment - Optional approval comment
   * @returns {Object} Result with status and message
   */
  async approveLeaveRequest(requestId, approverId, comment = '') {
    const pool = await this.getConnection();

    // Get the request
    const requestResult = await pool.query(`
      SELECT lr.*, e.id as employee_id, lt.code as leave_type_code
      FROM hr_leave_requests lr
      JOIN hr_employees e ON lr.employee_id = e.id
      LEFT JOIN hr_leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.id = $1
    `, [requestId]);

    if (requestResult.rows.length === 0) {
      return { success: false, error: 'Request not found' };
    }

    const request = requestResult.rows[0];
    const currentLevel = this.getCurrentApprovalLevel(request);

    // Check if user can approve
    const { canApprove, reason, managerInfo } = await this.canUserApprove(
      approverId,
      request.employee_id,
      currentLevel
    );

    // Block approval if user is not the expected approver
    if (!canApprove) {
      console.log('=== APPROVAL BLOCKED ===');
      console.log('Approver ID:', approverId);
      console.log('Reason:', reason);
      console.log('Expected:', managerInfo?.manager_name);
      console.log('========================');
      return { success: false, error: reason || 'Vous n\'etes pas l\'approbateur attendu pour ce niveau' };
    }

    // Get full approval chain to check for next approver
    const approvalChain = await this.getApprovalChain(request.employee_id);
    const nextLevel = currentLevel + 1;
    const hasNextApprover = approvalChain.some(m => m.rank === nextLevel);

    // DEBUG: Log approval chain details for leave requests
    console.log('=== LEAVE APPROVAL DEBUG ===');
    console.log('Employee ID:', request.employee_id);
    console.log('Current Level:', currentLevel);
    console.log('Next Level:', nextLevel);
    console.log('Approval Chain:', JSON.stringify(approvalChain, null, 2));
    console.log('Has Next Approver:', hasNextApprover);

    // Determine new status
    const newStatus = this.getNextStatus(currentLevel, hasNextApprover);
    console.log('New Status:', newStatus);
    console.log('============================');

    const isFinal = newStatus === REQUEST_STATUS.APPROVED;

    // Build update query based on current level
    let updateQuery;
    let updateParams;

    if (currentLevel === 0) {
      updateQuery = `
        UPDATE hr_leave_requests
        SET status = $1,
            current_approver_level = $2,
            n1_approver_id = $3,
            n1_approved_at = NOW(),
            n1_comment = $4,
            updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `;
      updateParams = [newStatus, isFinal ? 'completed' : `n${nextLevel}`, approverId, comment, requestId];
    } else if (currentLevel === 1) {
      updateQuery = `
        UPDATE hr_leave_requests
        SET status = $1,
            current_approver_level = $2,
            n2_approver_id = $3,
            n2_approved_at = NOW(),
            n2_comment = $4,
            updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `;
      updateParams = [newStatus, isFinal ? 'completed' : `n${nextLevel}`, approverId, comment, requestId];
    } else {
      // Higher levels use hr_approver fields
      updateQuery = `
        UPDATE hr_leave_requests
        SET status = $1,
            current_approver_level = $2,
            hr_approver_id = $3,
            hr_approved_at = NOW(),
            hr_comment = $4,
            updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `;
      // Pour les niveaux 3+, utiliser 'hr' car la contrainte CHECK n'autorise que n1, n2, hr, completed
      updateParams = [newStatus, isFinal ? 'completed' : (nextLevel > 2 ? 'hr' : `n${nextLevel}`), approverId, comment, requestId];
    }

    const result = await pool.query(updateQuery, updateParams);

    // If final approval, update leave balance
    if (isFinal && request.leave_type_code !== 'OTHER') {
      await pool.query(`
        UPDATE hr_leave_balances
        SET taken = taken + $3, updated_at = NOW()
        WHERE employee_id = $1 AND leave_type_id = $2 AND year = EXTRACT(YEAR FROM CURRENT_DATE)
      `, [request.employee_id, request.leave_type_id, request.days_requested]);
    }

    return {
      success: true,
      request: result.rows[0],
      message: isFinal
        ? 'Demande approuvée définitivement'
        : `Demande approuvée. En attente de validation niveau N+${nextLevel}`,
      is_final: isFinal,
      next_level: isFinal ? null : nextLevel
    };
  }

  /**
   * Approve an overtime request
   * @param {string} requestId - Request ID
   * @param {string} approverId - Profile ID of the approver
   * @param {string} comment - Optional approval comment
   * @returns {Object} Result with status and message
   */
  async approveOvertimeRequest(requestId, approverId, comment = '') {
    const pool = await this.getConnection();

    // For overtime, only the direct manager (N) can approve
    const result = await pool.query(`
      UPDATE hr_overtime_requests
      SET status = 'approved',
          approver_id = $1,
          approved_at = NOW(),
          approver_comment = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [approverId, comment, requestId]);

    if (result.rows.length === 0) {
      return { success: false, error: 'Request not found' };
    }

    return {
      success: true,
      request: result.rows[0],
      message: 'Demande d\'heures supplémentaires approuvée',
      is_final: true
    };
  }

  /**
   * Approve a correction request
   * @param {string} requestId - Request ID
   * @param {string} approverId - Profile ID of the approver
   * @param {string} comment - Optional approval comment
   * @returns {Object} Result with status and message
   */
  async approveCorrectionRequest(requestId, approverId, comment = '') {
    const pool = await this.getConnection();

    // Get the request - TO_CHAR garantit le format YYYY-MM-DD
    const requestResult = await pool.query(`
      SELECT
        *,
        TO_CHAR(request_date, 'YYYY-MM-DD') as request_date_iso
      FROM hr_attendance_correction_requests
      WHERE id = $1
    `, [requestId]);

    if (requestResult.rows.length === 0) {
      return { success: false, error: 'Correction request not found' };
    }

    const request = requestResult.rows[0];
    const currentLevel = this.getCurrentApprovalLevel(request);

    // Check if user can approve
    const { canApprove, reason, managerInfo } = await this.canUserApprove(
      approverId,
      request.employee_id,
      currentLevel
    );

    // Block approval if user is not the expected approver
    if (!canApprove) {
      console.log('=== CORRECTION APPROVAL BLOCKED ===');
      console.log('Approver ID:', approverId);
      console.log('Reason:', reason);
      console.log('Expected:', managerInfo?.manager_name);
      console.log('================================');
      return { success: false, error: reason || 'Vous n\'êtes pas l\'approbateur attendu pour ce niveau' };
    }

    // Convertir profile_id en employee_id pour la FK
    const approverEmployee = await pool.query(
      'SELECT id FROM hr_employees WHERE profile_id = $1',
      [approverId]
    );
    if (approverEmployee.rows.length === 0) {
      return { success: false, error: 'Approver employee not found' };
    }
    const approverEmployeeId = approverEmployee.rows[0].id;

    // Get full approval chain to check for next approver
    const approvalChain = await this.getApprovalChain(request.employee_id);
    const nextLevel = currentLevel + 1;
    const hasNextApprover = approvalChain.some(m => m.rank === nextLevel);

    // Determine new status
    const newStatus = this.getNextStatus(currentLevel, hasNextApprover);
    const isFinal = newStatus === REQUEST_STATUS.APPROVED;

    // Build update query
    let updateQuery;
    let updateParams;

    if (currentLevel === 0) {
      updateQuery = `
        UPDATE hr_attendance_correction_requests
        SET status = $1,
            n1_approver_id = $2,
            n1_approved_at = NOW(),
            n1_comment = $3,
            updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `;
      updateParams = [newStatus, approverEmployeeId, comment, requestId];
    } else if (currentLevel === 1) {
      updateQuery = `
        UPDATE hr_attendance_correction_requests
        SET status = $1,
            n2_approver_id = $2,
            n2_approved_at = NOW(),
            n2_comment = $3,
            updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `;
      updateParams = [newStatus, approverEmployeeId, comment, requestId];
    } else {
      updateQuery = `
        UPDATE hr_attendance_correction_requests
        SET status = $1,
            n3_approver_id = $2,
            n3_approved_at = NOW(),
            n3_comment = $3,
            updated_at = NOW()
        WHERE id = $4
        RETURNING *
      `;
      updateParams = [newStatus, approverEmployeeId, comment, requestId];
    }

    const result = await pool.query(updateQuery, updateParams);

    // If final approval, apply the correction to attendance records
    if (isFinal) {
      await this.applyCorrectionToAttendance(request);
    }

    return {
      success: true,
      request: result.rows[0],
      message: isFinal
        ? 'Demande de correction approuvée. Pointages mis à jour.'
        : `Demande approuvée. En attente de validation niveau N+${nextLevel}`,
      is_final: isFinal,
      next_level: isFinal ? null : nextLevel
    };
  }

  /**
   * Apply correction to attendance records after final approval
   * Stratégie: DELETE tous les records du jour puis INSERT les nouveaux avec source='correction'
   * @param {Object} correctionRequest - The approved correction request
   */
  async applyCorrectionToAttendance(correctionRequest) {
    const pool = await this.getConnection();

    const {
      employee_id,
      request_date_iso,
      requested_check_in,
      requested_check_out
    } = correctionRequest;

    console.log('=== APPLYING CORRECTION ===');
    console.log('Employee ID:', employee_id);
    console.log('Date (ISO):', request_date_iso);
    console.log('Requested check_in:', requested_check_in);
    console.log('Requested check_out:', requested_check_out);

    try {
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

      // Construire les timestamps en format datetime (sans timezone - sera interprété en heure locale par PostgreSQL)
      const clockInAt = checkInTime ? `${request_date_iso} ${checkInTime}` : null;
      const clockOutAt = checkOutTime ? `${request_date_iso} ${checkOutTime}` : null;

      console.log('ClockIn:', clockInAt, 'ClockOut:', clockOutAt);

      // UPSERT dans hr_attendance_daily (nouvelle table unifiée)
      // Utiliser AT TIME ZONE pour interpréter l'heure en timezone locale Maroc
      // Note: $3::text::timestamp - le cast text résout le problème "could not determine data type"
      await pool.query(`
        INSERT INTO hr_attendance_daily (
          employee_id, work_date, clock_in_at, clock_out_at,
          day_status, source, notes, created_at, updated_at
        )
        VALUES (
          $1, $2,
          ($3::text)::timestamp AT TIME ZONE 'Africa/Casablanca',
          ($4::text)::timestamp AT TIME ZONE 'Africa/Casablanca',
          'present', 'correction', 'Correction approuvée', NOW(), NOW()
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
          day_status = 'present',
          source = 'correction',
          notes = COALESCE(hr_attendance_daily.notes, '') || ' | Correction approuvée',
          updated_at = NOW()
      `, [employee_id, request_date_iso, clockInAt, clockOutAt]);

      console.log('Attendance record upserted with source=correction');
      console.log('=== CORRECTION APPLIED SUCCESSFULLY ===');
    } catch (error) {
      console.error('=== ERROR APPLYING CORRECTION ===', error);
      throw error;
    }
  }

  /**
   * Reject a request (works for all types)
   * @param {string} requestType - Type of request (leave, overtime, correction)
   * @param {string} requestId - Request ID
   * @param {string} approverId - Profile ID of the rejector
   * @param {string} comment - Required rejection reason
   * @returns {Object} Result with status and message
   */
  async rejectRequest(requestType, requestId, approverId, comment) {
    if (!comment || !comment.trim()) {
      return { success: false, error: 'Un commentaire est obligatoire pour le rejet' };
    }

    const pool = await this.getConnection();
    let result;

    switch (requestType) {
      case REQUEST_TYPES.LEAVE:
        result = await pool.query(`
          UPDATE hr_leave_requests
          SET status = 'rejected',
              n1_approver_id = $1,
              n1_approved_at = NOW(),
              n1_comment = $2,
              updated_at = NOW()
          WHERE id = $3
          RETURNING *
        `, [approverId, comment, requestId]);
        break;

      case REQUEST_TYPES.OVERTIME:
        result = await pool.query(`
          UPDATE hr_overtime_requests
          SET status = 'rejected',
              approver_id = $1,
              approved_at = NOW(),
              approver_comment = $2,
              updated_at = NOW()
          WHERE id = $3
          RETURNING *
        `, [approverId, comment, requestId]);
        break;

      case REQUEST_TYPES.CORRECTION:
        // Convertir profile_id en employee_id pour la FK
        const correctionApproverEmployee = await pool.query(
          'SELECT id FROM hr_employees WHERE profile_id = $1',
          [approverId]
        );
        if (correctionApproverEmployee.rows.length === 0) {
          return { success: false, error: 'Approver employee not found' };
        }
        const correctionApproverEmployeeId = correctionApproverEmployee.rows[0].id;

        result = await pool.query(`
          UPDATE hr_attendance_correction_requests
          SET status = 'rejected',
              n1_approver_id = $1,
              n1_approved_at = NOW(),
              n1_comment = $2,
              updated_at = NOW()
          WHERE id = $3
          RETURNING *
        `, [correctionApproverEmployeeId, comment, requestId]);
        break;

      default:
        return { success: false, error: 'Type de demande invalide' };
    }

    if (result.rows.length === 0) {
      return { success: false, error: 'Demande non trouvée' };
    }

    return {
      success: true,
      request: result.rows[0],
      message: 'Demande rejetée'
    };
  }

  /**
   * Cancel an approved request (admin only)
   * @param {string} requestType - Type of request (leave, overtime, correction)
   * @param {string} requestId - Request ID
   * @param {string} cancelledBy - Profile ID of the admin who cancels
   * @param {string} reason - Reason for cancellation
   * @returns {Object} Result with status and message
   */
  async cancelApprovedRequest(requestType, requestId, cancelledBy, reason) {
    if (!reason || !reason.trim()) {
      return { success: false, error: 'Une raison est obligatoire pour l\'annulation' };
    }

    const pool = await this.getConnection();
    let result;

    switch (requestType) {
      case REQUEST_TYPES.LEAVE:
        // First check if it's approved
        const leaveCheck = await pool.query(
          'SELECT status, balance_deducted, employee_id, leave_type_id, days_requested FROM hr_leave_requests WHERE id = $1',
          [requestId]
        );
        if (leaveCheck.rows.length === 0) {
          return { success: false, error: 'Demande non trouvée' };
        }
        if (!['approved', 'approved_n1', 'approved_n2'].includes(leaveCheck.rows[0].status)) {
          return { success: false, error: 'Seules les demandes approuvées peuvent être annulées' };
        }

        // Restore leave balance if it was deducted
        if (leaveCheck.rows[0].balance_deducted) {
          await pool.query(`
            UPDATE hr_leave_balances
            SET taken = taken - $1,
                updated_at = NOW()
            WHERE employee_id = $2 AND leave_type_id = $3 AND year = EXTRACT(YEAR FROM CURRENT_DATE)
          `, [leaveCheck.rows[0].days_requested, leaveCheck.rows[0].employee_id, leaveCheck.rows[0].leave_type_id]);
        }

        result = await pool.query(`
          UPDATE hr_leave_requests
          SET status = 'cancelled',
              cancelled_at = NOW(),
              cancelled_by = $1,
              cancellation_reason = $2,
              balance_deducted = false,
              updated_at = NOW()
          WHERE id = $3
          RETURNING *
        `, [cancelledBy, reason, requestId]);
        break;

      case REQUEST_TYPES.OVERTIME:
        // Check if it's approved
        const overtimeCheck = await pool.query(
          'SELECT status FROM hr_overtime_requests WHERE id = $1',
          [requestId]
        );
        if (overtimeCheck.rows.length === 0) {
          return { success: false, error: 'Demande non trouvée' };
        }
        if (overtimeCheck.rows[0].status !== 'approved') {
          return { success: false, error: 'Seules les demandes approuvées peuvent être annulées' };
        }

        result = await pool.query(`
          UPDATE hr_overtime_requests
          SET status = 'cancelled',
              approver_comment = COALESCE(approver_comment, '') || ' | ANNULÉ: ' || $2,
              updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `, [requestId, reason]);
        break;

      case REQUEST_TYPES.CORRECTION:
        // Check if it's approved
        const correctionCheck = await pool.query(
          'SELECT status FROM hr_attendance_correction_requests WHERE id = $1',
          [requestId]
        );
        if (correctionCheck.rows.length === 0) {
          return { success: false, error: 'Demande non trouvée' };
        }
        if (correctionCheck.rows[0].status !== 'approved') {
          return { success: false, error: 'Seules les demandes approuvées peuvent être annulées' };
        }

        result = await pool.query(`
          UPDATE hr_attendance_correction_requests
          SET status = 'cancelled',
              n1_comment = COALESCE(n1_comment, '') || ' | ANNULÉ: ' || $2,
              updated_at = NOW()
          WHERE id = $1
          RETURNING *
        `, [requestId, reason]);
        break;

      default:
        return { success: false, error: 'Type de demande invalide' };
    }

    if (result.rows.length === 0) {
      return { success: false, error: 'Demande non trouvée' };
    }

    return {
      success: true,
      request: result.rows[0],
      message: 'Demande annulée avec succès'
    };
  }

  /**
   * Universal approve method
   * @param {string} requestType - Type of request (leave, overtime, correction)
   * @param {string} requestId - Request ID
   * @param {string} approverId - Profile ID of the approver
   * @param {string} comment - Optional approval comment
   * @returns {Object} Result with status and message
   */
  async approve(requestType, requestId, approverId, comment = '') {
    switch (requestType) {
      case REQUEST_TYPES.LEAVE:
        return this.approveLeaveRequest(requestId, approverId, comment);
      case REQUEST_TYPES.OVERTIME:
        return this.approveOvertimeRequest(requestId, approverId, comment);
      case REQUEST_TYPES.CORRECTION:
        return this.approveCorrectionRequest(requestId, approverId, comment);
      default:
        return { success: false, error: 'Type de demande invalide' };
    }
  }

  /**
   * Get pending requests for a specific approver
   * @param {string} userId - Profile ID of the approver
   * @param {boolean} isAdmin - Whether the user is an admin (sees all)
   * @returns {Array} Array of pending requests
   */
  async getPendingRequestsForApprover(userId, isAdmin = false) {
    const pool = await this.getConnection();

    // Get the employee ID for this user
    const userEmployee = await pool.query(`
      SELECT id FROM hr_employees WHERE profile_id = $1
    `, [userId]);

    const userEmployeeId = userEmployee.rows[0]?.id;

    // Get all pending leave requests
    const leaveResults = await pool.query(`
      SELECT
        lr.id,
        'leave' as request_type,
        lt.code as type_code,
        lt.name as type_name,
        e.id as employee_id,
        e.first_name || ' ' || e.last_name as employee_name,
        e.department as employee_department,
        lr.start_date,
        lr.end_date,
        lr.days_requested,
        lr.reason as motif,
        lr.status,
        lr.created_at as date_soumission
      FROM hr_leave_requests lr
      JOIN hr_leave_types lt ON lr.leave_type_id = lt.id
      JOIN hr_employees e ON lr.employee_id = e.id
      WHERE lr.status IN ('pending', 'approved_n1', 'approved_n2', 'approved_n3')
      ORDER BY lr.created_at DESC
    `);

    // Get pending overtime requests
    const overtimeResults = await pool.query(`
      SELECT
        ot.id,
        'overtime' as request_type,
        'heures_sup' as type_code,
        'Heures supplémentaires' as type_name,
        e.id as employee_id,
        e.first_name || ' ' || e.last_name as employee_name,
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
    `);

    // Get pending correction requests
    const correctionResults = await pool.query(`
      SELECT
        cr.id,
        'correction' as request_type,
        'correction' as type_code,
        'Correction de pointage' as type_name,
        e.id as employee_id,
        e.first_name || ' ' || e.last_name as employee_name,
        e.department as employee_department,
        cr.request_date as start_date,
        cr.request_date as end_date,
        1 as days_requested,
        cr.reason as motif,
        cr.status,
        cr.created_at as date_soumission
      FROM hr_attendance_correction_requests cr
      JOIN hr_employees e ON cr.employee_id = e.id
      WHERE cr.status IN ('pending', 'approved_n1', 'approved_n2')
      ORDER BY cr.created_at DESC
    `);

    const allRequests = [];

    // Filter leave requests
    for (const request of leaveResults.rows) {
      const approvalChain = await this.getApprovalChain(request.employee_id);
      const currentLevel = this.getCurrentApprovalLevel(request);
      const currentApprover = approvalChain.find(m => m.rank === currentLevel);
      const isNextApprover = currentApprover && currentApprover.manager_id === userEmployeeId;

      if (isAdmin || isNextApprover) {
        allRequests.push({
          ...request,
          etape_actuelle: currentLevel + 1,
          etape_totale: approvalChain.length,
          next_approver_name: currentApprover?.manager_name,
          is_next_approver: isNextApprover
        });
      }
    }

    // Filter overtime requests (only N level)
    for (const request of overtimeResults.rows) {
      const approvalChain = await this.getApprovalChain(request.employee_id);
      const directManager = approvalChain.find(m => m.rank === 0);
      const isNextApprover = directManager && directManager.manager_id === userEmployeeId;

      if (isAdmin || isNextApprover) {
        allRequests.push({
          ...request,
          etape_actuelle: 1,
          etape_totale: 1,
          is_next_approver: isNextApprover
        });
      }
    }

    // Filter correction requests
    for (const request of correctionResults.rows) {
      const approvalChain = await this.getApprovalChain(request.employee_id);
      const currentLevel = this.getCurrentApprovalLevel(request);
      const currentApprover = approvalChain.find(m => m.rank === currentLevel);
      const isNextApprover = currentApprover && currentApprover.manager_id === userEmployeeId;

      if (isAdmin || isNextApprover) {
        allRequests.push({
          ...request,
          etape_actuelle: currentLevel + 1,
          etape_totale: approvalChain.length,
          next_approver_name: currentApprover?.manager_name,
          is_next_approver: isNextApprover
        });
      }
    }

    // Sort by date
    allRequests.sort((a, b) => new Date(b.date_soumission) - new Date(a.date_soumission));

    return allRequests;
  }
}

export default ApprovalService;
