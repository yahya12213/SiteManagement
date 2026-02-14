import { useState } from 'react';
import { X, TrendingUp, User, Clock, FileText, CheckCircle, XCircle, AlertCircle, MessageSquare } from 'lucide-react';
import { ProtectedButton } from '@/components/ui/ProtectedButton';
import { apiClient } from '@/lib/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface OvertimeApprovalModalProps {
  requestId: string;
  onClose: () => void;
}

interface OvertimeRequest {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_number: string;
  request_date: string;
  start_time: string;
  end_time: string;
  estimated_hours: number;
  reason: string;
  priority: string;
  status: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  approval_comment?: string;
  rejected_by?: string;
  rejected_by_name?: string;
  rejected_at?: string;
  rejection_reason?: string;
  created_at: string;
}

export default function OvertimeApprovalModal({ requestId, onClose }: OvertimeApprovalModalProps) {
  const queryClient = useQueryClient();
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [comment, setComment] = useState('');

  // Fetch overtime request details
  const { data: requestData, isLoading } = useQuery({
    queryKey: ['hr-overtime-request', requestId],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: OvertimeRequest }>(`/hr/attendance/overtime/requests/${requestId}`);
      return (response as any).data;
    },
  });

  const request = requestData;

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: async (data: { comment: string }) => {
      const response = await apiClient.put<{ success: boolean; data: any }>(`/hr/attendance/overtime/requests/${requestId}/approve`, data);
      return (response as any).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-overtime-requests'] });
      queryClient.invalidateQueries({ queryKey: ['hr-overtime-request', requestId] });
      alert('Demande d\'heures supplémentaires approuvée');
      onClose();
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: async (data: { reason: string }) => {
      const response = await apiClient.put<{ success: boolean; data: any }>(`/hr/attendance/overtime/requests/${requestId}/reject`, data);
      return (response as any).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-overtime-requests'] });
      queryClient.invalidateQueries({ queryKey: ['hr-overtime-request', requestId] });
      alert('Demande d\'heures supplémentaires rejetée');
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
      pending: 'En attente',
      approved: 'Approuvé',
      rejected: 'Rejeté',
      cancelled: 'Annulé',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      urgent: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      normal: 'bg-blue-100 text-blue-800',
      low: 'bg-gray-100 text-gray-800',
    };
    const labels: Record<string, string> = {
      urgent: 'Urgent',
      high: 'Haute',
      normal: 'Normal',
      low: 'Basse',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[priority] || styles.normal}`}>
        {labels[priority] || priority}
      </span>
    );
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
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[650px] md:w-[750px] lg:w-[850px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Demande d'Heures Supplémentaires</h2>
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
          {/* Status and Priority */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1.5 text-sm font-medium rounded-full ${getStatusColor(request.status)}`}>
                {getStatusLabel(request.status)}
              </span>
              {getPriorityBadge(request.priority)}
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

          {/* Overtime Details */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <Clock className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Détails des Heures Supplémentaires</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-600">Date:</span>
                <p className="font-medium text-gray-900">
                  {new Date(request.request_date).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-600">Heure de début:</span>
                  <p className="font-medium text-gray-900">{request.start_time}</p>
                </div>
                <div>
                  <span className="text-gray-600">Heure de fin:</span>
                  <p className="font-medium text-gray-900">{request.end_time}</p>
                </div>
              </div>
              <div>
                <span className="text-gray-600">Heures estimées:</span>
                <p className="font-bold text-lg text-orange-600">{request.estimated_hours}h</p>
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

          {/* Approval/Rejection Info */}
          {(request.status === 'approved' || request.status === 'rejected') && (
            <div className={`rounded-lg p-4 ${
              request.status === 'approved' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <div className="flex items-start gap-3">
                {request.status === 'approved' ? (
                  <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className={`font-medium ${request.status === 'approved' ? 'text-green-900' : 'text-red-900'}`}>
                      {request.status === 'approved' ? 'Demande Approuvée' : 'Demande Rejetée'}
                    </p>
                    {(request.approved_at || request.rejected_at) && (
                      <span className={`text-xs ${request.status === 'approved' ? 'text-green-600' : 'text-red-600'}`}>
                        {new Date(request.approved_at || request.rejected_at!).toLocaleString('fr-FR')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700">
                    Par: {request.approved_by_name || request.rejected_by_name}
                  </p>
                  {(request.approval_comment || request.rejection_reason) && (
                    <div className="mt-2 bg-white rounded p-2 text-sm text-gray-700">
                      <MessageSquare className="w-4 h-4 inline mr-1 text-gray-400" />
                      {request.approval_comment || request.rejection_reason}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Section - Only show if pending */}
          {request.status === 'pending' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Action Requise</h3>
              </div>

              {!action ? (
                <div className="flex gap-3">
                  <ProtectedButton
                    permission="hr.overtime.approve"
                    onClick={() => setAction('approve')}
                    className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Approuver
                  </ProtectedButton>
                  <ProtectedButton
                    permission="hr.overtime.reject"
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
                      permission={action === 'approve' ? 'hr.overtime.approve' : 'hr.overtime.reject'}
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
