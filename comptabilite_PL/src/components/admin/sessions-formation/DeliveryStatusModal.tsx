import React, { useState } from 'react';
import { X, Package, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api/client';
import type { DeliveryStatus } from '@/types/sessions';

interface DeliveryStatusModalProps {
  student: {
    id: string;
    student_id: string;
    student_name?: string;
    delivery_status?: DeliveryStatus;
  };
  sessionId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const DeliveryStatusModal: React.FC<DeliveryStatusModalProps> = ({
  student,
  sessionId,
  onClose,
  onSuccess,
}) => {
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>(
    student.delivery_status || 'non_livree'
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);

    try {
      await apiClient.put(
        `/sessions-formation/${sessionId}/etudiants/${student.student_id}`,
        { delivery_status: deliveryStatus }
      );

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Error updating delivery status:', error);
      setErrors({ submit: error.message || "Erreur lors de la mise à jour du statut de livraison" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[450px] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Statut de livraison</h2>
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
            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-700">{errors.submit}</div>
            </div>
          )}

          {/* Delivery Status Selection */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-900">
              Statut de livraison
            </label>
            <div className="space-y-2">
              <label
                className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                style={{
                  borderColor: deliveryStatus === 'non_livree' ? '#3b82f6' : '#d1d5db',
                  backgroundColor: deliveryStatus === 'non_livree' ? '#eff6ff' : 'white'
                }}
              >
                <input
                  type="radio"
                  name="delivery_status"
                  value="non_livree"
                  checked={deliveryStatus === 'non_livree'}
                  onChange={(e) => setDeliveryStatus(e.target.value as DeliveryStatus)}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium text-gray-900">Non livrée</div>
                  <div className="text-sm text-gray-500">Documents non encore livrés</div>
                </div>
              </label>

              <label
                className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                style={{
                  borderColor: deliveryStatus === 'livree' ? '#3b82f6' : '#d1d5db',
                  backgroundColor: deliveryStatus === 'livree' ? '#eff6ff' : 'white'
                }}
              >
                <input
                  type="radio"
                  name="delivery_status"
                  value="livree"
                  checked={deliveryStatus === 'livree'}
                  onChange={(e) => setDeliveryStatus(e.target.value as DeliveryStatus)}
                  className="w-4 h-4"
                />
                <div>
                  <div className="font-medium text-gray-900">Livrée</div>
                  <div className="text-sm text-gray-500">Documents livrés à l'étudiant</div>
                </div>
              </label>
            </div>
          </div>

          {/* Info note */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              Le statut de livraison sera reflété par la couleur de la ligne : verte quand livrée, jaune sinon.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Mise à jour...' : 'Mettre à jour'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
