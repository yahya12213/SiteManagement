import React, { useState, useEffect } from 'react';
import { X, Download, Printer, FileText, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api/client';
import { CertificateTemplateEngine } from '@/lib/utils/certificateTemplateEngine';
import type { Certificate } from '@/lib/api/certificates';
import type { CertificateTemplate } from '@/types/certificateTemplate';

interface Document {
  id: string;
  certificate_number: string;
  document_type: string;
  template_name: string | null;
  issued_at: string;
  file_path: string | null;
  archive_folder: string | null;
  grade: number | null;
  printed_at: string | null;
  printer_name: string | null;
  print_status: string;
  template_display_name: string | null;
  preview_image_url: string | null;
}

interface DocumentsResponse {
  success: boolean;
  documents: Document[];
  error?: string;
}

interface StudentDocumentsModalProps {
  sessionId: string;
  studentId: string;
  studentName: string;
  onClose: () => void;
}

export const StudentDocumentsModal: React.FC<StudentDocumentsModalProps> = ({
  sessionId,
  studentId,
  studentName,
  onClose,
}) => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, [sessionId, studentId]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get<DocumentsResponse>(
        `/sessions-formation/${sessionId}/students/${studentId}/documents`
      );

      if (response.success) {
        setDocuments(response.documents || []);
      } else {
        setError(response.error || 'Erreur lors du chargement des documents');
      }
    } catch (err: any) {
      console.error('Error loading documents:', err);
      setError(err.message || 'Erreur lors du chargement des documents');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Régénère le PDF côté frontend avec CertificateTemplateEngine
   * pour avoir le même rendu visuel que lors de la génération initiale
   */
  const regeneratePdf = async (documentId: string): Promise<{ blob: Blob; fileName: string } | null> => {
    try {
      // Récupérer les données complètes pour régénération
      const response = await apiClient.get<{
        success: boolean;
        certificate: Certificate;
        template: CertificateTemplate;
        error?: string;
      }>(`/certificates/${documentId}/regenerate-data`);

      if (!response.success) {
        throw new Error(response.error || 'Erreur lors de la récupération des données');
      }

      const { certificate, template } = response;

      // Régénérer le PDF avec CertificateTemplateEngine
      const engine = new CertificateTemplateEngine(certificate, template);
      const doc = await engine.generate();

      // Convertir en Blob
      const pdfBlob = doc.output('blob');

      // Construire le nom du fichier selon la nomenclature :
      // TYPE_SEGMENT_NOM PRENOM_CIN_SESSION
      // Exemple: ATT CAF PROLEAN_Prolean_amine barka_T768734_casablanca teste

      // Nettoyer le nom du template (type de document)
      const docType = (template.name || 'document')
        .replace(/[^\w\s\u00C0-\u017F-]/g, '') // Garder lettres, chiffres, espaces, accents, tirets
        .trim();

      // Segment
      const segment = (certificate.metadata?.session_segment || '')
        .replace(/[^\w\s\u00C0-\u017F-]/g, '')
        .trim();

      // Nom et prénom de l'étudiant
      const studentName = (certificate.student_name || 'etudiant')
        .replace(/[^\w\s\u00C0-\u017F-]/g, '')
        .trim();

      // CIN
      const cin = (certificate.metadata?.cin || '')
        .replace(/[^\w\s\u00C0-\u017F-]/g, '')
        .trim();

      // Session (titre)
      const sessionTitle = (certificate.metadata?.session_title || '')
        .replace(/[^\w\s\u00C0-\u017F-]/g, '')
        .trim();

      // Construire le nom final : TYPE_SEGMENT_NOM PRENOM_CIN_SESSION
      const fileName = `${docType}_${segment}_${studentName}_${cin}_${sessionTitle}.pdf`;

      return { blob: pdfBlob, fileName };
    } catch (error) {
      console.error('Error regenerating PDF:', error);
      throw error;
    }
  };

  const handleDownload = async (document: Document) => {
    try {
      setGeneratingPdf(document.id);

      // Régénérer le PDF côté frontend
      const result = await regeneratePdf(document.id);
      if (!result) {
        throw new Error('Impossible de régénérer le PDF');
      }

      // Créer un lien de téléchargement
      const url = window.URL.createObjectURL(result.blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = result.fileName;
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error('Error downloading document:', error);
      alert(error.message || 'Erreur lors du téléchargement du document');
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handlePrint = async (document: Document) => {
    try {
      setGeneratingPdf(document.id);

      // Régénérer le PDF côté frontend
      const result = await regeneratePdf(document.id);
      if (!result) {
        throw new Error('Impossible de régénérer le PDF');
      }

      // Créer un blob URL et l'ouvrir dans un nouvel onglet
      const url = window.URL.createObjectURL(result.blob);

      // Ouvrir dans un nouvel onglet - le PDF s'affichera dans le viewer du navigateur
      const printWindow = window.open(url, '_blank');

      if (!printWindow) {
        // Si le popup est bloqué, informer l'utilisateur
        alert('Le popup a été bloqué par le navigateur. Veuillez autoriser les popups pour ce site puis réessayer.');
      }
      // Note: L'utilisateur pourra imprimer manuellement depuis le viewer PDF du navigateur (Ctrl+P)
    } catch (error: any) {
      console.error('Error printing document:', error);
      alert(error.message || 'Erreur lors de l\'ouverture du document');
    } finally {
      setGeneratingPdf(null);
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      certificat: 'Certificat',
      attestation: 'Attestation',
      badge: 'Badge',
      diplome: 'Diplôme',
    };
    return labels[type] || type;
  };

  const getDocumentTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      certificat: 'bg-blue-100 text-blue-800',
      attestation: 'bg-green-100 text-green-800',
      badge: 'bg-purple-100 text-purple-800',
      diplome: 'bg-amber-100 text-amber-800',
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  const getPrintStatusBadge = (status: string, printedAt: string | null) => {
    if (status === 'printed' && printedAt) {
      return (
        <div className="flex items-center gap-1 text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm">Imprimé</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1 text-gray-400">
        <Clock className="h-4 w-4" />
        <span className="text-sm">Non imprimé</span>
      </div>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Documents de {studentName}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {documents.length} document{documents.length > 1 ? 's' : ''} généré{documents.length > 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Chargement des documents...</p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center text-red-600">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{error}</p>
                <Button type="button" onClick={loadDocuments} variant="outline" className="mt-4">
                  Réessayer
                </Button>
              </div>
            </div>
          ) : documents.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Aucun document généré</p>
                <p className="text-sm mt-2">Aucun document n'a encore été généré pour cet étudiant.</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Numéro</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Date</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Note</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Statut impression</th>
                    <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-1">
                          {/* Nom réel du template */}
                          <span className="font-medium text-gray-900">
                            {doc.template_name || doc.template_display_name || getDocumentTypeLabel(doc.document_type)}
                          </span>
                          {/* Badge du type de document */}
                          <Badge className={`${getDocumentTypeBadgeColor(doc.document_type)} text-xs w-fit`}>
                            {getDocumentTypeLabel(doc.document_type)}
                          </Badge>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm">{doc.certificate_number}</span>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {formatDate(doc.issued_at)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600">
                        {doc.grade !== null ? `${doc.grade}%` : '-'}
                      </td>
                      <td className="py-3 px-4">
                        {getPrintStatusBadge(doc.print_status, doc.printed_at)}
                        {doc.printed_at && (
                          <div className="text-xs text-gray-500 mt-1">
                            {formatDate(doc.printed_at)}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(doc)}
                            disabled={generatingPdf === doc.id}
                            title="Télécharger le document"
                            aria-label={`Télécharger ${getDocumentTypeLabel(doc.document_type)}`}
                          >
                            {generatingPdf === doc.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handlePrint(doc)}
                            disabled={generatingPdf === doc.id}
                            title="Ouvrir pour impression"
                            aria-label={`Imprimer ${getDocumentTypeLabel(doc.document_type)}`}
                          >
                            {generatingPdf === doc.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Printer className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <Button type="button" onClick={onClose} variant="outline">
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
};
