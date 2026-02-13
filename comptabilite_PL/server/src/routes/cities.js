import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { injectUserScope, buildScopeFilter } from '../middleware/requireScope.js';
import { googleContactsService } from '../services/googleContactsService.js';

const router = express.Router();

/**
 * GET toutes les villes
 * Protected: SBAC filtering only (no permission check)
 * Non-admin users only see cities they are assigned to
 * Permission check removed to allow dropdown usage without view_page permission
 */
router.get('/',
  authenticateToken,
  injectUserScope,
  async (req, res) => {
  try {
    // Build base query
    let query = `
      SELECT c.id, c.name, c.code, c.segment_id, c.created_at,
             s.name as segment_name, s.color as segment_color
      FROM cities c
      LEFT JOIN segments s ON c.segment_id = s.id
    `;
    const params = [];

    // SBAC: Apply scope filtering - cities filtered by city_id ONLY (not by segment)
    const scopeFilter = buildScopeFilter(req, null, 'c.id');

    if (scopeFilter.hasScope) {
      query += ' WHERE (' + scopeFilter.conditions.join(' OR ') + ')';
      params.push(...scopeFilter.params);
    }

    query += ' ORDER BY c.name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET TOUTES les villes (sans filtrage SBAC)
 * Utilisé pour la réassignation de prospects à d'autres villes/segments
 * Les utilisateurs peuvent réassigner un prospect à une ville hors de leur scope
 */
router.get('/all',
  authenticateToken,
  async (req, res) => {
  try {
    const query = `
      SELECT c.id, c.name, c.code, c.segment_id, c.created_at,
             s.name as segment_name, s.color as segment_color
      FROM cities c
      LEFT JOIN segments s ON c.segment_id = s.id
      ORDER BY s.name, c.name
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching all cities:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET villes par segment
 * Protected: SBAC only - filters by user's assigned cities within segment
 * Permission check removed to allow dropdown usage without view_page permission
 *
 * Query params:
 *   - scope: 'true' (default) applies SBAC, 'false' returns all cities in segment
 *            Used with scope=false for prospect creation modal (show all cities)
 */
router.get('/by-segment/:segmentId',
  authenticateToken,
  injectUserScope,
  async (req, res) => {
  try {
    const { segmentId } = req.params;
    const { scope = 'true' } = req.query;

    let query = 'SELECT * FROM cities WHERE segment_id = $1';
    const params = [segmentId];

    // SBAC: Apply scope filtering only if scope !== 'false'
    // When scope=false, return ALL cities in segment (used for prospect creation)
    if (scope !== 'false') {
      const scopeFilter = buildScopeFilter(req, null, 'id');

      if (scopeFilter.hasScope) {
        query += ' AND (' + scopeFilter.conditions.map((condition, index) => {
          return condition.replace(/\$(\d+)/g, (match, num) => `$${params.length + parseInt(num)}`);
        }).join(' OR ') + ')';
        params.push(...scopeFilter.params);
      }
    }

    query += ' ORDER BY name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST créer une ville - requires create permission
router.post('/', authenticateToken, requirePermission('accounting.cities.create'), async (req, res) => {
  try {
    const { id, name, code, segment_id } = req.body;

    if (!id || !name || !code || !segment_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await pool.query(
      'INSERT INTO cities (id, name, code, segment_id) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, name, code, segment_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating city:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT mettre à jour une ville
 * Protected: RBAC + SBAC - can only update cities in scope
 */
router.put('/:id',
  authenticateToken,
  requirePermission('accounting.cities.update'),
  injectUserScope,
  async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, segment_id } = req.body;

    let query = 'UPDATE cities SET name = $1, code = $2, segment_id = $3 WHERE id = $4';
    const params = [name, code, segment_id, id];

    // SBAC: Verify access
    const scopeFilter = buildScopeFilter(req, 'segment_id', 'id');
    if (scopeFilter.hasScope) {
      query += ' AND (' + scopeFilter.conditions.map((condition, index) => {
        return condition.replace(/\$(\d+)/g, (match, num) => `$${params.length + parseInt(num)}`);
      }).join(' OR ') + ')';
      params.push(...scopeFilter.params);
    }

    query += ' RETURNING *';
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'City not found or access denied', code: 'NOT_FOUND_OR_ACCESS_DENIED' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating city:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE supprimer une ville
 * Protected: RBAC + SBAC - can only delete cities in scope
 */
router.delete('/:id',
  authenticateToken,
  requirePermission('accounting.cities.delete'),
  injectUserScope,
  async (req, res) => {
  try {
    const { id } = req.params;

    let query = 'DELETE FROM cities WHERE id = $1';
    const params = [id];

    // SBAC: Verify access
    const scopeFilter = buildScopeFilter(req, 'segment_id', 'id');
    if (scopeFilter.hasScope) {
      query += ' AND (' + scopeFilter.conditions.map((condition, index) => {
        return condition.replace(/\$(\d+)/g, (match, num) => `$${params.length + parseInt(num)}`);
      }).join(' OR ') + ')';
      params.push(...scopeFilter.params);
    }

    query += ' RETURNING *';
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'City not found or access denied', code: 'NOT_FOUND_OR_ACCESS_DENIED' });
    }

    res.json({ message: 'City deleted successfully' });
  } catch (error) {
    console.error('Error deleting city:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// GOOGLE CONTACTS CONFIGURATION ENDPOINTS
// ============================================================

/**
 * GET /api/cities/:id/google-config - Récupérer la config Google d'une ville
 * Protected: Admin only
 */
router.get('/:id/google-config',
  authenticateToken,
  requirePermission('admin.manage_system'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const { rows } = await pool.query(
        'SELECT id, name, google_sync_enabled FROM cities WHERE id = $1',
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Ville non trouvée' });
      }

      // Récupérer les stats de sync
      const stats = await googleContactsService.getStatsForCity(id);

      // Tester la connexion si activée
      let connectionStatus = null;
      if (rows[0].google_sync_enabled) {
        connectionStatus = await googleContactsService.testConnection(id);
      }

      res.json({
        city: rows[0],
        stats,
        connectionStatus,
        hasToken: !!rows[0].google_token
      });
    } catch (error) {
      console.error('Error fetching Google config:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * PUT /api/cities/:id/google-config - Mettre à jour la config Google d'une ville
 * Protected: Admin only
 */
router.put('/:id/google-config',
  authenticateToken,
  requirePermission('admin.manage_system'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { google_token, google_sync_enabled } = req.body;

      // Vérifier que la ville existe
      const { rows: cities } = await pool.query(
        'SELECT id, name FROM cities WHERE id = $1',
        [id]
      );

      if (cities.length === 0) {
        return res.status(404).json({ error: 'Ville non trouvée' });
      }

      // Préparer la mise à jour
      const updates = [];
      const params = [];
      let paramIndex = 1;

      if (google_token !== undefined) {
        // Valider le format du token
        try {
          const tokenData = typeof google_token === 'string'
            ? JSON.parse(google_token)
            : google_token;

          if (!tokenData.refresh_token || !tokenData.client_id) {
            return res.status(400).json({ error: 'Token invalide: refresh_token et client_id requis' });
          }

          updates.push(`google_token = $${paramIndex++}`);
          params.push(JSON.stringify(tokenData));
        } catch (e) {
          return res.status(400).json({ error: 'Token JSON invalide' });
        }
      }

      if (google_sync_enabled !== undefined) {
        updates.push(`google_sync_enabled = $${paramIndex++}`);
        params.push(google_sync_enabled);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'Aucune donnée à mettre à jour' });
      }

      params.push(id);
      const query = `UPDATE cities SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, name, google_sync_enabled`;

      const { rows } = await pool.query(query, params);

      // Tester la connexion si activée
      let connectionStatus = null;
      if (rows[0].google_sync_enabled && google_token) {
        connectionStatus = await googleContactsService.testConnection(id);
      }

      res.json({
        message: 'Configuration Google mise à jour',
        city: rows[0],
        connectionStatus
      });
    } catch (error) {
      console.error('Error updating Google config:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /api/cities/:id/google-test - Tester la connexion Google d'une ville
 * Protected: Admin only
 */
router.post('/:id/google-test',
  authenticateToken,
  requirePermission('admin.manage_system'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await googleContactsService.testConnection(id);
      res.json(result);
    } catch (error) {
      console.error('Error testing Google connection:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /api/cities/:id/google-sync - Synchroniser tous les prospects pending d'une ville
 * Protected: Admin only
 */
router.post('/:id/google-sync',
  authenticateToken,
  requirePermission('admin.manage_system'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { limit = 50 } = req.body;

      const stats = await googleContactsService.syncPendingForCity(id, limit);
      res.json({
        message: 'Synchronisation terminée',
        stats
      });
    } catch (error) {
      console.error('Error syncing Google contacts:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/cities/google-stats - Stats Google de toutes les villes
 * Protected: Admin only
 */
router.get('/google/stats',
  authenticateToken,
  requirePermission('admin.manage_system'),
  async (req, res) => {
    try {
      const { rows } = await pool.query(`
        SELECT
          c.id,
          c.name,
          c.code,
          c.google_sync_enabled,
          s.name as segment_name,
          COUNT(p.id) as total_prospects,
          COUNT(CASE WHEN p.google_sync_status = 'synced' THEN 1 END) as synced,
          COUNT(CASE WHEN p.google_sync_status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN p.google_sync_status = 'failed' THEN 1 END) as failed
        FROM cities c
        LEFT JOIN segments s ON c.segment_id = s.id
        LEFT JOIN prospects p ON p.ville_id = c.id
        GROUP BY c.id, c.name, c.code, c.google_sync_enabled, s.name
        ORDER BY s.name, c.name
      `);

      res.json(rows);
    } catch (error) {
      console.error('Error fetching Google stats:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET une ville par ID
 * Protected: SBAC filtering only
 * IMPORTANT: Cette route doit être APRÈS toutes les routes GET spécifiques
 * (/by-segment/:segmentId, /google/stats) pour éviter qu'elle les intercepte
 */
router.get('/:id',
  authenticateToken,
  injectUserScope,
  async (req, res) => {
    try {
      const { id } = req.params;

      let query = `
        SELECT c.id, c.name, c.code, c.segment_id, c.created_at,
               s.name as segment_name, s.color as segment_color
        FROM cities c
        LEFT JOIN segments s ON c.segment_id = s.id
        WHERE c.id = $1
      `;
      const params = [id];

      // SBAC: Apply scope filtering
      const scopeFilter = buildScopeFilter(req, null, 'c.id');
      if (scopeFilter.hasScope) {
        query += ' AND (' + scopeFilter.conditions.map((condition, index) => {
          return condition.replace(/\$(\d+)/g, (match, num) => `$${params.length + parseInt(num)}`);
        }).join(' OR ') + ')';
        params.push(...scopeFilter.params);
      }

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'City not found or access denied' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching city:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
