import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { toTitleCase, formatCIN, formatCertificateNumber } from '../utils/textStandardizer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base paths
const UPLOADS_BASE = process.env.UPLOADS_PATH || path.join(__dirname, '../../uploads');

/**
 * Certificate PDF Generator Service
 * Generates PDF certificates using PDFKit based on templates
 */
export class CertificatePDFGenerator {
  /**
   * Generates a certificate PDF file
   * @param {Object} certificate - Certificate data
   * @param {Object} template - Certificate template configuration
   * @param {string} outputPath - Full path where to save the PDF
   * @returns {Promise<string>} - Path to generated PDF
   */
  async generateCertificate(certificate, template, outputPath) {
    return new Promise((resolve, reject) => {
      try {
        const templateConfig = template.template_config || {};
        const layout = templateConfig.layout || {};

        // Determine PDF format and orientation
        const rawFormat = layout.format || 'a4';
        const orientation = layout.orientation || 'landscape';

        // Resolve format - handle standard names, custom dimensions, or arrays
        let size;
        const standardFormats = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9', 'A10',
          'B0', 'B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10',
          'C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'C9', 'C10',
          'LETTER', 'LEGAL', 'TABLOID', 'EXECUTIVE', 'FOLIO', '4A0', '2A0'];

        if (Array.isArray(rawFormat) && rawFormat.length === 2) {
          // Custom dimensions as array [width, height]
          size = rawFormat;
        } else if (typeof rawFormat === 'object' && rawFormat.width && rawFormat.height) {
          // Custom dimensions as object {width, height}
          size = [rawFormat.width, rawFormat.height];
        } else if (typeof rawFormat === 'string') {
          const upperFormat = rawFormat.toUpperCase();
          if (standardFormats.includes(upperFormat)) {
            size = upperFormat;
          } else {
            // Try to parse as "WIDTHxHEIGHT" format (e.g., "85x54" for badge)
            const match = rawFormat.match(/^(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)$/);
            if (match) {
              // Convert mm to points (1mm = 2.83465 points)
              const mmToPoints = 2.83465;
              size = [parseFloat(match[1]) * mmToPoints, parseFloat(match[2]) * mmToPoints];
            } else {
              console.warn(`Unknown format "${rawFormat}", defaulting to A4`);
              size = 'A4';
            }
          }
        } else {
          size = 'A4';
        }

        // Create PDF document
        const doc = new PDFDocument({
          size: size,
          layout: orientation,
          margins: { top: 0, bottom: 0, left: 0, right: 0 }
        });

        // Create write stream
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        // Render background if exists
        if (template.background_image_url) {
          try {
            const bgPath = path.join(UPLOADS_BASE, template.background_image_url);
            if (fs.existsSync(bgPath)) {
              doc.image(bgPath, 0, 0, {
                width: doc.page.width,
                height: doc.page.height
              });
            }
          } catch (bgError) {
            console.warn('Error loading background image:', bgError);
          }
        }

        // Render template elements or use default template
        if (templateConfig.pages && templateConfig.pages.length > 0) {
          this.renderTemplateElements(doc, certificate, templateConfig);
        } else {
          this.renderDefaultCertificate(doc, certificate);
        }

        // Finalize PDF
        doc.end();

        // Wait for write to complete
        stream.on('finish', () => {
          resolve(outputPath);
        });

        stream.on('error', (error) => {
          reject(error);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Renders template elements on the PDF
   * @param {PDFDocument} doc - PDF document
   * @param {Object} certificate - Certificate data
   * @param {Object} templateConfig - Template configuration
   */
  renderTemplateElements(doc, certificate, templateConfig) {
    const pages = templateConfig.pages || [];
    const colors = templateConfig.colors || {};
    const fonts = templateConfig.fonts || {};

    // Render first page (we'll support multi-page later)
    if (pages.length > 0 && pages[0]) {
      const page = pages[0];
      const elements = page.elements || [];

      if (!Array.isArray(elements)) {
        console.warn('Elements is not an array, using default certificate');
        this.renderDefaultCertificate(doc, certificate);
        return;
      }

      elements.forEach(element => {
        try {
          switch (element.type) {
            case 'text':
              this.renderTextElement(doc, element, certificate, fonts);
              break;
            case 'line':
              this.renderLineElement(doc, element, colors);
              break;
            case 'rectangle':
              this.renderRectangleElement(doc, element, colors);
              break;
            case 'circle':
              this.renderCircleElement(doc, element, colors);
              break;
            case 'image':
              this.renderImageElement(doc, element);
              break;
            default:
              console.warn(`Unknown element type: ${element.type}`);
          }
        } catch (elementError) {
          console.error(`Error rendering element ${element.type}:`, elementError);
        }
      });
    }
  }

  /**
   * Renders a text element
   * @param {PDFDocument} doc - PDF document
   * @param {Object} element - Text element configuration
   * @param {Object} certificate - Certificate data
   * @param {Object} fonts - Font configurations
   */
  renderTextElement(doc, element, certificate, fonts) {
    if (!element) {
      console.warn('renderTextElement: element is undefined');
      return;
    }

    // Auto-detect date elements and use 'long' format as default only if dateFormat is not set
    // IMPORTANT: Respect user's choice - if they chose 'numeric', use 'numeric'
    const hasDateVariable = element.content && (
      element.content.includes('{session_date_debut}') ||
      element.content.includes('{session_date_fin}') ||
      element.content.includes('{completion_date}') ||
      element.content.includes('{issued_date}') ||
      element.content.includes('{student_birth_date}') ||
      element.content.includes('{birth_date}') ||
      element.content.includes('{date_naissance}')
    );

    // Only set default 'long' format if dateFormat is not defined at all
    // If user explicitly chose 'numeric', respect that choice
    const effectiveElement = hasDateVariable && !element.dateFormat
      ? { ...element, dateFormat: 'long' }
      : element;

    if (hasDateVariable) {
      console.log(`📅 Date element: "${element.content}" | original dateFormat: ${element.dateFormat || 'NOT SET'} | effective: ${effectiveElement.dateFormat}`);
    }

    const content = this.substituteVariables(effectiveElement.content || '', certificate, effectiveElement);
    const x = this.resolvePosition(element.x || 0, doc.page.width);
    const y = this.resolvePosition(element.y || 0, doc.page.height);
    const fontSize = element.fontSize || 12;
    const color = element.color || '#000000';
    const align = element.align || 'left';

    // Set font (PDFKit has limited font support, we'll use built-in fonts)
    try {
      doc.font(this.resolveFont(element.font || 'Helvetica'));
    } catch (fontError) {
      console.warn('Font error, using Helvetica:', fontError);
      doc.font('Helvetica');
    }

    // Set font size and color
    doc.fontSize(fontSize);
    doc.fillColor(color);

    // Render text
    if (align === 'center') {
      doc.text(content, x - 200, y, {
        width: 400,
        align: 'center'
      });
    } else if (align === 'right') {
      doc.text(content, x - 400, y, {
        width: 400,
        align: 'right'
      });
    } else {
      doc.text(content, x, y, {
        align: 'left'
      });
    }
  }

  /**
   * Renders a line element
   * @param {PDFDocument} doc - PDF document
   * @param {Object} element - Line element configuration
   * @param {Object} colors - Color configurations
   */
  renderLineElement(doc, element, colors) {
    const x1 = this.resolvePosition(element.x1, doc.page.width);
    const y1 = this.resolvePosition(element.y1, doc.page.height);
    const x2 = this.resolvePosition(element.x2, doc.page.width);
    const y2 = this.resolvePosition(element.y2, doc.page.height);
    const strokeWidth = element.strokeWidth || 1;
    const strokeColor = element.strokeColor || '#000000';

    doc.strokeColor(strokeColor);
    doc.lineWidth(strokeWidth);
    doc.moveTo(x1, y1);
    doc.lineTo(x2, y2);
    doc.stroke();
  }

  /**
   * Renders a rectangle element
   * @param {PDFDocument} doc - PDF document
   * @param {Object} element - Rectangle element configuration
   * @param {Object} colors - Color configurations
   */
  renderRectangleElement(doc, element, colors) {
    const x = this.resolvePosition(element.x, doc.page.width);
    const y = this.resolvePosition(element.y, doc.page.height);
    const width = element.width || 100;
    const height = element.height || 100;
    const fillColor = element.fillColor;
    const strokeColor = element.strokeColor;
    const strokeWidth = element.strokeWidth || 1;

    if (fillColor) {
      doc.fillColor(fillColor);
      doc.rect(x, y, width, height).fill();
    }

    if (strokeColor) {
      doc.strokeColor(strokeColor);
      doc.lineWidth(strokeWidth);
      doc.rect(x, y, width, height).stroke();
    }
  }

  /**
   * Renders a circle element
   * @param {PDFDocument} doc - PDF document
   * @param {Object} element - Circle element configuration
   * @param {Object} colors - Color configurations
   */
  renderCircleElement(doc, element, colors) {
    const x = this.resolvePosition(element.x, doc.page.width);
    const y = this.resolvePosition(element.y, doc.page.height);
    const radius = element.radius || 50;
    const fillColor = element.fillColor;
    const strokeColor = element.strokeColor;
    const strokeWidth = element.strokeWidth || 1;

    if (fillColor) {
      doc.fillColor(fillColor);
      doc.circle(x, y, radius).fill();
    }

    if (strokeColor) {
      doc.strokeColor(strokeColor);
      doc.lineWidth(strokeWidth);
      doc.circle(x, y, radius).stroke();
    }
  }

  /**
   * Renders an image element
   * @param {PDFDocument} doc - PDF document
   * @param {Object} element - Image element configuration
   */
  renderImageElement(doc, element) {
    try {
      if (element.src) {
        const imagePath = path.join(UPLOADS_BASE, element.src);
        if (fs.existsSync(imagePath)) {
          const x = this.resolvePosition(element.x, doc.page.width);
          const y = this.resolvePosition(element.y, doc.page.height);
          const width = element.width || 100;
          const height = element.height || 100;

          doc.image(imagePath, x, y, { width, height });
        }
      }
    } catch (imageError) {
      console.error('Error rendering image:', imageError);
    }
  }

  /**
   * Renders default certificate template (fallback)
   * @param {PDFDocument} doc - PDF document
   * @param {Object} certificate - Certificate data
   */
  renderDefaultCertificate(doc, certificate) {
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;

    // Draw border
    doc.strokeColor('#3B82F6');
    doc.lineWidth(3);
    doc.rect(30, 30, pageWidth - 60, pageHeight - 60).stroke();

    // Draw inner border
    doc.strokeColor('#FBBF24');
    doc.lineWidth(1);
    doc.rect(40, 40, pageWidth - 80, pageHeight - 80).stroke();

    // Title
    doc.font('Helvetica-Bold');
    doc.fontSize(36);
    doc.fillColor('#3B82F6');
    doc.text('CERTIFICAT DE RÉUSSITE', 0, 100, {
      width: pageWidth,
      align: 'center'
    });

    // Student name
    doc.font('Times-Roman');
    doc.fontSize(24);
    doc.fillColor('#1F2937');
    doc.text('Décerné à', 0, 180, {
      width: pageWidth,
      align: 'center'
    });

    doc.font('Times-Bold');
    doc.fontSize(32);
    doc.fillColor('#000000');
    doc.text(certificate.student_name || 'Étudiant', 0, 220, {
      width: pageWidth,
      align: 'center'
    });

    // Formation title
    doc.font('Helvetica');
    doc.fontSize(18);
    doc.fillColor('#1F2937');
    doc.text('Pour avoir réussi la formation', 0, 280, {
      width: pageWidth,
      align: 'center'
    });

    doc.font('Helvetica-Bold');
    doc.fontSize(22);
    doc.fillColor('#3B82F6');
    doc.text(certificate.formation_title || 'Formation', 0, 310, {
      width: pageWidth,
      align: 'center'
    });

    // Completion date and grade
    doc.font('Helvetica');
    doc.fontSize(14);
    doc.fillColor('#4B5563');
    const completionDate = certificate.completion_date ? new Date(certificate.completion_date).toLocaleDateString('fr-FR') : '';
    doc.text(`Complété le ${completionDate}`, 0, 370, {
      width: pageWidth,
      align: 'center'
    });

    if (certificate.grade) {
      doc.text(`Note obtenue: ${Math.round(certificate.grade)}%`, 0, 395, {
        width: pageWidth,
        align: 'center'
      });
    }

    // Certificate number
    doc.font('Helvetica');
    doc.fontSize(10);
    doc.fillColor('#9CA3AF');
    doc.text(`N° de certificat: ${certificate.certificate_number}`, 0, pageHeight - 60, {
      width: pageWidth,
      align: 'center'
    });

    // Signature line
    doc.strokeColor('#000000');
    doc.lineWidth(1);
    doc.moveTo(pageWidth / 2 - 100, pageHeight - 100);
    doc.lineTo(pageWidth / 2 + 100, pageHeight - 100);
    doc.stroke();

    doc.font('Helvetica');
    doc.fontSize(12);
    doc.fillColor('#000000');
    doc.text('Signature', pageWidth / 2 - 100, pageHeight - 85, {
      width: 200,
      align: 'center'
    });
  }

  /**
   * Formats a date according to the specified format
   * @param {string|Date} dateValue - Date value to format
   * @param {string} format - Format type: 'numeric', 'long', 'short', 'full'
   * @returns {string} - Formatted date string
   */
  formatDate(dateValue, format = 'numeric') {
    if (!dateValue) return '';

    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';

    const months = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    const monthsShort = [
      'Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin',
      'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'
    ];
    const days = [
      'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'
    ];

    const day = String(date.getDate()).padStart(2, '0');
    const dayNum = date.getDate();
    const month = date.getMonth();
    const year = date.getFullYear();
    const dayOfWeek = date.getDay();

    switch (format) {
      case 'long':
        // 01 Janvier 2026
        return `${day} ${months[month]} ${year}`;
      case 'short':
        // 1 Jan 2026
        return `${dayNum} ${monthsShort[month]} ${year}`;
      case 'full':
        // Mercredi 01 Janvier 2026
        return `${days[dayOfWeek]} ${day} ${months[month]} ${year}`;
      case 'numeric':
      default:
        // 01/01/2026
        return date.toLocaleDateString('fr-FR');
    }
  }

  /**
   * Substitutes variables in text with certificate data
   * Automatically standardizes text formatting for consistent documents
   * @param {string} text - Text with variables
   * @param {Object} certificate - Certificate data
   * @param {Object} element - Optional element with dateFormat property
   * @returns {string} - Text with substituted and standardized values
   */
  substituteVariables(text, certificate, element = null) {
    const metadata = certificate.metadata || {};
    const dateFormat = element?.dateFormat || 'numeric';

    // Apply standardization rules to each field type
    const variables = {
      // Names - Title Case (Jean Dupont, not JEAN DUPONT or jean dupont)
      '{student_name}': toTitleCase(certificate.student_name || ''),
      '{student_first_name}': toTitleCase(metadata.prenom || metadata.student_first_name || ''),
      '{student_last_name}': toTitleCase(metadata.nom || metadata.student_last_name || ''),
      '{director_name}': toTitleCase(metadata.director_name || ''),

      // Formation - Title Case
      '{formation_title}': toTitleCase(certificate.formation_title || ''),

      // Locations - Title Case
      '{birth_place}': toTitleCase(metadata.birth_place || metadata.lieu_naissance || ''),
      '{lieu_naissance}': toTitleCase(metadata.lieu_naissance || metadata.birth_place || ''),
      '{city}': toTitleCase(metadata.city || metadata.ville || ''),
      '{ville}': toTitleCase(metadata.ville || metadata.city || ''),

      // CIN - Uppercase, no spaces (T209876, not t 209876)
      '{cin}': formatCIN(metadata.cin || metadata.student_id || ''),
      '{CIN}': formatCIN(metadata.cin || metadata.student_id || ''),
      '{student_id}': formatCIN(metadata.cin || metadata.student_id || certificate.student_id || ''),

      // Certificate number - Uppercase (CERT-2024-001)
      '{certificate_number}': formatCertificateNumber(certificate.certificate_number || ''),
      '{certificate_serial}': certificate.certificate_serial || certificate.certificate_number || '',

      // Dates - Use element's dateFormat
      '{completion_date}': this.formatDate(certificate.completion_date, dateFormat),
      '{issued_date}': this.formatDate(certificate.issued_date || certificate.completion_date, dateFormat),
      '{birth_date}': this.formatDate(metadata.birth_date, dateFormat),
      '{date_naissance}': this.formatDate(metadata.date_naissance || metadata.birth_date, dateFormat),
      '{student_birth_date}': this.formatDate(metadata.date_naissance || metadata.birth_date || metadata.student_birth_date, dateFormat),

      // Session dates - Use element's dateFormat
      '{session_date_debut}': this.formatDate(metadata.session_date_debut || metadata.session_start_date, dateFormat),
      '{session_date_fin}': this.formatDate(metadata.session_date_fin || metadata.session_end_date, dateFormat),

      // Session info
      '{session_title}': toTitleCase(metadata.session_title || metadata.session_name || ''),
      '{session_ville}': toTitleCase(metadata.session_ville || metadata.session_city || ''),
      '{session_segment}': toTitleCase(metadata.session_segment || ''),
      '{session_corps_formation}': toTitleCase(metadata.session_corps_formation || metadata.corps_formation || ''),

      // Student contact info
      '{student_email}': metadata.student_email || metadata.email || '',
      '{student_phone}': metadata.student_phone || metadata.phone || metadata.telephone || '',
      '{student_whatsapp}': metadata.student_whatsapp || metadata.whatsapp || '',
      '{student_address}': metadata.student_address || metadata.address || metadata.adresse || '',

      // Numbers - Keep as is
      '{grade}': certificate.grade ? certificate.grade.toFixed(1) : '',
      '{grade_rounded}': certificate.grade ? Math.round(certificate.grade).toString() : '',
      '{duration_hours}': certificate.duration_hours || metadata.duration_hours || '',
      '{current_year}': new Date().getFullYear().toString(),

      // Organization - Title Case
      '{organization_name}': toTitleCase(metadata.organization_name || ''),
      '{organization_address}': metadata.organization_address || ''
    };

    let result = text;
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), value);
    }

    return result;
  }

  /**
   * Resolves position (handles 'center', numbers, and expressions)
   * @param {string|number} position - Position value
   * @param {number} dimension - Page dimension (width or height)
   * @returns {number} - Resolved position in pixels
   */
  resolvePosition(position, dimension) {
    if (position === undefined || position === null) {
      return 0;
    }

    if (position === 'center') {
      return dimension / 2;
    }

    if (typeof position === 'number') {
      return position;
    }

    if (typeof position === 'string') {
      // Handle percentage values like "50%"
      if (position.endsWith('%')) {
        const percent = parseFloat(position);
        if (!isNaN(percent)) {
          return (percent / 100) * dimension;
        }
      }

      // Handle simple expressions like "width / 2" or "height - 100"
      try {
        // Safer expression evaluation without eval
        const cleanExpr = position
          .replace(/width/gi, dimension.toString())
          .replace(/height/gi, dimension.toString());

        // Only allow numbers, operators, and whitespace
        if (/^[\d\s+\-*/().]+$/.test(cleanExpr)) {
          // Use Function constructor as safer alternative to eval
          const result = new Function('return ' + cleanExpr)();
          if (!isNaN(result)) {
            return result;
          }
        }

        return parseFloat(position) || 0;
      } catch {
        return parseFloat(position) || 0;
      }
    }

    return 0;
  }

  /**
   * Resolves font name to PDFKit built-in font
   * @param {string} fontName - Font name
   * @returns {string} - PDFKit font name
   */
  resolveFont(fontName) {
    const fontMap = {
      'Helvetica': 'Helvetica',
      'Helvetica-Bold': 'Helvetica-Bold',
      'Times': 'Times-Roman',
      'Times-Roman': 'Times-Roman',
      'Times-Bold': 'Times-Bold',
      'Courier': 'Courier',
      'Arial': 'Helvetica',  // Fallback
      'Verdana': 'Helvetica',  // Fallback
      'Georgia': 'Times-Roman',  // Fallback
    };

    return fontMap[fontName] || 'Helvetica';
  }
}

export default CertificatePDFGenerator;
