/**
 * API Client for Projects and Actions (Gestion de Projet)
 */

import { apiClient } from './client';

// ==================== Types ====================

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: 'planning' | 'in_progress' | 'completed' | 'archived';
  priority: 'normale' | 'haute' | 'urgente';
  start_date?: string;
  end_date?: string;
  budget?: number;
  manager_id?: string;
  segment_id?: string;
  city_id?: string;
  color?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  manager_name?: string;
  segment_name?: string;
  city_name?: string;
  created_by_name?: string;
  total_actions?: number;
  completed_actions?: number;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  status?: string;
  priority?: string;
  start_date?: string;
  end_date?: string;
  budget?: number;
  manager_id?: string;
  segment_id?: string;
  city_id?: string;
  color?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: string;
  priority?: string;
  start_date?: string;
  end_date?: string;
  budget?: number;
  manager_id?: string;
  segment_id?: string;
  city_id?: string;
  color?: string;
}

export interface ProjectAction {
  id: string;
  project_id?: string;
  description: string;
  description_detail?: string;
  pilote_id: string;
  assigned_by: string;
  date_assignment: string;
  deadline?: string;
  status: 'a_faire' | 'en_cours' | 'termine';
  commentaire?: string;
  segment_id?: string;
  city_id?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  pilote_name?: string;
  assigned_by_name?: string;
  project_name?: string;
  segment_name?: string;
  city_name?: string;
}

export interface CreateActionInput {
  description: string;
  description_detail?: string;
  pilote_id: string;
  deadline?: string;
  commentaire?: string;
  project_id?: string;
  segment_id?: string;
  city_id?: string;
}

export interface UpdateActionInput {
  description?: string;
  description_detail?: string;
  pilote_id?: string;
  deadline?: string;
  status?: string;
  commentaire?: string;
  project_id?: string | null;
}

export interface ActionStats {
  total: number;
  completed: number;
  in_progress: number;
  todo: number;
  overdue: number;
  due_soon: number;
  top_pilotes: Array<{
    id: string;
    full_name: string;
    pending_actions: number;
    completed_actions: number;
  }>;
}

// ==================== Projects API ====================

export const projectsApi = {
  // GET all projects
  async getAll(filters?: {
    status?: string;
    priority?: string;
    manager_id?: string;
    search?: string;
  }): Promise<Project[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.priority) params.append('priority', filters.priority);
    if (filters?.manager_id) params.append('manager_id', filters.manager_id);
    if (filters?.search) params.append('search', filters.search);

    const queryString = params.toString();
    const url = queryString ? `/projects?${queryString}` : '/projects';
    return apiClient.get<Project[]>(url);
  },

  // GET single project
  async getById(id: string): Promise<Project> {
    return apiClient.get<Project>(`/projects/${id}`);
  },

  // POST create project
  async create(data: CreateProjectInput): Promise<Project> {
    return apiClient.post<Project>('/projects', data);
  },

  // PUT update project
  async update(id: string, data: UpdateProjectInput): Promise<Project> {
    return apiClient.put<Project>(`/projects/${id}`, data);
  },

  // DELETE project
  async delete(id: string): Promise<{ message: string; project: Project }> {
    return apiClient.delete<{ message: string; project: Project }>(`/projects/${id}`);
  },

  // GET project's actions
  async getProjectActions(projectId: string): Promise<ProjectAction[]> {
    return apiClient.get<ProjectAction[]>(`/projects/${projectId}/actions`);
  },

  // POST link actions to project
  async linkActions(projectId: string, actionIds: string[]): Promise<Project> {
    return apiClient.post<Project>(`/projects/${projectId}/link-actions`, { action_ids: actionIds });
  },
};

// ==================== Actions API ====================

export const actionsApi = {
  // GET all actions
  async getAll(filters?: {
    status?: string;
    pilote_id?: string;
    project_id?: string;
    overdue?: boolean;
    search?: string;
  }): Promise<ProjectAction[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.pilote_id) params.append('pilote_id', filters.pilote_id);
    if (filters?.project_id) params.append('project_id', filters.project_id);
    if (filters?.overdue) params.append('overdue', 'true');
    if (filters?.search) params.append('search', filters.search);

    const queryString = params.toString();
    const url = queryString ? `/projects/actions/list?${queryString}` : '/projects/actions/list';
    return apiClient.get<ProjectAction[]>(url);
  },

  // GET actions stats for dashboard
  async getStats(): Promise<ActionStats> {
    return apiClient.get<ActionStats>('/projects/actions/stats');
  },

  // GET single action
  async getById(id: string): Promise<ProjectAction> {
    return apiClient.get<ProjectAction>(`/projects/actions/${id}`);
  },

  // POST create action
  async create(data: CreateActionInput): Promise<ProjectAction> {
    return apiClient.post<ProjectAction>('/projects/actions', data);
  },

  // PUT update action
  async update(id: string, data: UpdateActionInput): Promise<ProjectAction> {
    return apiClient.put<ProjectAction>(`/projects/actions/${id}`, data);
  },

  // DELETE action
  async delete(id: string): Promise<{ message: string; action: ProjectAction }> {
    return apiClient.delete<{ message: string; action: ProjectAction }>(`/projects/actions/${id}`);
  },
};
