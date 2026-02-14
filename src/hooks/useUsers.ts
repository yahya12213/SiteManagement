import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { profilesApi } from '@/lib/api/profiles';
import { citiesApi } from '@/lib/api/cities';
import { segmentsApi } from '@/lib/api/segments';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/contexts/AuthContext';

export interface User {
  id: string;
  username: string;
  password: string;
  full_name: string;
  role: string; // Dynamic role from database (admin, gerant, professor, assistante, comptable, superviseur, etc.)
  role_id?: string; // UUID reference to roles table
  role_name?: string; // Role name from JOIN with roles table
  created_at: string;
}

export interface Segment {
  id: string;
  name: string;
  color?: string;
}

export interface City {
  id: string;
  name: string;
  segment_id: string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  full_name: string;
  role: string; // Dynamic role from database
  // Champs optionnels pour création d'employé
  create_employee?: boolean;
  cin?: string;
  hire_date?: string;
  position?: string;
  department?: string;
}

export interface UpdateUserInput {
  id: string;
  username?: string;
  password?: string;
  full_name?: string;
  role?: string; // Dynamic role from database
}

export interface AssignSegmentsInput {
  user_id: string;
  segment_ids: string[];
  role: string; // professor, gerant, etc.
}

export interface AssignCitiesInput {
  user_id: string;
  city_ids: string[];
  role: string; // professor, gerant, etc.
}

// Hook pour récupérer tous les utilisateurs
export function useUsers(roleFilter?: string) {
  return useQuery({
    queryKey: ['users', roleFilter],
    queryFn: async () => {
      const profiles = await profilesApi.getAll();
      if (!roleFilter || roleFilter === 'all') {
        return profiles as User[];
      }
      // Filtrer par role_name (from JOIN) ou role (legacy field), case insensitive
      return profiles.filter(p => {
        const user = p as User;
        const filterLower = roleFilter.toLowerCase();
        return (
          user.role_name?.toLowerCase() === filterLower ||
          user.role?.toLowerCase() === filterLower
        );
      }) as User[];
    },
  });
}

// Hook pour récupérer un utilisateur spécifique
export function useUser(id: string) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => profilesApi.getById(id),
    enabled: !!id,
  });
}

// Hook pour créer un utilisateur
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateUserInput) => {
      const id = uuidv4();
      return profilesApi.create({
        id,
        ...input,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

// Hook pour mettre à jour un utilisateur
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateUserInput) => profilesApi.update(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
}

// Hook pour supprimer un utilisateur
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => profilesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

// Hook pour assigner des segments à un utilisateur (professeur ou gérant)
export function useAssignSegments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AssignSegmentsInput) => {
      return profilesApi.update({
        id: input.user_id,
        segment_ids: input.segment_ids,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user', variables.user_id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

// Hook pour assigner des villes à un utilisateur (professeur ou gérant)
export function useAssignCities() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AssignCitiesInput) => {
      return profilesApi.update({
        id: input.user_id,
        city_ids: input.city_ids,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['user', variables.user_id] });
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}

// Hook pour récupérer tous les segments (pour affectation)
export function useAllSegments() {
  const { hasPermission } = useAuth();
  // Permettre l'accès si l'utilisateur peut voir les segments OU assigner des segments
  const canViewSegments = hasPermission('accounting.segments.view_page')
    || hasPermission('system.roles.view_segments')
    || hasPermission('accounting.users.assign_segments');

  return useQuery({
    queryKey: ['segments'],
    queryFn: () => segmentsApi.getAll(),
    enabled: canViewSegments,
  });
}

// Hook pour récupérer toutes les villes (pour affectation)
export function useAllCities() {
  const { hasPermission } = useAuth();
  // Permettre l'accès si l'utilisateur peut voir les villes OU assigner des villes
  const canViewCities = hasPermission('accounting.cities.view_page')
    || hasPermission('system.roles.view_cities')
    || hasPermission('accounting.users.assign_cities');

  return useQuery({
    queryKey: ['cities'],
    queryFn: () => citiesApi.getAll(),
    enabled: canViewCities,
  });
}

// Hook pour récupérer les segments d'un utilisateur
export function useUserSegments(userId: string) {
  return useQuery({
    queryKey: ['user', userId, 'segments'],
    queryFn: async () => {
      const user = await profilesApi.getById(userId);
      if (!user || !user.segment_ids) return [];

      const allSegments = await segmentsApi.getAll();
      return allSegments.filter(segment => user.segment_ids?.includes(segment.id));
    },
    enabled: !!userId,
  });
}

// Hook pour récupérer les villes d'un utilisateur
export function useUserCities(userId: string) {
  return useQuery({
    queryKey: ['user', userId, 'cities'],
    queryFn: async () => {
      const user = await profilesApi.getById(userId);
      if (!user || !user.city_ids) return [];

      const allCities = await citiesApi.getAll();
      return allCities.filter(city => user.city_ids?.includes(city.id));
    },
    enabled: !!userId,
  });
}
