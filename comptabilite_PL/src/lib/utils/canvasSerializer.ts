import * as fabric from 'fabric';

/**
 * Sérialise un objet Fabric.js en JSON
 */
export const serializeCanvas = (canvas: fabric.Canvas): string => {
  return JSON.stringify(canvas.toJSON());
};

/**
 * Désérialise du JSON en objets Fabric.js
 */
export const deserializeCanvas = (
  canvas: fabric.Canvas,
  json: string
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      canvas.loadFromJSON(json, () => {
        canvas.renderAll();
        resolve();
      });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Exporte le canvas en image (base64)
 */
export const exportCanvasAsImage = (
  canvas: fabric.Canvas,
  format: 'png' | 'jpeg' = 'png',
  quality: number = 1.0
): string => {
  return canvas.toDataURL({
    format,
    quality,
    multiplier: 2, // Pour une meilleure qualité
  });
};

/**
 * Crée un rectangle pour les blocs
 */
export const createBlockRect = (
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
  title: string
): fabric.Group => {
  const rect = new fabric.Rect({
    width,
    height,
    fill: `${color}20`, // Opacité 20%
    stroke: color,
    strokeWidth: 3,
    rx: 4,
    ry: 4,
  });

  const text = new fabric.Text(title, {
    fontSize: 14,
    fontWeight: 'bold',
    fill: color,
    textAlign: 'center',
  });

  const group = new fabric.Group([rect, text], {
    left: x,
    top: y - 25, // Décalage pour le titre
    selectable: false,
    evented: false,
  });

  return group;
};

/**
 * Efface tous les objets du canvas
 */
export const clearCanvas = (canvas: fabric.Canvas): void => {
  canvas.clear();
  canvas.backgroundColor = '#ffffff';
  canvas.renderAll();
};
