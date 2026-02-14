// @ts-nocheck
/**
 * Dialog Component - Modal amélioré
 * Support pour différentes tailles, meilleure lisibilité et redimensionnement
 * IMPORTANT: Le resize ne doit PAS déclencher onOpenChange
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';

interface DialogProps {
  children: React.ReactNode;
  open: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const Dialog = ({ children, open, onOpenChange }: DialogProps) => {
  const isResizingRef = useRef(false);

  // Bloquer le scroll du body quand le dialog est ouvert
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  // Fermer avec Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isResizingRef.current) {
        onOpenChange?.(false);
      }
    };
    if (open) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onOpenChange]);

  if (!open) return null;

  // Handler pour le click sur le backdrop - NE PAS fermer si on resize
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (!isResizingRef.current && e.target === e.currentTarget) {
      onOpenChange?.(false);
    }
  };

  return (
    <DialogContext.Provider value={{ isResizingRef }}>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md"
        onClick={handleBackdropClick}
      >
        <div
          className="bg-white rounded-card shadow-elevation-3 animate-scale-in border border-gray-100"
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </DialogContext.Provider>
  );
};

// Context pour partager l'état de resize
const DialogContext = React.createContext<{ isResizingRef: React.MutableRefObject<boolean> }>({
  isResizingRef: { current: false }
});

interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
  resizable?: boolean;
  fitToScreen?: boolean;
}

export const DialogContent = ({ children, className = '', resizable = false, fitToScreen = false }: DialogContentProps) => {
  const { isResizingRef } = React.useContext(DialogContext);
  const contentRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const resizeRef = useRef({ startX: 0, startY: 0, startWidth: 0, startHeight: 0 });

  // Initialiser la taille au montage
  useEffect(() => {
    if (contentRef.current && resizable) {
      const rect = contentRef.current.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    }
  }, [resizable]);

  // Gestion du redimensionnement
  const handleMouseDown = useCallback((e: React.MouseEvent, direction: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!contentRef.current) return;

    // Marquer qu'on est en train de resize
    isResizingRef.current = true;

    const rect = contentRef.current.getBoundingClientRect();
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startWidth: rect.width,
      startHeight: rect.height,
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const deltaX = moveEvent.clientX - resizeRef.current.startX;
      const deltaY = moveEvent.clientY - resizeRef.current.startY;

      let newWidth = resizeRef.current.startWidth;
      let newHeight = resizeRef.current.startHeight;

      if (direction.includes('e')) newWidth = Math.max(400, resizeRef.current.startWidth + deltaX);
      if (direction.includes('w')) newWidth = Math.max(400, resizeRef.current.startWidth - deltaX);
      if (direction.includes('s')) newHeight = Math.max(300, resizeRef.current.startHeight + deltaY);
      if (direction.includes('n')) newHeight = Math.max(300, resizeRef.current.startHeight - deltaY);

      // Limites max
      newWidth = Math.min(newWidth, window.innerWidth * 0.95);
      newHeight = Math.min(newHeight, window.innerHeight * 0.95);

      setSize({ width: newWidth, height: newHeight });
    };

    const handleMouseUp = () => {
      // Petit délai avant de permettre la fermeture
      setTimeout(() => {
        isResizingRef.current = false;
      }, 100);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = direction.includes('n') || direction.includes('s')
      ? (direction.includes('e') || direction.includes('w') ? `${direction}-resize` : 'ns-resize')
      : 'ew-resize';
    document.body.style.userSelect = 'none';

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [isResizingRef]);

  // Classes de base - Responsive: plus large sur desktop, adaptatif sur mobile
  const hasCustomWidth = className.includes('max-w-') || className.includes('w-[');

  // Mode fit-to-screen: utilise flexbox pour tout afficher sans scroll
  // Largeurs responsives: 95% sur mobile, max-width adaptatif sur desktop
  const baseClasses = fitToScreen
    ? 'p-4 sm:p-6 flex flex-col'
    : hasCustomWidth
      ? 'p-4 sm:p-6 max-w-[95vw]'
      : 'p-4 sm:p-6 w-[95vw] sm:w-[600px] md:w-[700px] max-w-[95vw] max-h-[85vh] overflow-auto';

  // Style dynamique pour le redimensionnement
  const dynamicStyle: React.CSSProperties = resizable && size.width > 0 ? {
    width: `${size.width}px`,
    height: `${size.height}px`,
    maxWidth: '95vw',
    maxHeight: '95vh',
    display: 'flex',
    flexDirection: 'column',
  } : {};

  return (
    <div
      ref={contentRef}
      className={`${baseClasses} ${className} ${resizable ? 'relative select-none' : ''}`}
      style={dynamicStyle}
    >
      {children}

      {/* Poignées de redimensionnement */}
      {resizable && (
        <>
          {/* Coin bas-droite - avec icône visible */}
          <div
            className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize bg-gray-400 hover:bg-primary-500 rounded-tl z-20 flex items-center justify-center transition-colors duration-fast"
            onMouseDown={(e) => handleMouseDown(e, 'se')}
            title="Redimensionner"
          >
            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22 22H20V20H22V22ZM22 18H20V16H22V18ZM18 22H16V20H18V22ZM22 14H20V12H22V14ZM18 18H16V16H18V18ZM14 22H12V20H14V22Z" />
            </svg>
          </div>

          {/* Coin haut-droite */}
          <div
            className="absolute top-0 right-0 w-4 h-4 cursor-ne-resize z-20"
            onMouseDown={(e) => handleMouseDown(e, 'ne')}
          />

          {/* Coin haut-gauche */}
          <div
            className="absolute top-0 left-0 w-4 h-4 cursor-nw-resize z-20"
            onMouseDown={(e) => handleMouseDown(e, 'nw')}
          />

          {/* Coin bas-gauche */}
          <div
            className="absolute bottom-0 left-0 w-4 h-4 cursor-sw-resize z-20"
            onMouseDown={(e) => handleMouseDown(e, 'sw')}
          />

          {/* Bord droit */}
          <div
            className="absolute top-4 right-0 w-2 h-[calc(100%-32px)] cursor-e-resize hover:bg-primary-300/50 z-10 transition-colors duration-fast"
            onMouseDown={(e) => handleMouseDown(e, 'e')}
          />

          {/* Bord gauche */}
          <div
            className="absolute top-4 left-0 w-2 h-[calc(100%-32px)] cursor-w-resize hover:bg-primary-300/50 z-10 transition-colors duration-fast"
            onMouseDown={(e) => handleMouseDown(e, 'w')}
          />

          {/* Bord haut */}
          <div
            className="absolute top-0 left-4 w-[calc(100%-32px)] h-2 cursor-n-resize hover:bg-primary-300/50 z-10 transition-colors duration-fast"
            onMouseDown={(e) => handleMouseDown(e, 'n')}
          />

          {/* Bord bas */}
          <div
            className="absolute bottom-0 left-4 w-[calc(100%-32px)] h-2 cursor-s-resize hover:bg-primary-300/50 z-10 transition-colors duration-fast"
            onMouseDown={(e) => handleMouseDown(e, 's')}
          />
        </>
      )}
    </div>
  );
};

interface DialogHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const DialogHeader = ({ children, className = '' }: DialogHeaderProps) => (
  <div className={`mb-3 pb-3 border-b border-gray-200 flex-shrink-0 ${className}`}>
    {children}
  </div>
);

interface DialogTitleProps {
  children: React.ReactNode;
  className?: string;
}

export const DialogTitle = ({ children, className = '' }: DialogTitleProps) => (
  <h2 className={`text-xl font-semibold text-gray-900 ${className}`}>
    {children}
  </h2>
);

interface DialogDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export const DialogDescription = ({ children, className = '' }: DialogDescriptionProps) => (
  <p className={`mt-1 text-sm text-gray-500 ${className}`}>
    {children}
  </p>
);

interface DialogFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const DialogFooter = ({ children, className = '' }: DialogFooterProps) => (
  <div className={`mt-4 pt-3 border-t border-gray-200 flex gap-3 justify-end flex-shrink-0 ${className}`}>
    {children}
  </div>
);

// Composant pour fermer le dialog
export const DialogClose = ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
  <>{children}</>
);

// Trigger pour ouvrir le dialog (optionnel)
export const DialogTrigger = ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => (
  <>{children}</>
);
