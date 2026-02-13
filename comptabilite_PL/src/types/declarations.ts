/**
 * Types for Professor Declarations and Attachments
 */

export interface DeclarationAttachment {
  id: string;
  declaration_id: string;
  filename: string;
  original_filename: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  uploaded_by: string | null;
  uploaded_by_name?: string;
  uploaded_at: string;
  created_at: string;
}

export interface AttachmentUploadResponse {
  success: boolean;
  attachment?: DeclarationAttachment;
  error?: string;
}

export interface AttachmentListResponse {
  success: boolean;
  attachments?: DeclarationAttachment[];
  error?: string;
}

export interface AttachmentDeleteResponse {
  success: boolean;
  message?: string;
  fileDeleted?: boolean;
  error?: string;
}

// Allowed MIME types for declaration attachments
export const ALLOWED_ATTACHMENT_TYPES = [
  'application/pdf',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
] as const;

// File extension mapping
export const ATTACHMENT_EXTENSIONS: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp'
};

// Human-readable file type names
export const ATTACHMENT_TYPE_NAMES: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.ms-excel': 'Excel (XLS)',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel (XLSX)',
  'application/msword': 'Word (DOC)',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word (DOCX)',
  'image/jpeg': 'Image JPEG',
  'image/jpg': 'Image JPG',
  'image/png': 'Image PNG',
  'image/webp': 'Image WebP'
};

// Maximum file size: 10 MB
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

// Helper function to format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Helper function to get file type icon
export function getFileTypeIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType === 'application/pdf') return '📄';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return '📊';
  if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
  return '📎';
}
