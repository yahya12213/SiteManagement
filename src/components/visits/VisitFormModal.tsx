// @ts-nocheck
/**
 * Modal d'enregistrement d'une visite physique
 * Avec validation du téléphone et gestion des motifs de non-inscription
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Phone, UserCheck, UserX, MapPin, AlertCircle, CheckCircle } from 'lucide-react';
import { useCreateVisit, useRejectionReasons } from '@/hooks/useVisits';
import { useCities } from '@/hooks/useCities';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface VisitFormModalProps {
  open: boolean;
  onClose: () => void;
  defaultCentreVilleId?: string;
  defaultPhone?: string;
  defaultNom?: string;
  defaultPrenom?: string;
}

export function VisitFormModal({ open, onClose, defaultCentreVilleId, defaultPhone, defaultNom, defaultPrenom }: VisitFormModalProps) {
  const [centreVilleId, setCentreVilleId] = useState<string>(defaultCentreVilleId || '');
  const [phoneInput, setPhoneInput] = useState<string>(defaultPhone || '');
  const [nom, setNom] = useState<string>('');
  const [prenom, setPrenom] = useState<string>('');
  const [statut, setStatut] = useState<'inscrit' | 'non_inscrit' | ''>('');
  const [motifNonInscription, setMotifNonInscription] = useState<string>('');
  const [commentaire, setCommentaire] = useState<string>('');
  const [phoneValid, setPhoneValid] = useState<boolean | null>(null);
  const [phoneError, setPhoneError] = useState<string>('');

  const { data: cities = [], isLoading: citiesLoading } = useCities();
  const { data: rejectionReasons = [], isLoading: reasonsLoading } = useRejectionReasons();
  const createVisitMutation = useCreateVisit();

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      // Pré-remplir avec les valeurs par défaut à l'ouverture
      setCentreVilleId(defaultCentreVilleId || '');
      setPhoneInput(defaultPhone || '');
      setNom(defaultNom || '');
      setPrenom(defaultPrenom || '');
      setStatut('');
      setMotifNonInscription('');
      setCommentaire('');
      setPhoneValid(defaultPhone ? true : null);
      setPhoneError('');
    }
  }, [open, defaultCentreVilleId, defaultPhone, defaultNom, defaultPrenom]);

  // Validation téléphone en temps réel
  useEffect(() => {
    if (!phoneInput || phoneInput.length < 8) {
      setPhoneValid(null);
      setPhoneError('');
      return;
    }

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
    if (!centreVilleId) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez sélectionner un centre/ville',
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
      centre_ville_id: centreVilleId,
      phone: phoneInput,
      nom: nom || undefined,
      prenom: prenom || undefined,
      statut: statut as 'inscrit' | 'non_inscrit',
      motif_non_inscription: statut === 'non_inscrit' ? motifNonInscription : undefined,
      commentaire: commentaire || undefined,
    };

    createVisitMutation.mutate(visitData, {
      onSuccess: (data) => {
        toast({
          title: 'Succès',
          description: data.message || 'Visite enregistrée avec succès',
        });
        onClose();
      },
      onError: (error: any) => {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: error.message || "Impossible d'enregistrer la visite",
        });
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[600px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <MapPin className="h-5 w-5 text-blue-600" />
            Enregistrer une visite
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Centre/Ville */}
          <div className="space-y-2">
            <Label htmlFor="centre">Centre / Ville *</Label>
            <Select value={centreVilleId} onValueChange={setCentreVilleId} disabled={citiesLoading}>
              <SelectTrigger id="centre">
                <SelectValue placeholder="Sélectionnez un centre" />
              </SelectTrigger>
              <SelectContent>
                {cities?.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Téléphone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Téléphone *</Label>
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
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                Numéro valide
              </p>
            )}
          </div>

          {/* Nom et Prénom */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nom">
                Nom
                <span className="text-sm text-gray-500 ml-1">(optionnel)</span>
              </Label>
              <Input
                id="nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Nom du visiteur"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prenom">
                Prénom
                <span className="text-sm text-gray-500 ml-1">(optionnel)</span>
              </Label>
              <Input
                id="prenom"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                placeholder="Prénom du visiteur"
              />
            </div>
          </div>

          {/* Statut (Inscrit / Non-inscrit) */}
          <div className="space-y-3">
            <Label>Statut de l'issue *</Label>
            <RadioGroup
              value={statut}
              onValueChange={(value) => {
                setStatut(value as 'inscrit' | 'non_inscrit');
                if (value === 'inscrit') {
                  setMotifNonInscription('');
                }
              }}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="inscrit" id="inscrit" />
                <Label
                  htmlFor="inscrit"
                  className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border transition-colors ${
                    statut === 'inscrit'
                      ? 'bg-green-50 border-green-300 text-green-700'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <UserCheck className="h-4 w-4" />
                  Inscrit
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="non_inscrit" id="non_inscrit" />
                <Label
                  htmlFor="non_inscrit"
                  className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-lg border transition-colors ${
                    statut === 'non_inscrit'
                      ? 'bg-red-50 border-red-300 text-red-700'
                      : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <UserX className="h-4 w-4" />
                  Non inscrit
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Motif de non-inscription (conditionnel) */}
          {statut === 'non_inscrit' && (
            <div className="space-y-2 animate-in slide-in-from-top-2">
              <Label htmlFor="motif">Motif de non-inscription *</Label>
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
              <p className="text-xs text-gray-500">
                Ce champ est obligatoire pour les visiteurs non inscrits
              </p>
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

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              createVisitMutation.isPending ||
              !centreVilleId ||
              !statut ||
              phoneValid === false ||
              (statut === 'non_inscrit' && !motifNonInscription)
            }
          >
            {createVisitMutation.isPending ? 'Enregistrement...' : 'Enregistrer la visite'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
