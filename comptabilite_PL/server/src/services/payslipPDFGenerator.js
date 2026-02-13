/**
 * Payslip PDF Generator Service
 * Generates professional bulletin de paie PDFs
 * Design: Professional layout with company header, employee section, pay table, leave tracking
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
  primary: '#2c3e50',      // Bleu nuit professionnel
  accent: '#27ae60',       // Vert pour net à payer
  text: '#333333',
  textLight: '#7f8c8d',
  line: '#bdc3c7',
  background: '#f8f9fa',
  gain: '#2c3e50',
  retenue: '#c0392b',
  white: '#ffffff'
};

export class PayslipPDFGenerator {
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
    return d.toLocaleDateString('fr-FR');
  }

  /**
   * Calculate years of seniority
   */
  calculateSeniority(hireDate) {
    if (!hireDate) return 0;
    const hire = new Date(hireDate);
    const now = new Date();
    const years = Math.floor((now - hire) / (365.25 * 24 * 60 * 60 * 1000));
    return years;
  }

  /**
   * Generate payslip PDF with professional design
   */
  async generatePayslip(payslipId, outputPath) {
    const client = await pool.connect();

    try {
      // 1. Récupérer les données avec infos fiscales segment
      const payslipResult = await client.query(`
        SELECT
          ps.*,
          e.first_name, e.last_name, e.employee_number, e.cin, e.hire_date,
          e.department, e.position, e.email, e.phone,
          e.social_security_number as employee_cnss, e.employment_type, e.termination_date,
          e.marital_status, e.dependent_children, e.initial_leave_balance,
          s.name as segment_name, s.logo_url as segment_logo, s.cnss_number as segment_cnss,
          s.identifiant_fiscal, s.registre_commerce, s.ice, s.company_address,
          p.name as period_name, p.year, p.month, p.start_date, p.end_date, p.pay_date,
          lb.current_balance as leave_balance,
          lb.accrued as leave_accrued,
          lb.taken as leave_taken,
          COALESCE(
            (SELECT current_balance FROM hr_leave_balances
             WHERE employee_id = e.id AND year = p.year - 1
             ORDER BY created_at DESC LIMIT 1),
            e.initial_leave_balance,
            0
          ) as leave_previous_balance
        FROM hr_payslips ps
        JOIN hr_employees e ON e.id = ps.employee_id
        LEFT JOIN segments s ON e.segment_id = s.id
        JOIN hr_payroll_periods p ON p.id = ps.period_id
        LEFT JOIN hr_leave_types lt ON lt.code = 'ANNUAL'
        LEFT JOIN hr_leave_balances lb ON lb.employee_id = e.id AND lb.leave_type_id = lt.id AND lb.year = p.year
        WHERE ps.id = $1
      `, [payslipId]);

      if (payslipResult.rows.length === 0) {
        throw new Error('Payslip not found');
      }

      const payslip = payslipResult.rows[0];

      // 2. Récupérer les lignes de détail
      const linesResult = await client.query(`
        SELECT * FROM hr_payslip_lines
        WHERE payslip_id = $1
        ORDER BY display_order
      `, [payslipId]);

      const lines = linesResult.rows;

      // 2b. Calculer les jours CNSS depuis hr_attendance_daily (jours PAYÉS uniquement)
      const cnssDaysResult = await client.query(`
        SELECT COUNT(*) as cnss_days
        FROM hr_attendance_daily
        WHERE employee_id = $1
          AND work_date BETWEEN $2 AND $3
          AND is_working_day = true
          AND day_status IN ('present', 'late', 'early_leave', 'partial', 'overtime', 'holiday', 'leave', 'sick', 'mission', 'training', 'recovery_off')
      `, [payslip.employee_id, payslip.start_date, payslip.end_date]);

      let calculatedCnssDays = parseInt(cnssDaysResult.rows[0]?.cnss_days) || 0;
      if (calculatedCnssDays === 0) calculatedCnssDays = 26; // Fallback si pas de données
      calculatedCnssDays = Math.min(calculatedCnssDays, 26); // Plafonner à 26

      // 3. Créer le PDF A4
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 30, bottom: 30, left: 35, right: 35 }
      });

      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      const pageWidth = 595.28;  // A4 width in points
      const pageHeight = 841.89; // A4 height in points
      const marginLeft = 35;
      const marginRight = 35;
      const contentWidth = pageWidth - marginLeft - marginRight;

      // =====================================================
      // WATERMARK (fond)
      // =====================================================
      const watermarkText = payslip.segment_name || 'PROLEAN';
      doc.save();
      doc.rotate(-45, { origin: [pageWidth / 2, pageHeight / 2] });
      doc.fontSize(80).fillColor('#000000').opacity(0.03);
      doc.text(watermarkText, 0, pageHeight / 2, { align: 'center', width: pageWidth * 1.5 });
      doc.restore();
      doc.opacity(1);

      // =====================================================
      // HEADER SECTION (simplifié - infos société en footer)
      // =====================================================
      let y = 30;

      // Logo (si disponible) - à gauche
      if (payslip.segment_logo) {
        try {
          const logoPath = path.join(UPLOADS_BASE, 'segments', path.basename(payslip.segment_logo));
          if (fs.existsSync(logoPath)) {
            doc.image(logoPath, marginLeft, y, { height: 50 });
          }
        } catch (err) {
          console.warn('Could not load segment logo:', err);
        }
      }

      // BULLETIN DE PAIE (droite)
      doc.fontSize(18).font('Helvetica-Bold').fillColor(COLORS.primary);
      doc.text('BULLETIN DE PAIE', pageWidth - marginRight - 180, y, { width: 180, align: 'right' });

      // Période - afficher le mois en français
      const monthNames = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                          'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
      const endDate = new Date(payslip.end_date);
      const periodMonth = monthNames[endDate.getMonth()];
      const periodYear = endDate.getFullYear();

      doc.fontSize(9).font('Helvetica').fillColor(COLORS.text);
      doc.text('Période de paie:', pageWidth - marginRight - 180, y + 25, { width: 100, align: 'right' });

      // Box période avec mois
      doc.roundedRect(pageWidth - marginRight - 78, y + 22, 78, 28, 3).fill(COLORS.background);
      doc.fontSize(10).font('Helvetica-Bold').fillColor(COLORS.primary);
      doc.text(periodMonth, pageWidth - marginRight - 75, y + 28, { width: 72, align: 'center' });
      doc.fontSize(9).font('Helvetica').fillColor(COLORS.text);
      doc.text(periodYear.toString(), pageWidth - marginRight - 75, y + 40, { width: 72, align: 'center' });

      // Ligne de séparation header
      y = 85;
      doc.strokeColor(COLORS.primary).lineWidth(2);
      doc.moveTo(marginLeft, y).lineTo(pageWidth - marginRight, y).stroke();

      // =====================================================
      // EMPLOYEE SECTION - Nouvelle disposition
      // =====================================================
      y += 10;

      // Fond avec bordure gauche colorée
      const empBoxHeight = 65;
      doc.rect(marginLeft, y, contentWidth, empBoxHeight).fill(COLORS.background);
      doc.rect(marginLeft, y, 4, empBoxHeight).fill(COLORS.primary);

      // Mapping type de contrat
      const contractTypeLabels = {
        'full_time': 'CDI',
        'part_time': 'Temps partiel',
        'intern': 'Stagiaire',
        'freelance': 'Freelance',
        'temporary': 'CDD'
      };
      const contractType = contractTypeLabels[payslip.employment_type] || payslip.employment_type || 'N/A';

      // Mapping situation familiale
      const maritalLabels = {
        'single': 'Célibataire',
        'married': 'Marié(e)',
        'divorced': 'Divorcé(e)',
        'widowed': 'Veuf/Veuve'
      };
      const maritalStatus = maritalLabels[payslip.marital_status] || payslip.marital_status || 'N/A';
      const childrenCount = payslip.dependent_children || 0;

      // Définir 3 colonnes avec positions fixes
      const col1X = marginLeft + 12;
      const col2X = marginLeft + 160;
      const col3X = marginLeft + 320;

      doc.fontSize(8);
      let empY = y + 6;

      // ===== COLONNE 1: Matricule, Nom, Prénom, CIN =====
      doc.font('Helvetica').fillColor(COLORS.textLight).text('Matricule:', col1X, empY);
      doc.font('Helvetica-Bold').fillColor(COLORS.text).text(payslip.employee_number || 'N/A', col1X + 55, empY);

      empY += 13;
      doc.font('Helvetica').fillColor(COLORS.textLight).text('Nom:', col1X, empY);
      doc.font('Helvetica-Bold').fillColor(COLORS.text).text((payslip.last_name || '').toUpperCase(), col1X + 55, empY);

      empY += 13;
      doc.font('Helvetica').fillColor(COLORS.textLight).text('Prénom:', col1X, empY);
      doc.font('Helvetica-Bold').fillColor(COLORS.text).text(payslip.first_name || 'N/A', col1X + 55, empY);

      empY += 13;
      doc.font('Helvetica').fillColor(COLORS.textLight).text('CIN:', col1X, empY);
      doc.font('Helvetica-Bold').fillColor(COLORS.text).text(payslip.cin || 'N/A', col1X + 55, empY);

      // ===== COLONNE 2: Sit.Fam, Enfants, CNSS =====
      empY = y + 6;
      doc.font('Helvetica').fillColor(COLORS.textLight).text('Sit. Fam.:', col2X, empY);
      doc.font('Helvetica-Bold').fillColor(COLORS.text).text(maritalStatus, col2X + 55, empY);

      empY += 13;
      doc.font('Helvetica').fillColor(COLORS.textLight).text('Enfants:', col2X, empY);
      doc.font('Helvetica-Bold').fillColor(COLORS.text).text(childrenCount.toString(), col2X + 55, empY);

      empY += 13;
      doc.font('Helvetica').fillColor(COLORS.textLight).text('N° CNSS:', col2X, empY);
      doc.font('Helvetica-Bold').fillColor(COLORS.text).text(payslip.employee_cnss || 'N/A', col2X + 55, empY);

      // ===== COLONNE 3: Fonction, Statut, Date embauche, Fin contrat =====
      empY = y + 6;
      doc.font('Helvetica').fillColor(COLORS.textLight).text('Fonction:', col3X, empY);
      doc.font('Helvetica-Bold').fillColor(COLORS.text).text(payslip.position || 'N/A', col3X + 60, empY);

      empY += 13;
      doc.font('Helvetica').fillColor(COLORS.textLight).text('Statut:', col3X, empY);
      doc.font('Helvetica-Bold').fillColor(COLORS.text).text(contractType, col3X + 60, empY);

      empY += 13;
      doc.font('Helvetica').fillColor(COLORS.textLight).text('Embauche:', col3X, empY);
      doc.font('Helvetica-Bold').fillColor(COLORS.text).text(this.formatDate(payslip.hire_date), col3X + 60, empY);

      empY += 13;
      // Fin contrat si CDD/Stagiaire
      if (payslip.termination_date || !['full_time'].includes(payslip.employment_type)) {
        doc.font('Helvetica').fillColor(COLORS.textLight).text('Fin contrat:', col3X, empY);
        doc.font('Helvetica-Bold').fillColor(COLORS.text).text(payslip.termination_date ? this.formatDate(payslip.termination_date) : 'N/A', col3X + 60, empY);
      }

      y += empBoxHeight + 10;

      // =====================================================
      // PAY TABLE
      // =====================================================
      const tableX = marginLeft;
      const colWidths = [195, 80, 55, 85, 85]; // Rubrique, Base/Nombre, Taux, Gains, Retenues

      // Table header
      doc.rect(tableX, y, contentWidth, 22).fill(COLORS.primary);

      doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.white);
      let headerX = tableX + 5;
      const headers = ['RUBRIQUE', 'BASE / NOMBRE', 'TAUX', 'GAINS (+)', 'RETENUES (-)'];
      const headerAligns = ['left', 'right', 'center', 'right', 'right'];

      for (let i = 0; i < headers.length; i++) {
        doc.text(headers[i], headerX, y + 7, { width: colWidths[i] - 8, align: headerAligns[i] });
        headerX += colWidths[i];
      }

      y += 22;

      // Lignes de détail
      const earnings = lines.filter(l => l.line_type === 'earning');
      const deductions = lines.filter(l => l.line_type === 'deduction');

      // Section Rémunération Brute
      doc.rect(tableX, y, contentWidth, 16).fill('#fafafa');
      doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.textLight);
      doc.text('Rémunération Brute', tableX + 5, y + 4);
      y += 16;

      // Lignes des gains
      // Jours CNSS: calculés depuis hr_attendance_daily (voir requête plus haut)
      const cnssDays = calculatedCnssDays;

      doc.font('Helvetica').fillColor(COLORS.text);
      for (const line of earnings) {
        // Déterminer la base à afficher
        let baseDisplay = 'Forfait';
        const labelLower = (line.label || '').toLowerCase();

        if (line.category === 'base_salary' || labelLower.includes('salaire de base')) {
          // Salaire de base: afficher le nombre de jours CNSS
          baseDisplay = `${cnssDays} j`;
        } else if (line.category === 'seniority' || line.category === 'anciennete' || labelLower.includes('ancienneté') || labelLower.includes('anciennete')) {
          // Prime d'ancienneté: base = salaire de base
          baseDisplay = this.formatAmount(payslip.base_salary);
        } else if (labelLower.includes('rendement')) {
          // Prime de rendement: toujours afficher 1
          baseDisplay = '1';
        } else if (parseFloat(line.base_amount) > 0) {
          baseDisplay = this.formatAmount(line.base_amount);
        }

        this.drawPayLine(doc, tableX, y, colWidths, {
          label: line.label,
          base: baseDisplay,
          rate: line.rate && parseFloat(line.rate) > 0 ? `${parseFloat(line.rate).toFixed(2)} %` : '',
          gain: this.formatAmount(line.amount),
          retenue: ''
        });
        y += 16;
      }

      // Total Brut
      doc.rect(tableX, y, contentWidth, 20).fill('#f0f0f0');
      doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.text);
      doc.text('TOTAL BRUT GLOBAL', tableX + 5, y + 5, { width: colWidths[0] + colWidths[1] + colWidths[2] - 15, align: 'right' });
      doc.fillColor(COLORS.gain);
      doc.text(this.formatAmount(payslip.gross_salary), tableX + colWidths[0] + colWidths[1] + colWidths[2], y + 5, { width: colWidths[3] - 8, align: 'right' });
      y += 20;

      // Section Cotisations
      doc.rect(tableX, y, contentWidth, 16).fill('#fafafa');
      doc.fontSize(8).font('Helvetica-Bold').fillColor(COLORS.textLight);
      doc.text('Cotisations Sociales & Fiscales', tableX + 5, y + 4);
      y += 16;

      // Lignes des retenues
      doc.font('Helvetica').fillColor(COLORS.text);

      // CNSS
      const cnssBase = parseFloat(payslip.cnss_base) || parseFloat(payslip.gross_salary);
      const cnssEmployee = parseFloat(payslip.cnss_employee) || 0;
      if (cnssEmployee > 0) {
        this.drawPayLine(doc, tableX, y, colWidths, {
          label: 'CNSS (Prestations Sociales)',
          base: this.formatAmount(cnssBase),
          rate: '4.48 %',
          gain: '',
          retenue: this.formatAmount(cnssEmployee)
        });
        y += 16;
      }

      // AMO
      const amoEmployee = parseFloat(payslip.amo_employee) || 0;
      if (amoEmployee > 0) {
        this.drawPayLine(doc, tableX, y, colWidths, {
          label: 'AMO (Assurance Maladie Obligatoire)',
          base: this.formatAmount(cnssBase),
          rate: '2.26 %',
          gain: '',
          retenue: this.formatAmount(amoEmployee)
        });
        y += 16;
      }

      // IR
      const igrBase = parseFloat(payslip.igr_base) || 0;
      const igrAmount = parseFloat(payslip.igr_amount) || 0;
      this.drawPayLine(doc, tableX, y, colWidths, {
        label: 'Impôt sur le Revenu (IR)',
        base: `Net Imp: ${this.formatAmount(igrBase)}`,
        rate: igrAmount > 0 ? '' : '0.00 %',
        gain: '',
        retenue: this.formatAmount(igrAmount)
      });
      y += 16;

      // Autres retenues
      for (const line of deductions) {
        if (!['cnss', 'amo', 'igr'].includes(line.category)) {
          this.drawPayLine(doc, tableX, y, colWidths, {
            label: line.label,
            base: line.base_amount ? this.formatAmount(line.base_amount) : '',
            rate: line.rate ? `${parseFloat(line.rate).toFixed(2)} %` : '',
            gain: '',
            retenue: this.formatAmount(line.amount)
          });
          y += 16;
        }
      }

      // Total Retenues
      doc.rect(tableX, y, contentWidth, 20).fill('#f0f0f0');
      doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.text);
      doc.text('TOTAL DES RETENUES', tableX + 5, y + 5, { width: colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3] - 15, align: 'right' });
      doc.fillColor(COLORS.retenue);
      doc.text(this.formatAmount(payslip.total_deductions), tableX + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], y + 5, { width: colWidths[4] - 8, align: 'right' });
      y += 20;

      // Ligne de fin de tableau
      doc.strokeColor(COLORS.primary).lineWidth(2);
      doc.moveTo(tableX, y).lineTo(tableX + contentWidth, y).stroke();

      // =====================================================
      // FOOTER DASHBOARD
      // =====================================================
      y += 20;

      // Box Congés (gauche)
      const congesBoxWidth = 170;
      const congesBoxHeight = 85;
      doc.strokeColor(COLORS.line).lineWidth(1);
      doc.roundedRect(tableX, y, congesBoxWidth, congesBoxHeight, 4).stroke();

      doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.textLight);
      doc.text('SUIVI DES CONGÉS', tableX + 8, y + 8);

      doc.strokeColor('#eeeeee').lineWidth(0.5);
      doc.moveTo(tableX + 8, y + 22).lineTo(tableX + congesBoxWidth - 8, y + 22).stroke();

      doc.fontSize(8).font('Helvetica').fillColor(COLORS.text);

      const leavePrevious = parseFloat(payslip.leave_previous_balance) || parseFloat(payslip.initial_leave_balance) || 0;
      const leaveAccrued = parseFloat(payslip.leave_accrued) || 0;
      const leaveTaken = parseFloat(payslip.leave_taken) || 0;
      const leaveCurrent = parseFloat(payslip.leave_balance) || (leavePrevious + leaveAccrued - leaveTaken);

      let congesY = y + 28;
      doc.text('Solde mois précédent:', tableX + 8, congesY);
      doc.font('Helvetica-Bold').text(`${leavePrevious.toFixed(2)} j`, tableX + 110, congesY, { width: 50, align: 'right' });

      congesY += 12;
      doc.font('Helvetica').text('Acquis ce mois:', tableX + 8, congesY);
      doc.font('Helvetica-Bold').text(`${leaveAccrued.toFixed(2)} j`, tableX + 110, congesY, { width: 50, align: 'right' });

      congesY += 12;
      doc.font('Helvetica').text('Pris ce mois:', tableX + 8, congesY);
      doc.font('Helvetica-Bold').text(`${leaveTaken.toFixed(2)} j`, tableX + 110, congesY, { width: 50, align: 'right' });

      // Ligne pointillée
      doc.strokeColor('#cccccc').lineWidth(0.5);
      doc.dash(3, 2);
      doc.moveTo(tableX + 8, congesY + 14).lineTo(tableX + congesBoxWidth - 8, congesY + 14).stroke();
      doc.undash();

      congesY += 18;
      doc.fontSize(9).font('Helvetica-Bold').fillColor(COLORS.primary);
      doc.text('SOLDE ACTUEL:', tableX + 8, congesY);
      doc.fillColor(COLORS.accent);
      doc.text(`${leaveCurrent.toFixed(2)} j`, tableX + 110, congesY, { width: 50, align: 'right' });

      // Box Net à Payer (droite)
      const netBoxWidth = 170;
      const netBoxHeight = 70;
      const netBoxX = pageWidth - marginRight - netBoxWidth;

      doc.roundedRect(netBoxX, y, netBoxWidth, netBoxHeight, 5).fill(COLORS.accent);

      doc.fontSize(10).font('Helvetica').fillColor(COLORS.white).opacity(0.9);
      doc.text('Net à Payer', netBoxX, y + 10, { width: netBoxWidth, align: 'center' });

      doc.opacity(1);
      doc.fontSize(22).font('Helvetica-Bold');
      doc.text(`${this.formatAmount(payslip.net_salary)} MAD`, netBoxX, y + 26, { width: netBoxWidth, align: 'center' });

      doc.fontSize(8).font('Helvetica').opacity(0.85);
      doc.text('Payé par virement bancaire', netBoxX, y + 52, { width: netBoxWidth, align: 'center' });
      doc.opacity(1);

      // =====================================================
      // LEGAL FOOTER - Infos société + mention légale
      // =====================================================
      const legalY = pageHeight - 60;

      doc.strokeColor('#eeeeee').lineWidth(0.5);
      doc.moveTo(marginLeft, legalY - 8).lineTo(pageWidth - marginRight, legalY - 8).stroke();

      // Infos société (ligne 1)
      doc.fontSize(7).font('Helvetica-Bold').fillColor(COLORS.primary);
      const companyName = payslip.segment_name || 'PROLEAN';
      doc.text(companyName, marginLeft, legalY, { continued: true });
      doc.font('Helvetica').fillColor(COLORS.textLight);

      // Infos légales société
      let companyInfo = [];
      if (payslip.segment_cnss) companyInfo.push(`CNSS: ${payslip.segment_cnss}`);
      if (payslip.registre_commerce) companyInfo.push(`RC: ${payslip.registre_commerce}`);
      if (payslip.identifiant_fiscal) companyInfo.push(`IF: ${payslip.identifiant_fiscal}`);
      if (payslip.ice) companyInfo.push(`ICE: ${payslip.ice}`);

      if (companyInfo.length > 0) {
        doc.text('  -  ' + companyInfo.join('  |  '), { continued: false });
      } else {
        doc.text('', { continued: false });
      }

      // Adresse société (ligne 2)
      if (payslip.company_address) {
        doc.fontSize(7).font('Helvetica').fillColor(COLORS.textLight);
        doc.text(payslip.company_address, marginLeft, legalY + 10, { width: contentWidth });
      }

      // Mention légale (ligne 3)
      doc.fontSize(7).font('Helvetica-Oblique').fillColor(COLORS.textLight);
      doc.text(
        "Conformément à l'article 370 du Code du Travail. Ce bulletin doit être conservé sans limitation de durée.",
        marginLeft, legalY + 25,
        { width: contentWidth, align: 'center' }
      );

      // Finaliser
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
   * Draw a pay line in the table
   */
  drawPayLine(doc, tableX, y, colWidths, data) {
    let x = tableX + 5;

    doc.fontSize(8).font('Helvetica').fillColor(COLORS.text);
    doc.text(data.label, x, y + 3, { width: colWidths[0] - 8 });
    x += colWidths[0];

    doc.text(data.base, x, y + 3, { width: colWidths[1] - 8, align: 'right' });
    x += colWidths[1];

    doc.text(data.rate, x, y + 3, { width: colWidths[2] - 8, align: 'center' });
    x += colWidths[2];

    if (data.gain) {
      doc.fillColor(COLORS.gain);
      doc.text(data.gain, x, y + 3, { width: colWidths[3] - 8, align: 'right' });
    }
    x += colWidths[3];

    if (data.retenue) {
      doc.fillColor(COLORS.retenue);
      doc.text(data.retenue, x, y + 3, { width: colWidths[4] - 8, align: 'right' });
    }

    // Ligne de séparation
    doc.strokeColor('#eeeeee').lineWidth(0.5);
    doc.moveTo(tableX, y + 15).lineTo(tableX + colWidths.reduce((a, b) => a + b, 0), y + 15).stroke();
  }

  /**
   * Generate multiple payslip PDFs
   */
  async generateMultiplePayslips(payslipIds, outputDir) {
    const results = [];

    for (const payslipId of payslipIds) {
      try {
        const outputPath = path.join(outputDir, `bulletin-${payslipId}.pdf`);
        await this.generatePayslip(payslipId, outputPath);
        results.push(outputPath);
      } catch (error) {
        console.error(`Error generating payslip ${payslipId}:`, error);
        results.push(null);
      }
    }

    return results;
  }
}
