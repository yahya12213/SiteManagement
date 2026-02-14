// Calculation Sheet Editor - Fixed: Status field now included in save operations
import { useState, useRef, useEffect } from 'react';
import { Plus, Save, Eye, Grid3x3, Type, Hash, Calculator, Box, Trash2, Copy, AlignLeft, ArrowUp, ArrowDown, Download, Check, Paperclip, EyeOff, MessageSquare, Link } from 'lucide-react';
import type { FieldDefinition } from '@/lib/formula/types';
import { useUpdateCalculationSheet, useCalculationSheet } from '@/hooks/useCalculationSheets';
import { useParams, useNavigate } from 'react-router-dom';

type FieldType = 'label' | 'text' | 'number' | 'formula' | 'frame' | 'file' | 'textarea' | 'link';

interface DraggingField {
  type: FieldType;
  isNew: boolean;
  fieldId?: string;
  offsetX?: number;
  offsetY?: number;
}

interface ResizingField {
  fieldId: string;
  direction: 'se' | 's' | 'e';
  startX: number;
  startY: number;
  startW: number;
  startH: number;
}

export default function CalculationSheetEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [draggingField, setDraggingField] = useState<DraggingField | null>(null);
  const [resizingField, setResizingField] = useState<ResizingField | null>(null);
  const [nextFieldId, setNextFieldId] = useState(1);
  const [templateName, setTemplateName] = useState('Nouvelle Fiche');
  const [showGrid, setShowGrid] = useState(true);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });
  const canvasRef = useRef<HTMLDivElement>(null);

  const updateSheet = useUpdateCalculationSheet();
  const { data: sheetData } = useCalculationSheet(id || '');

  // Charger les données de la fiche existante
  useEffect(() => {
    if (sheetData) {
      // Charger le titre
      if (sheetData.title) {
        setTemplateName(sheetData.title);
      }

      // Charger le template s'il existe
      if (sheetData.template_data) {
        try {
          const template = JSON.parse(sheetData.template_data);
          if (template.fields && template.fields.length > 0) {
            setFields(template.fields);
            // Mettre à jour le nextFieldId pour éviter les conflits
            const maxId = Math.max(...template.fields.map((f: FieldDefinition) => {
              const match = f.id.match(/field_(\d+)/);
              return match ? parseInt(match[1]) : 0;
            }));
            setNextFieldId(maxId + 1);
          }
        } catch (error) {
          console.error('Erreur lors du chargement des données:', error);
        }
      }
    }
  }, [sheetData]);

  const fieldTypes = [
    { type: 'label' as FieldType, icon: Type, label: 'Label', color: 'bg-gray-500' },
    { type: 'text' as FieldType, icon: AlignLeft, label: 'Texte', color: 'bg-blue-500' },
    { type: 'number' as FieldType, icon: Hash, label: 'Nombre', color: 'bg-green-500' },
    { type: 'formula' as FieldType, icon: Calculator, label: 'Formule', color: 'bg-purple-500' },
    { type: 'textarea' as FieldType, icon: MessageSquare, label: 'Texte libre', color: 'bg-indigo-500' },
    { type: 'frame' as FieldType, icon: Box, label: 'Cadre', color: 'bg-orange-500' },
    { type: 'file' as FieldType, icon: Paperclip, label: 'Pièce jointe', color: 'bg-teal-500' },
    { type: 'link' as FieldType, icon: Link, label: 'Lien', color: 'bg-cyan-500' },
  ];

  const selectedField = fields.find(f => f.id === selectedFieldId);

  const createNewField = (type: FieldType, x: number, y: number): FieldDefinition => {
    const id = `field_${nextFieldId}`;
    setNextFieldId(nextFieldId + 1);

    const baseField = {
      id,
      type,
      layout: { x, y, w: 200, h: 40 },
    };

    switch (type) {
      case 'label':
        return {
          ...baseField,
          props: { label: 'Nouveau label' },
        };
      case 'text':
        return {
          ...baseField,
          ref: `TEXT_${nextFieldId}`,
          props: { label: 'Texte' },
        };
      case 'number':
        return {
          ...baseField,
          ref: `NUM_${nextFieldId}`,
          props: { label: 'Nombre', decimals: 2, default: 0 },
        };
      case 'formula':
        return {
          ...baseField,
          ref: `FORMULA_${nextFieldId}`,
          props: { label: 'Formule', expression: '', decimals: 2 },
        };
      case 'frame':
        return {
          ...baseField,
          props: { label: 'Cadre' },
          children: [],
        };
      case 'file':
        return {
          ...baseField,
          ref: `FILE_${nextFieldId}`,
          props: {
            label: 'Pièce jointe',
            accept: '.pdf,.jpg,.jpeg,.png',
            maxSize: 5
          },
        };
      case 'textarea':
        return {
          ...baseField,
          layout: { x, y, w: 400, h: 120 },
          ref: `TEXTAREA_${nextFieldId}`,
          props: {
            label: 'Commentaires',
          },
        };
      case 'link':
        return {
          ...baseField,
          props: {
            label: 'Lien',
            url: 'https://example.com',
          },
        };
      default:
        return baseField as FieldDefinition;
    }
  };

  const handleToolbarDragStart = (type: FieldType) => {
    setDraggingField({ type, isNew: true });
  };

  const handleFieldDragStart = (e: React.MouseEvent, fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    setDraggingField({
      type: field.type,
      isNew: false,
      fieldId,
      offsetX,
      offsetY,
    });
    setSelectedFieldId(fieldId);
  };

  const handleCanvasDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleCanvasDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggingField || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left - (draggingField.offsetX || 0)) / 10) * 10;
    const y = Math.round((e.clientY - rect.top - (draggingField.offsetY || 0)) / 10) * 10;

    if (draggingField.isNew) {
      // Créer un nouveau champ
      const newField = createNewField(draggingField.type, Math.max(0, x), Math.max(0, y));
      setFields([...fields, newField]);
      setSelectedFieldId(newField.id);
    } else if (draggingField.fieldId) {
      // Déplacer un champ existant
      setFields(fields.map(f =>
        f.id === draggingField.fieldId
          ? { ...f, layout: { ...f.layout, x: Math.max(0, x), y: Math.max(0, y) } }
          : f
      ));
    }

    setDraggingField(null);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    // Gestion du déplacement
    if (draggingField && !draggingField.isNew && draggingField.fieldId && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left - (draggingField.offsetX || 0)) / 10) * 10;
      const y = Math.round((e.clientY - rect.top - (draggingField.offsetY || 0)) / 10) * 10;

      setFields(fields.map(f =>
        f.id === draggingField.fieldId
          ? { ...f, layout: { ...f.layout, x: Math.max(0, x), y: Math.max(0, y) } }
          : f
      ));
    }

    // Gestion du redimensionnement
    if (resizingField && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const currentX = e.clientX - rect.left;
      const currentY = e.clientY - rect.top;

      const deltaX = currentX - resizingField.startX;
      const deltaY = currentY - resizingField.startY;

      setFields(fields.map(f => {
        if (f.id !== resizingField.fieldId) return f;

        let newW = resizingField.startW;
        let newH = resizingField.startH;

        if (resizingField.direction === 'se') {
          // Coin bas-droit
          newW = Math.max(100, resizingField.startW + deltaX);
          newH = Math.max(50, resizingField.startH + deltaY);
        } else if (resizingField.direction === 's') {
          // Bas seulement
          newH = Math.max(50, resizingField.startH + deltaY);
        } else if (resizingField.direction === 'e') {
          // Droite seulement
          newW = Math.max(100, resizingField.startW + deltaX);
        }

        return {
          ...f,
          layout: {
            ...f.layout,
            w: Math.round(newW / 10) * 10,
            h: Math.round(newH / 10) * 10,
          },
        };
      }));
    }
  };

  const handleCanvasMouseUp = () => {
    setDraggingField(null);
    setResizingField(null);
  };

  const handleResizeStart = (e: React.MouseEvent, fieldId: string, direction: 'se' | 's' | 'e') => {
    e.stopPropagation();
    if (!canvasRef.current) return;

    const field = fields.find(f => f.id === fieldId);
    if (!field) return;

    const rect = canvasRef.current.getBoundingClientRect();
    setResizingField({
      fieldId,
      direction,
      startX: e.clientX - rect.left,
      startY: e.clientY - rect.top,
      startW: field.layout.w,
      startH: field.layout.h,
    });
  };

  const updateFieldProperty = (fieldId: string, path: string, value: any) => {
    setFields(fields.map(f => {
      if (f.id !== fieldId) return f;

      const pathParts = path.split('.');
      if (pathParts.length === 1) {
        return { ...f, [path]: value };
      } else if (pathParts[0] === 'props') {
        return { ...f, props: { ...f.props, [pathParts[1]]: value } };
      } else if (pathParts[0] === 'layout') {
        return { ...f, layout: { ...f.layout, [pathParts[1]]: value } };
      }
      return f;
    }));
  };

  const deleteField = (fieldId: string) => {
    setFields(fields.filter(f => f.id !== fieldId));
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
  };

  const duplicateField = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;

    const newField = {
      ...field,
      id: `field_${nextFieldId}`,
      ref: field.ref ? `${field.ref}_COPY` : undefined,
      layout: { ...field.layout, x: field.layout.x + 20, y: field.layout.y + 20 },
    };

    setNextFieldId(nextFieldId + 1);
    setFields([...fields, newField]);
    setSelectedFieldId(newField.id);
  };

  const moveFieldLayer = (fieldId: string, direction: 'up' | 'down') => {
    const index = fields.findIndex(f => f.id === fieldId);
    if (index === -1) return;

    const newFields = [...fields];
    if (direction === 'up' && index < fields.length - 1) {
      [newFields[index], newFields[index + 1]] = [newFields[index + 1], newFields[index]];
    } else if (direction === 'down' && index > 0) {
      [newFields[index], newFields[index - 1]] = [newFields[index - 1], newFields[index]];
    }

    setFields(newFields);
  };

  const handleSave = async () => {
    if (!id) {
      alert('Aucun ID de fiche trouvé');
      return;
    }

    try {
      const template = {
        name: templateName,
        fields,
        version: '1.0.0',
      };

      await updateSheet.mutateAsync({
        id,
        title: templateName,
        template_data: JSON.stringify(template),
        status: sheetData?.status || 'draft',
        sheet_date: sheetData?.sheet_date || new Date().toISOString(),
      });

      setSaveMessage('Fiche sauvegardée avec succès!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde de la fiche');
    }
  };

  const exportTemplate = () => {
    const template = {
      name: templateName,
      fields,
      version: '1.0.0',
    };

    const json = JSON.stringify(template, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateName.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 overflow-hidden">
      {/* En-tête */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            className="text-xl font-bold border-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
          />
          <span className="text-sm text-gray-500">{fields.length} champ(s)</span>
        </div>

        <div className="flex items-center gap-2">
          {saveMessage && (
            <div className="flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-lg">
              <Check className="w-5 h-5" />
              <span className="text-sm font-medium">{saveMessage}</span>
            </div>
          )}

          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-2 rounded-lg transition-colors ${showGrid ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600'}`}
            title="Grille"
          >
            <Grid3x3 className="w-5 h-5" />
          </button>

          <button
            onClick={handleSave}
            disabled={updateSheet.isPending}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-5 h-5" />
            {updateSheet.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>

          <button
            onClick={exportTemplate}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Exporter JSON
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => navigate(`/admin/calculation-sheets/${id}?mode=admin`)}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Eye className="w-5 h-5" />
              Voir (Admin)
            </button>
            <button
              onClick={() => navigate(`/admin/calculation-sheets/${id}?mode=user`)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Eye className="w-5 h-5" />
              Voir (Utilisateur)
            </button>
          </div>

          <button
            onClick={() => navigate('/admin/calculation-sheets')}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2"
          >
            Retour à la liste
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Barre d'outils gauche */}
        <div className="w-64 bg-white border-r border-gray-200 flex-shrink-0 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Composants</h3>

          <div className="space-y-2">
            {fieldTypes.map((fieldType) => {
              const Icon = fieldType.icon;
              return (
                <div
                  key={fieldType.type}
                  draggable
                  onDragStart={() => handleToolbarDragStart(fieldType.type)}
                  className={`${fieldType.color} text-white rounded-lg p-3 cursor-move hover:opacity-90 transition-opacity flex items-center gap-2`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{fieldType.label}</span>
                </div>
              );
            })}
          </div>

          <div className="mt-6 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
            <p className="font-medium mb-1">💡 Glisser-déposer</p>
            <p className="text-xs">Faites glisser un composant sur le canvas pour l'ajouter</p>
          </div>
        </div>

        {/* Canvas central */}
        <div className="flex-1 bg-gray-100 overflow-auto p-4 min-w-0">
          <div
            ref={canvasRef}
            onDragOver={handleCanvasDragOver}
            onDrop={handleCanvasDrop}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            className="relative bg-white rounded-lg shadow-sm"
            style={{
              width: `${canvasSize.width}px`,
              height: `${canvasSize.height}px`,
              backgroundImage: showGrid
                ? 'linear-gradient(#e5e7eb 1px, transparent 1px), linear-gradient(90deg, #e5e7eb 1px, transparent 1px)'
                : 'none',
              backgroundSize: showGrid ? '20px 20px' : 'auto',
            }}
          >
            {fields.map((field) => {
              const isSelected = field.id === selectedFieldId;
              const fieldTypeInfo = fieldTypes.find(ft => ft.type === field.type);
              const isFrame = field.type === 'frame';
              const isHidden = field.visibility?.hidden;

              // Rendu spécial pour les cadres
              if (isFrame) {
                return (
                  <div
                    key={field.id}
                    onMouseDown={(e) => {
                      // Ne pas déplacer si on clique sur une poignée
                      if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
                      handleFieldDragStart(e, field.id);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFieldId(field.id);
                    }}
                    className={`absolute border-2 rounded-lg ${
                      isHidden ? 'opacity-50' : ''
                    } ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50/30'
                        : 'border-orange-300 bg-orange-50/10 hover:border-orange-400'
                    }`}
                    style={{
                      left: field.layout.x,
                      top: field.layout.y,
                      width: field.layout.w,
                      height: field.layout.h,
                    }}
                  >
                    {/* Titre du cadre en haut */}
                    <div className="bg-orange-500 text-white px-3 py-1 rounded-t font-semibold text-sm cursor-move flex items-center justify-between">
                      <span>{field.props.label || 'Cadre'}</span>
                      {isHidden && <EyeOff className="w-4 h-4" />}
                    </div>

                    {/* Actions */}
                    {isSelected && (
                      <>
                        <div className="absolute -top-2 -right-2 flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateField(field.id);
                            }}
                            className="w-6 h-6 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center"
                            title="Dupliquer"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteField(field.id);
                            }}
                            className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Poignées de redimensionnement */}
                        <div
                          className="resize-handle absolute -bottom-2 -right-2 w-4 h-4 bg-orange-500 rounded-full cursor-se-resize border-2 border-white"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleResizeStart(e, field.id, 'se');
                          }}
                          title="Redimensionner"
                        />
                        <div
                          className="resize-handle absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-orange-500 rounded-full cursor-s-resize border-2 border-white"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleResizeStart(e, field.id, 's');
                          }}
                          title="Redimensionner"
                        />
                        <div
                          className="resize-handle absolute top-1/2 -translate-y-1/2 -right-2 w-4 h-4 bg-orange-500 rounded-full cursor-e-resize border-2 border-white"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleResizeStart(e, field.id, 'e');
                          }}
                          title="Redimensionner"
                        />
                      </>
                    )}
                  </div>
                );
              }

              // Rendu spécial pour les liens
              if (field.type === 'link') {
                return (
                  <div
                    key={field.id}
                    onMouseDown={(e) => {
                      if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
                      handleFieldDragStart(e, field.id);
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFieldId(field.id);
                    }}
                    className={`absolute cursor-move border-2 rounded-lg px-3 py-2 ${
                      isHidden ? 'opacity-50' : ''
                    } ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-50'
                        : 'border-cyan-300 bg-white hover:border-cyan-400'
                    }`}
                    style={{
                      left: field.layout.x,
                      top: field.layout.y,
                      width: field.layout.w,
                      height: field.layout.h,
                    }}
                  >
                    <div className="flex items-center gap-2 h-full">
                      <Link className="w-4 h-4 text-cyan-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-cyan-900 truncate">
                          {field.props.label || 'Lien'}
                        </div>
                        {field.props.url && (
                          <div className="text-xs text-cyan-600 truncate">
                            {field.props.url}
                          </div>
                        )}
                      </div>
                      {isHidden && <EyeOff className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                    </div>

                    {isSelected && (
                      <>
                        <div className="absolute -top-2 -right-2 flex gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              duplicateField(field.id);
                            }}
                            className="w-6 h-6 bg-cyan-500 hover:bg-cyan-600 text-white rounded-full flex items-center justify-center"
                            title="Dupliquer"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteField(field.id);
                            }}
                            className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>

                        <div
                          className="resize-handle absolute -bottom-2 -right-2 w-4 h-4 bg-cyan-500 rounded-full cursor-se-resize border-2 border-white"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleResizeStart(e, field.id, 'se');
                          }}
                          title="Redimensionner"
                        />
                        <div
                          className="resize-handle absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-cyan-500 rounded-full cursor-s-resize border-2 border-white"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleResizeStart(e, field.id, 's');
                          }}
                          title="Redimensionner"
                        />
                        <div
                          className="resize-handle absolute top-1/2 -translate-y-1/2 -right-2 w-4 h-4 bg-cyan-500 rounded-full cursor-e-resize border-2 border-white"
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleResizeStart(e, field.id, 'e');
                          }}
                          title="Redimensionner"
                        />
                      </>
                    )}
                  </div>
                );
              }

              // Rendu normal pour les autres types de champs
              return (
                <div
                  key={field.id}
                  onMouseDown={(e) => {
                    // Ne pas déplacer si on clique sur une poignée
                    if ((e.target as HTMLElement).classList.contains('resize-handle')) return;
                    handleFieldDragStart(e, field.id);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedFieldId(field.id);
                  }}
                  className={`absolute cursor-move border-2 rounded-lg px-3 py-2 ${
                    isHidden ? 'opacity-50' : ''
                  } ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-300 bg-white hover:border-gray-400'
                  }`}
                  style={{
                    left: field.layout.x,
                    top: field.layout.y,
                    width: field.layout.w,
                    height: field.layout.h,
                  }}
                >
                  <div className="flex items-center gap-2 h-full">
                    {fieldTypeInfo && <fieldTypeInfo.icon className="w-4 h-4 text-gray-500 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {field.props.label || field.type}
                      </div>
                      {field.ref && (
                        <div className="text-xs text-gray-500 truncate">
                          {field.ref}
                        </div>
                      )}
                    </div>
                    {isHidden && <EyeOff className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  </div>

                  {isSelected && (
                    <>
                      <div className="absolute -top-2 -right-2 flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            duplicateField(field.id);
                          }}
                          className="w-6 h-6 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center"
                          title="Dupliquer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteField(field.id);
                          }}
                          className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Poignées de redimensionnement */}
                      <div
                        className="resize-handle absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 rounded-full cursor-se-resize border-2 border-white"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleResizeStart(e, field.id, 'se');
                        }}
                        title="Redimensionner"
                      />
                      <div
                        className="resize-handle absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-blue-500 rounded-full cursor-s-resize border-2 border-white"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleResizeStart(e, field.id, 's');
                        }}
                        title="Redimensionner"
                      />
                      <div
                        className="resize-handle absolute top-1/2 -translate-y-1/2 -right-2 w-4 h-4 bg-blue-500 rounded-full cursor-e-resize border-2 border-white"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          handleResizeStart(e, field.id, 'e');
                        }}
                        title="Redimensionner"
                      />
                    </>
                  )}
                </div>
              );
            })}

            {fields.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <Plus className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p className="text-lg font-medium">Glissez des composants ici</p>
                  <p className="text-sm mt-1">Commencez par ajouter des champs depuis la barre d'outils</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Panneau propriétés droite */}
        <div className="w-80 bg-white border-l border-gray-200 flex-shrink-0 overflow-y-auto">
          <div className="p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Propriétés</h3>

            {/* Taille du canvas - Toujours visible */}
            <div className="mb-4 pb-4 border-b border-gray-200">
            <h4 className="font-medium text-gray-900 mb-3">Taille du Canvas</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Largeur (px)</label>
                <input
                  type="number"
                  value={canvasSize.width}
                  onChange={(e) => setCanvasSize({ ...canvasSize, width: Math.max(800, parseInt(e.target.value) || 1200) })}
                  min="800"
                  step="100"
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Hauteur (px)</label>
                <input
                  type="number"
                  value={canvasSize.height}
                  onChange={(e) => setCanvasSize({ ...canvasSize, height: Math.max(600, parseInt(e.target.value) || 800) })}
                  min="600"
                  step="100"
                  className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                />
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => setCanvasSize({ width: 1200, height: 800 })}
                className="flex-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs"
              >
                Standard
              </button>
              <button
                onClick={() => setCanvasSize({ width: 1600, height: 1200 })}
                className="flex-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs"
              >
                Large
              </button>
              <button
                onClick={() => setCanvasSize({ width: 2000, height: 1600 })}
                className="flex-1 px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs"
              >
                XL
              </button>
            </div>
          </div>

          {selectedField ? (
            <div className="space-y-4">
              {/* Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <div className="px-3 py-2 bg-gray-100 rounded text-sm font-medium text-gray-900">
                  {fieldTypes.find(ft => ft.type === selectedField.type)?.label}
                </div>
              </div>

              {/* Référence */}
              {selectedField.type !== 'label' && selectedField.type !== 'frame' && selectedField.type !== 'link' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Référence</label>
                  <input
                    type="text"
                    value={selectedField.ref || ''}
                    onChange={(e) => updateFieldProperty(selectedField.id, 'ref', e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="EX: MONTANT_TOTAL"
                  />
                </div>
              )}

              {/* Types de fichiers acceptés (file uniquement) */}
              {selectedField.type === 'file' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Types de fichiers acceptés</label>
                    <input
                      type="text"
                      value={selectedField.props.accept || ''}
                      onChange={(e) => updateFieldProperty(selectedField.id, 'props.accept', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder=".pdf,.jpg,.png"
                    />
                    <p className="text-xs text-gray-500 mt-1">Séparez par des virgules (ex: .pdf,.jpg,.png)</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Taille maximum (MB)</label>
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={selectedField.props.maxSize || 5}
                      onChange={(e) => updateFieldProperty(selectedField.id, 'props.maxSize', parseInt(e.target.value) || 5)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </>
              )}

              {/* URL du lien (link uniquement) */}
              {selectedField.type === 'link' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">URL du lien</label>
                  <input
                    type="url"
                    value={selectedField.props.url || ''}
                    onChange={(e) => updateFieldProperty(selectedField.id, 'props.url', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="https://example.com"
                  />
                  <p className="text-xs text-gray-500 mt-1">Le lien s'ouvrira dans un nouvel onglet</p>
                </div>
              )}

              {/* Label */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                <input
                  type="text"
                  value={selectedField.props.label || ''}
                  onChange={(e) => updateFieldProperty(selectedField.id, 'props.label', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Expression (formule uniquement) */}
              {selectedField.type === 'formula' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Expression</label>
                  <textarea
                    value={selectedField.props.expression || ''}
                    onChange={(e) => updateFieldProperty(selectedField.id, 'props.expression', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                    rows={3}
                    placeholder="EX: HEURES_REAL*TARIF_H"
                  />
                </div>
              )}

              {/* Décimales (nombre et formule) */}
              {(selectedField.type === 'number' || selectedField.type === 'formula') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Décimales</label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={selectedField.props.decimals || 0}
                    onChange={(e) => updateFieldProperty(selectedField.id, 'props.decimals', parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Valeur par défaut (nombre) */}
              {selectedField.type === 'number' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valeur par défaut</label>
                  <input
                    type="number"
                    step="0.01"
                    value={typeof selectedField.props.default === 'number' || typeof selectedField.props.default === 'string' ? selectedField.props.default : 0}
                    onChange={(e) => updateFieldProperty(selectedField.id, 'props.default', parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Position et taille */}
              <div className="pt-4 border-t border-gray-200">
                <h4 className="font-medium text-gray-900 mb-3">Position & Taille</h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">X</label>
                    <input
                      type="number"
                      value={selectedField.layout.x}
                      onChange={(e) => updateFieldProperty(selectedField.id, 'layout.x', parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Y</label>
                    <input
                      type="number"
                      value={selectedField.layout.y}
                      onChange={(e) => updateFieldProperty(selectedField.id, 'layout.y', parseInt(e.target.value) || 0)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Largeur</label>
                    <input
                      type="number"
                      value={selectedField.layout.w}
                      onChange={(e) => updateFieldProperty(selectedField.id, 'layout.w', parseInt(e.target.value) || 50)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Hauteur</label>
                    <input
                      type="number"
                      value={selectedField.layout.h}
                      onChange={(e) => updateFieldProperty(selectedField.id, 'layout.h', parseInt(e.target.value) || 30)}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Visibilité */}
              <div className="pt-4 border-t border-gray-200">
                <h4 className="font-medium text-gray-900 mb-3">Visibilité</h4>
                <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100">
                  <input
                    type="checkbox"
                    checked={selectedField.visibility?.hidden || false}
                    onChange={(e) => {
                      const newVisibility = { ...selectedField.visibility, hidden: e.target.checked };
                      updateFieldProperty(selectedField.id, 'visibility', newVisibility);
                    }}
                    className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <EyeOff className="w-4 h-4 text-gray-600" />
                      <span className="font-medium text-gray-900">Masquer pour les professeurs</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Ce champ sera invisible dans le mode test et pour les professeurs
                    </p>
                  </div>
                </label>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-gray-200">
                <h4 className="font-medium text-gray-900 mb-3">Actions</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => moveFieldLayer(selectedField.id, 'up')}
                    className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm flex items-center justify-center gap-1"
                  >
                    <ArrowUp className="w-4 h-4" />
                    Avant
                  </button>
                  <button
                    onClick={() => moveFieldLayer(selectedField.id, 'down')}
                    className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm flex items-center justify-center gap-1"
                  >
                    <ArrowDown className="w-4 h-4" />
                    Arrière
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <p>Sélectionnez un champ pour voir ses propriétés</p>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}
