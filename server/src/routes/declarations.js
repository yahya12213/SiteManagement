import express from 'express';
import pool from '../config/database.js';
import { requirePermission } from '../middleware/auth.js';
import { injectUserScope, buildScopeFilter, requireRecordScope, requireRecordScopeOrOwner } from '../middleware/requireScope.js';
import { uploadDeclarationAttachment, deleteFile } from '../middleware/upload.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// GET toutes les déclarations (avec infos jointes)
// Filtre automatiquement par segment ET villes assignés à l'utilisateur connecté
// Permissions: view_all (admin), view_page (comptables), professor view (professeurs)
router.get('/',
  requirePermission(
    'accounting.declarations.view_all',
    'accounting.declarations.view_page',
    'accounting.professor.declarations.view_page'
  ),
  injectUserScope,
  async (req, res) => {
    try {
      const { professor_id } = req.query;

      let query = `
        SELECT pd.*,
               pd.session_name,
               p.full_name as professor_name,
               s.name as segment_name,
               c.name as city_name,
               cs.title as sheet_title
        FROM professor_declarations pd
        LEFT JOIN profiles p ON pd.professor_id = p.id
        LEFT JOIN segments s ON pd.segment_id = s.id
        LEFT JOIN cities c ON pd.city_id = c.id
        LEFT JOIN calculation_sheets cs ON pd.calculation_sheet_id = cs.id
      `;

      const params = [];
      const conditions = [];

      // Filtrer par professeur si spécifié
      if (professor_id) {
        conditions.push(`pd.professor_id = $${params.length + 1}`);
        params.push(professor_id);
      }

      // SCOPE FILTERING: Filtre automatique par segment ET ville (sauf admin)
      const scopeFilter = buildScopeFilter(req, 'pd.segment_id', 'pd.city_id');
      if (scopeFilter.hasScope) {
        // Adjust parameter indices for scope filter
        const adjustedScopeConditions = scopeFilter.conditions.map(condition => {
          return condition.replace(/\$(\d+)/g, (match, num) => {
            return `$${params.length + parseInt(num)}`;
          });
        });
        conditions.push(...adjustedScopeConditions);
        params.push(...scopeFilter.params);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY pd.created_at DESC';

      console.log('Declarations query:', {
        isAdmin: req.userScope?.isAdmin,
        segments: req.userScope?.segmentIds?.length,
        cities: req.userScope?.cityIds?.length
      });

      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching declarations:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// GET une déclaration par ID
// Permissions: view_page (admin/comptables), professor view (professeurs)
// SCOPE: Vérifie que la déclaration est dans le segment/ville de l'utilisateur OU que l'utilisateur est le propriétaire
router.get('/:id',
  requirePermission(
    'accounting.declarations.view_page',
    'accounting.declarations.view_all',
    'accounting.professor.declarations.view_page'
  ),
  injectUserScope,
  requireRecordScopeOrOwner('professor_declarations', 'id', 'professor_id', 'segment_id', 'city_id'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(`
        SELECT pd.*,
               pd.session_name,
               p.full_name as professor_name,
               s.name as segment_name,
               c.name as city_name,
               cs.title as sheet_title,
               cs.template_data
        FROM professor_declarations pd
        LEFT JOIN profiles p ON pd.professor_id = p.id
        LEFT JOIN segments s ON pd.segment_id = s.id
        LEFT JOIN cities c ON pd.city_id = c.id
        LEFT JOIN calculation_sheets cs ON pd.calculation_sheet_id = cs.id
        WHERE pd.id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Declaration not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching declaration:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// POST créer une déclaration
// Permissions: create (admin), fill (professeurs)
// SCOPE: Vérifie que le segment_id et city_id sont dans le scope de l'utilisateur
router.post('/',
  requirePermission(
    'accounting.declarations.create',
    'accounting.professor.declarations.fill'
  ),
  injectUserScope,
  async (req, res) => {
    try {
      const { id, professor_id, calculation_sheet_id, segment_id, city_id, start_date, end_date, form_data, status, session_name } = req.body;

      // SCOPE VALIDATION: Vérifier que le segment et la ville sont dans le scope de l'utilisateur
      if (!req.userScope.isAdmin) {
        const hasSegment = req.userScope.segmentIds.includes(segment_id);
        const hasCity = req.userScope.cityIds.includes(city_id);

        if (!hasSegment || !hasCity) {
          return res.status(403).json({
            error: 'Cannot create declaration outside your assigned scope (segment/city)',
            code: 'OUTSIDE_SCOPE'
          });
        }
      }

      // Vérifier si une déclaration identique existe déjà
      // (même professeur, segment, ville et période - peu importe le modèle de fiche)
      const duplicateCheck = await pool.query(
        `SELECT id FROM professor_declarations
         WHERE professor_id = $1
         AND segment_id = $2
         AND city_id = $3
         AND start_date = $4
         AND end_date = $5`,
        [professor_id, segment_id, city_id, start_date, end_date]
      );

      if (duplicateCheck.rows.length > 0) {
        return res.status(409).json({
          error: 'Une déclaration existe déjà pour cette période, ville et segment'
        });
      }

      // Utiliser le statut fourni, ou 'brouillon' par défaut
      const declarationStatus = status || 'brouillon';

      const result = await pool.query(
        `INSERT INTO professor_declarations (id, professor_id, calculation_sheet_id, segment_id, city_id, start_date, end_date, form_data, status, session_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [id, professor_id, calculation_sheet_id, segment_id, city_id, start_date, end_date, form_data || '{}', declarationStatus, session_name || '']
      );

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating declaration:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// PUT mettre à jour une déclaration
// Permissions: fill_data (remplir données), edit_metadata (modifier métadonnées), approve (validation), fill (professeurs)
// SCOPE: Vérifie que la déclaration est dans le segment/ville de l'utilisateur OU que l'utilisateur est le propriétaire
router.put('/:id',
  requirePermission(
    'accounting.declarations.fill_data',
    'accounting.declarations.edit_metadata',
    'accounting.declarations.approve',
    'accounting.professor.declarations.fill'
  ),
  injectUserScope,
  requireRecordScopeOrOwner('professor_declarations', 'id', 'professor_id', 'segment_id', 'city_id'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { form_data, status, rejection_reason, segment_id, city_id, start_date, end_date, session_name } = req.body;

      // SCOPE VALIDATION: Si l'utilisateur modifie segment_id ou city_id, vérifier qu'ils sont dans son scope
      if (!req.userScope.isAdmin) {
        if (segment_id !== undefined && !req.userScope.segmentIds.includes(segment_id)) {
          return res.status(403).json({
            error: 'Cannot move declaration to a segment outside your scope',
            code: 'OUTSIDE_SCOPE'
          });
        }
        if (city_id !== undefined && !req.userScope.cityIds.includes(city_id)) {
          return res.status(403).json({
            error: 'Cannot move declaration to a city outside your scope',
            code: 'OUTSIDE_SCOPE'
          });
        }
      }

      // Construire dynamiquement la requête SQL en fonction des champs fournis
      const updates = [];
      const params = [];
      let paramCount = 1;

      // Champs de métadonnées modifiables par l'admin
      if (segment_id !== undefined) {
        updates.push(`segment_id = $${paramCount++}`);
        params.push(segment_id);
      }
      if (city_id !== undefined) {
        updates.push(`city_id = $${paramCount++}`);
        params.push(city_id);
      }
      if (start_date !== undefined) {
        updates.push(`start_date = $${paramCount++}`);
        params.push(start_date);
      }
      if (end_date !== undefined) {
        updates.push(`end_date = $${paramCount++}`);
        params.push(end_date);
      }
      if (session_name !== undefined) {
        updates.push(`session_name = $${paramCount++}`);
        params.push(session_name);
      }

      // Champs standards
      if (form_data !== undefined) {
        updates.push(`form_data = $${paramCount++}`);
        params.push(form_data);
      }
      if (status !== undefined) {
        updates.push(`status = $${paramCount++}`);
        params.push(status);
      }
      if (rejection_reason !== undefined) {
        updates.push(`rejection_reason = $${paramCount++}`);
        params.push(rejection_reason || null);
      }

      // Timestamps conditionnels
      if (status === 'soumise') {
        updates.push('submitted_at = CURRENT_TIMESTAMP');
      } else if (status === 'approuvee' || status === 'refusee') {
        updates.push('reviewed_at = CURRENT_TIMESTAMP');
      }

      // Toujours mettre à jour updated_at
      updates.push('updated_at = CURRENT_TIMESTAMP');

      if (updates.length === 1) { // Seulement updated_at
        return res.status(400).json({ error: 'No fields to update' });
      }

      const query = `UPDATE professor_declarations SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;
      params.push(id);

      const result = await pool.query(query, params);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Declaration not found' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating declaration:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// DELETE supprimer une déclaration
// Permissions: delete (admin only)
// SCOPE: Vérifie que la déclaration est dans le segment/ville de l'utilisateur
router.delete('/:id',
  requirePermission('accounting.declarations.delete'),
  injectUserScope,
  requireRecordScope('professor_declarations', 'id', 'segment_id', 'city_id'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const result = await pool.query('DELETE FROM professor_declarations WHERE id = $1 RETURNING id', [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Declaration not found' });
      }

      res.json({ message: 'Declaration deleted successfully' });
    } catch (error) {
      console.error('Error deleting declaration:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ==========================================
// ROUTES PIÈCES JOINTES (ATTACHMENTS)
// ==========================================

// POST - Upload une pièce jointe pour une déclaration
// Permission: fill_data (pour ajouter des pièces jointes) ou fill (professeurs)
// SCOPE: Vérifie que la déclaration est dans le segment/ville de l'utilisateur OU que l'utilisateur est le propriétaire
router.post('/:id/attachments',
  requirePermission(
    'accounting.declarations.fill_data',
    'accounting.professor.declarations.fill'
  ),
  injectUserScope,
  requireRecordScopeOrOwner('professor_declarations', 'id', 'professor_id', 'segment_id', 'city_id'),
  (req, res, next) => {
    uploadDeclarationAttachment(req, res, (err) => {
      if (err) {
        console.error('Upload error:', err);
        return res.status(400).json({ error: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const { id } = req.params;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Vérifier que la déclaration existe
      const declarationCheck = await pool.query(
        'SELECT id FROM professor_declarations WHERE id = $1',
        [id]
      );

      if (declarationCheck.rows.length === 0) {
        // Supprimer le fichier uploadé si la déclaration n'existe pas
        const uploadsDir = process.env.UPLOADS_PATH || path.join(__dirname, '../../uploads');
        const filePath = path.join(uploadsDir, 'declarations', file.filename);
        deleteFile(filePath);
        return res.status(404).json({ error: 'Declaration not found' });
      }

      // Enregistrer l'attachment dans la base de données
      const fileUrl = `/uploads/declarations/${file.filename}`;
      const result = await pool.query(`
        INSERT INTO declaration_attachments (
          declaration_id,
          filename,
          original_filename,
          file_url,
          file_size,
          mime_type,
          uploaded_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `, [
        id,
        file.filename,
        file.originalname,
        fileUrl,
        file.size,
        file.mimetype,
        req.user.userId
      ]);

      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error saving attachment:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// GET - Récupérer toutes les pièces jointes d'une déclaration
// Permission: view_page (pour voir les pièces jointes)
// SCOPE: Vérifie que la déclaration est dans le segment/ville de l'utilisateur OU que l'utilisateur est le propriétaire
router.get('/:id/attachments',
  requirePermission(
    'accounting.declarations.view_page',
    'accounting.declarations.view_all',
    'accounting.professor.declarations.view_page'
  ),
  injectUserScope,
  requireRecordScopeOrOwner('professor_declarations', 'id', 'professor_id', 'segment_id', 'city_id'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(`
        SELECT
          da.*,
          p.full_name as uploaded_by_name
        FROM declaration_attachments da
        LEFT JOIN profiles p ON da.uploaded_by = p.id
        WHERE da.declaration_id = $1
        ORDER BY da.uploaded_at DESC
      `, [id]);

      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching attachments:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// DELETE - Supprimer une pièce jointe
// Permission: fill_data ou delete (pour supprimer des pièces jointes), fill (professeurs)
// SCOPE: Vérifie que la déclaration est dans le segment/ville de l'utilisateur OU que l'utilisateur est le propriétaire
router.delete('/:id/attachments/:attachmentId',
  requirePermission(
    'accounting.declarations.fill_data',
    'accounting.declarations.delete',
    'accounting.professor.declarations.fill'
  ),
  injectUserScope,
  requireRecordScopeOrOwner('professor_declarations', 'id', 'professor_id', 'segment_id', 'city_id'),
  async (req, res) => {
    try {
      const { id, attachmentId } = req.params;

      // Récupérer les informations du fichier avant suppression
      const attachmentResult = await pool.query(
        'SELECT * FROM declaration_attachments WHERE id = $1 AND declaration_id = $2',
        [attachmentId, id]
      );

      if (attachmentResult.rows.length === 0) {
        return res.status(404).json({ error: 'Attachment not found' });
      }

      const attachment = attachmentResult.rows[0];

      // Supprimer le fichier du disque
      const uploadsDir = process.env.UPLOADS_PATH || path.join(__dirname, '../../uploads');
      const filePath = path.join(uploadsDir, 'declarations', attachment.filename);
      const fileDeleted = deleteFile(filePath);

      if (!fileDeleted) {
        console.warn(`Warning: File not found or couldn't be deleted: ${filePath}`);
      }

      // Supprimer l'enregistrement de la base de données
      await pool.query(
        'DELETE FROM declaration_attachments WHERE id = $1',
        [attachmentId]
      );

      res.json({
        message: 'Attachment deleted successfully',
        fileDeleted: fileDeleted
      });
    } catch (error) {
      console.error('Error deleting attachment:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

export default router;
