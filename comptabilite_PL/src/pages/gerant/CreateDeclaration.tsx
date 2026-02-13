import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Save, AlertCircle } from 'lucide-react';
import {
  useGerantSegments,
  useGerantCities,
  useProfessorsBySegmentCity,
  usePublishedSheetForSegment,
  useCreateDeclarationForProfessor,
} from '@/hooks/useGerantDeclarations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';

const CreateDeclaration: React.FC = () => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { data: segments, isLoading: loadingSegments } = useGerantSegments();
  const { data: allCities, isLoading: loadingCities } = useGerantCities();

  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('');
  const [selectedCityId, setSelectedCityId] = useState<string>('');
  const [selectedProfessorId, setSelectedProfessorId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  // URL de retour selon le rôle
  const returnUrl = isAdmin ? '/admin/declarations' : '/gerant/declarations';

  // Filtrer les villes par le segment sélectionné
  const filteredCities = allCities?.filter((city) => city.segment_id === selectedSegmentId) || [];

  // Charger les professeurs et la fiche de calcul uniquement si segment et ville sélectionnés
  const { data: professors, isLoading: loadingProfessors } = useProfessorsBySegmentCity(
    selectedSegmentId,
    selectedCityId
  );

  const { data: calculationSheets, isLoading: loadingSheet } = usePublishedSheetForSegment(
    selectedSegmentId
  );

  // Prendre la première fiche publiée pour le segment
  const calculationSheet = calculationSheets && calculationSheets.length > 0 ? calculationSheets[0] : null;

  const createDeclaration = useCreateDeclarationForProfessor();

  // Réinitialiser la ville quand on change de segment
  useEffect(() => {
    setSelectedCityId('');
    setSelectedProfessorId('');
  }, [selectedSegmentId]);

  // Réinitialiser le professeur quand on change de ville
  useEffect(() => {
    setSelectedProfessorId('');
  }, [selectedCityId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validations
    if (!selectedSegmentId) {
      setError('Veuillez sélectionner un segment');
      return;
    }

    if (!selectedCityId) {
      setError('Veuillez sélectionner une ville');
      return;
    }

    if (!calculationSheet) {
      setError('Aucune fiche de calcul publiée pour ce segment');
      return;
    }

    if (!selectedProfessorId) {
      setError('Veuillez sélectionner un professeur');
      return;
    }

    if (!startDate || !endDate) {
      setError('Veuillez renseigner les dates de session');
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      setError('La date de début doit être antérieure à la date de fin');
      return;
    }

    try {
      await createDeclaration.mutateAsync({
        professor_id: selectedProfessorId,
        calculation_sheet_id: calculationSheet.id,
        segment_id: selectedSegmentId,
        city_id: selectedCityId,
        start_date: startDate,
        end_date: endDate,
      });

      navigate(returnUrl);
    } catch (err) {
      console.error('Error creating declaration:', err);
      setError('Erreur lors de la création de la déclaration');
    }
  };

  if (loadingSegments || loadingCities) {
    return (
      <AppLayout
        title="Créer une Déclaration"
        subtitle="Assigner une fiche de session à un professeur"
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-lg text-gray-600">Chargement...</div>
        </div>
      </AppLayout>
    );
  }

  if (!segments || segments.length === 0) {
    return (
      <AppLayout
        title="Créer une Déclaration"
        subtitle="Assigner une fiche de session à un professeur"
      >
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
              <p className="text-lg text-gray-700 font-medium mb-2">
                Aucun segment assigné
              </p>
              <p className="text-sm text-gray-500">
                Contactez un administrateur pour vous assigner des segments et villes.
              </p>
            </div>
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Créer une Déclaration"
      subtitle="Assigner une fiche de session à un professeur"
    >
      <div className="space-y-6">
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Informations de la déclaration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Erreur */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {/* Étape 1 : Segment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Segment <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedSegmentId}
                  onChange={(e) => setSelectedSegmentId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Sélectionnez un segment</option>
                  {segments?.map((segment) => (
                    <option key={segment.id} value={segment.id}>
                      {segment.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Étape 2 : Ville */}
              {selectedSegmentId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ville <span className="text-red-500">*</span>
                  </label>
                  {filteredCities.length > 0 ? (
                    <select
                      value={selectedCityId}
                      onChange={(e) => setSelectedCityId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Sélectionnez une ville</option>
                      {filteredCities.map((city) => (
                        <option key={city.id} value={city.id}>
                          {city.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        Aucune ville assignée pour ce segment. Contactez un administrateur.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Étape 3 : Fiche de calcul (affichage automatique) */}
              {selectedSegmentId && selectedCityId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Fiche de calcul
                  </label>
                  {loadingSheet ? (
                    <div className="text-sm text-gray-500">Chargement...</div>
                  ) : calculationSheet ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm font-medium text-blue-900">
                        {calculationSheet.title}
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        Date: {calculationSheet.sheet_date}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <p className="text-sm text-red-800">
                        ⚠️ Aucune fiche de calcul publiée pour ce segment
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Étape 4 : Professeur */}
              {selectedSegmentId && selectedCityId && calculationSheet && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Professeur <span className="text-red-500">*</span>
                  </label>
                  {loadingProfessors ? (
                    <div className="text-sm text-gray-500">Chargement des professeurs...</div>
                  ) : professors && professors.length > 0 ? (
                    <select
                      value={selectedProfessorId}
                      onChange={(e) => setSelectedProfessorId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Sélectionnez un professeur</option>
                      {professors.map((prof) => (
                        <option key={prof.id} value={prof.id}>
                          {prof.full_name} ({prof.username})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-sm text-yellow-800">
                        Aucun professeur n'a à la fois ce segment et cette ville assignés.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Étape 5 : Dates */}
              {selectedProfessorId && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date de début <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date de fin <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="mt-6 flex gap-3 justify-end">
            <Link to={returnUrl}>
              <Button type="button" variant="outline">
                Annuler
              </Button>
            </Link>
            <Button
              type="submit"
              disabled={
                !selectedSegmentId ||
                !selectedCityId ||
                !selectedProfessorId ||
                !startDate ||
                !endDate ||
                !calculationSheet ||
                createDeclaration.isPending
              }
            >
              <Save className="w-4 h-4 mr-2" />
              {createDeclaration.isPending ? 'Création...' : 'Créer la déclaration'}
            </Button>
          </div>
        </form>
      </div>
    </AppLayout>
  );
};

export default CreateDeclaration;
