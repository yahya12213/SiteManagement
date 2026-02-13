import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { citiesApi } from '@/lib/api/cities';
import type { City, CreateCityInput, UpdateCityInput } from '@/lib/api/cities';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/contexts/AuthContext';

// Ré-exporter les types pour compatibilité
export type { City, CreateCityInput, UpdateCityInput };

// Récupérer toutes les villes avec les informations du segment
// Note: L'API applique automatiquement le filtrage SBAC (scope-based)
export const useCities = () => {
  const { user } = useAuth();

  return useQuery<City[]>({
    queryKey: ['cities', user?.id],
    queryFn: () => citiesApi.getAll(),
    enabled: !!user,
  });
};

// Récupérer TOUTES les villes du système (sans filtrage SBAC)
// Utilisé pour la réassignation de prospects à d'autres villes/segments
export const useAllCities = () => {
  const { user } = useAuth();

  return useQuery<City[]>({
    queryKey: ['cities', 'all'],
    queryFn: () => citiesApi.getAllUnfiltered(),
    enabled: !!user,
  });
};

// Récupérer une ville par ID
export const useCity = (id: string) => {
  return useQuery<City | null>({
    queryKey: ['cities', id],
    queryFn: () => citiesApi.getById(id),
    enabled: !!id,
  });
};

// Récupérer les villes par segment
// @param applyScope - Si true (défaut), applique le filtre SBAC. Si false, retourne toutes les villes du segment.
export const useCitiesBySegment = (segmentId: string, applyScope = true) => {
  return useQuery({
    queryKey: ['cities', 'segment', segmentId, applyScope],
    queryFn: (): Promise<City[]> => citiesApi.getBySegment(segmentId, applyScope),
    enabled: !!segmentId,
  });
};

// Créer une nouvelle ville
export const useCreateCity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateCityInput) => {
      const id = uuidv4();
      return citiesApi.create(id, data);
    },
    onSuccess: () => {
      // Invalidate all city-related queries
      queryClient.invalidateQueries({ queryKey: ['cities'] });
      queryClient.invalidateQueries({ queryKey: ['professor-cities'] });
      queryClient.invalidateQueries({ queryKey: ['gerant-cities'] });
      queryClient.invalidateQueries({ queryKey: ['professors-by-segment-city'] });
      // Invalidate professor assignments since they reference cities
      queryClient.invalidateQueries({ queryKey: ['professors'] });
    },
  });
};

// Mettre à jour une ville
export const useUpdateCity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateCityInput) => citiesApi.update(data),
    onSuccess: () => {
      // Invalidate all city-related queries
      queryClient.invalidateQueries({ queryKey: ['cities'] });
      queryClient.invalidateQueries({ queryKey: ['professor-cities'] });
      queryClient.invalidateQueries({ queryKey: ['gerant-cities'] });
      queryClient.invalidateQueries({ queryKey: ['professors-by-segment-city'] });
      // Invalidate professor assignments since they reference cities
      queryClient.invalidateQueries({ queryKey: ['professors'] });
    },
  });
};

// Supprimer une ville
export const useDeleteCity = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => citiesApi.delete(id),
    onSuccess: () => {
      // Invalidate all city-related queries
      queryClient.invalidateQueries({ queryKey: ['cities'] });
      queryClient.invalidateQueries({ queryKey: ['professor-cities'] });
      queryClient.invalidateQueries({ queryKey: ['gerant-cities'] });
      queryClient.invalidateQueries({ queryKey: ['professors-by-segment-city'] });
      // Invalidate professor assignments since they reference cities
      queryClient.invalidateQueries({ queryKey: ['professors'] });
      // Also invalidate declarations since they reference cities
      queryClient.invalidateQueries({ queryKey: ['professor-declarations'] });
      queryClient.invalidateQueries({ queryKey: ['gerant-declarations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-declarations'] });
    },
  });
};

// Import en masse de villes
export interface ImportCityData {
  name: string;
  code: string;
  segment_id: string;
}

export const useImportCities = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (cities: ImportCityData[]) => {
      const results = {
        success: 0,
        errors: [] as Array<{ row: number; error: string; data: ImportCityData }>,
      };

      // Récupérer toutes les villes existantes pour vérification
      const existingCities = await citiesApi.getAll();

      for (let i = 0; i < cities.length; i++) {
        const city = cities[i];
        try {
          // Vérifier que toutes les données sont présentes
          if (!city.name || !city.code || !city.segment_id) {
            results.errors.push({
              row: i + 2, // +2 car ligne 1 = header, et index commence à 0
              error: 'Données manquantes (nom, code ou segment)',
              data: city,
            });
            continue;
          }

          // Vérifier si la ville existe déjà (par nom et segment)
          const existing = existingCities.find(
            (c) => c.name.trim() === city.name.trim() && c.segment_id === city.segment_id
          );

          if (existing) {
            results.errors.push({
              row: i + 2,
              error: `Une ville avec le nom "${city.name}" existe déjà dans ce segment`,
              data: city,
            });
            continue;
          }

          // Créer la ville
          const id = uuidv4();
          await citiesApi.create(id, {
            name: city.name.trim(),
            code: city.code.trim(),
            segment_id: city.segment_id,
          });

          results.success++;
        } catch (error) {
          results.errors.push({
            row: i + 2,
            error: error instanceof Error ? error.message : 'Erreur inconnue',
            data: city,
          });
        }
      }

      return results;
    },
    onSuccess: () => {
      // Invalidate all city-related queries after import
      queryClient.invalidateQueries({ queryKey: ['cities'] });
      queryClient.invalidateQueries({ queryKey: ['professor-cities'] });
      queryClient.invalidateQueries({ queryKey: ['gerant-cities'] });
      queryClient.invalidateQueries({ queryKey: ['professors-by-segment-city'] });
      // Invalidate professor assignments since they reference cities
      queryClient.invalidateQueries({ queryKey: ['professors'] });
    },
  });
};
