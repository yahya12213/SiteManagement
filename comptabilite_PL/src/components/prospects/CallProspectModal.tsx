// @ts-nocheck
/**
 * Modal d'appel prospect avec timer automatique
 * Permet de passer un appel et d'enregistrer les résultats
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Phone, Clock, Calendar, MapPin, User, Globe, Layers } from 'lucide-react';
import { useProspect, useStartCall, useEndCall } from '@/hooks/useProspects';
import { useAllCities } from '@/hooks/useCities';
import { useSegments } from '@/hooks/useSegments';
import { toast } from '@/hooks/use-toast';
import { SearchableSelect } from '@/components/ui/searchable-select';

// Fonction pour déterminer le style du RDV selon la date
const getRdvStyle = (dateRdv: string | null) => {
  if (!dateRdv) return null;

  const rdv = new Date(dateRdv);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rdvDay = new Date(rdv.getFullYear(), rdv.getMonth(), rdv.getDate());

  const diffMs = rdvDay.getTime() - today.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  // Jour J (aujourd'hui)
  if (diffDays === 0) {
    return {
      bg: 'bg-green-100',
      text: 'text-green-800',
      border: 'border-green-300',
      label: "Aujourd'hui"
    };
  }

  // Demain (< 48h)
  if (diffDays > 0 && diffDays <= 2) {
    return {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      border: 'border-yellow-300',
      label: diffDays === 1 ? 'Demain' : 'Dans 2 jours'
    };
  }

  // RDV futur (> 48h)
  if (diffDays > 2) {
    return {
      bg: 'bg-blue-50',
      text: 'text-blue-700',
      border: 'border-blue-200',
      label: `Dans ${Math.ceil(diffDays)} jours`
    };
  }

  // Expiré < 24h (hier)
  if (diffDays >= -1 && diffDays < 0) {
    return {
      bg: 'bg-orange-100',
      text: 'text-orange-800',
      border: 'border-orange-300',
      label: 'Expiré hier'
    };
  }

  // Expiré > 24h
  return {
    bg: 'bg-red-100',
    text: 'text-red-800',
    border: 'border-red-300',
    label: `Expiré (${Math.abs(Math.ceil(diffDays))}j)`
  };
};

// Fonction pour le style du statut
const getStatutStyle = (statut: string) => {
  switch (statut?.toLowerCase()) {
    case 'contacté avec rdv':
    case 'rdv planifié':
      return 'bg-green-100 text-green-800 border-green-300';
    case 'inscrit':
      return 'bg-blue-100 text-blue-800 border-blue-300';
    case 'non contacté':
      return 'bg-gray-100 text-gray-800 border-gray-300';
    case 'contacté sans rdv':
    case 'contacté sans réponse':
    case 'boîte vocale':
      return 'bg-orange-100 text-orange-800 border-orange-300';
    case 'non intéressé':
      return 'bg-red-100 text-red-800 border-red-300';
    case 'à recontacter':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300';
  }
};

interface CallProspectModalProps {
  open: boolean;
  onClose: () => void;
  prospectId: string | null;
}

// Statuts de contact disponibles
const STATUTS_CONTACT = [
  { value: 'non contacté', label: 'Non contacté' },
  { value: 'contacté avec rdv', label: 'Contacté avec RDV' },
  { value: 'contacté sans rdv', label: 'Contacté sans RDV' },
  { value: 'contacté sans réponse', label: 'Contacté sans réponse' },
  { value: 'boîte vocale', label: 'Boîte vocale' },
  { value: 'à recontacter', label: 'À recontacter' },
  { value: 'rdv planifié', label: 'RDV planifié' },
  { value: 'inscrit', label: 'Inscrit' },
];

// Statuts qui nécessitent une date de RDV
const STATUTS_AVEC_RDV = ['contacté avec rdv', 'rdv planifié'];

export function CallProspectModal({ open, onClose, prospectId }: CallProspectModalProps) {
  const [callId, setCallId] = useState<string | null>(null);
  const [callStartTime, setCallStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [statutContact, setStatutContact] = useState<string>('');
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>('');
  const [selectedVilleId, setSelectedVilleId] = useState<string>('');
  const [dateRdv, setDateRdv] = useState<string>('');
  const [heureRdv, setHeureRdv] = useState<string>('');
  const [commentaire, setCommentaire] = useState<string>('');
  const [editNom, setEditNom] = useState<string>('');
  const [editPrenom, setEditPrenom] = useState<string>('');

  const { data: prospect, isLoading } = useProspect(prospectId || '');
  const { data: allCities = [] } = useAllCities();
  const { data: allSegments = [] } = useSegments();
  const startCallMutation = useStartCall();
  const endCallMutation = useEndCall();

  // Filtrer les villes par segment sélectionné
  const filteredCities = selectedSegmentId
    ? allCities.filter(city => city.segment_id === selectedSegmentId)
    : [];

  // Initialiser nom/prénom quand le prospect est chargé
  useEffect(() => {
    if (prospect) {
      setEditNom(prospect.nom || '');
      setEditPrenom(prospect.prenom || '');
    }
  }, [prospect]);

  // Timer automatique
  useEffect(() => {
    if (!open || !prospectId) {
      // Reset quand le modal se ferme
      setCallId(null);
      setCallStartTime(null);
      setElapsedSeconds(0);
      setStatutContact('');
      setSelectedSegmentId('');
      setSelectedVilleId('');
      setDateRdv('');
      setHeureRdv('');
      setCommentaire('');
      setEditNom('');
      setEditPrenom('');
      return;
    }

    // Démarrer l'appel automatiquement
    if (!callStartTime) {
      startCallMutation.mutate(prospectId, {
        onSuccess: (data) => {
          setCallId(data.call_id);
          setCallStartTime(new Date());
          console.log('⏱️ Appel démarré:', data.call_id, new Date().toISOString());
        },
        onError: (error: any) => {
          toast({
            variant: 'destructive',
            title: 'Erreur',
            description: error.message || "Impossible de démarrer l'appel",
          });
          onClose();
        },
      });
    }
  }, [open, prospectId, callStartTime]);

  // Mise à jour du timer toutes les secondes
  useEffect(() => {
    if (!callStartTime) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - callStartTime.getTime()) / 1000);
      setElapsedSeconds(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [callStartTime]);

  // Formater la durée en MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleSave = () => {
    if (!prospectId || !statutContact) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez sélectionner un statut de contact',
      });
      return;
    }

    if (!callId) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: "L'appel n'a pas été correctement démarré",
      });
      return;
    }

    // Vérifier que les champs RDV sont remplis si nécessaire
    if (STATUTS_AVEC_RDV.includes(statutContact)) {
      if (!dateRdv || !heureRdv) {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: 'Veuillez saisir la date et l\'heure du RDV',
        });
        return;
      }
    }

    // Préparer les données avec call_id obligatoire
    const endCallData = {
      call_id: callId,
      statut_contact: statutContact,
      ville_id: selectedVilleId || undefined,
      date_rdv: STATUTS_AVEC_RDV.includes(statutContact)
        ? `${dateRdv} ${heureRdv}:00`
        : undefined,
      commentaire: commentaire || undefined,
      nom: editNom || undefined,
      prenom: editPrenom || undefined,
    };

    endCallMutation.mutate(
      { id: prospectId, data: endCallData },
      {
        onSuccess: () => {
          toast({
            title: 'Appel enregistré',
            description: `Durée: ${formatDuration(elapsedSeconds)}`,
          });
          onClose();
        },
        onError: (error: any) => {
          toast({
            variant: 'destructive',
            title: 'Erreur',
            description: error.message || "Impossible d'enregistrer l'appel",
          });
        },
      }
    );
  };

  if (isLoading || !prospect) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] h-[90vh] max-w-6xl" resizable fitToScreen>
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Appel en cours - {editPrenom || prospect.prenom || ''} {editNom || prospect.nom || prospect.phone_international}
            </div>
            <div className="flex items-center gap-2 text-lg font-mono bg-green-100 text-green-700 px-4 py-2 rounded">
              <Clock className="h-5 w-5" />
              {formatDuration(elapsedSeconds)}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-2">
          {/* Informations du prospect - Style amélioré */}
          <div className="bg-gray-50 p-5 rounded-lg space-y-4">
            {/* Ligne 1: Nom, Prénom (éditables), Téléphone, Pays */}
            <div className="grid grid-cols-4 gap-6">
              <div className="space-y-1">
                <Label htmlFor="editNom" className="flex items-center gap-1 text-xs text-gray-500">
                  <User className="h-3 w-3" />
                  Nom
                </Label>
                <Input
                  id="editNom"
                  value={editNom}
                  onChange={(e) => setEditNom(e.target.value)}
                  placeholder="Saisir le nom..."
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="editPrenom" className="flex items-center gap-1 text-xs text-gray-500">
                  <User className="h-3 w-3" />
                  Prénom
                </Label>
                <Input
                  id="editPrenom"
                  value={editPrenom}
                  onChange={(e) => setEditPrenom(e.target.value)}
                  placeholder="Saisir le prénom..."
                  className="h-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-gray-400" />
                <div>
                  <span className="text-xs text-gray-500 block">Téléphone</span>
                  <p className="font-mono font-medium">{prospect.phone_international}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-gray-400" />
                <div>
                  <span className="text-xs text-gray-500 block">Pays</span>
                  <Badge variant="outline">{prospect.country || 'N/A'}</Badge>
                </div>
              </div>
            </div>

            {/* Ligne 2: Segment */}
            <div className="grid grid-cols-3 gap-6 pt-3 border-t">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-gray-400" />
                <div>
                  <span className="text-xs text-gray-500 block">Segment</span>
                  <p className="font-medium">{prospect.segment_name || 'N/A'}</p>
                </div>
              </div>
            </div>

            {/* Ligne 3: Ville, Assigné à */}
            <div className="grid grid-cols-2 gap-6 pt-3 border-t">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-gray-400" />
                <div>
                  <span className="text-xs text-gray-500 block">Ville</span>
                  <p className="font-medium">{prospect.ville_name || 'Sans ville'}</p>
                  {prospect.historique_villes && (
                    <p className="text-xs text-gray-500">(ex: {prospect.historique_villes})</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400" />
                <div>
                  <span className="text-xs text-gray-500 block">Assigné à</span>
                  <p className="font-medium">
                    {prospect.assistantes_ville || prospect.assigned_to_name || (
                      <span className="text-orange-600">À assigner</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Ligne 4: Statut et RDV */}
            <div className="grid grid-cols-2 gap-6 pt-3 border-t">
              {/* Statut actuel */}
              <div>
                <span className="text-xs text-gray-500 block mb-1">Statut actuel</span>
                <span className={`inline-flex px-3 py-1 rounded-full text-sm font-medium border ${getStatutStyle(prospect.statut_contact)}`}>
                  {prospect.statut_contact || 'Non défini'}
                </span>
              </div>

              {/* RDV avec couleurs */}
              <div>
                <span className="text-xs text-gray-500 block mb-1">RDV</span>
                {prospect.date_rdv ? (
                  <div className="space-y-1">
                    {(() => {
                      const style = getRdvStyle(prospect.date_rdv);
                      const rdvDate = new Date(prospect.date_rdv);
                      return (
                        <div className={`inline-flex flex-col px-3 py-1 rounded border ${style?.bg} ${style?.text} ${style?.border}`}>
                          <div className="flex items-center gap-1 text-sm font-medium">
                            <Calendar className="h-3 w-3" />
                            {rdvDate.toLocaleDateString('fr-FR')} à {rdvDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                          <div className="text-xs font-semibold">{style?.label}</div>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <span className="text-gray-400 text-sm">Aucun RDV</span>
                )}
              </div>
            </div>

            {/* Historique RDV */}
            {prospect.historique_rdv && (
              <div className="pt-3 border-t">
                <span className="text-xs text-gray-500 block mb-1">Historique des RDV précédents</span>
                <p className="text-sm text-orange-600 bg-orange-50 px-2 py-1 rounded">{prospect.historique_rdv}</p>
              </div>
            )}

            {/* Date d'injection et durée d'appel */}
            <div className="grid grid-cols-2 gap-6 pt-3 border-t text-sm">
              <div>
                <span className="text-xs text-gray-500">Date d'injection:</span>
                <span className="ml-2 font-medium">
                  {prospect.date_injection ? new Date(prospect.date_injection).toLocaleDateString('fr-FR') : '-'}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500">Durée totale d'appels:</span>
                <span className="ml-2 font-medium">
                  {prospect.total_call_duration && prospect.total_call_duration > 0
                    ? `${Math.floor(prospect.total_call_duration / 60)}m ${prospect.total_call_duration % 60}s`
                    : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Sélection du segment et de la ville */}
          <div className="space-y-4 border rounded-lg p-4 bg-gray-50">
            <div className="flex items-center gap-2 text-gray-700 font-medium">
              <MapPin className="h-5 w-5" />
              Réassigner à une autre ville
            </div>

            {/* Sélection du segment */}
            <div className="space-y-2">
              <Label htmlFor="segment" className="flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Segment
              </Label>
              <Select
                value={selectedSegmentId}
                onValueChange={(value) => {
                  setSelectedSegmentId(value);
                  setSelectedVilleId(''); // Reset ville quand le segment change
                }}
              >
                <SelectTrigger id="segment">
                  <SelectValue placeholder="Sélectionnez un segment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">-- Aucun (garder actuel) --</SelectItem>
                  {allSegments.map((segment) => (
                    <SelectItem key={segment.id} value={segment.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: segment.color || '#6b7280' }}
                        />
                        {segment.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Sélection de la ville (uniquement si segment sélectionné) */}
            <div className="space-y-2">
              <Label htmlFor="ville" className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Ville
              </Label>
              <SearchableSelect
                options={filteredCities.map((city) => ({
                  value: city.id,
                  label: `${city.name} (${city.code})`,
                  searchValue: city.code,
                }))}
                value={selectedVilleId}
                onValueChange={setSelectedVilleId}
                placeholder={selectedSegmentId ? "Sélectionnez une ville" : "Sélectionnez d'abord un segment"}
                disabled={!selectedSegmentId}
                emptyMessage="Aucune ville trouvée"
              />
              {selectedSegmentId && filteredCities.length === 0 && (
                <p className="text-xs text-orange-600">Aucune ville dans ce segment</p>
              )}
            </div>

            <p className="text-xs text-gray-500">
              Sélectionnez un segment puis une ville pour réassigner ce prospect
            </p>
          </div>

          {/* Résultat de l'appel */}
          <div className="space-y-2">
            <Label htmlFor="statut">Statut de contact *</Label>
            <Select value={statutContact} onValueChange={setStatutContact}>
              <SelectTrigger id="statut">
                <SelectValue placeholder="Sélectionnez le statut" />
              </SelectTrigger>
              <SelectContent>
                {STATUTS_CONTACT.map((statut) => (
                  <SelectItem key={statut.value} value={statut.value}>
                    {statut.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date de RDV (conditionnel) */}
          {STATUTS_AVEC_RDV.includes(statutContact) && (
            <div className="space-y-4 border-l-4 border-blue-500 pl-4 bg-blue-50 p-4 rounded">
              <div className="flex items-center gap-2 text-blue-700 font-medium">
                <Calendar className="h-5 w-5" />
                Planifier le RDV
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dateRdv">Date du RDV *</Label>
                  <Input
                    id="dateRdv"
                    type="date"
                    value={dateRdv}
                    onChange={(e) => setDateRdv(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heureRdv">Heure du RDV *</Label>
                  <Input
                    id="heureRdv"
                    type="time"
                    value={heureRdv}
                    onChange={(e) => setHeureRdv(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Commentaire */}
          <div className="space-y-2">
            <Label htmlFor="commentaire">Commentaire</Label>
            <Textarea
              id="commentaire"
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              placeholder="Notes sur l'appel..."
              rows={4}
            />
          </div>
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={endCallMutation.isPending || !statutContact || !callId}
          >
            {endCallMutation.isPending ? 'Enregistrement...' : 'Terminer l\'appel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
