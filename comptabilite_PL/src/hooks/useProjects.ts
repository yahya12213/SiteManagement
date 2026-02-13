/**
 * React Query hooks for Projects and Actions (Gestion de Projet)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  projectsApi,
  actionsApi,
} from '@/lib/api/projects';
import type {
  CreateProjectInput,
  UpdateProjectInput,
  CreateActionInput,
  UpdateActionInput,
} from '@/lib/api/projects';

// ==================== Query Keys ====================

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  projectActions: (id: string) => [...projectKeys.detail(id), 'actions'] as const,
};

export const actionKeys = {
  all: ['actions'] as const,
  lists: () => [...actionKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) => [...actionKeys.lists(), filters] as const,
  details: () => [...actionKeys.all, 'detail'] as const,
  detail: (id: string) => [...actionKeys.details(), id] as const,
  stats: () => [...actionKeys.all, 'stats'] as const,
};

// ==================== Projects Hooks ====================

export function useProjects(filters?: {
  status?: string;
  priority?: string;
  manager_id?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: projectKeys.list(filters),
    queryFn: () => projectsApi.getAll(filters),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => projectsApi.getById(id),
    enabled: !!id,
  });
}

export function useProjectActions(projectId?: string) {
  return useQuery({
    queryKey: projectKeys.projectActions(projectId || ''),
    queryFn: () => projectId ? projectsApi.getProjectActions(projectId) : Promise.resolve([]),
    enabled: !!projectId,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProjectInput) => projectsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectInput }) =>
      projectsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(variables.id) });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useLinkActionsToProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, actionIds }: { projectId: string; actionIds: string[] }) =>
      projectsApi.linkActions(projectId, actionIds),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.projectActions(variables.projectId) });
      queryClient.invalidateQueries({ queryKey: actionKeys.lists() });
    },
  });
}

// ==================== Actions Hooks ====================

export function useActions(filters?: {
  status?: string;
  pilote_id?: string;
  project_id?: string;
  overdue?: boolean;
  search?: string;
}) {
  return useQuery({
    queryKey: actionKeys.list(filters),
    queryFn: () => actionsApi.getAll(filters),
  });
}

export function useAction(id: string) {
  return useQuery({
    queryKey: actionKeys.detail(id),
    queryFn: () => actionsApi.getById(id),
    enabled: !!id,
  });
}

export function useActionStats() {
  return useQuery({
    queryKey: actionKeys.stats(),
    queryFn: () => actionsApi.getStats(),
  });
}

export function useCreateAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateActionInput) => actionsApi.create(data),
    onSuccess: (newAction) => {
      queryClient.invalidateQueries({ queryKey: actionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: actionKeys.stats() });
      // If action is linked to a project, invalidate project queries too
      if (newAction.project_id) {
        queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
        queryClient.invalidateQueries({ queryKey: projectKeys.projectActions(newAction.project_id) });
      }
    },
  });
}

export function useUpdateAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateActionInput }) =>
      actionsApi.update(id, data),
    onSuccess: (updatedAction, variables) => {
      queryClient.invalidateQueries({ queryKey: actionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: actionKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: actionKeys.stats() });
      // Invalidate project queries if action is linked to a project
      if (updatedAction.project_id) {
        queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
        queryClient.invalidateQueries({ queryKey: projectKeys.projectActions(updatedAction.project_id) });
      }
    },
  });
}

export function useDeleteAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => actionsApi.delete(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: actionKeys.lists() });
      queryClient.invalidateQueries({ queryKey: actionKeys.stats() });
      // If deleted action was linked to a project, invalidate project queries
      if (result.action.project_id) {
        queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
        queryClient.invalidateQueries({ queryKey: projectKeys.projectActions(result.action.project_id) });
      }
    },
  });
}
