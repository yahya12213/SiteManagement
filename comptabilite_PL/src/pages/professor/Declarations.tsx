import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Eye, Edit3, Trash2, Send, FileText, AlertCircle } from 'lucide-react';
import { useProfessorDeclarations, useDeleteDeclaration, useSubmitDeclaration } from '@/hooks/useProfessorDeclarations';
import DeclarationStatusBadge from '@/components/professor/DeclarationStatusBadge';
import NewDeclarationModal from '@/components/professor/NewDeclarationModal';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';

const Declarations: React.FC = () => {
  const { data: declarations, isLoading } = useProfessorDeclarations();
  const deleteDeclaration = useDeleteDeclaration();
  const submitDeclaration = useSubmitDeclaration();
  const { user } = useAuth();

  // Le rôle "impression" voit toutes les déclarations en lecture seule
  const isImpressionRole = user?.role === 'impression';

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);

  const handleDelete = async (id: string) => {
    if (window.confirm('Êtes-vous sûr de vouloir supprimer cette déclaration ?')) {
      try {
        await deleteDeclaration.mutateAsync(id);
      } catch (error) {
        console.error('Error deleting declaration:', error);
        alert('Erreur lors de la suppression de la déclaration');
      }
    }
  };

  const handleSubmit = async (id: string) => {
    if (window.confirm('Voulez-vous soumettre cette déclaration pour validation ?')) {
      try {
        await submitDeclaration.mutateAsync(id);
      } catch (error) {
        console.error('Error submitting declaration:', error);
        alert('Erreur lors de la soumission de la déclaration');
      }
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  if (isLoading) {
    return (
      <AppLayout
        title="Mes Déclarations"
        subtitle="Gérez vos déclarations de sessions"
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des déclarations...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Mes Déclarations"
      subtitle="Gérez vos déclarations de sessions"
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex justify-end">
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nouvelle Déclaration
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-sm text-gray-600">Total</p>
            <p className="text-2xl font-bold text-gray-900">{declarations?.length || 0}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-sm text-gray-600">À modifier</p>
            <p className="text-2xl font-bold text-yellow-600">
              {declarations?.filter(d => (d.status as any) === 'en_cours').length || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-sm text-gray-600">À déclarer</p>
            <p className="text-2xl font-bold text-orange-600">
              {declarations?.filter(d => (d.status as any) === 'a_declarer').length || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-sm text-gray-600">Brouillons</p>
            <p className="text-2xl font-bold text-gray-500">
              {declarations?.filter(d => d.status === 'brouillon').length || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-sm text-gray-600">Soumises</p>
            <p className="text-2xl font-bold text-blue-600">
              {declarations?.filter(d => d.status === 'soumise').length || 0}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-4">
            <p className="text-sm text-gray-600">Approuvées</p>
            <p className="text-2xl font-bold text-green-600">
              {declarations?.filter(d => d.status === 'approuvee').length || 0}
            </p>
          </div>
        </div>

        {/* Table */}
        {!declarations || declarations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Aucune déclaration
            </h3>
            <p className="text-gray-500 mb-6">
              Commencez par créer votre première déclaration
            </p>
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Nouvelle Déclaration
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {isImpressionRole && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Professeur
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Segment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ville
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date Début
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date Fin
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    {!isImpressionRole && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {declarations.map((declaration) => (
                    <React.Fragment key={declaration.id}>
                      <tr className="hover:bg-gray-50">
                      {isImpressionRole && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {declaration.professor_name || 'N/A'}
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {declaration.segment_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{declaration.city_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(declaration.start_date)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {formatDate(declaration.end_date)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <DeclarationStatusBadge status={declaration.status} />
                      </td>
                      {!isImpressionRole && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end gap-2">
                            {/* Voir/Modifier */}
                            <Link
                              to={`/professor/declarations/${declaration.id}/fill`}
                              className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded transition-colors"
                              title={
                                declaration.status === 'brouillon' || declaration.status === 'refusee' || (declaration.status as any) === 'a_declarer' || (declaration.status as any) === 'en_cours'
                                  ? 'Remplir'
                                  : 'Voir'
                              }
                            >
                              {declaration.status === 'brouillon' || declaration.status === 'refusee' || (declaration.status as any) === 'a_declarer' || (declaration.status as any) === 'en_cours' ? (
                                <Edit3 className="w-4 h-4" />
                              ) : (
                                <Eye className="w-4 h-4" />
                              )}
                            </Link>

                            {/* Soumettre */}
                            {(declaration.status === 'brouillon' || (declaration.status as any) === 'a_declarer' || (declaration.status as any) === 'en_cours') && (
                              <button
                                onClick={() => handleSubmit(declaration.id)}
                                className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded transition-colors"
                                title="Soumettre"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                            )}

                            {/* Supprimer - seulement pour brouillons créés par le prof */}
                            {declaration.status === 'brouillon' && (
                              <button
                                onClick={() => handleDelete(declaration.id)}
                                className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded transition-colors"
                                title="Supprimer"
                                disabled={deleteDeclaration.isPending}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>

                    {/* Alerte pour modifications demandées */}
                    {(declaration.status as any) === 'en_cours' && declaration.rejection_reason && (
                      <tr>
                        <td colSpan={isImpressionRole ? 6 : 6} className="px-6 py-3 bg-yellow-50 border-l-4 border-yellow-400">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-semibold text-yellow-900">Modifications demandées par l'administrateur</p>
                              <p className="text-sm text-yellow-800 mt-1">{declaration.rejection_reason}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* New Declaration Modal */}
      {isNewModalOpen && (
        <NewDeclarationModal onClose={() => setIsNewModalOpen(false)} />
      )}
    </AppLayout>
  );
};

export default Declarations;
