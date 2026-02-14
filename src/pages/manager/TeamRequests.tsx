/**
 * TeamRequests.tsx - Demandes de l'équipe à valider (Manager)
 *
 * Permet au manager de voir et valider les demandes de son équipe
 * (congés, heures supplémentaires, corrections de pointage).
 * Affiche les badges de délégation si le manager agit pour le compte d'un autre.
 */

import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  FileText,
  ArrowRightLeft,
  Eye,
  Paperclip,
  User,
  Ban,
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { useTeam, useTeamRequests, useTeamStats, useApproveRequest, useRejectRequest, useCancelRequest } from '@/hooks/useManagerTeam';
import { useReceivedDelegations } from '@/hooks/useDelegation';
import { useAuth } from '@/contexts/AuthContext';
import type { TeamRequest } from '@/lib/api/manager';
import { AppLayout } from '@/components/layout/AppLayout';

// ============================================================
// CONSTANTS
// ============================================================

const REQUEST_TYPE_CONFIG = {
  leave: { label: 'Congé', className: 'bg-blue-100 text-blue-800', icon: Calendar },
  overtime: { label: 'Heures sup', className: 'bg-purple-100 text-purple-800', icon: Clock },
  correction: { label: 'Correction', className: 'bg-orange-100 text-orange-800', icon: FileText },
  administrative: { label: 'Administratif', className: 'bg-gray-100 text-gray-800', icon: FileText },
};

const STATUS_CONFIG = {
  pending: { label: 'En attente', className: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { label: 'Approuvé', className: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  approved_n1: { label: 'Validé N', className: 'bg-blue-100 text-blue-800', icon: Clock },
  approved_n2: { label: 'Validé N+1', className: 'bg-blue-100 text-blue-800', icon: Clock },
  approved_n3: { label: 'Validé N+2', className: 'bg-blue-100 text-blue-800', icon: Clock },
  approved_n4: { label: 'Validé N+3', className: 'bg-blue-100 text-blue-800', icon: Clock },
  approved_n5: { label: 'Validé N+4', className: 'bg-blue-100 text-blue-800', icon: Clock },
  rejected: { label: 'Refusé', className: 'bg-red-100 text-red-800', icon: XCircle },
  cancelled: { label: 'Annulé', className: 'bg-gray-100 text-gray-800', icon: XCircle },
};

// ============================================================
// COMPONENTS
// ============================================================

interface RequestDetailModalProps {
  request: TeamRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (request: TeamRequest) => void;
  onReject: (request: TeamRequest) => void;
}

function RequestDetailModal({ request, open, onOpenChange, onApprove, onReject }: RequestDetailModalProps) {
  if (!request) return null;

  const typeConfig = REQUEST_TYPE_CONFIG[request.request_type] || REQUEST_TYPE_CONFIG.leave;
  const statusConfig = STATUS_CONFIG[request.status] || { label: request.status, className: 'bg-gray-100 text-gray-800', icon: Clock };
  const TypeIcon = typeConfig.icon;
  const StatusIcon = statusConfig.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Détail de la demande
          </DialogTitle>
          <DialogDescription>
            Demande de {request.employee_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Delegation Banner */}
          {request.delegation_info?.is_delegated && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <ArrowRightLeft className="h-4 w-4 text-amber-600" />
              <span className="text-sm text-amber-800">
                Vous agissez par délégation de <strong>{request.delegation_info.delegator_name}</strong>
              </span>
            </div>
          )}

          {/* Status & Type */}
          <div className="flex items-center justify-between">
            <Badge className={typeConfig.className}>
              <TypeIcon className="h-3 w-3 mr-1" />
              {typeConfig.label}
              {request.request_subtype && ` - ${request.request_subtype}`}
            </Badge>
            <Badge className={statusConfig.className}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>

          {/* Employee */}
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">Demandeur</Label>
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
              <User className="h-4 w-4 text-blue-600" />
              <div>
                <p className="font-medium">{request.employee_name}</p>
                {request.employee_email && (
                  <p className="text-xs text-muted-foreground">{request.employee_email}</p>
                )}
              </div>
            </div>
          </div>

          {/* Dates */}
          {(request.start_date || request.end_date) && (
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">
                {request.request_type === 'correction' ? 'Date concernée' : 'Période demandée'}
              </Label>
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                <Calendar className="h-4 w-4 text-green-600" />
                <span>
                  {request.start_date && format(parseISO(request.start_date), 'd MMM yyyy', { locale: fr })}
                  {request.end_date && request.start_date !== request.end_date && (
                    <> → {format(parseISO(request.end_date), 'd MMM yyyy', { locale: fr })}</>
                  )}
                </span>
                {request.duration_days && request.request_type !== 'correction' && (
                  <Badge variant="outline" className="ml-auto">
                    {request.duration_days} jour{request.duration_days > 1 ? 's' : ''}
                  </Badge>
                )}
                {request.duration_hours && (
                  <Badge variant="outline" className="ml-auto">
                    {request.duration_hours}h
                  </Badge>
                )}
              </div>
            </div>
          )}

          {/* Détails correction - pointages actuel vs demandé */}
          {request.request_type === 'correction' && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Détails de la correction</Label>
              <div className="grid grid-cols-2 gap-3">
                {/* Pointage actuel */}
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="text-xs font-medium text-orange-700 mb-2">Pointage actuel</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-orange-600">Entrée:</span>
                      <span className="font-medium text-orange-900">
                        {request.original_check_in || 'Non enregistrée'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-orange-600">Sortie:</span>
                      <span className="font-medium text-orange-900">
                        {request.original_check_out || 'Non enregistrée'}
                      </span>
                    </div>
                  </div>
                </div>
                {/* Pointage demandé */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="text-xs font-medium text-blue-700 mb-2">Pointage demandé</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-600">Entrée:</span>
                      <span className="font-medium text-blue-900">
                        {request.requested_check_in || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-600">Sortie:</span>
                      <span className="font-medium text-blue-900">
                        {request.requested_check_out || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Reason */}
          {request.reason && (
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Motif</Label>
              <p className="p-2 bg-muted/50 rounded text-sm">{request.reason}</p>
            </div>
          )}

          {/* Workflow Progress */}
          {request.current_step && request.total_steps && (
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Progression validation</Label>
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                <div className="flex-1 flex items-center gap-1">
                  {Array.from({ length: request.total_steps }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`h-2 flex-1 rounded ${
                        idx < request.current_step! ? 'bg-green-500' :
                        idx === request.current_step! ? 'bg-blue-500 animate-pulse' :
                        'bg-gray-200'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  Étape {request.current_step}/{request.total_steps}
                </span>
              </div>
            </div>
          )}

          {/* Attachments */}
          {request.attachments && request.attachments.length > 0 && (
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Pièces jointes</Label>
              <div className="space-y-1">
                {request.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={att.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 bg-muted/50 rounded hover:bg-muted transition-colors"
                  >
                    <Paperclip className="h-4 w-4 text-gray-500" />
                    <span className="text-sm text-blue-600 hover:underline">{att.filename}</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Created */}
          <div className="text-xs text-muted-foreground border-t pt-3">
            Soumis {formatDistanceToNow(parseISO(request.created_at), { addSuffix: true, locale: fr })}
          </div>
        </div>

        {request.status === 'pending' && (
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
            <Button
              variant="destructive"
              onClick={() => { onOpenChange(false); onReject(request); }}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Refuser
            </Button>
            <Button onClick={() => { onOpenChange(false); onApprove(request); }}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approuver
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface ApproveDialogProps {
  request: TeamRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (comment?: string) => void;
  isPending: boolean;
}

function ApproveDialog({ request, open, onOpenChange, onConfirm, isPending }: ApproveDialogProps) {
  const [comment, setComment] = useState('');

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-green-600">
            <CheckCircle2 className="h-5 w-5" />
            Approuver la demande
          </DialogTitle>
          <DialogDescription>
            Vous êtes sur le point d'approuver la demande de {request.employee_name}.
          </DialogDescription>
        </DialogHeader>

        {request.delegation_info?.is_delegated && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <ArrowRightLeft className="h-4 w-4 text-amber-600" />
            <span className="text-sm text-amber-800">
              Cette approbation sera enregistrée au nom de <strong>{request.delegation_info.delegator_name}</strong>
            </span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="comment">Commentaire (optionnel)</Label>
          <Textarea
            id="comment"
            placeholder="Ajouter un commentaire..."
            value={comment}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setComment(e.target.value)}
            rows={2}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => onConfirm(comment)} disabled={isPending}>
            {isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Approbation...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Approuver
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface RejectDialogProps {
  request: TeamRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}

function RejectDialog({ request, open, onOpenChange, onConfirm, isPending }: RejectDialogProps) {
  const [reason, setReason] = useState('');

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <XCircle className="h-5 w-5" />
            Refuser la demande
          </DialogTitle>
          <DialogDescription>
            Vous êtes sur le point de refuser la demande de {request.employee_name}.
          </DialogDescription>
        </DialogHeader>

        {request.delegation_info?.is_delegated && (
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <ArrowRightLeft className="h-4 w-4 text-amber-600" />
            <span className="text-sm text-amber-800">
              Ce refus sera enregistré au nom de <strong>{request.delegation_info.delegator_name}</strong>
            </span>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="reason">Motif du refus (obligatoire)</Label>
          <Textarea
            id="reason"
            placeholder="Veuillez indiquer le motif du refus..."
            value={reason}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
            rows={3}
            required
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(reason)}
            disabled={isPending || !reason.trim()}
          >
            {isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Refus...
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 mr-2" />
                Refuser
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CancelDialogProps {
  request: TeamRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reason: string) => void;
  isPending: boolean;
}

function CancelDialog({ request, open, onOpenChange, onConfirm, isPending }: CancelDialogProps) {
  const [reason, setReason] = useState('');

  if (!request) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-600">
            <Ban className="h-5 w-5" />
            Annuler la demande approuvée
          </DialogTitle>
          <DialogDescription>
            Vous êtes sur le point d'annuler la demande approuvée de <strong>{request.employee_name}</strong>.
            Cette action restaurera le solde de congés si applicable.
          </DialogDescription>
        </DialogHeader>

        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-sm text-orange-800">
            <strong>Attention:</strong> L'employé sera notifié de cette annulation.
            {request.request_type === 'leave' && ' Son solde de congés sera restauré.'}
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cancel-reason">Motif de l'annulation (obligatoire)</Label>
          <Textarea
            id="cancel-reason"
            placeholder="Ex: Demande de l'employé, erreur d'approbation, changement de planning..."
            value={reason}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
            rows={3}
            required
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Retour
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(reason)}
            disabled={isPending || !reason.trim()}
          >
            {isPending ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Annulation...
              </>
            ) : (
              <>
                <Ban className="h-4 w-4 mr-2" />
                Confirmer l'annulation
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function TeamRequests() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // State
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [detailRequest, setDetailRequest] = useState<TeamRequest | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [approveRequest, setApproveRequest] = useState<TeamRequest | null>(null);
  const [rejectRequest, setRejectRequest] = useState<TeamRequest | null>(null);
  const [cancelRequest, setCancelRequest] = useState<TeamRequest | null>(null);

  // Queries
  const { data: teamData } = useTeam();
  const { data: requestsData, isLoading: loadingRequests, refetch } = useTeamRequests({
    status: activeTab === 'history' ? undefined : 'pending',
    type: selectedType !== 'all' ? selectedType : undefined,
    employee_id: selectedEmployee !== 'all' ? selectedEmployee : undefined,
  });
  useTeamStats(); // Stats loaded but displayed in dashboard
  const { data: receivedDelegations } = useReceivedDelegations();

  // Mutations
  const approveMutation = useApproveRequest();
  const rejectMutation = useRejectRequest();
  const cancelMutation = useCancelRequest();

  // Computed data
  const teamMembers = teamData?.members || [];
  const requests = requestsData?.requests || [];
  const activeDelegations = receivedDelegations?.delegations || [];

  const pendingRequests = useMemo(() =>
    requests.filter(r =>
      r.status === 'pending' ||
      r.status === 'approved_n1' ||
      r.status === 'approved_n2' ||
      r.status === 'approved_n3' ||
      r.status === 'approved_n4' ||
      r.status === 'approved_n5'
    ),
    [requests]
  );

  const historyRequests = useMemo(() =>
    requests.filter(r => r.status === 'approved' || r.status === 'rejected' || r.status === 'cancelled'),
    [requests]
  );

  // Stats
  const stats = useMemo(() => {
    const pending = pendingRequests.length;
    const byType = {
      leave: pendingRequests.filter(r => r.request_type === 'leave').length,
      overtime: pendingRequests.filter(r => r.request_type === 'overtime').length,
      correction: pendingRequests.filter(r => r.request_type === 'correction').length,
    };
    return { pending, byType };
  }, [pendingRequests]);

  // Handlers
  const handleApproveConfirm = async (comment?: string) => {
    if (!approveRequest) return;

    try {
      await approveMutation.mutateAsync({
        requestId: approveRequest.id,
        comment,
        request_type: approveRequest.request_type,
      });
      toast({ title: 'Succès', description: 'Demande approuvée avec succès' });
      setApproveRequest(null);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Erreur lors de l\'approbation',
        variant: 'destructive'
      });
    }
  };

  const handleRejectConfirm = async (reason: string) => {
    if (!rejectRequest) return;

    try {
      await rejectMutation.mutateAsync({
        requestId: rejectRequest.id,
        reason,
        request_type: rejectRequest.request_type,
      });
      toast({ title: 'Succès', description: 'Demande refusée' });
      setRejectRequest(null);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Erreur lors du refus',
        variant: 'destructive'
      });
    }
  };

  const handleCancelConfirm = async (reason: string) => {
    if (!cancelRequest) return;

    try {
      await cancelMutation.mutateAsync({
        requestId: cancelRequest.id,
        reason,
        request_type: cancelRequest.request_type,
      });
      toast({ title: 'Succès', description: 'Demande annulée avec succès' });
      setCancelRequest(null);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Erreur lors de l\'annulation',
        variant: 'destructive'
      });
    }
  };

  const handleViewDetail = (request: TeamRequest) => {
    setDetailRequest(request);
    setDetailModalOpen(true);
  };

  const displayRequests = activeTab === 'pending' ? pendingRequests : historyRequests;

  return (
    <AppLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Demandes de mon équipe
          </h1>
          <p className="text-muted-foreground mt-1">
            Validez les demandes de congés, heures sup et corrections de votre équipe
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Delegation Banner */}
      {activeDelegations.length > 0 && (
        <Card className="bg-amber-50 border-amber-200">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <ArrowRightLeft className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-amber-900">Délégations actives</p>
                <p className="text-amber-700 mt-1">
                  Vous pouvez également valider les demandes pour : {' '}
                  {activeDelegations.map((d, idx) => (
                    <span key={d.id}>
                      <strong>{d.delegator_name}</strong>
                      {idx < activeDelegations.length - 1 ? ', ' : ''}
                    </span>
                  ))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En attente</p>
                <p className="text-2xl font-bold">{stats.pending}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Congés</p>
                <p className="text-2xl font-bold">{stats.byType.leave}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Heures sup</p>
                <p className="text-2xl font-bold">{stats.byType.overtime}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Corrections</p>
                <p className="text-2xl font-bold">{stats.byType.correction}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                <FileText className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs & Filters */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              En attente
              {stats.pending > 0 && (
                <Badge variant="secondary" className="ml-1">{stats.pending}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Historique
            </TabsTrigger>
          </TabsList>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="leave">Congés</SelectItem>
                <SelectItem value="overtime">Heures sup</SelectItem>
                <SelectItem value="correction">Corrections</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Employé" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les employés</SelectItem>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.employee_id}>
                    {member.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Demandes en attente de validation</CardTitle>
              <CardDescription>
                Ces demandes nécessitent votre approbation ou refus
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRequests ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : displayRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucune demande en attente</p>
                  <p className="text-sm">Toutes les demandes de votre équipe ont été traitées</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employé</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Validation N-1</TableHead>
                      <TableHead>Période/Détail</TableHead>
                      <TableHead>Soumis</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayRequests.map((request) => {
                      const typeConfig = REQUEST_TYPE_CONFIG[request.request_type];
                      const TypeIcon = typeConfig.icon;

                      return (
                        <TableRow key={request.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div>
                                <p className="font-medium">{request.employee_name}</p>
                                {request.delegation_info?.is_delegated && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge variant="outline" className="text-amber-600 border-amber-300">
                                          <ArrowRightLeft className="h-3 w-3 mr-1" />
                                          Délégation
                                        </Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Pour le compte de {request.delegation_info.delegator_name}
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={typeConfig.className}>
                              <TypeIcon className="h-3 w-3 mr-1" />
                              {typeConfig.label}
                            </Badge>
                            {request.request_subtype && (
                              <span className="text-xs text-muted-foreground block mt-1">
                                {request.request_subtype}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {request.previous_approver_name ? (
                              <div className="flex flex-col gap-1">
                                <Badge className="bg-green-100 text-green-800">
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                  Validé
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  par {request.previous_approver_name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {request.start_date && (
                              <span className="text-sm">
                                {format(parseISO(request.start_date), 'd MMM', { locale: fr })}
                                {request.end_date && request.start_date !== request.end_date && (
                                  <> → {format(parseISO(request.end_date), 'd MMM', { locale: fr })}</>
                                )}
                              </span>
                            )}
                            {request.duration_days && (
                              <Badge variant="outline" className="ml-2">
                                {request.duration_days}j
                              </Badge>
                            )}
                            {request.duration_hours && (
                              <Badge variant="outline" className="ml-2">
                                {request.duration_hours}h
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {formatDistanceToNow(parseISO(request.created_at), { addSuffix: true, locale: fr })}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewDetail(request)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => setApproveRequest(request)}
                              >
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setRejectRequest(request)}
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Historique des décisions</CardTitle>
              <CardDescription>
                Demandes approuvées ou refusées
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRequests ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : displayRequests.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucun historique</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employé</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Période</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayRequests.map((request) => {
                      const typeConfig = REQUEST_TYPE_CONFIG[request.request_type] || REQUEST_TYPE_CONFIG.leave;
                      const statusConfig = STATUS_CONFIG[request.status] || { label: request.status, className: 'bg-gray-100 text-gray-800', icon: Clock };
                      const TypeIcon = typeConfig.icon;
                      const StatusIcon = statusConfig.icon;

                      return (
                        <TableRow key={request.id}>
                          <TableCell>
                            <p className="font-medium">{request.employee_name}</p>
                          </TableCell>
                          <TableCell>
                            <Badge className={typeConfig.className}>
                              <TypeIcon className="h-3 w-3 mr-1" />
                              {typeConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {request.start_date && format(parseISO(request.start_date), 'd MMM yyyy', { locale: fr })}
                          </TableCell>
                          <TableCell>
                            <Badge className={statusConfig.className}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusConfig.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {request.updated_at
                                ? format(parseISO(request.updated_at), 'd MMM yyyy', { locale: fr })
                                : '-'
                              }
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewDetail(request)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {/* Bouton Annuler - visible uniquement pour admin et demandes approuvées */}
                              {isAdmin && (request.status === 'approved' || request.status?.startsWith('approved_n')) && request.status !== 'cancelled' && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => setCancelRequest(request)}
                                      >
                                        <Ban className="h-4 w-4" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Annuler cette demande approuvée</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <RequestDetailModal
        request={detailRequest}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
        onApprove={setApproveRequest}
        onReject={setRejectRequest}
      />

      <ApproveDialog
        request={approveRequest}
        open={!!approveRequest}
        onOpenChange={() => setApproveRequest(null)}
        onConfirm={handleApproveConfirm}
        isPending={approveMutation.isPending}
      />

      <RejectDialog
        request={rejectRequest}
        open={!!rejectRequest}
        onOpenChange={() => setRejectRequest(null)}
        onConfirm={handleRejectConfirm}
        isPending={rejectMutation.isPending}
      />

      <CancelDialog
        request={cancelRequest}
        open={!!cancelRequest}
        onOpenChange={() => setCancelRequest(null)}
        onConfirm={handleCancelConfirm}
        isPending={cancelMutation.isPending}
      />
      </div>
    </AppLayout>
  );
}
