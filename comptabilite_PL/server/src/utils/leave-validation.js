/**
 * Utilitaires de validation pour les demandes de congés
 */

/**
 * Vérifie si une demande de congé chevauche des demandes existantes
 * @param {Pool} pool - Connexion PostgreSQL
 * @param {string} employeeId - ID de l'employé
 * @param {string} startDate - Date de début (YYYY-MM-DD)
 * @param {string} endDate - Date de fin (YYYY-MM-DD)
 * @param {string} excludeRequestId - ID de demande à exclure (pour édition)
 * @returns {Promise<{hasOverlap: boolean, overlappingRequests: Array}>}
 */
export async function checkLeaveOverlap(pool, employeeId, startDate, endDate, excludeRequestId = null) {
  const query = `
    SELECT
      lr.id,
      lr.start_date,
      lr.end_date,
      lr.status,
      lt.name as leave_type_name
    FROM hr_leave_requests lr
    JOIN hr_leave_types lt ON lr.leave_type_id = lt.id
    WHERE lr.employee_id = $1
      AND lr.status IN ('pending', 'approved', 'approved_n1', 'approved_n2', 'approved_n3', 'approved_n4', 'approved_n5')
      AND (
        ($2::date BETWEEN lr.start_date AND lr.end_date) OR
        ($3::date BETWEEN lr.start_date AND lr.end_date) OR
        (lr.start_date BETWEEN $2::date AND $3::date)
      )
      ${excludeRequestId ? 'AND lr.id != $4' : ''}
  `;

  const params = excludeRequestId
    ? [employeeId, startDate, endDate, excludeRequestId]
    : [employeeId, startDate, endDate];

  const result = await pool.query(query, params);

  return {
    hasOverlap: result.rows.length > 0,
    overlappingRequests: result.rows
  };
}
