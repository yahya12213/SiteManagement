/**
 * DelegationManagement.tsx - Gestion des délégations d'approbation
 *
 * Permet aux managers de déléguer leurs droits d'approbation à d'autres utilisateurs
 * pendant leurs absences (vacances, mission, maladie, etc.)
 */

import React, { useState, useMemo } from 'react';
import {
  Users,
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRightLeft,
  Trash2,
  Edit,
  Eye,
  RefreshCw,
  UserCheck,
  UserX,
  Info
} from 'lucide-react';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import {
  useMyDelegations,
  useReceivedDelegations,
  useAllDelegations,
  useCreateDelegation,
  useUpdateDelegation,
  useCancelDelegation,
  usePotentialDelegates,
} from '@/hooks/useDelegation';
import type { Delegation, CreateDelegationInput } from '@/lib/api/delegation';

// ============================================================
// CONSTANTS
// ============================================================

const DELEGATION_TYPES = {
  all: { label: 'Toutes les demandes', description: 'Congés, heures sup, corrections', icon: Users },
  leaves: { label: 'Congés uniquement', description: 'Demandes de congé annuel, maladie, etc.', icon: Calendar },
  overtime: { label: 'Heures supplémentaires', description: 'Déclarations d\'heures sup', icon: Clock },
  corrections: { label: 'Corrections pointage', description: 'Demandes de correction de pointage', icon: Edit },
};

const STATUS_BADGES = {
  active: { label: 'Active', className: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  pending: { label: 'À venir', className: 'bg-blue-100 text-blue-800', icon: Clock },
  expired: { label: 'Expirée', className: 'bg-gray-100 text-gray-800', icon: XCircle },
  cancelled: { label: 'Annulée', className: 'bg-red-100 text-red-800', icon: UserX },
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function getDelegationStatus(delegation: Delegation): 'active' | 'pending' | 'expired' | 'cancelled' {
  if (!delegation.is_active) return 'cancelled';

  const now = new Date();
  const startDate = parseISO(delegation.start_date);
  const endDate = parseISO(delegation.end_date);

  if (isBefore(now, startDate)) return 'pending';
  if (isAfter(now, endDate)) return 'expired';
  return 'active';
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  return `${format(start, 'dd MMM yyyy', { locale: fr })} → ${format(end, 'dd MMM yyyy', { locale: fr })}`;
}

// ============================================================
// COMPONENTS
// ============================================================

interface DelegationFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delegation?: Delegation | null;
  onSuccess: () => void;
}

function DelegationFormModal({ open, onOpenChange, delegation, onSuccess }: DelegationFormModalProps) {
  const { toast } = useToast();
  const createMutation = useCreateDelegation();
  const updateMutation = useUpdateDelegation();
  const { data: delegatesData, isLoading: loadingDelegates } = usePotentialDelegates();

  const [formData, setFormData] = useState<{
    delegate_id: string;
    start_date: string;
    end_date: string;
    delegation_type: 'all' | 'leaves' | 'overtime' | 'corrections';
    reason: string;
    requires_notification: boolean;
  }>({
    delegate_id: delegation?.delegate_id || '',
    start_date: delegation?.start_date || '',
    end_date: delegation?.end_date || '',
    delegation_type: delegation?.delegation_type || 'all',
    reason: delegation?.reason || '',
    requires_notification: delegation?.requires_notification ?? true,
  });

  React.useEffect(() => {
    if (delegation) {
      setFormData({
        delegate_id: delegation.delegate_id,
        start_date: delegation.start_date.split('T')[0],
        end_date: delegation.end_date.split('T')[0],
        delegation_type: delegation.delegation_type,
        reason: delegation.reason || '',
        requires_notification: delegation.requires_notification,
      });
    } else {
      // Default dates: today + 7 days
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);

      setFormData({
        delegate_id: '',
        start_date: today.toISOString().split('T')[0],
        end_date: nextWeek.toISOString().split('T')[0],
        delegation_type: 'all',
        reason: '',
        requires_notification: true,
      });
    }
  }, [delegation, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.delegate_id) {
      toast({ title: 'Erreur', description: 'Veuillez sélectionner un délégué', variant: 'destructive' });
      return;
    }

    if (!formData.start_date || !formData.end_date) {
      toast({ title: 'Erreur', description: 'Veuillez renseigner les dates', variant: 'destructive' });
      return;
    }

    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      toast({ title: 'Erreur', description: 'La date de fin doit être après la date de début', variant: 'destructive' });
      return;
    }

    try {
      if (delegation) {
        await updateMutation.mutateAsync({
          id: delegation.id,
          data: formData,
        });
        toast({ title: 'Succès', description: 'Délégation mise à jour avec succès' });
      } else {
        await createMutation.mutateAsync(formData as CreateDelegationInput);
        toast({ title: 'Succès', description: 'Délégation créée avec succès' });
      }
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Erreur lors de la sauvegarde',
        variant: 'destructive'
      });
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            {delegation ? 'Modifier la délégation' : 'Nouvelle délégation'}
          </DialogTitle>
          <DialogDescription>
            {delegation
              ? 'Modifiez les paramètres de cette délégation'
              : 'Déléguez vos droits d\'approbation à un autre utilisateur pendant votre absence'
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Délégué */}
          <div className="space-y-2">
            <Label htmlFor="delegate">Déléguer mes approbations à</Label>
            <Select
              value={formData.delegate_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, delegate_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingDelegates ? "Chargement..." : "Sélectionner un utilisateur"} />
              </SelectTrigger>
              <SelectContent>
                {delegatesData?.users?.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    <div className="flex flex-col">
                      <span>{user.full_name}</span>
                      <span className="text-xs text-muted-foreground">{user.email}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Période */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Date de début</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">Date de fin</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* Type de délégation */}
          <div className="space-y-2">
            <Label>Type de demandes à déléguer</Label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(DELEGATION_TYPES).map(([key, { label, description, icon: Icon }]) => (
                <div
                  key={key}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    formData.delegation_type === key
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setFormData(prev => ({ ...prev, delegation_type: key as typeof formData.delegation_type }))}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span className="font-medium text-sm">{label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Motif */}
          <div className="space-y-2">
            <Label htmlFor="reason">Motif (optionnel)</Label>
            <Textarea
              id="reason"
              placeholder="Ex: Congé annuel, Mission à l'étranger..."
              value={formData.reason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              rows={2}
            />
          </div>

          {/* Notification */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="notification" className="cursor-pointer">Notifier les concernés</Label>
              <p className="text-xs text-muted-foreground">
                Le délégué et votre équipe seront informés par email
              </p>
            </div>
            <Switch
              id="notification"
              checked={formData.requires_notification}
              onCheckedChange={(checked: boolean) => setFormData(prev => ({ ...prev, requires_notification: checked }))}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : delegation ? 'Mettre à jour' : 'Créer la délégation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface DelegationDetailModalProps {
  delegation: Delegation | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function DelegationDetailModal({ delegation, open, onOpenChange }: DelegationDetailModalProps) {
  if (!delegation) return null;

  const status = getDelegationStatus(delegation);
  const statusConfig = STATUS_BADGES[status];
  const typeConfig = DELEGATION_TYPES[delegation.delegation_type];
  const TypeIcon = typeConfig.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Détails de la délégation
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm text-muted-foreground">Statut</span>
            <Badge className={statusConfig.className}>
              <statusConfig.icon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>

          {/* Délégateur */}
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Délégateur (qui délègue)</Label>
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
              <UserCheck className="h-4 w-4 text-blue-600" />
              <div>
                <p className="font-medium">{delegation.delegator_name}</p>
                {delegation.delegator_email && (
                  <p className="text-xs text-muted-foreground">{delegation.delegator_email}</p>
                )}
              </div>
            </div>
          </div>

          {/* Délégué */}
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Délégué (qui reçoit)</Label>
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
              <Users className="h-4 w-4 text-green-600" />
              <div>
                <p className="font-medium">{delegation.delegate_name}</p>
                {delegation.delegate_email && (
                  <p className="text-xs text-muted-foreground">{delegation.delegate_email}</p>
                )}
              </div>
            </div>
          </div>

          {/* Période */}
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Période de validité</Label>
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
              <Calendar className="h-4 w-4 text-orange-600" />
              <span>{formatDateRange(delegation.start_date, delegation.end_date)}</span>
            </div>
          </div>

          {/* Type */}
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Type de demandes</Label>
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
              <TypeIcon className="h-4 w-4 text-purple-600" />
              <div>
                <p className="font-medium">{typeConfig.label}</p>
                <p className="text-xs text-muted-foreground">{typeConfig.description}</p>
              </div>
            </div>
          </div>

          {/* Motif */}
          {delegation.reason && (
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Motif</Label>
              <p className="p-2 bg-muted/50 rounded text-sm">{delegation.reason}</p>
            </div>
          )}

          {/* Notification */}
          <div className="flex items-center gap-2 text-sm">
            {delegation.requires_notification ? (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>Notifications activées</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-gray-400" />
                <span className="text-muted-foreground">Notifications désactivées</span>
              </>
            )}
          </div>

          {/* Création */}
          <div className="text-xs text-muted-foreground border-t pt-3">
            Créé le {format(parseISO(delegation.created_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}
            {delegation.created_by_name && ` par ${delegation.created_by_name}`}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DelegationTableProps {
  delegations: Delegation[];
  loading: boolean;
  showDelegator?: boolean;
  showDelegate?: boolean;
  onEdit?: (delegation: Delegation) => void;
  onCancel?: (delegation: Delegation) => void;
  onView: (delegation: Delegation) => void;
}

function DelegationTable({
  delegations,
  loading,
  showDelegator = true,
  showDelegate = true,
  onEdit,
  onCancel,
  onView
}: DelegationTableProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (delegations.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ArrowRightLeft className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Aucune délégation trouvée</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {showDelegator && <TableHead>Délégateur</TableHead>}
          {showDelegate && <TableHead>Délégué</TableHead>}
          <TableHead>Type</TableHead>
          <TableHead>Période</TableHead>
          <TableHead>Statut</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {delegations.map((delegation) => {
          const status = getDelegationStatus(delegation);
          const statusConfig = STATUS_BADGES[status];
          const typeConfig = DELEGATION_TYPES[delegation.delegation_type];
          const TypeIcon = typeConfig.icon;

          return (
            <TableRow key={delegation.id}>
              {showDelegator && (
                <TableCell>
                  <div>
                    <p className="font-medium">{delegation.delegator_name}</p>
                    {delegation.delegator_email && (
                      <p className="text-xs text-muted-foreground">{delegation.delegator_email}</p>
                    )}
                  </div>
                </TableCell>
              )}
              {showDelegate && (
                <TableCell>
                  <div>
                    <p className="font-medium">{delegation.delegate_name}</p>
                    {delegation.delegate_email && (
                      <p className="text-xs text-muted-foreground">{delegation.delegate_email}</p>
                    )}
                  </div>
                </TableCell>
              )}
              <TableCell>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="flex items-center gap-2">
                        <TypeIcon className="h-4 w-4" />
                        <span className="text-sm">{typeConfig.label}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{typeConfig.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>
              <TableCell>
                <span className="text-sm">
                  {formatDateRange(delegation.start_date, delegation.end_date)}
                </span>
              </TableCell>
              <TableCell>
                <Badge className={statusConfig.className}>
                  <statusConfig.icon className="h-3 w-3 mr-1" />
                  {statusConfig.label}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onView(delegation)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  {onEdit && status !== 'expired' && status !== 'cancelled' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(delegation)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  )}
                  {onCancel && status !== 'expired' && status !== 'cancelled' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() => onCancel(delegation)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function DelegationManagement() {
  const { toast } = useToast();

  // State
  const [activeTab, setActiveTab] = useState('my');
  const [showExpired, setShowExpired] = useState(false);
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedDelegation, setSelectedDelegation] = useState<Delegation | null>(null);
  const [delegationToCancel, setDelegationToCancel] = useState<Delegation | null>(null);

  // Queries
  const { data: myDelegationsData, isLoading: loadingMy, refetch: refetchMy } = useMyDelegations({ include_expired: showExpired });
  const { data: receivedData, isLoading: loadingReceived, refetch: refetchReceived } = useReceivedDelegations();
  const { data: allData, isLoading: loadingAll, refetch: refetchAll } = useAllDelegations({ include_expired: showExpired });

  // Mutations
  const cancelMutation = useCancelDelegation();

  // Stats
  const stats = useMemo(() => {
    const myDelegations = myDelegationsData?.delegations || [];
    const received = receivedData?.delegations || [];
    const all = allData?.delegations || [];

    const myActive = myDelegations.filter(d => getDelegationStatus(d) === 'active').length;
    const myPending = myDelegations.filter(d => getDelegationStatus(d) === 'pending').length;
    const receivedActive = received.filter(d => getDelegationStatus(d) === 'active').length;
    const totalActive = all.filter(d => getDelegationStatus(d) === 'active').length;

    return { myActive, myPending, receivedActive, totalActive, total: all.length };
  }, [myDelegationsData, receivedData, allData]);

  // Handlers
  const handleRefresh = () => {
    refetchMy();
    refetchReceived();
    refetchAll();
  };

  const handleEdit = (delegation: Delegation) => {
    setSelectedDelegation(delegation);
    setFormModalOpen(true);
  };

  const handleView = (delegation: Delegation) => {
    setSelectedDelegation(delegation);
    setDetailModalOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!delegationToCancel) return;

    try {
      await cancelMutation.mutateAsync(delegationToCancel.id);
      toast({ title: 'Succès', description: 'Délégation annulée avec succès' });
      setDelegationToCancel(null);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Erreur lors de l\'annulation',
        variant: 'destructive'
      });
    }
  };

  const handleFormSuccess = () => {
    setSelectedDelegation(null);
    handleRefresh();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="h-6 w-6" />
            Délégations d'approbation
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez les délégations de droits d'approbation pendant les absences
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => { setSelectedDelegation(null); setFormModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle délégation
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Mes délégations actives</p>
                <p className="text-2xl font-bold">{stats.myActive}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">À venir</p>
                <p className="text-2xl font-bold">{stats.myPending}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Délégations reçues</p>
                <p className="text-2xl font-bold">{stats.receivedActive}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total actif (système)</p>
                <p className="text-2xl font-bold">{stats.totalActive}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <ArrowRightLeft className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-900">Comment fonctionne la délégation ?</p>
              <p className="text-blue-700 mt-1">
                Lorsque vous créez une délégation, la personne désignée pourra approuver ou rejeter
                les demandes à votre place pendant la période définie. Les décisions seront tracées
                avec la mention "Approuvé par [délégué] pour le compte de [vous]".
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="my" className="flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Mes délégations
              {stats.myActive > 0 && (
                <Badge variant="secondary" className="ml-1">{stats.myActive}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="received" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Délégations reçues
              {stats.receivedActive > 0 && (
                <Badge variant="secondary" className="ml-1">{stats.receivedActive}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="all" className="flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Toutes (Admin)
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Checkbox
              id="showExpired"
              checked={showExpired}
              onCheckedChange={(checked) => setShowExpired(checked as boolean)}
            />
            <Label htmlFor="showExpired" className="text-sm cursor-pointer">
              Afficher les expirées
            </Label>
          </div>
        </div>

        {/* My Delegations */}
        <TabsContent value="my">
          <Card>
            <CardHeader>
              <CardTitle>Mes délégations</CardTitle>
              <CardDescription>
                Délégations que vous avez créées pour transférer vos droits d'approbation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DelegationTable
                delegations={myDelegationsData?.delegations || []}
                loading={loadingMy}
                showDelegator={false}
                onEdit={handleEdit}
                onCancel={(d) => setDelegationToCancel(d)}
                onView={handleView}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Received Delegations */}
        <TabsContent value="received">
          <Card>
            <CardHeader>
              <CardTitle>Délégations reçues</CardTitle>
              <CardDescription>
                Délégations où vous êtes désigné comme délégué - vous pouvez approuver au nom de ces personnes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DelegationTable
                delegations={receivedData?.delegations || []}
                loading={loadingReceived}
                showDelegate={false}
                onView={handleView}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Delegations (Admin) */}
        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>Toutes les délégations</CardTitle>
              <CardDescription>
                Vue administrative de toutes les délégations du système
              </CardDescription>
            </CardHeader>
            <CardContent>
              <DelegationTable
                delegations={allData?.delegations || []}
                loading={loadingAll}
                onView={handleView}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Form Modal */}
      <DelegationFormModal
        open={formModalOpen}
        onOpenChange={setFormModalOpen}
        delegation={selectedDelegation}
        onSuccess={handleFormSuccess}
      />

      {/* Detail Modal */}
      <DelegationDetailModal
        delegation={selectedDelegation}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
      />

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={!!delegationToCancel} onOpenChange={() => setDelegationToCancel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Annuler cette délégation ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {delegationToCancel && (
                <>
                  Vous êtes sur le point d'annuler la délégation à{' '}
                  <strong>{delegationToCancel.delegate_name}</strong> pour la période du{' '}
                  {formatDateRange(delegationToCancel.start_date, delegationToCancel.end_date)}.
                  <br /><br />
                  Cette action est irréversible. Le délégué ne pourra plus approuver de demandes en votre nom.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Conserver</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Annulation...
                </>
              ) : (
                'Annuler la délégation'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
