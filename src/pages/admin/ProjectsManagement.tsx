// @ts-nocheck
/**
 * Gestion de Projet - Page principale
 * Deux onglets : Plan d'Action (tableau des tâches) et Projets Kanban (vue cartes)
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import {
  FolderKanban,
  ListTodo,
  Plus,
  PlusCircle,
  Search,
  Filter,
  Edit,
  Trash2,
  Clock,
  User,
  Calendar,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Settings,
  Users,
  DollarSign,
  MoreVertical,
  ChevronDown,
  Palette,
  Eye,
  ListChecks,
  X,
  CalendarRange,
  RotateCcw,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { profilesApi, type Profile } from '@/lib/api/profiles';
import { rolesApi } from '@/lib/api/roles';
import { useProjects, useActions, useActionStats, useCreateProject, useUpdateProject, useDeleteProject, useCreateAction, useUpdateAction, useDeleteAction, useLinkActionsToProject } from '@/hooks/useProjects';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { PERMISSIONS } from '@/config/permissions';
import ColorPicker from '@/components/ui/ColorPicker';
import ViewActionsModal from '@/components/projects/ViewActionsModal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// ==================== Constants ====================

const PROJECT_STATUS = [
  { value: 'planning', label: 'Planification', color: 'bg-gray-100 text-gray-800' },
  { value: 'in_progress', label: 'En cours', color: 'bg-blue-100 text-blue-800' },
  { value: 'completed', label: 'Terminé', color: 'bg-green-100 text-green-800' },
  { value: 'archived', label: 'Archivé', color: 'bg-yellow-100 text-yellow-800' },
];

const PROJECT_PRIORITY = [
  { value: 'normale', label: 'Normale', variant: 'secondary' as const },
  { value: 'haute', label: 'Haute', variant: 'default' as const },
  { value: 'urgente', label: 'Urgente', variant: 'destructive' as const },
];

const ACTION_STATUS = [
  { value: 'a_faire', label: 'À faire', color: 'bg-gray-100 text-gray-800', icon: Circle },
  { value: 'en_cours', label: 'En cours', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  { value: 'termine', label: 'Terminé', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
];

// ==================== Helper Functions ====================

const formatDate = (dateStr: string | null | undefined) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const isOverdue = (deadline: string | null | undefined, status: string) => {
  if (!deadline || status === 'termine') return false;
  return new Date(deadline) < new Date();
};

const isDueSoon = (deadline: string | null | undefined, status: string) => {
  if (!deadline || status === 'termine') return false;
  const deadlineDate = new Date(deadline);
  const today = new Date();
  const threeDaysFromNow = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000);
  return deadlineDate >= today && deadlineDate <= threeDaysFromNow;
};

const getRowColor = (action: any) => {
  if (action.status === 'termine') return 'bg-green-50';
  if (isOverdue(action.deadline, action.status)) return 'bg-red-50';
  if (isDueSoon(action.deadline, action.status)) return 'bg-orange-50';
  if (action.status === 'en_cours') return 'bg-yellow-50';
  return '';
};

// ==================== Main Component ====================

export default function ProjectsManagement() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState('actions');

  // Permissions
  const canCreateProject = hasPermission(PERMISSIONS.accounting.projects.create);
  const canUpdateProject = hasPermission(PERMISSIONS.accounting.projects.update);
  const canDeleteProject = hasPermission(PERMISSIONS.accounting.projects.delete);
  const canCreateAction = hasPermission(PERMISSIONS.accounting.actions.create);
  const canUpdateAction = hasPermission(PERMISSIONS.accounting.actions.update);
  const canDeleteAction = hasPermission(PERMISSIONS.accounting.actions.delete);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FolderKanban className="h-6 w-6" />
              Gestion de Projet
            </h1>
            <p className="text-gray-600">
              Gérez vos projets et suivez l'avancement des actions
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="actions" className="flex items-center gap-2">
              <ListTodo className="h-4 w-4" />
              Plan d'Action
            </TabsTrigger>
            <TabsTrigger value="projects" className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4" />
              Projets Kanban
            </TabsTrigger>
          </TabsList>

          {/* Tab: Plan d'Action */}
          <TabsContent value="actions">
            <PlanActionTab
              canCreate={canCreateAction}
              canUpdate={canUpdateAction}
              canDelete={canDeleteAction}
            />
          </TabsContent>

          {/* Tab: Projets Kanban */}
          <TabsContent value="projects">
            <ProjetKanbanTab
              canCreate={canCreateProject}
              canUpdate={canUpdateProject}
              canDelete={canDeleteProject}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

// ==================== Plan d'Action Tab ====================

function PlanActionTab({ canCreate, canUpdate, canDelete }: { canCreate: boolean; canUpdate: boolean; canDelete: boolean }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [piloteFilter, setPiloteFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingAction, setEditingAction] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);

  const { data: actions = [], isLoading } = useActions({ search: searchTerm || undefined });
  const { data: stats } = useActionStats();
  const createAction = useCreateAction();
  const updateAction = useUpdateAction();
  const deleteAction = useDeleteAction();

  // Charger les utilisateurs pour le filtre pilote
  const { data: users = [] } = useQuery({
    queryKey: ['users-for-pilote-filter'],
    queryFn: () => profilesApi.getAll(),
  });

  // Extraire la liste unique des pilotes depuis les actions
  const pilotesFromActions = useMemo(() => {
    const piloteMap = new Map();
    actions.forEach(action => {
      if (action.pilote_id && action.pilote_name) {
        piloteMap.set(action.pilote_id, action.pilote_name);
      }
    });
    return Array.from(piloteMap.entries()).map(([id, name]) => ({ id, name }));
  }, [actions]);

  // Fonction de réinitialisation des filtres
  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPiloteFilter('all');
    setDateFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  // Compter les filtres actifs
  const activeFiltersCount = [
    statusFilter !== 'all',
    piloteFilter !== 'all',
    dateFilter !== 'all',
    dateFrom !== '',
    dateTo !== '',
  ].filter(Boolean).length;

  // Filter actions
  const filteredActions = useMemo(() => {
    return actions.filter(action => {
      // Filtre par statut
      if (statusFilter !== 'all' && action.status !== statusFilter) return false;

      // Filtre par pilote
      if (piloteFilter !== 'all' && action.pilote_id !== piloteFilter) return false;

      // Filtre par date (deadline)
      if (dateFilter !== 'all') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deadline = action.deadline ? new Date(action.deadline) : null;

        switch (dateFilter) {
          case 'overdue':
            if (!deadline || deadline >= today || action.status === 'termine') return false;
            break;
          case 'today':
            if (!deadline) return false;
            const deadlineDate = new Date(deadline);
            deadlineDate.setHours(0, 0, 0, 0);
            if (deadlineDate.getTime() !== today.getTime()) return false;
            break;
          case 'this_week':
            if (!deadline) return false;
            const weekEnd = new Date(today);
            weekEnd.setDate(today.getDate() + (7 - today.getDay()));
            if (deadline < today || deadline > weekEnd) return false;
            break;
          case 'this_month':
            if (!deadline) return false;
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
            const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            if (deadline < monthStart || deadline > monthEnd) return false;
            break;
          case 'no_deadline':
            if (deadline) return false;
            break;
          case 'custom':
            // Géré par dateFrom/dateTo
            break;
        }
      }

      // Filtre par plage de dates personnalisée
      if (dateFrom) {
        const fromDate = new Date(dateFrom);
        const deadline = action.deadline ? new Date(action.deadline) : null;
        if (!deadline || deadline < fromDate) return false;
      }
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        const deadline = action.deadline ? new Date(action.deadline) : null;
        if (!deadline || deadline > toDate) return false;
      }

      return true;
    });
  }, [actions, statusFilter, piloteFilter, dateFilter, dateFrom, dateTo]);

  const handleCreateAction = async (data: any) => {
    try {
      await createAction.mutateAsync(data);
      toast({ title: 'Action créée', description: 'L\'action a été créée avec succès' });
      setShowCreateModal(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    }
  };

  const handleUpdateAction = async (id: string, data: any) => {
    try {
      await updateAction.mutateAsync({ id, data });
      toast({ title: 'Action modifiée', description: 'L\'action a été modifiée avec succès' });
      setEditingAction(null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    }
  };

  const handleDeleteAction = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette action ?')) return;
    try {
      await deleteAction.mutateAsync(id);
      toast({ title: 'Action supprimée', description: 'L\'action a été supprimée avec succès' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Dashboard KPI */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Target className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Progression</p>
                  <p className="text-2xl font-bold">
                    {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
              <Progress value={stats.total > 0 ? (stats.completed / stats.total) * 100 : 0} className="mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Terminées</p>
                  <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">En cours</p>
                  <p className="text-2xl font-bold text-yellow-600">{stats.in_progress}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">En retard</p>
                  <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">Dues bientôt</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.due_soon}</p>
                </div>
                <Calendar className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Actions */}
      <Card>
        <CardContent className="p-4">
          {/* Ligne principale */}
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-3 flex-1 flex-wrap items-center">
              {/* Recherche */}
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher une action..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filtre Statut */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <Circle className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les statuts</SelectItem>
                  {ACTION_STATUS.map(s => (
                    <SelectItem key={s.value} value={s.value}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${s.value === 'a_faire' ? 'bg-gray-400' : s.value === 'en_cours' ? 'bg-yellow-500' : 'bg-green-500'}`}></span>
                        {s.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filtre Pilote */}
              <Select value={piloteFilter} onValueChange={setPiloteFilter}>
                <SelectTrigger className="w-[180px]">
                  <User className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Pilote" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les pilotes</SelectItem>
                  {pilotesFromActions.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Filtre Date */}
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger className="w-[170px]">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Délai" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les dates</SelectItem>
                  <SelectItem value="overdue">
                    <span className="flex items-center gap-2 text-red-600">
                      <AlertTriangle className="h-3 w-3" />
                      En retard
                    </span>
                  </SelectItem>
                  <SelectItem value="today">Aujourd'hui</SelectItem>
                  <SelectItem value="this_week">Cette semaine</SelectItem>
                  <SelectItem value="this_month">Ce mois</SelectItem>
                  <SelectItem value="no_deadline">Sans délai</SelectItem>
                  <SelectItem value="custom">
                    <span className="flex items-center gap-2">
                      <CalendarRange className="h-3 w-3" />
                      Personnalisé...
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Bouton afficher plus de filtres / reset */}
              {activeFiltersCount > 0 && (
                <Button variant="ghost" size="sm" onClick={resetFilters} className="text-gray-500 hover:text-gray-700">
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Réinitialiser ({activeFiltersCount})
                </Button>
              )}
            </div>

            {canCreate && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle action
              </Button>
            )}
          </div>

          {/* Plage de dates personnalisée */}
          {dateFilter === 'custom' && (
            <div className="flex gap-4 items-center mt-4 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-gray-600 whitespace-nowrap">Du:</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-gray-600 whitespace-nowrap">Au:</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); }}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {/* Indicateur du nombre de résultats */}
          {(activeFiltersCount > 0 || searchTerm) && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-sm text-gray-500">
                <span className="font-medium text-gray-700">{filteredActions.length}</span> action(s) trouvée(s)
                {actions.length !== filteredActions.length && (
                  <span> sur {actions.length} au total</span>
                )}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">Chargement...</div>
          ) : filteredActions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              Aucune action trouvée
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pilote</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Affecté par</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Délai</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">État</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredActions.map((action) => {
                    const statusInfo = ACTION_STATUS.find(s => s.value === action.status);
                    const StatusIcon = statusInfo?.icon || Circle;
                    return (
                      <tr key={action.id} className={getRowColor(action)}>
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-medium">{action.description}</p>
                            {action.description_detail && (
                              <p className="text-sm text-gray-500 truncate max-w-xs">{action.description_detail}</p>
                            )}
                            {action.project_name && (
                              <Badge variant="outline" className="mt-1">{action.project_name}</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-gray-400" />
                            <span>{action.pilote_name || '-'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {action.assigned_by_name || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {formatDate(action.date_assignment)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm">{formatDate(action.deadline)}</span>
                            {isOverdue(action.deadline, action.status) && (
                              <Badge variant="destructive" className="text-xs">En retard</Badge>
                            )}
                            {isDueSoon(action.deadline, action.status) && !isOverdue(action.deadline, action.status) && (
                              <Badge variant="outline" className="text-xs text-orange-600 border-orange-300">Urgent</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={statusInfo?.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {statusInfo?.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            {canUpdate && (
                              <Button variant="ghost" size="sm" onClick={() => setEditingAction(action)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button variant="ghost" size="sm" onClick={() => handleDeleteAction(action.id)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Action Modal */}
      <ActionFormModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateAction}
        isLoading={createAction.isPending}
      />

      {/* Edit Action Modal */}
      {editingAction && (
        <ActionFormModal
          open={!!editingAction}
          onClose={() => setEditingAction(null)}
          onSubmit={(data) => handleUpdateAction(editingAction.id, data)}
          isLoading={updateAction.isPending}
          initialData={editingAction}
        />
      )}
    </div>
  );
}

// ==================== Projets Kanban Tab ====================

function ProjetKanbanTab({ canCreate, canUpdate, canDelete }: { canCreate: boolean; canUpdate: boolean; canDelete: boolean }) {
  const { hasPermission } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [managingActionsProject, setManagingActionsProject] = useState<any>(null);
  const [viewingActionsProject, setViewingActionsProject] = useState<any>(null);
  const [addingActionToProject, setAddingActionToProject] = useState<any>(null);

  const { data: projects = [], isLoading } = useProjects({ search: searchTerm || undefined });
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const createAction = useCreateAction();

  // Permission pour créer des actions
  const canCreateAction = hasPermission(PERMISSIONS.accounting.actions.create);

  // Handler pour créer une action liée à un projet
  const handleCreateActionForProject = async (data: any) => {
    try {
      await createAction.mutateAsync({
        ...data,
        project_id: addingActionToProject.id,
      });
      toast({
        title: 'Action créée',
        description: `L'action a été créée et liée au projet "${addingActionToProject.name}"`
      });
      setAddingActionToProject(null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    }
  };

  const handleUpdateProjectColor = async (projectId: string, color: string) => {
    try {
      await updateProject.mutateAsync({
        id: projectId,
        data: { color }
      });
      toast({ title: 'Couleur mise à jour' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de changer la couleur' });
    }
  };

  const handleCreateProject = async (data: any) => {
    try {
      await createProject.mutateAsync(data);
      toast({ title: 'Projet créé', description: 'Le projet a été créé avec succès' });
      setShowCreateModal(false);
    } catch (error: any) {
      // Enhanced error handling for structured validation errors
      if (error.response?.data?.details) {
        const errorDetails = error.response.data.details.join('\n');
        toast({
          variant: 'destructive',
          title: 'Validation échouée',
          description: errorDetails,
        });
      } else {
        toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      }
    }
  };

  const handleUpdateProject = async (id: string, data: any) => {
    try {
      await updateProject.mutateAsync({ id, data });
      toast({ title: 'Projet modifié', description: 'Le projet a été modifié avec succès' });
      setEditingProject(null);
    } catch (error: any) {
      // Enhanced error handling for structured validation errors
      if (error.response?.data?.details) {
        const errorDetails = error.response.data.details.join('\n');
        toast({
          variant: 'destructive',
          title: 'Validation échouée',
          description: errorDetails,
        });
      } else {
        toast({ variant: 'destructive', title: 'Erreur', description: error.message });
      }
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce projet ?')) return;
    try {
      await deleteProject.mutateAsync(id);
      toast({ title: 'Projet supprimé', description: 'Le projet a été supprimé avec succès' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Rechercher un projet..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {canCreate && (
              <Button onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nouveau projet
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="p-8 text-center">Chargement...</div>
      ) : projects.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-gray-500">
            <FolderKanban className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <p>Aucun projet trouvé</p>
            {canCreate && (
              <Button className="mt-4" onClick={() => setShowCreateModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Créer un projet
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const priorityInfo = PROJECT_PRIORITY.find(p => p.value === project.priority);
            const statusInfo = PROJECT_STATUS.find(s => s.value === project.status);
            const progress = project.total_actions > 0
              ? Math.round((project.completed_actions / project.total_actions) * 100)
              : 0;

            return (
              <Card key={project.id} className="hover:shadow-lg transition-shadow" style={{ borderLeft: `4px solid ${project.color || '#3b82f6'}` }}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{project.name}</CardTitle>
                      {project.description && (
                        <CardDescription className="mt-1 line-clamp-2">
                          {project.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={priorityInfo?.variant}>{priorityInfo?.label}</Badge>
                      {canUpdate && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Palette className="h-4 w-4" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <ColorPicker
                              value={project.color || '#3b82f6'}
                              onChange={(newColor) => handleUpdateProjectColor(project.id, newColor)}
                            />
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Progress */}
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Avancement</span>
                      <span className="font-medium">{progress}%</span>
                    </div>
                    <Progress value={progress} />
                    <p className="text-xs text-gray-500 mt-1">
                      {project.completed_actions || 0}/{project.total_actions || 0} actions terminées
                    </p>
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm">
                    {project.manager_name && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        <span>{project.manager_name}</span>
                      </div>
                    )}
                    {(project.start_date || project.end_date) && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span>
                          {formatDate(project.start_date)} - {formatDate(project.end_date)}
                        </span>
                      </div>
                    )}
                    {project.budget && (
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-gray-400" />
                        <span>{Number(project.budget).toLocaleString('fr-FR')} DH</span>
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <Badge className={statusInfo?.color}>{statusInfo?.label}</Badge>

                  {/* Actions */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" onClick={() => setViewingActionsProject(project)}>
                      <Eye className="h-4 w-4 mr-1" />
                      Visualiser
                    </Button>
                    {canUpdate && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setManagingActionsProject(project)}>
                          <ListChecks className="h-4 w-4 mr-1" />
                          Gérer
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditingProject(project)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {canCreateAction && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAddingActionToProject(project)}
                        className="text-green-600 border-green-300 hover:bg-green-50"
                      >
                        <PlusCircle className="h-4 w-4 mr-1" />
                        Action
                      </Button>
                    )}
                    {canDelete && (
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteProject(project.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Project Modal */}
      <ProjectFormModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateProject}
        isLoading={createProject.isPending}
      />

      {/* Edit Project Modal */}
      {editingProject && (
        <ProjectFormModal
          open={!!editingProject}
          onClose={() => setEditingProject(null)}
          onSubmit={(data) => handleUpdateProject(editingProject.id, data)}
          isLoading={updateProject.isPending}
          initialData={editingProject}
        />
      )}

      {/* Manage Actions Modal */}
      {managingActionsProject && (
        <ManageActionsModal
          open={!!managingActionsProject}
          onClose={() => setManagingActionsProject(null)}
          project={managingActionsProject}
        />
      )}

      {/* View Actions Modal */}
      <ViewActionsModal
        project={viewingActionsProject}
        onClose={() => setViewingActionsProject(null)}
      />

      {/* Add Action to Project Modal */}
      {addingActionToProject && (
        <ActionFormModal
          open={!!addingActionToProject}
          onClose={() => setAddingActionToProject(null)}
          onSubmit={handleCreateActionForProject}
          isLoading={createAction.isPending}
          projectName={addingActionToProject.name}
        />
      )}
    </div>
  );
}

// ==================== Action Form Modal ====================

function ActionFormModal({
  open,
  onClose,
  onSubmit,
  isLoading,
  initialData,
  projectName,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
  initialData?: any;
  projectName?: string;
}) {
  const [formData, setFormData] = useState({
    description: initialData?.description || '',
    description_detail: initialData?.description_detail || '',
    pilote_id: initialData?.pilote_id || '',
    deadline: initialData?.deadline ? initialData.deadline.split('T')[0] : '',
    status: initialData?.status || 'a_faire',
    commentaire: initialData?.commentaire || '',
  });

  // États pour le dropdown de sélection du pilote
  const [piloteSearchTerm, setPiloteSearchTerm] = useState('');
  const [piloteRoleFilter, setPiloteRoleFilter] = useState('');
  const [isPiloteDropdownOpen, setIsPiloteDropdownOpen] = useState(false);
  const piloteDropdownRef = useRef<HTMLDivElement>(null);

  // Charger les utilisateurs
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users-for-pilote'],
    queryFn: () => profilesApi.getAll(),
    enabled: open,
  });

  // Charger les rôles pour le filtre
  const { data: rolesData } = useQuery({
    queryKey: ['roles-for-filter'],
    queryFn: async () => {
      const response = await rolesApi.getAllRoles();
      return response.roles;
    },
    enabled: open,
  });

  // Filtrer les utilisateurs
  const filteredUsers = useMemo(() => {
    let result = users;

    // Filtre par rôle
    if (piloteRoleFilter) {
      result = result.filter((u: Profile) => u.role === piloteRoleFilter);
    }

    // Filtre par recherche
    if (piloteSearchTerm.trim()) {
      const query = piloteSearchTerm.toLowerCase();
      result = result.filter((u: Profile) =>
        u.full_name?.toLowerCase().includes(query) ||
        u.username?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [users, piloteRoleFilter, piloteSearchTerm]);

  // Trouver l'utilisateur sélectionné
  const selectedUser = users.find((u: Profile) => u.id === formData.pilote_id);

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (piloteDropdownRef.current && !piloteDropdownRef.current.contains(event.target as Node)) {
        setIsPiloteDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset le dropdown quand le modal se ferme
  useEffect(() => {
    if (!open) {
      setIsPiloteDropdownOpen(false);
      setPiloteSearchTerm('');
      setPiloteRoleFilter('');
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  // Déterminer le titre du modal
  const modalTitle = initialData
    ? 'Modifier l\'action'
    : projectName
      ? `Nouvelle action pour "${projectName}"`
      : 'Nouvelle action';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:w-[550px] md:w-[600px] max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>{modalTitle}</DialogTitle>
          {projectName && !initialData && (
            <DialogDescription>
              Cette action sera automatiquement liée au projet
            </DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Description de l'action"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description_detail">Description détaillée</Label>
            <Textarea
              id="description_detail"
              value={formData.description_detail}
              onChange={(e) => setFormData(prev => ({ ...prev, description_detail: e.target.value }))}
              placeholder="Détails supplémentaires..."
              rows={3}
            />
          </div>

          {/* Dropdown de sélection du Pilote avec recherche */}
          <div className="space-y-2">
            <Label>Pilote (Responsable) *</Label>
            <div className="relative" ref={piloteDropdownRef}>
              {/* Bouton déclencheur */}
              <button
                type="button"
                onClick={() => setIsPiloteDropdownOpen(!isPiloteDropdownOpen)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg flex items-center justify-between bg-white hover:bg-gray-50 text-left"
              >
                <span className={selectedUser ? 'text-gray-900' : 'text-gray-500'}>
                  {selectedUser
                    ? `${selectedUser.full_name} (${selectedUser.role})`
                    : 'Sélectionner un responsable...'}
                </span>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isPiloteDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Panel dropdown */}
              {isPiloteDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-hidden">
                  {/* Barre de recherche */}
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={piloteSearchTerm}
                        onChange={(e) => setPiloteSearchTerm(e.target.value)}
                        placeholder="Rechercher par nom..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Filtre par rôle */}
                  <div className="p-2 border-b bg-gray-50">
                    <select
                      value={piloteRoleFilter}
                      onChange={(e) => setPiloteRoleFilter(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Filtrer par rôle"
                    >
                      <option value="">Tous les rôles</option>
                      {rolesData?.map(role => (
                        <option key={role.id} value={role.name}>
                          {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Liste des utilisateurs */}
                  <div className="max-h-48 overflow-y-auto">
                    {usersLoading ? (
                      <div className="p-4 text-center text-gray-500">Chargement...</div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">Aucun utilisateur trouvé</div>
                    ) : (
                      filteredUsers.map((user: Profile) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, pilote_id: user.id }));
                            setIsPiloteDropdownOpen(false);
                            setPiloteSearchTerm('');
                          }}
                          className={`w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center justify-between transition-colors ${
                            formData.pilote_id === user.id ? 'bg-blue-100' : ''
                          }`}
                        >
                          <div>
                            <div className="font-medium text-gray-900">{user.full_name}</div>
                            <div className="text-xs text-gray-500">@{user.username}</div>
                          </div>
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                            {user.role}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            {/* Validation visuelle */}
            {!formData.pilote_id && (
              <p className="text-xs text-amber-600">Veuillez sélectionner un responsable</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="deadline">Délai</Label>
            <Input
              id="deadline"
              type="date"
              value={formData.deadline}
              onChange={(e) => setFormData(prev => ({ ...prev, deadline: e.target.value }))}
            />
          </div>

          {initialData && (
            <div className="space-y-2">
              <Label htmlFor="status">État</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTION_STATUS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="commentaire">Commentaire</Label>
            <Textarea
              id="commentaire"
              value={formData.commentaire}
              onChange={(e) => setFormData(prev => ({ ...prev, commentaire: e.target.value }))}
              placeholder="Notes..."
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading || !formData.pilote_id}>
              {isLoading ? 'Enregistrement...' : initialData ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Project Form Modal ====================

function ProjectFormModal({
  open,
  onClose,
  onSubmit,
  isLoading,
  initialData,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
  isLoading: boolean;
  initialData?: any;
}) {
  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    status: initialData?.status || 'planning',
    priority: initialData?.priority || 'normale',
    start_date: initialData?.start_date ? initialData.start_date.split('T')[0] : '',
    end_date: initialData?.end_date ? initialData.end_date.split('T')[0] : '',
    budget: initialData?.budget || '',
    manager_id: initialData?.manager_id || '',
  });

  // États pour le dropdown de sélection du chef de projet
  const [managerSearchTerm, setManagerSearchTerm] = useState('');
  const [managerRoleFilter, setManagerRoleFilter] = useState('');
  const [isManagerDropdownOpen, setIsManagerDropdownOpen] = useState(false);
  const managerDropdownRef = useRef<HTMLDivElement>(null);

  // Charger les utilisateurs
  const { data: projectUsers = [], isLoading: projectUsersLoading } = useQuery({
    queryKey: ['users-for-manager'],
    queryFn: () => profilesApi.getAll(),
    enabled: open,
  });

  // Charger les rôles pour le filtre
  const { data: projectRolesData } = useQuery({
    queryKey: ['roles-for-manager-filter'],
    queryFn: async () => {
      const response = await rolesApi.getAllRoles();
      return response.roles;
    },
    enabled: open,
  });

  // Filtrer les utilisateurs
  const filteredProjectUsers = useMemo(() => {
    let result = projectUsers;

    // Filtre par rôle
    if (managerRoleFilter) {
      result = result.filter((u: Profile) => u.role === managerRoleFilter);
    }

    // Filtre par recherche
    if (managerSearchTerm.trim()) {
      const query = managerSearchTerm.toLowerCase();
      result = result.filter((u: Profile) =>
        u.full_name?.toLowerCase().includes(query) ||
        u.username?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [projectUsers, managerRoleFilter, managerSearchTerm]);

  // Trouver l'utilisateur sélectionné
  const selectedManager = projectUsers.find((u: Profile) => u.id === formData.manager_id);

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (managerDropdownRef.current && !managerDropdownRef.current.contains(event.target as Node)) {
        setIsManagerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset le dropdown quand le modal se ferme
  useEffect(() => {
    if (!open) {
      setIsManagerDropdownOpen(false);
      setManagerSearchTerm('');
      setManagerRoleFilter('');
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      budget: formData.budget ? Number(formData.budget) : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:w-[600px] md:w-[700px] max-w-[95vw]" resizable>
        <DialogHeader>
          <DialogTitle>{initialData ? 'Modifier le projet' : 'Nouveau projet'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1">
          <div className="space-y-2">
            <Label htmlFor="name">Nom du projet *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Nom du projet"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Description du projet..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Statut</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUS.map(s => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priorité</Label>
              <Select value={formData.priority} onValueChange={(v) => setFormData(prev => ({ ...prev, priority: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_PRIORITY.map(p => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Date de début</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">Date de fin</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="budget">Budget (DH)</Label>
            <Input
              id="budget"
              type="number"
              value={formData.budget}
              onChange={(e) => setFormData(prev => ({ ...prev, budget: e.target.value }))}
              placeholder="0"
            />
          </div>

          {/* Dropdown de sélection du Chef de projet avec recherche */}
          <div className="space-y-2">
            <Label>Chef de projet</Label>
            <div className="relative" ref={managerDropdownRef}>
              {/* Bouton déclencheur */}
              <button
                type="button"
                onClick={() => setIsManagerDropdownOpen(!isManagerDropdownOpen)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg flex items-center justify-between bg-white hover:bg-gray-50 text-left"
              >
                <span className={selectedManager ? 'text-gray-900' : 'text-gray-500'}>
                  {selectedManager
                    ? `${selectedManager.full_name} (${selectedManager.role})`
                    : 'Sélectionner un chef de projet...'}
                </span>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isManagerDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Panel dropdown */}
              {isManagerDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-hidden">
                  {/* Barre de recherche */}
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={managerSearchTerm}
                        onChange={(e) => setManagerSearchTerm(e.target.value)}
                        placeholder="Rechercher par nom..."
                        className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* Filtre par rôle */}
                  <div className="p-2 border-b bg-gray-50">
                    <select
                      value={managerRoleFilter}
                      onChange={(e) => setManagerRoleFilter(e.target.value)}
                      className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-label="Filtrer par rôle"
                    >
                      <option value="">Tous les rôles</option>
                      {projectRolesData?.map(role => (
                        <option key={role.id} value={role.name}>
                          {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Liste des utilisateurs */}
                  <div className="max-h-48 overflow-y-auto">
                    {projectUsersLoading ? (
                      <div className="p-4 text-center text-gray-500">Chargement...</div>
                    ) : filteredProjectUsers.length === 0 ? (
                      <div className="p-4 text-center text-gray-500">Aucun utilisateur trouvé</div>
                    ) : (
                      filteredProjectUsers.map((user: Profile) => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, manager_id: user.id }));
                            setIsManagerDropdownOpen(false);
                            setManagerSearchTerm('');
                          }}
                          className={`w-full px-3 py-2 text-left hover:bg-blue-50 flex items-center justify-between transition-colors ${
                            formData.manager_id === user.id ? 'bg-blue-100' : ''
                          }`}
                        >
                          <div>
                            <div className="font-medium text-gray-900">{user.full_name}</div>
                            <div className="text-xs text-gray-500">@{user.username}</div>
                          </div>
                          <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                            {user.role}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Enregistrement...' : initialData ? 'Modifier' : 'Créer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Manage Actions Modal ====================

function ManageActionsModal({
  open,
  onClose,
  project,
}: {
  open: boolean;
  onClose: () => void;
  project: any;
}) {
  const { data: allActions = [] } = useActions();
  const linkActions = useLinkActionsToProject();
  const [selectedActions, setSelectedActions] = useState<string[]>([]);

  // Initialize with currently linked actions
  useEffect(() => {
    const linkedIds = allActions.filter(a => a.project_id === project.id).map(a => a.id);
    setSelectedActions(linkedIds);
  }, [allActions, project.id]);

  const handleToggleAction = (actionId: string) => {
    setSelectedActions(prev =>
      prev.includes(actionId)
        ? prev.filter(id => id !== actionId)
        : [...prev, actionId]
    );
  };

  const handleSave = async () => {
    try {
      await linkActions.mutateAsync({ projectId: project.id, actionIds: selectedActions });
      toast({ title: 'Actions mises à jour', description: 'Les actions du projet ont été mises à jour' });
      onClose();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erreur', description: error.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:w-[650px] md:w-[750px] lg:w-[850px] max-w-[95vw] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Gérer les actions - {project.name}</DialogTitle>
          <DialogDescription>
            Sélectionnez les actions à lier à ce projet
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-2 py-4">
          {allActions.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Aucune action disponible</p>
          ) : (
            allActions.map((action) => {
              const isSelected = selectedActions.includes(action.id);
              const statusInfo = ACTION_STATUS.find(s => s.value === action.status);

              return (
                <div
                  key={action.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    isSelected ? 'border-blue-500 bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleToggleAction(action.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{action.description}</p>
                      <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {action.pilote_name || 'Non assigné'}
                        </span>
                        <Badge className={statusInfo?.color} variant="outline">
                          {statusInfo?.label}
                        </Badge>
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleAction(action.id)}
                      className="h-5 w-5"
                      aria-label={`Sélectionner l'action: ${action.description}`}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={linkActions.isPending}>
            {linkActions.isPending ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
