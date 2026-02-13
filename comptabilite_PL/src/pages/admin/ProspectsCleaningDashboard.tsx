// @ts-nocheck
/**
 * Dashboard de nettoyage des prospects
 * Affiche les stats et permet de lancer le nettoyage batch
 */

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Trash2,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Play,
  AlertCircle,
} from 'lucide-react';
import {
  useCleaningStats,
  useProspectsToDelete,
  useBatchClean,
  useReinjectProspect,
} from '@/hooks/useProspects';
import { usePermission } from '@/hooks/usePermission';
import { toast } from '@/hooks/use-toast';

export default function ProspectsCleaningDashboard() {
  const { commercialisation } = usePermission();
  const [limit] = useState(100);
  const [offset, setOffset] = useState(0);
  const [previewMode, setPreviewMode] = useState(true);

  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = useCleaningStats();
  const { data: prospectsToDelete, isLoading: listLoading, refetch: refetchList } = useProspectsToDelete(limit, offset);
  const batchCleanMutation = useBatchClean();
  const reinjectMutation = useReinjectProspect();

  const handleRunCleaningBatch = () => {
    if (!confirm('Voulez-vous recalculer les décisions de nettoyage pour tous les prospects ?')) {
      return;
    }

    batchCleanMutation.mutate(false, {
      onSuccess: (result) => {
        toast({
          title: 'Nettoyage recalculé',
          description: `${result.total} prospects analysés. ${result.supprimer} marqués pour suppression.`,
        });
        refetchStats();
        refetchList();
      },
      onError: (error: any) => {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: error.message || 'Impossible de lancer le nettoyage',
        });
      },
    });
  };

  const handleExecuteDeletion = () => {
    const count = stats?.supprimer?.total || 0;

    if (count === 0) {
      toast({
        title: 'Aucun prospect à supprimer',
        description: 'Lancez d\'abord le recalcul des décisions',
      });
      return;
    }

    if (
      !confirm(
        `⚠️ ATTENTION: Vous allez supprimer définitivement ${count} prospects.\n\nCette action est IRRÉVERSIBLE.\n\nÊtes-vous absolument sûr ?`
      )
    ) {
      return;
    }

    // Double confirmation
    if (
      !confirm(
        `Confirmez-vous la suppression de ${count} prospects ?\n\nDernière chance pour annuler.`
      )
    ) {
      return;
    }

    batchCleanMutation.mutate(true, {
      onSuccess: (result) => {
        toast({
          title: 'Suppression effectuée',
          description: `${result.deleted || 0} prospects supprimés définitivement.`,
        });
        refetchStats();
        refetchList();
      },
      onError: (error: any) => {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: error.message || 'Impossible de supprimer les prospects',
        });
      },
    });
  };

  const handleReinject = (prospectId: string) => {
    if (!confirm('Voulez-vous réinjecter ce prospect (remise à zéro) ?')) {
      return;
    }

    reinjectMutation.mutate(prospectId, {
      onSuccess: () => {
        toast({
          title: 'Prospect réinjecté',
          description: 'Le prospect a été réinitialisé avec succès',
        });
        refetchList();
        refetchStats();
      },
      onError: (error: any) => {
        toast({
          variant: 'destructive',
          title: 'Erreur',
          description: error.message || 'Impossible de réinjecter le prospect',
        });
      },
    });
  };

  return (
    <AppLayout>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Nettoyage des Prospects</h1>
          <p className="text-muted-foreground mt-1">
            Gérez le nettoyage automatique des prospects obsolètes
          </p>
        </div>

        {/* Règles de nettoyage */}
        <Alert className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Règles de nettoyage automatique</AlertTitle>
          <AlertDescription className="text-sm space-y-2">
            <p>Le système marque automatiquement les prospects selon les règles suivantes :</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li><strong>À supprimer</strong> : RDV dépassé de plus de 7 jours OU injection ancienne (3+ jours) sans activité</li>
              <li><strong>À garder</strong> : RDV planifié futur OU injection récente (&lt; 3 jours)</li>
              <li><strong>À revoir</strong> : Situations ambiguës nécessitant une décision manuelle</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* Stats cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">À garder</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats?.laisser?.total || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.laisser?.avec_rdv || 0} avec RDV, {stats?.laisser?.non_contactes || 0} non contactés
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">À supprimer</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats?.supprimer?.total || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.supprimer?.avec_rdv || 0} avec RDV, {stats?.supprimer?.non_contactes || 0} non contactés
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">À revoir manuellement</CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {stats?.a_revoir_manuelle?.total || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.a_revoir_manuelle?.avec_rdv || 0} avec RDV, {stats?.a_revoir_manuelle?.non_contactes || 0} non contactés
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex gap-4 mb-6">
          {commercialisation.canCleanProspects && (
            <>
              <Button
                onClick={handleRunCleaningBatch}
                disabled={batchCleanMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${batchCleanMutation.isPending ? 'animate-spin' : ''}`} />
                {batchCleanMutation.isPending ? 'Recalcul en cours...' : 'Recalculer les décisions'}
              </Button>

              <Button
                onClick={handleExecuteDeletion}
                disabled={batchCleanMutation.isPending || (stats?.supprimer?.total || 0) === 0}
                variant="destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Supprimer définitivement ({stats?.supprimer?.total || 0})
              </Button>
            </>
          )}

          <Button
            onClick={() => {
              refetchStats();
              refetchList();
            }}
            variant="outline"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>

        {/* Warning */}
        {(stats?.supprimer?.total || 0) > 0 && (
          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Attention</AlertTitle>
            <AlertDescription>
              {stats?.supprimer?.total} prospects sont marqués pour suppression.
              Vérifiez la liste ci-dessous avant d'exécuter la suppression définitive.
            </AlertDescription>
          </Alert>
        )}

        {/* Prospects à supprimer */}
        <Card>
          <CardHeader>
            <CardTitle>Prospects marqués pour suppression</CardTitle>
            <CardDescription>
              Liste des {prospectsToDelete?.length || 0} premiers prospects qui seront supprimés
            </CardDescription>
          </CardHeader>
          <CardContent>
            {listLoading ? (
              <div className="text-center py-8 text-muted-foreground">Chargement...</div>
            ) : prospectsToDelete && prospectsToDelete.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Nom</TableHead>
                    <TableHead>Ville</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Date RDV</TableHead>
                    <TableHead>Date injection</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prospectsToDelete.map((prospect) => (
                    <TableRow key={prospect.id}>
                      <TableCell className="font-mono text-sm">{prospect.phone_international}</TableCell>
                      <TableCell>
                        {prospect.nom || prospect.prenom
                          ? `${prospect.nom || ''} ${prospect.prenom || ''}`.trim()
                          : '-'}
                      </TableCell>
                      <TableCell>{prospect.ville_name || 'Sans ville'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{prospect.statut_contact}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {prospect.date_rdv
                          ? new Date(prospect.date_rdv).toLocaleDateString('fr-FR')
                          : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {prospect.date_injection
                          ? new Date(prospect.date_injection).toLocaleDateString('fr-FR')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {commercialisation.canReinjectProspect && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReinject(prospect.id)}
                            disabled={reinjectMutation.isPending}
                          >
                            <Play className="h-3 w-3 mr-1" />
                            Réinjecter
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Aucun prospect marqué pour suppression
              </div>
            )}

            {/* Pagination */}
            {prospectsToDelete && prospectsToDelete.length >= limit && (
              <div className="flex justify-between items-center mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => setOffset(Math.max(0, offset - limit))}
                >
                  Précédent
                </Button>
                <span className="text-sm text-muted-foreground">
                  Affichage de {offset + 1} à {offset + (prospectsToDelete?.length || 0)}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOffset(offset + limit)}
                  disabled={prospectsToDelete.length < limit}
                >
                  Suivant
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
