import React, { useState, useEffect } from 'react';
import { X, Calendar, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProtectedButton } from '@/components/ui/ProtectedButton';
import { Input } from '@/components/ui/input';
import { useCreateSession, useUpdateSession } from '@/hooks/useSessionsFormation';
import { SessionFormationSelector } from '@/components/formations/SessionFormationSelector';
import type { SessionFormation, SessionStatut } from '@/types/sessions';

interface SessionFormModalProps {
  session?: SessionFormation;
  onClose: () => void;
}

// Helper function to map backend status to frontend status
const mapBackendStatusToFrontend = (backendStatus: SessionStatut): 'planned' | 'active' | 'completed' | 'cancelled' => {
  const statusMap: Record<SessionStatut, 'planned' | 'active' | 'completed' | 'cancelled'> = {
    'planifiee': 'planned',
    'en_cours': 'active',
    'terminee': 'completed',
    'annulee': 'cancelled',
  };
  return statusMap[backendStatus] || 'planned';
};

export const SessionFormModal: React.FC<SessionFormModalProps> = ({ session, onClose }) => {
  const isEdit = !!session;
  const createSession = useCreateSession();
  const updateSession = useUpdateSession();

  // Debug: log session data to identify session_type issue
  console.log('SessionFormModal - session prop:', session);
  console.log('SessionFormModal - session.session_type:', session?.session_type);

  const [formData, setFormData] = useState({
    name: session?.titre || '',
    description: session?.description || '',
    corps_formation_id: session?.corps_formation_id || '',
    start_date: session?.date_debut ? session.date_debut.split('T')[0] : '',
    end_date: session?.date_fin ? session.date_fin.split('T')[0] : '',
    session_type: (session?.session_type || 'presentielle') as 'presentielle' | 'en_ligne',
    segment_id: session?.segment_id || '',
    city_id: session?.ville_id || '',
    meeting_platform: session?.meeting_platform || '',
    meeting_link: session?.meeting_link || '',
    instructor_id: '',
    max_capacity: session?.nombre_places?.toString() || '',
    status: (session?.statut ? mapBackendStatusToFrontend(session.statut) : 'planned') as 'planned' | 'active' | 'completed' | 'cancelled',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Synchroniser formData quand session change (important pour le mode édition)
  useEffect(() => {
    if (session) {
      console.log('useEffect - Syncing formData with session:', session);
      console.log('useEffect - session.session_type:', session.session_type);
      setFormData({
        name: session.titre || '',
        description: session.description || '',
        corps_formation_id: session.corps_formation_id || '',
        start_date: session.date_debut ? session.date_debut.split('T')[0] : '',
        end_date: session.date_fin ? session.date_fin.split('T')[0] : '',
        session_type: (session.session_type || 'presentielle') as 'presentielle' | 'en_ligne',
        segment_id: session.segment_id || '',
        city_id: session.ville_id || '',
        meeting_platform: session.meeting_platform || '',
        meeting_link: session.meeting_link || '',
        instructor_id: '',
        max_capacity: session.nombre_places?.toString() || '',
        status: (session.statut ? mapBackendStatusToFrontend(session.statut) : 'planned') as 'planned' | 'active' | 'completed' | 'cancelled',
      });
    }
  }, [session]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est obligatoire';
    }

    if (!formData.start_date) {
      newErrors.start_date = 'La date de début est obligatoire';
    }

    if (!formData.end_date) {
      newErrors.end_date = 'La date de fin est obligatoire';
    }

    if (formData.start_date && formData.end_date && formData.start_date > formData.end_date) {
      newErrors.end_date = 'La date de fin doit être après la date de début';
    }

    if (formData.max_capacity && parseInt(formData.max_capacity) < 1) {
      newErrors.max_capacity = 'La capacité doit être supérieure à 0';
    }

    if (!formData.corps_formation_id) {
      newErrors.corps = 'Le corps de formation est obligatoire';
    }

    if (!formData.segment_id) {
      newErrors.segment = 'Le segment est obligatoire';
    }

    // Ville obligatoire seulement pour les sessions présentielles
    if (formData.session_type === 'presentielle' && !formData.city_id) {
      newErrors.city = 'La ville est obligatoire pour les sessions présentielles';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Mapping des statuts anglais vers français
      const statusMap: Record<'planned' | 'active' | 'completed' | 'cancelled', SessionStatut> = {
        'planned': 'planifiee',
        'active': 'en_cours',
        'completed': 'terminee',
        'cancelled': 'annulee',
      };

      const submitData = {
        titre: formData.name.trim(),
        description: formData.description.trim() || undefined,
        corps_formation_id: formData.corps_formation_id,
        date_debut: formData.start_date,
        date_fin: formData.end_date,
        session_type: formData.session_type,
        segment_id: formData.segment_id,
        ville_id: formData.city_id || undefined, // Ville envoyée pour les deux types de session
        meeting_platform: formData.session_type === 'en_ligne' ? formData.meeting_platform || undefined : undefined,
        meeting_link: formData.session_type === 'en_ligne' ? formData.meeting_link || undefined : undefined,
        nombre_places: formData.max_capacity ? parseInt(formData.max_capacity) : 0,
        statut: statusMap[formData.status],
        prix_total: 0,
      };

      if (isEdit && session) {
        await updateSession.mutateAsync({
          id: session.id,
          data: submitData,
        });
      } else {
        await createSession.mutateAsync(submitData);
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving session:', error);
      setErrors({ submit: error.message || 'Erreur lors de l\'enregistrement' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[650px] md:w-[750px] lg:w-[850px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {isEdit ? 'Modifier la session' : 'Nouvelle session'}
              </h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {isEdit ? 'Mettez à jour les informations de la session' : 'Créez une nouvelle session de formation'}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Error message */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{errors.submit}</p>
            </div>
          )}

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom de la session <span className="text-red-500">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Formation React Avancé"
              className={errors.name ? 'border-red-300' : ''}
            />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Description de la session..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Session Type Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Type de session <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, session_type: 'presentielle' })}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.session_type === 'presentielle'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">🏫</div>
                  <div className="font-semibold">Présentielle</div>
                  <div className="text-xs mt-1">Formation en salle de classe</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, session_type: 'en_ligne' })}
                className={`p-4 rounded-lg border-2 transition-all ${
                  formData.session_type === 'en_ligne'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">💻</div>
                  <div className="font-semibold">En ligne</div>
                  <div className="text-xs mt-1">Formation à distance</div>
                </div>
              </button>
            </div>
          </div>

          {/* Cascade Selector: Segment → City → Corps de Formation */}
          <SessionFormationSelector
            selectedSegmentId={formData.segment_id}
            selectedCityId={formData.city_id}
            selectedCorpsId={formData.corps_formation_id}
            onSegmentChange={(segmentId) => setFormData(prev => ({ ...prev, segment_id: segmentId }))}
            onCityChange={(cityId) => setFormData(prev => ({ ...prev, city_id: cityId }))}
            onCorpsChange={(corpsId) => setFormData(prev => ({ ...prev, corps_formation_id: corpsId }))}
          />
          {errors.corps && <p className="text-xs text-red-600 mt-1">{errors.corps}</p>}
          {errors.segment && <p className="text-xs text-red-600 mt-1">{errors.segment}</p>}
          {errors.city && <p className="text-xs text-red-600 mt-1">{errors.city}</p>}

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de début <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className={errors.start_date ? 'border-red-300' : ''}
              />
              {errors.start_date && <p className="text-xs text-red-600 mt-1">{errors.start_date}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de fin <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className={errors.end_date ? 'border-red-300' : ''}
              />
              {errors.end_date && <p className="text-xs text-red-600 mt-1">{errors.end_date}</p>}
            </div>
          </div>

          {/* Max capacity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Capacité maximale
            </label>
            <Input
              type="number"
              min="1"
              value={formData.max_capacity}
              onChange={(e) => setFormData({ ...formData, max_capacity: e.target.value })}
              placeholder="Laissez vide pour illimité"
              className={errors.max_capacity ? 'border-red-300' : ''}
            />
            {errors.max_capacity && <p className="text-xs text-red-600 mt-1">{errors.max_capacity}</p>}
          </div>

          {/* Meeting fields (only for online sessions) */}
          {formData.session_type === 'en_ligne' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-2 text-blue-900 font-medium mb-2">
                <span className="text-xl">💻</span>
                <span>Informations de la réunion en ligne</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Plateforme de réunion
                </label>
                <select
                  value={formData.meeting_platform}
                  onChange={(e) => setFormData({ ...formData, meeting_platform: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                >
                  <option value="">Sélectionner une plateforme (optionnel)</option>
                  <option value="zoom">Zoom</option>
                  <option value="teams">Microsoft Teams</option>
                  <option value="meet">Google Meet</option>
                  <option value="webex">Cisco Webex</option>
                  <option value="autre">Autre</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lien de la réunion
                </label>
                <Input
                  type="url"
                  value={formData.meeting_link}
                  onChange={(e) => setFormData({ ...formData, meeting_link: e.target.value })}
                  placeholder="https://..."
                  className="text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Le lien sera partagé avec les étudiants inscrits
                </p>
              </div>
            </div>
          )}

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Statut
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'planned' | 'active' | 'completed' | 'cancelled' })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            >
              <option value="planned">Planifiée</option>
              <option value="active">Active</option>
              <option value="completed">Terminée</option>
              <option value="cancelled">Annulée</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <ProtectedButton
              permission={isEdit ? 'training.sessions.update' : 'training.sessions.create'}
              type="submit"
              disabled={isSubmitting}
              className="min-w-[100px]"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>...</span>
                </div>
              ) : isEdit ? (
                'Enregistrer'
              ) : (
                'Créer'
              )}
            </ProtectedButton>
          </div>
        </form>
      </div>
    </div>
  );
};
