import { useState, useEffect } from 'react';
import { X, Download, FileText, Loader2, AlertCircle, Package } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { CertificateTemplateEngine } from '@/lib/utils/certificateTemplateEngine';
import type { Certificate } from '@/lib/api/certificates';
import type { CertificateTemplate } from '@/types/certificateTemplate';
import JSZip from 'jszip';

interface DocumentSummary {
  document_type: string;
  count: string;
  latest_date: string;
  first_date: string;
  printed_count: string;
}

interface CertificateListItem {
  id: string;
  certificate_number: string;
  document_type: string;
  issued_at: string;
  student_last_name: string;
  student_first_name: string;
}

interface SessionDocumentsDownloadModalProps {
  sessionId: string;
  sessionTitle: string;
  onClose: () => void;
}

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  certificat: 'Certificats',
  attestation: 'Attestations',
  badge: 'Badges'
};

const DOCUMENT_TYPE_COLORS: Record<string, string> = {
  certificat: 'bg-blue-100 text-blue-800',
  attestation: 'bg-green-100 text-green-800',
  badge: 'bg-purple-100 text-purple-800'
};

export function SessionDocumentsDownloadModal({
  sessionId,
  sessionTitle,
  onClose
}: SessionDocumentsDownloadModalProps) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null);
  const [totalDocuments, setTotalDocuments] = useState(0);
  const [segmentName, setSegmentName] = useState<string>('');

  useEffect(() => {
    loadDocumentsSummary();
  }, [sessionId]);

  const loadDocumentsSummary = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get<{ success: boolean; documents: DocumentSummary[]; total_documents: number; segment_name?: string; session_title?: string; error?: string }>(
        `/sessions-formation/${sessionId}/documents-summary`
      );

      if (response.success) {
        setDocuments(response.documents);
        setTotalDocuments(response.total_documents || 0);
        setSegmentName(response.segment_name || '');
      } else {
        setError(response.error || 'Erreur lors du chargement');
      }
    } catch (err: any) {
      console.error('Error loading documents summary:', err);
      setError(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Régénère un PDF côté frontend avec CertificateTemplateEngine
   */
  const regeneratePdf = async (certificateId: string): Promise<{ blob: Blob; fileName: string; folderName: string; issuedAt: string } | null> => {
    try {
      const response = await apiClient.get<{
        success: boolean;
        certificate: Certificate;
        template: CertificateTemplate;
        error?: string;
      }>(`/certificates/${certificateId}/regenerate-data`);

      if (!response.success) {
        throw new Error(response.error || 'Erreur lors de la récupération des données');
      }

      const { certificate, template } = response;

      // Régénérer le PDF avec CertificateTemplateEngine
      const engine = new CertificateTemplateEngine(certificate, template);
      const doc = await engine.generate();

      // Convertir en Blob
      const pdfBlob = doc.output('blob');

      // Nom du dossier = nom du template (pour organiser par type de document)
      const folderName = (template.name || 'Documents')
        .replace(/[^\w\s\u00C0-\u017F-]/g, '')
        .trim();

      // Construire le nom du fichier selon la nomenclature :
      // TYPE_SEGMENT_NOM PRENOM_CIN_SESSION
      const docType = (template.name || 'document')
        .replace(/[^\w\s\u00C0-\u017F-]/g, '')
        .trim();
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
      const fileName = `${docType}_${segment}_${studentName}_${cin}_${sessionTitle}.pdf`;

      // Date d'émission pour organiser par "A Imprimer" vs "Deja Imprimes"
      const issuedAt = certificate.issued_at || certificate.created_at || '';

      return { blob: pdfBlob, fileName, folderName, issuedAt };
    } catch (error) {
      console.error('Error regenerating PDF:', error);
      return null;
    }
  };

  /**
   * Télécharge tous les documents d'un type en créant un ZIP côté frontend
   */
  const handleDownload = async (documentType: string) => {
    try {
      setDownloading(documentType);
      setDownloadProgress({ current: 0, total: 0 });

      // 1. Récupérer la liste des certificats pour ce type
      const listResponse = await apiClient.get<{
        success: boolean;
        certificates: CertificateListItem[];
        error?: string
      }>(`/sessions-formation/${sessionId}/certificates-list?document_type=${documentType}`);

      if (!listResponse.success || !listResponse.certificates?.length) {
        alert('Aucun document trouvé pour ce type');
        return;
      }

      const certificates = listResponse.certificates;
      setDownloadProgress({ current: 0, total: certificates.length });

      // 2. Créer le ZIP
      const zip = new JSZip();
      let successCount = 0;
      let errorCount = 0;
      let todayCount = 0;
      let olderCount = 0;

      // Date d'aujourd'hui pour comparer (format YYYY-MM-DD)
      const today = new Date().toISOString().split('T')[0];

      // 3. Régénérer chaque PDF et l'ajouter au ZIP organisé par date
      // Structure: "A Imprimer/TemplateName/" ou "Deja Imprimes/TemplateName/"
      const folders: Record<string, JSZip> = {};

      for (let i = 0; i < certificates.length; i++) {
        const cert = certificates[i];
        setDownloadProgress({ current: i + 1, total: certificates.length });

        try {
          const result = await regeneratePdf(cert.id);
          if (result) {
            // Déterminer si le document est d'aujourd'hui ou plus ancien
            const isToday = result.issuedAt.startsWith(today);
            const rootFolder = isToday ? 'A Imprimer' : 'Deja Imprimes';
            const fullPath = `${rootFolder}/${result.folderName}`;

            // Créer le sous-dossier si nécessaire et y ajouter le fichier
            if (!folders[fullPath]) {
              folders[fullPath] = zip.folder(fullPath) as JSZip;
            }
            folders[fullPath].file(result.fileName, result.blob);
            successCount++;

            if (isToday) {
              todayCount++;
            } else {
              olderCount++;
            }
          } else {
            console.error(`Failed to regenerate PDF for ${cert.certificate_number}`);
            errorCount++;
          }
        } catch (err) {
          console.error(`Error regenerating PDF for ${cert.certificate_number}:`, err);
          errorCount++;
        }
      }

      if (successCount === 0) {
        alert('Impossible de générer les PDFs. Veuillez réessayer.');
        return;
      }

      // 4. Générer et télécharger le ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Format du nom: segment_session.zip (exemple: Prolean_casablanca teste.zip)
      const cleanSegment = segmentName.replace(/[^\w\s\u00C0-\u017F-]/g, '').trim() || 'Session';
      const cleanTitle = sessionTitle.replace(/[^\w\s\u00C0-\u017F-]/g, '').trim() || 'Documents';
      const fileName = `${cleanSegment}_${cleanTitle}.zip`;

      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Message de résumé
      let message = `ZIP téléchargé avec ${successCount} document(s).\n`;
      message += `📁 A Imprimer (aujourd'hui): ${todayCount} document(s)\n`;
      message += `📁 Deja Imprimes (anciens): ${olderCount} document(s)`;
      if (errorCount > 0) {
        message += `\n⚠️ ${errorCount} document(s) n'ont pas pu être générés.`;
      }
      alert(message);

    } catch (err: any) {
      console.error('Error downloading documents:', err);
      alert(err.message || 'Erreur lors du téléchargement');
    } finally {
      setDownloading(null);
      setDownloadProgress(null);
    }
  };

  /**
   * Télécharge TOUS les documents dans un seul ZIP organisé par sous-dossiers
   * Structure: Session_Name.zip / Attestations / fichiers.pdf
   *                             / Badges / fichiers.pdf
   *                             / Certificats / fichiers.pdf
   */
  const handleDownloadAll = async () => {
    try {
      setDownloadingAll(true);
      setDownloadProgress({ current: 0, total: totalDocuments });

      // Créer le ZIP principal
      const zip = new JSZip();
      let successCount = 0;
      let errorCount = 0;
      let processedCount = 0;

      // Parcourir chaque type de document
      for (const doc of documents) {
        const documentType = doc.document_type;

        // Récupérer la liste des certificats pour ce type
        const listResponse = await apiClient.get<{
          success: boolean;
          certificates: CertificateListItem[];
          error?: string
        }>(`/sessions-formation/${sessionId}/certificates-list?document_type=${documentType}`);

        if (!listResponse.success || !listResponse.certificates?.length) {
          continue;
        }

        const certificates = listResponse.certificates;

        // Nom du sous-dossier selon le type
        const folderLabel = DOCUMENT_TYPE_LABELS[documentType] || documentType;
        const subFolder = zip.folder(folderLabel);

        if (!subFolder) continue;

        // Régénérer chaque PDF et l'ajouter au sous-dossier
        for (const cert of certificates) {
          processedCount++;
          setDownloadProgress({ current: processedCount, total: totalDocuments });

          try {
            const result = await regeneratePdf(cert.id);
            if (result) {
              subFolder.file(result.fileName, result.blob);
              successCount++;
            } else {
              errorCount++;
            }
          } catch (err) {
            console.error(`Error regenerating PDF for ${cert.certificate_number}:`, err);
            errorCount++;
          }
        }
      }

      if (successCount === 0) {
        alert('Impossible de générer les PDFs. Veuillez réessayer.');
        return;
      }

      // Générer et télécharger le ZIP
      const zipBlob = await zip.generateAsync({ type: 'blob' });

      // Format du nom: segment_session.zip
      const cleanSegment = segmentName.replace(/[^\w\s\u00C0-\u017F-]/g, '').trim() || 'Session';
      const cleanTitle = sessionTitle.replace(/[^\w\s\u00C0-\u017F-]/g, '').trim() || 'Documents';
      const fileName = `${cleanSegment}_${cleanTitle}.zip`;

      const url = window.URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      // Message de résumé
      let message = `ZIP téléchargé avec ${successCount} document(s) organisés par catégorie.`;
      if (errorCount > 0) {
        message += `\n⚠️ ${errorCount} document(s) n'ont pas pu être générés.`;
      }
      alert(message);

    } catch (err: any) {
      console.error('Error downloading all documents:', err);
      alert(err.message || 'Erreur lors du téléchargement');
    } finally {
      setDownloadingAll(false);
      setDownloadProgress(null);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[550px] md:w-[600px] max-w-[95vw] mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Package className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                Télécharger Documents
              </h2>
              <p className="text-sm text-gray-500 truncate max-w-xs">
                {sessionTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={downloading !== null || downloadingAll}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 text-blue-500 animate-spin mb-3" />
              <p className="text-gray-500">Chargement des documents...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-red-500">
              <AlertCircle className="h-8 w-8 mb-3" />
              <p>{error}</p>
              <button
                type="button"
                onClick={loadDocumentsSummary}
                className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                Réessayer
              </button>
            </div>
          ) : documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mb-3 text-gray-300" />
              <p className="text-lg font-medium">Aucun document généré</p>
              <p className="text-sm mt-1">
                Générez d'abord des documents pour les étudiants de cette session
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Résumé total + Bouton Télécharger Tout */}
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">
                      <span className="font-semibold text-gray-900">{totalDocuments}</span> document(s) générés au total
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {documents.length} catégorie(s): {documents.map(d => DOCUMENT_TYPE_LABELS[d.document_type] || d.document_type).join(', ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadAll}
                    disabled={downloading !== null || downloadingAll}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      downloading !== null || downloadingAll
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700 shadow-sm'
                    }`}
                  >
                    {downloadingAll ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {downloadProgress ? (
                          <span>{downloadProgress.current}/{downloadProgress.total}</span>
                        ) : (
                          <span>Préparation...</span>
                        )}
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        Télécharger Tout
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Liste des types de documents (détail) */}
              <p className="text-xs text-gray-500 uppercase font-medium tracking-wide">Détail par catégorie</p>
              {documents.map((doc) => (
                <div
                  key={doc.document_type}
                  className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${DOCUMENT_TYPE_COLORS[doc.document_type] || 'bg-gray-100 text-gray-800'}`}>
                      {DOCUMENT_TYPE_LABELS[doc.document_type] || doc.document_type}
                    </span>
                    <div>
                      <p className="font-medium text-gray-900">
                        {doc.count} document{parseInt(doc.count) > 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-gray-500">
                        Dernier: {formatDate(doc.latest_date)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDownload(doc.document_type)}
                    disabled={downloading !== null || downloadingAll}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      downloading !== null || downloadingAll
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {downloading === doc.document_type ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {downloadProgress ? (
                          <span>{downloadProgress.current}/{downloadProgress.total}</span>
                        ) : (
                          <span>Préparation...</span>
                        )}
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4" />
                        ZIP
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t bg-gray-50 rounded-b-lg">
          <button
            type="button"
            onClick={onClose}
            disabled={downloading !== null || downloadingAll}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors disabled:opacity-50"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}

export default SessionDocumentsDownloadModal;
