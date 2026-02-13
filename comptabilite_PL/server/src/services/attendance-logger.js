/**
 * AttendanceLogger - Service d'audit pour le système de pointage
 *
 * Enregistre toutes les modifications dans hr_attendance_audit
 * pour une traçabilité complète et faciliter le diagnostic.
 */

export class AttendanceLogger {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Actions valides pour l'audit
   */
  static ACTIONS = {
    CLOCK_IN: 'clock_in',
    CLOCK_OUT: 'clock_out',
    MANUAL_CREATE: 'manual_create',
    MANUAL_EDIT: 'manual_edit',
    CORRECTION_APPLIED: 'correction_applied',
    STATUS_CHANGE: 'status_change',
    SYSTEM_ABSENCE: 'system_absence',
    OVERTIME_APPROVED: 'overtime_approved',
    BREAK_ADJUSTED: 'break_adjusted',
    DELETED: 'deleted'
  };

  /**
   * Enregistrer une action d'audit
   *
   * @param {Object} params - Paramètres de l'audit
   * @param {string} params.attendanceId - UUID de l'enregistrement hr_attendance_daily (optionnel)
   * @param {string} params.employeeId - UUID de l'employé
   * @param {string} params.workDate - Date de travail
   * @param {string} params.action - Action effectuée (voir ACTIONS)
   * @param {Object|null} params.oldValues - Anciennes valeurs (pour édition)
   * @param {Object|null} params.newValues - Nouvelles valeurs
   * @param {string|null} params.reason - Raison de la modification
   * @param {string} params.performedBy - ID de l'utilisateur qui effectue l'action
   * @param {string|null} params.ipAddress - Adresse IP (optionnel)
   * @param {string|null} params.userAgent - User-Agent (optionnel)
   * @returns {Object} L'enregistrement d'audit créé
   */
  async log({
    attendanceId = null,
    employeeId,
    workDate,
    action,
    oldValues = null,
    newValues = null,
    reason = null,
    performedBy,
    ipAddress = null,
    userAgent = null
  }) {
    try {
      // Valider l'action
      const validActions = Object.values(AttendanceLogger.ACTIONS);
      if (!validActions.includes(action)) {
        console.warn(`[AttendanceLogger] Invalid action: ${action}. Using 'manual_edit' as fallback.`);
        action = 'manual_edit';
      }

      const result = await this.pool.query(`
        INSERT INTO hr_attendance_audit (
          attendance_id,
          employee_id,
          work_date,
          action,
          old_values,
          new_values,
          reason,
          performed_by,
          performed_at,
          ip_address,
          user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10)
        RETURNING *
      `, [
        attendanceId,
        employeeId,
        workDate,
        action,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        reason,
        performedBy,
        ipAddress,
        userAgent
      ]);

      console.log(`[AttendanceLogger] Logged: ${action} for employee ${employeeId} on ${workDate} by ${performedBy}`);

      return result.rows[0];
    } catch (error) {
      // Ne pas faire échouer l'opération principale si le log échoue
      console.error('[AttendanceLogger] Error logging audit:', error.message);
      return null;
    }
  }

  /**
   * Logger un pointage d'entrée
   */
  async logClockIn(attendanceId, employeeId, workDate, newValues, performedBy, ipAddress = null) {
    return this.log({
      attendanceId,
      employeeId,
      workDate,
      action: AttendanceLogger.ACTIONS.CLOCK_IN,
      newValues,
      performedBy,
      ipAddress
    });
  }

  /**
   * Logger un pointage de sortie
   */
  async logClockOut(attendanceId, employeeId, workDate, oldValues, newValues, performedBy, ipAddress = null) {
    return this.log({
      attendanceId,
      employeeId,
      workDate,
      action: AttendanceLogger.ACTIONS.CLOCK_OUT,
      oldValues,
      newValues,
      performedBy,
      ipAddress
    });
  }

  /**
   * Logger une création manuelle
   */
  async logManualCreate(attendanceId, employeeId, workDate, newValues, reason, performedBy) {
    return this.log({
      attendanceId,
      employeeId,
      workDate,
      action: AttendanceLogger.ACTIONS.MANUAL_CREATE,
      newValues,
      reason,
      performedBy
    });
  }

  /**
   * Logger une édition manuelle (correction admin)
   */
  async logManualEdit(attendanceId, employeeId, workDate, oldValues, newValues, reason, performedBy) {
    return this.log({
      attendanceId,
      employeeId,
      workDate,
      action: AttendanceLogger.ACTIONS.MANUAL_EDIT,
      oldValues,
      newValues,
      reason,
      performedBy
    });
  }

  /**
   * Logger l'application d'une correction approuvée
   */
  async logCorrectionApplied(attendanceId, employeeId, workDate, oldValues, newValues, correctionRequestId, performedBy) {
    return this.log({
      attendanceId,
      employeeId,
      workDate,
      action: AttendanceLogger.ACTIONS.CORRECTION_APPLIED,
      oldValues,
      newValues,
      reason: `Demande de correction #${correctionRequestId} approuvée`,
      performedBy
    });
  }

  /**
   * Logger un changement de statut
   */
  async logStatusChange(attendanceId, employeeId, workDate, oldStatus, newStatus, reason, performedBy) {
    return this.log({
      attendanceId,
      employeeId,
      workDate,
      action: AttendanceLogger.ACTIONS.STATUS_CHANGE,
      oldValues: { day_status: oldStatus },
      newValues: { day_status: newStatus },
      reason,
      performedBy
    });
  }

  /**
   * Logger une détection d'absence par le système
   */
  async logSystemAbsence(attendanceId, employeeId, workDate) {
    return this.log({
      attendanceId,
      employeeId,
      workDate,
      action: AttendanceLogger.ACTIONS.SYSTEM_ABSENCE,
      newValues: { day_status: 'absent' },
      reason: 'Absence détectée automatiquement par le système',
      performedBy: 'SYSTEM'
    });
  }

  /**
   * Logger une suppression
   */
  async logDeleted(attendanceId, employeeId, workDate, oldValues, reason, performedBy) {
    return this.log({
      attendanceId,
      employeeId,
      workDate,
      action: AttendanceLogger.ACTIONS.DELETED,
      oldValues,
      reason,
      performedBy
    });
  }

  /**
   * Obtenir l'historique d'audit pour un enregistrement
   */
  async getAuditHistory(attendanceId) {
    try {
      const result = await this.pool.query(`
        SELECT
          a.*,
          p.full_name as performed_by_name
        FROM hr_attendance_audit a
        LEFT JOIN profiles p ON a.performed_by = p.id
        WHERE a.attendance_id = $1
        ORDER BY a.performed_at DESC
      `, [attendanceId]);

      return result.rows;
    } catch (error) {
      console.error('[AttendanceLogger] Error getting audit history:', error.message);
      return [];
    }
  }

  /**
   * Obtenir l'historique d'audit pour un employé sur une période
   */
  async getEmployeeAuditHistory(employeeId, startDate, endDate) {
    try {
      const result = await this.pool.query(`
        SELECT
          a.*,
          p.full_name as performed_by_name
        FROM hr_attendance_audit a
        LEFT JOIN profiles p ON a.performed_by = p.id
        WHERE a.employee_id = $1
          AND a.work_date BETWEEN $2 AND $3
        ORDER BY a.work_date DESC, a.performed_at DESC
      `, [employeeId, startDate, endDate]);

      return result.rows;
    } catch (error) {
      console.error('[AttendanceLogger] Error getting employee audit history:', error.message);
      return [];
    }
  }

  /**
   * Obtenir les actions récentes (pour dashboard admin)
   */
  async getRecentActions(limit = 50) {
    try {
      const result = await this.pool.query(`
        SELECT
          a.*,
          e.first_name || ' ' || e.last_name as employee_name,
          e.employee_number,
          p.full_name as performed_by_name
        FROM hr_attendance_audit a
        LEFT JOIN hr_employees e ON a.employee_id = e.id
        LEFT JOIN profiles p ON a.performed_by = p.id
        ORDER BY a.performed_at DESC
        LIMIT $1
      `, [limit]);

      return result.rows;
    } catch (error) {
      console.error('[AttendanceLogger] Error getting recent actions:', error.message);
      return [];
    }
  }

  /**
   * Compter les actions par type sur une période
   */
  async getActionStats(startDate, endDate) {
    try {
      const result = await this.pool.query(`
        SELECT
          action,
          COUNT(*) as count
        FROM hr_attendance_audit
        WHERE performed_at BETWEEN $1 AND $2
        GROUP BY action
        ORDER BY count DESC
      `, [startDate, endDate]);

      return result.rows;
    } catch (error) {
      console.error('[AttendanceLogger] Error getting action stats:', error.message);
      return [];
    }
  }
}

// Export singleton factory
let instance = null;

export function getAttendanceLogger(pool) {
  if (!instance) {
    instance = new AttendanceLogger(pool);
  }
  return instance;
}

export default AttendanceLogger;
