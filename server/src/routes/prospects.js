/**
 * Routes Prospects - Gestion complète des prospects
 * Normalisation internationale, affectation automatique, qualification, nettoyage
 */

import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { injectUserScope, buildScopeFilter, requireRecordScope } from '../middleware/requireScope.js';
import { normalizePhoneInternational } from '../utils/phone-validator.js';
import { reassignIfOutOfScope } from '../utils/prospect-assignment.js';
import { handleDuplicateOrReinject, reinjectProspect } from '../utils/prospect-reinject.js';
import { runCleaningBatch, deleteMarkedProspects, getProspectsToDelete, getCleaningStats } from '../utils/prospect-cleaner.js';
import { googleContactsService } from '../services/googleContactsService.js';
import { calculateWorkingDays } from '../utils/working-days-calculator.js';

const router = express.Router();

// ============================================================
// Fonction pour générer un ID prospect unique de 8 chiffres
// ============================================================
async function generateUniqueProspectId() {
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    // Générer un nombre aléatoire de 8 chiffres (10000000 - 99999999)
    const prospectId = Math.floor(10000000 + Math.random() * 90000000).toString();

    // Vérifier si l'ID existe déjà
    const { rows } = await pool.query('SELECT id FROM prospects WHERE id = $1', [prospectId]);

    if (rows.length === 0) {
      return prospectId;
    }

    attempts++;
  }

  // En dernier recours, utiliser timestamp + random pour garantir l'unicité
  return Date.now().toString().slice(-8);
}

// ============================================================
// GET /api/prospects/country-codes - Liste des pays supportés
// IMPORTANT: Doit être AVANT les routes /:id pour éviter conflits
// ============================================================
router.get('/country-codes',
  authenticateToken,
  async (req, res) => {
    try {
      const query = `
        SELECT country_code, country, expected_national_length, region
        FROM country_phone_config
        ORDER BY region, country
      `;

      const { rows } = await pool.query(query);
      res.json(rows);
    } catch (error) {
      console.error('Error fetching country codes:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// GET /api/prospects/cleaning/stats - Stats de nettoyage
// IMPORTANT: Doit être AVANT les routes /:id pour éviter conflits
// ============================================================
router.get('/cleaning/stats',
  requirePermission('commercialisation.prospects.clean'),
  async (req, res) => {
    try {
      const stats = await getCleaningStats();
      res.json(stats);
    } catch (error) {
      console.error('Error fetching cleaning stats:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// GET /api/prospects/cleaning/to-delete - Prospects à supprimer
// IMPORTANT: Doit être AVANT les routes /:id pour éviter conflits
// ============================================================
router.get('/cleaning/to-delete',
  requirePermission('commercialisation.prospects.clean'),
  async (req, res) => {
    try {
      const { limit = 100, offset = 0 } = req.query;
      const prospects = await getProspectsToDelete(parseInt(limit, 10), parseInt(offset, 10));
      res.json(prospects);
    } catch (error) {
      console.error('Error fetching prospects to delete:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// GET /api/prospects - Liste des prospects avec filtres
// ============================================================
router.get('/',
  requirePermission('commercialisation.prospects.view_page'),
  injectUserScope,
  async (req, res) => {
    try {
      const {
        segment_id,
        ville_id,
        statut_contact,
        assigned_to,
        decision_nettoyage,
        country_code,
        search,
        date_from,
        date_to,
        page = 1,
        limit = 50
      } = req.query;

      let query = `
        SELECT
          p.*,
          s.name as segment_name,
          c.name as ville_name,
          prof.full_name as assigned_to_name,
          creator.full_name as created_by_name,
          COALESCE(calls.total_duration, 0) as total_call_duration,
          (
            SELECT STRING_AGG(pr.full_name, ', ' ORDER BY pr.full_name)
            FROM professor_cities pc2
            JOIN profiles pr ON pr.id = pc2.professor_id
            JOIN roles r ON pr.role_id = r.id
            WHERE pc2.city_id = p.ville_id
              AND (r.name ILIKE '%assistante%' OR r.name = 'assistante')
          ) as assistantes_ville
        FROM prospects p
        LEFT JOIN segments s ON s.id = p.segment_id
        LEFT JOIN cities c ON c.id = p.ville_id
        LEFT JOIN profiles prof ON prof.id = p.assigned_to
        LEFT JOIN profiles creator ON creator.id = p.created_by
        LEFT JOIN (
          SELECT prospect_id, SUM(duration_seconds) as total_duration
          FROM prospect_call_history
          WHERE duration_seconds IS NOT NULL
          GROUP BY prospect_id
        ) calls ON calls.prospect_id = p.id
        WHERE 1=1
      `;

      const params = [];
      let paramIndex = 1;

      // SCOPE FILTERING: Filtre automatique par segment ET ville (sauf admin)
      const scopeFilter = buildScopeFilter(req, 'p.segment_id', 'p.ville_id');
      if (scopeFilter.hasScope) {
        const adjustedScopeConditions = scopeFilter.conditions.map(condition => {
          return condition.replace(/\$(\d+)/g, (match, num) => {
            return `$${params.length + parseInt(num)}`;
          });
        });
        query += ` AND (${adjustedScopeConditions.join(' AND ')})`;
        params.push(...scopeFilter.params);
        paramIndex += scopeFilter.params.length;
      }

      // Filtres additionnels
      if (segment_id) {
        query += ` AND p.segment_id = $${paramIndex++}`;
        params.push(segment_id);
      }
      if (ville_id) {
        query += ` AND p.ville_id = $${paramIndex++}`;
        params.push(ville_id);
      }
      if (statut_contact) {
        query += ` AND p.statut_contact = $${paramIndex++}`;
        params.push(statut_contact);
      }
      if (assigned_to) {
        query += ` AND p.assigned_to = $${paramIndex++}`;
        params.push(assigned_to);
      }
      if (decision_nettoyage) {
        query += ` AND p.decision_nettoyage = $${paramIndex++}`;
        params.push(decision_nettoyage);
      }
      if (country_code) {
        query += ` AND p.country_code = $${paramIndex++}`;
        params.push(country_code);
      }
      if (date_from) {
        query += ` AND DATE(p.date_injection) >= $${paramIndex++}`;
        params.push(date_from);
      }
      if (date_to) {
        query += ` AND DATE(p.date_injection) <= $${paramIndex++}`;
        params.push(date_to);
      }
      if (search) {
        query += ` AND (p.phone_international LIKE $${paramIndex} OR p.phone_raw LIKE $${paramIndex} OR p.nom ILIKE $${paramIndex} OR p.prenom ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Tri par date_injection DESC (réinjections en premier)
      query += ` ORDER BY p.date_injection DESC`;

      // Pagination
      const offset = (page - 1) * limit;
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const { rows } = await pool.query(query, params);

      // Stats prospects
      let statsQuery = `
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE statut_contact = 'non contacté') as non_contactes,
          COUNT(*) FILTER (WHERE statut_contact = 'contacté avec rdv') as avec_rdv,
          COUNT(*) FILTER (WHERE statut_contact = 'contacté sans rdv') as sans_rdv,
          COUNT(*) FILTER (WHERE statut_contact = 'inscrit') as inscrits_prospect
        FROM prospects p
        WHERE 1=1
      `;

      if (scopeFilter.hasScope) {
        const adjustedScopeConditions = scopeFilter.conditions.map(condition => {
          return condition.replace(/\$(\d+)/g, (match, num) => {
            return `$${parseInt(num)}`;
          });
        });
        statsQuery += ` AND (${adjustedScopeConditions.join(' AND ')})`;
      }

      // Ajouter les filtres de date aux statistiques
      let statsParams = [...scopeFilter.params];
      let statsParamIndex = scopeFilter.params.length + 1;

      if (date_from) {
        statsQuery += ` AND DATE(p.date_injection) >= $${statsParamIndex++}`;
        statsParams.push(date_from);
      }
      if (date_to) {
        statsQuery += ` AND DATE(p.date_injection) <= $${statsParamIndex++}`;
        statsParams.push(date_to);
      }

      const statsResult = await pool.query(statsQuery, statsParams);

      // Requete pour inscrits_session - utiliser les tables francaises (sessions_formation + session_etudiants)
      // Requête avec COUNT conditionnel pour obtenir total, livrée et non_livrée
      let inscritsSessionQuery = `
        SELECT
          COUNT(DISTINCT se.student_id) as total,
          COUNT(DISTINCT CASE WHEN se.delivery_status = 'livree' THEN se.student_id END) as livree,
          COUNT(DISTINCT CASE WHEN se.delivery_status = 'non_livree' THEN se.student_id END) as non_livree
        FROM session_etudiants se
        JOIN sessions_formation sf ON sf.id = se.session_id
        WHERE sf.statut != 'annulee'
      `;

      // Utiliser buildScopeFilter avec les colonnes francaises
      const sessionScopeFilter = buildScopeFilter(req, 'sf.segment_id', 'sf.ville_id');
      if (sessionScopeFilter.hasScope) {
        inscritsSessionQuery += ` AND (${sessionScopeFilter.conditions.join(' AND ')})`;
      }

      // Ajouter les filtres de date pour les inscriptions en session
      let sessionParams = [...sessionScopeFilter.params];
      let sessionParamIndex = sessionScopeFilter.params.length + 1;

      if (date_from) {
        inscritsSessionQuery += ` AND se.date_inscription >= $${sessionParamIndex++}`;
        sessionParams.push(date_from);
      }
      if (date_to) {
        inscritsSessionQuery += ` AND se.date_inscription <= $${sessionParamIndex++}`;
        sessionParams.push(date_to);
      }

      const inscritsSessionResult = await pool.query(inscritsSessionQuery, sessionParams);

      // =====================================================
      // CALCUL TAUX DE CONVERSION
      // =====================================================
      console.log('📊 [PROSPECTS] Calculating taux de conversion...');

      // Requête pour compter les appels avec durée >= 30 secondes
      let appelsQuery = `
        SELECT COUNT(DISTINCT pch.prospect_id) as appels_30s_count
        FROM prospect_call_history pch
        INNER JOIN prospects p ON p.id = pch.prospect_id
        WHERE pch.duration_seconds >= 30
      `;
      let appelsParams = [];
      let appelsParamIndex = 1;

      // Appliquer le scope utilisateur
      const appelsScopeFilter = buildScopeFilter(req, 'p.segment_id', 'p.ville_id');
      if (appelsScopeFilter.hasScope) {
        appelsQuery += ` AND (${appelsScopeFilter.conditions.join(' AND ')})`;
        appelsParams.push(...appelsScopeFilter.params);
        appelsParamIndex += appelsScopeFilter.params.length;
      }

      // Filtres UI
      if (segment_id) {
        appelsQuery += ` AND p.segment_id = $${appelsParamIndex++}`;
        appelsParams.push(segment_id);
      }
      if (ville_id) {
        appelsQuery += ` AND p.ville_id = $${appelsParamIndex++}`;
        appelsParams.push(ville_id);
      }
      if (date_from) {
        appelsQuery += ` AND pch.call_start >= $${appelsParamIndex++}`;
        appelsParams.push(date_from);
      }
      if (date_to) {
        appelsQuery += ` AND pch.call_start <= $${appelsParamIndex++}`;
        appelsParams.push(date_to);
      }

      console.log('📊 [PROSPECTS] Appels query:', appelsQuery.replace(/\s+/g, ' ').trim());
      console.log('📊 [PROSPECTS] Appels params:', appelsParams);

      const appelsResult = await pool.query(appelsQuery, appelsParams);

      // Extraire les données de session
      const inscritsSessionData = inscritsSessionResult.rows[0];
      const inscritsSession = parseInt(inscritsSessionData.total || 0);
      const inscritsSessionLivree = parseInt(inscritsSessionData.livree || 0);
      const appels30sCount = parseInt(appelsResult.rows[0].appels_30s_count || 0);
      const tauxConversion = appels30sCount > 0
        ? parseFloat(((inscritsSession / appels30sCount) * 100).toFixed(2))
        : 0;

      console.log('📊 [PROSPECTS] Taux conversion:', {
        inscritsSession,
        appels30sCount,
        tauxConversion: `${tauxConversion}%`
      });

      // =====================================================
      // CALCUL ÉCART D'INSCRIPTION
      // =====================================================

      // 1. Récupérer l'objectif de l'utilisateur connecté
      const employeeResult = await pool.query(`
        SELECT inscription_objective
        FROM hr_employees
        WHERE profile_id = $1
        LIMIT 1
      `, [req.user.id]);

      const inscriptionObjective = employeeResult.rows[0]?.inscription_objective || 0;

      // 2. Déterminer la période à utiliser
      let periodStart, periodEnd;

      if (date_from && date_to) {
        // Utiliser la période du filtre
        periodStart = date_from;
        periodEnd = date_to;
      } else {
        // Calculer la période de paie actuelle (19→18)
        const today = new Date();
        const currentDay = today.getDate();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        if (currentDay <= 18) {
          // Période: 19 du mois dernier au 18 de ce mois
          periodEnd = new Date(currentYear, currentMonth, 18);
          periodStart = new Date(currentYear, currentMonth - 1, 19);
        } else {
          // Période: 19 de ce mois au 18 du mois prochain
          periodStart = new Date(currentYear, currentMonth, 19);
          periodEnd = new Date(currentYear, currentMonth + 1, 18);
        }

        // Formater en YYYY-MM-DD
        periodStart = periodStart.toISOString().split('T')[0];
        periodEnd = periodEnd.toISOString().split('T')[0];
      }

      // 3. Récupérer les jours fériés dans la période
      let inscriptionGap = null;
      let expectedInscriptions = null;
      let dailyObjective = null;
      let totalWorkingDays = 0;
      let elapsedWorkingDays = 0;

      try {
        const holidaysResult = await pool.query(`
          SELECT holiday_date
          FROM hr_public_holidays
          WHERE holiday_date >= $1 AND holiday_date <= $2
          ORDER BY holiday_date
        `, [periodStart, periodEnd]);

        const publicHolidays = holidaysResult.rows.map(row => new Date(row.holiday_date));

        // 4. Calculer le total de jours ouvrables dans la période
        totalWorkingDays = calculateWorkingDays(
          new Date(periodStart),
          new Date(periodEnd),
          publicHolidays
        );

        // 5. Calculer les jours ouvrables écoulés jusqu'à aujourd'hui
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        // Ne compter que jusqu'à aujourd'hui (ou fin de période si avant aujourd'hui)
        const elapsedEndDate = todayStr < periodEnd ? todayStr : periodEnd;

        // Ne calculer que si on est dans la période ou après
        if (todayStr >= periodStart) {
          elapsedWorkingDays = calculateWorkingDays(
            new Date(periodStart),
            new Date(elapsedEndDate),
            publicHolidays
          );
        }

        // 6. Calculer l'écart d'inscription
        if (inscriptionObjective > 0 && totalWorkingDays > 0) {
          dailyObjective = inscriptionObjective / totalWorkingDays;
          expectedInscriptions = Math.round(elapsedWorkingDays * dailyObjective);

          // Écart = réel (livrés uniquement) - attendu
          inscriptionGap = inscritsSessionLivree - expectedInscriptions;
        }

        console.log('📊 [PROSPECTS] Écart inscription:', {
          inscriptionObjective,
          periodStart,
          periodEnd,
          totalWorkingDays,
          elapsedWorkingDays,
          dailyObjective: dailyObjective ? dailyObjective.toFixed(2) : null,
          expectedInscriptions,
          inscritsSession,
          inscritsSessionLivree,
          inscriptionGap
        });

      } catch (error) {
        console.error('Erreur lors du calcul de l\'écart d\'inscription:', error);
        // Ne pas bloquer la requête si le calcul échoue
      }

      res.json({
        prospects: rows,
        stats: {
          ...statsResult.rows[0],
          inscrits_session: inscritsSession,
          inscrits_session_livree: inscritsSessionLivree,
          inscrits_session_non_livree: parseInt(inscritsSessionData.non_livree) || 0,
          appels_30s_count: appels30sCount,
          taux_conversion: tauxConversion,
          // NOUVEAUX CHAMPS pour l'écart d'inscription
          inscription_objective: inscriptionObjective,
          inscription_gap: inscriptionGap,
          expected_inscriptions: expectedInscriptions,
          total_working_days: totalWorkingDays,
          elapsed_working_days: elapsedWorkingDays,
          daily_objective: dailyObjective ? parseFloat(dailyObjective.toFixed(2)) : null,
          period_start: periodStart,
          period_end: periodEnd
        },
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total: parseInt(statsResult.rows[0].total, 10)
        }
      });
    } catch (error) {
      console.error('Error fetching prospects:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// GET /api/prospects/stats-detailed - Statistiques détaillées pour dashboard
// IMPORTANT: Cette route DOIT être avant /:id pour éviter les conflits de routing
// ============================================================
router.get('/stats-detailed',
  requirePermission('commercialisation.prospects.view_page'),
  injectUserScope,
  async (req, res) => {
    try {
      const { segment_id, ville_id, date_from, date_to } = req.query;

      // Build scope filter for user permissions
      const scopeFilter = buildScopeFilter(req, 'p.segment_id', 'p.ville_id');

      // =====================================================
      // 1. COMPTEURS PAR STATUT
      // =====================================================
      let byStatusQuery = `
        SELECT
          statut_contact,
          COUNT(*) as count
        FROM prospects p
        WHERE 1=1
      `;

      let params = [];
      let paramIndex = 1;

      if (scopeFilter.hasScope) {
        const adjustedConditions = scopeFilter.conditions.map(c =>
          c.replace(/\$(\d+)/g, (_, n) => `$${parseInt(n)}`)
        );
        byStatusQuery += ` AND (${adjustedConditions.join(' AND ')})`;
        params.push(...scopeFilter.params);
        paramIndex += scopeFilter.params.length;
      }

      if (segment_id) {
        byStatusQuery += ` AND p.segment_id = $${paramIndex++}`;
        params.push(segment_id);
      }
      if (ville_id) {
        byStatusQuery += ` AND p.ville_id = $${paramIndex++}`;
        params.push(ville_id);
      }
      if (date_from) {
        byStatusQuery += ` AND p.date_injection >= $${paramIndex++}`;
        params.push(date_from);
      }
      if (date_to) {
        byStatusQuery += ` AND p.date_injection <= $${paramIndex++}`;
        params.push(date_to);
      }

      byStatusQuery += ` GROUP BY statut_contact ORDER BY count DESC`;

      const byStatusResult = await pool.query(byStatusQuery, params);

      // Convert to object
      const byStatus = {};
      let total = 0;
      byStatusResult.rows.forEach(row => {
        byStatus[row.statut_contact || 'inconnu'] = parseInt(row.count);
        total += parseInt(row.count);
      });

      // =====================================================
      // 2. CALCULS DES TAUX
      // =====================================================
      const nonContactes = byStatus['non contacté'] || 0;
      const avecRdv = byStatus['contacté avec rdv'] || 0;
      const sansRdv = byStatus['contacté sans rdv'] || 0;
      const inscrits = byStatus['inscrit'] || 0;
      const contactes = total - nonContactes;

      // Get inscrits session count
      let sessionQuery = `
        SELECT COUNT(DISTINCT se.student_id) as inscrits_session
        FROM session_etudiants se
        JOIN sessions_formation sf ON sf.id = se.session_id
        WHERE sf.statut != 'annulee'
      `;

      const sessionScopeFilter = buildScopeFilter(req, 'sf.segment_id', 'sf.ville_id');
      let sessionParams = [];
      let sessionParamIndex = 1;

      if (sessionScopeFilter.hasScope) {
        sessionQuery += ` AND (${sessionScopeFilter.conditions.join(' AND ')})`;
        sessionParams.push(...sessionScopeFilter.params);
        sessionParamIndex += sessionScopeFilter.params.length;
      }

      if (date_from) {
        sessionQuery += ` AND se.date_inscription >= $${sessionParamIndex++}`;
        sessionParams.push(date_from);
      }
      if (date_to) {
        sessionQuery += ` AND se.date_inscription <= $${sessionParamIndex++}`;
        sessionParams.push(date_to);
      }

      const sessionResult = await pool.query(sessionQuery, sessionParams);
      const inscritsSession = parseInt(sessionResult.rows[0]?.inscrits_session || 0);

      // Get appels 30s count
      let appelsQuery = `
        SELECT COUNT(DISTINCT pch.prospect_id) as appels_30s
        FROM prospect_call_history pch
        INNER JOIN prospects p ON p.id = pch.prospect_id
        WHERE pch.duration_seconds >= 30
      `;

      const appelsScopeFilter = buildScopeFilter(req, 'p.segment_id', 'p.ville_id');
      let appelsParams = [];
      let appelsParamIndex = 1;

      if (appelsScopeFilter.hasScope) {
        appelsQuery += ` AND (${appelsScopeFilter.conditions.join(' AND ')})`;
        appelsParams.push(...appelsScopeFilter.params);
        appelsParamIndex += appelsScopeFilter.params.length;
      }

      if (date_from) {
        appelsQuery += ` AND pch.call_start >= $${appelsParamIndex++}`;
        appelsParams.push(date_from);
      }
      if (date_to) {
        appelsQuery += ` AND pch.call_start <= $${appelsParamIndex++}`;
        appelsParams.push(date_to);
      }

      const appelsResult = await pool.query(appelsQuery, appelsParams);
      const appels30s = parseInt(appelsResult.rows[0]?.appels_30s || 0);

      // Calculate rates
      const rates = {
        contact_rate: total > 0 ? parseFloat(((contactes / total) * 100).toFixed(1)) : 0,
        rdv_rate: contactes > 0 ? parseFloat(((avecRdv / contactes) * 100).toFixed(1)) : 0,
        show_up_rate: avecRdv > 0 ? parseFloat(((inscritsSession / avecRdv) * 100).toFixed(1)) : 0,
        conversion_rate_calls: appels30s > 0 ? parseFloat(((inscritsSession / appels30s) * 100).toFixed(1)) : 0,
        conversion_rate_global: total > 0 ? parseFloat(((inscrits / total) * 100).toFixed(1)) : 0
      };

      // =====================================================
      // 3. GÉNÉRATION DES RECOMMANDATIONS ALGORITHMIQUES
      // =====================================================
      const recommendations = [];

      // Taux de contact < 80%
      if (rates.contact_rate < 80 && nonContactes > 0) {
        recommendations.push({
          priority: rates.contact_rate < 50 ? 'urgent' : 'high',
          title: `Contacter ${nonContactes} prospects en attente`,
          description: `${nonContactes} prospects n'ont pas encore été contactés. Augmenter l'activité d'appels.`,
          context: `Taux de contact actuel: ${rates.contact_rate}% (cible: 80%)`,
          expectedImpact: `+${Math.ceil(nonContactes * 0.05)} inscriptions potentielles`,
          responsable: 'Assistante commerciale',
          timeframe: 'Cette semaine',
          kpiToTrack: 'Taux de contact'
        });
      }

      // Taux de RDV < 25%
      if (rates.rdv_rate < 25 && contactes > 10) {
        recommendations.push({
          priority: rates.rdv_rate < 15 ? 'urgent' : 'high',
          title: 'Améliorer l\'argumentaire téléphonique',
          description: `Seulement ${avecRdv} RDV obtenus sur ${contactes} prospects contactés. Revoir le script d'appel.`,
          context: `Taux de RDV actuel: ${rates.rdv_rate}% (cible: 25%)`,
          expectedImpact: `+${Math.ceil((contactes * 0.25 - avecRdv) * 0.3)} inscriptions potentielles`,
          responsable: 'Manager',
          timeframe: 'Cette semaine',
          kpiToTrack: 'Taux de RDV'
        });
      }

      // Taux de show-up < 60%
      if (rates.show_up_rate < 60 && avecRdv > 5) {
        const manques = avecRdv - inscritsSession;
        recommendations.push({
          priority: rates.show_up_rate < 40 ? 'urgent' : 'medium',
          title: 'Rappeler les prospects avant leur RDV',
          description: `${manques} prospects avec RDV n'ont pas finalisé l'inscription. Envoyer des rappels SMS/WhatsApp.`,
          context: `Taux de show-up actuel: ${rates.show_up_rate}% (cible: 60%)`,
          expectedImpact: `+${Math.ceil(manques * 0.3)} inscriptions potentielles`,
          responsable: 'Assistante commerciale',
          timeframe: 'Immédiat',
          kpiToTrack: 'Taux de show-up'
        });
      }

      // Conversion globale faible
      if (rates.conversion_rate_global < 5 && total > 50) {
        recommendations.push({
          priority: 'medium',
          title: 'Qualifier les prospects entrants',
          description: 'Le taux de conversion global est faible. Vérifier la qualité des sources de prospects.',
          context: `Conversion globale: ${rates.conversion_rate_global}% (cible: 5%)`,
          expectedImpact: 'Meilleure allocation des ressources',
          responsable: 'Direction',
          timeframe: 'Ce mois',
          kpiToTrack: 'Taux de conversion global'
        });
      }

      // Si tout va bien
      if (recommendations.length === 0) {
        recommendations.push({
          priority: 'success',
          title: 'Performance commerciale satisfaisante',
          description: 'Les indicateurs sont dans les cibles. Maintenir le rythme actuel.',
          context: 'Tous les taux sont au-dessus des objectifs',
          expectedImpact: 'Continuité des résultats',
          responsable: 'Équipe',
          timeframe: 'En cours',
          kpiToTrack: 'Tous les KPIs'
        });
      }

      // =====================================================
      // 4. SYNTHÈSE GLOBALE
      // =====================================================
      let status = 'bon';
      let urgentCount = recommendations.filter(r => r.priority === 'urgent').length;
      let highCount = recommendations.filter(r => r.priority === 'high').length;

      if (urgentCount >= 2) status = 'critique';
      else if (urgentCount === 1 || highCount >= 2) status = 'attention';
      else if (recommendations[0]?.priority === 'success') status = 'excellent';

      const globalAssessment = {
        status,
        summary: `Pipeline de ${total} prospects avec ${inscrits} inscrits (${rates.conversion_rate_global}%). ${urgentCount + highCount} actions prioritaires identifiées.`,
        topPriority: recommendations[0]?.title || 'Aucune action urgente',
        projection: `Projection: ${inscrits + Math.ceil(recommendations.reduce((sum, r) => {
          const match = r.expectedImpact?.match(/\+(\d+)/);
          return sum + (match ? parseInt(match[1]) : 0);
        }, 0) * 0.5)} inscriptions`,
        risk: status === 'critique' ? 'Risque de sous-performance si aucune action' : 'Risque modéré'
      };

      // =====================================================
      // 5. DONNÉES FUNNEL
      // =====================================================
      const funnelData = [
        { stage: 'Prospects', count: total, color: '#3b82f6' },
        { stage: 'Contactés', count: contactes, color: '#8b5cf6' },
        { stage: 'Avec RDV', count: avecRdv, color: '#22c55e' },
        { stage: 'Inscrits', count: inscritsSession, color: '#06b6d4' }
      ];

      res.json({
        total,
        by_status: byStatus,
        rates,
        inscrits_session: inscritsSession,
        appels_30s: appels30s,
        funnel: funnelData,
        recommendations,
        globalAssessment
      });

    } catch (error) {
      console.error('Error fetching detailed stats:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// GET /api/prospects/ecart-details - Détails de l'écart entre inscrits prospect et session
// IMPORTANT: Cette route DOIT être avant /:id pour éviter les conflits de routing
// ============================================================
router.get('/ecart-details',
  requirePermission('commercialisation.prospects.view_page'),
  injectUserScope,
  async (req, res) => {
    console.log('📊 [ECART-DETAILS] Endpoint called');
    console.log('📊 [ECART-DETAILS] Query params:', req.query);
    console.log('📊 [ECART-DETAILS] User:', req.user?.id, 'Role:', req.user?.role);
    console.log('📊 [ECART-DETAILS] UserScope:', req.userScope);
    try {
      const { segment_id, ville_id, date_from, date_to } = req.query;

      // Construire les scope filters pour appliquer les restrictions utilisateur
      const sessionScopeFilter = buildScopeFilter(req, 'sf.segment_id', 'sf.ville_id');
      const prospectScopeFilter = buildScopeFilter(req, 'p.segment_id', 'p.ville_id');

      console.log('📊 [ECART-DETAILS] Session scope:', sessionScopeFilter.hasScope ? sessionScopeFilter.conditions : 'admin (no scope)');
      console.log('📊 [ECART-DETAILS] Prospect scope:', prospectScopeFilter.hasScope ? prospectScopeFilter.conditions : 'admin (no scope)');

      // Helper pour ajuster les index des paramètres dans les conditions
      const adjustConditions = (conditions, startIndex) => {
        return conditions.map(condition => {
          return condition.replace(/\$(\d+)/g, (match, num) => {
            return `$${parseInt(num) + startIndex - 1}`;
          });
        });
      };

      // =====================================================
      // ÉCART SESSION: Étudiants en sessions SANS prospect "inscrit"
      // =====================================================
      console.log('📊 [ECART-DETAILS] Building ecart session query...');

      let ecartSessionQuery = `
        SELECT
          s.id as student_id,
          s.nom,
          s.prenom,
          s.cin,
          s.phone,
          s.whatsapp,
          json_agg(jsonb_build_object(
            'session_id', sf.id,
            'session_name', sf.titre,
            'ville_name', c.name,
            'segment_name', seg.name,
            'enrolled_at', se.date_inscription
          )) as sessions
        FROM students s
        INNER JOIN session_etudiants se ON se.student_id = s.id
        INNER JOIN sessions_formation sf ON sf.id = se.session_id
        LEFT JOIN cities c ON c.id = sf.ville_id
        LEFT JOIN segments seg ON seg.id = sf.segment_id
        WHERE sf.statut != 'annulee'
      `;
      let ecartSessionParams = [];
      let ecartSessionParamIndex = 1;

      // Appliquer le scope utilisateur aux sessions
      if (sessionScopeFilter.hasScope) {
        const adjustedConditions = adjustConditions(sessionScopeFilter.conditions, ecartSessionParamIndex);
        ecartSessionQuery += ` AND (${adjustedConditions.join(' AND ')})`;
        ecartSessionParams.push(...sessionScopeFilter.params);
        ecartSessionParamIndex += sessionScopeFilter.params.length;
      }

      // Filtres UI additionnels
      if (segment_id) {
        ecartSessionQuery += ` AND sf.segment_id = $${ecartSessionParamIndex++}`;
        ecartSessionParams.push(segment_id);
      }
      if (ville_id) {
        ecartSessionQuery += ` AND sf.ville_id = $${ecartSessionParamIndex++}`;
        ecartSessionParams.push(ville_id);
      }
      if (date_from) {
        ecartSessionQuery += ` AND se.date_inscription >= $${ecartSessionParamIndex++}`;
        ecartSessionParams.push(date_from);
      }
      if (date_to) {
        ecartSessionQuery += ` AND se.date_inscription <= $${ecartSessionParamIndex++}`;
        ecartSessionParams.push(date_to);
      }

      // NOT EXISTS pour exclure ceux qui ont un prospect "inscrit" correspondant
      let notExistsProspectScope = '';
      if (prospectScopeFilter.hasScope) {
        const adjustedConditions = adjustConditions(prospectScopeFilter.conditions, ecartSessionParamIndex);
        notExistsProspectScope = ` AND (${adjustedConditions.join(' AND ')})`;
        ecartSessionParams.push(...prospectScopeFilter.params);
        ecartSessionParamIndex += prospectScopeFilter.params.length;
      }

      let notExistsProspectFilters = '';
      if (segment_id) {
        notExistsProspectFilters += ` AND p.segment_id = $${ecartSessionParamIndex++}`;
        ecartSessionParams.push(segment_id);
      }
      if (ville_id) {
        notExistsProspectFilters += ` AND p.ville_id = $${ecartSessionParamIndex++}`;
        ecartSessionParams.push(ville_id);
      }
      if (date_from) {
        notExistsProspectFilters += ` AND p.date_injection >= $${ecartSessionParamIndex++}`;
        ecartSessionParams.push(date_from);
      }
      if (date_to) {
        notExistsProspectFilters += ` AND p.date_injection <= $${ecartSessionParamIndex++}`;
        ecartSessionParams.push(date_to);
      }

      ecartSessionQuery += `
          AND NOT EXISTS (
            SELECT 1 FROM prospects p
            WHERE (RIGHT(p.phone_international, 9) = RIGHT(s.phone, 9)
                OR RIGHT(p.phone_international, 9) = RIGHT(COALESCE(s.whatsapp, ''), 9))
              AND p.statut_contact = 'inscrit'
              ${notExistsProspectScope}
              ${notExistsProspectFilters}
          )
        GROUP BY s.id, s.nom, s.prenom, s.cin, s.phone, s.whatsapp
        ORDER BY s.nom, s.prenom
      `;

      // =====================================================
      // ÉCART PROSPECT: Prospects "inscrit" SANS session
      // =====================================================
      console.log('📊 [ECART-DETAILS] Building ecart prospect query...');

      let ecartProspectQuery = `
        SELECT DISTINCT
          p.id as prospect_id,
          p.nom,
          p.prenom,
          p.phone_international,
          p.statut_contact,
          p.date_injection,
          c.name as ville_name,
          seg.name as segment_name
        FROM prospects p
        LEFT JOIN cities c ON c.id = p.ville_id
        LEFT JOIN segments seg ON seg.id = p.segment_id
        WHERE p.statut_contact = 'inscrit'
      `;
      let ecartProspectParams = [];
      let ecartProspectParamIndex = 1;

      // Appliquer le scope utilisateur aux prospects
      if (prospectScopeFilter.hasScope) {
        const adjustedConditions = adjustConditions(prospectScopeFilter.conditions, ecartProspectParamIndex);
        ecartProspectQuery += ` AND (${adjustedConditions.join(' AND ')})`;
        ecartProspectParams.push(...prospectScopeFilter.params);
        ecartProspectParamIndex += prospectScopeFilter.params.length;
      }

      // Filtres UI additionnels
      if (segment_id) {
        ecartProspectQuery += ` AND p.segment_id = $${ecartProspectParamIndex++}`;
        ecartProspectParams.push(segment_id);
      }
      if (ville_id) {
        ecartProspectQuery += ` AND p.ville_id = $${ecartProspectParamIndex++}`;
        ecartProspectParams.push(ville_id);
      }
      if (date_from) {
        ecartProspectQuery += ` AND p.date_injection >= $${ecartProspectParamIndex++}`;
        ecartProspectParams.push(date_from);
      }
      if (date_to) {
        ecartProspectQuery += ` AND p.date_injection <= $${ecartProspectParamIndex++}`;
        ecartProspectParams.push(date_to);
      }

      // NOT EXISTS pour exclure ceux qui ont une session correspondante
      let notExistsSessionScope = '';
      if (sessionScopeFilter.hasScope) {
        const adjustedConditions = adjustConditions(sessionScopeFilter.conditions, ecartProspectParamIndex);
        notExistsSessionScope = ` AND (${adjustedConditions.join(' AND ')})`;
        ecartProspectParams.push(...sessionScopeFilter.params);
        ecartProspectParamIndex += sessionScopeFilter.params.length;
      }

      let notExistsSessionFilters = '';
      if (segment_id) {
        notExistsSessionFilters += ` AND sf.segment_id = $${ecartProspectParamIndex++}`;
        ecartProspectParams.push(segment_id);
      }
      if (ville_id) {
        notExistsSessionFilters += ` AND sf.ville_id = $${ecartProspectParamIndex++}`;
        ecartProspectParams.push(ville_id);
      }
      if (date_from) {
        notExistsSessionFilters += ` AND se.created_at >= $${ecartProspectParamIndex++}`;
        ecartProspectParams.push(date_from);
      }
      if (date_to) {
        notExistsSessionFilters += ` AND se.created_at <= $${ecartProspectParamIndex++}`;
        ecartProspectParams.push(date_to);
      }

      ecartProspectQuery += `
          AND NOT EXISTS (
            SELECT 1 FROM students s
            INNER JOIN session_etudiants se ON se.student_id = s.id
            INNER JOIN sessions_formation sf ON sf.id = se.session_id
            WHERE (RIGHT(s.phone, 9) = RIGHT(p.phone_international, 9)
                OR RIGHT(COALESCE(s.whatsapp, ''), 9) = RIGHT(p.phone_international, 9))
              AND sf.statut != 'annulee'
              ${notExistsSessionScope}
              ${notExistsSessionFilters}
          )
        ORDER BY p.date_injection DESC
      `;

      // =====================================================
      // Exécuter les deux requêtes en parallèle
      // =====================================================
      const [ecartSessionResult, ecartProspectResult] = await Promise.all([
        pool.query(ecartSessionQuery, ecartSessionParams),
        pool.query(ecartProspectQuery, ecartProspectParams)
      ]);

      const ecartSessionStudents = ecartSessionResult.rows;
      const ecartProspectStudents = ecartProspectResult.rows;

      console.log('📊 [ECART-DETAILS] Ecart Session:', ecartSessionStudents.length, 'students');
      console.log('📊 [ECART-DETAILS] Ecart Prospect:', ecartProspectStudents.length, 'prospects');

      res.json({
        ecart_session: {
          count: ecartSessionStudents.length,
          students: ecartSessionStudents
        },
        ecart_prospect: {
          count: ecartProspectStudents.length,
          students: ecartProspectStudents
        }
      });

    } catch (error) {
      console.error('❌ [ECART-DETAILS] Error:', error.message);
      console.error('❌ [ECART-DETAILS] Stack:', error.stack);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// POST /api/prospects - Créer un prospect (avec normalisation + affectation)
// ============================================================
router.post('/',
  requirePermission('commercialisation.prospects.create'),
  injectUserScope,
  async (req, res) => {
    try {
      const { phone: rawPhone, nom, prenom, cin, segment_id, ville_id } = req.body;

      // Validation segment
      if (!segment_id) {
        return res.status(400).json({ error: 'Veuillez sélectionner un segment' });
      }

      // Note: ville_id est optionnel - si null/vide, l'auto-assignment choisira la ville

      // Normalisation internationale du numéro
      const phoneValidation = await normalizePhoneInternational(rawPhone);

      if (!phoneValidation.valid) {
        return res.status(400).json({ error: phoneValidation.error });
      }

      const { phone_international, country_code, country } = phoneValidation;

      // Gérer les doublons / réinjection
      const duplicateCheck = await handleDuplicateOrReinject(
        phone_international,
        req.user.id,
        { segment_id, ville_id, nom, prenom }
      );

      if (duplicateCheck.action === 'reinjected') {
        return res.status(200).json({
          message: duplicateCheck.message,
          prospect: duplicateCheck.prospect,
          reinjected: true
        });
      }

      if (duplicateCheck.action === 'duplicate') {
        return res.status(409).json({
          error: duplicateCheck.message,
          prospect: duplicateCheck.prospect
        });
      }

      // Pas d'assignation automatique - les assistantes voient les prospects
      // basés sur leurs villes assignées (via professor_cities)
      // assigned_to reste NULL - le filtrage se fait par ville_id
      let finalVilleId = ville_id;

      // Validation SBAC
      if (!req.userScope.isAdmin) {
        const hasSegment = req.userScope.segmentIds.includes(segment_id);
        const hasCity = req.userScope.cityIds.includes(finalVilleId);

        if (!hasSegment || !hasCity) {
          return res.status(403).json({
            error: 'Vous ne pouvez pas créer un prospect en dehors de votre scope'
          });
        }
      }

      // Créer le prospect avec un ID unique de 8 chiffres
      const prospectId = await generateUniqueProspectId();

      const insertQuery = `
        INSERT INTO prospects (
          id, phone_raw, phone_international, country_code, country, statut_validation_numero,
          nom, prenom, cin, segment_id, ville_id,
          statut_contact, date_injection, created_by
        )
        VALUES ($1, $2, $3, $4, $5, 'valide', $6, $7, $8, $9, $10, 'non contacté', NOW(), $11)
        RETURNING *
      `;

      const { rows } = await pool.query(insertQuery, [
        prospectId,
        rawPhone,
        phone_international,
        country_code,
        country,
        nom || null,
        prenom || null,
        cin || null,
        segment_id,
        finalVilleId,
        req.user.id
      ]);

      // 📱 Sync vers Google Contacts (async, non-bloquant)
      const villeName = await pool.query('SELECT name FROM cities WHERE id = $1', [finalVilleId]);
      const segmentName = await pool.query('SELECT name FROM segments WHERE id = $1', [segment_id]);

      googleContactsService.syncProspect({
        id: prospectId,
        phone_international,
        nom: nom || null,
        prenom: prenom || null,
        ville_id: finalVilleId,
        ville_name: villeName.rows[0]?.name || '',
        segment_name: segmentName.rows[0]?.name || ''
      }).catch(err => console.error('Google sync error:', err.message));

      res.status(201).json({
        message: 'Prospect créé avec succès',
        prospect: rows[0]
      });
    } catch (error) {
      console.error('Error creating prospect:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// GET /api/prospects/:id - Détails d'un prospect
// ============================================================
router.get('/:id',
  requirePermission('commercialisation.prospects.view_page'),
  injectUserScope,
  requireRecordScope('prospects', 'id', 'segment_id', 'ville_id'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(`
        SELECT
          p.*,
          s.name as segment_name,
          c.name as ville_name,
          prof.full_name as assigned_to_name,
          COALESCE(calls.total_duration, 0) as total_call_duration,
          (
            SELECT STRING_AGG(pr.full_name, ', ' ORDER BY pr.full_name)
            FROM professor_cities pc2
            JOIN profiles pr ON pr.id = pc2.professor_id
            JOIN roles r ON pr.role_id = r.id
            WHERE pc2.city_id = p.ville_id
              AND (r.name ILIKE '%assistante%' OR r.name = 'assistante')
          ) as assistantes_ville
        FROM prospects p
        LEFT JOIN segments s ON s.id = p.segment_id
        LEFT JOIN cities c ON c.id = p.ville_id
        LEFT JOIN profiles prof ON prof.id = p.assigned_to
        LEFT JOIN (
          SELECT prospect_id, SUM(duration_seconds) as total_duration
          FROM prospect_call_history
          WHERE duration_seconds IS NOT NULL
          GROUP BY prospect_id
        ) calls ON calls.prospect_id = p.id
        WHERE p.id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Prospect non trouvé' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching prospect:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// PUT /api/prospects/:id - Mettre à jour un prospect
// ============================================================
router.put('/:id',
  requirePermission('commercialisation.prospects.update'),
  injectUserScope,
  requireRecordScope('prospects', 'id', 'segment_id', 'ville_id'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { nom, prenom, cin, statut_contact, date_rdv, rdv_centre_ville_id, commentaire } = req.body;

      const updateQuery = `
        UPDATE prospects
        SET
          nom = COALESCE($1, nom),
          prenom = COALESCE($2, prenom),
          cin = COALESCE($3, cin),
          statut_contact = COALESCE($4, statut_contact),
          date_rdv = $5,
          rdv_centre_ville_id = $6,
          commentaire = COALESCE($7, commentaire),
          updated_at = NOW()
        WHERE id = $8
        RETURNING *
      `;

      const { rows } = await pool.query(updateQuery, [
        nom,
        prenom,
        cin,
        statut_contact,
        date_rdv || null,
        rdv_centre_ville_id || null,
        commentaire,
        id
      ]);

      res.json({
        message: 'Prospect mis à jour',
        prospect: rows[0]
      });
    } catch (error) {
      console.error('Error updating prospect:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// DELETE /api/prospects/:id - Supprimer un prospect
// ============================================================
router.delete('/:id',
  requirePermission('commercialisation.prospects.delete'),
  injectUserScope,
  requireRecordScope('prospects', 'id', 'segment_id', 'ville_id'),
  async (req, res) => {
    try {
      const { id } = req.params;

      await pool.query('DELETE FROM prospects WHERE id = $1', [id]);

      res.json({ message: 'Prospect supprimé' });
    } catch (error) {
      console.error('Error deleting prospect:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// POST /api/prospects/import - Import en masse
// ============================================================
router.post('/import',
  requirePermission('commercialisation.prospects.import'),
  injectUserScope,
  async (req, res) => {
    try {
      const { segment_id, lines } = req.body;

      if (!segment_id) {
        return res.status(400).json({ error: 'Veuillez sélectionner un segment' });
      }

      // Récupérer les villes du segment
      const { rows: villes } = await pool.query(
        'SELECT id, name FROM cities WHERE segment_id = $1',
        [segment_id]
      );
      const villesMap = new Map(villes.map(v => [v.name.toLowerCase(), v.id]));

      const results = [];
      let created = 0;
      let reinjected = 0;
      let errors = 0;

      for (const line of lines) {
        const result = { original: line, status: null, error: null };

        // Validation téléphone internationale
        const phoneValidation = await normalizePhoneInternational(line.phone);

        if (!phoneValidation.valid) {
          result.status = 'error';
          result.error = phoneValidation.error;
          errors++;
          results.push(result);
          continue;
        }

        // Validation ville
        const villeName = line.ville?.toLowerCase();
        const villeId = villesMap.get(villeName);

        if (!villeId) {
          result.status = 'error';
          result.error = 'Ville non existante dans le segment';
          errors++;
          results.push(result);
          continue;
        }

        // Gérer doublon / réinjection
        const duplicateCheck = await handleDuplicateOrReinject(
          phoneValidation.phone_international,
          req.user.id,
          { segment_id, ville_id: villeId }
        );

        if (duplicateCheck.action === 'reinjected') {
          result.status = 'reinjected';
          reinjected++;
          results.push(result);
          continue;
        }

        if (duplicateCheck.action === 'duplicate') {
          result.status = 'duplicate';
          result.error = 'Numéro déjà existant';
          errors++;
          results.push(result);
          continue;
        }

        // Créer le prospect avec un ID unique de 8 chiffres
        const prospectId = await generateUniqueProspectId();

        await pool.query(`
          INSERT INTO prospects (
            id, phone_raw, phone_international, country_code, country, statut_validation_numero,
            segment_id, ville_id, statut_contact, date_injection, created_by
          )
          VALUES ($1, $2, $3, $4, $5, 'valide', $6, $7, 'non contacté', NOW(), $8)
        `, [
          prospectId,
          line.phone,
          phoneValidation.phone_international,
          phoneValidation.country_code,
          phoneValidation.country,
          segment_id,
          villeId,
          req.user.id
        ]);

        // 📱 Sync vers Google Contacts (async, non-bloquant)
        const segmentInfo = await pool.query('SELECT name FROM segments WHERE id = $1', [segment_id]);
        googleContactsService.syncProspect({
          id: prospectId,
          phone_international: phoneValidation.phone_international,
          nom: line.nom || null,
          prenom: line.prenom || null,
          ville_id: villeId,
          ville_name: line.ville || '',
          segment_name: segmentInfo.rows[0]?.name || ''
        }).catch(err => console.error('Google sync error (import):', err.message));

        result.status = 'created';
        created++;
        results.push(result);
      }

      res.json({
        message: `Import terminé : ${created} créés, ${reinjected} réinjectés, ${errors} erreurs`,
        summary: { created, reinjected, errors },
        details: results
      });
    } catch (error) {
      console.error('Error importing prospects:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// POST /api/prospects/:id/start-call - Démarrer un appel
// ============================================================
router.post('/:id/start-call',
  requirePermission('commercialisation.prospects.call'),
  injectUserScope,
  requireRecordScope('prospects', 'id', 'segment_id', 'ville_id'),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Récupérer le statut actuel
      const { rows: prospects } = await pool.query(
        'SELECT statut_contact FROM prospects WHERE id = $1',
        [id]
      );

      const callId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      await pool.query(`
        INSERT INTO prospect_call_history (
          id, prospect_id, user_id, call_start, status_before
        )
        VALUES ($1, $2, $3, NOW(), $4)
      `, [callId, id, req.user.id, prospects[0].statut_contact]);

      res.json({ call_id: callId, started_at: new Date() });
    } catch (error) {
      console.error('Error starting call:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// POST /api/prospects/:id/end-call - Terminer un appel
// ============================================================
router.post('/:id/end-call',
  requirePermission('commercialisation.prospects.call'),
  injectUserScope,
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        call_id,
        statut_contact,
        commentaire,
        ville_id,
        date_rdv,
        rdv_centre_ville_id,
        nom,
        prenom,
        cin
      } = req.body;

      // Calculer la durée
      const { rows: calls } = await pool.query(
        'SELECT call_start FROM prospect_call_history WHERE id = $1',
        [call_id]
      );

      // Vérifier si l'appel existe
      if (!calls || calls.length === 0) {
        return res.status(404).json({ error: 'Appel non trouvé' });
      }

      const duration = Math.floor((Date.now() - new Date(calls[0].call_start).getTime()) / 1000);

      // Mettre à jour l'historique
      await pool.query(`
        UPDATE prospect_call_history
        SET call_end = NOW(), duration_seconds = $1, status_after = $2, commentaire = $3
        WHERE id = $4
      `, [duration, statut_contact, commentaire, call_id]);

      // Récupérer le prospect actuel avec l'historique
      const { rows: currentProspect } = await pool.query(
        'SELECT *, (SELECT name FROM cities WHERE id = prospects.ville_id) as current_ville_name FROM prospects WHERE id = $1',
        [id]
      );

      const prospect = currentProspect[0];

      // Préparer les champs à mettre à jour
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      // Champs simples
      if (nom) {
        updateFields.push(`nom = $${paramIndex++}`);
        updateValues.push(nom);
      }
      if (prenom) {
        updateFields.push(`prenom = $${paramIndex++}`);
        updateValues.push(prenom);
      }
      if (cin) {
        updateFields.push(`cin = $${paramIndex++}`);
        updateValues.push(cin);
      }

      // Statut contact
      updateFields.push(`statut_contact = $${paramIndex++}`);
      updateValues.push(statut_contact);

      // HISTORIQUE VILLES: Si la ville change, sauvegarder l'ancienne dans l'historique
      if (ville_id && ville_id !== prospect.ville_id) {
        // Récupérer le nom de la nouvelle ville
        const { rows: newVilleRows } = await pool.query(
          'SELECT name FROM cities WHERE id = $1',
          [ville_id]
        );
        const newVilleName = newVilleRows[0]?.name || ville_id;

        // Construire le nouvel historique des villes
        let newHistoriqueVilles;
        if (prospect.historique_villes) {
          // Vérifier si l'ancienne ville n'est pas déjà dans l'historique
          if (prospect.current_ville_name && !prospect.historique_villes.includes(prospect.current_ville_name)) {
            newHistoriqueVilles = `${prospect.historique_villes}, ${prospect.current_ville_name}`;
          } else {
            newHistoriqueVilles = prospect.historique_villes;
          }
        } else if (prospect.current_ville_name) {
          // Première modification - stocker l'ancienne ville
          newHistoriqueVilles = prospect.current_ville_name;
        }

        if (newHistoriqueVilles) {
          updateFields.push(`historique_villes = $${paramIndex++}`);
          updateValues.push(newHistoriqueVilles);
          console.log(`📍 Appel - Historique villes: ${newHistoriqueVilles} → nouvelle: ${newVilleName}`);
        }

        updateFields.push(`ville_id = $${paramIndex++}`);
        updateValues.push(ville_id);
      }

      // HISTORIQUE RDV: Si un nouveau RDV est défini et qu'il y avait un ancien RDV, sauvegarder l'ancien
      if (date_rdv && prospect.date_rdv) {
        const oldRdvDate = new Date(prospect.date_rdv);
        const oldRdvFormatted = oldRdvDate.toLocaleDateString('fr-FR') + ' ' +
          oldRdvDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

        // Construire le nouvel historique des RDV
        let newHistoriqueRdv;
        if (prospect.historique_rdv) {
          // Vérifier si cet ancien RDV n'est pas déjà dans l'historique
          if (!prospect.historique_rdv.includes(oldRdvFormatted)) {
            newHistoriqueRdv = `${prospect.historique_rdv}, ${oldRdvFormatted}`;
          } else {
            newHistoriqueRdv = prospect.historique_rdv;
          }
        } else {
          newHistoriqueRdv = oldRdvFormatted;
        }

        updateFields.push(`historique_rdv = $${paramIndex++}`);
        updateValues.push(newHistoriqueRdv);
        console.log(`📅 Appel - Historique RDV: ${newHistoriqueRdv}`);
      }

      // Date RDV (peut être null pour effacer)
      updateFields.push(`date_rdv = $${paramIndex++}`);
      updateValues.push(date_rdv || null);

      // RDV centre ville
      if (rdv_centre_ville_id !== undefined) {
        updateFields.push(`rdv_centre_ville_id = $${paramIndex++}`);
        updateValues.push(rdv_centre_ville_id || null);
      }

      // Commentaire
      if (commentaire) {
        updateFields.push(`commentaire = $${paramIndex++}`);
        updateValues.push(commentaire);
      }

      // Updated at
      updateFields.push('updated_at = NOW()');

      // ID du prospect
      updateValues.push(id);

      // Exécuter la mise à jour
      await pool.query(`
        UPDATE prospects
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
      `, updateValues);

      // Vérifier si réaffectation nécessaire (si ville changée)
      let reassignment = null;
      if (ville_id && ville_id !== prospect.ville_id && prospect.assigned_to) {
        reassignment = await reassignIfOutOfScope(id, ville_id, prospect.assigned_to);
      }

      res.json({
        message: 'Appel terminé',
        duration_seconds: duration,
        reassignment
      });
    } catch (error) {
      console.error('Error ending call:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// POST /api/prospects/:id/reinject - Réinjecter un prospect
// ============================================================
router.post('/:id/reinject',
  requirePermission('commercialisation.prospects.reinject'),
  injectUserScope,
  async (req, res) => {
    try {
      const { id } = req.params;

      const reinjected = await reinjectProspect(id, req.user.id);

      res.json({
        message: 'Prospect réinjecté avec succès',
        prospect: reinjected
      });
    } catch (error) {
      console.error('Error reinjecting prospect:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// POST /api/prospects/batch-clean - Nettoyage batch (analyse uniquement)
// ⚠️ La suppression automatique est DÉSACTIVÉE
// ============================================================
router.post('/batch-clean',
  requirePermission('commercialisation.prospects.clean'),
  async (req, res) => {
    try {
      // Note: execute_deletion est ignoré - la suppression est désactivée
      // Les prospects ne sont JAMAIS supprimés automatiquement
      // Utiliser la réinjection pour retravailler les anciens prospects

      // Recalculer les décisions (analyse uniquement)
      const cleanStats = await runCleaningBatch();

      res.json({
        message: 'Analyse terminée (suppression désactivée)',
        clean_stats: cleanStats,
        delete_stats: { deleted: 0, message: 'Suppression automatique désactivée' },
        info: 'Les prospects ne sont jamais supprimés automatiquement. Utilisez la réinjection.'
      });
    } catch (error) {
      console.error('Error batch cleaning:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
