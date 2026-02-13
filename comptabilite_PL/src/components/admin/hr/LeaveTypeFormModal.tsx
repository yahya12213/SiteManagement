import { useState, useEffect } from 'react';
import { X, Tag, Palette, Calendar, CheckCircle, FileText } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface LeaveTypeFormModalProps {
  leaveTypeId?: string | null;
  onClose: () => void;
}

interface LeaveType {
  id: string;
  code: string;
  name: string;
  description?: string;
  color: string;
  is_paid: boolean;
  max_days_per_year?: number;
  max_days_per_request?: number;
  min_days_per_request: number;
  requires_justification: boolean;
  can_carry_forward: boolean;
  is_active: boolean;
}

const PRESET_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#6366F1', // indigo
];

export default function LeaveTypeFormModal({ leaveTypeId, onClose }: LeaveTypeFormModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    description: '',
    color: PRESET_COLORS[0],
    is_paid: true,
    max_days_per_year: '',
    max_days_per_request: '',
    min_days_per_request: '1',
    requires_justification: false,
    can_carry_forward: false,
    is_active: true,
  });

  // Fetch leave type details if editing
  const { data: leaveTypeData } = useQuery({
    queryKey: ['hr-leave-type', leaveTypeId],
    queryFn: async () => {
      if (!leaveTypeId) return null;
      const response = await apiClient.get<{ success: boolean; data: LeaveType }>(`/hr/leaves/types/${leaveTypeId}`);
      return (response as any).data;
    },
    enabled: !!leaveTypeId,
  });

  // Initialize form when data loads
  useEffect(() => {
    if (leaveTypeData) {
      setFormData({
        code: leaveTypeData.code || '',
        name: leaveTypeData.name || '',
        description: leaveTypeData.description || '',
        color: leaveTypeData.color || PRESET_COLORS[0],
        is_paid: leaveTypeData.is_paid,
        max_days_per_year: leaveTypeData.max_days_per_year?.toString() || '',
        max_days_per_request: leaveTypeData.max_days_per_request?.toString() || '',
        min_days_per_request: leaveTypeData.min_days_per_request?.toString() || '1',
        requires_justification: leaveTypeData.requires_justification,
        can_carry_forward: leaveTypeData.can_carry_forward,
        is_active: leaveTypeData.is_active,
      });
    }
  }, [leaveTypeData]);

  // Create mutation
  const createLeaveType = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post<{ success: boolean; data: LeaveType }>('/hr/leaves/types', data);
      return (response as any).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-leave-types'] });
      alert('Type de congé créé avec succès');
      onClose();
    },
  });

  // Update mutation
  const updateLeaveType = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.put<{ success: boolean; data: LeaveType }>(`/hr/leaves/types/${leaveTypeId}`, data);
      return (response as any).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-leave-types'] });
      queryClient.invalidateQueries({ queryKey: ['hr-leave-type', leaveTypeId] });
      alert('Type de congé mis à jour avec succès');
      onClose();
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.code.trim() || !formData.name.trim()) {
      alert('Le code et le nom sont obligatoires');
      return;
    }

    const minDays = parseInt(formData.min_days_per_request);
    const maxDaysPerRequest = formData.max_days_per_request ? parseInt(formData.max_days_per_request) : null;
    const maxDaysPerYear = formData.max_days_per_year ? parseInt(formData.max_days_per_year) : null;

    if (maxDaysPerRequest && maxDaysPerRequest < minDays) {
      alert('Le nombre maximum de jours par demande doit être supérieur ou égal au minimum');
      return;
    }

    if (maxDaysPerYear && maxDaysPerRequest && maxDaysPerYear < maxDaysPerRequest) {
      alert('Le nombre maximum de jours par an doit être supérieur ou égal au maximum par demande');
      return;
    }

    const payload = {
      code: formData.code.trim().toUpperCase(),
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      color: formData.color,
      is_paid: formData.is_paid,
      max_days_per_year: maxDaysPerYear,
      max_days_per_request: maxDaysPerRequest,
      min_days_per_request: minDays,
      requires_justification: formData.requires_justification,
      can_carry_forward: formData.can_carry_forward,
      is_active: formData.is_active,
    };

    try {
      if (leaveTypeId) {
        await updateLeaveType.mutateAsync(payload);
      } else {
        await createLeaveType.mutateAsync(payload);
      }
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert(error.response?.data?.error || 'Erreur lors de la sauvegarde du type de congé');
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isPending = createLeaveType.isPending || updateLeaveType.isPending;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[650px] md:w-[750px] lg:w-[850px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Tag className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {leaveTypeId ? 'Modifier le type de congé' : 'Nouveau type de congé'}
              </h2>
              <p className="text-sm text-gray-500">Configuration des types de congés</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-600" />
              Informations de base
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Code * <span className="text-xs text-gray-500">(ex: CA, RTT, MALADIE)</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
                  placeholder="CA"
                  maxLength={20}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
                />
              </div>

              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Congés annuels"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Description du type de congé..."
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Visual */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Palette className="w-5 h-5 text-gray-600" />
              Apparence
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Couleur *
              </label>
              <div className="flex items-center gap-3">
                <div
                  className="w-12 h-12 rounded-lg border-2 border-gray-300"
                  style={{ backgroundColor: formData.color }}
                ></div>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map(color => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => handleChange('color', color)}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${
                        formData.color === color ? 'border-gray-900 scale-110' : 'border-gray-300 hover:border-gray-400'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => handleChange('color', e.target.value)}
                  className="w-12 h-12 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Limits */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-gray-600" />
              Limites et règles
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Min days per request */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jours minimum *
                </label>
                <input
                  type="number"
                  required
                  min="0.5"
                  step="0.5"
                  value={formData.min_days_per_request}
                  onChange={(e) => handleChange('min_days_per_request', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">Par demande</p>
              </div>

              {/* Max days per request */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jours maximum
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={formData.max_days_per_request}
                  onChange={(e) => handleChange('max_days_per_request', e.target.value)}
                  placeholder="Illimité"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">Par demande</p>
              </div>

              {/* Max days per year */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Jours maximum
                </label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={formData.max_days_per_year}
                  onChange={(e) => handleChange('max_days_per_year', e.target.value)}
                  placeholder="Illimité"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-gray-500">Par an</p>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-gray-600" />
              Options
            </h3>

            <div className="space-y-3">
              {/* Is Paid */}
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_paid}
                  onChange={(e) => handleChange('is_paid', e.target.checked)}
                  className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Congé payé</p>
                  <p className="text-xs text-gray-500">L'employé est rémunéré pendant ce congé</p>
                </div>
              </label>

              {/* Requires Justification */}
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.requires_justification}
                  onChange={(e) => handleChange('requires_justification', e.target.checked)}
                  className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Justification requise</p>
                  <p className="text-xs text-gray-500">Un motif doit être fourni lors de la demande</p>
                </div>
              </label>

              {/* Can Carry Forward */}
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.can_carry_forward}
                  onChange={(e) => handleChange('can_carry_forward', e.target.checked)}
                  className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Report possible</p>
                  <p className="text-xs text-gray-500">Les jours non utilisés peuvent être reportés</p>
                </div>
              </label>

              {/* Is Active */}
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => handleChange('is_active', e.target.checked)}
                  className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Actif</p>
                  <p className="text-xs text-gray-500">Ce type de congé peut être utilisé pour de nouvelles demandes</p>
                </div>
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Enregistrement...' : leaveTypeId ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
