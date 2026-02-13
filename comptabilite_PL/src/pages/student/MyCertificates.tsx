import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useStudentCertificates } from '@/hooks/useCertificates';
import { generateCertificatePDF } from '@/lib/utils/certificateGenerator';
import {
  Award,
  Download,
  Calendar,
  BookOpen,
  Star,
  FileCheck,
  CheckCircle,
} from 'lucide-react';

export const MyCertificates: React.FC = () => {
  const { user } = useAuth();
  const { data, isLoading, error } = useStudentCertificates(user?.id || null);

  const handleDownload = async (certificate: any) => {
    await generateCertificatePDF(certificate);
  };

  if (isLoading) {
    return (
      <AppLayout title="Mes Certificats" subtitle="Consultez et téléchargez vos certificats">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="Mes Certificats" subtitle="Consultez et téléchargez vos certificats">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Erreur lors du chargement des certificats</p>
        </div>
      </AppLayout>
    );
  }

  const certificates = data?.certificates || [];

  return (
    <AppLayout title="Mes Certificats" subtitle="Consultez et téléchargez vos certificats">
      <div className="space-y-6">
        {/* Statistiques rapides */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Total Certificats</p>
                <p className="text-4xl font-bold mt-2">{certificates.length}</p>
              </div>
              <Award className="h-12 w-12 opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Formations Complétées</p>
                <p className="text-4xl font-bold mt-2">{certificates.length}</p>
              </div>
              <CheckCircle className="h-12 w-12 opacity-80" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm opacity-90">Note Moyenne</p>
                <p className="text-4xl font-bold mt-2">
                  {certificates.length > 0
                    ? (
                        certificates
                          .filter((c) => c.grade !== null)
                          .reduce((sum, c) => sum + (c.grade || 0), 0) /
                        certificates.filter((c) => c.grade !== null).length
                      ).toFixed(1)
                    : '0'}
                  %
                </p>
              </div>
              <Star className="h-12 w-12 opacity-80" />
            </div>
          </div>
        </div>

        {/* Liste des certificats */}
        {certificates.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
            <FileCheck className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucun certificat disponible
            </h3>
            <p className="text-gray-600">
              Complétez vos formations pour obtenir vos certificats de réussite !
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {certificates.map((certificate) => {
              const completionDate = new Date(certificate.completion_date).toLocaleDateString(
                'fr-FR',
                {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }
              );

              const issuedDate = new Date(certificate.issued_at).toLocaleDateString('fr-FR');

              return (
                <div
                  key={certificate.id}
                  className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow overflow-hidden"
                >
                  {/* En-tête du certificat avec dégradé */}
                  <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Award className="h-5 w-5" />
                          <span className="text-sm font-medium opacity-90">
                            Certificat de Réussite
                          </span>
                        </div>
                        <h3 className="text-xl font-bold mb-2">
                          {certificate.formation_title}
                        </h3>
                      </div>
                      {certificate.grade !== null && certificate.grade !== undefined && (
                        <div className="bg-white/20 rounded-lg px-3 py-2 text-center backdrop-blur-sm">
                          <p className="text-2xl font-bold">{certificate.grade}%</p>
                          <p className="text-xs opacity-90">Note</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Corps du certificat */}
                  <div className="p-6 space-y-4">
                    {/* Informations */}
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <Calendar className="h-4 w-4 text-blue-500" />
                        <span>Complété le {completionDate}</span>
                      </div>

                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <BookOpen className="h-4 w-4 text-green-500" />
                        <span>Délivré le {issuedDate}</span>
                      </div>

                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <FileCheck className="h-4 w-4 text-purple-500" />
                        <span className="font-mono text-xs">
                          N° {certificate.certificate_number}
                        </span>
                      </div>
                    </div>

                    {/* Bouton de téléchargement */}
                    <button
                      onClick={() => handleDownload(certificate)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                    >
                      <Download className="h-5 w-5" />
                      Télécharger le Certificat
                    </button>
                  </div>

                  {/* Badge de succès */}
                  <div className="bg-green-50 border-t border-green-100 px-6 py-3">
                    <div className="flex items-center gap-2 text-green-700 text-sm font-medium">
                      <CheckCircle className="h-4 w-4" />
                      Formation complétée avec succès
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Section informative */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start gap-4">
            <div className="bg-blue-100 p-3 rounded-lg">
              <Award className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 mb-2">
                À propos de vos certificats
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Les certificats sont générés automatiquement après complétion d'une formation</li>
                <li>• Chaque certificat contient un numéro unique pour vérification</li>
                <li>• Vous pouvez télécharger vos certificats à tout moment</li>
                <li>• Les certificats sont au format PDF professionnel</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};
