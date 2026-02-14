import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePermission } from '@/hooks/usePermission';
import {
  CalendarDays,
  Plus,
  Clock,
  TrendingUp,
  Search,
  Calendar,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import LeaveRequestFormModal from '@/components/admin/hr/LeaveRequestFormModal';
import LeaveApprovalModal from '@/components/admin/hr/LeaveApprovalModal';

interface LeaveRequest {
  id: string;
  employee_name: string;
  employee_number: string;
  leave_type: string;
  leave_type_color: string;
  start_date: string;
  end_date: string;
  days_requested: string;
  status: string;
  current_approver_level: string;
  reason: string;
}

interface Holiday {
  id: string;
  name: string;
  holiday_date: string;
  holiday_type: string;
  description: string;
}

export default function HRLeaves() {
  const { hr } = usePermission();
  const [activeTab, setActiveTab] = useState<'requests' | 'balances' | 'calendar' | 'holidays'>('requests');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showLeaveRequestModal, setShowLeaveRequestModal] = useState(false);
  const [showLeaveApprovalModal, setShowLeaveApprovalModal] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  // Fetch leave requests
  const { data: requestsData, isLoading: requestsLoading } = useQuery({
    queryKey: ['hr-leave-requests', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);

      const response = await apiClient.get<{ success: boolean; data: LeaveRequest[] }>(`/hr/leaves/requests?${params.toString()}`);
      return (response as any).data;
    },
    enabled: activeTab === 'requests',
  });

  // Fetch holidays
  const { data: holidaysData } = useQuery({
    queryKey: ['hr-holidays'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Holiday[] }>('/hr/leaves/holidays');
      return (response as any).data;
    },
    enabled: activeTab === 'holidays',
  });

  const requests = requestsData || [];
  const holidays = holidaysData || [];

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved_n1: 'bg-blue-100 text-blue-800',
      approved_n2: 'bg-indigo-100 text-indigo-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    const labels: Record<string, string> = {
      pending: 'En attente',
      approved_n1: 'Approuvé N+1',
      approved_n2: 'Approuvé N+2',
      approved: 'Approuvé',
      rejected: 'Rejeté',
      cancelled: 'Annulé',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getHolidayTypeBadge = (type: string) => {
    const styles: Record<string, string> = {
      paid: 'bg-green-100 text-green-800',
      unpaid: 'bg-gray-100 text-gray-800',
      worked_with_bonus: 'bg-purple-100 text-purple-800',
      optional: 'bg-blue-100 text-blue-800',
    };
    const labels: Record<string, string> = {
      paid: 'Payé',
      unpaid: 'Non payé',
      worked_with_bonus: 'Travaillé avec prime',
      optional: 'Optionnel',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[type] || styles.paid}`}>
        {labels[type] || type}
      </span>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <CalendarDays className="h-7 w-7 text-blue-600" />
              Congés & Planning
            </h1>
            <p className="text-gray-600 mt-1">
              Gestion des demandes de congés, soldes et jours fériés
            </p>
          </div>
          {hr.canRequestLeave && (
            <button
              onClick={() => setShowLeaveRequestModal(true)}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-5 w-5" />
              Nouvelle Demande
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('requests')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'requests'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <CalendarDays className="h-4 w-4 inline mr-2" />
              Demandes de Congés
            </button>
            <button
              onClick={() => setActiveTab('balances')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'balances'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <TrendingUp className="h-4 w-4 inline mr-2" />
              Soldes de Congés
            </button>
            <button
              onClick={() => setActiveTab('calendar')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'calendar'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Calendar className="h-4 w-4 inline mr-2" />
              Calendrier
            </button>
            <button
              onClick={() => setActiveTab('holidays')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'holidays'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Clock className="h-4 w-4 inline mr-2" />
              Jours Fériés
            </button>
          </nav>
        </div>

        {/* Filters */}
        {activeTab === 'requests' && (
          <div className="bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un employé..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 w-full border border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Tous les statuts</option>
                  <option value="pending">En attente</option>
                  <option value="approved_n1">Approuvé N+1</option>
                  <option value="approved_n2">Approuvé N+2</option>
                  <option value="approved">Approuvé</option>
                  <option value="rejected">Rejeté</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Content - Requests Tab */}
        {activeTab === 'requests' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {requestsLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Chargement...</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="p-8 text-center">
                <CalendarDays className="h-12 w-12 text-gray-400 mx-auto" />
                <p className="mt-2 text-gray-600">Aucune demande de congé trouvée</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Employé
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type de Congé
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Période
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Jours
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Niveau
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {requests.map((request: LeaveRequest) => (
                      <tr
                        key={request.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          setSelectedRequestId(request.id);
                          setShowLeaveApprovalModal(true);
                        }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{request.employee_name}</div>
                          <div className="text-sm text-gray-500">{request.employee_number}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: request.leave_type_color }}
                            ></div>
                            <span className="text-sm text-gray-900">{request.leave_type}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div>
                            {new Date(request.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                            {' → '}
                            {new Date(request.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {request.days_requested}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(request.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {request.current_approver_level}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            className="text-blue-600 hover:text-blue-900"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRequestId(request.id);
                              setShowLeaveApprovalModal(true);
                            }}
                          >
                            Voir détails
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Content - Balances Tab */}
        {activeTab === 'balances' && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <TrendingUp className="h-12 w-12 text-gray-400 mx-auto" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">Soldes de Congés</h3>
            <p className="mt-2 text-gray-600">
              Cette fonctionnalité affichera les soldes de congés par employé.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Sélectionnez un employé pour voir ses soldes détaillés.
            </p>
          </div>
        )}

        {/* Content - Calendar Tab */}
        {activeTab === 'calendar' && (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">Calendrier des Congés</h3>
            <p className="mt-2 text-gray-600">
              Cette fonctionnalité affichera un calendrier visuel des congés approuvés.
            </p>
          </div>
        )}

        {/* Content - Holidays Tab */}
        {activeTab === 'holidays' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                Jours Fériés {new Date().getFullYear()}
              </h3>
              {hr.canManageHolidays && (
                <button className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700">
                  <Plus className="h-4 w-4" />
                  Ajouter
                </button>
              )}
            </div>
            <div className="divide-y divide-gray-200">
              {holidays.map((holiday: Holiday) => (
                <div key={holiday.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-5 w-5 text-blue-500" />
                        <div>
                          <p className="font-medium text-gray-900">{holiday.name}</p>
                          {holiday.description && (
                            <p className="text-sm text-gray-600">{holiday.description}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-900">
                          {new Date(holiday.holiday_date).toLocaleDateString('fr-FR', {
                            weekday: 'long',
                            day: 'numeric',
                            month: 'long',
                          })}
                        </p>
                      </div>
                      {getHolidayTypeBadge(holiday.holiday_type)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Leave Request Form Modal */}
        {showLeaveRequestModal && (
          <LeaveRequestFormModal
            onClose={() => setShowLeaveRequestModal(false)}
          />
        )}

        {/* Leave Approval Modal */}
        {showLeaveApprovalModal && selectedRequestId && (
          <LeaveApprovalModal
            requestId={selectedRequestId}
            onClose={() => {
              setShowLeaveApprovalModal(false);
              setSelectedRequestId(null);
            }}
          />
        )}
      </div>
    </AppLayout>
  );
}
