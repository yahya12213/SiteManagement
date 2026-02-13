import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, AlertCircle, UserPlus, Trash2, Users, Search, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import {
  useSession,
  useAvailableStudents,
  useEnrollStudents,
  useUnenrollStudent,
} from '@/hooks/useFormations';
import { StudentPaymentManager } from '@/components/formations/StudentPaymentManager';
import type { FormationSession, EnrolledStudent } from '@/types/formations';

interface EnrollmentModalProps {
  session: FormationSession;
  onClose: () => void;
}

export const EnrollmentModal: React.FC<EnrollmentModalProps> = ({ session, onClose }) => {
  const { data: sessionDetail, isLoading } = useSession(session.id);
  const { data: availableStudents = [] } = useAvailableStudents(session.id);
  const enrollStudents = useEnrollStudents();
  const unenrollStudent = useUnenrollStudent();

  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentForPayment, setStudentForPayment] = useState<EnrolledStudent | null>(null);

  const enrolledStudents = sessionDetail?.students || [];

  // Filter available students based on search term
  const filteredAvailableStudents = availableStudents.filter((student) =>
    student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEnroll = async () => {
    if (selectedStudents.length === 0) {
      setError('Veuillez sélectionner au moins un étudiant');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await enrollStudents.mutateAsync({
        sessionId: session.id,
        data: { student_ids: selectedStudents },
      });
      setSelectedStudents([]);
      setSearchTerm('');
    } catch (err: any) {
      console.error('Error enrolling students:', err);
      setError(err.message || 'Erreur lors de l\'inscription des étudiants');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnenroll = async (studentId: string, studentName: string) => {
    if (
      !window.confirm(
        `Êtes-vous sûr de vouloir désinscrire ${studentName} de cette session ?`
      )
    ) {
      return;
    }

    try {
      await unenrollStudent.mutateAsync({
        sessionId: session.id,
        studentId: studentId,
      });
    } catch (err: any) {
      console.error('Error unenrolling student:', err);
      setError(err.message || 'Erreur lors de la désinscription');
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents((prev) =>
      prev.includes(studentId)
        ? prev.filter((id) => id !== studentId)
        : [...prev, studentId]
    );
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      enrolled: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Inscrit' },
      completed: { bg: 'bg-green-100', text: 'text-green-700', label: 'Terminé' },
      dropped: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Abandonné' },
    };
    const badge = badges[status as keyof typeof badges] || badges.enrolled;
    return (
      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const getPaymentStatusBadge = (status: string | undefined) => {
    if (!status) return null;
    const badges = {
      paye: { bg: 'bg-green-100', text: 'text-green-700', label: 'Payé' },
      partiel: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Partiel' },
      impaye: { bg: 'bg-red-100', text: 'text-red-700', label: 'Impayé' },
      surpaye: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Surpayé' },
    };
    const badge = badges[status as keyof typeof badges];
    if (!badge) return null;
    return (
      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const handleToggleValidation = async (student: EnrolledStudent) => {
    const newStatus = student.validation_status === 'valide' ? 'non_valide' : 'valide';
    try {
      const response = await fetch(`/api/formations/enrollments/${student.enrollment_id}/validation`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          validation_status: newStatus,
          validated_by: newStatus === 'valide' ? 'current_user_id' : null, // TODO: Get actual user ID
        }),
      });
      if (!response.ok) throw new Error('Failed to update validation');
      // Refresh session data
      window.location.reload(); // Simple refresh for now
    } catch (err: any) {
      setError('Erreur lors de la mise à jour du statut de validation');
    }
  };

  const capacityReached = session.max_capacity
    ? enrolledStudents.length >= session.max_capacity
    : false;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] max-w-7xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Users className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Gestion des inscriptions</h2>
              <p className="text-sm text-gray-500 mt-1">{session.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[calc(95vh-140px)] overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3 mb-6">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Session Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Inscrits</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {enrolledStudents.length}
                      {session.max_capacity && ` / ${session.max_capacity}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Formation(s)</p>
                    <p className="text-sm font-medium text-gray-900">
                      {sessionDetail?.formations && sessionDetail.formations.length > 0
                        ? sessionDetail.formations.map(f => f.title).join(', ')
                        : 'Aucune'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Segment</p>
                    <p className="text-sm font-medium text-gray-900">
                      {session.segment_name || '-'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Ville</p>
                    <p className="text-sm font-medium text-gray-900">
                      {session.city_name || '-'}
                    </p>
                  </div>
                </div>
                {capacityReached && (
                  <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded p-2">
                    <p className="text-xs text-yellow-800">
                      ⚠️ Capacité maximale atteinte
                    </p>
                  </div>
                )}
              </div>

              {/* Enrolled Students */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Étudiants inscrits ({enrolledStudents.length})
                </h3>
                {enrolledStudents.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <Users className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Aucun étudiant inscrit</p>
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Étudiant
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Paiement
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Validation
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Statut
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {enrolledStudents.map((student) => (
                          <tr key={student.enrollment_id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {student.student_name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  @{student.student_username}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="space-y-1">
                                {getPaymentStatusBadge(student.payment_status)}
                                {student.remaining_amount !== undefined && (
                                  <p className="text-xs text-gray-500">
                                    Reste: {student.remaining_amount.toFixed(2)} MAD
                                  </p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() => handleToggleValidation(student)}
                                className={`p-1.5 rounded-full ${
                                  student.validation_status === 'valide'
                                    ? 'bg-green-100 text-green-600 hover:bg-green-200'
                                    : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                                }`}
                                title={student.validation_status === 'valide' ? 'Validé' : 'Non validé'}
                              >
                                {student.validation_status === 'valide' ? (
                                  <CheckCircle className="h-5 w-5" />
                                ) : (
                                  <XCircle className="h-5 w-5" />
                                )}
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              {getStatusBadge(student.enrollment_status)}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => setStudentForPayment(student)}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50 p-2 rounded"
                                  title="Gérer paiements"
                                >
                                  <DollarSign className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() =>
                                    handleUnenroll(student.student_id, student.student_name)
                                  }
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2 rounded"
                                  title="Désinscrire"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Add Students Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Ajouter des étudiants
                </h3>

                {/* Search */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Rechercher un étudiant..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Available Students */}
                {filteredAvailableStudents.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-500">
                      {searchTerm
                        ? 'Aucun étudiant trouvé'
                        : 'Tous les étudiants sont déjà inscrits'}
                    </p>
                  </div>
                ) : (
                  <div className="border rounded-lg max-h-64 overflow-y-auto">
                    <div className="divide-y divide-gray-200">
                      {filteredAvailableStudents.map((student) => (
                        <label
                          key={student.id}
                          className="flex items-center p-3 hover:bg-gray-50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedStudents.includes(student.id)}
                            onChange={() => toggleStudentSelection(student.id)}
                            className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <div className="ml-3 flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {student.full_name}
                            </p>
                            <p className="text-xs text-gray-500">@{student.username}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {selectedStudents.length > 0 && (
                  <div className="mt-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <p className="text-sm text-blue-800">
                      {selectedStudents.length} étudiant(s) sélectionné(s)
                    </p>
                    <Button
                      onClick={handleEnroll}
                      disabled={isSubmitting || capacityReached}
                      className="flex items-center gap-2"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Inscription...</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="h-4 w-4" />
                          <span>Inscrire</span>
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>

      {/* Payment Manager Modal */}
      {studentForPayment && (
        <StudentPaymentManager
          student={studentForPayment}
          onClose={() => setStudentForPayment(null)}
        />
      )}
    </div>
  );
};
