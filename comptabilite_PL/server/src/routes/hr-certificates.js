/**
 * HR Work Certificates Routes
 * API endpoints for managing "Attestations de Travail"
 */

import express from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import pool from '../config/database.js';
import { WorkCertificatePDFGenerator } from '../services/workCertificatePDFGenerator.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();
const pdfGenerator = new WorkCertificatePDFGenerator();

// Ensure uploads directory exists
const UPLOADS_BASE = process.env.UPLOADS_PATH || path.join(__dirname, '../../uploads');
const CERTIFICATES_DIR = path.join(UPLOADS_BASE, 'work-certificates');
if (!fs.existsSync(CERTIFICATES_DIR)) {
  fs.mkdirSync(CERTIFICATES_DIR, { recursive: true });
}

/**
 * Generate certificate number
 */
async function generateCertificateNumber(client) {
  const result = await client.query(`SELECT nextval('hr_work_certificate_seq') as num`);
  const num = result.rows[0].num;
  const year = new Date().getFullYear();
  return `ATT-${year}-${String(num).padStart(4, '0')}`;
}

/**
 * GET /api/hr/certificates
 * List all work certificates with filters
 */
router.get('/',
  authenticateToken,
  requirePermission('ressources_humaines.gestion_paie.attestations.voir'),
  async (req, res) => {
    const { employee_id, status, type, start_date, end_date, search } = req.query;

    try {
      let query = `
        SELECT
          wc.*,
          e.first_name, e.last_name, e.employee_number, e.position,
          s.name as segment_name,
          p.full_name as created_by_name
        FROM hr_work_certificates wc
        JOIN hr_employees e ON e.id = wc.employee_id
        LEFT JOIN segments s ON e.segment_id = s.id
        LEFT JOIN profiles p ON wc.created_by = p.id
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 1;

      if (employee_id) {
        query += ` AND wc.employee_id = $${paramCount}`;
        params.push(employee_id);
        paramCount++;
      }

      if (status) {
        query += ` AND wc.status = $${paramCount}`;
        params.push(status);
        paramCount++;
      }

      if (type) {
        query += ` AND wc.certificate_type = $${paramCount}`;
        params.push(type);
        paramCount++;
      }

      if (start_date) {
        query += ` AND wc.issue_date >= $${paramCount}`;
        params.push(start_date);
        paramCount++;
      }

      if (end_date) {
        query += ` AND wc.issue_date <= $${paramCount}`;
        params.push(end_date);
        paramCount++;
      }

      if (search) {
        query += ` AND (
          e.first_name ILIKE $${paramCount} OR
          e.last_name ILIKE $${paramCount} OR
          e.employee_number ILIKE $${paramCount} OR
          wc.certificate_number ILIKE $${paramCount}
        )`;
        params.push(`%${search}%`);
        paramCount++;
      }

      query += ' ORDER BY wc.created_at DESC';

      const result = await pool.query(query, params);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Error fetching work certificates:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/hr/certificates/:id
 * Get single certificate details
 */
router.get('/:id',
  authenticateToken,
  requirePermission('ressources_humaines.gestion_paie.attestations.voir'),
  async (req, res) => {
    const { id } = req.params;

    try {
      const result = await pool.query(`
        SELECT
          wc.*,
          e.first_name, e.last_name, e.employee_number, e.cin, e.position,
          e.hire_date, e.termination_date, e.base_salary, e.gender,
          e.social_security_number as employee_cnss,
          s.name as segment_name,
          p.full_name as created_by_name
        FROM hr_work_certificates wc
        JOIN hr_employees e ON e.id = wc.employee_id
        LEFT JOIN segments s ON e.segment_id = s.id
        LEFT JOIN profiles p ON wc.created_by = p.id
        WHERE wc.id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Attestation non trouvée'
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error fetching work certificate:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/hr/certificates
 * Create a new work certificate
 */
router.post('/',
  authenticateToken,
  requirePermission('ressources_humaines.gestion_paie.attestations.creer'),
  async (req, res) => {
    const {
      employee_id,
      certificate_type,
      purpose,
      issue_date,
      start_date,
      end_date,
      include_salary,
      include_position,
      custom_text,
      generate_pdf
    } = req.body;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Validate employee exists
      const empResult = await client.query(
        'SELECT id FROM hr_employees WHERE id = $1',
        [employee_id]
      );

      if (empResult.rows.length === 0) {
        throw new Error('Employé non trouvé');
      }

      // Generate certificate number
      const certificateNumber = await generateCertificateNumber(client);

      // Create certificate
      const result = await client.query(`
        INSERT INTO hr_work_certificates (
          employee_id, certificate_number, certificate_type, purpose,
          issue_date, start_date, end_date, include_salary, include_position,
          custom_text, status, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        employee_id,
        certificateNumber,
        certificate_type || 'standard',
        purpose || null,
        issue_date || new Date().toISOString().split('T')[0],
        start_date || null,
        end_date || null,
        include_salary || false,
        include_position !== false, // Default true
        custom_text || null,
        'draft',
        req.user.id
      ]);

      const certificate = result.rows[0];

      // Generate PDF if requested
      if (generate_pdf) {
        try {
          const pdfPath = path.join(CERTIFICATES_DIR, `${certificateNumber}.pdf`);
          await pdfGenerator.generateCertificate(certificate.id, pdfPath);

          // Update certificate with PDF URL
          await client.query(`
            UPDATE hr_work_certificates
            SET pdf_url = $1, status = 'generated'
            WHERE id = $2
          `, [`/uploads/work-certificates/${certificateNumber}.pdf`, certificate.id]);

          certificate.pdf_url = `/uploads/work-certificates/${certificateNumber}.pdf`;
          certificate.status = 'generated';
        } catch (pdfError) {
          console.error('Error generating PDF:', pdfError);
          // Don't fail the request, just log the error
        }
      }

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        data: certificate,
        message: 'Attestation créée avec succès'
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating work certificate:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    } finally {
      client.release();
    }
  }
);

/**
 * PUT /api/hr/certificates/:id
 * Update a work certificate
 */
router.put('/:id',
  authenticateToken,
  requirePermission('ressources_humaines.gestion_paie.attestations.creer'),
  async (req, res) => {
    const { id } = req.params;
    const {
      certificate_type,
      purpose,
      issue_date,
      start_date,
      end_date,
      include_salary,
      include_position,
      custom_text
    } = req.body;

    try {
      // Check if certificate exists and is not delivered
      const existingResult = await pool.query(
        'SELECT status FROM hr_work_certificates WHERE id = $1',
        [id]
      );

      if (existingResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Attestation non trouvée'
        });
      }

      if (existingResult.rows[0].status === 'delivered') {
        return res.status(400).json({
          success: false,
          error: 'Impossible de modifier une attestation déjà livrée'
        });
      }

      const result = await pool.query(`
        UPDATE hr_work_certificates
        SET
          certificate_type = COALESCE($1, certificate_type),
          purpose = $2,
          issue_date = COALESCE($3, issue_date),
          start_date = $4,
          end_date = $5,
          include_salary = COALESCE($6, include_salary),
          include_position = COALESCE($7, include_position),
          custom_text = $8,
          status = 'draft',
          updated_at = NOW()
        WHERE id = $9
        RETURNING *
      `, [
        certificate_type,
        purpose,
        issue_date,
        start_date,
        end_date,
        include_salary,
        include_position,
        custom_text,
        id
      ]);

      res.json({
        success: true,
        data: result.rows[0],
        message: 'Attestation mise à jour'
      });
    } catch (error) {
      console.error('Error updating work certificate:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * DELETE /api/hr/certificates/:id
 * Delete a work certificate
 */
router.delete('/:id',
  authenticateToken,
  requirePermission('ressources_humaines.gestion_paie.attestations.supprimer'),
  async (req, res) => {
    const { id } = req.params;

    try {
      // Get certificate to delete associated PDF
      const certResult = await pool.query(
        'SELECT certificate_number, pdf_url FROM hr_work_certificates WHERE id = $1',
        [id]
      );

      if (certResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Attestation non trouvée'
        });
      }

      const cert = certResult.rows[0];

      // Delete from database
      await pool.query('DELETE FROM hr_work_certificates WHERE id = $1', [id]);

      // Delete PDF file if exists
      if (cert.pdf_url) {
        const pdfPath = path.join(CERTIFICATES_DIR, `${cert.certificate_number}.pdf`);
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
        }
      }

      res.json({
        success: true,
        message: 'Attestation supprimée'
      });
    } catch (error) {
      console.error('Error deleting work certificate:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/hr/certificates/:id/pdf
 * Download certificate PDF
 */
router.get('/:id/pdf',
  authenticateToken,
  requirePermission('ressources_humaines.gestion_paie.attestations.telecharger'),
  async (req, res) => {
    const { id } = req.params;
    const { regenerate } = req.query;

    try {
      const certResult = await pool.query(`
        SELECT
          wc.*,
          e.first_name, e.last_name
        FROM hr_work_certificates wc
        JOIN hr_employees e ON e.id = wc.employee_id
        WHERE wc.id = $1
      `, [id]);

      if (certResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Attestation non trouvée'
        });
      }

      const cert = certResult.rows[0];
      const pdfPath = path.join(CERTIFICATES_DIR, `${cert.certificate_number}.pdf`);

      // Generate or regenerate PDF
      if (!fs.existsSync(pdfPath) || regenerate === 'true') {
        await pdfGenerator.generateCertificate(id, pdfPath);

        // Update certificate status
        await pool.query(`
          UPDATE hr_work_certificates
          SET pdf_url = $1, status = 'generated'
          WHERE id = $2
        `, [`/uploads/work-certificates/${cert.certificate_number}.pdf`, id]);
      }

      // Send file
      const fileName = `Attestation_${cert.last_name}_${cert.first_name}_${cert.certificate_number}.pdf`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.sendFile(pdfPath);
    } catch (error) {
      console.error('Error downloading certificate PDF:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * POST /api/hr/certificates/:id/deliver
 * Mark certificate as delivered
 */
router.post('/:id/deliver',
  authenticateToken,
  requirePermission('ressources_humaines.gestion_paie.attestations.creer'),
  async (req, res) => {
    const { id } = req.params;

    try {
      const result = await pool.query(`
        UPDATE hr_work_certificates
        SET status = 'delivered', delivered_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Attestation non trouvée'
        });
      }

      res.json({
        success: true,
        data: result.rows[0],
        message: 'Attestation marquée comme livrée'
      });
    } catch (error) {
      console.error('Error marking certificate as delivered:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

/**
 * GET /api/hr/certificates/stats/summary
 * Get statistics summary
 */
router.get('/stats/summary',
  authenticateToken,
  requirePermission('ressources_humaines.gestion_paie.attestations.voir'),
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(*) FILTER (WHERE status = 'draft') as draft,
          COUNT(*) FILTER (WHERE status = 'generated') as generated,
          COUNT(*) FILTER (WHERE status = 'delivered') as delivered,
          COUNT(*) FILTER (WHERE certificate_type = 'standard') as type_standard,
          COUNT(*) FILTER (WHERE certificate_type = 'with_salary') as type_with_salary,
          COUNT(*) FILTER (WHERE certificate_type = 'end_of_contract') as type_end_contract,
          COUNT(*) FILTER (WHERE certificate_type = 'custom') as type_custom
        FROM hr_work_certificates
      `);

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error fetching certificate stats:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

export default router;
