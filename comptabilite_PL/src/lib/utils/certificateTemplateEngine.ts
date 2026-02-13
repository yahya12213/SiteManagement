/**
 * Moteur de génération de certificats PDF dynamique
 * basé sur des templates configurables
 */
import jsPDF from 'jspdf';
import type { Certificate } from '@/lib/api/certificates';
import type {
  CertificateTemplate,
  TemplateElement,
  TemplateFont,
  CustomFont,
} from '@/types/certificateTemplate';
import { getTemplatePages } from '@/types/certificateTemplate';
import { certificateTemplatesApi } from '@/lib/api/certificateTemplates';
import { getCanvasDimensions, FORMAT_DIMENSIONS_MM } from '@/lib/utils/canvasDimensions';

/**
 * Classe principale du moteur de génération de certificats
 */
export class CertificateTemplateEngine {
  private doc: jsPDF;
  private certificate: Certificate;
  private template: CertificateTemplate;
  private pageWidth: number;
  private pageHeight: number;
  private customFonts: CustomFont[] = [];
  private isCustomFontsLoaded: boolean = false;
  private pxToMmX: number; // Ratio de conversion pixels → mm sur l'axe X
  private pxToMmY: number; // Ratio de conversion pixels → mm sur l'axe Y
  private canvasWidthPx: number; // Largeur du canvas en pixels
  private canvasHeightPx: number; // Hauteur du canvas en pixels

  constructor(certificate: Certificate, template: CertificateTemplate) {
    this.certificate = certificate;
    this.template = template;

    const config = template.template_config;
    const { format, orientation, customWidth, customHeight } = config.layout;

    // Obtenir les dimensions du canvas en pixels
    const canvasDimensions = getCanvasDimensions(format, orientation, customWidth, customHeight);
    this.canvasWidthPx = canvasDimensions.width;
    this.canvasHeightPx = canvasDimensions.height;

    // Obtenir les dimensions PDF en mm
    let pdfWidthMm: number;
    let pdfHeightMm: number;

    if (format === 'custom') {
      // Use custom dimensions
      pdfWidthMm = orientation === 'landscape' ? (customWidth || 210) : (customHeight || 297);
      pdfHeightMm = orientation === 'landscape' ? (customHeight || 297) : (customWidth || 210);
    } else {
      const pdfDimensions = FORMAT_DIMENSIONS_MM[format];
      pdfWidthMm = orientation === 'landscape' ? pdfDimensions.width : pdfDimensions.height;
      pdfHeightMm = orientation === 'landscape' ? pdfDimensions.height : pdfDimensions.width;
    }

    // Calculer les ratios de conversion
    this.pxToMmX = pdfWidthMm / this.canvasWidthPx;
    this.pxToMmY = pdfHeightMm / this.canvasHeightPx;

    // Déterminer le format pour jsPDF
    // Pour 'badge' et 'custom', on passe les dimensions en mm directement
    let jsPdfFormat: string | number[];
    if (format === 'badge' || format === 'custom') {
      jsPdfFormat = [pdfWidthMm, pdfHeightMm];
    } else {
      jsPdfFormat = format; // 'a4' ou 'letter'
    }

    // Créer le document PDF
    this.doc = new jsPDF({
      orientation: orientation || 'landscape',
      unit: 'mm',
      format: jsPdfFormat,
    });

    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
  }

  /**
   * Charger les polices personnalisées depuis l'API
   */
  private async loadCustomFonts(): Promise<void> {
    if (this.isCustomFontsLoaded) return;

    try {
      const result = await certificateTemplatesApi.getCustomFonts();
      this.customFonts = result.fonts || [];

      // Charger chaque police dans jsPDF
      for (const font of this.customFonts) {
        try {
          // Charger le fichier de police
          const response = await fetch(font.file_url);
          const blob = await response.blob();
          const base64 = await this.blobToBase64(blob);

          // Extraire la partie base64 pure (sans "data:...;base64,")
          const base64Data = base64.split(',')[1];

          // Ajouter le fichier à jsPDF
          const fontName = `custom-${font.id}`;
          this.doc.addFileToVFS(`${fontName}.${font.file_format}`, base64Data);
          this.doc.addFont(
            `${fontName}.${font.file_format}`,
            fontName,
            'normal'
          );
        } catch (err) {
          console.warn(`Failed to load custom font ${font.name}:`, err);
        }
      }

      this.isCustomFontsLoaded = true;
    } catch (error) {
      console.error('Error loading custom fonts:', error);
    }
  }

  /**
   * Convertir Blob en base64
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Charger et afficher l'image de fond
   * @param bgUrl URL de l'image (optionnel, utilise this.template.background_image_url par défaut)
   */
  private async loadBackgroundImage(bgUrl?: string): Promise<void> {
    const backgroundUrl = bgUrl || this.template.background_image_url;
    if (!backgroundUrl) return;

    try {
      const response = await fetch(backgroundUrl);
      const blob = await response.blob();
      const base64 = await this.blobToBase64(blob);

      // Ajouter l'image de fond en pleine page
      this.doc.addImage(
        base64,
        'JPEG', // jsPDF détectera automatiquement le format
        0,
        0,
        this.pageWidth,
        this.pageHeight,
        undefined,
        'FAST'
      );
    } catch (error) {
      console.error('Error loading background image:', error);
    }
  }

  /**
   * Convertir coordonnées canvas (pixels) en mm pour PDF
   * Supporte les expressions comme "center", "pageWidth - 20", etc.
   */
  private pxToMm(value: number | string, axis: 'x' | 'y'): number {
    let pixelValue: number;

    if (typeof value === 'number') {
      pixelValue = value;
    } else {
      // C'est une expression - la calculer d'abord en pixels
      pixelValue = this.calculatePixelPosition(value, axis);
    }

    // Utiliser les ratios dynamiques calculés dans le constructeur
    return axis === 'x' ? pixelValue * this.pxToMmX : pixelValue * this.pxToMmY;
  }

  /**
   * Calculer une position en pixels depuis une expression
   * Supporte "center", "CANVAS_WIDTH_PX - 20", etc.
   */
  private calculatePixelPosition(expression: string | number, axis: 'x' | 'y' = 'x'): number {
    if (typeof expression === 'number') {
      return expression;
    }

    // Remplacer les mots-clés par leurs valeurs en pixels (utiliser les dimensions dynamiques)
    let expr = expression
      .replace(/CANVAS_WIDTH_PX|canvasWidth/g, String(this.canvasWidthPx))
      .replace(/CANVAS_HEIGHT_PX|canvasHeight/g, String(this.canvasHeightPx))
      .replace(
        /center/g,
        axis === 'x' ? String(this.canvasWidthPx / 2) : String(this.canvasHeightPx / 2)
      );

    // Évaluer l'expression mathématique de manière sécurisée
    try {
      // Nettoyer l'expression (autoriser seulement chiffres, opérateurs, parenthèses)
      if (!/^[\d\s+\-*/().]+$/.test(expr)) {
        console.warn('Expression non valide:', expr);
        return 0;
      }
      // eslint-disable-next-line no-new-func
      return Function(`'use strict'; return (${expr})`)();
    } catch (error) {
      console.error('Error calculating pixel position:', expr, error);
      return 0;
    }
  }

  /**
   * Générer le PDF complet
   */
  async generate(): Promise<jsPDF> {
    // Charger les polices personnalisées
    await this.loadCustomFonts();

    // Récupérer les pages du template (avec migration automatique si nécessaire)
    const pages = getTemplatePages(
      this.template.template_config,
      {
        url: this.template.background_image_url,
        type: this.template.background_image_type,
      }
    );

    // Générer chaque page
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex];

      // Ajouter une nouvelle page PDF pour le verso et les pages suivantes
      if (pageIndex > 0) {
        this.doc.addPage();
      }

      // Charger le background spécifique à cette page (ou fallback template background)
      await this.loadBackgroundImage(page.background_image_url);

      // Dessiner chaque élément de la page dans l'ordre
      for (const element of page.elements) {
        // Vérifier la condition si elle existe
        if (element.condition && !this.checkCondition(element.condition)) {
          continue; // Skip cet élément
        }

        await this.renderElement(element);
      }
    }

    return this.doc;
  }

  /**
   * Ajouter les pages du template à un document PDF existant (pour la génération en masse)
   */
  async appendToDocument(existingDoc: jsPDF): Promise<void> {
    // Charger les polices personnalisées
    await this.loadCustomFonts();

    // Utiliser le document existant au lieu du doc interne
    this.doc = existingDoc;

    // Récupérer les pages du template
    const pages = getTemplatePages(
      this.template.template_config,
      {
        url: this.template.background_image_url,
        type: this.template.background_image_type,
      }
    );

    // Générer chaque page (toujours ajouter une nouvelle page car on append)
    for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
      const page = pages[pageIndex];

      // Ajouter une nouvelle page PDF
      this.doc.addPage();

      // Charger le background spécifique à cette page
      await this.loadBackgroundImage(page.background_image_url);

      // Dessiner chaque élément de la page dans l'ordre
      for (const element of page.elements) {
        if (element.condition && !this.checkCondition(element.condition)) {
          continue;
        }
        await this.renderElement(element);
      }
    }
  }

  /**
   * Vérifier une condition (ex: "grade" pour afficher seulement si grade existe)
   */
  private checkCondition(condition: string): boolean {
    const data: any = this.certificate;
    const value = data[condition];
    return value !== null && value !== undefined && value !== '';
  }

  /**
   * Remplacer les variables dynamiques dans un texte
   * @param text Texte contenant des variables {xxx}
   * @param dateFormat Format de date à utiliser (de l'élément): 'numeric', 'short', 'long', 'full'
   */
  private replaceVariables(text: string, dateFormat?: string): string {
    // Utiliser le format de date spécifié par l'élément, ou 'long' par défaut si non défini
    // IMPORTANT: Respecter le choix de l'utilisateur - si 'numeric' est choisi, utiliser 'numeric'
    const effectiveDateFormat = dateFormat || 'long';

    // Construire l'objet des variables
    const variables: Record<string, any> = {
      // Student fields
      '{student_name}': this.certificate.student_name || 'Étudiant',
      '{student_first_name}': (this.certificate.metadata as any)?.student_first_name || (this.certificate.metadata as any)?.prenom || '',
      '{student_last_name}': (this.certificate.metadata as any)?.student_last_name || (this.certificate.metadata as any)?.nom || '',
      '{student_email}': this.certificate.student_email || '',
      '{student_id}': (this.certificate.metadata as any)?.student_id || (this.certificate.metadata as any)?.cin || '',
      '{student_phone}': (this.certificate.metadata as any)?.student_phone || (this.certificate.metadata as any)?.phone || '',
      '{student_whatsapp}': (this.certificate.metadata as any)?.student_whatsapp || (this.certificate.metadata as any)?.whatsapp || '',
      '{student_birth_date}': (this.certificate.metadata as any)?.student_birth_date || (this.certificate.metadata as any)?.date_naissance ? this.formatDate((this.certificate.metadata as any)?.student_birth_date || (this.certificate.metadata as any)?.date_naissance, effectiveDateFormat as 'numeric' | 'long' | 'short' | 'full') : '',
      '{student_birth_place}': (this.certificate.metadata as any)?.student_birth_place || (this.certificate.metadata as any)?.lieu_naissance || '',
      '{student_address}': (this.certificate.metadata as any)?.student_address || (this.certificate.metadata as any)?.adresse || '',
      // Formation fields
      '{formation_title}': this.certificate.formation_title || 'Formation',
      '{formation_description}': this.certificate.formation_description || '',
      '{duration_hours}': this.certificate.duration_hours || '',
      // Certificate fields - use effectiveDateFormat
      '{completion_date}': this.formatDate(this.certificate.completion_date, effectiveDateFormat as 'numeric' | 'long' | 'short' | 'full'),
      '{completion_date_short}': this.formatDate(this.certificate.completion_date, 'numeric'),
      '{issued_date}': this.formatDate(this.certificate.issued_at, effectiveDateFormat as 'numeric' | 'long' | 'short' | 'full'),
      '{issued_date_short}': this.formatDate(this.certificate.issued_at, 'numeric'),
      '{certificate_number}': this.certificate.certificate_number || '',
      '{certificate_serial}': (this.certificate.metadata as any)?.certificate_serial || '',
      '{grade}': this.certificate.grade !== null && this.certificate.grade !== undefined ? this.certificate.grade : '',
      '{grade_rounded}':
        this.certificate.grade !== null && this.certificate.grade !== undefined
          ? Math.round(this.certificate.grade)
          : '',
      // Session fields - use effectiveDateFormat (was hardcoded to 'short', causing the bug!)
      '{session_title}': (this.certificate.metadata as any)?.session_title || '',
      '{session_date_debut}': (this.certificate.metadata as any)?.session_date_debut ? this.formatDate((this.certificate.metadata as any)?.session_date_debut, effectiveDateFormat as 'numeric' | 'long' | 'short' | 'full') : '',
      '{session_date_fin}': (this.certificate.metadata as any)?.session_date_fin ? this.formatDate((this.certificate.metadata as any)?.session_date_fin, effectiveDateFormat as 'numeric' | 'long' | 'short' | 'full') : '',
      '{session_ville}': (this.certificate.metadata as any)?.session_ville || '',
      '{session_segment}': (this.certificate.metadata as any)?.session_segment || '',
      '{session_corps_formation}': (this.certificate.metadata as any)?.session_corps_formation || '',
      // Other fields
      '{current_year}': new Date().getFullYear(),
      '{current_date}': this.formatDate(new Date(), effectiveDateFormat as 'numeric' | 'long' | 'short' | 'full'),
      '{organization_name}':
        (this.certificate.metadata as any)?.organization_name || 'Centre de Formation',
      '{organization_address}': (this.certificate.metadata as any)?.organization_address || '',
      '{director_name}': (this.certificate.metadata as any)?.director_name || 'Directeur',
      '{logo_url}': (this.certificate.metadata as any)?.logo_url || '',
      '{signature_url}': (this.certificate.metadata as any)?.signature_url || '',
      '{student_photo_url}': (this.certificate.metadata as any)?.student_photo_url || '',
    };

    let result = text;

    // Remplacer toutes les variables
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(key.replace(/[{}]/g, '\\$&'), 'g'), String(value || ''));
    });

    return result;
  }


  /**
   * Obtenir une couleur depuis la config ou depuis un hex direct
   */
  private getColor(colorKey: string): [number, number, number] {
    const colors = this.template.template_config.colors;

    // Si c'est une clé de couleur (primary, secondary, etc.)
    const colorValue = colors[colorKey] || colorKey;

    // Si c'est un hex, convertir en RGB
    if (colorValue.startsWith('#')) {
      return this.hexToRgb(colorValue);
    }

    // Sinon retourner noir par défaut
    return [0, 0, 0];
  }

  /**
   * Convertir hex en RGB
   */
  private hexToRgb(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
      : [0, 0, 0];
  }

  /**
   * Formater une date selon le format spécifié
   * @param dateString Date à formater
   * @param format Format: 'numeric' (01/01/2026), 'long' (01 Janvier 2026), 'short' (1 Jan 2026), 'full' (Mercredi 01 Janvier 2026)
   */
  private formatDate(dateString: string | Date, format: 'numeric' | 'long' | 'short' | 'full'): string {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return '';
      }

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
    } catch {
      return '';
    }
  }

  /**
   * Dessiner un élément selon son type
   */
  private async renderElement(element: TemplateElement): Promise<void> {
    try {
      switch (element.type) {
        case 'text':
          this.renderText(element);
          break;
        case 'line':
          this.renderLine(element);
          break;
        case 'border':
        case 'rectangle':
          this.renderRectangle(element);
          break;
        case 'circle':
          this.renderCircle(element);
          break;
        case 'image':
          await this.renderImage(element);
          break;
        default:
          console.warn('Unknown element type:', element.type);
      }
    } catch (error) {
      console.error('Error rendering element:', element.id, error);
    }
  }

  /**
   * Dessiner un texte
   */
  private renderText(element: TemplateElement): void {
    // Récupérer la config de police
    const fontConfig: TemplateFont = element.font
      ? this.template.template_config.fonts[element.font]
      : { family: 'helvetica', size: 12, style: 'normal', color: 'text' };

    // Appliquer la police
    let fontFamily = element.fontFamily || fontConfig.family;
    const fontStyle = element.fontStyle || fontConfig.style;
    const fontSize = element.fontSize || fontConfig.size;

    // Vérifier si c'est une police custom
    if (fontFamily.startsWith('custom-')) {
      // Police custom - vérifier qu'elle est chargée
      const customFont = this.customFonts.find((f) => `custom-${f.id}` === fontFamily);
      if (customFont) {
        this.doc.setFont(fontFamily, 'normal');
      } else {
        console.warn(`Custom font ${fontFamily} not loaded, falling back to helvetica`);
        fontFamily = 'helvetica';
        this.doc.setFont(fontFamily, fontStyle);
      }
    } else {
      this.doc.setFont(fontFamily, fontStyle);
    }

    this.doc.setFontSize(fontSize);

    // Appliquer la couleur
    const color = element.color
      ? this.getColor(element.color)
      : this.getColor(fontConfig.color || 'text');
    this.doc.setTextColor(...color);

    // Remplacer les variables (passer le dateFormat de l'élément pour formater les dates correctement)
    const text = this.replaceVariables(element.content || '', element.dateFormat);

    // Convertir les coordonnées pixels → mm
    let x = this.pxToMm(element.x || 0, 'x');
    const y = this.pxToMm(element.y || 0, 'y');

    const align = element.align || 'left';

    // Use maxWidth if available, otherwise use width (from canvas editor)
    const elementWidth = element.maxWidth || element.width;

    // CRITICAL FIX: Adjust X coordinate based on alignment
    // The stored X is the LEFT edge of the bounding box
    // jsPDF expects X to be at the alignment point
    let adjustedX = x;
    if (elementWidth && (align === 'center' || align === 'right')) {
      const widthMm = this.pxToMm(elementWidth, 'x');
      if (align === 'center') {
        adjustedX = x + (widthMm / 2); // Move to center of bounding box
      } else if (align === 'right') {
        adjustedX = x + widthMm; // Move to right edge of bounding box
      }
    }

    // FIX: Use baseline:'top' + canvas padding to match canvas CSS positioning
    // Canvas CSS: Y = top edge of box, text starts at Y + 4px padding (CanvasEditor.tsx:209)
    // jsPDF with baseline:'top': Y = top edge of text
    // Solution: Add 4px padding to Y to match canvas visual position
    const paddingTopPx = 4; // From CanvasEditor.tsx line 209
    const paddingTopMm = this.pxToMm(paddingTopPx, 'y');
    const adjustedY = y + paddingTopMm;

    // Calculer la largeur disponible en mm (priorité: width du canvas)
    const widthPx = element.width;
    const widthMm = widthPx ? this.pxToMm(widthPx, 'x') : null;

    // Option 1: Adapter la taille du texte (shrinkToFit)
    let effectiveFontSize = fontSize;
    if (element.shrinkToFit && widthMm) {
      this.doc.setFontSize(fontSize);
      const textWidth = this.doc.getTextWidth(text);
      if (textWidth > widthMm) {
        // Réduire proportionnellement (avec minimum de 6pt)
        effectiveFontSize = Math.max(6, fontSize * (widthMm / textWidth) * 0.95);
        this.doc.setFontSize(effectiveFontSize);
      }
    }

    // Option 2: Retour à la ligne automatique (wrapText) - utilise width du canvas
    if (element.wrapText && widthMm) {
      const lines = this.doc.splitTextToSize(text, widthMm);
      if (lines.length === 1) {
        this.doc.text(lines[0], adjustedX, adjustedY, { align, baseline: 'top' });
      } else {
        const lineHeightMm = (effectiveFontSize * 0.3527) * 1.2;
        lines.forEach((line: string, index: number) => {
          this.doc.text(line, adjustedX, adjustedY + index * lineHeightMm, { align, baseline: 'top' });
        });
      }
    }
    // Fallback: maxWidth existant (rétrocompatibilité)
    else if (element.maxWidth) {
      const maxWidthMm = this.pxToMm(element.maxWidth, 'x');
      const lines = this.doc.splitTextToSize(text, maxWidthMm);

      if (lines.length === 1) {
        this.doc.text(lines[0], adjustedX, adjustedY, { align, baseline: 'top' });
      } else {
        const lineHeightMm = (effectiveFontSize * 0.3527) * 1.2;
        lines.forEach((line: string, index: number) => {
          this.doc.text(line, adjustedX, adjustedY + index * lineHeightMm, { align, baseline: 'top' });
        });
      }
    }
    // Texte normal sans wrapping
    else {
      this.doc.text(text, adjustedX, adjustedY, { align, baseline: 'top' });
    }
  }

  /**
   * Dessiner une ligne
   */
  private renderLine(element: TemplateElement): void {
    // Convertir coordonnées pixels → mm
    const x1 = this.pxToMm(element.x1 || 0, 'x');
    const y1 = this.pxToMm(element.y1 || 0, 'y');
    const x2 = this.pxToMm(element.x2 || 0, 'x');
    const y2 = this.pxToMm(element.y2 || 0, 'y');

    const color = this.getColor(element.color || 'text');
    this.doc.setDrawColor(...color);
    this.doc.setLineWidth(element.lineWidth || 0.5);
    this.doc.line(x1, y1, x2, y2);
  }

  /**
   * Dessiner un rectangle (bordure)
   */
  private renderRectangle(element: TemplateElement): void {
    // Convertir coordonnées pixels → mm
    const x = this.pxToMm(element.x || 0, 'x');
    const y = this.pxToMm(element.y || 0, 'y');
    const width = this.pxToMm(element.width || 0, 'x');
    const height = this.pxToMm(element.height || 0, 'y');

    const color = this.getColor(element.color || 'secondary');
    this.doc.setDrawColor(...color);
    this.doc.setLineWidth(element.lineWidth || 1);

    // Dessiner le rectangle
    this.doc.rect(x, y, width, height);
  }

  /**
   * Dessiner un cercle
   */
  private renderCircle(element: TemplateElement): void {
    // Convertir coordonnées pixels → mm
    const x = this.pxToMm(element.x || 0, 'x');
    const y = this.pxToMm(element.y || 0, 'y');
    const radiusMm = this.pxToMm(element.radius || 10, 'x');

    // Couleur de remplissage
    const fillColor = this.getColor(element.fillColor || 'secondary');
    this.doc.setFillColor(...fillColor);

    // Dessiner le cercle rempli
    this.doc.circle(x, y, radiusMm, 'F');
  }

  /**
   * Dessiner une image (logo, signature, custom)
   */
  private async renderImage(element: TemplateElement): Promise<void> {
    if (!element.source) {
      console.warn('Image element has no source');
      return;
    }

    try {
      // Resolve variable in source (e.g., {student_photo_url}, {logo_url})
      let imageUrl = this.replaceVariables(element.source);

      // Skip if no URL after variable replacement
      if (!imageUrl || imageUrl === element.source && element.source.startsWith('{')) {
        console.warn('Image source variable not resolved:', element.source);
        return;
      }

      // Handle relative URLs (from uploads folder)
      if (imageUrl.startsWith('/uploads/')) {
        // Construct full URL using API base
        const apiUrl = (window as any).__API_URL__ || import.meta.env?.VITE_API_URL || '/api';
        const baseUrl = apiUrl.replace('/api', '');
        imageUrl = `${baseUrl}${imageUrl}`;
      }

      // Charger l'image
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const base64 = await this.blobToBase64(blob);

      // Convertir coordonnées et dimensions pixels → mm
      const x = this.pxToMm(element.x || 0, 'x');
      const y = this.pxToMm(element.y || 0, 'y');
      const width = this.pxToMm(element.width || 100, 'x');
      const height = this.pxToMm(element.height || 100, 'y');

      // Ajouter l'image au PDF
      this.doc.addImage(
        base64,
        'JPEG', // jsPDF détectera automatiquement le format
        x,
        y,
        width,
        height,
        undefined,
        'FAST'
      );
    } catch (error) {
      console.error('Error loading image:', element.source, error);
    }
  }

  /**
   * Télécharger le PDF
   * Nomenclature: TYPE_SEGMENT_NOM PRENOM_CIN_SESSION
   * Exemple: ATT CAF PROLEAN_Prolean_amine barka_T768734_casablanca teste
   */
  download(): void {
    // Nettoyer le nom du template (type de document)
    const docType = (this.template.name || 'document')
      .replace(/[^\w\s\u00C0-\u017F-]/g, '')
      .trim();

    // Segment
    const segment = (this.certificate.metadata?.session_segment || '')
      .replace(/[^\w\s\u00C0-\u017F-]/g, '')
      .trim();

    // Nom et prénom de l'étudiant
    const studentName = (this.certificate.student_name || 'etudiant')
      .replace(/[^\w\s\u00C0-\u017F-]/g, '')
      .trim();

    // CIN
    const cin = (this.certificate.metadata?.cin || '')
      .replace(/[^\w\s\u00C0-\u017F-]/g, '')
      .trim();

    // Session (titre)
    const sessionTitle = (this.certificate.metadata?.session_title || '')
      .replace(/[^\w\s\u00C0-\u017F-]/g, '')
      .trim();

    // Construire le nom final : TYPE_SEGMENT_NOM PRENOM_CIN_SESSION
    const filename = `${docType}_${segment}_${studentName}_${cin}_${sessionTitle}.pdf`;
    this.doc.save(filename);
  }

  /**
   * Obtenir le blob PDF (pour prévisualisation)
   */
  getBlob(): Blob {
    return this.doc.output('blob');
  }

  /**
   * Obtenir le data URL (base64)
   */
  getDataURL(): string {
    return this.doc.output('dataurlstring');
  }
}

/**
 * Fonction principale pour générer et télécharger un certificat
 */
export const generateCertificateFromTemplate = async (
  certificate: Certificate,
  template: CertificateTemplate
): Promise<void> => {
  const engine = new CertificateTemplateEngine(certificate, template);
  await engine.generate();
  engine.download();
};

/**
 * Fonction pour générer un aperçu PDF (retourne un Blob)
 */
export const generateCertificatePreviewFromTemplate = async (
  certificate: Certificate,
  template: CertificateTemplate
): Promise<Blob> => {
  const engine = new CertificateTemplateEngine(certificate, template);
  await engine.generate();
  return engine.getBlob();
};

/**
 * Fonction pour générer des données de test pour la prévisualisation
 */
export const generateTestCertificateData = (): Certificate => {
  return {
    id: 'test-id',
    student_id: 'test-student',
    formation_id: 'test-formation',
    student_name: 'Jean Dupont',
    student_email: 'jean.dupont@example.com',
    formation_title: 'Formation Avancée en Développement Web',
    formation_description: 'Maîtrise complète du développement web moderne',
    duration_hours: 120,
    certificate_number: 'CERT-202501-ABC123',
    issued_at: new Date().toISOString(),
    completion_date: new Date().toISOString(),
    grade: 85.5,
    metadata: {
      organization_name: 'Centre de Formation Excellence',
      organization_address: '123 Rue de la Formation, Paris',
      director_name: 'Marie Martin',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as Certificate;
};
