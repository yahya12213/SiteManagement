import React, { useState } from 'react';
import { Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react';
import type { TemplateFolder } from '@/types/certificateTemplate';

interface FolderTreeProps {
  folders: TemplateFolder[];
  selectedFolderId?: string | null;
  onFolderSelect?: (folderId: string) => void;
  onFolderContextMenu?: (folder: TemplateFolder, event: React.MouseEvent) => void;
}

interface FolderNodeProps {
  folder: TemplateFolder;
  level: number;
  selectedFolderId?: string | null;
  onFolderSelect?: (folderId: string) => void;
  onFolderContextMenu?: (folder: TemplateFolder, event: React.MouseEvent) => void;
}

/**
 * Recursive folder node component
 */
const FolderNode: React.FC<FolderNodeProps> = ({
  folder,
  level,
  selectedFolderId,
  onFolderSelect,
  onFolderContextMenu,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = folder.children && folder.children.length > 0;
  const isSelected = selectedFolderId === folder.id;

  const handleClick = () => {
    if (onFolderSelect) {
      onFolderSelect(folder.id);
    }
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (onFolderContextMenu) {
      onFolderContextMenu(folder, e);
    }
  };

  return (
    <div>
      {/* Folder Row */}
      <div
        className={`flex items-center gap-1 px-2 py-1.5 rounded cursor-pointer transition-colors ${
          isSelected
            ? 'bg-blue-100 text-blue-700'
            : 'hover:bg-gray-100 text-gray-700'
        }`}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
      >
        {/* Chevron */}
        {hasChildren ? (
          <span className="flex-shrink-0">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
        ) : (
          <span className="w-4" /> // Spacing placeholder
        )}

        {/* Folder Icon */}
        {isExpanded && hasChildren ? (
          <FolderOpen className="h-4 w-4 flex-shrink-0" />
        ) : (
          <Folder className="h-4 w-4 flex-shrink-0" />
        )}

        {/* Folder Name */}
        <span className="text-sm font-medium truncate flex-1">
          {folder.name}
        </span>

        {/* Template Count Badge */}
        {folder.template_count !== undefined && folder.template_count > 0 && (
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            isSelected ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'
          }`}>
            {folder.template_count}
          </span>
        )}
      </div>

      {/* Children (Recursive) */}
      {hasChildren && isExpanded && (
        <div>
          {folder.children!.map((child) => (
            <FolderNode
              key={child.id}
              folder={child}
              level={level + 1}
              selectedFolderId={selectedFolderId}
              onFolderSelect={onFolderSelect}
              onFolderContextMenu={onFolderContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Main Folder Tree Component
 */
export const FolderTree: React.FC<FolderTreeProps> = ({
  folders,
  selectedFolderId,
  onFolderSelect,
  onFolderContextMenu,
}) => {
  if (!folders || folders.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        <Folder className="h-8 w-8 mx-auto mb-2 text-gray-300" />
        <p>Aucun dossier</p>
      </div>
    );
  }

  return (
    <div className="py-2">
      {folders.map((folder) => (
        <FolderNode
          key={folder.id}
          folder={folder}
          level={0}
          selectedFolderId={selectedFolderId}
          onFolderSelect={onFolderSelect}
          onFolderContextMenu={onFolderContextMenu}
        />
      ))}
    </div>
  );
};
