/**
 * MyRequests.tsx - Mes demandes RH (Employé Self-Service)
 *
 * Permet à l'employé de :
 * - Consulter ses demandes (congés, heures sup, corrections)
 * - Soumettre de nouvelles demandes
 * - Suivre le statut de validation
 * - Annuler une demande en attente
 */

import React, { useState, useMemo } from 'react';
import {
  FileText,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  RefreshCw,
  Eye,
  Trash2,
  AlertTriangle,
  Send,
  Upload,
  X,
} from 'lucide-react';
import { format, parseISO, formatDistanceToNow, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

import {
  useMyRequests,
  useCreateRequest,
  useCancelRequest,
  useLeaveBalances,
} from '@/hooks/useMyHR';
import type { MyRequest, CreateRequestInput, LeaveBalance } from '@/lib/api/my-hr';

// ============================================================
// CONSTANTS
// ============================================================

const REQUEST_TYPES = {
  leave: { label: 'Congé', className: 'bg-blue-100 text-blue-800', icon: Calendar },
  overtime: { label: 'Heures supplémentaires', className: 'bg-purple-100 text-purple-800', icon: Clock },
  correction: { label: 'Correction pointage', className: 'bg-orange-100 text-orange-800', icon: FileText },
  administrative: { label: 'Demande administrative', className: 'bg-gray-100 text-gray-800', icon: FileText },
};

const LEAVE_SUBTYPES = [
  { value: 'annual', label: 'Congé annuel' },
  { value: 'sick', label: 'Congé maladie' },
  { value: 'unpaid', label: 'Congé sans solde' },
  { value: 'maternity', label: 'Congé maternité' },
  { value: 'paternity', label: 'Congé paternité' },
  { value: 'family_event', label: 'Événement familial' },
  { value: 'exceptional', label: 'Congé exceptionnel' },
];

const STATUS_CONFIG = {
  pending: { label: 'En attente', className: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { label: 'Approuvé', className: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  rejected: { label: 'Refusé', className: 'bg-red-100 text-red-800', icon: XCircle },
  cancelled: { label: 'Annulé', className: 'bg-gray-100 text-gray-800', icon: XCircle },
};

// ============================================================
// COMPONENTS
// ============================================================

interface NewRequestModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  balances: LeaveBalance[];
}

function NewRequestModal({ open, onOpenChange, onSuccess, balances }: NewRequestModalProps) {
  const { toast } = useToast();
  const createMutation = useCreateRequest();

  const [formData, setFormData] = useState<CreateRequestInput>({
    request_type: 'leave',
    request_subtype: 'annual',
    start_date: '',
    end_date: '',
    reason: '',
    contact_during_absence: '',
    interim_person: '',
  });

  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  const calculatedDays = useMemo(() => {
    if (!formData.start_date || !formData.end_date) return 0;
    const days = differenceInDays(parseISO(formData.end_date), parseISO(formData.start_date)) + 1;
    return days > 0 ? days : 0;
  }, [formData.start_date, formData.end_date]);

  const selectedBalance = useMemo(() => {
    if (formData.request_type !== 'leave') return null;
    return balances.find(b => b.type === formData.request_subtype);
  }, [formData.request_type, formData.request_subtype, balances]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.reason) {
      toast({ title: 'Erreur', description: 'Veuillez renseigner le motif', variant: 'destructive' });
      return;
    }

    if (formData.request_type === 'leave' && (!formData.start_date || !formData.end_date)) {
      toast({ title: 'Erreur', description: 'Veuillez renseigner les dates', variant: 'destructive' });
      return;
    }

    if (formData.request_type === 'overtime' && !formData.duration_hours) {
      toast({ title: 'Erreur', description: 'Veuillez renseigner le nombre d\'heures', variant: 'destructive' });
      return;
    }

    // Validation: certificat médical obligatoire pour congé maladie
    if (formData.request_type === 'leave' && formData.request_subtype === 'sick' && !attachmentFile) {
      toast({ title: 'Erreur', description: 'Un certificat médical est requis pour les congés maladie', variant: 'destructive' });
      return;
    }

    try {
      // Si fichier attaché, envoyer en FormData, sinon JSON
      if (attachmentFile) {
        const formDataToSend = new FormData();
        formDataToSend.append('request_type', formData.request_type);
        if (formData.request_subtype) formDataToSend.append('request_subtype', formData.request_subtype);
        if (formData.start_date) formDataToSend.append('start_date', formData.start_date);
        if (formData.end_date) formDataToSend.append('end_date', formData.end_date);
        if (formData.duration_hours) formDataToSend.append('duration_hours', formData.duration_hours.toString());
        formDataToSend.append('reason', formData.reason);
        if (formData.contact_during_absence) formDataToSend.append('contact_during_absence', formData.contact_during_absence);
        if (formData.interim_person) formDataToSend.append('interim_person', formData.interim_person);
        formDataToSend.append('attachment', attachmentFile);

        // Appel direct avec apiClient pour supporter FormData
        await createMutation.mutateAsync(formDataToSend as any);
      } else {
        await createMutation.mutateAsync(formData);
      }

      toast({ title: 'Succès', description: 'Demande soumise avec succès' });
      onSuccess();
      onOpenChange(false);
      // Reset form
      setFormData({
        request_type: 'leave',
        request_subtype: 'annual',
        start_date: '',
        end_date: '',
        reason: '',
        contact_during_absence: '',
        interim_person: '',
      });
      setAttachmentFile(null);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Erreur lors de la soumission',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Nouvelle demande
          </DialogTitle>
          <DialogDescription>
            Soumettez une nouvelle demande RH
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type de demande */}
          <div className="space-y-2">
            <Label>Type de demande</Label>
            <Select
              value={formData.request_type}
              onValueChange={(value) => setFormData(prev => ({
                ...prev,
                request_type: value as CreateRequestInput['request_type'],
                request_subtype: value === 'leave' ? 'annual' : undefined,
              }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REQUEST_TYPES).map(([key, { label, icon: Icon }]) => (
                  <SelectItem key={key} value={key}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sous-type congé */}
          {formData.request_type === 'leave' && (
            <div className="space-y-2">
              <Label>Type de congé</Label>
              <Select
                value={formData.request_subtype}
                onValueChange={(value) => setFormData(prev => ({ ...prev, request_subtype: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_SUBTYPES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Solde affiché */}
              {selectedBalance && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-blue-800">Solde disponible :</span>
                    <span className="font-bold text-blue-900">{selectedBalance.available} jours</span>
                  </div>
                  <Progress
                    value={(selectedBalance.available / selectedBalance.total) * 100}
                    className="mt-2 h-2"
                  />
                  <div className="flex justify-between text-xs text-blue-600 mt-1">
                    <span>Utilisé : {selectedBalance.used}j</span>
                    <span>En attente : {selectedBalance.pending}j</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Dates (pour congés et corrections) */}
          {(formData.request_type === 'leave' || formData.request_type === 'correction') && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Date début</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">Date fin</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  min={formData.start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                  required
                />
              </div>
              {calculatedDays > 0 && (
                <div className="col-span-2">
                  <Badge variant="outline" className="text-blue-600">
                    {calculatedDays} jour{calculatedDays > 1 ? 's' : ''} demandé{calculatedDays > 1 ? 's' : ''}
                  </Badge>
                </div>
              )}
            </div>
          )}

          {/* Heures (pour heures sup) */}
          {formData.request_type === 'overtime' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    start_date: e.target.value,
                    end_date: e.target.value,
                  }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hours">Nombre d'heures</Label>
                <Input
                  id="hours"
                  type="number"
                  min="0.5"
                  max="12"
                  step="0.5"
                  placeholder="Ex: 2"
                  value={formData.duration_hours || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    duration_hours: parseFloat(e.target.value) || undefined,
                  }))}
                  required
                />
              </div>
            </>
          )}

          {/* Motif */}
          <div className="space-y-2">
            <Label htmlFor="reason">Motif</Label>
            <Textarea
              id="reason"
              placeholder="Décrivez le motif de votre demande..."
              value={formData.reason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              rows={3}
              required
            />
          </div>

          {/* Pièce jointe (pour congé maladie) */}
          {formData.request_type === 'leave' && formData.request_subtype === 'sick' && (
            <div className="space-y-2">
              <Label htmlFor="attachment">Certificat médical *</Label>
              <div className="relative">
                <input
                  type="file"
                  id="attachment"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 10 * 1024 * 1024) {
                        toast({
                          title: 'Erreur',
                          description: 'Le fichier est trop volumineux (max 10MB)',
                          variant: 'destructive',
                        });
                        e.target.value = '';
                        return;
                      }
                      setAttachmentFile(file);
                    }
                  }}
                  className="hidden"
                />
                <label
                  htmlFor="attachment"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-blue-400 transition-colors"
                >
                  <Upload className="h-5 w-5 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {attachmentFile ? attachmentFile.name : 'Sélectionner un fichier (PDF, Word, Image)'}
                  </span>
                </label>
              </div>
              {attachmentFile && (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="text-sm text-blue-900">{attachmentFile.name}</span>
                    <span className="text-xs text-blue-600">
                      ({(attachmentFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachmentFile(null);
                      const input = document.getElementById('attachment') as HTMLInputElement;
                      if (input) input.value = '';
                    }}
                    className="text-blue-600 hover:text-blue-800"
                    aria-label="Supprimer le fichier"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <p className="text-xs text-gray-500">
                Formats acceptés: PDF, Word, JPG, PNG (max 10MB)
              </p>
            </div>
          )}

          {/* Contact et intérim (pour congés) */}
          {formData.request_type === 'leave' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="contact">Contact pendant l'absence (optionnel)</Label>
                <Input
                  id="contact"
                  placeholder="Ex: 0661-XX-XX-XX"
                  value={formData.contact_during_absence}
                  onChange={(e) => setFormData(prev => ({ ...prev, contact_during_absence: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="interim">Personne assurant l'intérim (optionnel)</Label>
                <Input
                  id="interim"
                  placeholder="Nom du collègue"
                  value={formData.interim_person}
                  onChange={(e) => setFormData(prev => ({ ...prev, interim_person: e.target.value }))}
                />
              </div>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Envoi...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Soumettre
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface RequestDetailModalProps {
  request: MyRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: (request: MyRequest) => void;
}

function RequestDetailModal({ request, open, onOpenChange, onCancel }: RequestDetailModalProps) {
  if (!request) return null;

  const typeConfig = REQUEST_TYPES[request.request_type];
  const statusConfig = STATUS_CONFIG[request.status];
  const TypeIcon = typeConfig.icon;
  const StatusIcon = statusConfig.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Détail de ma demande
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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

          {/* Dates */}
          {(request.start_date || request.end_date) && (
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">
                {request.request_type === 'correction' ? 'Date concernée' : 'Période'}
              </Label>
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span>
                  {request.start_date && format(parseISO(request.start_date), 'd MMMM yyyy', { locale: fr })}
                  {request.end_date && request.start_date !== request.end_date && (
                    <> → {format(parseISO(request.end_date), 'd MMMM yyyy', { locale: fr })}</>
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
                        {(request as any).original_check_in || 'Non enregistrée'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-orange-600">Sortie:</span>
                      <span className="font-medium text-orange-900">
                        {(request as any).original_check_out || 'Non enregistrée'}
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
                        {(request as any).requested_check_in || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-600">Sortie:</span>
                      <span className="font-medium text-blue-900">
                        {(request as any).requested_check_out || '—'}
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
          {request.workflow_steps && request.workflow_steps.length > 0 && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Circuit de validation</Label>
              <div className="space-y-2">
                {request.workflow_steps.map((step: { step_number: number; approver_name: string; status: string; comment?: string; decided_at?: string }, idx: number) => {
                  const isApproved = step.status === 'approved';
                  const isRejected = step.status === 'rejected';
                  const isPending = step.status === 'pending';
                  const isCurrent = isPending && idx === (request.current_step || 1) - 1;

                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 p-2 rounded-lg border ${
                        isApproved ? 'bg-green-50 border-green-200' :
                        isRejected ? 'bg-red-50 border-red-200' :
                        isCurrent ? 'bg-blue-50 border-blue-200' :
                        'bg-gray-50 border-gray-200'
                      }`}
                    >
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                        isApproved ? 'bg-green-100' :
                        isRejected ? 'bg-red-100' :
                        isCurrent ? 'bg-blue-100 animate-pulse' :
                        'bg-gray-100'
                      }`}>
                        {isApproved ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : isRejected ? (
                          <XCircle className="h-4 w-4 text-red-600" />
                        ) : (
                          <span className="text-sm font-medium text-gray-500">{step.step_number}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{step.approver_name}</p>
                        {step.comment && (
                          <p className="text-xs text-muted-foreground italic">"{step.comment}"</p>
                        )}
                        {step.decided_at && (
                          <p className="text-xs text-muted-foreground">
                            {format(parseISO(step.decided_at), 'd MMM yyyy à HH:mm', { locale: fr })}
                          </p>
                        )}
                      </div>
                      {isCurrent && (
                        <Badge variant="outline" className="text-blue-600">En cours</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Created date */}
          <div className="text-xs text-muted-foreground border-t pt-3">
            Soumis {formatDistanceToNow(parseISO(request.created_at), { addSuffix: true, locale: fr })}
          </div>
        </div>

        <DialogFooter>
          {request.status === 'pending' && (
            <Button
              variant="destructive"
              onClick={() => { onOpenChange(false); onCancel(request); }}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Annuler la demande
            </Button>
          )}
          <Button onClick={() => onOpenChange(false)}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function MyRequests() {
  const { toast } = useToast();

  // State
  const [activeTab, setActiveTab] = useState('pending');
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [detailRequest, setDetailRequest] = useState<MyRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [cancelRequest, setCancelRequest] = useState<MyRequest | null>(null);

  // Queries
  const { data: requestsData, isLoading: loadingRequests, refetch } = useMyRequests();
  const { data: balancesData, isLoading: loadingBalances } = useLeaveBalances();
  const cancelMutation = useCancelRequest();

  // Data
  const requests = requestsData?.requests || [];
  const balances = balancesData?.balances || [];

  const pendingRequests = useMemo(() =>
    requests.filter(r => r.status === 'pending'),
    [requests]
  );

  const historyRequests = useMemo(() =>
    requests.filter(r => r.status !== 'pending'),
    [requests]
  );

  // Stats
  const stats = useMemo(() => ({
    pending: pendingRequests.length,
    approved: requests.filter(r => r.status === 'approved').length,
    rejected: requests.filter(r => r.status === 'rejected').length,
  }), [requests, pendingRequests]);

  // Handlers
  const handleCancelConfirm = async () => {
    if (!cancelRequest) return;

    try {
      await cancelMutation.mutateAsync(cancelRequest.id);
      toast({ title: 'Succès', description: 'Demande annulée' });
      setCancelRequest(null);
    } catch (error) {
      toast({
        title: 'Erreur',
        description: error instanceof Error ? error.message : 'Erreur lors de l\'annulation',
        variant: 'destructive',
      });
    }
  };

  const handleViewDetail = (request: MyRequest) => {
    setDetailRequest(request);
    setDetailOpen(true);
  };

  const displayRequests = activeTab === 'pending' ? pendingRequests : historyRequests;

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Mes demandes
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos demandes de congés, heures supplémentaires et corrections
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => setNewRequestOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle demande
          </Button>
        </div>
      </div>

      {/* Leave Balances */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {loadingBalances ? (
          <>
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </>
        ) : (
          <>
            {balances.slice(0, 3).map((balance) => (
              <Card key={balance.type}>
                <CardContent className="pt-6">
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">{balance.label}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold">{balance.available}</span>
                      <span className="text-sm text-muted-foreground">/ {balance.total} jours</span>
                    </div>
                    <Progress
                      value={(balance.available / balance.total) * 100}
                      className="h-2"
                    />
                    {balance.pending > 0 && (
                      <p className="text-xs text-orange-600">{balance.pending}j en attente</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between h-full">
                  <div>
                    <p className="text-sm text-muted-foreground">Demandes en attente</p>
                    <p className="text-2xl font-bold">{stats.pending}</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-yellow-100 flex items-center justify-center">
                    <Clock className="h-5 w-5 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
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

        <TabsContent value="pending">
          <Card>
            <CardHeader>
              <CardTitle>Mes demandes en attente</CardTitle>
              <CardDescription>
                Ces demandes sont en cours de validation
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
                  <Button variant="outline" className="mt-4" onClick={() => setNewRequestOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Créer une demande
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Période</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Progression</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayRequests.map((request) => {
                      const typeConfig = REQUEST_TYPES[request.request_type];
                      const TypeIcon = typeConfig.icon;

                      return (
                        <TableRow key={request.id}>
                          <TableCell>
                            <Badge className={typeConfig.className}>
                              <TypeIcon className="h-3 w-3 mr-1" />
                              {typeConfig.label}
                            </Badge>
                            {request.request_subtype && (
                              <span className="text-xs text-muted-foreground block mt-1">
                                {LEAVE_SUBTYPES.find(s => s.value === request.request_subtype)?.label || request.request_subtype}
                              </span>
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
                              <Badge variant="outline" className="ml-2">{request.duration_days}j</Badge>
                            )}
                            {request.duration_hours && (
                              <Badge variant="outline" className="ml-2">{request.duration_hours}h</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge className="bg-yellow-100 text-yellow-800">
                                <Clock className="h-3 w-3 mr-1" />
                                En attente
                              </Badge>
                              {request.current_approver_name && (
                                <span className="text-xs text-muted-foreground">
                                  de {request.current_approver_name}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {request.current_step && request.total_steps && (
                              <div className="flex items-center gap-2">
                                <Progress
                                  value={((request.current_step - 1) / request.total_steps) * 100}
                                  className="h-2 w-20"
                                />
                                <span className="text-xs text-muted-foreground">
                                  {request.current_step}/{request.total_steps}
                                </span>
                              </div>
                            )}
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
                                className="text-destructive hover:text-destructive"
                                onClick={() => setCancelRequest(request)}
                              >
                                <Trash2 className="h-4 w-4" />
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
              <CardTitle>Historique de mes demandes</CardTitle>
              <CardDescription>
                Demandes approuvées, refusées ou annulées
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
                      <TableHead>Type</TableHead>
                      <TableHead>Période</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Date décision</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayRequests.map((request) => {
                      const typeConfig = REQUEST_TYPES[request.request_type];
                      const statusConfig = STATUS_CONFIG[request.status];
                      const TypeIcon = typeConfig.icon;
                      const StatusIcon = statusConfig.icon;

                      return (
                        <TableRow key={request.id}>
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
                            {request.updated_at && (
                              <span className="text-sm text-muted-foreground">
                                {format(parseISO(request.updated_at), 'd MMM yyyy', { locale: fr })}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleViewDetail(request)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
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
      <NewRequestModal
        open={newRequestOpen}
        onOpenChange={setNewRequestOpen}
        onSuccess={() => refetch()}
        balances={balances}
      />

      <RequestDetailModal
        request={detailRequest}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onCancel={setCancelRequest}
      />

      {/* Cancel Confirmation */}
      <AlertDialog open={!!cancelRequest} onOpenChange={() => setCancelRequest(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Annuler cette demande ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. Vous devrez soumettre une nouvelle demande si nécessaire.
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
                'Annuler la demande'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
