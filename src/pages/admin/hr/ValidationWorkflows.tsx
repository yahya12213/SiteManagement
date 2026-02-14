/**
 * Boucles de Validation (ValidationWorkflows)
 * Système de création et gestion des circuits d'approbation automatiques pour les demandes RH
 * Connecté à l'API backend
 */

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  GitBranch,
  Plus,
  Edit,
  Trash2,
  Play,
  Pause,
  ArrowUp,
  ArrowDown,
  Users,
  Loader2,
  AlertCircle,
  X,
} from 'lucide-react';

// Hooks
import {
  useValidationWorkflows,
  useCreateWorkflow,
  useUpdateWorkflow,
  useToggleWorkflow,
  useDeleteWorkflow,
  useAddStep,
  useDeleteStep,
  useMoveStep,
  useWorkflowStats,
} from '@/hooks/useValidationWorkflows';

// Types & Constants
import {
  TRIGGER_TYPES,
  APPROVER_TYPES,
  type ValidationWorkflow,
} from '@/lib/api/validation-workflows';

export default function ValidationWorkflows() {
  const { toast } = useToast();

  // State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showStepsModal, setShowStepsModal] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<ValidationWorkflow | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<ValidationWorkflow | null>(null);

  const [formData, setFormData] = useState({
    nom: '',
    description: '',
    declencheur: '',
    segment_id: '',
  });

  const [stepForm, setStepForm] = useState({
    validateur_type: 'manager' as 'user' | 'role' | 'manager' | 'hr',
    validateur_nom: '',
    validateur_role: '',
    timeout_hours: 48,
  });

  // Queries
  const { data: workflowsData, isLoading, error } = useValidationWorkflows();
  const { data: statsData } = useWorkflowStats();

  // Mutations
  const createWorkflow = useCreateWorkflow();
  const updateWorkflow = useUpdateWorkflow();
  const toggleWorkflow = useToggleWorkflow();
  const deleteWorkflow = useDeleteWorkflow();
  const addStep = useAddStep();
  const deleteStep = useDeleteStep();
  const moveStep = useMoveStep();

  // Data
  const workflows = workflowsData?.workflows || [];
  const stats = statsData?.stats || { total: 0, active: 0, inactive: 0, trigger_types: 0 };

  // Update selectedWorkflow when workflows change
  useEffect(() => {
    if (selectedWorkflow) {
      const updated = workflows.find(w => w.id === selectedWorkflow.id);
      if (updated) {
        setSelectedWorkflow(updated);
      }
    }
  }, [workflows]);

  // Handlers
  const handleCreate = () => {
    setFormData({ nom: '', description: '', declencheur: '', segment_id: '' });
    setEditingWorkflow(null);
    setShowCreateModal(true);
  };

  const handleEdit = (workflow: ValidationWorkflow) => {
    setFormData({
      nom: workflow.nom,
      description: workflow.description || '',
      declencheur: workflow.declencheur,
      segment_id: workflow.segment_id || '',
    });
    setEditingWorkflow(workflow);
    setShowCreateModal(true);
  };

  const handleManageSteps = (workflow: ValidationWorkflow) => {
    setSelectedWorkflow(workflow);
    setShowStepsModal(true);
  };

  const handleToggleActive = async (id: string) => {
    try {
      const result = await toggleWorkflow.mutateAsync(id);
      toast({ title: 'Succès', description: result.message });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message || 'Erreur', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette boucle de validation ?')) return;
    try {
      await deleteWorkflow.mutateAsync(id);
      toast({ title: 'Succès', description: 'Workflow supprimé' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message || 'Erreur lors de la suppression', variant: 'destructive' });
    }
  };

  const handleSave = async () => {
    if (!formData.nom || !formData.declencheur) {
      toast({ title: 'Erreur', description: 'Veuillez remplir tous les champs obligatoires', variant: 'destructive' });
      return;
    }

    try {
      if (editingWorkflow) {
        await updateWorkflow.mutateAsync({ id: editingWorkflow.id, data: formData });
        toast({ title: 'Succès', description: 'Workflow mis à jour' });
      } else {
        await createWorkflow.mutateAsync(formData);
        toast({ title: 'Succès', description: 'Workflow créé' });
      }
      setShowCreateModal(false);
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message || 'Erreur', variant: 'destructive' });
    }
  };

  const handleAddStep = async () => {
    if (!selectedWorkflow || !stepForm.validateur_nom) {
      toast({ title: 'Erreur', description: 'Veuillez saisir un nom pour le validateur', variant: 'destructive' });
      return;
    }

    try {
      await addStep.mutateAsync({
        workflowId: selectedWorkflow.id,
        data: {
          validateur_type: stepForm.validateur_type,
          validateur_nom: stepForm.validateur_nom,
          validateur_role: stepForm.validateur_role,
          timeout_hours: stepForm.timeout_hours,
        }
      });
      toast({ title: 'Succès', description: 'Étape ajoutée' });
      setStepForm({ validateur_type: 'manager', validateur_nom: '', validateur_role: '', timeout_hours: 48 });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message || 'Erreur', variant: 'destructive' });
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    if (!selectedWorkflow) return;
    if (!confirm('Supprimer cette étape ?')) return;
    try {
      await deleteStep.mutateAsync({ workflowId: selectedWorkflow.id, stepId });
      toast({ title: 'Succès', description: 'Étape supprimée' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message || 'Erreur', variant: 'destructive' });
    }
  };

  const handleMoveStep = async (stepId: string, direction: 'up' | 'down') => {
    if (!selectedWorkflow) return;
    try {
      await moveStep.mutateAsync({ workflowId: selectedWorkflow.id, stepId, direction });
      toast({ title: 'Succès', description: 'Étape déplacée' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message || 'Erreur', variant: 'destructive' });
    }
  };

  // Loading/Error states
  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-500">Chargement...</span>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="p-6 flex items-center justify-center min-h-[400px]">
          <AlertCircle className="h-8 w-8 text-red-500" />
          <span className="ml-2 text-red-500">Erreur de chargement. Veuillez exécuter la migration 051.</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <GitBranch className="h-8 w-8 text-blue-600" />
              Boucles de Validation
            </h1>
            <p className="text-gray-500 mt-1">
              Gérez les circuits d'approbation automatiques pour les demandes RH
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle boucle
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Actives</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Inactives</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-400">{stats.inactive}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-500">Types de déclencheurs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.trigger_types}</div>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des boucles de validation</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Déclencheur</TableHead>
                  <TableHead>Étapes</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Créé le</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workflows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      Aucune boucle de validation configurée. Cliquez sur "Nouvelle boucle" pour créer.
                    </TableCell>
                  </TableRow>
                ) : (
                  workflows.map(workflow => (
                    <TableRow key={workflow.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{workflow.nom}</div>
                          <div className="text-sm text-gray-500">{workflow.description}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {TRIGGER_TYPES.find(t => t.value === workflow.declencheur)?.label || workflow.declencheur}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex items-center gap-1"
                          onClick={() => handleManageSteps(workflow)}
                        >
                          <Users className="h-4 w-4 text-gray-400" />
                          <span>{workflow.etapes?.length || workflow.etapes_count || 0} étape(s)</span>
                        </Button>
                      </TableCell>
                      <TableCell>
                        {workflow.actif ? (
                          <Badge className="bg-green-100 text-green-800">Actif</Badge>
                        ) : (
                          <Badge variant="outline" className="text-gray-500">Inactif</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(workflow.created_at).toLocaleDateString('fr-FR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(workflow.id)}
                            title={workflow.actif ? 'Désactiver' : 'Activer'}
                            disabled={toggleWorkflow.isPending}
                          >
                            {workflow.actif ? (
                              <Pause className="h-4 w-4 text-orange-500" />
                            ) : (
                              <Play className="h-4 w-4 text-green-500" />
                            )}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(workflow)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(workflow.id)}
                            disabled={deleteWorkflow.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create/Edit Modal */}
        <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
          <DialogContent className="w-[95vw] sm:w-[500px] md:w-[550px] max-w-[95vw]">
            <DialogHeader>
              <DialogTitle>
                {editingWorkflow ? 'Modifier la boucle' : 'Nouvelle boucle de validation'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nom *</Label>
                <Input
                  value={formData.nom}
                  onChange={e => setFormData({ ...formData, nom: e.target.value })}
                  placeholder="Ex: Approbation Congés Standard"
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description de la boucle de validation"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Type de déclencheur *</Label>
                <Select
                  value={formData.declencheur}
                  onValueChange={v => setFormData({ ...formData, declencheur: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionnez un déclencheur" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateModal(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleSave}
                disabled={createWorkflow.isPending || updateWorkflow.isPending}
              >
                {(createWorkflow.isPending || updateWorkflow.isPending) && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                {editingWorkflow ? 'Enregistrer' : 'Créer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Steps Management Modal */}
        <Dialog open={showStepsModal} onOpenChange={setShowStepsModal}>
          <DialogContent className="w-[95vw] sm:w-[650px] md:w-[750px] lg:w-[850px] max-w-[95vw]">
            <DialogHeader>
              <DialogTitle>
                Gérer les étapes - {selectedWorkflow?.nom}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Current Steps */}
              <div>
                <h3 className="font-medium mb-3">Étapes actuelles</h3>
                {selectedWorkflow?.etapes && selectedWorkflow.etapes.length > 0 ? (
                  <div className="space-y-2">
                    {selectedWorkflow.etapes.map((step, index) => (
                      <div
                        key={step.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-medium">
                            {step.ordre || index + 1}
                          </div>
                          <div>
                            <div className="font-medium">{step.validateur_nom}</div>
                            <div className="text-sm text-gray-500">
                              {APPROVER_TYPES.find(t => t.value === step.validateur_type)?.label || step.validateur_type}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoveStep(step.id, 'up')}
                            disabled={index === 0 || moveStep.isPending}
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMoveStep(step.id, 'down')}
                            disabled={index === selectedWorkflow.etapes.length - 1 || moveStep.isPending}
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteStep(step.id)}
                            disabled={deleteStep.isPending}
                          >
                            <X className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-gray-500 bg-gray-50 rounded-lg">
                    Aucune étape configurée
                  </div>
                )}
              </div>

              {/* Add Step Form */}
              <div className="border-t pt-4">
                <h3 className="font-medium mb-3">Ajouter une étape</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Type de validateur</Label>
                    <Select
                      value={stepForm.validateur_type}
                      onValueChange={(v: any) => setStepForm({ ...stepForm, validateur_type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {APPROVER_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Nom du validateur</Label>
                    <Input
                      value={stepForm.validateur_nom}
                      onChange={e => setStepForm({ ...stepForm, validateur_nom: e.target.value })}
                      placeholder="Ex: Manager direct"
                    />
                  </div>
                </div>
                <Button
                  className="mt-4"
                  onClick={handleAddStep}
                  disabled={addStep.isPending}
                >
                  {addStep.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <Plus className="h-4 w-4 mr-2" />
                  Ajouter l'étape
                </Button>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowStepsModal(false)}>
                Fermer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
