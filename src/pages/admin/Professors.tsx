import { useState } from 'react';
import { Plus, Search, Edit2, Trash2, Users, MapPin, Layers, Eye, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useProfessors, useDeleteProfessor } from '@/hooks/useProfessors';
import { usePermission } from '@/hooks/usePermission';
import ProfessorFormModal from '@/components/admin/ProfessorFormModal';
import AssignCitiesModal from '@/components/admin/AssignCitiesModal';
import AssignSegmentsModal from '@/components/admin/AssignSegmentsModal';
import ViewProfessorAssignmentsModal from '@/components/admin/ViewProfessorAssignmentsModal';

export default function Professors() {
  const navigate = useNavigate();
  const { accounting } = usePermission();
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAssignCitiesOpen, setIsAssignCitiesOpen] = useState(false);
  const [isAssignSegmentsOpen, setIsAssignSegmentsOpen] = useState(false);
  const [isViewAssignmentsOpen, setIsViewAssignmentsOpen] = useState(false);
  const [selectedProfessorId, setSelectedProfessorId] = useState<string | null>(null);
  const [selectedProfessor, setSelectedProfessor] = useState<{ id: string; name: string } | null>(null);

  const { data: professors = [], isLoading } = useProfessors();
  const deleteProfessor = useDeleteProfessor();

  const filteredProfessors = professors.filter((professor) =>
    professor.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    professor.username.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (professorId: string) => {
    setSelectedProfessorId(professorId);
    setIsFormOpen(true);
  };

  const handleDelete = async (professorId: string, professorName: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer le professeur "${professorName}" ?\n\nToutes ses affectations seront également supprimées.`)) {
      try {
        await deleteProfessor.mutateAsync(professorId);
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression du professeur');
      }
    }
  };

  const handleViewAssignments = (professor: { id: string; full_name: string }) => {
    setSelectedProfessor({ id: professor.id, name: professor.full_name });
    setIsViewAssignmentsOpen(true);
  };

  const handleAssignSegments = (professor: { id: string; full_name: string }) => {
    setSelectedProfessor({ id: professor.id, name: professor.full_name });
    setIsAssignSegmentsOpen(true);
  };

  const handleAssignCities = (professor: { id: string; full_name: string }) => {
    setSelectedProfessor({ id: professor.id, name: professor.full_name });
    setIsAssignCitiesOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedProfessorId(null);
  };

  const handleCloseViewAssignments = () => {
    setIsViewAssignmentsOpen(false);
    setSelectedProfessor(null);
  };

  const handleCloseAssignSegments = () => {
    setIsAssignSegmentsOpen(false);
    setSelectedProfessor(null);
  };

  const handleCloseAssignCities = () => {
    setIsAssignCitiesOpen(false);
    setSelectedProfessor(null);
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Retour au tableau de bord"
          >
            <ArrowLeft className="w-6 h-6 text-gray-600" />
          </button>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-8 h-8 text-purple-600" />
            Gestion des Professeurs
          </h1>
        </div>
        <p className="text-gray-600 mt-2 ml-14">Créer et gérer les comptes professeurs</p>
      </div>

      {/* Barre d'actions */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          {/* Recherche */}
          <div className="relative flex-1 md:w-80 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Rechercher un professeur..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>

          {/* Bouton Ajouter */}
          {accounting.canCreateProfessor && (
            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="w-full md:w-auto bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Nouveau Professeur
            </button>
          )}
        </div>
      </div>

      {/* Liste des professeurs */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      ) : filteredProfessors.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">
            {searchTerm
              ? 'Aucun professeur trouvé'
              : 'Aucun professeur enregistré'}
          </p>
          <p className="text-gray-400 mt-2">
            {searchTerm
              ? 'Essayez de modifier vos critères de recherche'
              : 'Commencez par créer un nouveau professeur'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nom complet
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nom d'utilisateur
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date de création
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProfessors.map((professor) => (
                  <tr key={professor.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                          <Users className="w-5 h-5 text-purple-600" />
                        </div>
                        <span className="text-sm font-medium text-gray-900">
                          {professor.full_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-mono text-gray-600">@{professor.username}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(professor.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleViewAssignments(professor)}
                          className="text-purple-600 hover:text-purple-900 p-2 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Voir les affectations"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {accounting.canAssignProfessorCities && (
                          <button
                            type="button"
                            onClick={() => handleAssignSegments(professor)}
                            className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Affecter des segments"
                          >
                            <Layers className="w-4 h-4" />
                          </button>
                        )}
                        {accounting.canAssignProfessorCities && (
                          <button
                            type="button"
                            onClick={() => handleAssignCities(professor)}
                            className="text-green-600 hover:text-green-900 p-2 hover:bg-green-50 rounded-lg transition-colors"
                            title="Affecter des villes"
                          >
                            <MapPin className="w-4 h-4" />
                          </button>
                        )}
                        {accounting.canUpdateProfessor && (
                          <button
                            type="button"
                            onClick={() => handleEdit(professor.id)}
                            className="text-indigo-600 hover:text-indigo-900 p-2 hover:bg-indigo-50 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {accounting.canDeleteProfessor && (
                          <button
                            type="button"
                            onClick={() => handleDelete(professor.id, professor.full_name)}
                            className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Résumé */}
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Affichage de {filteredProfessors.length} professeur(s)
            </p>
          </div>
        </div>
      )}

      {/* Modal de formulaire */}
      {isFormOpen && (
        <ProfessorFormModal
          professorId={selectedProfessorId}
          onClose={handleCloseForm}
        />
      )}

      {/* Modal de visualisation des affectations */}
      {isViewAssignmentsOpen && selectedProfessor && (
        <ViewProfessorAssignmentsModal
          professorId={selectedProfessor.id}
          professorName={selectedProfessor.name}
          onClose={handleCloseViewAssignments}
        />
      )}

      {/* Modal d'affectation de segments */}
      {isAssignSegmentsOpen && selectedProfessor && (
        <AssignSegmentsModal
          professorId={selectedProfessor.id}
          professorName={selectedProfessor.name}
          onClose={handleCloseAssignSegments}
        />
      )}

      {/* Modal d'affectation de villes */}
      {isAssignCitiesOpen && selectedProfessor && (
        <AssignCitiesModal
          professorId={selectedProfessor.id}
          professorName={selectedProfessor.name}
          onClose={handleCloseAssignCities}
        />
      )}
    </div>
  );
}
