/**
 * API Client for Declaration Attachments
 */

import { apiClient } from './client';
import type { DeclarationAttachment } from '../../types/declarations';

const API_URL = import.meta.env.VITE_API_URL || '/api';

/**
 * Upload an attachment for a declaration
 * @param declarationId - The ID of the declaration
 * @param file - The file to upload
 * @returns Promise with the uploaded attachment data
 */
export async function uploadDeclarationAttachment(
  declarationId: string,
  file: File
): Promise<DeclarationAttachment> {
  const formData = new FormData();
  formData.append('attachment', file);

  return apiClient.post<DeclarationAttachment>(
    `/declarations/${declarationId}/attachments`,
    formData
  );
}

/**
 * Get all attachments for a declaration
 * @param declarationId - The ID of the declaration
 * @returns Promise with array of attachments
 */
export async function getDeclarationAttachments(
  declarationId: string
): Promise<DeclarationAttachment[]> {
  return apiClient.get<DeclarationAttachment[]>(
    `/declarations/${declarationId}/attachments`
  );
}

/**
 * Delete an attachment
 * @param declarationId - The ID of the declaration
 * @param attachmentId - The ID of the attachment to delete
 * @returns Promise with deletion confirmation
 */
export async function deleteDeclarationAttachment(
  declarationId: string,
  attachmentId: string
): Promise<{ message: string; fileDeleted: boolean }> {
  return apiClient.delete<{ message: string; fileDeleted: boolean }>(
    `/declarations/${declarationId}/attachments/${attachmentId}`
  );
}

/**
 * Get the full URL for an attachment
 * @param fileUrl - The file URL from the attachment record
 * @returns Full URL to access the file
 */
export function getAttachmentUrl(fileUrl: string): string {
  if (fileUrl.startsWith('http')) {
    return fileUrl;
  }

  const baseUrl = API_URL.replace('/api', '');
  return `${baseUrl}${fileUrl}`;
}

/**
 * Download an attachment
 * @param attachment - The attachment to download
 */
export function downloadAttachment(attachment: DeclarationAttachment): void {
  const url = getAttachmentUrl(attachment.file_url);
  const link = document.createElement('a');
  link.href = url;
  link.download = attachment.original_filename;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
