import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, AlertCircle } from 'lucide-react';
import { useCreateModule, useUpdateModule } from '@/hooks/useCours';
import type { FormationModule, ModuleType } from '@/types/cours';

interface ModuleFormModalProps {
  formationId: string;
  module?: FormationModule;
  modules?: FormationModule[];
  onClose: () => void;
}

export const ModuleFormModal: React.FC<ModuleFormModalProps> = ({
  formationId,
  module,
  modules = [],
  onClose,
}) => {
  const isEdit = !!module;
  const createModule = useCreateModule();
  const updateModule = useUpdateModule();

  const [formData, setFormData] = useState({
    title: module?.title || '',
    description: module?.description || '',
    module_type: (module?.module_type || 'video') as ModuleType,
    prerequisite_module_id: module?.prerequisite_module_id || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Le titre est obligatoire';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      const submitData = {
        title: formData.title.trim(),
        description: formData.description.trim() || undefined,
        module_type: formData.module_type,
        prerequisite_module_id: formData.prerequisite_module_id || undefined,
      };

      if (isEdit && module) {
        await updateModule.mutateAsync({
          id: module.id,
          data: submitData,
        });
      } else {
        await createModule.mutateAsync({
          formationId,
          data: submitData,
        });
      }

      onClose();
    } catch (error) {
      console.error('Error saving module:', error);
      setErrors({
        submit: 'Une erreur est survenue lors de la sauvegarde du module',
      });
    }
  };

  // Filter available prerequisite modules (exclude current module if editing)
  const availablePrerequisites = modules.filter((m) => !isEdit || m.id !== module?.id);

  const getModuleTypeLabel = (type: ModuleType) => {
    const labels = {
      video: 'Vidéo',
      test: 'Test',
      document: 'Document',
    };
    return labels[type];
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[650px] md:w-[750px] lg:w-[850px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEdit ? 'Modifier le module' : 'Ajouter un module'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Submit Error */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{errors.submit}</p>
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.title ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Ex: Introduction aux bases de données"
            />
            {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Décrivez le contenu de ce module..."
            />
          </div>

          {/* Module Type */}
          <div>
            <label htmlFor="module_type" className="block text-sm font-medium text-gray-700 mb-2">
              Type de module <span className="text-red-500">*</span>
            </label>
            <select
              id="module_type"
              value={formData.module_type}
              onChange={(e) =>
                setFormData({ ...formData, module_type: e.target.value as ModuleType })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="video">Vidéo</option>
              <option value="test">Test</option>
              <option value="document">Document</option>
            </select>
            <p className="mt-1 text-sm text-gray-500">
              {formData.module_type === 'video' &&
                'Module contenant des vidéos de cours'}
              {formData.module_type === 'test' &&
                'Module contenant des tests et évaluations'}
              {formData.module_type === 'document' &&
                'Module contenant des documents et ressources'}
            </p>
          </div>

          {/* Prerequisite Module */}
          <div>
            <label
              htmlFor="prerequisite_module_id"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Module prérequis
            </label>
            <select
              id="prerequisite_module_id"
              value={formData.prerequisite_module_id}
              onChange={(e) =>
                setFormData({ ...formData, prerequisite_module_id: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Aucun (accessible immédiatement)</option>
              {availablePrerequisites.map((m) => (
                <option key={m.id} value={m.id}>
                  #{m.order_index + 1} - {m.title} ({getModuleTypeLabel(m.module_type)})
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-gray-500">
              L'étudiant devra compléter ce module avant d'accéder au module actuel
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={createModule.isPending || updateModule.isPending}
              className="min-w-[120px]"
            >
              {createModule.isPending || updateModule.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Sauvegarde...</span>
                </div>
              ) : isEdit ? (
                'Modifier'
              ) : (
                'Ajouter'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
