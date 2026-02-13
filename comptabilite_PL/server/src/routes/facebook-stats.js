/**
 * Routes Facebook Stats - Gestion des declarations Facebook
 * Saisie des prospects declares par Facebook et comparaison avec la BDD
 */

import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { injectUserScope, buildScopeFilter } from '../middleware/requireScope.js';

const router = express.Router();

// ============================================================
// GET /api/facebook-stats - Liste des stats avec filtres
// ============================================================
router.get('/',
  requirePermission('commercialisation.analyse_publicite.voir'),
  injectUserScope,
  async (req, res) => {
    try {
      const {
        segment_id,
        city_id,
        date_start,
        date_end,
        page = 1,
        limit = 50
      } = req.query;

      let query = `
        SELECT
          fs.*,
          c.name as city_name,
          s.name as segment_name,
          s.color as segment_color,
          p.full_name as created_by_name
        FROM facebook_stats fs
        LEFT JOIN cities c ON c.id = fs.city_id
        LEFT JOIN segments s ON s.id = fs.segment_id
        LEFT JOIN profiles p ON p.id = fs.created_by
        WHERE 1=1
      `;
      const params = [];
      let paramIndex = 1;

      if (segment_id) {
        query += ` AND fs.segment_id = $${paramIndex++}`;
        params.push(segment_id);
      }
      if (city_id) {
        query += ` AND fs.city_id = $${paramIndex++}`;
        params.push(city_id);
      }
      if (date_start) {
        query += ` AND fs.date >= $${paramIndex++}`;
        params.push(date_start);
      }
      if (date_end) {
        query += ` AND fs.date <= $${paramIndex++}`;
        params.push(date_end);
      }

      // Appliquer le filtre SBAC
      const scopeFilter = buildScopeFilter(req, 'fs.segment_id', 'fs.city_id');
      if (scopeFilter && scopeFilter.hasScope) {
        query += ' AND (' + scopeFilter.conditions.join(' OR ') + ')';
        params.push(...scopeFilter.params);
        paramIndex += scopeFilter.params.length;
      }

      // Compter le total
      const countQuery = query.replace(
        /SELECT[\s\S]*?FROM facebook_stats fs/,
        'SELECT COUNT(*) as total FROM facebook_stats fs'
      );
      const countResult = await pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].total, 10);

      // Ajouter pagination
      query += ' ORDER BY fs.date DESC, c.name ASC';
      query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
      params.push(parseInt(limit, 10), (parseInt(page, 10) - 1) * parseInt(limit, 10));

      const { rows } = await pool.query(query, params);

      res.json({
        stats: rows,
        pagination: {
          page: parseInt(page, 10),
          limit: parseInt(limit, 10),
          total,
          totalPages: Math.ceil(total / parseInt(limit, 10))
        }
      });
    } catch (error) {
      console.error('Error fetching facebook stats:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// POST /api/facebook-stats - Creer/Mettre a jour une entree
// ============================================================
router.post('/',
  requirePermission('commercialisation.analyse_publicite.creer'),
  async (req, res) => {
    try {
      const { date, city_id, declared_count, notes } = req.body;
      const userId = req.user.id;

      // Validation
      if (!date || !city_id || declared_count === undefined) {
        return res.status(400).json({
          error: 'Les champs date, city_id et declared_count sont obligatoires'
        });
      }

      if (declared_count < 0) {
        return res.status(400).json({
          error: 'Le nombre de prospects ne peut pas etre negatif'
        });
      }

      // Recuperer segment_id depuis la ville
      const cityResult = await pool.query(
        'SELECT segment_id, name FROM cities WHERE id = $1',
        [city_id]
      );

      if (cityResult.rows.length === 0) {
        return res.status(400).json({ error: 'Ville non trouvee' });
      }

      const segment_id = cityResult.rows[0].segment_id;
      const city_name = cityResult.rows[0].name;

      // Upsert: inserer ou mettre a jour si existe deja
      const result = await pool.query(`
        INSERT INTO facebook_stats (date, city_id, segment_id, declared_count, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (date, city_id)
        DO UPDATE SET
          declared_count = EXCLUDED.declared_count,
          notes = EXCLUDED.notes,
          updated_at = NOW()
        RETURNING *
      `, [date, city_id, segment_id, declared_count, notes || null, userId]);

      // Ajouter les infos de la ville dans la reponse
      const stat = result.rows[0];
      stat.city_name = city_name;

      console.log(`Facebook stat saved: ${declared_count} prospects for ${city_name} on ${date}`);

      res.status(201).json(stat);
    } catch (error) {
      console.error('Error creating facebook stat:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// GET /api/facebook-stats/comparison - Comparaison Facebook vs BDD (agrege par jour)
// ============================================================
router.get('/comparison',
  requirePermission('commercialisation.analyse_publicite.voir'),
  injectUserScope,
  async (req, res) => {
    try {
      const { date_start, date_end } = req.query;

      // Validation des dates
      if (!date_start || !date_end) {
        return res.status(400).json({
          error: 'Les dates de debut et de fin sont obligatoires'
        });
      }

      // Requete agrégée par jour uniquement (pas par ville/segment)
      const query = `
        WITH fb_stats AS (
          SELECT
            fs.date,
            SUM(fs.declared_count) as facebook_count
          FROM facebook_stats fs
          WHERE fs.date >= $1 AND fs.date <= $2
          GROUP BY fs.date
        ),
        db_prospects AS (
          SELECT
            DATE(p.date_injection) as date,
            COUNT(*) as db_count
          FROM prospects p
          WHERE DATE(p.date_injection) >= $1 AND DATE(p.date_injection) <= $2
          GROUP BY DATE(p.date_injection)
        )
        SELECT
          COALESCE(fb.date, db.date) as date,
          COALESCE(fb.facebook_count, 0) as facebook_count,
          COALESCE(db.db_count, 0) as database_count,
          COALESCE(db.db_count, 0) - COALESCE(fb.facebook_count, 0) as difference,
          CASE
            WHEN COALESCE(fb.facebook_count, 0) > 0
            THEN ROUND((COALESCE(db.db_count, 0)::numeric / fb.facebook_count) * 100, 2)
            ELSE NULL
          END as conversion_rate
        FROM fb_stats fb
        FULL OUTER JOIN db_prospects db ON fb.date = db.date
        ORDER BY date DESC
      `;

      const { rows } = await pool.query(query, [date_start, date_end]);

      // Calculer les statistiques globales
      let totalFacebook = 0;
      let totalDatabase = 0;

      for (const row of rows) {
        totalFacebook += parseInt(row.facebook_count, 10) || 0;
        totalDatabase += parseInt(row.database_count, 10) || 0;
      }

      const overallConversionRate = totalFacebook > 0
        ? ((totalDatabase / totalFacebook) * 100).toFixed(2)
        : '0.00';

      res.json({
        comparison: rows,
        summary: {
          total_facebook: totalFacebook,
          total_database: totalDatabase,
          difference: totalDatabase - totalFacebook,
          overall_conversion_rate: overallConversionRate
        },
        filters: {
          date_start,
          date_end
        }
      });
    } catch (error) {
      console.error('Error fetching comparison:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// DELETE /api/facebook-stats/:id - Supprimer une entree
// ============================================================
router.delete('/:id',
  requirePermission('commercialisation.analyse_publicite.supprimer'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(
        'DELETE FROM facebook_stats WHERE id = $1 RETURNING *',
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Entree non trouvee' });
      }

      res.json({
        message: 'Entree supprimee avec succes',
        deleted: result.rows[0]
      });
    } catch (error) {
      console.error('Error deleting facebook stat:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// GET /api/facebook-stats/summary - Resume par segment
// ============================================================
router.get('/summary',
  requirePermission('commercialisation.analyse_publicite.voir'),
  injectUserScope,
  async (req, res) => {
    try {
      const { date_start, date_end } = req.query;

      if (!date_start || !date_end) {
        return res.status(400).json({
          error: 'Les dates de debut et de fin sont obligatoires'
        });
      }

      const query = `
        SELECT
          s.id as segment_id,
          s.name as segment_name,
          s.color as segment_color,
          COALESCE(SUM(fs.declared_count), 0) as total_facebook,
          COALESCE(db.total_prospects, 0) as total_database
        FROM segments s
        LEFT JOIN facebook_stats fs ON fs.segment_id = s.id
          AND fs.date >= $1 AND fs.date <= $2
        LEFT JOIN (
          SELECT
            segment_id,
            COUNT(*) as total_prospects
          FROM prospects
          WHERE DATE(date_injection) >= $1 AND DATE(date_injection) <= $2
          GROUP BY segment_id
        ) db ON db.segment_id = s.id
        GROUP BY s.id, s.name, s.color, db.total_prospects
        ORDER BY s.name
      `;

      const { rows } = await pool.query(query, [date_start, date_end]);

      res.json({
        summary_by_segment: rows.map(row => ({
          ...row,
          total_facebook: parseInt(row.total_facebook, 10),
          total_database: parseInt(row.total_database, 10),
          difference: parseInt(row.total_database, 10) - parseInt(row.total_facebook, 10),
          conversion_rate: parseInt(row.total_facebook, 10) > 0
            ? ((parseInt(row.total_database, 10) / parseInt(row.total_facebook, 10)) * 100).toFixed(2)
            : null
        })),
        period: { date_start, date_end }
      });
    } catch (error) {
      console.error('Error fetching summary:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
