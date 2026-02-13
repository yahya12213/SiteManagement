import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { injectUserScope } from '../middleware/requireScope.js';

const router = express.Router();

// GET diagnostic - Affiche toutes les fiches avec les noms complets des segments et villes
// Protected: SBAC filtering only (no permission check)
// Non-admin users only see sheets within their assigned segments/cities
// Permission check removed to allow dropdown usage without view_page permission
router.get('/diagnostic',
  authenticateToken,
  injectUserScope,
  async (req, res) => {
  const client = await pool.connect();
  try {
    // Build query with SBAC filtering
    let query = 'SELECT * FROM calculation_sheets';
    const params = [];

    // SBAC: Apply scope filtering for non-admin users
    if (req.userScope && !req.userScope.isAdmin) {
      const { segmentIds, cityIds } = req.userScope;

      if (segmentIds.length === 0 && cityIds.length === 0) {
        // User has no scope assigned - return empty result
        return res.json({ total_sheets: 0, sheets: [] });
      }

      // Filter: sheet must have at least one segment OR one city in user's scope
      query += ' WHERE (';
      const conditions = [];

      if (segmentIds.length > 0) {
        const segmentPlaceholders = segmentIds.map((_, idx) => `$${params.length + idx + 1}`).join(', ');
        conditions.push(`EXISTS (
          SELECT 1 FROM calculation_sheet_segments css
          WHERE css.sheet_id = calculation_sheets.id
          AND css.segment_id IN (${segmentPlaceholders})
        )`);
        params.push(...segmentIds);
      }

      if (cityIds.length > 0) {
        const cityPlaceholders = cityIds.map((_, idx) => `$${params.length + idx + 1}`).join(', ');
        conditions.push(`EXISTS (
          SELECT 1 FROM calculation_sheet_cities csc
          WHERE csc.sheet_id = calculation_sheets.id
          AND csc.city_id IN (${cityPlaceholders})
        )`);
        params.push(...cityIds);
      }

      query += conditions.join(' OR ') + ')';
    }

    query += ' ORDER BY created_at DESC';

    const sheetsResult = await client.query(query, params);
    const sheets = sheetsResult.rows;

    const diagnosticData = [];

    for (const sheet of sheets) {
      // Récupérer les segments avec leurs noms
      const segmentsResult = await client.query(
        `SELECT s.id, s.name, s.color
         FROM calculation_sheet_segments css
         JOIN segments s ON css.segment_id = s.id
         WHERE css.sheet_id = $1
         ORDER BY s.name`,
        [sheet.id]
      );

      // Récupérer les villes avec leurs noms
      const citiesResult = await client.query(
        `SELECT c.id, c.name, s.name as segment_name
         FROM calculation_sheet_cities csc
         JOIN cities c ON csc.city_id = c.id
         JOIN segments s ON c.segment_id = s.id
         WHERE csc.sheet_id = $1
         ORDER BY c.name`,
        [sheet.id]
      );

      diagnosticData.push({
        id: sheet.id,
        title: sheet.title,
        status: sheet.status,
        sheet_date: sheet.sheet_date,
        created_at: sheet.created_at,
        segments: segmentsResult.rows,
        segment_count: segmentsResult.rows.length,
        segment_ids: segmentsResult.rows.map(s => s.id),
        cities: citiesResult.rows,
        city_count: citiesResult.rows.length,
        city_ids: citiesResult.rows.map(c => c.id),
        city_names: citiesResult.rows.map(c => c.name),
      });
    }

    res.json({
      total_sheets: diagnosticData.length,
      sheets: diagnosticData,
    });
  } catch (error) {
    console.error('Error fetching diagnostic data:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// GET toutes les fiches
// Protected: SBAC filtering only (no permission check)
// Non-admin users only see sheets within their assigned segments/cities
// Permission check removed to allow dropdown usage without view_page permission
router.get('/',
  authenticateToken,
  injectUserScope,
  async (req, res) => {
  const client = await pool.connect();
  try {
    // Build query with SBAC filtering
    let query = 'SELECT * FROM calculation_sheets';
    const params = [];

    // SBAC: Apply scope filtering for non-admin users
    if (req.userScope && !req.userScope.isAdmin) {
      const { segmentIds, cityIds } = req.userScope;

      if (segmentIds.length === 0 && cityIds.length === 0) {
        // User has no scope assigned - return empty result
        return res.json([]);
      }

      // Filter: sheet must have at least one segment OR one city in user's scope
      query += ' WHERE (';
      const conditions = [];

      if (segmentIds.length > 0) {
        const segmentPlaceholders = segmentIds.map((_, idx) => `$${params.length + idx + 1}`).join(', ');
        conditions.push(`EXISTS (
          SELECT 1 FROM calculation_sheet_segments css
          WHERE css.sheet_id = calculation_sheets.id
          AND css.segment_id IN (${segmentPlaceholders})
        )`);
        params.push(...segmentIds);
      }

      if (cityIds.length > 0) {
        const cityPlaceholders = cityIds.map((_, idx) => `$${params.length + idx + 1}`).join(', ');
        conditions.push(`EXISTS (
          SELECT 1 FROM calculation_sheet_cities csc
          WHERE csc.sheet_id = calculation_sheets.id
          AND csc.city_id IN (${cityPlaceholders})
        )`);
        params.push(...cityIds);
      }

      query += conditions.join(' OR ') + ')';
    }

    query += ' ORDER BY created_at DESC';

    const sheetsResult = await client.query(query, params);
    const sheets = sheetsResult.rows;

    // Enrichir avec segments et villes
    for (const sheet of sheets) {
      const segmentsResult = await client.query(
        'SELECT segment_id FROM calculation_sheet_segments WHERE sheet_id = $1',
        [sheet.id]
      );
      sheet.segment_ids = segmentsResult.rows.map(row => row.segment_id);

      const citiesResult = await client.query(
        'SELECT city_id FROM calculation_sheet_cities WHERE sheet_id = $1',
        [sheet.id]
      );
      sheet.city_ids = citiesResult.rows.map(row => row.city_id);
    }

    res.json(sheets);
  } catch (error) {
    console.error('Error fetching sheets:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// GET une fiche par ID
// Protected: SBAC only - non-admins can only access sheets within their assigned segments/cities
// Permission check removed to allow dropdown usage without view_page permission
router.get('/:id',
  authenticateToken,
  injectUserScope,
  async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    // Build query with SBAC filtering
    let query = 'SELECT * FROM calculation_sheets WHERE id = $1';
    const params = [id];

    // SBAC: Apply scope filtering for non-admin users
    if (req.userScope && !req.userScope.isAdmin) {
      const { segmentIds, cityIds } = req.userScope;

      if (segmentIds.length === 0 && cityIds.length === 0) {
        // User has no scope assigned - return 403
        return res.status(403).json({
          success: false,
          error: 'Access denied. No scope assigned.',
          code: 'NO_SCOPE'
        });
      }

      // Verify sheet is within user's scope
      query += ' AND (';
      const conditions = [];

      if (segmentIds.length > 0) {
        const segmentPlaceholders = segmentIds.map((_, idx) => `$${params.length + idx + 1}`).join(', ');
        conditions.push(`EXISTS (
          SELECT 1 FROM calculation_sheet_segments css
          WHERE css.sheet_id = calculation_sheets.id
          AND css.segment_id IN (${segmentPlaceholders})
        )`);
        params.push(...segmentIds);
      }

      if (cityIds.length > 0) {
        const cityPlaceholders = cityIds.map((_, idx) => `$${params.length + idx + 1}`).join(', ');
        conditions.push(`EXISTS (
          SELECT 1 FROM calculation_sheet_cities csc
          WHERE csc.sheet_id = calculation_sheets.id
          AND csc.city_id IN (${cityPlaceholders})
        )`);
        params.push(...cityIds);
      }

      query += conditions.join(' OR ') + ')';
    }

    const sheetResult = await client.query(query, params);

    if (sheetResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sheet not found' });
    }

    const sheet = sheetResult.rows[0];

    // Segments et villes
    const segmentsResult = await client.query(
      'SELECT segment_id FROM calculation_sheet_segments WHERE sheet_id = $1',
      [id]
    );
    sheet.segment_ids = segmentsResult.rows.map(row => row.segment_id);

    const citiesResult = await client.query(
      'SELECT city_id FROM calculation_sheet_cities WHERE sheet_id = $1',
      [id]
    );
    sheet.city_ids = citiesResult.rows.map(row => row.city_id);

    res.json(sheet);
  } catch (error) {
    console.error('Error fetching sheet:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// POST créer une fiche
// Permissions: create (admin/comptables)
router.post('/', requirePermission('accounting.calculation_sheets.create'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id, title, template_data, status, sheet_date, segment_ids, city_ids } = req.body;

    await client.query('BEGIN');

    const sheetResult = await client.query(
      'INSERT INTO calculation_sheets (id, title, template_data, status, sheet_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [id, title, template_data, status || 'draft', sheet_date]
    );

    const sheet = sheetResult.rows[0];

    // Ajouter segments
    if (segment_ids && segment_ids.length > 0) {
      for (const segmentId of segment_ids) {
        await client.query(
          'INSERT INTO calculation_sheet_segments (sheet_id, segment_id) VALUES ($1, $2)',
          [id, segmentId]
        );
      }
      sheet.segment_ids = segment_ids;
    }

    // Ajouter villes
    if (city_ids && city_ids.length > 0) {
      for (const cityId of city_ids) {
        await client.query(
          'INSERT INTO calculation_sheet_cities (sheet_id, city_id) VALUES ($1, $2)',
          [id, cityId]
        );
      }
      sheet.city_ids = city_ids;
    }

    await client.query('COMMIT');
    res.status(201).json(sheet);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating sheet:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// PUT mettre à jour une fiche
// Permissions: update (admin/comptables), publish (pour publier)
router.put('/:id', requirePermission('accounting.calculation_sheets.update', 'accounting.calculation_sheets.publish'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { title, template_data, status, sheet_date, segment_ids, city_ids } = req.body;

    await client.query('BEGIN');

    const sheetResult = await client.query(
      'UPDATE calculation_sheets SET title = $1, template_data = $2, status = $3, sheet_date = $4, updated_at = CURRENT_TIMESTAMP WHERE id = $5 RETURNING *',
      [title, template_data, status, sheet_date, id]
    );

    if (sheetResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sheet not found' });
    }

    const sheet = sheetResult.rows[0];

    // Mettre à jour segments
    await client.query('DELETE FROM calculation_sheet_segments WHERE sheet_id = $1', [id]);
    if (segment_ids && segment_ids.length > 0) {
      for (const segmentId of segment_ids) {
        await client.query(
          'INSERT INTO calculation_sheet_segments (sheet_id, segment_id) VALUES ($1, $2)',
          [id, segmentId]
        );
      }
      sheet.segment_ids = segment_ids;
    }

    // Mettre à jour villes
    await client.query('DELETE FROM calculation_sheet_cities WHERE sheet_id = $1', [id]);
    if (city_ids && city_ids.length > 0) {
      for (const cityId of city_ids) {
        await client.query(
          'INSERT INTO calculation_sheet_cities (sheet_id, city_id) VALUES ($1, $2)',
          [id, cityId]
        );
      }
      sheet.city_ids = city_ids;
    }

    await client.query('COMMIT');
    res.json(sheet);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating sheet:', error);
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
});

// DELETE supprimer une fiche
// Permissions: delete (admin/comptables)
router.delete('/:id', requirePermission('accounting.calculation_sheets.delete'), async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM calculation_sheets WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sheet not found' });
    }

    res.json({ message: 'Sheet deleted successfully' });
  } catch (error) {
    console.error('Error deleting sheet:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
