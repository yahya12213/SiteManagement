/**
 * Générateur de certificats PDF professionnels
 */
import jsPDF from 'jspdf';
import type { Certificate } from '@/lib/api/certificates';
import type { CertificateTemplate } from '@/types/certificateTemplate';
import { generateCertificateFromTemplate } from './certificateTemplateEngine';

/**
 * Générer et télécharger un certificat PDF
 * Si un template est fourni, utilise le moteur de templates
 * Sinon, utilise la génération classique (fallback)
 */
export const generateCertificatePDF = async (certificate: Certificate, template?: CertificateTemplate): Promise<void> => {
  // Si un template est fourni, utiliser le moteur de templates
  if (template) {
    return await generateCertificateFromTemplate(certificate, template);
  }

  // Sinon, utiliser la génération classique (code existant ci-dessous)
  // Créer un nouveau document PDF en mode paysage
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Couleurs
  const primaryColor: [number, number, number] = [59, 130, 246]; // blue-600
  const goldColor: [number, number, number] = [251, 191, 36]; // amber-400
  const darkGray: [number, number, number] = [31, 41, 55]; // gray-800

  // ========== BORDURE DÉCORATIVE ==========
  // Bordure extérieure dorée
  doc.setDrawColor(...goldColor);
  doc.setLineWidth(1);
  doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

  // Bordure intérieure bleue
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.5);
  doc.rect(15, 15, pageWidth - 30, pageHeight - 30);

  // Lignes décoratives dans les coins
  doc.setLineWidth(2);
  // Coin supérieur gauche
  doc.line(20, 20, 40, 20);
  doc.line(20, 20, 20, 40);
  // Coin supérieur droit
  doc.line(pageWidth - 40, 20, pageWidth - 20, 20);
  doc.line(pageWidth - 20, 20, pageWidth - 20, 40);
  // Coin inférieur gauche
  doc.line(20, pageHeight - 20, 40, pageHeight - 20);
  doc.line(20, pageHeight - 40, 20, pageHeight - 20);
  // Coin inférieur droit
  doc.line(pageWidth - 40, pageHeight - 20, pageWidth - 20, pageHeight - 20);
  doc.line(pageWidth - 20, pageHeight - 40, pageWidth - 20, pageHeight - 20);

  // ========== EN-TÊTE ==========
  // "CERTIFICAT DE RÉUSSITE"
  doc.setTextColor(...goldColor);
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.text('CERTIFICAT DE RÉUSSITE', pageWidth / 2, 40, { align: 'center' });

  // Ligne décorative sous le titre
  doc.setDrawColor(...goldColor);
  doc.setLineWidth(0.5);
  doc.line(pageWidth / 2 - 50, 45, pageWidth / 2 + 50, 45);

  // ========== TEXTE PRINCIPAL ==========
  // "Ce certificat est décerné à"
  doc.setTextColor(...darkGray);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Ce certificat est décerné à', pageWidth / 2, 60, { align: 'center' });

  // NOM DE L'ÉTUDIANT (en grand et en gras)
  doc.setTextColor(...primaryColor);
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text(certificate.student_name || 'Étudiant', pageWidth / 2, 75, { align: 'center' });

  // Ligne sous le nom
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.3);
  const nameWidth = doc.getTextWidth(certificate.student_name || 'Étudiant');
  doc.line(
    pageWidth / 2 - nameWidth / 2 - 10,
    78,
    pageWidth / 2 + nameWidth / 2 + 10,
    78
  );

  // ========== DÉTAILS DE LA FORMATION ==========
  // "Pour avoir complété avec succès la formation"
  doc.setTextColor(...darkGray);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'normal');
  doc.text('Pour avoir complété avec succès la formation', pageWidth / 2, 92, { align: 'center' });

  // TITRE DE LA FORMATION
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  const formationTitle = certificate.formation_title || 'Formation';

  // Gérer les titres longs avec retour à la ligne
  const maxWidth = pageWidth - 80;
  const titleLines = doc.splitTextToSize(formationTitle, maxWidth);

  if (titleLines.length === 1) {
    doc.text(titleLines[0], pageWidth / 2, 105, { align: 'center' });
  } else {
    doc.text(titleLines[0], pageWidth / 2, 102, { align: 'center' });
    if (titleLines[1]) {
      doc.text(titleLines[1], pageWidth / 2, 110, { align: 'center' });
    }
  }

  const yPosition = titleLines.length > 1 ? 120 : 115;

  // ========== DÉTAILS SUPPLÉMENTAIRES ==========
  doc.setTextColor(...darkGray);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');

  // Date de complétion
  const completionDate = new Date(certificate.completion_date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  doc.text(`Date de complétion : ${completionDate}`, pageWidth / 2, yPosition + 10, {
    align: 'center',
  });

  // Durée (si disponible)
  if (certificate.duration_hours) {
    doc.text(
      `Durée de la formation : ${certificate.duration_hours} heures`,
      pageWidth / 2,
      yPosition + 17,
      { align: 'center' }
    );
  }

  // Note (si disponible)
  if (certificate.grade !== null && certificate.grade !== undefined) {
    doc.setTextColor(...primaryColor);
    doc.setFont('helvetica', 'bold');
    doc.text(`Note obtenue : ${certificate.grade}%`, pageWidth / 2, yPosition + 24, {
      align: 'center',
    });
  }

  // ========== NUMÉRO DE CERTIFICAT ==========
  const bottomY = pageHeight - 40;

  doc.setTextColor(...darkGray);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'italic');
  doc.text(
    `Numéro de certificat : ${certificate.certificate_number}`,
    pageWidth / 2,
    bottomY,
    { align: 'center' }
  );

  // Date d'émission
  const issuedDate = new Date(certificate.issued_at).toLocaleDateString('fr-FR');
  doc.text(`Délivré le : ${issuedDate}`, pageWidth / 2, bottomY + 5, { align: 'center' });

  // ========== SIGNATURE (placeholder) ==========
  const signatureY = bottomY - 20;

  // Ligne pour signature
  doc.setDrawColor(...darkGray);
  doc.setLineWidth(0.3);
  doc.line(pageWidth / 2 - 30, signatureY, pageWidth / 2 + 30, signatureY);

  doc.setTextColor(...darkGray);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Directeur de Formation', pageWidth / 2, signatureY + 5, { align: 'center' });

  // ========== SCEAU/BADGE DÉCORATIF ==========
  // Cercle doré dans le coin inférieur droit
  doc.setFillColor(...goldColor);
  doc.circle(pageWidth - 35, pageHeight - 35, 15, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('CERTIFIÉ', pageWidth - 35, pageHeight - 38, { align: 'center' });
  doc.text('RÉUSSITE', pageWidth - 35, pageHeight - 32, { align: 'center' });

  // ========== TÉLÉCHARGER LE PDF ==========
  // Nomenclature: TYPE_SEGMENT_NOM PRENOM_CIN_SESSION
  const docType = 'certificat';
  const segment = (certificate.metadata?.session_segment || '')
    .replace(/[^\w\s\u00C0-\u017F-]/g, '')
    .trim();
  const studentName = (certificate.student_name || 'etudiant')
    .replace(/[^\w\s\u00C0-\u017F-]/g, '')
    .trim();
  const cin = (certificate.metadata?.cin || '')
    .replace(/[^\w\s\u00C0-\u017F-]/g, '')
    .trim();
  const sessionTitle = (certificate.metadata?.session_title || '')
    .replace(/[^\w\s\u00C0-\u017F-]/g, '')
    .trim();
  const filename = `${docType}_${segment}_${studentName}_${cin}_${sessionTitle}.pdf`;
  doc.save(filename);
};

/**
 * Générer un aperçu du certificat (retourne le blob au lieu de télécharger)
 */
export const generateCertificatePreview = (_certificate: Certificate): Blob => {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  // Utiliser la même fonction de génération (code identique)
  // Pour simplifier, on retourne juste le blob
  // TODO: Implémenter la génération complète du certificat dans le blob
  return doc.output('blob');
};

/**
 * Vérifier si un certificat peut être généré pour un étudiant et une formation
 */
export const canGenerateCertificate = (
  formationCompleted: boolean,
  allTestsPassed: boolean,
  minimumProgress: number = 100
): boolean => {
  return formationCompleted && allTestsPassed && minimumProgress >= 100;
};
