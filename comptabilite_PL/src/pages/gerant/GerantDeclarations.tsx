import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Filter } from 'lucide-react';
import { useGerantDeclarations } from '@/hooks/useGerantDeclarations';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import DeclarationStatusBadge from '@/components/professor/DeclarationStatusBadge';
import { AppLayout } from '@/components/layout/AppLayout';

const GerantDeclarations: React.FC = () => {
  const { data: declarations, isLoading } = useGerantDeclarations();
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filteredDeclarations = declarations?.filter((decl) => {
    if (statusFilter === 'all') return true;
    return decl.status === statusFilter;
  });

  const stats = {
    total: declarations?.length || 0,
    a_declarer: declarations?.filter((d) => d.status === 'a_declarer').length || 0,
    soumise: declarations?.filter((d) => d.status === 'soumise').length || 0,
    en_cours: declarations?.filter((d) => d.status === 'en_cours').length || 0,
    approuvee: declarations?.filter((d) => d.status === 'approuvee').length || 0,
    refusee: declarations?.filter((d) => d.status === 'refusee').length || 0,
  };

  const filterButtons = [
    { label: 'Toutes', value: 'all', count: stats.total },
    { label: 'À déclarer', value: 'a_declarer', count: stats.a_declarer },
    { label: 'Soumises', value: 'soumise', count: stats.soumise },
    { label: 'En cours', value: 'en_cours', count: stats.en_cours },
    { label: 'Approuvées', value: 'approuvee', count: stats.approuvee },
    { label: 'Refusées', value: 'refusee', count: stats.refusee },
  ];

  if (isLoading) {
    return (
      <AppLayout
        title="Mes Déclarations Créées"
        subtitle="Suivez les déclarations que vous avez assignées aux professeurs"
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-600">Chargement...</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Mes Déclarations Créées"
      subtitle="Suivez les déclarations que vous avez assignées aux professeurs"
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex justify-end">
          <Link to="/gerant/create-declaration">
            <Button>
              <Filter className="w-4 h-4 mr-2" />
              Créer une déclaration
            </Button>
          </Link>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                <p className="text-xs text-gray-600 mt-1">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{stats.a_declarer}</p>
                <p className="text-xs text-gray-600 mt-1">À déclarer</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{stats.soumise}</p>
                <p className="text-xs text-gray-600 mt-1">Soumises</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{stats.en_cours}</p>
                <p className="text-xs text-gray-600 mt-1">En cours</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{stats.approuvee}</p>
                <p className="text-xs text-gray-600 mt-1">Approuvées</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{stats.refusee}</p>
                <p className="text-xs text-gray-600 mt-1">Refusées</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex flex-wrap gap-2">
            {filterButtons.map((btn) => (
              <Button
                key={btn.value}
                variant={statusFilter === btn.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(btn.value)}
              >
                {btn.label} ({btn.count})
              </Button>
            ))}
          </div>
        </div>

        {/* Liste des déclarations */}
        <div className="bg-white rounded-lg shadow">
          {filteredDeclarations && filteredDeclarations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Professeur
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Segment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ville
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Fiche de calcul
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dates
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date création
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredDeclarations.map((declaration) => (
                    <tr key={declaration.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {declaration.professor_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {declaration.segment_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {declaration.city_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {declaration.sheet_title || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(declaration.start_date).toLocaleDateString('fr-FR')} - {new Date(declaration.end_date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <DeclarationStatusBadge status={declaration.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(declaration.created_at).toLocaleDateString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-500">Aucune déclaration trouvée.</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default GerantDeclarations;
