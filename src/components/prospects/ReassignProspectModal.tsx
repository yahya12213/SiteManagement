// @ts-nocheck
/**
 * Modal de réassignation manuelle de prospect
 * Permet de changer l'assistante assignée et la ville
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { UserCog, User, MapPin } from 'lucide-react';
import { useProspect, useUpdateProspect } from '@/hooks/useProspects';
import { useUsers } from '@/hooks/useUsers';
import { useCitiesBySegment } from '@/hooks/useCities';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ReassignProspectModalProps {
  open: boolean;
  onClose: () => void;
  prospectId: string | null;
}

export function ReassignProspectModal({ open, onClose, prospectId }: ReassignProspectModalProps) {
  const [assignedTo, setAssignedTo] = useState<string>('');
  const [villeId, setVilleId] = useState<string>('');

  const { data: prospect, isLoading: prospectLoading } = useProspect(prospectId || '');
  const { data: users, isLoading: usersLoading } = useUsers({ role: 'assistante' });
  const { data: cities, isLoading: citiesLoading } = useCitiesBySegment(prospect?.segment_id || '');
  const updateProspectMutation = useUpdateProspect();

  // Initialiser les valeurs avec le prospect actuel
  useEffect(() => {
    if (prospect) {
      setAssignedTo(prospect.assigned_to || '');
      setVilleId(prospect.ville_id || '');
    }
  }, [prospect]);

  // Reset au close
  useEffect(() => {
    if (!open) {
      setAssignedTo('');
      setVilleId('');
    }
  }, [open]);

  const handleSave = () => {
    if (!prospectId) return;

    // Vérifier qu'au moins un changement a été fait
    if (assignedTo === (prospect?.assigned_to || '') && villeId === (prospect?.ville_id || '')) {
      toast({
        title: 'Aucun changement',
        description: 'Aucune modification détectée',
      });
      return;
    }

    const updateData = {
      id: prospectId,
      assigned_to: assignedTo || null,
      ville_id: villeId || null,
    };

    updateProspectMutation.mutate(updateData, {
      onSuccess: () => {
        toast({
          title: 'Réassignation réussie',
          description: 'Le prospect a été réassigné avec succès',
        });
        onClose();
      },
      onError: (error: any) => {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: error.message || 'Impossible de réassigner le prospect',
        });
      },
    });
  };

  if (prospectLoading || !prospect) {
    return null;
  }

  // Filtrer les assistantes qui ont accès à ce segment
  const availableAssistantes = users?.filter((user) => {
    // Si l'utilisateur n'a pas de segments assignés, il a accès à tous
    if (!user.segments || user.segments.length === 0) {
      return true;
    }
    // Sinon, vérifier que le segment du prospect est dans les segments de l'assistante
    return user.segments.includes(prospect.segment_id);
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:w-[500px] md:w-[550px] max-w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5" />
            Réassigner le prospect
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Informations du prospect */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <div className="text-sm font-medium">
              {prospect.prenom} {prospect.nom}
            </div>
            <div className="text-sm text-gray-600">{prospect.phone_international}</div>
            <div className="flex gap-4 text-xs text-gray-500">
              <span>Segment: {prospect.segment_name}</span>
              <span>Statut: {prospect.statut_contact}</span>
            </div>
          </div>

          {/* Assignation actuelle */}
          <div className="border-l-4 border-blue-500 pl-4 bg-blue-50 p-3 rounded">
            <div className="text-sm font-medium text-blue-700 mb-1">Assignation actuelle</div>
            <div className="flex gap-4 text-sm text-blue-600">
              <span>
                <User className="inline h-3 w-3 mr-1" />
                {prospect.assistante_name || 'Non assigné'}
              </span>
              <span>
                <MapPin className="inline h-3 w-3 mr-1" />
                {prospect.ville_name || 'Sans ville'}
              </span>
            </div>
          </div>

          {/* Nouvelle assignation - Assistante */}
          <div className="space-y-2">
            <Label htmlFor="assistante">Nouvelle assistante</Label>
            <Select
              value={assignedTo}
              onValueChange={setAssignedTo}
              disabled={usersLoading}
            >
              <SelectTrigger id="assistante">
                <SelectValue placeholder="Sélectionnez une assistante" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Aucune assignation (auto-assignment)</SelectItem>
                {availableAssistantes?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.first_name} {user.last_name}
                    {user.email && (
                      <span className="text-xs text-gray-500 ml-2">({user.email})</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableAssistantes && availableAssistantes.length === 0 && (
              <p className="text-xs text-red-600">
                Aucune assistante disponible pour ce segment
              </p>
            )}
          </div>

          {/* Nouvelle assignation - Ville */}
          <div className="space-y-2">
            <Label htmlFor="ville">Nouvelle ville</Label>
            <Select
              value={villeId}
              onValueChange={setVilleId}
              disabled={citiesLoading}
            >
              <SelectTrigger id="ville">
                <SelectValue placeholder="Sélectionnez une ville" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Sans ville</SelectItem>
                {cities?.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Avertissement si les deux champs sont vides */}
          {!assignedTo && !villeId && (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
              ⚠️ Si vous ne sélectionnez ni assistante ni ville, le prospect sera réassigné automatiquement selon la charge de travail.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateProspectMutation.isPending}
          >
            {updateProspectMutation.isPending ? 'Enregistrement...' : 'Réassigner'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
