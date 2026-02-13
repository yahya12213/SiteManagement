import React, { useState } from 'react';
import { X, Tag, AlertCircle, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiClient } from '@/lib/api/client';

interface DiscountModalProps {
  student: {
    id: string;
    student_id: string;
    student_name?: string;
    montant_total: number;
    montant_paye: number;
    discount_amount?: number;
    discount_percentage?: number;
    discount_reason?: string;
    formation_original_price?: number;
  };
  sessionId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const DiscountModal: React.FC<DiscountModalProps> = ({
  student,
  sessionId,
  onClose,
  onSuccess,
}) => {
  const [formData, setFormData] = useState({
    discount_percentage: (student.discount_percentage || 0).toString(),
    discount_reason: student.discount_reason || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Récupérer le prix original de la formation
  const formationOriginalPrice = parseFloat(student.formation_original_price?.toString() || '0') ||
    (parseFloat(student.montant_total?.toString() || '0') + parseFloat(student.discount_amount?.toString() || '0'));

  // Calculer le montant de la remise depuis le pourcentage
  const discountPercentage = parseFloat(formData.discount_percentage) || 0;
  const discountAmount = (formationOriginalPrice * discountPercentage) / 100;
  const newTotalPrice = formationOriginalPrice - discountAmount;

  // Pourcentage actuel
  const currentDiscountPercentage = parseFloat(student.discount_percentage?.toString() || '0');
  const currentDiscountAmount = parseFloat(student.discount_amount?.toString() || '0');

  const validate = () => {
    const newErrors: Record<string, string> = {};

    const percentage = parseFloat(formData.discount_percentage);

    if (isNaN(percentage) || percentage < 0) {
      newErrors.discount_percentage = 'Le pourcentage doit être un nombre positif ou zéro';
    }

    if (percentage > 100) {
      newErrors.discount_percentage = 'Le pourcentage ne peut pas dépasser 100%';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Mettre à jour la remise via l'API
      await apiClient.put(
        `/sessions-formation/${sessionId}/etudiants/${student.student_id}`,
        {
          discount_percentage: parseFloat(formData.discount_percentage),
          discount_reason: formData.discount_reason.trim() || null,
        }
      );

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating discount:', error);
      setErrors({ submit: error.message || "Erreur lors de la mise à jour de la remise" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[550px] md:w-[600px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Tag className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Gérer la remise</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {student.student_name}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error message */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{errors.submit}</p>
            </div>
          )}

          {/* Prix info */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Prix formation:</span>
              <span className="font-semibold text-gray-900">
                {formationOriginalPrice.toFixed(2)} DH
              </span>
            </div>
            {currentDiscountPercentage > 0 ? (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Remise actuelle:</span>
                <span className="font-semibold text-purple-600">
                  {currentDiscountPercentage.toFixed(2)}% (-{currentDiscountAmount.toFixed(2)} DH)
                </span>
              </div>
            ) : null}
            <div className="pt-2 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Prix actuel:</span>
                <span className="text-lg font-bold text-gray-900">
                  {parseFloat(student.montant_total.toString()).toFixed(2)} DH
                </span>
              </div>
            </div>
          </div>

          {/* Pourcentage de la remise */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Pourcentage de remise (%)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Percent className="h-4 w-4 text-gray-400" />
              </div>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.discount_percentage}
                onChange={(e) => setFormData({ ...formData, discount_percentage: e.target.value })}
                placeholder="0.00"
                className={`pl-10 ${errors.discount_percentage ? 'border-red-300' : ''}`}
              />
            </div>
            {errors.discount_percentage && (
              <p className="text-xs text-red-600 mt-1">{errors.discount_percentage}</p>
            )}
            <p className="text-xs text-gray-500 mt-1">
              Exemple: 10 pour une remise de 10%
            </p>
          </div>

          {/* Raison de la remise */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Raison de la remise (optionnel)
            </label>
            <textarea
              value={formData.discount_reason}
              onChange={(e) => setFormData({ ...formData, discount_reason: e.target.value })}
              placeholder="Ex: Remise étudiant, Offre spéciale, etc."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Nouveau prix aperçu */}
          {discountPercentage > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-green-800">
                  Remise appliquée:
                </span>
                <span className="text-sm font-bold text-green-700">
                  {discountPercentage.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-700">
                  Montant de la remise:
                </span>
                <span className="text-sm font-semibold text-green-700">
                  -{discountAmount.toFixed(2)} DH
                </span>
              </div>
              <div className="pt-2 border-t border-green-300">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-800">
                    Nouveau prix final:
                  </span>
                  <span className="text-xl font-bold text-green-700">
                    {newTotalPrice.toFixed(2)} DH
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting} className="min-w-[120px]">
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Application...</span>
                </div>
              ) : (
                'Appliquer'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
