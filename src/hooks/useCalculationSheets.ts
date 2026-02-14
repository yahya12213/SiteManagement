import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { calculationSheetsApi } from '@/lib/api/calculationSheets';
import type { CalculationSheet, CreateCalculationSheetInput, UpdateCalculationSheetInput } from '@/lib/api/calculationSheets';
import { v4 as uuidv4 } from 'uuid';

export type CalculationSheetData = CalculationSheet;
export type { CreateCalculationSheetInput, UpdateCalculationSheetInput };

// Récupérer toutes les fiches de calcul
export const useCalculationSheets = () => {
  return useQuery<CalculationSheet[]>({
    queryKey: ['calculation-sheets'],
    queryFn: () => calculationSheetsApi.getAll(),
  });
};

// Récupérer une fiche par ID
export const useCalculationSheet = (id: string) => {
  return useQuery<CalculationSheet | null>({
    queryKey: ['calculation-sheet', id],
    queryFn: () => calculationSheetsApi.getById(id),
    enabled: !!id,
  });
};

// Créer une fiche de calcul
export const useCreateCalculationSheet = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { title: string; segment_ids?: string[]; city_ids?: string[]; template_data?: string; status?: 'draft' | 'published'; sheet_date?: string }) => {
      const id = uuidv4();
      const currentDate = new Date().toISOString();
      return calculationSheetsApi.create({
        id,
        title: data.title,
        template_data: data.template_data || '{}',
        status: data.status || 'draft',
        sheet_date: data.sheet_date || currentDate,
        segment_ids: data.segment_ids,
        city_ids: data.city_ids,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calculation-sheets'] });
    },
  });
};

// Mettre à jour une fiche de calcul
export const useUpdateCalculationSheet = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateCalculationSheetInput) => calculationSheetsApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calculation-sheets'] });
      queryClient.invalidateQueries({ queryKey: ['calculation-sheet'] });
    },
  });
};

// Supprimer une fiche de calcul
export const useDeleteCalculationSheet = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => calculationSheetsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calculation-sheets'] });
    },
  });
};

// Toggle status (draft <-> published)
export const useToggleCalculationSheetStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const sheet = await calculationSheetsApi.getById(id);
      if (!sheet) throw new Error('Fiche non trouvée');

      const newStatus = sheet.status === 'published' ? 'draft' : 'published';
      return calculationSheetsApi.update({
        id,
        title: sheet.title,
        template_data: sheet.template_data,
        status: newStatus as 'draft' | 'published',
        sheet_date: sheet.sheet_date,
        segment_ids: sheet.segment_ids,
        city_ids: sheet.city_ids,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calculation-sheets'] });
      queryClient.invalidateQueries({ queryKey: ['calculation-sheet'] });
    },
  });
};

// Alias pour compatibilité avec les composants
export const useTogglePublishCalculationSheet = useToggleCalculationSheetStatus;

// Hook pour dupliquer une fiche de calcul
export const useDuplicateCalculationSheet = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const sheet = await calculationSheetsApi.getById(id);
      if (!sheet) throw new Error('Fiche non trouvée');

      const newId = uuidv4();
      return calculationSheetsApi.create({
        id: newId,
        title: `${sheet.title} (copie)`,
        template_data: sheet.template_data,
        status: 'draft',
        sheet_date: new Date().toISOString(),
        segment_ids: sheet.segment_ids,
        city_ids: sheet.city_ids,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calculation-sheets'] });
    },
  });
};
