import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import { injectUserScope, buildScopeFilter } from '../middleware/requireScope.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Configuration multer pour upload logo segment
const UPLOADS_DIR = process.env.UPLOADS_PATH || path.join(__dirname, '../../uploads');
const LOGOS_DIR = path.join(UPLOADS_DIR, 'segments');

// Créer le dossier si nécessaire
if (!fs.existsSync(LOGOS_DIR)) {
  fs.mkdirSync(LOGOS_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, LOGOS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${req.params.id}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.png', '.jpg', '.jpeg', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

/**
 * GET tous les segments
 * Protected: SBAC filtering only (no permission check)
 * Non-admin users only see segments they are assigned to
 * Permission check removed to allow dropdown usage without view_page permission
 */
router.get('/',
  authenticateToken,
  injectUserScope,
  async (req, res) => {
  try {
    // Build base query
    let query = 'SELECT * FROM segments';
    const params = [];

    // SBAC: Apply scope filtering (non-admins see only their assigned segments)
    const scopeFilter = buildScopeFilter(req, 'id', null);  // Filter by segment id

    if (scopeFilter.hasScope) {
      query += ' WHERE (' + scopeFilter.conditions.join(' OR ') + ')';
      params.push(...scopeFilter.params);
    }

    query += ' ORDER BY name';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching segments:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET un segment par ID
 * Protected: SBAC only - non-admins can only access segments in their scope
 * Permission check removed to allow dropdown usage without view_page permission
 */
router.get('/:id',
  authenticateToken,
  injectUserScope,
  async (req, res) => {
  try {
    const { id } = req.params;

    // Build query with scope filter
    let query = 'SELECT * FROM segments WHERE id = $1';
    const params = [id];

    // SBAC: Verify user has access to this segment
    const scopeFilter = buildScopeFilter(req, 'id', null);

    if (scopeFilter.hasScope) {
      query += ' AND (' + scopeFilter.conditions.map((condition, index) => {
        return condition.replace(/\$(\d+)/g, (match, num) => `$${params.length + parseInt(num)}`);
      }).join(' OR ') + ')';
      params.push(...scopeFilter.params);
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Segment not found or access denied',
        code: 'NOT_FOUND_OR_ACCESS_DENIED'
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching segment:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST créer un segment - requires create permission
router.post('/', authenticateToken, requirePermission('accounting.segments.create'), async (req, res) => {
  try {
    const { id, name, color, cnss_number, identifiant_fiscal, registre_commerce, ice, company_address } = req.body;

    if (!id || !name) {
      return res.status(400).json({ error: 'Missing required fields: id, name' });
    }

    const result = await pool.query(
      `INSERT INTO segments (id, name, color, cnss_number, identifiant_fiscal, registre_commerce, ice, company_address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [id, name, color || '#3B82F6', cnss_number || null, identifiant_fiscal || null, registre_commerce || null, ice || null, company_address || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating segment:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT mettre à jour un segment
 * Protected: RBAC + SBAC - non-admins can only update segments in their scope
 */
router.put('/:id',
  authenticateToken,
  requirePermission('accounting.segments.update'),
  injectUserScope,
  async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, cnss_number, identifiant_fiscal, registre_commerce, ice, company_address } = req.body;

    // Build update query with scope filter
    let query = `UPDATE segments SET
      name = $1, color = $2, cnss_number = $3,
      identifiant_fiscal = $4, registre_commerce = $5,
      ice = $6, company_address = $7
      WHERE id = $8`;
    const params = [
      name, color, cnss_number || null,
      identifiant_fiscal || null, registre_commerce || null,
      ice || null, company_address || null, id
    ];

    // SBAC: Verify user has access to this segment
    const scopeFilter = buildScopeFilter(req, 'id', null);

    if (scopeFilter.hasScope) {
      query += ' AND (' + scopeFilter.conditions.map((condition, index) => {
        return condition.replace(/\$(\d+)/g, (match, num) => `$${params.length + parseInt(num)}`);
      }).join(' OR ') + ')';
      params.push(...scopeFilter.params);
    }

    query += ' RETURNING *';

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Segment not found or access denied',
        code: 'NOT_FOUND_OR_ACCESS_DENIED'
      });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating segment:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE supprimer un segment
 * Protected: RBAC + SBAC - non-admins can only delete segments in their scope
 */
router.delete('/:id',
  authenticateToken,
  requirePermission('accounting.segments.delete'),
  injectUserScope,
  async (req, res) => {
  try {
    const { id } = req.params;

    // Build delete query with scope filter
    let query = 'DELETE FROM segments WHERE id = $1';
    const params = [id];

    // SBAC: Verify user has access to this segment
    const scopeFilter = buildScopeFilter(req, 'id', null);

    if (scopeFilter.hasScope) {
      query += ' AND (' + scopeFilter.conditions.map((condition, index) => {
        return condition.replace(/\$(\d+)/g, (match, num) => `$${params.length + parseInt(num)}`);
      }).join(' OR ') + ')';
      params.push(...scopeFilter.params);
    }

    query += ' RETURNING *';

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Segment not found or access denied',
        code: 'NOT_FOUND_OR_ACCESS_DENIED'
      });
    }

    res.json({ message: 'Segment deleted successfully' });
  } catch (error) {
    console.error('Error deleting segment:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST upload logo pour un segment
 * Protected: RBAC - requires update permission
 */
router.post('/:id/logo',
  authenticateToken,
  requirePermission('accounting.segments.update'),
  upload.single('logo'),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const logoUrl = `/uploads/segments/${req.file.filename}`;

      const result = await pool.query(
        'UPDATE segments SET logo_url = $1 WHERE id = $2 RETURNING *',
        [logoUrl, id]
      );

      if (result.rows.length === 0) {
        // Supprimer le fichier uploadé si segment pas trouvé
        fs.unlinkSync(path.join(LOGOS_DIR, req.file.filename));
        return res.status(404).json({ error: 'Segment not found' });
      }

      res.json({ success: true, segment: result.rows[0] });
    } catch (error) {
      console.error('Error uploading logo:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * DELETE supprimer le logo d'un segment
 */
router.delete('/:id/logo',
  authenticateToken,
  requirePermission('accounting.segments.update'),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Récupérer le segment pour connaître le chemin du logo
      const segmentResult = await pool.query(
        'SELECT logo_url FROM segments WHERE id = $1',
        [id]
      );

      if (segmentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Segment not found' });
      }

      const logoUrl = segmentResult.rows[0].logo_url;

      // Supprimer le fichier si existe
      if (logoUrl) {
        const logoPath = path.join(LOGOS_DIR, path.basename(logoUrl));
        if (fs.existsSync(logoPath)) {
          fs.unlinkSync(logoPath);
        }
      }

      // Mettre à jour en DB
      const result = await pool.query(
        'UPDATE segments SET logo_url = NULL WHERE id = $1 RETURNING *',
        [id]
      );

      res.json({ success: true, segment: result.rows[0] });
    } catch (error) {
      console.error('Error deleting logo:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
