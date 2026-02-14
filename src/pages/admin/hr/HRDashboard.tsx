import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePermission } from '@/hooks/usePermission';
import {
  BarChart3,
  Users,
  Clock,
  CalendarDays,
  AlertTriangle,
  Download,
  TrendingUp,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface HRStats {
  employees: {
    total_employees: string;
    active_employees: string;
    on_leave: string;
    suspended: string;
    new_hires_this_month: string;
  };
  attendance: {
    employees_with_records: string;
    avg_hours_per_day: string;
    total_late: string;
    total_absent: string;
  };
  leaves: {
    total_requests: string;
    pending_requests: string;
    approved_requests: string;
    total_days_requested: string;
  };
  overtime: {
    total_requests: string;
    total_hours_requested: string;
    pending_approval: string;
  };
  period: {
    year: number;
    month: number;
  };
}

interface Alert {
  expiring_contracts: Array<{
    id: string;
    end_date: string;
    employee_name: string;
    employee_number: string;
    contract_type: string;
  }>;
  attendance_anomalies: Array<{
    id: string;
    attendance_date: string;
    anomaly_type: string;
    employee_name: string;
    employee_number: string;
  }>;
  pending_leave_approvals: Array<{
    id: string;
    start_date: string;
    end_date: string;
    days_requested: string;
    current_approver_level: string;
    employee_name: string;
    employee_number: string;
    leave_type: string;
  }>;
  pending_overtime_approvals: Array<{
    id: string;
    request_date: string;
    estimated_hours: string;
    priority: string;
    employee_name: string;
    employee_number: string;
  }>;
}

export default function HRDashboard() {
  const { hr } = usePermission();
  const [selectedPeriod] = useState(new Date());

  // Fetch HR statistics
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['hr-dashboard-stats'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: HRStats }>('/hr/dashboard/stats');
      return (response as any).data;
    },
  });

  // Fetch alerts
  const { data: alertsData, isLoading: alertsLoading } = useQuery({
    queryKey: ['hr-dashboard-alerts'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Alert }>('/hr/dashboard/alerts');
      return (response as any).data;
    },
  });

  const stats = statsData;
  const alerts = alertsData;

  const getMonthName = (month: number) => {
    const months = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
    ];
    return months[month - 1];
  };

  const handleExportMonthly = async () => {
    try {
      const year = selectedPeriod.getFullYear();
      const month = selectedPeriod.getMonth() + 1;
      const url = `/hr/dashboard/monthly-summary/${year}/${month}?format=csv`;
      window.open(`${import.meta.env.VITE_API_URL || '/api'}${url}`, '_blank');
    } catch (error) {
      console.error('Export error:', error);
    }
  };

  if (statsLoading || alertsLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-7 w-7 text-blue-600" />
              Tableau de bord RH
            </h1>
            <p className="text-gray-600 mt-1">
              Vue d'ensemble et indicateurs clés - {stats && getMonthName(stats.period.month)} {stats?.period.year}
            </p>
          </div>
          {hr.canExportPayroll && (
            <button
              onClick={handleExportMonthly}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="h-5 w-5" />
              Exporter Rapport
            </button>
          )}
        </div>

        {/* KPIs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Employees KPI */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Effectif Total</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {stats?.employees.total_employees || '0'}
                </p>
                <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  +{stats?.employees.new_hires_this_month || '0'} ce mois
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-500">
              {stats?.employees.active_employees || '0'} actifs • {stats?.employees.on_leave || '0'} en congé
            </div>
          </div>

          {/* Attendance KPI */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Présence Moyenne</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {parseFloat(stats?.attendance.avg_hours_per_day || '0').toFixed(1)}h
                </p>
                <p className="text-xs text-gray-600 mt-2">
                  par jour
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <Clock className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-500">
              {stats?.attendance.total_late || '0'} retards • {stats?.attendance.total_absent || '0'} absences
            </div>
          </div>

          {/* Leaves KPI */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Demandes de Congés</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {stats?.leaves.total_requests || '0'}
                </p>
                <p className="text-xs text-yellow-600 mt-2 flex items-center gap-1">
                  {stats?.leaves.pending_requests || '0'} en attente
                </p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <CalendarDays className="h-8 w-8 text-purple-600" />
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-500">
              {stats?.leaves.total_days_requested || '0'} jours demandés
            </div>
          </div>

          {/* Overtime KPI */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Heures Supplémentaires</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">
                  {parseFloat(stats?.overtime.total_hours_requested || '0').toFixed(0)}h
                </p>
                <p className="text-xs text-yellow-600 mt-2">
                  {stats?.overtime.pending_approval || '0'} à valider
                </p>
              </div>
              <div className="bg-orange-100 p-3 rounded-lg">
                <TrendingUp className="h-8 w-8 text-orange-600" />
              </div>
            </div>
            <div className="mt-4 text-xs text-gray-500">
              {stats?.overtime.total_requests || '0'} demandes
            </div>
          </div>
        </div>

        {/* Alerts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Expiring Contracts */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Contrats Expirant (30 jours)
              </h3>
            </div>
            <div className="p-4">
              {alerts?.expiring_contracts && alerts.expiring_contracts.length > 0 ? (
                <div className="space-y-3">
                  {alerts.expiring_contracts.slice(0, 5).map((contract: any) => (
                    <div key={contract.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{contract.employee_name}</p>
                        <p className="text-sm text-gray-600">
                          {contract.employee_number} • {contract.contract_type}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-orange-600">
                          {new Date(contract.end_date).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">Aucun contrat expirant</p>
              )}
            </div>
          </div>

          {/* Attendance Anomalies */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                Anomalies de Présence
              </h3>
            </div>
            <div className="p-4">
              {alerts?.attendance_anomalies && alerts.attendance_anomalies.length > 0 ? (
                <div className="space-y-3">
                  {alerts.attendance_anomalies.slice(0, 5).map((anomaly: any) => (
                    <div key={anomaly.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{anomaly.employee_name}</p>
                        <p className="text-sm text-gray-600">
                          {anomaly.anomaly_type.replace('_', ' ')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-red-600">
                          {new Date(anomaly.attendance_date).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">Aucune anomalie</p>
              )}
            </div>
          </div>

          {/* Pending Leave Approvals */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-purple-500" />
                Congés en Attente
              </h3>
            </div>
            <div className="p-4">
              {alerts?.pending_leave_approvals && alerts.pending_leave_approvals.length > 0 ? (
                <div className="space-y-3">
                  {alerts.pending_leave_approvals.slice(0, 5).map((leave: any) => (
                    <div key={leave.id} className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{leave.employee_name}</p>
                        <p className="text-sm text-gray-600">
                          {leave.leave_type} • {leave.days_requested} jours
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-purple-600 font-medium">
                          Niveau: {leave.current_approver_level}
                        </p>
                        <p className="text-xs text-gray-600">
                          {new Date(leave.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">Aucune demande en attente</p>
              )}
            </div>
          </div>

          {/* Pending Overtime */}
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-blue-500" />
                Heures Sup. en Attente
              </h3>
            </div>
            <div className="p-4">
              {alerts?.pending_overtime_approvals && alerts.pending_overtime_approvals.length > 0 ? (
                <div className="space-y-3">
                  {alerts.pending_overtime_approvals.slice(0, 5).map((overtime: any) => (
                    <div key={overtime.id} className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{overtime.employee_name}</p>
                        <p className="text-sm text-gray-600">
                          {overtime.estimated_hours}h • Priorité: {overtime.priority}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-blue-600">
                          {new Date(overtime.request_date).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-gray-500 py-4">Aucune demande en attente</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
