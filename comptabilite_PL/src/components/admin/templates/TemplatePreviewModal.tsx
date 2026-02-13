import React, { useRef, useEffect, useState } from 'react';
import { X, Download } from 'lucide-react';
import type { CertificateTemplate } from '@/types/certificateTemplate';
import { getTemplatePages } from '@/types/certificateTemplate';
import { getCanvasDimensions } from '@/lib/utils/canvasDimensions';

interface TemplatePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: CertificateTemplate;
}

/**
 * Modal de prévisualisation du template de certificat avec données de test
 */
export const TemplatePreviewModal: React.FC<TemplatePreviewModalProps> = ({
  isOpen,
  onClose,
  template,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = useState(true);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsRendering(true);

    // Obtenir les dimensions du canvas
    const { format, orientation, customWidth, customHeight } = template.template_config.layout;
    const dimensions = getCanvasDimensions(format, orientation, customWidth, customHeight);

    canvas.width = dimensions.width;
    canvas.height = dimensions.height;

    // Fond blanc
    ctx.fillStyle = template.template_config.colors.background;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Charger et dessiner l'image de fond si elle existe
    const renderBackground = async () => {
      if (template.background_image_url) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = template.background_image_url!;
          });
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        } catch (error) {
          console.error('Erreur lors du chargement de l\'image de fond:', error);
        }
      }
    };

    const renderElements = () => {
      // Données de test
      const testData = {
        studentName: 'Jean Dupont',
        courseName: 'Formation en Développement Web',
        date: new Date().toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
        instructor: 'Marie Martin',
        duration: '40 heures',
      };

      // Récupérer les pages avec migration automatique
      const pages = getTemplatePages(template.template_config, {
        url: template.background_image_url,
        type: template.background_image_type,
      });

      // Rendu des éléments de toutes les pages (pour la preview, afficher seulement la première page)
      const elementsToRender = pages[0]?.elements || [];
      elementsToRender.forEach((element) => {
        ctx.save();

        // Convertir les coordonnées en nombres
        const x = typeof element.x === 'string' ? parseFloat(element.x) : (element.x || 0);
        const y = typeof element.y === 'string' ? parseFloat(element.y) : (element.y || 0);
        const width = typeof element.width === 'string' ? parseFloat(element.width) : (element.width || 0);
        const height = typeof element.height === 'string' ? parseFloat(element.height) : (element.height || 0);

        switch (element.type) {
          case 'text':
            const fontStyle = element.fontStyle || 'normal';
            const fontWeight = fontStyle === 'bold' ? 'bold' : 'normal';
            const fontFamily = element.fontFamily || 'Arial';
            const fontSize = element.fontSize || 16;

            ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
            ctx.fillStyle = element.color || '#000000';
            ctx.textAlign = (element.textAlign || 'left') as CanvasTextAlign;
            ctx.textBaseline = 'top'; // Aligner en haut comme CSS pour matcher l'éditeur

            // Remplacer les placeholders par les données de test
            let text = element.content || '';
            text = text.replace(/\{studentName\}/g, testData.studentName);
            text = text.replace(/\{courseName\}/g, testData.courseName);
            text = text.replace(/\{date\}/g, testData.date);
            text = text.replace(/\{instructor\}/g, testData.instructor);
            text = text.replace(/\{duration\}/g, testData.duration);

            // Compenser le padding CSS de l'éditeur (padding-top: 4px)
            const EDITOR_PADDING_TOP = 4;
            ctx.fillText(text, x, y + EDITOR_PADDING_TOP);
            break;

          case 'rectangle':
            ctx.strokeStyle = element.color || '#000000';
            ctx.lineWidth = element.borderWidth || 1;
            if (element.fillColor) {
              ctx.fillStyle = element.fillColor;
              ctx.fillRect(x, y, width, height);
            }
            ctx.strokeRect(x, y, width, height);
            break;

          case 'circle':
            const radius = width / 2;
            ctx.strokeStyle = element.color || '#000000';
            ctx.lineWidth = element.borderWidth || 1;
            ctx.beginPath();
            ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2);
            if (element.fillColor) {
              ctx.fillStyle = element.fillColor;
              ctx.fill();
            }
            ctx.stroke();
            break;

          case 'line':
            ctx.strokeStyle = element.color || '#000000';
            ctx.lineWidth = element.borderWidth || 1;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + width, y + height);
            ctx.stroke();
            break;

          case 'image':
            if (element.imageUrl) {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.onload = () => {
                ctx.drawImage(img, x, y, width, height);
              };
              img.src = element.imageUrl;
            }
            break;
        }

        ctx.restore();
      });

      setIsRendering(false);
    };

    // Rendre en séquence: fond puis éléments
    renderBackground().then(renderElements);
  }, [isOpen, template]);

  const handleDownload = () => {
    if (!canvasRef.current) return;

    const link = document.createElement('a');
    link.download = `preview-${template.name}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-purple-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Prévisualisation du Template</h2>
            <p className="text-sm text-gray-600 mt-0.5">{template.name}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center gap-2 transition-colors text-sm font-medium"
              title="Télécharger l'aperçu"
            >
              <Download className="h-4 w-4" />
              Télécharger
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-purple-200 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-auto p-6 bg-gray-50 relative">
          {isRendering && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 z-10">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-3"></div>
                <p className="text-sm text-gray-600">Génération de l'aperçu...</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center min-h-full">
            <div className="bg-white p-4 rounded-lg shadow-lg">
              <canvas
                ref={canvasRef}
                className="border border-gray-300 max-w-full h-auto"
                style={{ maxHeight: 'calc(95vh - 200px)' }}
              />
            </div>
          </div>
        </div>

        {/* Footer with test data info */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <p className="text-xs text-gray-600 text-center">
            <span className="font-semibold">Note:</span> Cette prévisualisation utilise des données
            de test. Les placeholders {'{studentName}'}, {'{courseName}'}, {'{date}'}, etc. sont
            remplacés par des valeurs fictives.
          </p>
        </div>
      </div>
    </div>
  );
};
