import { apiClient } from './client';

// Types for hierarchical permission system
export interface Permission {
  id: string;
  module: string;
  menu: string;
  action: string;
  code: string;
  label: string;
  description?: string;
  sort_order: number;
  created_at: string;
}

export interface PermissionAction {
  id: string;
  action: string;
  code: string;
  label: string;
  actionLabel: string;
  description?: string;
}

export interface PermissionMenu {
  id: string;
  label: string;
  actions: PermissionAction[];
}

export interface PermissionModule {
  id: string;
  label: string;
  menus: PermissionMenu[];
}

export interface PermissionTreeResponse {
  success: boolean;
  data: PermissionModule[];
  labels: {
    modules: Record<string, string>;
    menus: Record<string, string>;
    actions: Record<string, string>;
  };
}

export interface RolePermissionsResponse {
  success: boolean;
  data: Permission[];
  codes: string[];
}

export interface PermissionStats {
  byModule: Array<{
    module: string;
    permission_count: string;
    menu_count: string;
  }>;
  totals: {
    permissions: number;
    roles: number;
    assignments: number;
  };
}

// API client for permissions
export const permissionsApi = {
  // Get all permissions (flat list)
  async getAll(): Promise<Permission[]> {
    const response = await apiClient.get<{ success: boolean; data: Permission[] }>('/permissions');
    return response.data;
  },

  // Get permissions in tree structure (for role management UI)
  async getTree(): Promise<PermissionTreeResponse> {
    return apiClient.get<PermissionTreeResponse>('/permissions/tree');
  },

  // Get permissions for a specific role
  async getByRole(roleId: string): Promise<RolePermissionsResponse> {
    return apiClient.get<RolePermissionsResponse>(`/permissions/by-role/${roleId}`);
  },

  // Update all permissions for a role
  async updateRolePermissions(roleId: string, permissionIds: string[]): Promise<{ success: boolean; message: string }> {
    return apiClient.put(`/permissions/role/${roleId}`, { permissionIds });
  },

  // Get permissions for a user (from all their roles)
  async getUserPermissions(userId: string): Promise<string[]> {
    const response = await apiClient.get<{ success: boolean; data: string[] }>(`/permissions/user/${userId}`);
    return response.data;
  },

  // Get permission statistics
  async getStats(): Promise<PermissionStats> {
    const response = await apiClient.get<{ success: boolean; data: PermissionStats }>('/permissions/stats');
    return response.data;
  },
};

// Helper functions for permission codes
export const permissionHelpers = {
  // Check if a permission code is a view_page permission
  isViewPagePermission(code: string): boolean {
    return code.endsWith('.view_page');
  },

  // Extract module from permission code
  getModule(code: string): string {
    return code.split('.')[0] || '';
  },

  // Extract menu from permission code
  getMenu(code: string): string {
    return code.split('.')[1] || '';
  },

  // Extract action from permission code
  getAction(code: string): string {
    return code.split('.')[2] || '';
  },

  // Build a permission code
  buildCode(module: string, menu: string, action: string): string {
    return `${module}.${menu}.${action}`;
  },

  // Get all view_page permissions from a list
  getViewPagePermissions(codes: string[]): string[] {
    return codes.filter(code => code.endsWith('.view_page'));
  },

  // Group permissions by module
  groupByModule(permissions: Permission[]): Record<string, Permission[]> {
    return permissions.reduce((acc, perm) => {
      if (!acc[perm.module]) {
        acc[perm.module] = [];
      }
      acc[perm.module].push(perm);
      return acc;
    }, {} as Record<string, Permission[]>);
  },

  // Group permissions by menu within a module
  groupByMenu(permissions: Permission[]): Record<string, Permission[]> {
    return permissions.reduce((acc, perm) => {
      const key = `${perm.module}.${perm.menu}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(perm);
      return acc;
    }, {} as Record<string, Permission[]>);
  },
};
