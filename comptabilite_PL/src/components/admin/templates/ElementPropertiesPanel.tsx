import React from 'react';
import { Trash2, Copy, AlertCircle } from 'lucide-react';
import type { TemplateElement, CustomFont } from '@/types/certificateTemplate';
import { FONT_FAMILIES, FONT_STYLES } from '@/types/certificateTemplate';
import { ColorPicker } from './ColorPicker';

interface ElementPropertiesPanelProps {
  element: TemplateElement | null;
  customFonts: CustomFont[];
  onChange: (element: TemplateElement) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

export const ElementPropertiesPanel: React.FC<ElementPropertiesPanelProps> = ({
  element,
  customFonts,
  onChange,
  onDelete,
  onDuplicate,
}) => {
  if (!element) {
    return (
      <div className="h-full bg-white border-l border-gray-200 p-6 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Sélectionnez un élément pour modifier ses propriétés</p>
        </div>
      </div>
    );
  }

  const handleFieldChange = (field: string, value: any) => {
    onChange({ ...element, [field]: value });
  };

  // Toutes les polices disponibles (built-in + custom)
  const allFonts = [
    ...FONT_FAMILIES.map(f => ({ value: f, label: f.charAt(0).toUpperCase() + f.slice(1), isCustom: false })),
    ...customFonts.map(f => ({ value: f.name, label: f.name, isCustom: true })),
  ];

  return (
    <div className="h-full overflow-y-auto bg-white border-l border-gray-200">
      <div className="p-4 space-y-6">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Propriétés de l'élément</h3>
          <p className="text-xs text-gray-500 capitalize">{element.type}</p>
        </div>

        {/* ID (lecture seule) */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ID</label>
          <input
            type="text"
            value={element.id}
            disabled
            className="w-full px-2 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded"
          />
        </div>

        {/* Position */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Position</label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 mb-1">X</label>
              <input
                type="number"
                value={element.x || 0}
                onChange={(e) => handleFieldChange('x', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Y</label>
              <input
                type="number"
                value={element.y || 0}
                onChange={(e) => handleFieldChange('y', parseFloat(e.target.value) || 0)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Dimensions (pour rectangles, images, cercles) */}
        {(element.type === 'rectangle' || element.type === 'border' || element.type === 'image' || element.type === 'circle') && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Dimensions</label>
            {element.type === 'circle' ? (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Rayon</label>
                <input
                  type="number"
                  value={element.radius || 20}
                  onChange={(e) => handleFieldChange('radius', parseFloat(e.target.value) || 20)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Largeur</label>
                  <input
                    type="number"
                    value={element.width || 100}
                    onChange={(e) => handleFieldChange('width', parseFloat(e.target.value) || 100)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Hauteur</label>
                  <input
                    type="number"
                    value={element.height || 50}
                    onChange={(e) => handleFieldChange('height', parseFloat(e.target.value) || 50)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ligne (coordonnées) */}
        {element.type === 'line' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">Coordonnées</label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-500 mb-1">X1</label>
                <input
                  type="number"
                  value={element.x1 || 0}
                  onChange={(e) => handleFieldChange('x1', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Y1</label>
                <input
                  type="number"
                  value={element.y1 || 0}
                  onChange={(e) => handleFieldChange('y1', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">X2</label>
                <input
                  type="number"
                  value={element.x2 || 100}
                  onChange={(e) => handleFieldChange('x2', parseFloat(e.target.value) || 100)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Y2</label>
                <input
                  type="number"
                  value={element.y2 || 0}
                  onChange={(e) => handleFieldChange('y2', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
                />
              </div>
            </div>
          </div>
        )}

        {/* Texte */}
        {element.type === 'text' && (
          <>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Contenu</label>
              <textarea
                value={element.content || ''}
                onChange={(e) => handleFieldChange('content', e.target.value)}
                rows={3}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                placeholder="Texte ou variable {student_name}"
              />
              <p className="text-xs text-gray-500 mt-1">
                Variables: {'{'}student_name{'}'}, {'{'}formation_title{'}'}, {'{'}grade{'}'}...
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Police</label>
              <select
                value={element.fontFamily || 'helvetica'}
                onChange={(e) => handleFieldChange('fontFamily', e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {allFonts.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label} {font.isCustom && '(Custom)'}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Taille</label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={element.fontSize || 12}
                  onChange={(e) => handleFieldChange('fontSize', parseInt(e.target.value) || 12)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Style</label>
                <select
                  value={element.fontStyle || 'normal'}
                  onChange={(e) => handleFieldChange('fontStyle', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {FONT_STYLES.map((style) => (
                    <option key={style} value={style}>
                      {style === 'normal' && 'Normal'}
                      {style === 'bold' && 'Gras'}
                      {style === 'italic' && 'Italique'}
                      {style === 'bolditalic' && 'Gras Italique'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Alignement</label>
              <div className="flex gap-1">
                {['left', 'center', 'right'].map((align) => (
                  <button
                    key={align}
                    onClick={() => handleFieldChange('align', align)}
                    className={`flex-1 px-2 py-1.5 text-xs rounded border transition-colors ${
                      (element.align || 'left') === align
                        ? 'bg-blue-100 border-blue-500 text-blue-700'
                        : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {align === 'left' && 'Gauche'}
                    {align === 'center' && 'Centre'}
                    {align === 'right' && 'Droite'}
                  </button>
                ))}
              </div>
            </div>

            {/* Options de mise en forme du texte */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-gray-600 mb-2">
                Options de mise en forme
              </label>

              {/* Checkbox 1: Retour à la ligne */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={element.wrapText || false}
                  onChange={(e) => handleFieldChange('wrapText', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Retour à la ligne automatique</span>
              </label>

              {/* Checkbox 2: Adapter la taille */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={element.shrinkToFit || false}
                  onChange={(e) => handleFieldChange('shrinkToFit', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">Adapter la taille du texte</span>
              </label>

              <p className="text-xs text-gray-500 mt-1">
                Basé sur la largeur du cadre ({element.width ? `${element.width}px` : 'non définie'})
              </p>
            </div>

            {/* Format de date - affiché uniquement pour les variables de date */}
            {(element.content && (
              element.content.includes('{session_date_debut}') ||
              element.content.includes('{session_date_fin}') ||
              element.content.includes('{completion_date}') ||
              element.content.includes('{issued_date}') ||
              element.content.includes('{student_birth_date}')
            )) && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Format de date</label>
                <select
                  value={element.dateFormat || 'numeric'}
                  onChange={(e) => handleFieldChange('dateFormat', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="numeric">Numérique (01/01/2026)</option>
                  <option value="long">En lettres (01 Janvier 2026)</option>
                  <option value="short">Court (1 Jan 2026)</option>
                  <option value="full">Complet (Mercredi 01 Janvier 2026)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Choisissez comment afficher la date sur le certificat
                </p>
              </div>
            )}
          </>
        )}

        {/* Image */}
        {element.type === 'image' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Source</label>
            <input
              type="text"
              value={element.source || ''}
              onChange={(e) => handleFieldChange('source', e.target.value)}
              placeholder="URL ou variable {logo_url}"
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            />
          </div>
        )}

        {/* Couleur (pour tous sauf image) */}
        {element.type !== 'image' && (
          <ColorPicker
            label="Couleur"
            value={element.color || '#000000'}
            onChange={(color) => handleFieldChange('color', color)}
          />
        )}

        {/* Couleur de remplissage (pour rectangle et cercle) */}
        {(element.type === 'rectangle' || element.type === 'circle') && (
          <ColorPicker
            label="Couleur de remplissage (optionnel)"
            value={element.fillColor || '#ffffff'}
            onChange={(color) => handleFieldChange('fillColor', color)}
            description="Laissez transparent pour pas de remplissage"
          />
        )}

        {/* Épaisseur de ligne */}
        {(element.type === 'line' || element.type === 'rectangle' || element.type === 'border' || element.type === 'circle') && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Épaisseur du trait</label>
            <input
              type="number"
              min="0.1"
              max="20"
              step="0.5"
              value={element.lineWidth || 1}
              onChange={(e) => handleFieldChange('lineWidth', parseFloat(e.target.value) || 1)}
              className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        )}

        {/* Condition d'affichage */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Condition d'affichage (optionnel)</label>
          <input
            type="text"
            value={element.condition || ''}
            onChange={(e) => handleFieldChange('condition', e.target.value)}
            placeholder="grade"
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
          />
          <p className="text-xs text-gray-500 mt-1">
            L'élément s'affiche seulement si cette variable existe
          </p>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-gray-200 space-y-2">
          <button
            onClick={onDuplicate}
            className="w-full px-3 py-2 bg-blue-50 text-blue-700 rounded border border-blue-300 hover:bg-blue-100 transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <Copy className="h-4 w-4" />
            Dupliquer l'élément
          </button>
          <button
            onClick={onDelete}
            className="w-full px-3 py-2 bg-red-50 text-red-700 rounded border border-red-300 hover:bg-red-100 transition-colors text-sm font-medium flex items-center justify-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Supprimer l'élément
          </button>
        </div>
      </div>
    </div>
  );
};
