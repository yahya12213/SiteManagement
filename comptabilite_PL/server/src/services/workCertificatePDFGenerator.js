/**
 * Work Certificate PDF Generator Service
 * Generates professional "Attestation de Travail" PDFs
 * Based on Moroccan employment certificate standards
 */

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from '../config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base paths
const UPLOADS_BASE = process.env.UPLOADS_PATH || path.join(__dirname, '../../uploads');

// Colors
const COLORS = {
  primary: '#2c3e50',
  text: '#333333',
  textLight: '#7f8c8d',
  line: '#bdc3c7',
  background: '#f8f9fa',
  accent: '#3498db'
};

export class WorkCertificatePDFGenerator {
  /**
   * Format amount with spaces as thousands separator
   */
  formatAmount(amount) {
    if (typeof amount !== 'number' || isNaN(amount)) {
      const parsed = parseFloat(amount);
      if (isNaN(parsed)) return '0,00';
      amount = parsed;
    }
    return amount.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  /**
   * Format date to French format
   */
  formatDate(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    return d.toLocaleDateString('fr-FR', options);
  }

  /**
   * Format date to short French format
   */
  formatDateShort(date) {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR');
  }

  /**
   * Get gender-appropriate text
   */
  getGenderText(gender, type) {
    const isMale = gender === 'male' || gender === 'M' || gender === 'homme';
    const texts = {
      title: isMale ? 'Monsieur' : 'Madame',
      employed: isMale ? 'employé' : 'employée',
      interested: isMale ? "l'intéressé" : "l'intéressée"
    };
    return texts[type] || texts.title;
  }

  /**
   * Generate work certificate PDF
   */
  async generateCertificate(certificateId, outputPath) {
    const client = await pool.connect();

    try {
      // 1. Fetch certificate data with employee and segment info
      const certResult = await client.query(`
        SELECT
          wc.*,
          e.first_name, e.last_name, e.cin, e.hire_date, e.termination_date,
          e.position, e.department, e.gender, e.employee_number,
          e.social_security_number as employee_cnss, e.base_salary,
          s.name as segment_name, s.logo_url as segment_logo,
          s.cnss_number as segment_cnss, s.identifiant_fiscal, s.registre_commerce,
          s.ice, s.company_address, s.city as company_city,
          p.full_name as created_by_name
        FROM hr_work_certificates wc
        JOIN hr_employees e ON e.id = wc.employee_id
        LEFT JOIN segments s ON e.segment_id = s.id
        LEFT JOIN profiles p ON wc.created_by = p.id
        WHERE wc.id = $1
      `, [certificateId]);

      if (certResult.rows.length === 0) {
        throw new Error('Certificate not found');
      }

      const cert = certResult.rows[0];

      // 2. Create PDF document (A4 portrait)
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 }
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      const pageWidth = 595.28;
      const pageHeight = 841.89;
      const marginLeft = 50;
      const marginRight = 50;
      const contentWidth = pageWidth - marginLeft - marginRight;

      // =====================================================
      // WATERMARK (fond)
      // =====================================================
      const watermarkText = cert.segment_name || 'CONFIDENTIEL';
      doc.save();
      doc.rotate(-45, { origin: [pageWidth / 2, pageHeight / 2] });
      doc.fontSize(60).fillColor('#000000').opacity(0.03);
      doc.text(watermarkText, 0, pageHeight / 2, { align: 'center', width: pageWidth * 1.5 });
      doc.restore();
      doc.opacity(1);

      let y = 50;

      // =====================================================
      // HEADER - Company info and logo
      // =====================================================

      // Logo (if available) - centered at top
      if (cert.segment_logo) {
        try {
          const logoPath = path.join(UPLOADS_BASE, 'segments', path.basename(cert.segment_logo));
          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, pageWidth / 2 - 40, y, { height: 60 });
            y += 70;
          }
        } catch (err) {
          console.warn('Could not load segment logo:', err);
        }
      }

      // Company name
      doc.fontSize(14).font('Helvetica-Bold').fillColor(COLORS.primary);
      doc.text(cert.segment_name || 'ENTREPRISE', marginLeft, y, { width: contentWidth, align: 'center' });
      y += 25;

      // Company legal info
      doc.fontSize(9).font('Helvetica').fillColor(COLORS.textLight);
      const legalInfo = [];
      if (cert.segment_cnss) legalInfo.push(`CNSS: ${cert.segment_cnss}`);
      if (cert.registre_commerce) legalInfo.push(`RC: ${cert.registre_commerce}`);
      if (cert.identifiant_fiscal) legalInfo.push(`IF: ${cert.identifiant_fiscal}`);
      if (cert.ice) legalInfo.push(`ICE: ${cert.ice}`);

      if (legalInfo.length > 0) {
        doc.text(legalInfo.join('  |  '), marginLeft, y, { width: contentWidth, align: 'center' });
        y += 15;
      }

      // Company address
      if (cert.company_address) {
        doc.text(cert.company_address, marginLeft, y, { width: contentWidth, align: 'center' });
        y += 15;
      }

      // Separator line
      y += 10;
      doc.strokeColor(COLORS.primary).lineWidth(2);
      doc.moveTo(marginLeft, y).lineTo(pageWidth - marginRight, y).stroke();
      y += 30;

      // =====================================================
      // TITLE
      // =====================================================
      doc.fontSize(22).font('Helvetica-Bold').fillColor(COLORS.primary);
      doc.text('ATTESTATION DE TRAVAIL', marginLeft, y, { width: contentWidth, align: 'center' });
      y += 15;

      // Certificate number
      doc.fontSize(10).font('Helvetica').fillColor(COLORS.textLight);
      doc.text(`N° ${cert.certificate_number}`, marginLeft, y, { width: contentWidth, align: 'center' });
      y += 50;

      // =====================================================
      // BODY TEXT
      // =====================================================
      const gender = cert.gender || 'male';
      const titleText = this.getGenderText(gender, 'title');
      const employedText = this.getGenderText(gender, 'employed');
      const interestedText = this.getGenderText(gender, 'interested');
      const fullName = `${(cert.last_name || '').toUpperCase()} ${cert.first_name || ''}`.trim();

      doc.fontSize(12).font('Helvetica').fillColor(COLORS.text);

      // Opening statement
      const issuerName = cert.created_by_name || 'Le Responsable';
      doc.text('Je soussigné(e),', marginLeft, y);
      y += 20;

      doc.font('Helvetica-Bold');
      doc.text(issuerName + ',', marginLeft, y);
      y += 20;

      doc.font('Helvetica');
      doc.text('Agissant en qualité de Responsable des Ressources Humaines,', marginLeft, y);
      y += 35;

      // Main attestation text
      doc.text('Atteste par la présente que :', marginLeft, y);
      y += 30;

      // Employee info box
      doc.roundedRect(marginLeft, y, contentWidth, 85, 5).fill(COLORS.background);
      y += 15;

      doc.font('Helvetica-Bold').fillColor(COLORS.primary);
      doc.text(`${titleText} ${fullName}`, marginLeft + 20, y);
      y += 20;

      doc.font('Helvetica').fillColor(COLORS.text);
      doc.text(`Titulaire de la CIN n° : ${cert.cin || 'N/A'}`, marginLeft + 20, y);
      y += 18;

      if (cert.employee_cnss) {
        doc.text(`N° CNSS : ${cert.employee_cnss}`, marginLeft + 20, y);
        y += 18;
      }

      doc.text(`Matricule : ${cert.employee_number || 'N/A'}`, marginLeft + 20, y);
      y += 30;

      // Employment statement based on certificate type
      const hireDate = this.formatDate(cert.hire_date);

      if (cert.certificate_type === 'end_of_contract') {
        const endDate = this.formatDate(cert.termination_date || cert.end_date);
        doc.text(
          `A été ${employedText} au sein de notre société du ${hireDate} au ${endDate}`,
          marginLeft, y, { width: contentWidth }
        );
        y += 20;

        if (cert.include_position && cert.position) {
          doc.text(`en qualité de ${cert.position}.`, marginLeft, y, { width: contentWidth });
          y += 25;
        }
      } else {
        // Standard or with_salary
        doc.text(
          `Est ${employedText} au sein de notre société depuis le ${hireDate}`,
          marginLeft, y, { width: contentWidth }
        );
        y += 20;

        if (cert.include_position && cert.position) {
          doc.text(`en qualité de ${cert.position}.`, marginLeft, y, { width: contentWidth });
          y += 25;
        }
      }

      // Salary info if included
      if (cert.include_salary && cert.base_salary) {
        y += 10;
        doc.font('Helvetica').fillColor(COLORS.text);
        doc.text(
          `Et perçoit un salaire mensuel brut de ${this.formatAmount(cert.base_salary)} MAD.`,
          marginLeft, y, { width: contentWidth }
        );
        y += 35;
      } else {
        y += 20;
      }

      // Custom text if provided
      if (cert.custom_text) {
        doc.text(cert.custom_text, marginLeft, y, { width: contentWidth });
        y += 35;
      }

      // Purpose statement
      if (cert.purpose) {
        doc.text(
          `Cette attestation est délivrée à ${interestedText} à sa demande pour ${cert.purpose}.`,
          marginLeft, y, { width: contentWidth }
        );
        y += 35;
      } else {
        doc.text(
          `Cette attestation est délivrée à ${interestedText} pour servir et valoir ce que de droit.`,
          marginLeft, y, { width: contentWidth }
        );
        y += 35;
      }

      // =====================================================
      // DATE AND SIGNATURE
      // =====================================================
      y += 30;

      // Date and place
      const city = cert.company_city || 'Casablanca';
      const issueDate = this.formatDate(cert.issue_date);
      doc.text(`Fait à ${city}, le ${issueDate}`, marginLeft, y, { width: contentWidth, align: 'right' });
      y += 50;

      // Signature area
      doc.text('Signature et cachet de l\'entreprise', marginLeft, y, { width: contentWidth, align: 'right' });
      y += 60;

      // Signature placeholder box
      const sigBoxWidth = 180;
      const sigBoxHeight = 80;
      doc.strokeColor(COLORS.line).lineWidth(1);
      doc.roundedRect(pageWidth - marginRight - sigBoxWidth, y, sigBoxWidth, sigBoxHeight, 3).stroke();

      // =====================================================
      // FOOTER
      // =====================================================
      const footerY = pageHeight - 50;

      doc.strokeColor('#eeeeee').lineWidth(0.5);
      doc.moveTo(marginLeft, footerY - 10).lineTo(pageWidth - marginRight, footerY - 10).stroke();

      doc.fontSize(8).font('Helvetica').fillColor(COLORS.textLight);
      doc.text(
        'Ce document est une attestation officielle de travail.',
        marginLeft, footerY, { width: contentWidth, align: 'center' }
      );

      // Finalize
      doc.end();

      return new Promise((resolve, reject) => {
        stream.on('finish', () => resolve(outputPath));
        stream.on('error', reject);
      });

    } finally {
      client.release();
    }
  }

  /**
   * Generate multiple certificates
   */
  async generateMultipleCertificates(certificateIds, outputDir) {
    const results = [];

    for (const certId of certificateIds) {
      try {
        const outputPath = path.join(outputDir, `attestation-${certId}.pdf`);
        await this.generateCertificate(certId, outputPath);
        results.push({ id: certId, path: outputPath, success: true });
      } catch (error) {
        console.error(`Error generating certificate ${certId}:`, error);
        results.push({ id: certId, success: false, error: error.message });
      }
    }

    return results;
  }
}
