import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Package, Check } from 'lucide-react';
import { useFormationsByCorps } from '@/hooks/useCorpsFormation';
import { useCertificateTemplates } from '@/hooks/useCertificateTemplates';
import type { CreatePackInput } from '@/types/cours';

interface PackFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreatePackInput) => Promise<void>;
  corpsId: string;
  corpsName: string;
}

export default function PackFormModal({
  isOpen,
  onClose,
  onSubmit,
  corpsId,
  corpsName,
}: PackFormModalProps) {
  const { data: formations = [], isLoading: loadingFormations } = useFormationsByCorps(corpsId);
  const { data: templates = [] } = useCertificateTemplates();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    level: 'intermediaire' as 'debutant' | 'intermediaire' | 'avance',
    certificate_template_id: '',
    formation_ids: [] as string[],
  });

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset form when modal closes
      setFormData({
        title: '',
        description: '',
        price: '',
        level: 'intermediaire',
        certificate_template_id: '',
        formation_ids: [],
      });
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      alert('Le nom du pack est obligatoire');
      return;
    }

    if (!formData.price || parseFloat(formData.price) <= 0) {
      alert('Le prix doit être supérieur à 0');
      return;
    }

    if (formData.formation_ids.length === 0) {
      alert('Veuillez sélectionner au moins une formation');
      return;
    }

    setSubmitting(true);

    try {
      await onSubmit({
        title: formData.title,
        description: formData.description || undefined,
        corps_formation_id: corpsId,
        price: parseFloat(formData.price),
        certificate_template_id: formData.certificate_template_id || undefined,
        formation_ids: formData.formation_ids,
        level: formData.level,
      });
      onClose();
    } catch (error: any) {
      console.error('Erreur création pack:', error);
      alert(error.message || 'Erreur lors de la création du pack');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFormation = (formationId: string) => {
    setFormData((prev) => ({
      ...prev,
      formation_ids: prev.formation_ids.includes(formationId)
        ? prev.formation_ids.filter((id) => id !== formationId)
        : [...prev.formation_ids, formationId],
    }));
  };

  const selectedFormations = formations.filter((f) =>
    formData.formation_ids.includes(f.id)
  );

  const totalPrice = selectedFormations.reduce(
    (sum, f) => sum + (parseFloat(String(f.price || 0))),
    0
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[700px] md:w-[850px] lg:w-[950px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-lg">
              <Package className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Créer un Pack</h2>
              <p className="text-sm text-gray-600">Corps: {corpsName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Nom du pack */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom du pack <span className="text-red-500">*</span>
            </label>
            <Input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Ex: Pack Bureautique Complet"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description du pack..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Prix et Niveau */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prix (MAD) <span className="text-red-500">*</span>
              </label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="1500.00"
                required
              />
              {selectedFormations.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Prix total formations: {totalPrice.toFixed(2)} MAD
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Niveau
              </label>
              <select
                value={formData.level}
                onChange={(e) =>
                  setFormData({ ...formData, level: e.target.value as any })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="debutant">Débutant</option>
                <option value="intermediaire">Intermédiaire</option>
                <option value="avance">Avancé</option>
              </select>
            </div>
          </div>

          {/* Template Certificat */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Template de certificat (optionnel)
            </label>
            <select
              value={formData.certificate_template_id}
              onChange={(e) =>
                setFormData({ ...formData, certificate_template_id: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Aucun template spécifique</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </div>

          {/* Sélection formations */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Formations incluses <span className="text-red-500">*</span>
            </label>

            {loadingFormations ? (
              <p className="text-sm text-gray-500">Chargement des formations...</p>
            ) : formations.length === 0 ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  Aucune formation unitaire publiée dans ce corps de formation.
                  Veuillez d'abord créer des formations avant de créer un pack.
                </p>
              </div>
            ) : (
              <div className="border border-gray-300 rounded-lg divide-y divide-gray-200 max-h-64 overflow-y-auto">
                {formations.map((formation) => {
                  const isSelected = formData.formation_ids.includes(formation.id);
                  return (
                    <label
                      key={formation.id}
                      className={`flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                        isSelected ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-center h-5">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleFormation(formation.id)}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900">
                            {formation.title}
                          </p>
                          {isSelected && (
                            <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          )}
                        </div>
                        {formation.description && (
                          <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                            {formation.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-600">
                          {formation.price && (
                            <span className="font-medium">{parseFloat(String(formation.price)).toFixed(2)} MAD</span>
                          )}
                          {formation.duration_hours && (
                            <span>{formation.duration_hours}h</span>
                          )}
                          {formation.level && (
                            <span className="capitalize">{formation.level}</span>
                          )}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}

            {formData.formation_ids.length > 0 && (
              <p className="text-sm text-blue-600 mt-2">
                {formData.formation_ids.length} formation{formData.formation_ids.length > 1 ? 's' : ''} sélectionnée{formData.formation_ids.length > 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
            <Button
              type="submit"
              disabled={submitting || formations.length === 0}
              className="flex-1"
            >
              {submitting ? 'Création...' : 'Créer le pack'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Annuler
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
