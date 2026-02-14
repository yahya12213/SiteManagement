import React, { useState, useMemo } from 'react';
import { Search, Users, UserCheck, UserX, Monitor, Building2, UserPlus } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useStudentsWithSessions, useStudentsListStats, type StudentWithSession } from '@/hooks/useStudentsList';
import { AssignSessionModal } from '@/components/admin/students/AssignSessionModal';

type FilterType = 'all' | 'with_session' | 'without_session';

export const StudentsListPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [selectedStudent, setSelectedStudent] = useState<StudentWithSession | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const { data: students, isLoading, error } = useStudentsWithSessions();
  const stats = useStudentsListStats(students);

  // Filtrer les étudiants
  const filteredStudents = useMemo((): StudentWithSession[] => {
    if (!students) return [];

    return students.filter((student: StudentWithSession) => {
      // Filtre par recherche
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        student.nom.toLowerCase().includes(searchLower) ||
        student.prenom.toLowerCase().includes(searchLower) ||
        student.cin.toLowerCase().includes(searchLower) ||
        (student.phone && student.phone.includes(searchTerm));

      if (!matchesSearch) return false;

      // Filtre par statut session
      if (filter === 'with_session') return student.has_session;
      if (filter === 'without_session') return !student.has_session;

      return true;
    });
  }, [students, searchTerm, filter]);

  const handleAssignClick = (student: StudentWithSession) => {
    setSelectedStudent(student);
    setShowAssignModal(true);
  };

  const handleCloseModal = () => {
    setShowAssignModal(false);
    setSelectedStudent(null);
  };

  if (error) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            Erreur lors du chargement des étudiants: {(error as Error).message}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Liste des Étudiants</h1>
            <p className="text-gray-500 mt-1">Tous les étudiants inscrits dans le système</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Étudiants</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <UserCheck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Avec Session</p>
                <p className="text-2xl font-bold text-green-600">{stats.withSession}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <UserX className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-gray-500">Sans Session</p>
                <p className="text-2xl font-bold text-red-600">{stats.withoutSession}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Rechercher par nom, prénom, CIN ou téléphone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              onClick={() => setFilter('all')}
              size="sm"
            >
              Tous
            </Button>
            <Button
              variant={filter === 'with_session' ? 'default' : 'outline'}
              onClick={() => setFilter('with_session')}
              size="sm"
            >
              Avec Session
            </Button>
            <Button
              variant={filter === 'without_session' ? 'default' : 'outline'}
              onClick={() => setFilter('without_session')}
              size="sm"
              className={filter === 'without_session' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              Sans Session
            </Button>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {searchTerm || filter !== 'all'
                ? 'Aucun étudiant ne correspond à vos critères'
                : 'Aucun étudiant dans le système'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nom
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date d'insertion
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Prénom
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CIN
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Téléphone
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ville
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Session
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Formation
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredStudents.map((student) => (
                    <tr
                      key={student.enrollment_id || student.id}
                      className={`${
                        !student.has_session
                          ? 'bg-red-50 hover:bg-red-100'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className={`px-4 py-3 text-sm font-medium ${!student.has_session ? 'text-red-800' : 'text-gray-900'}`}>
                        {student.nom}
                      </td>
                      <td className={`px-4 py-3 text-sm ${!student.has_session ? 'text-red-700' : 'text-gray-600'}`}>
                        {student.created_at
                          ? new Date(student.created_at).toLocaleDateString('fr-FR')
                          : '-'}
                      </td>
                      <td className={`px-4 py-3 text-sm ${!student.has_session ? 'text-red-800' : 'text-gray-900'}`}>
                        {student.prenom}
                      </td>
                      <td className={`px-4 py-3 text-sm ${!student.has_session ? 'text-red-700' : 'text-gray-600'}`}>
                        {student.cin}
                      </td>
                      <td className={`px-4 py-3 text-sm ${!student.has_session ? 'text-red-700' : 'text-gray-600'}`}>
                        {student.phone}
                      </td>
                      <td className={`px-4 py-3 text-sm ${!student.has_session ? 'text-red-700' : 'text-gray-600'}`}>
                        {student.ville || '-'}
                      </td>
                      <td className={`px-4 py-3 text-sm ${!student.has_session ? 'text-red-700 font-medium' : 'text-gray-600'}`}>
                        {student.session_titre || (
                          <span className="text-red-600 font-medium">Non affecté</span>
                        )}
                      </td>
                      <td className={`px-4 py-3 text-sm ${!student.has_session ? 'text-red-700' : 'text-gray-600'}`}>
                        {student.formation_titre || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {student.session_type ? (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                              student.session_type === 'en_ligne'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {student.session_type === 'en_ligne' ? (
                              <>
                                <Monitor className="w-3 h-3" />
                                En ligne
                              </>
                            ) : (
                              <>
                                <Building2 className="w-3 h-3" />
                                Présentielle
                              </>
                            )}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {!student.has_session && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleAssignClick(student)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          >
                            <UserPlus className="w-4 h-4 mr-1" />
                            Affecter
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Nombre de résultats */}
        {!isLoading && (
          <div className="text-sm text-gray-500 text-center">
            {filteredStudents.length} étudiant(s) affiché(s)
          </div>
        )}
      </div>

      {/* Modal d'affectation */}
      {showAssignModal && selectedStudent && (
        <AssignSessionModal
          student={selectedStudent}
          onClose={handleCloseModal}
        />
      )}
    </AppLayout>
  );
};

export default StudentsListPage;
