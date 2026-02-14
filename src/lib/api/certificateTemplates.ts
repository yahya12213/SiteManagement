import { apiClient, tokenManager } from './client';
import type {
  CertificateTemplate,
  CreateTemplateInput,
  UpdateTemplateInput,
  CustomFont,
} from '@/types/certificateTemplate';

/**
 * API client pour les templates de certificats
 */
export const certificateTemplatesApi = {
  /**
   * Lister tous les templates
   */
  getAll: async (): Promise<{ success: boolean; templates: CertificateTemplate[] }> => {
    return apiClient.get('/certificate-templates');
  },

  /**
   * Obtenir un template par ID
   */
  getById: async (id: string): Promise<{ success: boolean; template: CertificateTemplate }> => {
    return apiClient.get(`/certificate-templates/${id}`);
  },

  /**
   * Créer un nouveau template
   */
  create: async (data: CreateTemplateInput): Promise<{ success: boolean; template: CertificateTemplate }> => {
    return apiClient.post('/certificate-templates', data);
  },

  /**
   * Modifier un template existant
   */
  update: async (
    id: string,
    data: UpdateTemplateInput
  ): Promise<{ success: boolean; template: CertificateTemplate }> => {
    return apiClient.put(`/certificate-templates/${id}`, data);
  },

  /**
   * Supprimer un template
   */
  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/certificate-templates/${id}`);
  },

  /**
   * Dupliquer un template
   */
  duplicate: async (
    id: string
  ): Promise<{ success: boolean; template: CertificateTemplate; message: string }> => {
    return apiClient.post(`/certificate-templates/${id}/duplicate`);
  },

  /**
   * Dupliquer un template vers un autre dossier
   */
  duplicateToFolder: async (
    id: string,
    targetFolderId: string
  ): Promise<{ success: boolean; template: CertificateTemplate; message: string }> => {
    return apiClient.post(`/certificate-templates/${id}/duplicate-to-folder`, { targetFolderId });
  },

  /**
   * Créer les templates prédéfinis (seed)
   */
  seedDefaults: async (): Promise<{ success: boolean; message: string; templates: CertificateTemplate[] }> => {
    return apiClient.post('/certificate-templates/seed-defaults');
  },

  /**
   * Générer un aperçu PDF (retourne un Blob)
   */
  generatePreview: async (id: string, certificateData: any): Promise<Blob> => {
    const token = tokenManager.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`/api/certificate-templates/${id}/preview`, {
      method: 'POST',
      headers,
      body: JSON.stringify(certificateData),
    });

    if (!response.ok) {
      throw new Error('Failed to generate preview');
    }

    return response.blob();
  },

  /**
   * Upload logo pour un template
   */
  uploadLogo: async (id: string, file: File): Promise<{ success: boolean; logo_url: string }> => {
    const formData = new FormData();
    formData.append('logo', file);

    return await apiClient.post(`/certificate-templates/${id}/upload-logo`, formData);
  },

  /**
   * Upload signature pour un template
   */
  uploadSignature: async (id: string, file: File): Promise<{ success: boolean; signature_url: string }> => {
    const formData = new FormData();
    formData.append('signature', file);

    return await apiClient.post(`/certificate-templates/${id}/upload-signature`, formData);
  },

  /**
   * Upload image d'arrière-plan pour un template ou une page spécifique
   * @param id - ID du template
   * @param file - Fichier image
   * @param pageId - (optionnel) ID de la page pour upload par page (multi-pages)
   */
  uploadBackground: async (id: string, file: File, pageId?: string): Promise<{ success: boolean; template?: CertificateTemplate; background_url?: string; pageId?: string | null; message: string }> => {
    const formData = new FormData();
    formData.append('background', file);
    if (pageId) {
      formData.append('pageId', pageId);
    }

    return await apiClient.post(`/certificate-templates/${id}/upload-background`, formData);
  },

  /**
   * Définir une URL d'arrière-plan pour un template ou une page spécifique
   * @param id - ID du template
   * @param url - URL de l'image
   * @param pageId - (optionnel) ID de la page pour URL par page (multi-pages)
   */
  setBackgroundUrl: async (id: string, url: string, pageId?: string): Promise<{ success: boolean; template?: CertificateTemplate; background_url?: string; pageId?: string | null; message: string }> => {
    return apiClient.post(`/certificate-templates/${id}/background-url`, { url, pageId });
  },

  /**
   * Supprimer l'arrière-plan d'un template ou d'une page spécifique
   * @param id - ID du template
   * @param pageId - (optionnel) ID de la page pour suppression par page (multi-pages)
   */
  deleteBackground: async (id: string, pageId?: string): Promise<{ success: boolean; template?: CertificateTemplate; pageId?: string | null; message: string }> => {
    const queryParam = pageId ? `?pageId=${encodeURIComponent(pageId)}` : '';
    return apiClient.delete(`/certificate-templates/${id}/background${queryParam}`);
  },

  /**
   * Upload un arrière-plan depuis un chemin local sur le serveur
   * @param id - ID du template
   * @param filePath - Chemin complet du fichier sur le serveur/machine locale
   * @param pageId - (optionnel) ID de la page pour upload par page (multi-pages)
   */
  uploadBackgroundFromPath: async (id: string, filePath: string, pageId?: string): Promise<{ success: boolean; template?: CertificateTemplate; background_url?: string; pageId?: string | null; message: string }> => {
    return apiClient.post(`/certificate-templates/${id}/upload-background-from-path`, { filePath, pageId });
  },

  /**
   * Upload une police personnalisée
   */
  uploadCustomFont: async (file: File, fontName: string): Promise<{ success: boolean; font: CustomFont; message: string }> => {
    const formData = new FormData();
    formData.append('font', file);
    formData.append('fontName', fontName);

    return await apiClient.post(`/certificate-templates/custom-fonts/upload`, formData);
  },

  /**
   * Lister toutes les polices personnalisées
   */
  getCustomFonts: async (): Promise<{ success: boolean; fonts: CustomFont[] }> => {
    return apiClient.get('/certificate-templates/custom-fonts');
  },

  /**
   * Supprimer une police personnalisée
   */
  deleteCustomFont: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/certificate-templates/custom-fonts/${id}`);
  },
};
