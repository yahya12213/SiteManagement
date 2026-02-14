// @ts-nocheck
/**
 * Modal de déclaration de visite directe pour un prospect
 * Affiche les infos du prospect et permet de déclarer inscrit/non inscrit
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Footprints,
  Phone,
  MapPin,
  Calendar,
  User,
  Building,
  UserCheck,
  UserX,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useCreateVisit, useRejectionReasons } from '@/hooks/useVisits';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface DeclareVisitModalProps {
  open: boolean;
  onClose: () => void;
  prospect: {
    id: string;
    phone_international: string;
    nom?: string;
    prenom?: string;
    segment_id?: string;
    segment_name?: string;
    ville_id?: string;
    ville_name?: string;
    date_rdv?: string;
    statut_contact?: string;
  } | null;
}

// Fonction pour formater la date du RDV
const formatRdvDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return null;

  const date = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const rdvDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((rdvDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  let label = '';
  let colorClass = '';

  if (diffDays === 0) {
    label = "Aujourd'hui";
    colorClass = 'bg-green-100 text-green-800 border-green-300';
  } else if (diffDays === 1) {
    label = 'Demain';
    colorClass = 'bg-yellow-100 text-yellow-800 border-yellow-300';
  } else if (diffDays > 1) {
    label = `Dans ${diffDays} jours`;
    colorClass = 'bg-blue-50 text-blue-700 border-blue-200';
  } else if (diffDays === -1) {
    label = 'Hier';
    colorClass = 'bg-orange-100 text-orange-800 border-orange-300';
  } else {
    label = `Il y a ${Math.abs(diffDays)} jours`;
    colorClass = 'bg-red-100 text-red-800 border-red-300';
  }

  return {
    formatted: date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }),
    label,
    colorClass
  };
};

export function DeclareVisitModal({ open, onClose, prospect }: DeclareVisitModalProps) {
  const [statut, setStatut] = useState<'inscrit' | 'non_inscrit' | ''>('');
  const [motifNonInscription, setMotifNonInscription] = useState<string>('');
  const [commentaire, setCommentaire] = useState<string>('');

  const { data: rejectionReasons = [], isLoading: reasonsLoading } = useRejectionReasons();
  const createVisitMutation = useCreateVisit();

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      setStatut('');
      setMotifNonInscription('');
      setCommentaire('');
    }
  }, [open]);

  const handleSubmit = () => {
    if (!prospect) return;

    if (!statut) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez indiquer si le visiteur est inscrit ou non',
      });
      return;
    }

    if (statut === 'non_inscrit' && !motifNonInscription) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez sélectionner un motif de non-inscription',
      });
      return;
    }

    const visitData = {
      centre_ville_id: prospect.ville_id,
      phone: prospect.phone_international,
      nom: prospect.nom || undefined,
      prenom: prospect.prenom || undefined,
      statut: statut as 'inscrit' | 'non_inscrit',
      motif_non_inscription: statut === 'non_inscrit' ? motifNonInscription : undefined,
      commentaire: commentaire || undefined,
    };

    createVisitMutation.mutate(visitData, {
      onSuccess: (data) => {
        toast({
          title: 'Succès',
          description: data.message || 'Visite déclarée avec succès',
        });
        onClose();
      },
      onError: (error: any) => {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: error.message || "Impossible de déclarer la visite",
        });
      },
    });
  };

  if (!prospect) return null;

  const rdvInfo = formatRdvDate(prospect.date_rdv);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[550px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Footprints className="h-5 w-5 text-purple-600" />
            Déclarer une visite
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Informations du prospect */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h3 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Informations du prospect</h3>

            {/* Téléphone */}
            <div className="flex items-center gap-3">
              <Phone className="h-4 w-4 text-blue-500" />
              <span className="font-mono font-medium text-lg">{prospect.phone_international}</span>
            </div>

            {/* Nom / Prénom */}
            {(prospect.nom || prospect.prenom) && (
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-gray-700">
                  {prospect.prenom} {prospect.nom}
                </span>
              </div>
            )}

            {/* Segment */}
            {prospect.segment_name && (
              <div className="flex items-center gap-3">
                <Building className="h-4 w-4 text-indigo-500" />
                <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                  {prospect.segment_name}
                </Badge>
              </div>
            )}

            {/* Ville */}
            {prospect.ville_name && (
              <div className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-green-500" />
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  {prospect.ville_name}
                </Badge>
              </div>
            )}

            {/* Date RDV */}
            {rdvInfo ? (
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-orange-500" />
                <div className="flex flex-col">
                  <span className={`px-2 py-1 rounded border text-sm font-medium ${rdvInfo.colorClass}`}>
                    {rdvInfo.label} - {rdvInfo.formatted}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-gray-400 text-sm">Pas de RDV planifié</span>
              </div>
            )}

            {/* Statut actuel */}
            {prospect.statut_contact && (
              <div className="flex items-center gap-3 pt-2 border-t">
                <span className="text-sm text-gray-500">Statut actuel:</span>
                <Badge variant="outline">{prospect.statut_contact}</Badge>
              </div>
            )}
          </div>

          {/* Déclaration de visite */}
          <div className="space-y-4">
            <h3 className="font-medium text-gray-700 text-sm uppercase tracking-wide">Résultat de la visite</h3>

            {/* Statut (Inscrit / Non-inscrit) */}
            <RadioGroup
              value={statut}
              onValueChange={(value) => {
                setStatut(value as 'inscrit' | 'non_inscrit');
                if (value === 'inscrit') {
                  setMotifNonInscription('');
                }
              }}
              className="grid grid-cols-2 gap-4"
            >
              <div>
                <RadioGroupItem value="inscrit" id="inscrit" className="sr-only" />
                <Label
                  htmlFor="inscrit"
                  className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    statut === 'inscrit'
                      ? 'bg-green-50 border-green-500 text-green-700 shadow-md'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                  }`}
                >
                  <UserCheck className={`h-8 w-8 mb-2 ${statut === 'inscrit' ? 'text-green-600' : 'text-gray-400'}`} />
                  <span className="font-medium">Inscrit</span>
                  <span className="text-xs mt-1 text-center">Le prospect s'est inscrit</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="non_inscrit" id="non_inscrit" className="sr-only" />
                <Label
                  htmlFor="non_inscrit"
                  className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    statut === 'non_inscrit'
                      ? 'bg-red-50 border-red-500 text-red-700 shadow-md'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                  }`}
                >
                  <UserX className={`h-8 w-8 mb-2 ${statut === 'non_inscrit' ? 'text-red-600' : 'text-gray-400'}`} />
                  <span className="font-medium">Non inscrit</span>
                  <span className="text-xs mt-1 text-center">Le prospect n'a pas souhaité s'inscrire</span>
                </Label>
              </div>
            </RadioGroup>

            {/* Motif de non-inscription (conditionnel) */}
            {statut === 'non_inscrit' && (
              <div className="space-y-2 animate-in slide-in-from-top-2">
                <Label htmlFor="motif" className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  Motif de non-inscription *
                </Label>
                <Select
                  value={motifNonInscription}
                  onValueChange={setMotifNonInscription}
                  disabled={reasonsLoading}
                >
                  <SelectTrigger id="motif" className="border-red-200">
                    <SelectValue placeholder="Sélectionnez un motif" />
                  </SelectTrigger>
                  <SelectContent>
                    {rejectionReasons?.map((reason) => (
                      <SelectItem key={reason.id} value={reason.id}>
                        {reason.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Confirmation inscrit */}
            {statut === 'inscrit' && (
              <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg animate-in slide-in-from-top-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="text-green-700 text-sm">
                  Super ! Le prospect sera marqué comme inscrit.
                </span>
              </div>
            )}

            {/* Commentaire */}
            <div className="space-y-2">
              <Label htmlFor="commentaire">
                Commentaire
                <span className="text-sm text-gray-500 ml-1">(optionnel)</span>
              </Label>
              <Textarea
                id="commentaire"
                value={commentaire}
                onChange={(e) => setCommentaire(e.target.value)}
                placeholder="Notes supplémentaires sur la visite..."
                rows={3}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              createVisitMutation.isPending ||
              !statut ||
              (statut === 'non_inscrit' && !motifNonInscription)
            }
            className={statut === 'inscrit' ? 'bg-green-600 hover:bg-green-700' : statut === 'non_inscrit' ? 'bg-red-600 hover:bg-red-700' : ''}
          >
            {createVisitMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enregistrement...
              </>
            ) : (
              'Déclarer la visite'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
