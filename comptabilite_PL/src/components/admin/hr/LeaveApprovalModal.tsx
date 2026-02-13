import { useState } from 'react';
import { X, CalendarDays, User, Clock, FileText, CheckCircle, XCircle, AlertCircle, MessageSquare } from 'lucide-react';
import { ProtectedButton } from '@/components/ui/ProtectedButton';
import { apiClient } from '@/lib/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface LeaveApprovalModalProps {
  requestId: string;
  onClose: () => void;
}

interface LeaveRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_number: string;
  leave_type_id: string;
  leave_type_name: string;
  leave_type_color: string;
  start_date: string;
  end_date: string;
  start_half_day: boolean;
  end_half_day: boolean;
  total_days: number;
  reason: string;
  contact_during_leave?: string;
  handover_notes?: string;
  status: string;
  n1_approver_id?: string;
  n1_approver_name?: string;
  n1_approved_at?: string;
  n1_comment?: string;
  n2_approver_id?: string;
  n2_approver_name?: string;
  n2_approved_at?: string;
  n2_comment?: string;
  hr_approver_id?: string;
  hr_approver_name?: string;
  hr_approved_at?: string;
  hr_comment?: string;
  rejected_by?: string;
  rejected_by_name?: string;
  rejected_at?: string;
  rejection_reason?: string;
  created_at: string;
}

export default function LeaveApprovalModal({ requestId, onClose }: LeaveApprovalModalProps) {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');

  // Fetch leave request details
  const { data: requestData, isLoading } = useQuery({
    queryKey: ['hr-leave-request', requestId],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: LeaveRequest }>(`/hr/leaves/requests/${requestId}`);
      return (response as any).data;
    },
  });

  const request = requestData;

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (data: { comment: string }) => {
      const response = await apiClient.put<{ success: boolean; data: any }>(`/hr/leaves/requests/${requestId}/approve`, data);
      return (response as any).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['hr-leave-request', requestId] });
      alert('Demande approuvée avec succès');
      onClose();
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async (data: { reason: string }) => {
      const response = await apiClient.put<{ success: boolean; data: any }>(`/hr/leaves/requests/${requestId}/reject`, data);
      return (response as any).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['hr-leave-request', requestId] });
      alert('Demande rejetée');
      onClose();
    },
  });

  const handleApprove = async () => {
    if (!comment.trim()) {
      alert('Veuillez ajouter un commentaire');
      return;
    }

    try {
      await approveMutation.mutateAsync({ comment });
    } catch (error: any) {
      console.error('Erreur lors de l\'approbation:', error);
      alert(error.response?.data?.error || 'Erreur lors de l\'approbation de la demande');
    }
  };

  const handleReject = async () => {
    if (!comment.trim()) {
      alert('Veuillez indiquer la raison du rejet');
      return;
    }

    try {
      await rejectMutation.mutateAsync({ reason: comment });
    } catch (error: any) {
      console.error('Erreur lors du rejet:', error);
      alert(error.response?.data?.error || 'Erreur lors du rejet de la demande');
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: 'En attente N+1',
      approved_n1: 'Approuvé N+1 - En attente N+2',
      approved_n2: 'Approuvé N+2 - En attente RH',
      approved_hr: 'Approuvé RH - Validé',
      approved: 'Approuvé',
      rejected: 'Rejeté',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved_n1: 'bg-blue-100 text-blue-800',
      approved_n2: 'bg-indigo-100 text-indigo-800',
      approved_hr: 'bg-green-100 text-green-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const isPending = approveMutation.isPending || rejectMutation.isPending;

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!request) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[700px] md:w-[850px] lg:w-[950px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <CalendarDays className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Demande de Congé</h2>
              <p className="text-sm text-gray-500">Validation et approbation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <div>
              <span className={`px-3 py-1.5 text-sm font-medium rounded-full ${getStatusColor(request.status)}`}>
                {getStatusLabel(request.status)}
              </span>
            </div>
            <div className="text-sm text-gray-500">
              Demandé le {new Date(request.created_at).toLocaleDateString('fr-FR')}
            </div>
          </div>

          {/* Employee Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <User className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Employé</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Nom:</span>
                <p className="font-medium text-gray-900">{request.employee_name}</p>
              </div>
              <div>
                <span className="text-gray-600">Matricule:</span>
                <p className="font-medium text-gray-900">{request.employee_number}</p>
              </div>
            </div>
          </div>

          {/* Leave Details */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <CalendarDays className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Détails du Congé</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: request.leave_type_color }}
                ></div>
                <span className="font-medium text-gray-900">{request.leave_type_name}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-600">Du:</span>
                  <p className="font-medium text-gray-900">
                    {new Date(request.start_date).toLocaleDateString('fr-FR')}
                    {request.start_half_day && ' (Matin uniquement)'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Au:</span>
                  <p className="font-medium text-gray-900">
                    {new Date(request.end_date).toLocaleDateString('fr-FR')}
                    {request.end_half_day && ' (Après-midi uniquement)'}
                  </p>
                </div>
              </div>
              <div>
                <span className="text-gray-600">Durée totale:</span>
                <p className="font-bold text-lg text-purple-600">{request.total_days} jour(s)</p>
              </div>
            </div>
          </div>

          {/* Reason */}
          {request.reason && (
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <FileText className="w-5 h-5 text-gray-600" />
                <h3 className="font-semibold text-gray-900">Motif</h3>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{request.reason}</p>
            </div>
          )}

          {/* Contact & Handover */}
          {(request.contact_during_leave || request.handover_notes) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {request.contact_during_leave && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">Contact durant le congé</h4>
                  <p className="text-sm text-gray-700">{request.contact_during_leave}</p>
                </div>
              )}
              {request.handover_notes && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-1">Notes de passation</h4>
                  <p className="text-sm text-gray-700">{request.handover_notes}</p>
                </div>
              )}
            </div>
          )}

          {/* Approval History */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Historique d'Approbation</h3>
            </div>

            <div className="space-y-3">
              {/* N+1 Approval */}
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${request.n1_approved_at ? 'bg-green-100' : 'bg-gray-200'}`}>
                  {request.n1_approved_at ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <Clock className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">Approbation N+1</p>
                    {request.n1_approved_at && (
                      <span className="text-xs text-gray-500">
                        {new Date(request.n1_approved_at).toLocaleString('fr-FR')}
                      </span>
                    )}
                  </div>
                  {request.n1_approver_name && (
                    <p className="text-sm text-gray-600">Par: {request.n1_approver_name}</p>
                  )}
                  {request.n1_comment && (
                    <div className="mt-1 bg-white rounded p-2 text-sm text-gray-700">
                      <MessageSquare className="w-4 h-4 inline mr-1 text-gray-400" />
                      {request.n1_comment}
                    </div>
                  )}
                  {!request.n1_approved_at && request.status === 'pending' && (
                    <p className="text-sm text-yellow-600">En attente d'approbation</p>
                  )}
                </div>
              </div>

              {/* N+2 Approval */}
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${request.n2_approved_at ? 'bg-green-100' : 'bg-gray-200'}`}>
                  {request.n2_approved_at ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <Clock className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">Approbation N+2</p>
                    {request.n2_approved_at && (
                      <span className="text-xs text-gray-500">
                        {new Date(request.n2_approved_at).toLocaleString('fr-FR')}
                      </span>
                    )}
                  </div>
                  {request.n2_approver_name && (
                    <p className="text-sm text-gray-600">Par: {request.n2_approver_name}</p>
                  )}
                  {request.n2_comment && (
                    <div className="mt-1 bg-white rounded p-2 text-sm text-gray-700">
                      <MessageSquare className="w-4 h-4 inline mr-1 text-gray-400" />
                      {request.n2_comment}
                    </div>
                  )}
                  {!request.n2_approved_at && request.status === 'approved_n1' && (
                    <p className="text-sm text-yellow-600">En attente d'approbation</p>
                  )}
                </div>
              </div>

              {/* HR Approval */}
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${request.hr_approved_at ? 'bg-green-100' : 'bg-gray-200'}`}>
                  {request.hr_approved_at ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : (
                    <Clock className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900">Approbation RH</p>
                    {request.hr_approved_at && (
                      <span className="text-xs text-gray-500">
                        {new Date(request.hr_approved_at).toLocaleString('fr-FR')}
                      </span>
                    )}
                  </div>
                  {request.hr_approver_name && (
                    <p className="text-sm text-gray-600">Par: {request.hr_approver_name}</p>
                  )}
                  {request.hr_comment && (
                    <div className="mt-1 bg-white rounded p-2 text-sm text-gray-700">
                      <MessageSquare className="w-4 h-4 inline mr-1 text-gray-400" />
                      {request.hr_comment}
                    </div>
                  )}
                  {!request.hr_approved_at && request.status === 'approved_n2' && (
                    <p className="text-sm text-yellow-600">En attente d'approbation finale</p>
                  )}
                </div>
              </div>

              {/* Rejection */}
              {request.status === 'rejected' && request.rejected_by_name && (
                <div className="flex items-start gap-3 mt-4 p-3 bg-red-50 rounded-lg">
                  <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-red-900">Demande Rejetée</p>
                      {request.rejected_at && (
                        <span className="text-xs text-red-600">
                          {new Date(request.rejected_at).toLocaleString('fr-FR')}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-red-700">Par: {request.rejected_by_name}</p>
                    {request.rejection_reason && (
                      <div className="mt-1 bg-white rounded p-2 text-sm text-gray-700">
                        <MessageSquare className="w-4 h-4 inline mr-1 text-gray-400" />
                        {request.rejection_reason}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Section - Only show if request can be approved/rejected */}
          {request.status !== 'rejected' && request.status !== 'approved' && request.status !== 'approved_hr' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Action Requise</h3>
              </div>

              {!action ? (
                <div className="flex gap-3">
                  <ProtectedButton
                    permission="hr.leaves.approve"
                    onClick={() => setAction('approve')}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Approuver
                  </ProtectedButton>
                  <ProtectedButton
                    permission="hr.leaves.reject"
                    onClick={() => setAction('reject')}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    <XCircle className="w-5 h-5" />
                    Rejeter
                  </ProtectedButton>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {action === 'approve' ? 'Commentaire (obligatoire)' : 'Raison du rejet (obligatoire)'}
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder={action === 'approve' ? 'Ajoutez un commentaire...' : 'Expliquez la raison du rejet...'}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setAction(null);
                        setComment('');
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Annuler
                    </button>
                    <ProtectedButton
                      permission={action === 'approve' ? 'hr.leaves.approve' : 'hr.leaves.reject'}
                      onClick={action === 'approve' ? handleApprove : handleReject}
                      disabled={isPending || !comment.trim()}
                      className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                        action === 'approve'
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-red-600 hover:bg-red-700'
                      }`}
                    >
                      {isPending ? 'Traitement...' : action === 'approve' ? 'Confirmer l\'approbation' : 'Confirmer le rejet'}
                    </ProtectedButton>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50 sticky bottom-0">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
