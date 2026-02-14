import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { profilesApi } from '@/lib/api/profiles';
import { citiesApi } from '@/lib/api/cities';
import { segmentsApi } from '@/lib/api/segments';
import { v4 as uuidv4 } from 'uuid';

export interface Professor {
  id: string;
  username: string;
  full_name: string;
  password: string;
  role: string;
  created_at: string;
}

export interface ProfessorWithCities extends Professor {
  cities: Array<{ id: string; name: string }>;
}

export interface CreateProfessorInput {
  username: string;
  full_name: string;
  password: string;
}

export interface UpdateProfessorInput {
  id: string;
  username: string;
  full_name: string;
  password?: string;
}

// Récupérer tous les professeurs
export const useProfessors = () => {
  return useQuery<Professor[]>({
    queryKey: ['professors'],
    queryFn: async () => {
      const profiles = await profilesApi.getAll();
      return profiles.filter(p => p.role === 'professor') as Professor[];
    },
  });
};

// Récupérer un professeur par ID avec ses villes
export const useProfessor = (id: string) => {
  return useQuery<ProfessorWithCities | null>({
    queryKey: ['professors', id],
    queryFn: async () => {
      const professor = await profilesApi.getById(id);
      if (!professor || professor.role !== 'professor') return null;

      // Récupérer les villes affectées
      const allCities = await citiesApi.getAll();
      const cities = allCities
        .filter(city => professor.city_ids?.includes(city.id))
        .map(city => ({ id: city.id, name: city.name }));

      return {
        ...(professor as any),
        cities,
      };
    },
    enabled: !!id,
  });
};

// Créer un nouveau professeur
export const useCreateProfessor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateProfessorInput) => {
      const id = uuidv4();
      return profilesApi.create({
        id,
        ...data,
        role: 'professor',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professors'] });
      // Invalidate all professor-related queries
      queryClient.invalidateQueries({ queryKey: ['professors-by-segment-city'] });
      queryClient.invalidateQueries({ queryKey: ['available-professors'] });
      queryClient.invalidateQueries({ queryKey: ['professors-for-impression'] });
    },
  });
};

// Mettre à jour un professeur
export const useUpdateProfessor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfessorInput) => profilesApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professors'] });
      // Invalidate all professor-related queries
      queryClient.invalidateQueries({ queryKey: ['professors-by-segment-city'] });
      queryClient.invalidateQueries({ queryKey: ['available-professors'] });
      queryClient.invalidateQueries({ queryKey: ['professors-for-impression'] });
    },
  });
};

// Supprimer un professeur
export const useDeleteProfessor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => profilesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['professors'] });
      // Invalidate all professor-related queries
      queryClient.invalidateQueries({ queryKey: ['professors-by-segment-city'] });
      queryClient.invalidateQueries({ queryKey: ['available-professors'] });
      queryClient.invalidateQueries({ queryKey: ['professors-for-impression'] });
    },
  });
};

// Récupérer les villes d'un professeur
export const useProfessorCities = (professorId: string) => {
  return useQuery<Array<{ id: string; name: string; segment_name: string }>>({
    queryKey: ['professors', professorId, 'cities'],
    queryFn: async () => {
      const professor = await profilesApi.getById(professorId);
      if (!professor || !professor.city_ids) return [];

      const allCities = await citiesApi.getAll();
      return allCities
        .filter(city => professor.city_ids?.includes(city.id))
        .map(city => ({
          id: city.id,
          name: city.name,
          segment_name: city.segment_name || '',
        }));
    },
    enabled: !!professorId,
  });
};

// Affecter une ville à un professeur
export const useAssignCityToProfessor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ professorId, cityId }: { professorId: string; cityId: string }) => {
      const professor = await profilesApi.getById(professorId);
      if (!professor) throw new Error('Professeur non trouvé');

      const currentCityIds = professor.city_ids || [];
      if (currentCityIds.includes(cityId)) {
        throw new Error('Cette ville est déjà affectée à ce professeur');
      }

      await profilesApi.update({
        id: professorId,
        city_ids: [...currentCityIds, cityId],
      });

      return { professorId, cityId };
    },
    onSuccess: (_, variables) => {
      // Invalidate professor-specific queries
      queryClient.invalidateQueries({ queryKey: ['professors', variables.professorId, 'cities'] });
      queryClient.invalidateQueries({ queryKey: ['professors', variables.professorId] });

      // CRITICAL: Invalidate queries used by other views
      queryClient.invalidateQueries({ queryKey: ['professor-cities'] }); // Professor dashboard
      queryClient.invalidateQueries({ queryKey: ['gerant-cities'] }); // Gerant views
      queryClient.invalidateQueries({ queryKey: ['professors-by-segment-city'] }); // Dropdown filtering
      queryClient.invalidateQueries({ queryKey: ['available-professors'] }); // Impression role
      queryClient.invalidateQueries({ queryKey: ['professors-for-impression'] }); // NewDeclarationModal
    },
  });
};

// Retirer une ville d'un professeur
export const useUnassignCityFromProfessor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ professorId, cityId }: { professorId: string; cityId: string }) => {
      const professor = await profilesApi.getById(professorId);
      if (!professor) throw new Error('Professeur non trouvé');

      const currentCityIds = professor.city_ids || [];
      await profilesApi.update({
        id: professorId,
        city_ids: currentCityIds.filter(id => id !== cityId),
      });

      return { professorId, cityId };
    },
    onSuccess: (_, variables) => {
      // Invalidate professor-specific queries
      queryClient.invalidateQueries({ queryKey: ['professors', variables.professorId, 'cities'] });
      queryClient.invalidateQueries({ queryKey: ['professors', variables.professorId] });

      // CRITICAL: Invalidate queries used by other views
      queryClient.invalidateQueries({ queryKey: ['professor-cities'] }); // Professor dashboard
      queryClient.invalidateQueries({ queryKey: ['gerant-cities'] }); // Gerant views
      queryClient.invalidateQueries({ queryKey: ['professors-by-segment-city'] }); // Dropdown filtering
      queryClient.invalidateQueries({ queryKey: ['available-professors'] }); // Impression role
      queryClient.invalidateQueries({ queryKey: ['professors-for-impression'] }); // NewDeclarationModal
    },
  });
};

// Récupérer les segments d'un professeur
export const useProfessorSegments = (professorId: string) => {
  return useQuery({
    queryKey: ['professors', professorId, 'segments'],
    queryFn: async (): Promise<Array<{ id: string; name: string; color?: string }>> => {
      const professor = await profilesApi.getById(professorId);
      if (!professor || !professor.segment_ids) return [];

      const allSegments = await segmentsApi.getAll();
      return allSegments.filter(segment => professor.segment_ids?.includes(segment.id));
    },
    enabled: !!professorId,
  });
};

// Affecter un segment à un professeur
export const useAssignSegmentToProfessor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ professorId, segmentId }: { professorId: string; segmentId: string }) => {
      const professor = await profilesApi.getById(professorId);
      if (!professor) throw new Error('Professeur non trouvé');

      const currentSegmentIds = professor.segment_ids || [];
      if (currentSegmentIds.includes(segmentId)) {
        throw new Error('Ce segment est déjà affecté à ce professeur');
      }

      await profilesApi.update({
        id: professorId,
        segment_ids: [...currentSegmentIds, segmentId],
      });

      return { professorId, segmentId };
    },
    onSuccess: (_, variables) => {
      // Invalidate professor-specific queries
      queryClient.invalidateQueries({ queryKey: ['professors', variables.professorId, 'segments'] });
      queryClient.invalidateQueries({ queryKey: ['professors', variables.professorId] });

      // CRITICAL: Invalidate queries used by other views
      queryClient.invalidateQueries({ queryKey: ['professor-segments'] }); // Professor dashboard
      queryClient.invalidateQueries({ queryKey: ['gerant-segments'] }); // Gerant views
      queryClient.invalidateQueries({ queryKey: ['professors-by-segment-city'] }); // Dropdown filtering
      queryClient.invalidateQueries({ queryKey: ['available-professors'] }); // Impression role
      queryClient.invalidateQueries({ queryKey: ['professors-for-impression'] }); // NewDeclarationModal
    },
  });
};

// Retirer un segment d'un professeur
export const useUnassignSegmentFromProfessor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ professorId, segmentId }: { professorId: string; segmentId: string }) => {
      const professor = await profilesApi.getById(professorId);
      if (!professor) throw new Error('Professeur non trouvé');

      const currentSegmentIds = professor.segment_ids || [];
      await profilesApi.update({
        id: professorId,
        segment_ids: currentSegmentIds.filter(id => id !== segmentId),
      });

      return { professorId, segmentId };
    },
    onSuccess: (_, variables) => {
      // Invalidate professor-specific queries
      queryClient.invalidateQueries({ queryKey: ['professors', variables.professorId, 'segments'] });
      queryClient.invalidateQueries({ queryKey: ['professors', variables.professorId] });
      queryClient.invalidateQueries({ queryKey: ['professors', variables.professorId, 'cities'] });

      // CRITICAL: Invalidate queries used by other views
      queryClient.invalidateQueries({ queryKey: ['professor-segments'] }); // Professor dashboard
      queryClient.invalidateQueries({ queryKey: ['gerant-segments'] }); // Gerant views
      queryClient.invalidateQueries({ queryKey: ['professors-by-segment-city'] }); // Dropdown filtering
      queryClient.invalidateQueries({ queryKey: ['available-professors'] }); // Impression role
      queryClient.invalidateQueries({ queryKey: ['professors-for-impression'] }); // NewDeclarationModal
    },
  });
};
