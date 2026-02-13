// @ts-nocheck
/**
 * Modal d'ajout rapide de prospect
 * Avec validation du téléphone international
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Phone, UserPlus, AlertCircle } from 'lucide-react';
import { useCreateProspect, useCountryCodes } from '@/hooks/useProspects';
import { useSegments } from '@/hooks/useSegments';
import { useCitiesBySegment } from '@/hooks/useCities';
import { toast } from '@/hooks/use-toast';
import { SearchableSelect } from '@/components/ui/searchable-select';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface QuickAddProspectModalProps {
  open: boolean;
  onClose: () => void;
}

export function QuickAddProspectModal({ open, onClose }: QuickAddProspectModalProps) {
  const [segmentId, setSegmentId] = useState<string>('');
  const [villeId, setVilleId] = useState<string>('');
  const [phoneInput, setPhoneInput] = useState<string>('');
  const [nom, setNom] = useState<string>('');
  const [prenom, setPrenom] = useState<string>('');
  const [phoneValid, setPhoneValid] = useState<boolean | null>(null);
  const [phoneError, setPhoneError] = useState<string>('');

  const { data: segments, isLoading: segmentsLoading } = useSegments();
  // applyScope=false pour afficher TOUTES les villes du segment, pas seulement celles assignées à l'utilisateur
  const { data: cities, isLoading: citiesLoading } = useCitiesBySegment(segmentId, false);
  const { data: countryCodes } = useCountryCodes();
  const createProspectMutation = useCreateProspect();

  // Reset form when modal closes
  useEffect(() => {
    if (!open) {
      setSegmentId('');
      setVilleId('');
      setPhoneInput('');
      setNom('');
      setPrenom('');
      setPhoneValid(null);
      setPhoneError('');
    }
  }, [open]);

  // Validation téléphone en temps réel
  useEffect(() => {
    if (!phoneInput || phoneInput.length < 8) {
      setPhoneValid(null);
      setPhoneError('');
      return;
    }

    // Simple validation côté client (validation serveur sera faite à la soumission)
    const cleaned = phoneInput.replace(/[\s\-\(\)\.]/g, '');

    if (!/^[\+0-9]+$/.test(cleaned)) {
      setPhoneValid(false);
      setPhoneError('Le numéro contient des caractères invalides');
      return;
    }

    if (cleaned.length < 8 || cleaned.length > 15) {
      setPhoneValid(false);
      setPhoneError('Le numéro doit contenir entre 8 et 15 chiffres');
      return;
    }

    setPhoneValid(true);
    setPhoneError('');
  }, [phoneInput]);

  const handleSubmit = () => {
    // Validation
    if (!segmentId) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez sélectionner un segment',
      });
      return;
    }

    if (!villeId) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez sélectionner une ville',
      });
      return;
    }

    if (!phoneInput || phoneValid === false) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez saisir un numéro de téléphone valide',
      });
      return;
    }

    // Préparer les données
    const prospectData = {
      segment_id: segmentId,
      ville_id: villeId,
      phone: phoneInput, // Backend attend "phone", pas "phone_international"
      nom: nom || null,
      prenom: prenom || null,
    };

    createProspectMutation.mutate(prospectData, {
      onSuccess: (data) => {
        // Le backend peut renvoyer un prospect réinjecté au lieu d'un nouveau
        const message = data.message || 'Prospect créé avec succès';

        toast({
          title: 'Succès',
          description: message,
        });
        onClose();
      },
      onError: (error: any) => {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: error.message || "Impossible de créer le prospect",
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[550px] max-w-[95vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5 text-blue-600" />
            Ajouter un prospect
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Segment */}
          <div className="space-y-2">
            <Label htmlFor="segment">Segment *</Label>
            <SearchableSelect
              options={(segments || []).map((segment) => ({
                value: segment.id,
                label: segment.name,
              }))}
              value={segmentId}
              onValueChange={(value) => {
                setSegmentId(value);
                setVilleId(''); // Reset ville when segment changes
              }}
              placeholder="Sélectionnez un segment"
              searchPlaceholder="Rechercher un segment..."
              disabled={segmentsLoading}
              emptyMessage="Aucun segment trouvé"
            />
          </div>

          {/* Ville */}
          <div className="space-y-2">
            <Label htmlFor="ville">Ville *</Label>
            <SearchableSelect
              options={(cities || []).map((city) => ({
                value: city.id,
                label: `${city.name} (${city.code})`,
                searchValue: city.code,
              }))}
              value={villeId}
              onValueChange={setVilleId}
              placeholder="Sélectionnez une ville"
              disabled={!segmentId || citiesLoading}
              emptyMessage="Aucune ville trouvée"
            />
            {!segmentId && (
              <p className="text-xs text-gray-500">
                Sélectionnez d'abord un segment pour voir les villes disponibles
              </p>
            )}
          </div>

          {/* Téléphone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone international *</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                id="phone"
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="+212612345678 ou 0612345678"
                className={`pl-10 ${
                  phoneValid === true
                    ? 'border-green-500 focus-visible:ring-green-500'
                    : phoneValid === false
                    ? 'border-red-500 focus-visible:ring-red-500'
                    : ''
                }`}
              />
            </div>
            {phoneError && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                {phoneError}
              </p>
            )}
            {phoneValid && (
              <p className="text-sm text-green-600">Numéro valide</p>
            )}
            <p className="text-xs text-gray-500">
              Formats acceptés: +XXX... (international), 0XXX... (local Maroc)
            </p>
          </div>

          {/* Nom */}
          <div className="space-y-2">
            <Label htmlFor="nom">
              Nom
              <span className="text-sm text-gray-500 ml-2">(optionnel)</span>
            </Label>
            <Input
              id="nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Nom du prospect"
            />
          </div>

          {/* Prénom */}
          <div className="space-y-2">
            <Label htmlFor="prenom">
              Prénom
              <span className="text-sm text-gray-500 ml-2">(optionnel)</span>
            </Label>
            <Input
              id="prenom"
              value={prenom}
              onChange={(e) => setPrenom(e.target.value)}
              placeholder="Prénom du prospect"
            />
          </div>

          {/* Info pays supportés */}
          {countryCodes && countryCodes.length > 0 && (
            <Alert>
              <AlertDescription className="text-xs">
                {countryCodes.length} pays supportés pour la validation internationale
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createProspectMutation.isPending || !segmentId || !villeId || phoneValid === false}
          >
            {createProspectMutation.isPending ? 'Ajout...' : 'Ajouter'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
