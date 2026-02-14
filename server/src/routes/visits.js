/**
 * Routes Visites - Gestion des visites physiques au centre
 * Enregistrement, suivi, analytics par zone et par motif
 */

import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { injectUserScope, buildScopeFilter } from '../middleware/requireScope.js';
import { normalizePhoneInternational } from '../utils/phone-validator.js';

const router = express.Router();

// ============================================================
// GET /api/visits/rejection-reasons - Liste des motifs de non-inscription
// ============================================================
router.get('/rejection-reasons',
  authenticateToken,
  async (req, res) => {
    try {
      const query = `
        SELECT id, label, description
        FROM visit_rejection_reasons
        WHERE is_active = true
        ORDER BY sort_order, label
      `;

      const { rows } = await pool.query(query);
      res.json(rows);
    } catch (error) {
      console.error('Error fetching rejection reasons:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// GET /api/visits/analytics - Statistiques des visites
// ============================================================
router.get('/analytics',
  requirePermission('commercialisation.visits.view_analytics'),
  injectUserScope,
  async (req, res) => {
    try {
      const { date_from, date_to, centre_ville_id } = req.query;

      // Base filter conditions
      let whereConditions = [];
      const params = [];
      let paramIndex = 1;

      if (date_from) {
        whereConditions.push(`v.date_visite >= $${paramIndex++}`);
        params.push(date_from);
      }
      if (date_to) {
        whereConditions.push(`v.date_visite <= $${paramIndex++}`);
        params.push(date_to + ' 23:59:59');
      }
      if (centre_ville_id) {
        whereConditions.push(`v.centre_ville_id = $${paramIndex++}`);
        params.push(centre_ville_id);
      }

      // Apply SBAC filtering
      const scopeFilter = buildScopeFilter(req, null, 'v.centre_ville_id');
      if (scopeFilter.hasScope) {
        const adjustedScopeConditions = scopeFilter.conditions.map(condition => {
          return condition.replace(/\$(\d+)/g, (match, num) => {
            return `$${params.length + parseInt(num)}`;
          });
        });
        whereConditions.push(`(${adjustedScopeConditions.join(' AND ')})`);
        params.push(...scopeFilter.params);
      }

      const whereClause = whereConditions.length > 0
        ? `WHERE ${whereConditions.join(' AND ')}`
        : '';

      // 1. Stats globales
      const globalStats = await pool.query(`
        SELECT
          COUNT(*) as total_visites,
          COUNT(*) FILTER (WHERE statut = 'inscrit') as total_inscrits,
          COUNT(*) FILTER (WHERE statut = 'non_inscrit') as total_non_inscrits,
          ROUND(
            COUNT(*) FILTER (WHERE statut = 'inscrit')::NUMERIC /
            NULLIF(COUNT(*)::NUMERIC, 0) * 100,
            1
          ) as taux_conversion
        FROM prospect_visits v
        ${whereClause}
      `, params);

      // 2. Performance par zone (ville)
      const performanceByZone = await pool.query(`
        SELECT
          c.id as ville_id,
          c.name as ville_name,
          COUNT(*) as total_visites,
          COUNT(*) FILTER (WHERE v.statut = 'inscrit') as inscrits,
          COUNT(*) FILTER (WHERE v.statut = 'non_inscrit') as non_inscrits,
          ROUND(
            COUNT(*) FILTER (WHERE v.statut = 'inscrit')::NUMERIC /
            NULLIF(COUNT(*)::NUMERIC, 0) * 100,
            1
          ) as taux_conversion
        FROM prospect_visits v
        JOIN cities c ON c.id = v.centre_ville_id
        ${whereClause}
        GROUP BY c.id, c.name
        ORDER BY non_inscrits DESC, total_visites DESC
      `, params);

      // 3. Analyse des causes (motifs de non-inscription)
      const causesByCenter = await pool.query(`
        SELECT
          c.id as ville_id,
          c.name as ville_name,
          v.motif_non_inscription,
          COALESCE(r.label, v.motif_non_inscription) as motif_label,
          COUNT(*) as count
        FROM prospect_visits v
        JOIN cities c ON c.id = v.centre_ville_id
        LEFT JOIN visit_rejection_reasons r ON r.id = v.motif_non_inscription
        ${whereClause.replace('WHERE', whereConditions.length > 0 ? 'WHERE' : '')}
        ${whereConditions.length > 0 ? 'AND' : 'WHERE'} v.statut = 'non_inscrit'
        AND v.motif_non_inscription IS NOT NULL
        GROUP BY c.id, c.name, v.motif_non_inscription, r.label
        ORDER BY c.name, count DESC
      `, params);

      // 4. Top motifs globaux
      const topReasons = await pool.query(`
        SELECT
          v.motif_non_inscription,
          COALESCE(r.label, v.motif_non_inscription) as motif_label,
          COUNT(*) as count,
          ROUND(
            COUNT(*)::NUMERIC /
            NULLIF((SELECT COUNT(*) FROM prospect_visits v2
                    ${whereClause.replace('v.', 'v2.')}
                    ${whereConditions.length > 0 ? 'AND' : 'WHERE'} v2.statut = 'non_inscrit')::NUMERIC, 0) * 100,
            1
          ) as percentage
        FROM prospect_visits v
        LEFT JOIN visit_rejection_reasons r ON r.id = v.motif_non_inscription
        ${whereClause}
        ${whereConditions.length > 0 ? 'AND' : 'WHERE'} v.statut = 'non_inscrit'
        AND v.motif_non_inscription IS NOT NULL
        GROUP BY v.motif_non_inscription, r.label
        ORDER BY count DESC
        LIMIT 10
      `, params);

      // 5. Évolution par jour (7 derniers jours si pas de filtre date)
      const evolutionQuery = `
        SELECT
          DATE(v.date_visite) as date,
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE v.statut = 'inscrit') as inscrits,
          COUNT(*) FILTER (WHERE v.statut = 'non_inscrit') as non_inscrits
        FROM prospect_visits v
        ${whereClause.length > 0 ? whereClause : 'WHERE v.date_visite >= CURRENT_DATE - INTERVAL \'7 days\''}
        GROUP BY DATE(v.date_visite)
        ORDER BY date DESC
      `;
      const evolution = await pool.query(evolutionQuery, params);

      res.json({
        global: globalStats.rows[0],
        performance_by_zone: performanceByZone.rows,
        causes_by_center: causesByCenter.rows,
        top_reasons: topReasons.rows,
        evolution: evolution.rows
      });
    } catch (error) {
      console.error('Error fetching visit analytics:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// GET /api/visits - Liste des visites avec filtres
// ============================================================
router.get('/',
  requirePermission('commercialisation.visits.view_page'),
  injectUserScope,
  async (req, res) => {
    try {
      const {
        centre_ville_id,
        statut,
        motif_non_inscription,
        date_from,
        date_to,
        search,
        page = 1,
        limit = 50
      } = req.query;

      let query = `
        SELECT
          v.*,
          c.name as centre_ville_name,
          s.name as segment_name,
          creator.full_name as created_by_name,
          r.label as motif_label
        FROM prospect_visits v
        LEFT JOIN cities c ON c.id = v.centre_ville_id
        LEFT JOIN segments s ON s.id = c.segment_id
        LEFT JOIN profiles creator ON creator.id = v.created_by
        LEFT JOIN visit_rejection_reasons r ON r.id = v.motif_non_inscription
        WHERE 1=1
      `;

      const params = [];
      let paramIndex = 1;

      // SCOPE FILTERING: Filtre automatique par ville (sauf admin)
      const scopeFilter = buildScopeFilter(req, null, 'v.centre_ville_id');
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
      if (centre_ville_id) {
        query += ` AND v.centre_ville_id = $${paramIndex++}`;
        params.push(centre_ville_id);
      }
      if (statut) {
        query += ` AND v.statut = $${paramIndex++}`;
        params.push(statut);
      }
      if (motif_non_inscription) {
        query += ` AND v.motif_non_inscription = $${paramIndex++}`;
        params.push(motif_non_inscription);
      }
      if (date_from) {
        query += ` AND v.date_visite >= $${paramIndex++}`;
        params.push(date_from);
      }
      if (date_to) {
        query += ` AND v.date_visite <= $${paramIndex++}`;
        params.push(date_to + ' 23:59:59');
      }
      if (search) {
        query += ` AND (v.phone_international LIKE $${paramIndex} OR v.nom ILIKE $${paramIndex} OR v.prenom ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Tri par date de visite DESC (plus récentes en premier)
      query += ` ORDER BY v.date_visite DESC`;

      // Pagination
      const offset = (page - 1) * limit;
      query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const { rows } = await pool.query(query, params);

      // Stats avec les mêmes filtres de scope
      let statsQuery = `
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE statut = 'inscrit') as inscrits,
          COUNT(*) FILTER (WHERE statut = 'non_inscrit') as non_inscrits
        FROM prospect_visits v
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

      const statsResult = await pool.query(statsQuery, scopeFilter.params);

      res.json({
        visits: rows,
        stats: statsResult.rows[0],
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total: parseInt(statsResult.rows[0].total, 10)
        }
      });
    } catch (error) {
      console.error('Error fetching visits:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// POST /api/visits - Enregistrer une nouvelle visite
// ============================================================
router.post('/',
  requirePermission('commercialisation.visits.create'),
  injectUserScope,
  async (req, res) => {
    try {
      const {
        nom,
        prenom,
        phone: rawPhone,
        centre_ville_id,
        statut,
        motif_non_inscription,
        commentaire
      } = req.body;

      // Validations
      if (!rawPhone) {
        return res.status(400).json({ error: 'Le numéro de téléphone est obligatoire' });
      }

      if (!centre_ville_id) {
        return res.status(400).json({ error: 'Le centre/ville est obligatoire' });
      }

      if (!statut || !['inscrit', 'non_inscrit'].includes(statut)) {
        return res.status(400).json({ error: 'Le statut doit être "inscrit" ou "non_inscrit"' });
      }

      // Validation: motif obligatoire si non inscrit
      if (statut === 'non_inscrit' && !motif_non_inscription) {
        return res.status(400).json({
          error: 'Le motif de non-inscription est obligatoire pour les visiteurs non inscrits'
        });
      }

      // Normalisation du téléphone
      const phoneValidation = await normalizePhoneInternational(rawPhone);

      if (!phoneValidation.valid) {
        return res.status(400).json({ error: phoneValidation.error });
      }

      const { phone_international, country_code, country } = phoneValidation;

      // Validation SBAC: vérifier que l'utilisateur a accès à cette ville
      if (!req.userScope.isAdmin) {
        const hasCity = req.userScope.cityIds.includes(centre_ville_id);
        if (!hasCity) {
          return res.status(403).json({
            error: 'Vous ne pouvez pas enregistrer une visite pour ce centre'
          });
        }
      }

      // Créer la visite
      const visitId = `visit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const insertQuery = `
        INSERT INTO prospect_visits (
          id, nom, prenom, phone_raw, phone_international, country_code, country,
          centre_ville_id, statut, motif_non_inscription, commentaire,
          date_visite, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), $12)
        RETURNING *
      `;

      const { rows } = await pool.query(insertQuery, [
        visitId,
        nom || null,
        prenom || null,
        rawPhone,
        phone_international,
        country_code,
        country,
        centre_ville_id,
        statut,
        statut === 'non_inscrit' ? motif_non_inscription : null,
        commentaire || null,
        req.user.id
      ]);

      // 🔄 Mettre à jour le statut du prospect correspondant selon le résultat de la visite
      if (phone_international) {
        try {
          const updateProspectResult = await pool.query(`
            UPDATE prospects
            SET statut_contact = $1,
                updated_at = NOW()
            WHERE phone_international = $2
            RETURNING id, nom, prenom, statut_contact
          `, [statut, phone_international]);

          if (updateProspectResult.rows.length > 0) {
            const updatedProspect = updateProspectResult.rows[0];
            console.log(`✅ Prospect ${updatedProspect.id} (${updatedProspect.nom} ${updatedProspect.prenom}) mis à jour: statut_contact = '${statut}'`);
          } else {
            console.log(`⚠️ Aucun prospect trouvé avec phone_international = ${phone_international}`);
          }
        } catch (updateError) {
          console.warn('⚠️ Impossible de mettre à jour le prospect:', updateError.message);
          // Ne pas bloquer la création de visite si update échoue
        }
      }

      // Récupérer les infos complètes avec jointures
      const fullVisit = await pool.query(`
        SELECT
          v.*,
          c.name as centre_ville_name,
          creator.full_name as created_by_name,
          r.label as motif_label
        FROM prospect_visits v
        LEFT JOIN cities c ON c.id = v.centre_ville_id
        LEFT JOIN profiles creator ON creator.id = v.created_by
        LEFT JOIN visit_rejection_reasons r ON r.id = v.motif_non_inscription
        WHERE v.id = $1
      `, [visitId]);

      res.status(201).json({
        message: 'Visite enregistrée avec succès',
        visit: fullVisit.rows[0]
      });
    } catch (error) {
      console.error('Error creating visit:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// GET /api/visits/:id - Détails d'une visite
// ============================================================
router.get('/:id',
  requirePermission('commercialisation.visits.view_page'),
  injectUserScope,
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(`
        SELECT
          v.*,
          c.name as centre_ville_name,
          s.name as segment_name,
          creator.full_name as created_by_name,
          r.label as motif_label,
          r.description as motif_description
        FROM prospect_visits v
        LEFT JOIN cities c ON c.id = v.centre_ville_id
        LEFT JOIN segments s ON s.id = c.segment_id
        LEFT JOIN profiles creator ON creator.id = v.created_by
        LEFT JOIN visit_rejection_reasons r ON r.id = v.motif_non_inscription
        WHERE v.id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Visite non trouvée' });
      }

      // Vérification SBAC
      if (!req.userScope.isAdmin) {
        const hasCity = req.userScope.cityIds.includes(result.rows[0].centre_ville_id);
        if (!hasCity) {
          return res.status(403).json({ error: 'Accès non autorisé' });
        }
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching visit:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// PUT /api/visits/:id - Modifier une visite
// ============================================================
router.put('/:id',
  requirePermission('commercialisation.visits.update'),
  injectUserScope,
  async (req, res) => {
    try {
      const { id } = req.params;
      const { nom, prenom, statut, motif_non_inscription, commentaire } = req.body;

      // Vérifier que la visite existe et récupérer les infos
      const existing = await pool.query(
        'SELECT * FROM prospect_visits WHERE id = $1',
        [id]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Visite non trouvée' });
      }

      // Vérification SBAC
      if (!req.userScope.isAdmin) {
        const hasCity = req.userScope.cityIds.includes(existing.rows[0].centre_ville_id);
        if (!hasCity) {
          return res.status(403).json({ error: 'Accès non autorisé' });
        }
      }

      // Validation: motif obligatoire si non inscrit
      const finalStatut = statut || existing.rows[0].statut;
      if (finalStatut === 'non_inscrit' && !motif_non_inscription && !existing.rows[0].motif_non_inscription) {
        return res.status(400).json({
          error: 'Le motif de non-inscription est obligatoire pour les visiteurs non inscrits'
        });
      }

      const updateQuery = `
        UPDATE prospect_visits
        SET
          nom = COALESCE($1, nom),
          prenom = COALESCE($2, prenom),
          statut = COALESCE($3, statut),
          motif_non_inscription = CASE
            WHEN COALESCE($3, statut) = 'inscrit' THEN NULL
            ELSE COALESCE($4, motif_non_inscription)
          END,
          commentaire = COALESCE($5, commentaire)
        WHERE id = $6
        RETURNING *
      `;

      const { rows } = await pool.query(updateQuery, [
        nom,
        prenom,
        statut,
        motif_non_inscription,
        commentaire,
        id
      ]);

      res.json({
        message: 'Visite mise à jour',
        visit: rows[0]
      });
    } catch (error) {
      console.error('Error updating visit:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// DELETE /api/visits/:id - Supprimer une visite
// ============================================================
router.delete('/:id',
  requirePermission('commercialisation.visits.delete'),
  injectUserScope,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Vérifier que la visite existe
      const existing = await pool.query(
        'SELECT centre_ville_id FROM prospect_visits WHERE id = $1',
        [id]
      );

      if (existing.rows.length === 0) {
        return res.status(404).json({ error: 'Visite non trouvée' });
      }

      // Vérification SBAC
      if (!req.userScope.isAdmin) {
        const hasCity = req.userScope.cityIds.includes(existing.rows[0].centre_ville_id);
        if (!hasCity) {
          return res.status(403).json({ error: 'Accès non autorisé' });
        }
      }

      await pool.query('DELETE FROM prospect_visits WHERE id = $1', [id]);

      res.json({ message: 'Visite supprimée' });
    } catch (error) {
      console.error('Error deleting visit:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// GET /api/visits/export/csv - Export CSV des visites
// ============================================================
router.get('/export/csv',
  requirePermission('commercialisation.visits.export'),
  injectUserScope,
  async (req, res) => {
    try {
      const { date_from, date_to, centre_ville_id, statut } = req.query;

      let query = `
        SELECT
          v.date_visite,
          v.nom,
          v.prenom,
          v.phone_international as telephone,
          c.name as centre,
          v.statut,
          COALESCE(r.label, v.motif_non_inscription) as motif,
          v.commentaire,
          creator.full_name as enregistre_par
        FROM prospect_visits v
        LEFT JOIN cities c ON c.id = v.centre_ville_id
        LEFT JOIN profiles creator ON creator.id = v.created_by
        LEFT JOIN visit_rejection_reasons r ON r.id = v.motif_non_inscription
        WHERE 1=1
      `;

      const params = [];
      let paramIndex = 1;

      // SBAC
      const scopeFilter = buildScopeFilter(req, null, 'v.centre_ville_id');
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

      if (date_from) {
        query += ` AND v.date_visite >= $${paramIndex++}`;
        params.push(date_from);
      }
      if (date_to) {
        query += ` AND v.date_visite <= $${paramIndex++}`;
        params.push(date_to + ' 23:59:59');
      }
      if (centre_ville_id) {
        query += ` AND v.centre_ville_id = $${paramIndex++}`;
        params.push(centre_ville_id);
      }
      if (statut) {
        query += ` AND v.statut = $${paramIndex++}`;
        params.push(statut);
      }

      query += ` ORDER BY v.date_visite DESC`;

      const { rows } = await pool.query(query, params);

      // Générer le CSV
      const headers = ['Date', 'Nom', 'Prénom', 'Téléphone', 'Centre', 'Statut', 'Motif', 'Commentaire', 'Enregistré par'];
      const csvLines = [headers.join(';')];

      rows.forEach(row => {
        const line = [
          new Date(row.date_visite).toLocaleString('fr-FR'),
          row.nom || '',
          row.prenom || '',
          row.telephone,
          row.centre,
          row.statut === 'inscrit' ? 'Inscrit' : 'Non inscrit',
          row.motif || '',
          (row.commentaire || '').replace(/;/g, ','),
          row.enregistre_par || ''
        ].join(';');
        csvLines.push(line);
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=visites_${new Date().toISOString().split('T')[0]}.csv`);
      res.send('\ufeff' + csvLines.join('\n')); // BOM for Excel
    } catch (error) {
      console.error('Error exporting visits:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
