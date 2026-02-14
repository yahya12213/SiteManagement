import React, { useState, useEffect } from 'react';
import { X, Search, Monitor, Building2, Calendar, MapPin, BookOpen, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSessionsFormation } from '@/hooks/useSessionsFormation';
import { useAssignStudentToSession, useFormationsByCorps, type StudentWithSession } from '@/hooks/useStudentsList';
import { toast } from '@/hooks/use-toast';

interface AssignSessionModalProps {
  student: StudentWithSession;
  onClose: () => void;
}

export const AssignSessionModal: React.FC<AssignSessionModalProps> = ({
  student,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [selectedFormationId, setSelectedFormationId] = useState<string | null>(null);
  const [step, setStep] = useState<'session' | 'formation'>('session');

  const { data: sessions, isLoading: isLoadingSessions } = useSessionsFormation();
  const assignMutation = useAssignStudentToSession();

  // Trouver la session sélectionnée
  const selectedSession = sessions?.find(s => s.id === selectedSessionId);

  // Récupérer les formations du corps de formation de la session sélectionnée
  const { data: formations, isLoading: isLoadingFormations } = useFormationsByCorps(
    selectedSession?.corps_formation_id
  );

  // Trouver la formation sélectionnée
  const selectedFormation = formations?.find(f => f.id === selectedFormationId);

  // Reset formation selection when session changes
  useEffect(() => {
    setSelectedFormationId(null);
  }, [selectedSessionId]);

  // Filtrer les sessions actives
  const activeSessions = sessions?.filter(session =>
    session.statut === 'planifiee' || session.statut === 'en_cours'
  ) || [];

  // Filtrer par recherche
  const filteredSessions = activeSessions.filter(session => {
    const searchLower = searchTerm.toLowerCase();
    return (
      session.titre.toLowerCase().includes(searchLower) ||
      (session.ville_name && session.ville_name.toLowerCase().includes(searchLower)) ||
      (session.corps_formation_name && session.corps_formation_name.toLowerCase().includes(searchLower))
    );
  });

  // Filtrer les formations non-pack (les packs contiennent d'autres formations)
  const availableFormations = formations?.filter(f => !f.is_pack) || [];

  const handleSessionSelect = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    const session = sessions?.find(s => s.id === sessionId);
    // Si la session a un corps de formation, passer à l'étape de sélection de formation
    if (session?.corps_formation_id) {
      setStep('formation');
    }
  };

  const handleAssign = async () => {
    if (!selectedSessionId || !selectedSession) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez sélectionner une session',
      });
      return;
    }

    // Vérifier si la session a un corps de formation
    if (selectedSession.corps_formation_id && !selectedFormationId) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez sélectionner une formation',
      });
      return;
    }

    // Si pas de corps de formation, on ne peut pas affecter sans formation
    if (!selectedSession.corps_formation_id) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Cette session n\'a pas de corps de formation configuré. Impossible d\'affecter un étudiant.',
      });
      return;
    }

    // Utiliser le prix de la formation sélectionnée
    const formationPrice = selectedFormation
      ? (typeof selectedFormation.price === 'string'
          ? parseFloat(selectedFormation.price)
          : (selectedFormation.price || 0))
      : 0;

    try {
      await assignMutation.mutateAsync({
        sessionId: selectedSessionId,
        studentId: student.id,
        formationId: selectedFormationId!,
        montantTotal: formationPrice,
      });
      toast({
        title: 'Affectation réussie',
        description: `${student.prenom} ${student.nom} a été affecté à la session "${selectedSession.titre}" avec la formation "${selectedFormation?.title}"`,
      });
      onClose();
    } catch (error) {
      console.error('Error assigning student:', error);
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Erreur lors de l\'affectation de l\'étudiant',
      });
    }
  };

  const handleBack = () => {
    setStep('session');
    setSelectedFormationId(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[650px] md:w-[750px] lg:w-[850px] max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {step === 'session' ? 'Affecter à une Session' : 'Choisir une Formation'}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Étudiant: <span className="font-medium text-gray-700">{student.prenom} {student.nom}</span> ({student.cin})
            </p>
            {step === 'formation' && selectedSession && (
              <p className="text-sm text-blue-600 mt-1">
                Session: <span className="font-medium">{selectedSession.titre}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Fermer"
            aria-label="Fermer"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Progress indicator */}
        <div className="px-6 py-3 bg-gray-50 border-b">
          <div className="flex items-center gap-2 text-sm">
            <span className={`flex items-center gap-1 ${step === 'session' ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'session' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>1</span>
              Session
            </span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className={`flex items-center gap-1 ${step === 'formation' ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step === 'formation' ? 'bg-blue-600 text-white' : 'bg-gray-300 text-gray-600'}`}>2</span>
              Formation
            </span>
          </div>
        </div>

        {/* Search - Only for session step */}
        {step === 'session' && (
          <div className="p-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Rechercher une session..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {step === 'session' ? (
            // Session Selection
            isLoadingSessions ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchTerm
                  ? 'Aucune session ne correspond à votre recherche'
                  : 'Aucune session active disponible'}
              </div>
            ) : (
              filteredSessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => handleSessionSelect(session.id)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedSessionId === session.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{session.titre}</h3>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                            session.session_type === 'en_ligne'
                              ? 'bg-purple-100 text-purple-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {session.session_type === 'en_ligne' ? (
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
                      </div>
                      <div className="mt-2 flex flex-wrap gap-3 text-sm text-gray-500">
                        {session.ville_name && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {session.ville_name}
                          </span>
                        )}
                        {session.date_debut && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(session.date_debut).toLocaleDateString('fr-FR')}
                          </span>
                        )}
                        {session.corps_formation_name && (
                          <span className="flex items-center gap-1 text-green-600">
                            <BookOpen className="w-3.5 h-3.5" />
                            {session.corps_formation_name}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        {session.nombre_etudiants || 0}/{session.nombre_places || '∞'} places
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )
          ) : (
            // Formation Selection
            isLoadingFormations ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : availableFormations.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Aucune formation disponible pour ce corps de formation
              </div>
            ) : (
              availableFormations.map((formation) => (
                <div
                  key={formation.id}
                  onClick={() => setSelectedFormationId(formation.id)}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedFormationId === formation.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{formation.title}</h3>
                      {formation.description && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {formation.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <span className="text-lg font-bold text-gray-900">
                        {typeof formation.price === 'string'
                          ? parseFloat(formation.price).toLocaleString('fr-FR')
                          : (formation.price || 0).toLocaleString('fr-FR')} DH
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 p-6 border-t bg-gray-50">
          <div>
            {step === 'formation' && (
              <Button type="button" variant="outline" onClick={handleBack}>
                Retour
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            {step === 'formation' && (
              <Button
                onClick={handleAssign}
                disabled={!selectedFormationId || assignMutation.isPending}
              >
                {assignMutation.isPending ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Affectation...</span>
                  </div>
                ) : (
                  'Affecter à cette formation'
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignSessionModal;
