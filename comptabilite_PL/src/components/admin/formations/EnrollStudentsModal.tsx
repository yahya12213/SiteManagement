import React, { useState } from 'react';
import { X, Users, UserPlus, UserMinus, Search, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAvailableStudents, useEnrollStudents, useUnenrollStudent, useSession } from '@/hooks/useFormations';
import type { FormationSession } from '@/types/formations';

interface EnrollStudentsModalProps {
  session: FormationSession;
  onClose: () => void;
}

export const EnrollStudentsModal: React.FC<EnrollStudentsModalProps> = ({ session, onClose }) => {
  const { data: sessionDetails, refetch: refetchSession } = useSession(session.id);
  const { data: availableStudents, isLoading } = useAvailableStudents(session.id);
  const enrollStudents = useEnrollStudents();
  const unenrollStudent = useUnenrollStudent();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isEnrolling, setIsEnrolling] = useState(false);

  const enrolledStudents = sessionDetails?.students || [];

  const filteredAvailableStudents = availableStudents?.filter(student =>
    student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredEnrolledStudents = enrolledStudents.filter(student =>
    student.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.student_username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev =>
      prev.includes(studentId)
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleEnroll = async () => {
    if (selectedStudents.length === 0) return;

    setIsEnrolling(true);

    try {
      await enrollStudents.mutateAsync({
        sessionId: session.id,
        data: { student_ids: selectedStudents },
      });

      setSelectedStudents([]);
      refetchSession();
    } catch (error: any) {
      console.error('Error enrolling students:', error);
      alert(error.message || 'Erreur lors de l\'inscription des étudiants');
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleUnenroll = async (studentId: string, studentName: string) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir désinscrire ${studentName} ?`)) {
      return;
    }

    try {
      await unenrollStudent.mutateAsync({
        sessionId: session.id,
        studentId,
      });
      refetchSession();
    } catch (error: any) {
      console.error('Error unenrolling student:', error);
      alert('Erreur lors de la désinscription');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Gérer les inscriptions
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {session.name}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Search bar */}
        <div className="p-6 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Rechercher un étudiant..."
              className="pl-10"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Available students */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">
                  Étudiants disponibles ({filteredAvailableStudents?.length || 0})
                </h3>
                {selectedStudents.length > 0 && (
                  <Button
                    size="sm"
                    onClick={handleEnroll}
                    disabled={isEnrolling}
                    className="flex items-center gap-2"
                  >
                    {isEnrolling ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        <span>...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4" />
                        <span>Inscrire ({selectedStudents.length})</span>
                      </>
                    )}
                  </Button>
                )}
              </div>

              {isLoading && (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                </div>
              )}

              {filteredAvailableStudents && filteredAvailableStudents.length > 0 ? (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {filteredAvailableStudents.map((student) => (
                    <div
                      key={student.id}
                      onClick={() => toggleStudentSelection(student.id)}
                      className={`p-3 border rounded-lg cursor-pointer transition-all ${
                        selectedStudents.includes(student.id)
                          ? 'bg-blue-50 border-blue-300'
                          : 'bg-white hover:bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{student.full_name}</p>
                          <p className="text-xs text-gray-500">{student.username}</p>
                        </div>
                        {selectedStudents.includes(student.id) && (
                          <CheckCircle className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                  <Users className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    {searchTerm ? 'Aucun étudiant trouvé' : 'Tous les étudiants sont déjà inscrits'}
                  </p>
                </div>
              )}
            </div>

            {/* Enrolled students */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">
                Étudiants inscrits ({filteredEnrolledStudents.length})
                {session.max_capacity && (
                  <span className="text-gray-500 font-normal">
                    {' '}/ {session.max_capacity}
                  </span>
                )}
              </h3>

              {filteredEnrolledStudents.length > 0 ? (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {filteredEnrolledStudents.map((enrollment) => (
                    <div
                      key={enrollment.enrollment_id}
                      className="p-3 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{enrollment.student_name}</p>
                          <p className="text-xs text-gray-500">
                            {enrollment.student_username} • Inscrit le{' '}
                            {new Date(enrollment.enrollment_date).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnenroll(enrollment.student_id, enrollment.student_name)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <UserMinus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                  <Users className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    {searchTerm ? 'Aucun étudiant trouvé' : 'Aucun étudiant inscrit'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t">
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </div>
      </div>
    </div>
  );
};
