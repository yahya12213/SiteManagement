import React from 'react';
import { Home, ChevronRight, Folder } from 'lucide-react';
import type { TemplateFolder } from '@/types/certificateTemplate';

interface BreadcrumbProps {
  currentPath: TemplateFolder[];
  onNavigate: (folderId: string | null) => void;
}

/**
 * Breadcrumb navigation component with Windows Explorer style
 * Displays clickable path: 🏠 Home > 📂 Folder1 > 📂 Folder2
 */
export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  currentPath,
  onNavigate,
}) => {
  return (
    <div className="flex items-center gap-1 px-4 py-3 bg-white border border-gray-200 rounded-lg shadow-sm">
      {/* Home button */}
      <button
        onClick={() => onNavigate(null)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 rounded transition-colors"
        title="Accueil"
      >
        <Home className="h-4 w-4" />
        <span className="font-medium">Accueil</span>
      </button>

      {/* Path segments */}
      {currentPath.map((folder, index) => (
        <React.Fragment key={folder.id}>
          {/* Separator */}
          <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />

          {/* Folder button */}
          <button
            onClick={() => onNavigate(folder.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded transition-colors ${
              index === currentPath.length - 1
                ? 'bg-blue-100 text-blue-800 font-semibold'
                : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
            }`}
            title={folder.name}
          >
            <Folder className="h-4 w-4" />
            <span className="max-w-[200px] truncate">{folder.name}</span>
          </button>
        </React.Fragment>
      ))}
    </div>
  );
};
