import React, { useRef, useState, useEffect } from 'react';
import {
  Grid3x3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignHorizontalJustifyStart,
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  Minus,
  Plus,
  Copy,
  Trash2,
  Bold,
  Italic,
  Palette,
  AlignHorizontalSpaceBetween,
  AlignVerticalSpaceBetween,
  ZoomIn,
  ZoomOut,
  Maximize2
} from 'lucide-react';
import type { TemplateElement } from '@/types/certificateTemplate';
import { FONT_FAMILIES } from '@/types/certificateTemplate';

interface CanvasEditorProps {
  elements: TemplateElement[];
  selectedId: string | null;
  selectedIds: string[]; // Multi-selection support
  backgroundImage: string | null;
  canvasSize: { width: number; height: number };
  showGrid: boolean;
  onElementMove: (id: string, x: number, y: number) => void;
  onElementResize: (id: string, w: number, h: number) => void;
  onElementSelect: (id: string | null, addToSelection?: boolean) => void;
  onElementDrop: (type: string, x: number, y: number, data: any) => void;
  onElementUpdate?: (element: TemplateElement) => void;
  onElementDuplicate?: (element: TemplateElement) => void;
  onElementDelete?: (elementId: string) => void;
  onAlignElements?: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onAlignMultipleElements?: (alignment: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onDistributeElements?: (direction: 'horizontal' | 'vertical') => void;
}

interface DraggingState {
  id: string;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
}

interface ResizingState {
  id: string;
  startX: number;
  startY: number;
  startW: number;
  startH: number;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({
  elements,
  selectedId,
  selectedIds,
  backgroundImage,
  canvasSize,
  showGrid,
  onElementMove,
  onElementResize,
  onElementSelect,
  onElementDrop,
  onElementUpdate,
  onElementDuplicate,
  onElementDelete,
  onAlignElements,
  onAlignMultipleElements,
  onDistributeElements,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<DraggingState | null>(null);
  const [resizing, setResizing] = useState<ResizingState | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Calculate initial zoom based on canvas size - auto-zoom for small formats
  useEffect(() => {
    // For small formats like badges, auto-zoom to make them easier to work with
    if (canvasSize.width < 400 || canvasSize.height < 400) {
      // Calculate zoom to make the canvas at least 500px wide
      const targetWidth = 500;
      const calculatedZoom = Math.min(2.5, Math.max(1, targetWidth / canvasSize.width));
      setZoom(calculatedZoom);
    } else {
      setZoom(1);
    }
  }, [canvasSize.width, canvasSize.height]);

  const handleZoomIn = () => setZoom(prev => Math.min(3, prev + 0.25));
  const handleZoomOut = () => setZoom(prev => Math.max(0.25, prev - 0.25));
  const handleZoomReset = () => setZoom(1);
  const handleZoomFit = () => {
    // Fit to a reasonable working size
    if (canvasSize.width < 400 || canvasSize.height < 400) {
      const targetWidth = 500;
      setZoom(Math.min(2.5, targetWidth / canvasSize.width));
    } else {
      setZoom(1);
    }
  };

  // Gérer le déplacement d'un élément existant
  const handleMouseDown = (e: React.MouseEvent, element: TemplateElement) => {
    e.stopPropagation();

    // Support multi-selection with Ctrl/Cmd key
    const addToSelection = e.ctrlKey || e.metaKey;
    onElementSelect(element.id, addToSelection);

    if ((e.target as HTMLElement).classList.contains('resize-handle')) {
      return; // Ne pas déplacer si on clique sur le handle de resize
    }

    const elementX = typeof element.x === 'number' ? element.x : 0;
    const elementY = typeof element.y === 'number' ? element.y : 0;

    setDragging({
      id: element.id,
      startX: e.clientX,
      startY: e.clientY,
      offsetX: e.clientX - elementX,
      offsetY: e.clientY - elementY,
    });
  };

  // Gérer le resize d'un élément
  const handleResizeMouseDown = (e: React.MouseEvent, element: TemplateElement) => {
    e.stopPropagation();
    onElementSelect(element.id);

    const width = typeof element.width === 'number' ? element.width : 100;
    const height = typeof element.height === 'number' ? element.height : 50;

    setResizing({
      id: element.id,
      startX: e.clientX,
      startY: e.clientY,
      startW: width,
      startH: height,
    });
  };

  // Gérer le drag-and-drop depuis la palette
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    // Adjust for zoom - convert screen coordinates to canvas coordinates
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;

    try {
      const jsonData = e.dataTransfer.getData('application/json');

      // Vérifier que les données ne sont pas vides avant de parser
      if (!jsonData || jsonData.trim() === '') {
        console.warn('Drop data is empty - ignoring drop event');
        return;
      }

      const data = JSON.parse(jsonData);
      onElementDrop(data.type, x, y, data);
    } catch (error) {
      console.error('Error parsing drop data:', error);
    }
  };

  // Gérer le mouvement global de la souris
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragging && canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        // Adjust for zoom - convert screen coordinates to canvas coordinates
        const newX = Math.max(0, Math.min(canvasSize.width, (e.clientX - rect.left) / zoom));
        const newY = Math.max(0, Math.min(canvasSize.height, (e.clientY - rect.top) / zoom));

        onElementMove(dragging.id, newX, newY);
      }

      if (resizing) {
        // Adjust deltas for zoom
        const deltaX = (e.clientX - resizing.startX) / zoom;
        const deltaY = (e.clientY - resizing.startY) / zoom;

        const newW = Math.max(10, resizing.startW + deltaX);
        const newH = Math.max(10, resizing.startH + deltaY);

        onElementResize(resizing.id, newW, newH);
      }
    };

    const handleMouseUp = () => {
      setDragging(null);
      setResizing(null);
    };

    if (dragging || resizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, resizing, canvasSize, zoom, onElementMove, onElementResize]);

  // Render d'un élément selon son type
  const renderElement = (element: TemplateElement) => {
    const isSelected = element.id === selectedId;
    const isInMultiSelection = selectedIds.includes(element.id);
    const isHighlighted = isSelected || isInMultiSelection;
    const x = typeof element.x === 'number' ? element.x : 0;
    const y = typeof element.y === 'number' ? element.y : 0;

    // Different border colors: blue for primary selection, green for multi-selection
    const borderColor = isSelected ? '#3B82F6' : isInMultiSelection ? '#10B981' : 'rgba(0,0,0,0.2)';
    const borderStyle = isHighlighted ? 'solid' : 'dashed';

    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: `${x}px`,
      top: `${y}px`,
      cursor: dragging?.id === element.id ? 'grabbing' : 'grab',
      border: `2px ${borderStyle} ${borderColor}`,
      boxShadow: isHighlighted ? `0 0 0 1px ${isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(16, 185, 129, 0.3)'}` : 'none',
    };

    // Texte
    if (element.type === 'text') {
      const width = typeof element.width === 'number' ? element.width : 150;
      const height = typeof element.height === 'number' ? element.height : 30;
      const fontSize = element.fontSize || 12;
      // Calculer une hauteur minimum basée sur la taille de police + padding
      const minHeight = Math.max(fontSize * 1.5 + 8, 20);
      // Utiliser la hauteur stockée ou la hauteur minimum
      const actualHeight = Math.max(height, minHeight);

      // Déterminer l'alignement horizontal CSS
      const textAlign = element.align === 'center' ? 'center' : element.align === 'right' ? 'right' : 'left';

      return (
        <div key={element.id}>
          <div
            style={{
              ...baseStyle,
              width: `${width}px`,
              height: `${actualHeight}px`,
              // Utiliser CSS Grid pour un centrage vertical parfait
              display: 'grid',
              placeItems: 'center',
              backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
              boxSizing: 'border-box',
            }}
            onMouseDown={(e) => handleMouseDown(e, element)}
          >
            <span
              style={{
                width: '100%',
                padding: '0 8px',
                fontSize: `${fontSize}px`,
                fontFamily: element.fontFamily || 'helvetica',
                fontWeight: element.fontStyle?.includes('bold') ? 'bold' : 'normal',
                fontStyle: element.fontStyle?.includes('italic') ? 'italic' : 'normal',
                color: element.color || '#000000',
                textAlign: textAlign,
                whiteSpace: 'normal',
                wordWrap: 'break-word',
                lineHeight: 1.2,
              }}
            >
              {element.content || 'Texte vide'}
            </span>
          </div>
          {/* Resize handle - positionné en bas à droite de l'élément texte */}
          {isSelected && (
            <div
              className="resize-handle"
              style={{
                position: 'absolute',
                left: `${x + width - 8}px`,
                top: `${y + actualHeight - 8}px`,
                width: '16px',
                height: '16px',
                backgroundColor: '#3B82F6',
                border: '2px solid white',
                borderRadius: '50%',
                cursor: 'se-resize',
                zIndex: 1000,
              }}
              onMouseDown={(e) => handleResizeMouseDown(e, element)}
            />
          )}
        </div>
      );
    }

    // Rectangle
    if (element.type === 'rectangle' || element.type === 'border') {
      const width = typeof element.width === 'number' ? element.width : 100;
      const height = typeof element.height === 'number' ? element.height : 50;

      return (
        <div key={element.id}>
          <div
            style={{
              ...baseStyle,
              width: `${width}px`,
              height: `${height}px`,
              border: `${element.lineWidth || 1}px solid ${element.color || '#000000'}`,
              backgroundColor: element.fillColor || 'transparent',
            }}
            onMouseDown={(e) => handleMouseDown(e, element)}
          />
          {isSelected && (
            <div
              className="resize-handle"
              style={{
                position: 'absolute',
                left: `${x + width - 8}px`,
                top: `${y + height - 8}px`,
                width: '16px',
                height: '16px',
                backgroundColor: '#3B82F6',
                border: '2px solid white',
                borderRadius: '50%',
                cursor: 'se-resize',
                zIndex: 1000,
              }}
              onMouseDown={(e) => handleResizeMouseDown(e, element)}
            />
          )}
        </div>
      );
    }

    // Cercle
    if (element.type === 'circle') {
      const radius = element.radius || 20;

      return (
        <div key={element.id}>
          <div
            style={{
              ...baseStyle,
              width: `${radius * 2}px`,
              height: `${radius * 2}px`,
              borderRadius: '50%',
              border: `${element.lineWidth || 1}px solid ${element.color || '#000000'}`,
              backgroundColor: element.fillColor || 'transparent',
            }}
            onMouseDown={(e) => handleMouseDown(e, element)}
          />
        </div>
      );
    }

    // Ligne
    if (element.type === 'line') {
      const x1 = typeof element.x1 === 'number' ? element.x1 : 0;
      const y1 = typeof element.y1 === 'number' ? element.y1 : 0;
      const x2 = typeof element.x2 === 'number' ? element.x2 : 100;
      const y2 = typeof element.y2 === 'number' ? element.y2 : 0;

      const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
      const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);

      return (
        <div key={element.id}>
          <div
            style={{
              position: 'absolute',
              left: `${x1}px`,
              top: `${y1}px`,
              width: `${length}px`,
              height: `${element.lineWidth || 1}px`,
              backgroundColor: element.color || '#000000',
              transform: `rotate(${angle}deg)`,
              transformOrigin: '0 0',
              cursor: 'grab',
              border: isSelected ? '2px solid #3B82F6' : 'none',
            }}
            onMouseDown={(e) => handleMouseDown(e, element)}
          />
        </div>
      );
    }

    // Image
    if (element.type === 'image') {
      const width = typeof element.width === 'number' ? element.width : 100;
      const height = typeof element.height === 'number' ? element.height : 100;

      return (
        <div key={element.id}>
          <div
            style={{
              ...baseStyle,
              width: `${width}px`,
              height: `${height}px`,
              border: isSelected ? '2px solid #3B82F6' : '1px dashed rgba(0,0,0,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(0,0,0,0.05)',
            }}
            onMouseDown={(e) => handleMouseDown(e, element)}
          >
            <span className="text-xs text-gray-400">
              {element.source ? element.source.substring(0, 20) + '...' : 'Image'}
            </span>
          </div>
          {isSelected && (
            <div
              className="resize-handle"
              style={{
                position: 'absolute',
                left: `${x + width - 8}px`,
                top: `${y + height - 8}px`,
                width: '16px',
                height: '16px',
                backgroundColor: '#3B82F6',
                border: '2px solid white',
                borderRadius: '50%',
                cursor: 'se-resize',
                zIndex: 1000,
              }}
              onMouseDown={(e) => handleResizeMouseDown(e, element)}
            />
          )}
        </div>
      );
    }

    return null;
  };

  // Get the selected element for the toolbar
  const selectedElement = selectedId ? elements.find(el => el.id === selectedId) : null;

  // Check if we have multiple elements selected
  const hasMultipleSelection = selectedIds.length > 1;

  return (
    <div className="h-full flex flex-col bg-gray-100">
      {/* Fixed Toolbar - Stable layout with two fixed zones */}
      <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center h-[52px] flex-shrink-0">
        {/* Left zone - contextual tools (takes remaining space, hidden overflow) */}
        <div className="flex-1 flex items-center gap-2 overflow-hidden min-w-0">
          {/* Multi-selection toolbar - PowerPoint style */}
          {hasMultipleSelection ? (
            <>
              <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200 flex-shrink-0">
                <span className="text-sm font-medium text-blue-700">
                  {selectedIds.length} éléments
                </span>
              </div>

              <div className="w-px h-6 bg-gray-300 flex-shrink-0" />

              {/* Align to canvas - like PowerPoint */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-xs text-gray-500 mr-1">Aligner:</span>
                {/* Horizontal alignment - aligns elements left/center/right */}
                <div className="flex items-center gap-0.5 bg-blue-50 rounded-lg p-0.5 border border-blue-200">
                  <button
                    onClick={() => onAlignMultipleElements?.('left')}
                    className="p-1.5 rounded hover:bg-blue-200 text-blue-700"
                    title="Aligner à gauche"
                  >
                    <AlignHorizontalJustifyStart className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onAlignMultipleElements?.('center')}
                    className="p-1.5 rounded hover:bg-blue-200 text-blue-700"
                    title="Centrer horizontalement"
                  >
                    <AlignHorizontalJustifyCenter className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onAlignMultipleElements?.('right')}
                    className="p-1.5 rounded hover:bg-blue-200 text-blue-700"
                    title="Aligner à droite"
                  >
                    <AlignHorizontalJustifyEnd className="h-4 w-4" />
                  </button>
                </div>
                {/* Vertical alignment - aligns elements top/middle/bottom */}
                <div className="flex items-center gap-0.5 bg-blue-50 rounded-lg p-0.5 ml-1 border border-blue-200">
                  <button
                    onClick={() => onAlignMultipleElements?.('top')}
                    className="p-1.5 rounded hover:bg-blue-200 text-blue-700"
                    title="Aligner en haut"
                  >
                    <AlignVerticalJustifyStart className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onAlignMultipleElements?.('middle')}
                    className="p-1.5 rounded hover:bg-blue-200 text-blue-700"
                    title="Centrer verticalement"
                  >
                    <AlignVerticalJustifyCenter className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onAlignMultipleElements?.('bottom')}
                    className="p-1.5 rounded hover:bg-blue-200 text-blue-700"
                    title="Aligner en bas"
                  >
                    <AlignVerticalJustifyEnd className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Distribution tools - like PowerPoint */}
              <div className="w-px h-6 bg-gray-300 flex-shrink-0" />
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-xs text-gray-500 mr-1">Distribuer:</span>
                <div className="flex items-center gap-0.5 bg-green-50 rounded-lg p-0.5 border border-green-200">
                  <button
                    onClick={() => onDistributeElements?.('horizontal')}
                    className="p-1.5 rounded hover:bg-green-200 text-green-700"
                    title="Distribuer horizontalement"
                  >
                    <AlignHorizontalSpaceBetween className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onDistributeElements?.('vertical')}
                    className="p-1.5 rounded hover:bg-green-200 text-green-700"
                    title="Distribuer verticalement"
                  >
                    <AlignVerticalSpaceBetween className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                Ctrl+clic pour sélectionner
              </span>
            </>
          ) : selectedElement ? (
            <>
              {/* Text formatting tools - only for text elements */}
              {selectedElement.type === 'text' && (
                <>
                  {/* Text alignment */}
                  <div className="flex items-center gap-0.5 bg-gray-50 rounded-lg p-0.5 flex-shrink-0">
                    <button
                      onClick={() => onElementUpdate?.({ ...selectedElement, align: 'left' })}
                      className={`p-1.5 rounded hover:bg-gray-200 ${selectedElement.align === 'left' || !selectedElement.align ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
                      title="Aligner à gauche"
                    >
                      <AlignLeft className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onElementUpdate?.({ ...selectedElement, align: 'center' })}
                      className={`p-1.5 rounded hover:bg-gray-200 ${selectedElement.align === 'center' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
                      title="Centrer le texte"
                    >
                      <AlignCenter className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onElementUpdate?.({ ...selectedElement, align: 'right' })}
                      className={`p-1.5 rounded hover:bg-gray-200 ${selectedElement.align === 'right' ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
                      title="Aligner à droite"
                    >
                      <AlignRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="w-px h-6 bg-gray-300 flex-shrink-0" />

                  {/* Font family */}
                  <select
                    value={selectedElement.fontFamily || 'helvetica'}
                    onChange={(e) => onElementUpdate?.({ ...selectedElement, fontFamily: e.target.value })}
                    className="text-xs bg-white border border-gray-300 rounded-lg px-2 py-1.5 text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 flex-shrink-0 w-[100px]"
                    title="Police"
                  >
                    {FONT_FAMILIES.map((font) => (
                      <option key={font} value={font}>
                        {font.charAt(0).toUpperCase() + font.slice(1)}
                      </option>
                    ))}
                  </select>

                  <div className="w-px h-6 bg-gray-300 flex-shrink-0" />

                  {/* Font style */}
                  <div className="flex items-center gap-0.5 bg-gray-50 rounded-lg p-0.5 flex-shrink-0">
                    <button
                      onClick={() => {
                        const currentStyle = selectedElement.fontStyle || 'normal';
                        const isBold = currentStyle.includes('bold');
                        const isItalic = currentStyle.includes('italic');
                        const newStyle: 'bold' | 'normal' | 'italic' | 'bolditalic' = isBold
                          ? isItalic ? 'italic' : 'normal'
                          : isItalic ? 'bolditalic' : 'bold';
                        onElementUpdate?.({ ...selectedElement, fontStyle: newStyle });
                      }}
                      className={`p-1.5 rounded hover:bg-gray-200 ${selectedElement.fontStyle?.includes('bold') ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
                      title="Gras"
                    >
                      <Bold className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        const currentStyle = selectedElement.fontStyle || 'normal';
                        const isBold = currentStyle.includes('bold');
                        const isItalic = currentStyle.includes('italic');
                        const newStyle: 'bold' | 'normal' | 'italic' | 'bolditalic' = isItalic
                          ? isBold ? 'bold' : 'normal'
                          : isBold ? 'bolditalic' : 'italic';
                        onElementUpdate?.({ ...selectedElement, fontStyle: newStyle });
                      }}
                      className={`p-1.5 rounded hover:bg-gray-200 ${selectedElement.fontStyle?.includes('italic') ? 'bg-blue-100 text-blue-600' : 'text-gray-600'}`}
                      title="Italique"
                    >
                      <Italic className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="w-px h-6 bg-gray-300 flex-shrink-0" />

                  {/* Font size */}
                  <div className="flex items-center gap-1 bg-gray-50 rounded-lg px-1 py-0.5 flex-shrink-0">
                    <button
                      onClick={() => onElementUpdate?.({ ...selectedElement, fontSize: Math.max(1, (selectedElement.fontSize || 12) - 2) })}
                      className="p-1 rounded hover:bg-gray-200 text-gray-600"
                      title="Réduire la taille"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-xs font-medium text-gray-700 w-[36px] text-center">
                      {selectedElement.fontSize || 12}px
                    </span>
                    <button
                      onClick={() => onElementUpdate?.({ ...selectedElement, fontSize: Math.min(200, (selectedElement.fontSize || 12) + 2) })}
                      className="p-1 rounded hover:bg-gray-200 text-gray-600"
                      title="Augmenter la taille"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="w-px h-6 bg-gray-300 flex-shrink-0" />

                  {/* Color */}
                  <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1 flex-shrink-0">
                    <Palette className="h-4 w-4 text-gray-500" />
                    <input
                      type="color"
                      title="Couleur du texte"
                      value={selectedElement.color || '#000000'}
                      onChange={(e) => onElementUpdate?.({ ...selectedElement, color: e.target.value })}
                      className="w-6 h-6 rounded border border-gray-300 cursor-pointer p-0"
                    />
                  </div>

                  <div className="w-px h-6 bg-gray-300 flex-shrink-0" />
                </>
              )}

              {/* Canvas alignment tools - for ALL element types */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-xs text-gray-500 mr-1 hidden lg:inline">Aligner:</span>
                <div className="flex items-center gap-0.5 bg-gray-50 rounded-lg p-0.5">
                  <button
                    onClick={() => onAlignElements?.('left')}
                    className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
                    title="Aligner à gauche du canvas"
                  >
                    <AlignHorizontalJustifyStart className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onAlignElements?.('center')}
                    className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
                    title="Centrer horizontalement"
                  >
                    <AlignHorizontalJustifyCenter className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onAlignElements?.('right')}
                    className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
                    title="Aligner à droite du canvas"
                  >
                    <AlignHorizontalJustifyEnd className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-0.5 bg-gray-50 rounded-lg p-0.5 ml-1">
                  <button
                    onClick={() => onAlignElements?.('top')}
                    className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
                    title="Aligner en haut du canvas"
                  >
                    <AlignVerticalJustifyStart className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onAlignElements?.('middle')}
                    className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
                    title="Centrer verticalement"
                  >
                    <AlignVerticalJustifyCenter className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onAlignElements?.('bottom')}
                    className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
                    title="Aligner en bas du canvas"
                  >
                    <AlignVerticalJustifyEnd className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="w-px h-6 bg-gray-300 flex-shrink-0" />

              {/* Duplicate and Delete */}
              <div className="flex items-center gap-0.5 bg-gray-50 rounded-lg p-0.5 flex-shrink-0">
                <button
                  onClick={() => onElementDuplicate?.(selectedElement)}
                  className="p-1.5 rounded hover:bg-blue-100 text-blue-600"
                  title="Dupliquer"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onElementDelete?.(selectedElement.id)}
                  className="p-1.5 rounded hover:bg-red-100 text-red-600"
                  title="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              {/* Position info - hidden on small screens */}
              <span className="text-xs text-gray-400 ml-auto flex-shrink-0 hidden xl:inline">
                X: {Math.round(Number(selectedElement.x) || 0)} | Y: {Math.round(Number(selectedElement.y) || 0)}
                {selectedElement.width && ` | W: ${Math.round(Number(selectedElement.width))}`}
                {selectedElement.height && ` | H: ${Math.round(Number(selectedElement.height))}`}
              </span>
            </>
          ) : (
            <span className="text-sm text-gray-400 italic">
              Sélectionnez un élément pour voir les options d'édition
            </span>
          )}
        </div>

        {/* Right zone - Zoom Controls (fixed width, never changes) */}
        <div className="flex-shrink-0 ml-3 pl-3 border-l border-gray-200">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1.5 rounded hover:bg-gray-200 text-gray-600 disabled:opacity-50"
              title="Zoom arrière"
              disabled={zoom <= 0.25}
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-xs font-medium text-gray-600 w-[40px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1.5 rounded hover:bg-gray-200 text-gray-600 disabled:opacity-50"
              title="Zoom avant"
              disabled={zoom >= 3}
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <div className="w-px h-4 bg-gray-300 mx-1" />
            <button
              type="button"
              onClick={handleZoomReset}
              className="px-2 py-1 rounded hover:bg-gray-200 text-xs text-gray-600"
              title="Réinitialiser zoom (100%)"
            >
              100%
            </button>
            <button
              type="button"
              onClick={handleZoomFit}
              className="p-1.5 rounded hover:bg-gray-200 text-gray-600"
              title="Ajuster à la taille de travail"
            >
              <Maximize2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-auto p-4 flex justify-center">
        <div
          ref={canvasRef}
          style={{
            width: `${canvasSize.width}px`,
            height: `${canvasSize.height}px`,
            position: 'relative',
            backgroundColor: '#ffffff',
            transform: `scale(${zoom})`,
            transformOrigin: 'top center',
            backgroundImage: backgroundImage
              ? `url(${backgroundImage})`
              : showGrid
              ? 'repeating-linear-gradient(0deg, #e5e7eb 0px, #e5e7eb 1px, transparent 1px, transparent 20px), repeating-linear-gradient(90deg, #e5e7eb 0px, #e5e7eb 1px, transparent 1px, transparent 20px)'
              : 'none',
            backgroundSize: backgroundImage ? 'cover' : '20px 20px',
            backgroundPosition: backgroundImage ? 'center' : '0 0',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            border: dragOver ? '3px dashed #3B82F6' : '1px solid #d1d5db',
          }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={(e) => {
            // Only deselect if clicking directly on canvas background, not on children
            if (e.target === e.currentTarget) {
              onElementSelect(null);
            }
          }}
        >
          {/* Message si vide */}
          {elements.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-gray-400">
                <Grid3x3 className="h-16 w-16 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Glissez-déposez des éléments ici</p>
              </div>
            </div>
          )}

          {/* Render tous les éléments */}
          {elements.map(renderElement)}
        </div>
      </div>
    </div>
  );
};
