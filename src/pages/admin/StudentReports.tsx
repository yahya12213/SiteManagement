import React, { useState } from 'react';
import {
  Search,
  User,
  Mail,
  Calendar,
  BookOpen,
  Video,
  CheckCircle,
  XCircle,
  FileCheck,
  Download,
  Eye,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useStudentProgress } from '@/hooks/useAnalytics';
import { ProgressBar } from '@/components/student/ProgressBar';
import { exportStudentReportPDF, exportStudentReportCSV } from '@/lib/utils/exportUtils';

export const StudentReports: React.FC = () => {
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: studentProgress, isLoading } = useStudentProgress(selectedStudentId);

  const handleStudentSelect = (studentId: string) => {
    setSelectedStudentId(studentId);
  };

  const handleExportPDF = () => {
    if (studentProgress) {
      exportStudentReportPDF(studentProgress);
    }
  };

  const handleExportCSV = () => {
    if (studentProgress) {
      exportStudentReportCSV(studentProgress);
    }
  };

  return (
    <AppLayout
      title="Rapports Étudiants"
      subtitle="Consulter les rapports détaillés de progression des étudiants"
    >
      <div className="space-y-6">
        {/* Header Actions */}
        {selectedStudentId && (
          <div className="flex justify-end">
            <div className="flex gap-2">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                Export CSV
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                Export PDF
              </button>
            </div>
          </div>
        )}
        {!selectedStudentId && (
          <div className="flex gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              Export PDF
            </button>
          </div>
        )}
      </div>

      {/* Barre de recherche */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un étudiant par ID (pour test, utilisez un ID existant)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && searchTerm.trim()) {
                handleStudentSelect(searchTerm.trim());
              }
            }}
            className="w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <p className="text-sm text-gray-500 mt-2">
          Appuyez sur Entrée pour charger le rapport d'un étudiant
        </p>
      </div>

      {/* Contenu principal */}
      {isLoading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      )}

      {!isLoading && !selectedStudentId && (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <Eye className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Aucun étudiant sélectionné
          </h3>
          <p className="text-gray-600">
            Entrez l'ID d'un étudiant dans la barre de recherche pour afficher son rapport détaillé
          </p>
        </div>
      )}

      {!isLoading && selectedStudentId && studentProgress && (
        <div className="space-y-6">
          {/* Informations de l'étudiant */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-blue-500 p-4 rounded-full">
                <User className="h-8 w-8 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900">
                  {studentProgress.student.full_name}
                </h2>
                <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Mail className="h-4 w-4" />
                    {studentProgress.student.email}
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    Inscrit le {new Date(studentProgress.student.created_at).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              </div>
            </div>

            {/* Statistiques rapides */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                  <span className="text-sm font-medium text-blue-900">Formations</span>
                </div>
                <p className="text-3xl font-bold text-blue-600">
                  {studentProgress.enrollments.length}
                </p>
              </div>

              <div className="bg-green-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-medium text-green-900">Complétées</span>
                </div>
                <p className="text-3xl font-bold text-green-600">
                  {studentProgress.enrollments.filter(e => e.completed_at).length}
                </p>
              </div>

              <div className="bg-purple-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Video className="h-5 w-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-900">Vidéos</span>
                </div>
                <p className="text-3xl font-bold text-purple-600">
                  {studentProgress.enrollments.reduce((sum, e) => sum + e.completed_videos, 0)} /{' '}
                  {studentProgress.enrollments.reduce((sum, e) => sum + e.total_videos, 0)}
                </p>
              </div>

              <div className="bg-orange-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileCheck className="h-5 w-5 text-orange-600" />
                  <span className="text-sm font-medium text-orange-900">Tests Réussis</span>
                </div>
                <p className="text-3xl font-bold text-orange-600">
                  {studentProgress.enrollments.reduce((sum, e) => sum + e.passed_tests, 0)} /{' '}
                  {studentProgress.enrollments.reduce((sum, e) => sum + e.total_tests, 0)}
                </p>
              </div>
            </div>
          </div>

          {/* Formations inscrites */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Formations Inscrites</h3>
            </div>
            <div className="divide-y">
              {studentProgress.enrollments.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p>Aucune formation inscrite</p>
                </div>
              ) : (
                studentProgress.enrollments.map((enrollment) => {
                  const videoProgress = enrollment.total_videos > 0
                    ? (enrollment.completed_videos / enrollment.total_videos) * 100
                    : 0;
                  const testProgress = enrollment.total_tests > 0
                    ? (enrollment.passed_tests / enrollment.total_tests) * 100
                    : 0;

                  return (
                    <div key={enrollment.formation_id} className="p-6 hover:bg-gray-50">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 mb-2">
                            {enrollment.formation_title}
                          </h4>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>Inscrit le {new Date(enrollment.enrolled_at).toLocaleDateString('fr-FR')}</span>
                            {enrollment.completed_at && (
                              <span className="flex items-center gap-1 text-green-600">
                                <CheckCircle className="h-4 w-4" />
                                Complété le {new Date(enrollment.completed_at).toLocaleDateString('fr-FR')}
                              </span>
                            )}
                          </div>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            enrollment.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : enrollment.status === 'active'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {enrollment.status === 'completed' ? 'Complété' : enrollment.status === 'active' ? 'En cours' : 'Inactif'}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <ProgressBar
                            progress={videoProgress}
                            label={`Vidéos (${enrollment.completed_videos}/${enrollment.total_videos})`}
                            color="purple"
                            size="sm"
                          />
                        </div>
                        <div>
                          <ProgressBar
                            progress={testProgress}
                            label={`Tests réussis (${enrollment.passed_tests}/${enrollment.total_tests})`}
                            color="orange"
                            size="sm"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Historique des tests */}
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Historique des Tests</h3>
            </div>
            {studentProgress.test_history.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <FileCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                <p>Aucun test passé</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Formation
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Test
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Score
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Résultat
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {studentProgress.test_history.map((test) => {
                      const percentage = test.total_points > 0
                        ? ((test.score / test.total_points) * 100).toFixed(1)
                        : 0;
                      return (
                        <tr key={test.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {test.formation_title}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900">
                            {test.test_title}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="text-sm font-medium text-gray-900">
                              {test.score} / {test.total_points}
                            </div>
                            <div className="text-xs text-gray-500">{percentage}%</div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {test.passed ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                <CheckCircle className="h-4 w-4" />
                                Réussi
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                                <XCircle className="h-4 w-4" />
                                Échoué
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center text-sm text-gray-600">
                            {new Date(test.submitted_at).toLocaleDateString('fr-FR')}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </AppLayout>
  );
};
