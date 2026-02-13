import React, { useState } from 'react';
import { X, DollarSign, Plus, Trash2, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { StudentPayment, PaymentMethod, EnrolledStudent } from '@/types/formations';

interface StudentPaymentManagerProps {
  student: EnrolledStudent;
  onClose: () => void;
}

export const StudentPaymentManager: React.FC<StudentPaymentManagerProps> = ({ student, onClose }) => {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'especes' as PaymentMethod,
    note: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch payments
  const { data: payments = [], isLoading } = useQuery<StudentPayment[]>({
    queryKey: ['student-payments', student.enrollment_id],
    queryFn: async () => {
      const response = await fetch(`/api/formations/enrollments/${student.enrollment_id}/payments`);
      if (!response.ok) throw new Error('Failed to fetch payments');
      return response.json();
    },
  });

  // Add payment mutation
  const addPayment = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await fetch(`/api/formations/enrollments/${student.enrollment_id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          amount: parseFloat(data.amount),
        }),
      });
      if (!response.ok) throw new Error('Failed to add payment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-payments', student.enrollment_id] });
      queryClient.invalidateQueries({ queryKey: ['session-students'] });
      setFormData({
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'especes',
        note: '',
      });
      setShowAddForm(false);
      setErrors({});
    },
  });

  // Delete payment mutation
  const deletePayment = useMutation({
    mutationFn: async (paymentId: string) => {
      const response = await fetch(`/api/formations/enrollments/${student.enrollment_id}/payments/${paymentId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete payment');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student-payments', student.enrollment_id] });
      queryClient.invalidateQueries({ queryKey: ['session-students'] });
    },
  });

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Le montant doit être supérieur à 0';
    }

    if (!formData.payment_date) {
      newErrors.payment_date = 'La date est obligatoire';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      await addPayment.mutateAsync(formData);
    } catch (error: any) {
      setErrors({ submit: error.message || 'Erreur lors de l\'ajout du paiement' });
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer ce paiement ?')) {
      try {
        await deletePayment.mutateAsync(paymentId);
      } catch (error: any) {
        alert('Erreur lors de la suppression du paiement');
      }
    }
  };

  const getPaymentStatusColor = (status: string) => {
    const colors = {
      paye: 'bg-green-100 text-green-700',
      partiel: 'bg-orange-100 text-orange-700',
      impaye: 'bg-red-100 text-red-700',
      surpaye: 'bg-blue-100 text-blue-700',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const getPaymentStatusLabel = (status: string) => {
    const labels = {
      paye: 'Payé',
      partiel: 'Partiellement payé',
      impaye: 'Impayé',
      surpaye: 'Surpayé',
    };
    return labels[status as keyof typeof labels] || status;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[700px] md:w-[850px] lg:w-[950px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Gestion des paiements</h2>
              <p className="text-sm text-gray-500 mt-0.5">{student.student_name}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Summary */}
        <div className="p-6 bg-gray-50 border-b">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">Prix formation</p>
              <p className="text-lg font-bold text-gray-900">{student.formation_price ? parseFloat(String(student.formation_price)).toFixed(2) : '0.00'} MAD</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Remise</p>
              <p className="text-lg font-bold text-purple-600">-{student.discount_amount ? parseFloat(String(student.discount_amount)).toFixed(2) : '0.00'} MAD</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Total payé</p>
              <p className="text-lg font-bold text-blue-600">{student.total_paid ? parseFloat(String(student.total_paid)).toFixed(2) : '0.00'} MAD</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Reste à payer</p>
              <p className={`text-lg font-bold ${
                parseFloat(String(student.remaining_amount || 0)) < 0 ? 'text-blue-600' :
                parseFloat(String(student.remaining_amount || 0)) === 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {student.remaining_amount ? parseFloat(String(student.remaining_amount)).toFixed(2) : '0.00'} MAD
              </p>
              {student.payment_status && (
                <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(student.payment_status)}`}>
                  {getPaymentStatusLabel(student.payment_status)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Add payment button */}
          {!showAddForm && (
            <Button
              onClick={() => setShowAddForm(true)}
              className="mb-4"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-2" />
              Ajouter un paiement
            </Button>
          )}

          {/* Add payment form */}
          {showAddForm && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="font-medium text-gray-900 mb-3">Nouveau paiement</h3>

              {errors.submit && (
                <div className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{errors.submit}</p>
                </div>
              )}

              <form onSubmit={handleAddPayment} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Montant (MAD) <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0.00"
                      className={errors.amount ? 'border-red-300' : ''}
                    />
                    {errors.amount && <p className="text-xs text-red-600 mt-1">{errors.amount}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={formData.payment_date}
                      onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                      className={errors.payment_date ? 'border-red-300' : ''}
                    />
                    {errors.payment_date && <p className="text-xs text-red-600 mt-1">{errors.payment_date}</p>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Méthode de paiement
                  </label>
                  <select
                    value={formData.payment_method}
                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as PaymentMethod })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  >
                    <option value="especes">Espèces</option>
                    <option value="virement">Virement</option>
                    <option value="cheque">Chèque</option>
                    <option value="carte">Carte bancaire</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note
                  </label>
                  <textarea
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    placeholder="Note optionnelle..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowAddForm(false);
                      setErrors({});
                      setFormData({
                        amount: '',
                        payment_date: new Date().toISOString().split('T')[0],
                        payment_method: 'especes',
                        note: '',
                      });
                    }}
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={addPayment.isPending}
                  >
                    {addPayment.isPending ? 'Ajout...' : 'Ajouter'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* Payments list */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3">Historique des paiements</h3>

            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Chargement...</div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucun paiement enregistré
              </div>
            ) : (
              <div className="space-y-2">
                {payments.map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">
                            {formatDate(payment.payment_date)}
                          </span>
                        </div>
                        <span className="text-lg font-bold text-green-600">
                          {parseFloat(String(payment.amount)).toFixed(2)} MAD
                        </span>
                        {payment.payment_method && (
                          <span className="text-xs text-gray-500 capitalize">
                            ({payment.payment_method})
                          </span>
                        )}
                      </div>
                      {payment.note && (
                        <p className="text-xs text-gray-500 mt-1">{payment.note}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeletePayment(payment.id)}
                      disabled={deletePayment.isPending}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <Button onClick={onClose}>Fermer</Button>
        </div>
      </div>
    </div>
  );
};
