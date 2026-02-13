import { useState } from 'react';
import { Calendar, Plus, Trash2, Edit, X, Save } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

interface PublicHoliday {
  id: string;
  holiday_date: string;
  name: string;
  description?: string;
  is_recurring: boolean;
}

function PublicHolidaysManager() {
  const [showModal, setShowModal] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<PublicHoliday | null>(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    holiday_date: '',
    name: '',
    description: '',
    is_recurring: false
  });

  // Fetch holidays
  const { data: holidaysData, isLoading } = useQuery({
    queryKey: ['public-holidays', selectedYear],
    queryFn: async () => {
      const response = await apiClient.get(`/hr/public-holidays?year=${selectedYear}`);
      return (response as any).data as { success: boolean; holidays: PublicHoliday[] };
    }
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (editingHoliday) {
        const response = await apiClient.put(`/hr/public-holidays/${editingHoliday.id}`, data);
        return (response as any).data;
      } else {
        const response = await apiClient.post('/hr/public-holidays', data);
        return (response as any).data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-holidays'] });
      setShowModal(false);
      setEditingHoliday(null);
      setFormData({ holiday_date: '', name: '', description: '', is_recurring: false });
      alert(editingHoliday ? 'Jour férié modifié avec succès' : 'Jour férié ajouté avec succès');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Erreur lors de l\'enregistrement');
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.delete(`/hr/public-holidays/${id}`);
      return (response as any).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-holidays'] });
      alert('Jour férié supprimé avec succès');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Erreur lors de la suppression');
    }
  });

  const handleOpenModal = (holiday?: PublicHoliday) => {
    if (holiday) {
      setEditingHoliday(holiday);
      setFormData({
        holiday_date: holiday.holiday_date,
        name: holiday.name,
        description: holiday.description || '',
        is_recurring: holiday.is_recurring
      });
    } else {
      setEditingHoliday(null);
      setFormData({ holiday_date: '', name: '', description: '', is_recurring: false });
    }
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.holiday_date || !formData.name) {
      alert('La date et le nom sont requis');
      return;
    }
    saveMutation.mutate(formData);
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le jour férié "${name}" ?`)) {
      deleteMutation.mutate(id);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const holidays = holidaysData?.holidays || [];

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="h-6 w-6 text-blue-600" />
          <h3 className="text-xl font-bold text-gray-900">Jours Fériés</h3>
        </div>
        <div className="flex gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[2024, 2025, 2026, 2027].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <button
            onClick={() => handleOpenModal()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center gap-2 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Ajouter
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : holidays.length > 0 ? (
        <div className="space-y-2">
          {holidays.map((holiday) => (
            <div
              key={holiday.id}
              className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <div className="font-semibold text-gray-900">{holiday.name}</div>
                  {holiday.is_recurring && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full">
                      🔄 Récurrent
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 mt-1">
                  {formatDate(holiday.holiday_date)}
                </div>
                {holiday.description && (
                  <div className="text-sm text-gray-500 mt-1">{holiday.description}</div>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenModal(holiday)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                  title="Modifier"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(holiday.id, holiday.name)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  title="Supprimer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          Aucun jour férié pour {selectedYear}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[450px] md:w-[500px] max-w-[95vw]">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-bold text-gray-900">
                {editingHoliday ? 'Modifier le jour férié' : 'Ajouter un jour férié'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date *
                </label>
                <input
                  type="date"
                  value={formData.holiday_date}
                  onChange={(e) => setFormData({ ...formData, holiday_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Aid Al-Fitr"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optionnel)
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_recurring"
                  checked={formData.is_recurring}
                  onChange={(e) => setFormData({ ...formData, is_recurring: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="is_recurring" className="text-sm text-gray-700">
                  Jour férié récurrent (se répète chaque année)
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PublicHolidaysManager;
