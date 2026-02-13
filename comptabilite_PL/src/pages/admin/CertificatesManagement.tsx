import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  useAllCertificates,
  useDeleteCertificate,
} from '@/hooks/useCertificates';
import { useFormations } from '@/hooks/useCours';
import { generateCertificatePDF } from '@/lib/utils/certificateGenerator';
import {
  Award,
  Download,
  Trash2,
  Search,
  Filter,
  Calendar,
  User,
  BookOpen,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';

export const CertificatesManagement: React.FC = () => {
  const { training } = usePermission();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFormation, setSelectedFormation] = useState<string>('');

  const { data: certificatesData, isLoading } = useAllCertificates({
    limit: 100,
    formation_id: selectedFormation || undefined,
  });
  const { data: formationsData } = useFormations();
  const deleteMutation = useDeleteCertificate();

  const certificates = certificatesData?.certificates || [];
  const formations = formationsData || [];

  // Filter certificates by search term
  const filteredCertificates = certificates.filter((cert) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      cert.student_name?.toLowerCase().includes(searchLower) ||
      cert.formation_title?.toLowerCase().includes(searchLower) ||
      cert.certificate_number.toLowerCase().includes(searchLower)
    );
  });

  const handleDownload = async (certificate: any) => {
    await generateCertificatePDF(certificate);
  };

  const handleDelete = async (certificateId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce certificat ?')) return;

    try {
      await deleteMutation.mutateAsync(certificateId);
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
      alert('Erreur lors de la suppression du certificat');
    }
  };

  // Statistiques
  const totalCertificates = certificates.length;
  const certificatesThisMonth = certificates.filter((cert) => {
    const issued = new Date(cert.issued_at);
    const now = new Date();
    return (
      issued.getMonth() === now.getMonth() && issued.getFullYear() === now.getFullYear()
    );
  }).length;

  const averageGrade =
    certificates.length > 0
      ? (
          certificates
            .filter((c) => c.grade !== null)
            .reduce((sum, c) => sum + (c.grade || 0), 0) /
          certificates.filter((c) => c.grade !== null).length
        ).toFixed(1)
      : '0';

  return (
    <AppLayout
      title="Gestion des Certificats"
      subtitle="Consulter et gérer tous les certificats émis"
    >
      <div className="space-y-6">
        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Total Certificats</p>
                <p className="text-4xl font-bold mt-2">{totalCertificates}</p>
              </div>
              <Award className="h-12 w-12 opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Ce mois-ci</p>
                <p className="text-4xl font-bold mt-2">{certificatesThisMonth}</p>
              </div>
              <Calendar className="h-12 w-12 opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Note Moyenne</p>
                <p className="text-4xl font-bold mt-2">{averageGrade}%</p>
              </div>
              <CheckCircle className="h-12 w-12 opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Formations</p>
                <p className="text-4xl font-bold mt-2">
                  {new Set(certificates.map((c) => c.formation_id)).size}
                </p>
              </div>
              <BookOpen className="h-12 w-12 opacity-80" />
            </div>
          </div>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Recherche */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher par étudiant, formation ou numéro..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Filtre par formation */}
            <div>
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <select
                  value={selectedFormation}
                  onChange={(e) => setSelectedFormation(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none"
                >
                  <option value="">Toutes les formations</option>
                  {formations.map((formation) => (
                    <option key={formation.id} value={formation.id}>
                      {formation.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Liste des certificats */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-lg font-semibold text-gray-900">
              Certificats ({filteredCertificates.length})
            </h2>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : filteredCertificates.length === 0 ? (
            <div className="p-12 text-center">
              <Award className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Aucun certificat trouvé
              </h3>
              <p className="text-gray-600">
                {searchTerm || selectedFormation
                  ? 'Essayez de modifier vos critères de recherche'
                  : 'Aucun certificat n\'a encore été généré'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Numéro
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Étudiant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Formation
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Note
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date émission
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredCertificates.map((certificate) => (
                    <tr key={certificate.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono text-gray-900">
                          {certificate.certificate_number}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-gray-400" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {certificate.student_name}
                            </p>
                            <p className="text-xs text-gray-500">{certificate.student_email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-900">
                            {certificate.formation_title}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {certificate.grade !== null && certificate.grade !== undefined ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                            {certificate.grade}%
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-600">
                        {new Date(certificate.issued_at).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          {training.canDownloadCertificate && (
                            <button
                              onClick={() => handleDownload(certificate)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Télécharger"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          )}
                          {training.canDeleteCertificate && (
                            <button
                              onClick={() => handleDelete(certificate.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Supprimer"
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <AlertCircle className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">
                À propos des certificats
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Les certificats sont générés automatiquement quand un étudiant complète une formation</li>
                <li>• Chaque certificat possède un numéro unique pour vérification</li>
                <li>• La suppression d'un certificat est définitive</li>
                <li>• Les certificats peuvent être téléchargés en PDF à tout moment</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};
