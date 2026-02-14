import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePermission } from '@/hooks/usePermission';
import {
  Settings,
  CalendarDays,
  Clock,
  Plus,
  Edit,
  Trash2,
  Sliders,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import SettingEditorModal from '@/components/admin/hr/SettingEditorModal';
import PublicHolidaysManager from '@/components/admin/hr/PublicHolidaysManager';
import BreakRulesEditor from '@/components/admin/hr/BreakRulesEditor';

interface LeaveType {
  id: string;
  name: string;
  code: string;
  description: string;
  default_days: number;
  max_days_per_request: number;
  requires_approval: boolean;
  approval_workflow: string;
  deducts_from_balance: boolean;
  color: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
}

interface WorkSchedule {
  id: string;
  name: string;
  description: string;
  monday_start: string;
  monday_end: string;
  tuesday_start: string;
  tuesday_end: string;
  wednesday_start: string;
  wednesday_end: string;
  thursday_start: string;
  thursday_end: string;
  friday_start: string;
  friday_end: string;
  saturday_start: string;
  saturday_end: string;
  sunday_start: string;
  sunday_end: string;
  weekly_hours: number;
  tolerance_late_minutes: number;
  is_default: boolean;
  is_active: boolean;
}

interface HRSetting {
  id: string;
  setting_key: string;
  setting_value: any;
  category: string;
  description: string;
  is_editable: boolean;
}

export default function HRSettings() {
  const { hr } = usePermission();
  const [activeTab, setActiveTab] = useState<'general' | 'leave-types' | 'schedules' | 'holidays' | 'clocking'>('general');
  const [showSettingEditor, setShowSettingEditor] = useState(false);
  const [selectedSetting, setSelectedSetting] = useState<HRSetting | null>(null);

  // Fetch leave types
  const { data: leaveTypesData, isLoading: leaveTypesLoading } = useQuery({
    queryKey: ['hr-leave-types'],
    queryFn: async () => {
      const response = await apiClient.get('/hr/settings/leave-types/all');
      return (response as any).data as LeaveType[];
    },
    enabled: activeTab === 'leave-types',
  });

  // Fetch work schedules
  const { data: schedulesData, isLoading: schedulesLoading } = useQuery({
    queryKey: ['hr-work-schedules'],
    queryFn: async () => {
      const response = await apiClient.get('/hr/settings/schedules/all');
      return (response as any).data as WorkSchedule[];
    },
    enabled: activeTab === 'schedules',
  });

  // Fetch general settings
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ['hr-settings'],
    queryFn: async () => {
      const response = await apiClient.get('/hr/settings');
      return (response as any).data as HRSetting[];
    },
    enabled: activeTab === 'general' || activeTab === 'clocking',
  });

  const leaveTypes = leaveTypesData || [];
  const schedules = schedulesData || [];
  const settings = settingsData || [];

  // Group settings by category
  const settingsByCategory = settings.reduce((acc: Record<string, HRSetting[]>, setting) => {
    if (!acc[setting.category]) {
      acc[setting.category] = [];
    }
    acc[setting.category].push(setting);
    return acc;
  }, {});

  // Format setting value for display
  const formatSettingValue = (setting: HRSetting) => {
    if (setting.setting_key === 'attendance_rules') {
      const rules = setting.setting_value;
      return (
        <div className="text-sm space-y-1">
          <div><span className="text-gray-600">Tolérance retard:</span> <span className="font-medium">{rules.late_tolerance_minutes} min</span></div>
          <div><span className="text-gray-600">Tolérance départ:</span> <span className="font-medium">{rules.early_leave_tolerance_minutes} min</span></div>
          <div><span className="text-gray-600">Heures journée complète:</span> <span className="font-medium">{rules.min_hours_for_full_day}h</span></div>
          <div><span className="text-gray-600">Heures demi-journée:</span> <span className="font-medium">{rules.min_hours_for_half_day}h</span></div>
        </div>
      );
    }

    if (setting.setting_key === 'leave_rules') {
      const rules = setting.setting_value;
      return (
        <div className="text-sm space-y-1">
          <div><span className="text-gray-600">Congés annuels max:</span> <span className="font-medium">{rules.annual_leave_max_days} jours</span></div>
          <div><span className="text-gray-600">Taux accumulation:</span> <span className="font-medium">{rules.annual_leave_accrual_rate} j/mois</span></div>
          <div><span className="text-gray-600">Report autorisé:</span> <span className="font-medium">{rules.carry_over_allowed ? 'Oui' : 'Non'}</span></div>
          <div><span className="text-gray-600">Préavis minimum:</span> <span className="font-medium">{rules.min_advance_notice_days} jours</span></div>
        </div>
      );
    }

    // Fallback for other settings
    return <div className="text-sm text-gray-700">{JSON.stringify(setting.setting_value)}</div>;
  };

  const handleEditSetting = (setting: HRSetting) => {
    setSelectedSetting(setting);
    setShowSettingEditor(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Settings className="h-7 w-7 text-blue-600" />
              Paramètres RH
            </h1>
            <p className="text-gray-600 mt-1">
              Configuration des paramètres, types de congés et horaires de travail
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('general')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'general'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Sliders className="h-4 w-4 inline mr-2" />
              Paramètres Généraux
            </button>
            <button
              onClick={() => setActiveTab('leave-types')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'leave-types'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <CalendarDays className="h-4 w-4 inline mr-2" />
              Types de Congés
            </button>
            <button
              onClick={() => setActiveTab('schedules')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'schedules'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Clock className="h-4 w-4 inline mr-2" />
              Horaires de Travail
            </button>
            <button
              onClick={() => setActiveTab('holidays')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'holidays'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <CalendarDays className="h-4 w-4 inline mr-2" />
              Jours Fériés
            </button>
            <button
              onClick={() => setActiveTab('clocking')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'clocking'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Clock className="h-4 w-4 inline mr-2" />
              Pointage & Pauses
            </button>
          </nav>
        </div>

        {/* Content - General Settings */}
        {activeTab === 'general' && (
          <div className="space-y-6">
            {settingsLoading ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Chargement...</p>
              </div>
            ) : (
              Object.keys(settingsByCategory).map((category) => (
                <div key={category} className="bg-white rounded-lg shadow">
                  <div className="p-4 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 capitalize">
                      {category.replace('_', ' ')}
                    </h3>
                  </div>
                  <div className="p-4 space-y-4">
                    {settingsByCategory[category].map((setting) => (
                      <div key={setting.id} className="py-4 border-b border-gray-100 last:border-0">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{setting.setting_key}</p>
                            {setting.description && (
                              <p className="text-sm text-gray-600 mt-1">{setting.description}</p>
                            )}
                          </div>
                          {setting.is_editable && hr.canUpdateSettings && (
                            <button
                              onClick={() => handleEditSetting(setting)}
                              className="text-blue-600 hover:text-blue-900 flex items-center gap-1 text-sm"
                            >
                              <Edit className="h-4 w-4" />
                              Modifier
                            </button>
                          )}
                        </div>
                        <div className="bg-gray-50 px-4 py-3 rounded-lg">
                          {formatSettingValue(setting)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Content - Leave Types */}
        {activeTab === 'leave-types' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Types de Congés</h3>
              {hr.canManageLeaveTypes && (
                <button className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700">
                  <Plus className="h-4 w-4" />
                  Ajouter un Type
                </button>
              )}
            </div>
            {leaveTypesLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Chargement...</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Code
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Jours par défaut
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Workflow
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Déduit du solde
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statut
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {leaveTypes.map((type: LeaveType) => (
                      <tr key={type.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: type.color }}
                            ></div>
                            <div>
                              <div className="font-medium text-gray-900">{type.name}</div>
                              {type.description && (
                                <div className="text-sm text-gray-500">{type.description}</div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                          {type.code}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {type.default_days} jours
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {type.approval_workflow.toUpperCase()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {type.deducts_from_balance ? (
                            <span className="text-green-600 text-sm">✓ Oui</span>
                          ) : (
                            <span className="text-gray-400 text-sm">✗ Non</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            type.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                          }`}>
                            {type.is_active ? 'Actif' : 'Inactif'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {hr.canManageLeaveTypes && (
                            <div className="flex justify-end gap-2">
                              <button className="text-blue-600 hover:text-blue-900">
                                <Edit className="h-4 w-4" />
                              </button>
                              <button className="text-red-600 hover:text-red-900">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Content - Work Schedules */}
        {activeTab === 'schedules' && (
          <div className="bg-white rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">Horaires de Travail</h3>
              {hr.canManageSchedules && (
                <button className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700">
                  <Plus className="h-4 w-4" />
                  Ajouter un Horaire
                </button>
              )}
            </div>
            {schedulesLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Chargement...</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {schedules.map((schedule: WorkSchedule) => (
                  <div key={schedule.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-4">
                          <Clock className="h-5 w-5 text-blue-500" />
                          <div>
                            <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                              {schedule.name}
                              {schedule.is_default && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                                  Par défaut
                                </span>
                              )}
                            </h4>
                            {schedule.description && (
                              <p className="text-sm text-gray-600">{schedule.description}</p>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-3 md:grid-cols-7 gap-3 text-sm">
                          {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => {
                            const startKey = `${day}_start` as keyof WorkSchedule;
                            const endKey = `${day}_end` as keyof WorkSchedule;
                            const start = schedule[startKey];
                            const end = schedule[endKey];

                            return (
                              <div key={day} className="bg-gray-50 p-2 rounded">
                                <p className="font-medium text-gray-700 capitalize text-xs mb-1">
                                  {day.substring(0, 3)}
                                </p>
                                {start && end ? (
                                  <p className="text-gray-900 text-xs">
                                    {start} - {end}
                                  </p>
                                ) : (
                                  <p className="text-gray-400 text-xs">Repos</p>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        <div className="mt-4 flex gap-6 text-sm text-gray-600">
                          <span>
                            <strong>Heures/semaine:</strong> {schedule.weekly_hours}h
                          </span>
                          <span>
                            <strong>Tolérance retard:</strong> {schedule.tolerance_late_minutes} min
                          </span>
                        </div>
                      </div>

                      {hr.canManageSchedules && (
                        <div className="flex gap-2 ml-4">
                          <button className="text-blue-600 hover:text-blue-900">
                            <Edit className="h-4 w-4" />
                          </button>
                          {!schedule.is_default && (
                            <button className="text-red-600 hover:text-red-900">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Content - Public Holidays */}
        {activeTab === 'holidays' && (
          <div className="space-y-6">
            <PublicHolidaysManager />
          </div>
        )}

        {/* Content - Clocking & Break Rules */}
        {activeTab === 'clocking' && (
          <div className="space-y-6">
            {/* Break Rules Editor */}
            {settingsLoading ? (
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Chargement...</p>
              </div>
            ) : (
              settingsData?.find((s: HRSetting) => s.setting_key === 'break_rules') && (
                <BreakRulesEditor
                  currentRules={settingsData.find((s: HRSetting) => s.setting_key === 'break_rules')!.setting_value}
                />
              )
            )}
          </div>
        )}
      </div>

      {/* Setting Editor Modal */}
      {showSettingEditor && selectedSetting && (
        <SettingEditorModal
          settingKey={selectedSetting.setting_key}
          settingName={selectedSetting.setting_key}
          currentValue={selectedSetting.setting_value}
          onClose={() => {
            setShowSettingEditor(false);
            setSelectedSetting(null);
          }}
        />
      )}
    </AppLayout>
  );
}
