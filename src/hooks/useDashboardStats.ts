import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

export interface DashboardStats {
  statusStats: {
    total: number;
    brouillon: number;
    a_declarer: number;
    soumise: number;
    en_cours: number;
    approuvee: number;
    refusee: number;
  };
  alerts: {
    expired: {
      total: number;
      critical: number;
      warning: number;
      info: number;
    };
    expiring: number;
    lateProcessing: number;
  };
  metrics: {
    approvalRate: number;
    avgProcessingTime: number;
    totalRevenue: number;
  };
  rankings: {
    topSegments: Array<{ name: string; count: string }>;
    topCities: Array<{ name: string; count: string }>;
    topProfessors: Array<{ full_name: string; count: string }>;
  };
}

export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      return apiClient.get<DashboardStats>('/admin/dashboard-stats');
    },
    refetchInterval: 30000, // Rafraîchir toutes les 30 secondes
  });
}
