// @ts-nocheck
/**
 * Modal pour afficher et créer des visites pour un prospect spécifique
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Footprints,
  Plus,
  UserCheck,
  UserX,
  Calendar,
  MapPin,
  Phone,
  MessageSquare,
  Loader2
} from 'lucide-react';
import { useVisits, useCreateVisit, useRejectionReasons } from '@/hooks/useVisits';
import { VisitFormModal } from '@/components/visits/VisitFormModal';

interface ProspectVisitsModalProps {
  open: boolean;
  onClose: () => void;
  prospect: {
    id: string;
    phone_international: string;
    nom?: string;
    prenom?: string;
    ville_id?: string;
    ville_name?: string;
  } | null;
}

export function ProspectVisitsModal({ open, onClose, prospect }: ProspectVisitsModalProps) {
  const [showAddVisitModal, setShowAddVisitModal] = useState(false);

  // Rechercher les visites par numéro de téléphone du prospect
  const { data, isLoading, refetch } = useVisits(
    prospect?.phone_international
      ? { search: prospect.phone_international, limit: 100 }
      : undefined
  );

  const visits = data?.visits || [];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleAddVisitSuccess = () => {
    setShowAddVisitModal(false);
    refetch();
  };

  if (!prospect) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="w-[900px] max-w-[95vw] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Footprints className="h-5 w-5 text-purple-600" />
              Visites du prospect
            </DialogTitle>
          </DialogHeader>

          {/* Infos prospect */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-500" />
                  <span className="font-mono font-medium">{prospect.phone_international}</span>
                </div>
                {(prospect.nom || prospect.prenom) && (
                  <div className="text-gray-600">
                    {prospect.prenom} {prospect.nom}
                  </div>
                )}
                {prospect.ville_name && (
                  <div className="flex items-center gap-1 text-gray-500">
                    <MapPin className="h-4 w-4" />
                    {prospect.ville_name}
                  </div>
                )}
              </div>
              <Button
                size="sm"
                onClick={() => setShowAddVisitModal(true)}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Plus className="h-4 w-4 mr-1" />
                Nouvelle visite
              </Button>
            </div>
          </div>

          {/* Liste des visites */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : visits.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Footprints className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="font-medium">Aucune visite enregistrée</p>
                <p className="text-sm mt-1">Ce prospect n'a pas encore effectué de visite physique</p>
                <Button
                  className="mt-4 bg-purple-600 hover:bg-purple-700"
                  onClick={() => setShowAddVisitModal(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Enregistrer une visite
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Centre/Ville</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Motif</TableHead>
                    <TableHead>Commentaire</TableHead>
                    <TableHead>Enregistré par</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visits.map((visit) => (
                    <TableRow key={visit.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span className="text-sm">{formatDate(visit.date_visite)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          {visit.centre_ville_name || '-'}
                        </div>
                      </TableCell>
                      <TableCell>
                        {visit.statut === 'inscrit' ? (
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            <UserCheck className="h-3 w-3 mr-1" />
                            Inscrit
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800 border-red-200">
                            <UserX className="h-3 w-3 mr-1" />
                            Non inscrit
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {visit.statut === 'non_inscrit' && visit.motif_label ? (
                          <span className="text-sm text-orange-700">{visit.motif_label}</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {visit.commentaire ? (
                          <div className="flex items-start gap-1 max-w-[200px]">
                            <MessageSquare className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                            <span className="text-sm text-gray-600 truncate">{visit.commentaire}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {visit.created_by_name || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Résumé */}
          {visits.length > 0 && (
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center justify-between text-sm">
                <div className="flex gap-4">
                  <span className="text-gray-600">
                    Total: <strong>{visits.length}</strong> visite(s)
                  </span>
                  <span className="text-green-600">
                    Inscrit: <strong>{visits.filter(v => v.statut === 'inscrit').length}</strong>
                  </span>
                  <span className="text-red-600">
                    Non inscrit: <strong>{visits.filter(v => v.statut === 'non_inscrit').length}</strong>
                  </span>
                </div>
                <Button variant="outline" onClick={onClose}>
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal d'ajout de visite */}
      <VisitFormModal
        open={showAddVisitModal}
        onClose={() => {
          setShowAddVisitModal(false);
          refetch();
        }}
        defaultCentreVilleId={prospect.ville_id}
        defaultPhone={prospect.phone_international}
        defaultNom={prospect.nom}
        defaultPrenom={prospect.prenom}
      />
    </>
  );
}
