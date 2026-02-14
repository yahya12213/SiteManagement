/**
 * API Routes pour les primes d'assistante basées sur les inscriptions
 *
 * Calcule les primes journalières pour les assistantes basées sur:
 * - Les inscriptions d'étudiants dans les sessions
 * - Le matching segment/ville entre l'employé et la session
 * - La prime configurée par formation
 * - L'objectif d'inscription défini dans le dossier employé
 * - La période calculée automatiquement via payroll_cutoff_day
 */

import express from 'express';
// authenticateToken is applied at the router level in index.js
import pool from '../config/database.js';

const router = express.Router();

/**
 * Calcule la période d'objectif basée sur le jour de coupure et une date cible
 *
 * Exemple avec cutoff_day = 18:
 * - Date 2026-01-26 (jour 26 > 18): période = 19/01/2026 au 18/02/2026 (paie février)
 * - Date 2026-01-15 (jour 15 <= 18): période = 19/12/2025 au 18/01/2026 (paie janvier)
 *
 * @param {number} cutoffDay - Jour de coupure (1-28, défaut 18)
 * @param {string} targetDate - Date cible au format YYYY-MM-DD
 * @returns {{ start: string, end: string, payrollMonth: string }} - Période calculée
 */
function calculatePeriod(cutoffDay, targetDate) {
  const date = new Date(targetDate);
  const day = date.getDate();
  const month = date.getMonth(); // 0-indexed
  const year = date.getFullYear();

  let periodStart, periodEnd, payrollMonth, payrollYear;

  if (day > cutoffDay) {
    // Après le jour de coupure: période pour le mois suivant
    // Ex: 26 janvier avec cutoff 18 = période 19 jan au 18 fév = paie février
    periodStart = new Date(year, month, cutoffDay + 1);
    periodEnd = new Date(year, month + 1, cutoffDay);
    payrollYear = month === 11 ? year + 1 : year;
    payrollMonth = month + 2; // +1 pour 1-indexed, +1 pour mois suivant
    if (payrollMonth > 12) payrollMonth = 1;
  } else {
    // Avant ou sur le jour de coupure: période pour le mois courant
    // Ex: 15 janvier avec cutoff 18 = période 19 déc au 18 jan = paie janvier
    periodStart = new Date(year, month - 1, cutoffDay + 1);
    periodEnd = new Date(year, month, cutoffDay);
    payrollYear = year;
    payrollMonth = month + 1; // +1 pour 1-indexed
    if (payrollMonth === 0) {
      payrollMonth = 12;
      payrollYear = year - 1;
    }
  }

  // Formater les dates en YYYY-MM-DD
  const formatDate = (d) => d.toISOString().split('T')[0];

  return {
    start: formatDate(periodStart),
    end: formatDate(periodEnd),
    payrollMonth: `${payrollYear}-${String(payrollMonth).padStart(2, '0')}`
  };
}

/**
 * Calcule la prime d'assistante pour un employé et une date donnée
 *
 * GET /api/hr/assistant-bonus/calculate
 * Params: employee_id (required), date (optional, default: today)
 *
 * Retourne:
 * - inscriptions: liste des inscriptions du jour avec primes
 * - prime_journaliere: somme des primes du jour
 * - total_periode: nombre total d'inscriptions dans la période d'objectif
 * - objectif: objectif d'inscriptions de l'employé
 * - objectif_atteint: boolean si objectif >= total_periode
 * - periode: dates de début et fin de la période d'objectif (calculée automatiquement)
 */
router.get('/calculate', async (req, res) => {
    const { employee_id, date } = req.query;

    if (!employee_id) {
      return res.status(400).json({
        success: false,
        error: 'employee_id est requis'
      });
    }

    try {
      // Récupérer les infos de l'employé (segment, objectif, jour coupure, ville directe)
      const employeeResult = await pool.query(`
        SELECT
          e.id,
          e.first_name || ' ' || e.last_name as employee_name,
          e.segment_id,
          COALESCE(e.inscription_objective, 0) as inscription_objective,
          COALESCE(e.payroll_cutoff_day, 18) as payroll_cutoff_day,
          e.ville_id,
          c.name as ville_name
        FROM hr_employees e
        LEFT JOIN cities c ON c.id = e.ville_id
        WHERE e.id = $1
      `, [employee_id]);

      if (employeeResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Employé non trouvé'
        });
      }

      const employee = employeeResult.rows[0];
      const targetDate = date || new Date().toISOString().split('T')[0];

      // VALIDATION: Avertir si ville_id est NULL
      if (!employee.ville_id && employee.segment_id) {
        console.warn(`⚠️  [PRIME WARNING] Employee ${employee_id} has NULL ville_id!`);
        console.warn(`   Segment: ${employee.segment_id}`);
        console.warn(`   This will count ALL segment cities, not just employee's city.`);
        console.warn(`   Please assign this employee to a specific city.`);
      }

      if (!employee.segment_id) {
        console.warn(`⚠️  [PRIME WARNING] Employee ${employee_id} has NULL segment_id!`);
        console.warn(`   Cannot calculate bonuses without segment assignment.`);
      }

      // Calculer la période automatiquement basée sur payroll_cutoff_day
      const periode = calculatePeriod(employee.payroll_cutoff_day, targetDate);

      // Vérifier si l'employé a un segment assigné
      if (!employee.segment_id) {
        return res.json({
          success: true,
          data: {
            date: targetDate,
            employee_id,
            employee_name: employee.employee_name,
            inscriptions: [],
            prime_journaliere: 0,
            total_periode: 0,
            objectif: employee.inscription_objective,
            objectif_atteint: employee.inscription_objective === 0,
            periode,
            payroll_cutoff_day: employee.payroll_cutoff_day,
            message: 'Aucun segment assigné à cet employé'
          }
        });
      }

      // Récupérer les inscriptions du jour matching segment ET ville de l'employé
      // IMPORTANT: Pour sessions en ligne, seuls les étudiants avec statut "livree" comptent
      const inscriptionsQuery = `
        SELECT
          se.id as enrollment_id,
          se.session_id,
          se.formation_id,
          f.title as formation_name,
          COALESCE(f.prime_assistante, 0) as prime_assistante,
          sf.titre as session_name,
          sf.session_type,
          se.delivery_status,
          s.name as segment_name,
          c.name as city_name,
          COALESCE(se.date_inscription, se.created_at)::date as enrollment_date,
          st.prenom || ' ' || st.nom as student_name
        FROM session_etudiants se
        JOIN sessions_formation sf ON sf.id = se.session_id
        JOIN formations f ON f.id = se.formation_id
        LEFT JOIN segments s ON s.id = sf.segment_id
        LEFT JOIN cities c ON c.id = sf.ville_id
        LEFT JOIN students st ON st.id = se.student_id
        WHERE sf.segment_id = $1
          AND ($2::TEXT IS NULL OR sf.ville_id = $2::TEXT)
          AND COALESCE(se.date_inscription, se.created_at)::date = $3
          AND COALESCE(f.prime_assistante, 0) > 0
          AND sf.statut != 'annulee'
          AND (sf.session_type != 'en_ligne' OR COALESCE(se.delivery_status, 'non_livree') = 'livree')
        ORDER BY se.created_at DESC
      `;

      const inscriptionsResult = await pool.query(inscriptionsQuery, [employee.segment_id, employee.ville_id, targetDate]);

      // Calculer la prime journalière
      const prime_journaliere = inscriptionsResult.rows.reduce(
        (sum, row) => sum + parseFloat(row.prime_assistante || 0),
        0
      );

      // Calculer le total d'inscriptions dans la période d'objectif (calculée automatiquement)
      // Filtre par segment ET ville de l'employé pour calcul individuel
      // Pour sessions en ligne, seuls les étudiants avec statut "livree" comptent
      // Utilise date_inscription si disponible, sinon created_at
      const periodQuery = `
        SELECT COUNT(DISTINCT se.student_id) as count
        FROM session_etudiants se
        JOIN sessions_formation sf ON sf.id = se.session_id
        WHERE sf.segment_id = $1
          AND ($2::TEXT IS NULL OR sf.ville_id = $2::TEXT)
          AND COALESCE(se.date_inscription, se.created_at)::date >= $3
          AND COALESCE(se.date_inscription, se.created_at)::date <= $4
          AND sf.statut != 'annulee'
          AND (sf.session_type != 'en_ligne' OR COALESCE(se.delivery_status, 'non_livree') = 'livree')
      `;

      const periodResult = await pool.query(periodQuery, [
        employee.segment_id,
        employee.ville_id,
        periode.start,
        periode.end
      ]);
      const total_periode = parseInt(periodResult.rows[0].count);

      // Déterminer si l'objectif est atteint
      const objectif_atteint = total_periode >= employee.inscription_objective;

      res.json({
        success: true,
        data: {
          date: targetDate,
          employee_id,
          employee_name: employee.employee_name,
          segment_id: employee.segment_id,
          inscriptions: inscriptionsResult.rows,
          inscriptions_count: inscriptionsResult.rows.length,
          prime_journaliere,
          total_periode,
          objectif: employee.inscription_objective,
          objectif_atteint,
          periode,
          payroll_cutoff_day: employee.payroll_cutoff_day
        }
      });

    } catch (error) {
      console.error('Error calculating assistant bonus:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Récupère les primes d'une période pour un employé
 *
 * GET /api/hr/assistant-bonus/period
 * Params: employee_id, start_date, end_date
 */
router.get('/period', async (req, res) => {
    const { employee_id, start_date, end_date } = req.query;

    if (!employee_id || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'employee_id, start_date et end_date sont requis'
      });
    }

    try {
      // Récupérer les infos de l'employé + sa ville directe
      const employeeResult = await pool.query(`
        SELECT
          e.id,
          e.first_name || ' ' || e.last_name as employee_name,
          e.segment_id,
          COALESCE(e.inscription_objective, 0) as inscription_objective,
          COALESCE(e.payroll_cutoff_day, 18) as payroll_cutoff_day,
          e.ville_id,
          c.name as ville_name
        FROM hr_employees e
        LEFT JOIN cities c ON c.id = e.ville_id
        WHERE e.id = $1
      `, [employee_id]);

      if (employeeResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Employé non trouvé'
        });
      }

      const employee = employeeResult.rows[0];

      // VALIDATION: Avertir si ville_id est NULL
      if (!employee.ville_id && employee.segment_id) {
        console.warn(`⚠️  [PRIME WARNING] Employee ${employee_id} has NULL ville_id!`);
        console.warn(`   Segment: ${employee.segment_id}`);
        console.warn(`   This will count ALL segment cities, not just employee's city.`);
        console.warn(`   Please assign this employee to a specific city.`);
      }

      if (!employee.segment_id) {
        console.warn(`⚠️  [PRIME WARNING] Employee ${employee_id} has NULL segment_id!`);
        console.warn(`   Cannot calculate bonuses without segment assignment.`);
      }

      // Calculer la période automatique pour la fin de la période demandée
      const periode = calculatePeriod(employee.payroll_cutoff_day, end_date);

      if (!employee.segment_id) {
        return res.json({
          success: true,
          data: {
            employee_id,
            employee_name: employee.employee_name,
            daily_bonuses: [],
            total_prime: 0,
            total_inscriptions: 0,
            objectif: employee.inscription_objective,
            objectif_atteint: false,
            periode
          }
        });
      }

      // Récupérer les primes par jour dans la période
      // Filtre par segment ET ville de l'employé pour calcul individuel
      // Pour sessions en ligne, seuls les étudiants avec statut "livree" comptent
      // Utilise date_inscription si disponible, sinon created_at
      const query = `
        SELECT
          COALESCE(se.date_inscription, se.created_at)::date as date,
          COUNT(*) as inscriptions_count,
          SUM(COALESCE(f.prime_assistante, 0)) as prime_journaliere
        FROM session_etudiants se
        JOIN sessions_formation sf ON sf.id = se.session_id
        JOIN formations f ON f.id = se.formation_id
        WHERE sf.segment_id = $1
          AND ($2::TEXT IS NULL OR sf.ville_id = $2::TEXT)
          AND COALESCE(se.date_inscription, se.created_at)::date >= $3
          AND COALESCE(se.date_inscription, se.created_at)::date <= $4
          AND COALESCE(f.prime_assistante, 0) > 0
          AND sf.statut != 'annulee'
          AND (sf.session_type != 'en_ligne' OR COALESCE(se.delivery_status, 'non_livree') = 'livree')
        GROUP BY COALESCE(se.date_inscription, se.created_at)::date
        ORDER BY date
      `;

      const dailyResult = await pool.query(query, [employee.segment_id, employee.ville_id, start_date, end_date]);

      // Calculer les totaux
      const total_prime = dailyResult.rows.reduce(
        (sum, row) => sum + parseFloat(row.prime_journaliere || 0),
        0
      );
      const total_inscriptions = dailyResult.rows.reduce(
        (sum, row) => sum + parseInt(row.inscriptions_count || 0),
        0
      );

      // Calculer l'objectif atteint basé sur la période automatique
      // Filtre par segment ET ville de l'employé pour calcul individuel
      // Pour sessions en ligne, seuls les étudiants avec statut "livree" comptent
      // Utilise date_inscription si disponible, sinon created_at
      let objectif_atteint = employee.inscription_objective === 0;
      if (employee.inscription_objective > 0) {
        const periodQuery = `
          SELECT COUNT(*) as count
          FROM session_etudiants se
          JOIN sessions_formation sf ON sf.id = se.session_id
          WHERE sf.segment_id = $1
            AND ($2::TEXT IS NULL OR sf.ville_id = $2::TEXT)
            AND COALESCE(se.date_inscription, se.created_at)::date >= $3
            AND COALESCE(se.date_inscription, se.created_at)::date <= $4
            AND (sf.session_type != 'en_ligne' OR COALESCE(se.delivery_status, 'non_livree') = 'livree')
        `;

        const periodResult = await pool.query(periodQuery, [
          employee.segment_id,
          employee.ville_id,
          periode.start,
          periode.end
        ]);
        const total_periode = parseInt(periodResult.rows[0].count);
        objectif_atteint = total_periode >= employee.inscription_objective;
      }

      res.json({
        success: true,
        data: {
          employee_id,
          employee_name: employee.employee_name,
          start_date,
          end_date,
          daily_bonuses: dailyResult.rows,
          total_prime,
          total_inscriptions,
          objectif: employee.inscription_objective,
          objectif_atteint,
          periode,
          payroll_cutoff_day: employee.payroll_cutoff_day
        }
      });

    } catch (error) {
      console.error('Error fetching period bonuses:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * Récupère le résumé des primes pour plusieurs employés (batch)
 *
 * POST /api/hr/assistant-bonus/batch
 * Body: { employee_ids: [], date }
 */
router.post('/batch', async (req, res) => {
    const { employee_ids, date } = req.body;

    if (!employee_ids || !Array.isArray(employee_ids) || employee_ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'employee_ids array est requis'
      });
    }

    const targetDate = date || new Date().toISOString().split('T')[0];

    try {
      const results = {};

      for (const employee_id of employee_ids) {
        // Récupérer les infos de l'employé + sa ville directe
        const employeeResult = await pool.query(`
          SELECT
            e.id,
            e.segment_id,
            COALESCE(e.inscription_objective, 0) as inscription_objective,
            COALESCE(e.payroll_cutoff_day, 18) as payroll_cutoff_day,
            e.ville_id,
            c.name as ville_name
          FROM hr_employees e
          LEFT JOIN cities c ON c.id = e.ville_id
          WHERE e.id = $1
        `, [employee_id]);

        if (employeeResult.rows.length === 0) {
          results[employee_id] = { prime_journaliere: 0, objectif_atteint: false };
          continue;
        }

        const employee = employeeResult.rows[0];

        // VALIDATION: Avertir si ville_id est NULL
        if (!employee.ville_id && employee.segment_id) {
          console.warn(`⚠️  [PRIME WARNING] Employee ${employee_id} has NULL ville_id!`);
          console.warn(`   Segment: ${employee.segment_id}`);
          console.warn(`   This will count ALL segment cities, not just employee's city.`);
          console.warn(`   Please assign this employee to a specific city.`);
        }

        if (!employee.segment_id) {
          console.warn(`⚠️  [PRIME WARNING] Employee ${employee_id} has NULL segment_id!`);
          console.warn(`   Cannot calculate bonuses without segment assignment.`);
        }

        // Calculer la période automatiquement
        const periode = calculatePeriod(employee.payroll_cutoff_day, targetDate);

        if (!employee.segment_id) {
          results[employee_id] = { prime_journaliere: 0, objectif_atteint: employee.inscription_objective === 0 };
          continue;
        }

        // Calculer la prime du jour
        // Pour sessions en ligne, seuls les étudiants avec statut "livree" comptent
        // Utilise date_inscription si disponible, sinon created_at
        const primeQuery = `
          SELECT COALESCE(SUM(f.prime_assistante), 0) as prime_journaliere
          FROM session_etudiants se
          JOIN sessions_formation sf ON sf.id = se.session_id
          JOIN formations f ON f.id = se.formation_id
          WHERE sf.segment_id = $1
            AND ($2::TEXT IS NULL OR sf.ville_id = $2::TEXT)
            AND COALESCE(se.date_inscription, se.created_at)::date = $3
            AND COALESCE(f.prime_assistante, 0) > 0
            AND sf.statut != 'annulee'
            AND (sf.session_type != 'en_ligne' OR COALESCE(se.delivery_status, 'non_livree') = 'livree')
        `;

        const primeResult = await pool.query(primeQuery, [employee.segment_id, employee.ville_id, targetDate]);
        const prime_journaliere = parseFloat(primeResult.rows[0].prime_journaliere || 0);

        // Debug logging - requête diagnostic pour comprendre pourquoi prime = 0
        const debugQuery = `
          SELECT
            COUNT(*) as total_inscriptions,
            COUNT(CASE WHEN f.prime_assistante IS NOT NULL AND f.prime_assistante > 0 THEN 1 END) as inscriptions_avec_prime,
            SUM(COALESCE(f.prime_assistante, 0)) as total_prime
          FROM session_etudiants se
          JOIN sessions_formation sf ON sf.id = se.session_id
          LEFT JOIN formations f ON f.id = se.formation_id
          WHERE sf.segment_id = $1
            AND COALESCE(se.date_inscription, se.created_at)::date = $2
            AND sf.statut != 'annulee'
        `;
        const debugResult = await pool.query(debugQuery, [employee.segment_id, targetDate]);

        console.log(`[DEBUG] Employee ${employee_id} - Date ${targetDate}:`);
        console.log(`  segment_id: ${employee.segment_id}`);
        console.log(`  ville_id: ${employee.ville_id || 'NULL'}`);
        console.log(`  ville_name: ${employee.ville_name || 'NULL'}`);
        console.log(`  total_inscriptions: ${debugResult.rows[0].total_inscriptions}`);
        console.log(`  inscriptions_avec_prime: ${debugResult.rows[0].inscriptions_avec_prime}`);
        console.log(`  total_prime: ${debugResult.rows[0].total_prime}`);
        console.log(`  prime_journaliere (retourné): ${prime_journaliere}`);

        // Vérifier l'objectif basé sur la période automatique
        // Pour sessions en ligne, seuls les étudiants avec statut "livree" comptent
        // Utilise date_inscription si disponible, sinon created_at
        let objectif_atteint = employee.inscription_objective === 0;
        let total_periode = 0;

        if (employee.inscription_objective > 0) {
          const periodQuery = `
            SELECT COUNT(DISTINCT se.student_id) as count
            FROM session_etudiants se
            JOIN sessions_formation sf ON sf.id = se.session_id
            WHERE sf.segment_id = $1
              AND ($2::TEXT IS NULL OR sf.ville_id = $2::TEXT)
              AND COALESCE(se.date_inscription, se.created_at)::date >= $3
              AND COALESCE(se.date_inscription, se.created_at)::date <= $4
              AND sf.statut != 'annulee'
              AND (sf.session_type != 'en_ligne' OR COALESCE(se.delivery_status, 'non_livree') = 'livree')
          `;

          const periodResult = await pool.query(periodQuery, [
            employee.segment_id,
            employee.ville_id,
            periode.start,
            periode.end
          ]);
          total_periode = parseInt(periodResult.rows[0].count);
          objectif_atteint = total_periode >= employee.inscription_objective;
          console.log(`[DEBUG] Objectif check:`);
          console.log(`  total_periode: ${total_periode}`);
          console.log(`  inscription_objective: ${employee.inscription_objective}`);
          console.log(`  objectif_atteint: ${objectif_atteint}`);
        }

        results[employee_id] = {
          prime_journaliere,
          objectif_atteint,
          objectif: employee.inscription_objective,
          total_periode,
          periode
        };
      }

      res.json({
        success: true,
        data: results,
        date: targetDate
      });

    } catch (error) {
      console.error('Error batch calculating bonuses:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

export default router;
