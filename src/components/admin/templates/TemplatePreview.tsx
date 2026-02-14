import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, Eye } from 'lucide-react';
import type { CertificateTemplate } from '@/types/certificateTemplate';
import { CertificateTemplateEngine } from '@/lib/utils/certificateTemplateEngine';
import type { Certificate } from '@/lib/api/certificates';

interface TemplatePreviewProps {
  template: CertificateTemplate;
  onRefresh?: () => void;
}

// Données de test pour le certificat
const mockCertificateData: Certificate = {
  id: 'preview-cert-123',
  certificate_number: 'CERT-2025-001',
  student_id: 'test-student',
  student_name: 'Ahmed El Idrissi',
  student_email: 'ahmed.idrissi@example.com',
  formation_id: 'test-formation',
  formation_title: 'Formation Complète React & TypeScript',
  formation_description: 'Maîtrisez React et TypeScript pour créer des applications web modernes',
  duration_hours: 40,
  completion_date: new Date().toISOString(),
  issued_at: new Date().toISOString(),
  grade: 95.5,
  metadata: {
    organization_name: 'Institut de Formation Professionnelle',
    director_name: 'Dr. Karim Bennani',
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const TemplatePreview: React.FC<TemplatePreviewProps> = ({ template, onRefresh }) => {
  const [pdfDataUrl, setPdfDataUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    generatePreview();
  }, [template]);

  const generatePreview = async () => {
    setIsGenerating(true);
    setError('');

    try {
      const engine = new CertificateTemplateEngine(mockCertificateData, template);
      const pdf = await engine.generate();

      // Convert PDF to Data URL for preview
      const dataUrl = pdf.output('dataurlstring');
      setPdfDataUrl(dataUrl);
    } catch (err: any) {
      console.error('Error generating preview:', err);
      setError(err.message || 'Erreur lors de la génération de l\'aperçu');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = async () => {
    try {
      const engine = new CertificateTemplateEngine(mockCertificateData, template);
      const pdf = await engine.generate();
      pdf.save(`preview-${template.name}-${Date.now()}.pdf`);
    } catch (err: any) {
      console.error('Error downloading preview:', err);
      alert('Erreur lors du téléchargement: ' + err.message);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Aperçu</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh || generatePreview}
            disabled={isGenerating}
            className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Rafraîchir l'aperçu"
          >
            <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Génération...' : 'Rafraîchir'}
          </button>
          <button
            onClick={handleDownload}
            disabled={isGenerating || !pdfDataUrl}
            className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Télécharger le PDF de test"
          >
            <Download className="h-4 w-4" />
            Télécharger
          </button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="bg-gray-100 rounded-lg overflow-hidden" style={{ height: '500px' }}>
        {error ? (
          <div className="flex items-center justify-center h-full text-red-600 px-4 text-center">
            <div>
              <p className="font-medium mb-2">Erreur de génération</p>
              <p className="text-sm text-red-500">{error}</p>
            </div>
          </div>
        ) : isGenerating ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-sm text-gray-600">Génération de l'aperçu...</p>
            </div>
          </div>
        ) : pdfDataUrl ? (
          <iframe
            src={pdfDataUrl}
            className="w-full h-full border-0"
            title="Aperçu du certificat"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <p className="text-sm">Aucun aperçu disponible</p>
          </div>
        )}
      </div>

      {/* Test Data Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-800">
          <strong>Données de test:</strong> Ahmed El Idrissi • Formation React & TypeScript • Note: 95.5%
        </p>
      </div>
    </div>
  );
};
