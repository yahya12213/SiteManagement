import React, { useState } from 'react';
import { X, DollarSign, AlertCircle, Trash2, Calendar, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProtectedButton } from '@/components/ui/ProtectedButton';
import { Input } from '@/components/ui/input';
import { useStudentPayments, useRecordPayment, useDeletePayment } from '@/hooks/usePayments';
import { PAYMENT_METHODS, type PaymentMethod, type PaymentFormData } from '@/types/payments';

interface PaymentManagerModalProps {
  student: {
    id: string;
    student_id: string;
    student_name?: string;
    montant_total: number;
    montant_paye: number;
    montant_du: number;
    statut_paiement: 'paye' | 'partiellement_paye' | 'impaye';
    formation_original_price?: number;
    discount_percentage?: number;
  };
  sessionId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const PaymentManagerModal: React.FC<PaymentManagerModalProps> = ({
  student,
  sessionId,
  onClose,
  onSuccess,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState<PaymentFormData>({
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'especes',
    reference_number: '',
    note: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch payment history
  const { data: paymentsData, isLoading, error: fetchError } = useStudentPayments(
    sessionId,
    student.student_id
  );

  // Mutations
  const recordPayment = useRecordPayment(sessionId, student.student_id);
  const deletePayment = useDeletePayment(sessionId, student.student_id);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    const amount = parseFloat(formData.amount);

    if (!formData.amount || isNaN(amount) || amount <= 0) {
      newErrors.amount = 'Le montant doit être supérieur à zéro';
    }

    const montantDu = paymentsData?.totals.montant_du || parseFloat(student.montant_du.toString());
    if (amount > montantDu) {
      newErrors.amount = `Le montant ne peut pas dépasser le reste à payer (${montantDu.toFixed(2)} DH)`;
    }

    if (!formData.payment_method) {
      newErrors.payment_method = 'La méthode de paiement est requise';
    }

    if (!formData.payment_date) {
      newErrors.payment_date = 'La date de paiement est requise';
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
      await recordPayment.mutateAsync(formData);

      // Reset form
      setFormData({
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'especes',
        reference_number: '',
        note: '',
      });
      setShowAddForm(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error recording payment:', error);
      setErrors({ submit: error.message || 'Erreur lors de l\'enregistrement du paiement' });
    }
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir annuler ce paiement ?')) {
      return;
    }

    try {
      await deletePayment.mutateAsync(paymentId);
      onSuccess();
    } catch (error: any) {
      console.error('Error deleting payment:', error);
      alert('Erreur lors de l\'annulation du paiement: ' + error.message);
    }
  };

  const totals = paymentsData?.totals || {
    montant_total: parseFloat(student.montant_total.toString()),
    montant_paye: parseFloat(student.montant_paye.toString()),
    montant_du: parseFloat(student.montant_du.toString()),
    statut_paiement: student.statut_paiement,
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <DollarSign className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Gestion des Paiements</h2>
              <p className="text-sm text-gray-500 mt-0.5">{student.student_name}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Error message */}
          {fetchError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">Erreur lors du chargement des paiements</p>
            </div>
          )}

          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{errors.submit}</p>
            </div>
          )}

          {/* Totals Summary */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
            <h3 className="text-sm font-medium text-gray-700 mb-4">Récapitulatif</h3>

            {/* Show original price and discount if available */}
            {student.formation_original_price && student.discount_percentage && parseFloat(student.discount_percentage.toString()) > 0 && (
              <div className="mb-4 pb-4 border-b border-blue-200">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Prix formation original:</span>
                  <span className="font-semibold text-gray-900">{parseFloat(student.formation_original_price.toString()).toFixed(2)} DH</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1">
                  <span className="text-gray-600">Remise:</span>
                  <span className="font-semibold text-green-600">-{parseFloat(student.discount_percentage.toString()).toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-1 pt-2 border-t border-blue-200">
                  <span className="text-gray-600">Prix après remise:</span>
                  <span className="font-bold text-indigo-600">{totals.montant_total.toFixed(2)} DH</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-gray-600 mb-1">Montant à Payer</p>
                <p className="text-2xl font-bold text-gray-900">{totals.montant_total.toFixed(2)} DH</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Montant Payé</p>
                <p className="text-2xl font-bold text-green-600">{totals.montant_paye.toFixed(2)} DH</p>
              </div>
              <div>
                <p className="text-xs text-gray-600 mb-1">Reste à Payer</p>
                <p className={`text-2xl font-bold ${totals.montant_du === 0 ? 'text-green-600' : totals.montant_du < 0 ? 'text-red-600' : 'text-orange-600'}`}>
                  {totals.montant_du.toFixed(2)} DH
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-blue-300">
              <span
                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  totals.statut_paiement === 'paye'
                    ? 'bg-green-100 text-green-800'
                    : totals.statut_paiement === 'partiellement_paye'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {totals.statut_paiement === 'paye' && 'Payé'}
                {totals.statut_paiement === 'partiellement_paye' && 'Partiellement Payé'}
                {totals.statut_paiement === 'impaye' && 'Impayé'}
              </span>
            </div>
          </div>

          {/* Add Payment Form */}
          {showAddForm ? (
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Enregistrer un Paiement</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Montant */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Montant (DH) *
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.amount}
                      onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                      placeholder="0.00"
                      className={errors.amount ? 'border-red-300' : ''}
                    />
                    {errors.amount && <p className="text-xs text-red-600 mt-1">{errors.amount}</p>}
                  </div>

                  {/* Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date de Paiement *
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

                <div className="grid grid-cols-2 gap-4">
                  {/* Méthode de Paiement */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Méthode de Paiement *
                    </label>
                    <select
                      value={formData.payment_method}
                      onChange={(e) =>
                        setFormData({ ...formData, payment_method: e.target.value as PaymentMethod })
                      }
                      className={`w-full px-3 py-2 border ${
                        errors.payment_method ? 'border-red-300' : 'border-gray-300'
                      } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    >
                      {Object.entries(PAYMENT_METHODS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    {errors.payment_method && <p className="text-xs text-red-600 mt-1">{errors.payment_method}</p>}
                  </div>

                  {/* Numéro de référence */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Numéro de Référence (optionnel)
                    </label>
                    <Input
                      type="text"
                      value={formData.reference_number}
                      onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                      placeholder="Ex: CHQ123456"
                    />
                  </div>
                </div>

                {/* Note */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Note (optionnel)
                  </label>
                  <textarea
                    value={formData.note}
                    onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                    placeholder="Remarques sur ce paiement..."
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowAddForm(false);
                      setErrors({});
                      setFormData({
                        amount: '',
                        payment_date: new Date().toISOString().split('T')[0],
                        payment_method: 'especes',
                        reference_number: '',
                        note: '',
                      });
                    }}
                    disabled={recordPayment.isPending}
                  >
                    Annuler
                  </Button>
                  <ProtectedButton
                    permission="training.sessions.manage_payments"
                    type="submit"
                    disabled={recordPayment.isPending}
                    className="min-w-[120px]"
                  >
                    {recordPayment.isPending ? (
                      <div className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Enregistrement...</span>
                      </div>
                    ) : (
                      'Enregistrer'
                    )}
                  </ProtectedButton>
                </div>
              </form>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Historique des Paiements</h3>
              {totals.montant_du > 0 && (
                <ProtectedButton permission="training.sessions.manage_payments" onClick={() => setShowAddForm(true)}>
                  Ajouter un Paiement
                </ProtectedButton>
              )}
            </div>
          )}

          {/* Payment History Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : paymentsData && paymentsData.payments.length > 0 ? (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Montant</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Méthode</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Référence</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paymentsData.payments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          {formatDate(payment.payment_date)}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-green-600">
                        {parseFloat(payment.amount.toString()).toFixed(2)} DH
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        <div className="flex items-center gap-2">
                          <CreditCard className="h-4 w-4 text-gray-400" />
                          {PAYMENT_METHODS[payment.payment_method]}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {payment.reference_number || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                        {payment.note || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <ProtectedButton
                          permission="training.sessions.manage_payments"
                          onClick={() => handleDeletePayment(payment.id)}
                          disabled={deletePayment.isPending}
                          className="text-red-600 hover:text-red-800 transition-colors disabled:opacity-50 p-0 h-auto bg-transparent border-0 shadow-none hover:bg-transparent"
                          title="Annuler ce paiement"
                        >
                          <Trash2 className="h-4 w-4" />
                        </ProtectedButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
              <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">Aucun paiement enregistré</p>
              <p className="text-sm text-gray-500 mt-1">Cliquez sur "Ajouter un Paiement" pour commencer</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
          <Button type="button" variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
};
