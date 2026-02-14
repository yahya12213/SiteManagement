import React, { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import {
  useCreateDeclaration,
  useAvailableCalculationSheets,
  useProfessorSegments,
  useProfessorCities,
  type ProfessorCity,
} from '@/hooks/useProfessorDeclarations';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { profilesApi } from '@/lib/api/profiles';
import { useQuery } from '@tanstack/react-query';

interface NewDeclarationModalProps {
  onClose: () => void;
}

const NewDeclarationModal: React.FC<NewDeclarationModalProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const createDeclaration = useCreateDeclaration();
  const { data: availableSheets } = useAvailableCalculationSheets();
  const { user, hasPermission, isAdmin } = useAuth();

  // Le rôle "impression" OU admin peut créer des déclarations pour d'autres professeurs
  const isImpressionRole = user?.role === 'impression';
  const canSelectProfessor = isImpressionRole || isAdmin;

  // Vérifier si l'utilisateur peut remplir/modifier les déclarations
  const canFillDeclaration = hasPermission('accounting.professor.declarations.fill')
                           || hasPermission('accounting.declarations.update');

  // Charger uniquement les professeurs (role='professor') si c'est le rôle "impression"
  const { data: allProfessors = [] } = useQuery({
    queryKey: ['professors-for-impression', 'v20251125'], // Cache buster
    queryFn: async () => {
      console.log('🔍 [NewDeclarationModal] Fetching professors for impression role');
      const profs = await profilesApi.getAllProfessors();
      console.log(`✅ [NewDeclarationModal] Got ${profs.length} professors from backend`);
      console.log('   Professors:', profs.map(p => `${p.full_name || p.username} (${p.role})`).join(', '));
      return profs;
    },
    enabled: canSelectProfessor,
  });

  // CRITICAL: Only keep users with role='professor' (double check after API call)
  const professors = allProfessors.filter(p =>
    p.id !== user?.id && // Exclure l'utilisateur connecté (rôle impression)
    p.role === 'professor' // ONLY professors, no other roles!
  );

  // Utiliser les hooks Supabase pour récupérer segments et villes
  const { data: segments = [], isLoading: segmentsLoading } = useProfessorSegments();
  const { data: cities = [], isLoading: citiesLoading } = useProfessorCities();

  const [filteredCities, setFilteredCities] = useState<ProfessorCity[]>([]);
  const [filteredProfessors, setFilteredProfessors] = useState<typeof professors>([]);
  const [selectedProfessor, setSelectedProfessor] = useState('');
  const [filteredSheets, setFilteredSheets] = useState<any[]>([]);
  const [selectedSheet, setSelectedSheet] = useState('');

  const [sessionName, setSessionName] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState('');

  // Filtrer les villes en fonction du segment sélectionné
  useEffect(() => {
    if (selectedSegment) {
      const filtered = cities.filter(city => city.segment_id === selectedSegment);
      setFilteredCities(filtered);
      // Réinitialiser la ville sélectionnée si elle n'est plus valide
      setSelectedCity(prev => {
        if (prev && !filtered.find(c => c.id === prev)) {
          return '';
        }
        return prev;
      });
    } else {
      setFilteredCities([]);
      setSelectedCity('');
    }
  }, [selectedSegment, cities]);

  // Filtrer les professeurs en fonction du segment et de la ville sélectionnés
  useEffect(() => {
    if (canSelectProfessor && selectedSegment && selectedCity) {
      console.log('=== DEBUG FILTRAGE PROFESSEURS ===');
      console.log('Segment sélectionné:', selectedSegment);
      console.log('Ville sélectionnée:', selectedCity);
      console.log('Professeurs disponibles avant filtrage:', professors.length);
      console.log('Professeurs:', professors.map(p => ({
        name: p.full_name || p.username,
        role: p.role,
        segments: p.segment_ids,
        cities: p.city_ids
      })));

      // Trouver les professeurs qui ont ce segment ET cette ville assignés
      const filtered = professors.filter(p => {
        const hasSegment = p.segment_ids?.includes(selectedSegment);
        const hasCity = p.city_ids?.includes(selectedCity);
        console.log(`  Prof "${p.full_name || p.username}": segment=${hasSegment}, city=${hasCity}`);
        return hasSegment && hasCity;
      });

      console.log(`Professeurs filtrés: ${filtered.length}`);
      console.log('Liste filtrée:', filtered.map(p => p.full_name || p.username).join(', '));
      console.log('=== FIN DEBUG PROFESSEURS ===');

      setFilteredProfessors(filtered);

      // Sélection automatique si un seul professeur correspond
      if (filtered.length === 1) {
        setSelectedProfessor(filtered[0].id);
      } else {
        setSelectedProfessor(prev => {
          if (filtered.length === 0 || !filtered.find(p => p.id === prev)) {
            return '';
          }
          return prev;
        });
      }
    } else {
      setFilteredProfessors([]);
      if (canSelectProfessor) {
        setSelectedProfessor('');
      }
    }
  }, [selectedSegment, selectedCity, professors, canSelectProfessor]);

  // Filtrer les fiches de calcul en fonction du segment et de la ville sélectionnés
  useEffect(() => {
    if (selectedSegment && selectedCity) {
      // Debug: log toutes les fiches disponibles
      console.log('=== DEBUG FILTRAGE FICHES ===');
      console.log('Segment sélectionné:', selectedSegment);
      console.log('Ville sélectionnée:', selectedCity);
      console.log('Toutes les fiches disponibles:', availableSheets);

      // Trouver les fiches qui ont ce segment ET cette ville assignés
      const filtered = (availableSheets || []).filter(
        (s: any) => {
          const hasSegment = s.segment_ids?.includes(selectedSegment);
          const hasCity = s.city_ids?.includes(selectedCity);
          console.log(`Fiche "${s.title}":`, {
            id: s.id,
            segment_ids: s.segment_ids,
            city_ids: s.city_ids,
            hasSegment,
            hasCity,
            passes: hasSegment && hasCity
          });
          return hasSegment && hasCity;
        }
      );
      console.log('Fiches filtrées:', filtered);
      console.log('=== FIN DEBUG ===');
      setFilteredSheets(filtered);

      // Sélection automatique si une seule fiche correspond
      if (filtered.length === 1) {
        setSelectedSheet(filtered[0].id);
      } else {
        setSelectedSheet(prev => {
          if (filtered.length === 0 || !filtered.find((s: any) => s.id === prev)) {
            return '';
          }
          return prev;
        });
      }
    } else {
      setFilteredSheets([]);
      setSelectedSheet('');
    }
  }, [selectedSegment, selectedCity, availableSheets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!sessionName.trim()) {
      setError('Veuillez saisir le nom de la session');
      return;
    }
    if (!selectedSegment || !selectedCity || !startDate || !endDate) {
      setError('Veuillez remplir tous les champs');
      return;
    }

    // Si rôle impression ou admin, un professeur doit être sélectionné
    if (canSelectProfessor && !selectedProfessor) {
      setError('Veuillez sélectionner un professeur');
      return;
    }

    // Vérifier qu'un professeur est disponible pour ce segment/ville
    if (canSelectProfessor && filteredProfessors.length === 0) {
      setError('Aucun professeur n\'est assigné à ce segment et cette ville');
      return;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      setError('La date de fin doit être postérieure à la date de début');
      return;
    }

    // Vérifier qu'une fiche est sélectionnée
    if (!selectedSheet) {
      setError('Veuillez sélectionner une fiche de calcul');
      return;
    }

    // Vérifier qu'une fiche publiée existe pour ce segment et cette ville
    if (filteredSheets.length === 0) {
      setError('Aucune fiche de calcul publiée n\'existe pour ce segment et cette ville');
      return;
    }

    try {
      const declaration = await createDeclaration.mutateAsync({
        calculation_sheet_id: selectedSheet,
        segment_id: selectedSegment,
        city_id: selectedCity,
        start_date: startDate,
        end_date: endDate,
        form_data: {},
        professor_id: canSelectProfessor ? selectedProfessor : undefined,
        status: canSelectProfessor ? 'a_declarer' : undefined, // Statut "à déclarer" pour rôle impression/admin
        session_name: sessionName.trim(),
      });

      // Vérifier la permission: seuls les utilisateurs avec la permission "fill" ou "update" peuvent remplir
      // Le rôle impression peut créer mais pas remplir (sauf si permission explicitement accordée)
      if (!canFillDeclaration || canSelectProfessor) {
        onClose();
      } else {
        // Rediriger vers le formulaire de remplissage avec l'ID extrait
        navigate(`/professor/declarations/${declaration.id}/fill`);
      }
    } catch (err: any) {
      console.error('Error creating declaration:', err);
      // Améliorer le message d'erreur pour les doublons (409)
      if (err.message?.includes('409') || err.message?.includes('existe déjà')) {
        setError('Une déclaration existe déjà pour cette période, ville et segment. Veuillez modifier les dates ou vérifier les déclarations existantes.');
      } else {
        setError('Erreur lors de la création de la déclaration');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[500px] md:w-[550px] max-w-[95vw]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">Nouvelle Déclaration</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Loading state */}
          {(segmentsLoading || citiesLoading) && (
            <div className="text-center py-4">
              <p className="text-gray-600">Chargement...</p>
            </div>
          )}

          {/* Nom de la session - PREMIER CHAMP */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom de la session <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={sessionName}
              onChange={(e) => setSessionName(e.target.value)}
              placeholder="Ex: Session Janvier 2025"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* Segment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Segment <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedSegment}
              onChange={(e) => setSelectedSegment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              required
              disabled={segmentsLoading}
            >
              <option value="">Sélectionner un segment</option>
              {segments.map((segment) => (
                <option key={segment.id} value={segment.id}>
                  {segment.name}
                </option>
              ))}
            </select>
            {!segmentsLoading && segments.length === 0 && (
              <p className="text-sm text-red-500 mt-1">
                Aucun segment affecté à votre compte
              </p>
            )}
          </div>

          {/* Ville */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ville <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              required
              disabled={!selectedSegment || citiesLoading}
            >
              <option value="">Sélectionner une ville</option>
              {filteredCities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
            {!citiesLoading && cities.length === 0 && (
              <p className="text-sm text-red-500 mt-1">
                Aucune ville affectée à votre compte
              </p>
            )}
            {selectedSegment && filteredCities.length === 0 && cities.length > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                Aucune ville disponible pour ce segment
              </p>
            )}
          </div>

          {/* Sélection de professeur (pour rôle impression ou admin, après segment et ville) */}
          {canSelectProfessor && selectedSegment && selectedCity && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Professeur <span className="text-red-500">*</span>
              </label>
              {filteredProfessors.length === 0 ? (
                <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">
                  Aucun professeur trouvé pour ce segment et cette ville
                </p>
              ) : filteredProfessors.length === 1 ? (
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-green-800">
                    Professeur sélectionné automatiquement :
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    {filteredProfessors[0].full_name || filteredProfessors[0].username || `Professeur ${filteredProfessors[0].id.substring(0, 8)}`}
                  </p>
                </div>
              ) : (
                <select
                  value={selectedProfessor}
                  onChange={(e) => setSelectedProfessor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Sélectionner un professeur ({filteredProfessors.length} disponibles)</option>
                  {filteredProfessors.map((prof) => (
                    <option key={prof.id} value={prof.id}>
                      {prof.full_name || prof.username || `Professeur ${prof.id.substring(0, 8)}`}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Sélection de fiche de calcul (après segment et ville) */}
          {selectedSegment && selectedCity && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Fiche de calcul <span className="text-red-500">*</span>
              </label>
              {filteredSheets.length === 0 ? (
                <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg">
                  Aucune fiche de calcul trouvée pour ce segment et cette ville
                </p>
              ) : filteredSheets.length === 1 ? (
                <div className="bg-green-50 p-3 rounded-lg">
                  <p className="text-sm font-medium text-green-800">
                    Fiche sélectionnée automatiquement :
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    {filteredSheets[0].title}
                  </p>
                </div>
              ) : (
                <select
                  value={selectedSheet}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                >
                  <option value="">Sélectionner une fiche ({filteredSheets.length} disponibles)</option>
                  {filteredSheets.map((sheet: any) => (
                    <option key={sheet.id} value={sheet.id}>
                      {sheet.title} ({sheet.city_ids?.length || 0} villes)
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Date de début */}
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

          {/* Date de fin */}
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
              min={startDate}
            />
          </div>

          {/* Error message */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={createDeclaration.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {createDeclaration.isPending ? 'Création...' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewDeclarationModal;
