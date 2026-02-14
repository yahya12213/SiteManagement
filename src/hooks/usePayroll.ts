/**
 * Hooks React Query - Gestion de Paie (Payroll Management)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  payrollApi,
  type CreatePeriodInput,
  type CalculatePayrollOptions,
} from '../lib/api/payroll';

// ============================================================
// PERIODS HOOKS
// ============================================================

/**
 * Hook pour récupérer les périodes de paie
 */
export const usePayrollPeriods = (filters?: { year?: number; status?: string }) => {
  return useQuery({
    queryKey: ['payroll', 'periods', filters],
    queryFn: () => payrollApi.getPeriods(filters),
  });
};

/**
 * Hook pour récupérer une période spécifique
 */
export const usePayrollPeriod = (id: string) => {
  return useQuery({
    queryKey: ['payroll', 'periods', id],
    queryFn: () => payrollApi.getPeriod(id),
    enabled: !!id,
  });
};

/**
 * Hook pour créer une période de paie
 */
export const useCreatePeriod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePeriodInput) => payrollApi.createPeriod(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'periods'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'stats'] });
    },
  });
};

/**
 * Hook pour mettre à jour une période
 */
export const useUpdatePeriod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreatePeriodInput> }) =>
      payrollApi.updatePeriod(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'periods'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'periods', variables.id] });
    },
  });
};

/**
 * Hook pour supprimer une période
 */
export const useDeletePeriod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => payrollApi.deletePeriod(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'periods'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'stats'] });
    },
  });
};

/**
 * Hook pour ouvrir une période
 */
export const useOpenPeriod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => payrollApi.openPeriod(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'periods'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'periods', id] });
    },
  });
};

/**
 * Hook pour clôturer une période
 */
export const useClosePeriod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => payrollApi.closePeriod(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'periods'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'periods', id] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'logs'] });
    },
  });
};

// ============================================================
// EMPLOYEES HOOKS
// ============================================================

/**
 * Hook pour récupérer les employés éligibles au calcul de paie
 */
export const usePayrollEmployees = (filters?: { search?: string; segment_id?: string }) => {
  return useQuery({
    queryKey: ['payroll', 'employees', filters],
    queryFn: () => payrollApi.getPayrollEmployees(filters),
  });
};

/**
 * Hook pour récupérer le compteur d'employés par segment
 */
export const useEmployeeCountsBySegment = () => {
  return useQuery({
    queryKey: ['payroll', 'employees', 'counts-by-segment'],
    queryFn: () => payrollApi.getEmployeeCountsBySegment(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

// ============================================================
// CALCULATION HOOKS
// ============================================================

/**
 * Hook pour lancer le calcul de paie
 */
export const useCalculatePayroll = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ periodId, options }: { periodId: string; options?: CalculatePayrollOptions }) =>
      payrollApi.calculatePayroll(periodId, options),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'periods', variables.periodId] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'payslips'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'logs'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'stats'] });
    },
  });
};

/**
 * Hook pour supprimer les calculs de paie d'une période
 */
export const useResetPayrollCalculations = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (periodId: string) => payrollApi.resetPayrollCalculations(periodId),
    onSuccess: (_, periodId) => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'periods'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'periods', periodId] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'payslips'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'logs'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'stats'] });
    },
  });
};

// ============================================================
// PAYSLIPS HOOKS
// ============================================================

/**
 * Hook pour récupérer les bulletins de paie
 */
export const usePayslips = (filters?: { period_id?: string; employee_id?: string; status?: string }) => {
  return useQuery({
    queryKey: ['payroll', 'payslips', filters],
    queryFn: () => payrollApi.getPayslips(filters),
    enabled: !filters?.period_id || !!filters.period_id,
  });
};

/**
 * Hook pour récupérer un bulletin spécifique
 */
export const usePayslip = (id: string) => {
  return useQuery({
    queryKey: ['payroll', 'payslips', id],
    queryFn: () => payrollApi.getPayslip(id),
    enabled: !!id,
  });
};

/**
 * Hook pour valider un bulletin
 */
export const useValidatePayslip = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => payrollApi.validatePayslip(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'payslips'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'payslips', id] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'logs'] });
    },
  });
};

/**
 * Hook pour valider tous les bulletins d'une période
 */
export const useValidateAllPayslips = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (periodId: string) => payrollApi.validateAllPayslips(periodId),
    onSuccess: (_, periodId) => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'payslips'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'periods', periodId] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'logs'] });
    },
  });
};

/**
 * Hook pour télécharger un bulletin PDF
 */
export const useDownloadPayslipPdf = () => {
  return useMutation({
    mutationFn: async (id: string) => {
      const blob = await payrollApi.getPayslipPdf(id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bulletin-${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });
};

// ============================================================
// CONFIGURATION HOOKS
// ============================================================

/**
 * Hook pour récupérer la configuration
 */
export const usePayrollConfig = () => {
  return useQuery({
    queryKey: ['payroll', 'config'],
    queryFn: () => payrollApi.getConfig(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook pour mettre à jour la configuration
 */
export const useUpdatePayrollConfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ category, data }: { category: string; data: Record<string, unknown> }) =>
      payrollApi.updateConfig(category, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'config'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', 'logs'] });
    },
  });
};

// ============================================================
// AUDIT LOGS HOOKS
// ============================================================

/**
 * Hook pour récupérer les logs d'audit
 */
export const usePayrollLogs = (filters?: { period_id?: string; action?: string; limit?: number }) => {
  return useQuery({
    queryKey: ['payroll', 'logs', filters],
    queryFn: () => payrollApi.getLogs(filters),
  });
};

// ============================================================
// EXPORT HOOKS
// ============================================================

/**
 * Hook pour exporter la déclaration CNSS
 */
export const useExportCNSS = () => {
  return useMutation({
    mutationFn: (periodId: string) => payrollApi.exportCNSS(periodId),
  });
};

/**
 * Hook pour exporter les virements bancaires
 */
export const useExportBankTransfers = () => {
  return useMutation({
    mutationFn: (periodId: string) => payrollApi.exportBankTransfers(periodId),
  });
};

/**
 * Hook pour télécharger tous les bulletins en ZIP
 */
export const useDownloadPayslipsZip = () => {
  return useMutation({
    mutationFn: async (periodId: string) => {
      const blob = await payrollApi.downloadPayslipsZip(periodId);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bulletins-${periodId}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });
};

// ============================================================
// STATS HOOKS
// ============================================================

/**
 * Hook pour récupérer les statistiques de paie
 */
export const usePayrollStats = (year?: number) => {
  return useQuery({
    queryKey: ['payroll', 'stats', year],
    queryFn: () => payrollApi.getStats(year),
  });
};
