/**
 * Portail Employe RH (EmployeePortal)
 * Interface employe pour le pointage, les demandes et la consultation des donnees personnelles
 */

import { useState } from 'react';
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
import {
  Clock,
  FileText,
  Plus,
  LogIn,
  LogOut,
  Download,
  Loader2,
  FileEdit,
  Upload,
  X,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useEmployeeAttendance,
  useEmployeeRequests,
  useTodayClocking,
  useCreateRequest,
  useCheckIn,
  useCheckOut,
} from '@/hooks/useEmployeePortal';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { CorrectionRequestInfo } from '@/lib/api/employee-portal';

// Badge de statut de correction de pointage
function CorrectionStatusBadge({ correction }: { correction: CorrectionRequestInfo }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    pending: {
      label: 'En attente (N)',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    },
    approved_n1: {
      label: 'Approuvé N, attente N+1',
      className: 'bg-blue-100 text-blue-800 border-blue-300',
    },
    approved_n2: {
      label: 'Approuvé N+1, attente N+2',
      className: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    },
    approved: {
      label: 'Correction approuvée',
      className: 'bg-green-100 text-green-800 border-green-300',
    },
    rejected: {
      label: 'Correction refusée',
      className: 'bg-red-100 text-red-800 border-red-300',
    },
    cancelled: {
      label: 'Annulée',
      className: 'bg-gray-100 text-gray-800 border-gray-300',
    }
  };

  // Pour les statuts dynamiques comme approved_n3, approved_n4, etc.
  let config = statusConfig[correction.status];
  if (!config && correction.status?.startsWith('approved_n')) {
    const level = correction.status.match(/approved_n(\d+)/)?.[1];
    config = {
      label: `Approuvé N+${parseInt(level || '0') - 1}, attente N+${level}`,
      className: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    };
  }
  if (!config) config = statusConfig.pending;

  const isPending = correction.status === 'pending' || correction.status?.startsWith('approved_n');
  const approverName = correction.current_approver_name;

  return (
    <span
      className={`inline-flex items-center text-xs px-2 py-1 rounded-full font-medium border ${config.className}`}
      title={`Motif: ${correction.reason}`}
    >
      {config.label}
      {isPending && approverName && (
        <span className="ml-1 font-normal">chez {approverName}</span>
      )}
    </span>
  );
}

// Tabs
type TabType = 'pointage' | 'demandes';

const TABS: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'pointage', label: 'Mon Pointage', icon: Clock },
  { id: 'demandes', label: 'Mes Demandes', icon: FileText },
];

const TYPES_DEMANDES = [
  { value: 'conge_annuel', label: 'Conge annuel' },
  { value: 'conge_sans_solde', label: 'Conge sans solde' },
  { value: 'conge_maladie', label: 'Conge maladie' },
  { value: 'correction_pointage', label: 'Correction de pointage' },
  { value: 'demande_administrative', label: 'Demande administrative' },
  { value: 'demande_formation', label: 'Demande de formation' },
];

const MOIS = [
  'Janvier', 'Fevrier', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Aout', 'Septembre', 'Octobre', 'Novembre', 'Decembre'
];

export default function EmployeePortal() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('pointage');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString());
  const [showNewDemandeModal, setShowNewDemandeModal] = useState(false);
  const [newDemande, setNewDemande] = useState({
    type: '',
    date_debut: '',
    date_fin: '',
    description: '',
  });
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  // State pour la modale de correction de pointage
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionData, setCorrectionData] = useState({
    date: '',
    original_check_in: '',
    original_check_out: '',
    requested_check_in: '',
    requested_check_out: '',
    reason: '',
  });

  // State pour l'annulation de demande
  const [requestToCancel, setRequestToCancel] = useState<any>(null);

  // Queries
  const { data: todayData, isLoading: loadingToday, isError: errorToday } = useTodayClocking();
  const { data: attendanceData, isLoading: loadingAttendance } = useEmployeeAttendance(
    parseInt(selectedYear),
    parseInt(selectedMonth)
  );
  const { data: requestsData, isLoading: loadingRequests } = useEmployeeRequests();

  // Mutations
  const checkInMutation = useCheckIn();
  const checkOutMutation = useCheckOut();
  const createRequestMutation = useCreateRequest();

  // Mutation pour demande de correction de pointage
  const correctionMutation = useMutation({
    mutationFn: async (data: { request_date: string; requested_check_in: string; requested_check_out: string; reason: string }) => {
      const response = await apiClient.post('/hr/my/correction-requests', data);
      return (response as any).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-attendance'] });
      setShowCorrectionModal(false);
      setCorrectionData({ date: '', original_check_in: '', original_check_out: '', requested_check_in: '', requested_check_out: '', reason: '' });
      toast({
        title: 'Demande soumise',
        description: 'Votre demande de correction a ete soumise avec succes.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Erreur lors de la soumission',
        variant: 'destructive',
      });
    }
  });

  // Mutation pour annuler une demande
  const cancelRequestMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await apiClient.post(`/hr/my/requests/${requestId}/cancel`, {});
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-requests'] });
      queryClient.invalidateQueries({ queryKey: ['employee-attendance'] });
      setRequestToCancel(null);
      toast({
        title: 'Demande annulee',
        description: 'Votre demande a ete annulee avec succes.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Erreur lors de l\'annulation',
        variant: 'destructive',
      });
    }
  });

  const handleOpenCorrectionModal = (date: string, existingCheckIn?: string, existingCheckOut?: string) => {
    setCorrectionData({
      date,
      original_check_in: existingCheckIn || '',
      original_check_out: existingCheckOut || '',
      requested_check_in: '',
      requested_check_out: '',
      reason: '',
    });
    setShowCorrectionModal(true);
  };

  const handleSubmitCorrection = () => {
    if (!correctionData.reason.trim()) {
      toast({
        title: 'Motif requis',
        description: 'Veuillez indiquer le motif de votre demande',
        variant: 'destructive',
      });
      return;
    }
    if (!correctionData.requested_check_in && !correctionData.requested_check_out) {
      toast({
        title: 'Heure requise',
        description: 'Veuillez indiquer au moins une heure (entree ou sortie)',
        variant: 'destructive',
      });
      return;
    }
    correctionMutation.mutate({
      request_date: correctionData.date,
      requested_check_in: correctionData.requested_check_in,
      requested_check_out: correctionData.requested_check_out,
      reason: correctionData.reason,
    });
  };

  const handleCheckIn = async () => {
    try {
      await checkInMutation.mutateAsync();
      toast({
        title: 'Entree enregistree',
        description: 'Votre pointage d\'entree a ete enregistre avec succes.',
      });
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Erreur lors du pointage',
        variant: 'destructive',
      });
    }
  };

  const handleCheckOut = async () => {
    try {
      const result = await checkOutMutation.mutateAsync();
      const minutes = result.worked_minutes_today || 0;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      toast({
        title: 'Sortie enregistree',
        description: `Votre pointage de sortie a ete enregistre. Temps travaille: ${hours}h${mins.toString().padStart(2, '0')}`,
      });
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Erreur lors du pointage',
        variant: 'destructive',
      });
    }
  };

  const handleSubmitDemande = async () => {
    if (!newDemande.type || !newDemande.description) {
      toast({
        title: 'Champs requis',
        description: 'Veuillez remplir tous les champs obligatoires',
        variant: 'destructive',
      });
      return;
    }

    // Validation: certificat médical obligatoire pour congé maladie
    if (newDemande.type === 'conge_maladie' && !attachmentFile) {
      toast({
        title: 'Certificat médical requis',
        description: 'Un certificat médical est obligatoire pour les congés maladie',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Si fichier attaché, envoyer en FormData
      if (attachmentFile) {
        const formData = new FormData();
        formData.append('type', newDemande.type);
        if (newDemande.date_debut) formData.append('start_date', newDemande.date_debut);
        if (newDemande.date_fin) formData.append('end_date', newDemande.date_fin);
        formData.append('description', newDemande.description);
        formData.append('attachment', attachmentFile);

        await createRequestMutation.mutateAsync(formData as any);
      } else {
        await createRequestMutation.mutateAsync({
          type: newDemande.type,
          start_date: newDemande.date_debut || undefined,
          end_date: newDemande.date_fin || undefined,
          description: newDemande.description,
        });
      }

      toast({
        title: 'Demande soumise',
        description: 'Votre demande a ete soumise avec succes.',
      });
      setShowNewDemandeModal(false);
      setNewDemande({ type: '', date_debut: '', date_fin: '', description: '' });
      setAttachmentFile(null);
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Erreur lors de la soumission',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
      case 'en_attente':
        return <Badge className="bg-yellow-100 text-yellow-800">En attente</Badge>;
      case 'approved':
      case 'approuve':
        return <Badge className="bg-green-100 text-green-800">Approuve</Badge>;
      case 'rejected':
      case 'refuse':
        return <Badge className="bg-red-100 text-red-800">Refuse</Badge>;
      default:
        return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'pointage':
        return (
          <div className="space-y-6">
            {/* Message d'erreur API */}
            {errorToday && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
                <p className="font-medium">Erreur de chargement du pointage</p>
                <p className="text-sm">Veuillez recharger la page ou contacter l'administrateur.</p>
              </div>
            )}

            {/* Actions rapides */}
            {todayData?.requires_clocking !== false && (
              <div className="grid gap-4 md:grid-cols-2">
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-green-800">Pointer mon entree</h3>
                        <p className="text-sm text-green-600">Enregistrer votre arrivee</p>
                        {todayData?.today?.last_action?.status === 'check_in' && (
                          <p className="text-xs text-green-500 mt-1">
                            Derniere entree: {new Date(todayData.today.last_action.clock_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                      <Button
                        className="bg-green-600 hover:bg-green-700"
                        onClick={handleCheckIn}
                        disabled={loadingToday || checkInMutation.isPending || (todayData?.today && !todayData.today.can_check_in)}
                      >
                        {loadingToday || checkInMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <LogIn className="h-4 w-4 mr-2" />
                            Entree
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-orange-50 border-orange-200">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-orange-800">Pointer ma sortie</h3>
                        <p className="text-sm text-orange-600">Enregistrer votre depart</p>
                        {todayData?.today?.worked_minutes != null && todayData.today.worked_minutes > 0 && (
                          <p className="text-xs text-orange-500 mt-1">
                            Temps: {Math.floor(todayData.today.worked_minutes / 60)}h{(todayData.today.worked_minutes % 60).toString().padStart(2, '0')}
                          </p>
                        )}
                      </div>
                      <Button
                        className="bg-orange-600 hover:bg-orange-700"
                        onClick={handleCheckOut}
                        disabled={loadingToday || checkOutMutation.isPending || !todayData?.today?.can_check_out}
                        title={!todayData?.today?.can_check_out ? "Vous devez d'abord pointer l'entrée" : ""}
                      >
                        {loadingToday || checkOutMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <LogOut className="h-4 w-4 mr-2" />
                            Sortie
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Heures ce mois
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loadingAttendance ? '-' : `${attendanceData?.stats?.total_hours || 0}h`}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Jours travailles
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {loadingAttendance ? '-' : attendanceData?.stats?.present_days || 0}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Total retards
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-orange-600">
                    {loadingAttendance ? '-' : `${attendanceData?.stats?.late_minutes || 0} min`}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-500">
                    Conges pris
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">
                    {loadingAttendance ? '-' : attendanceData?.stats?.leave_days || 0}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Filtres */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Historique des pointages
                </CardTitle>
                <div className="flex gap-2">
                  <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOIS.map((mois, i) => (
                        <SelectItem key={i} value={(i + 1).toString()}>
                          {mois}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2026">2026</SelectItem>
                      <SelectItem value="2025">2025</SelectItem>
                      <SelectItem value="2024">2024</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Exporter
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingAttendance ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Entree</TableHead>
                        <TableHead>Sortie</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Heures travaillees</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceData?.records?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                            Aucun pointage pour cette periode
                          </TableCell>
                        </TableRow>
                      ) : (
                        attendanceData?.records?.map((record, idx) => {
                          return (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">
                                {new Date(record.date).toLocaleDateString('fr-FR')}
                              </TableCell>
                              <TableCell>{record.check_in}</TableCell>
                              <TableCell>{record.check_out}</TableCell>
                              <TableCell>
                                <Badge className={
                                  record.status === 'present' ? 'bg-green-100 text-green-800' :
                                  record.status === 'pending' ? 'bg-blue-100 text-blue-800' :
                                  record.status === 'late' ? 'bg-orange-100 text-orange-800' :
                                  record.status === 'early_leave' ? 'bg-yellow-100 text-yellow-800' :
                                  record.status === 'late_early' ? 'bg-red-100 text-red-800' :
                                  record.status === 'half_day' ? 'bg-blue-100 text-blue-800' :
                                  record.status === 'incomplete' ? 'bg-red-100 text-red-800' :
                                  record.status === 'leave' ? 'bg-teal-100 text-teal-800' :
                                  record.status === 'holiday' ? 'bg-purple-100 text-purple-800' :
                                  record.status === 'weekend' ? 'bg-slate-100 text-slate-600' :
                                  record.status === 'mission' ? 'bg-indigo-100 text-indigo-800' :
                                  record.status === 'recovery_off' ? 'bg-teal-100 text-teal-800' :
                                  record.status === 'recovery_paid' ? 'bg-green-100 text-green-800' :
                                  record.status === 'recovery_unpaid' ? 'bg-orange-100 text-orange-800' :
                                  record.status === 'absent' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }>
                                  {record.status === 'present' ? 'Présent' :
                                   record.status === 'pending' ? 'En cours' :
                                   record.status === 'late' ? 'En retard' :
                                   record.status === 'early_leave' ? 'Départ anticipé' :
                                   record.status === 'late_early' ? 'Retard + Départ ant.' :
                                   record.status === 'half_day' ? 'Demi-journée' :
                                   record.status === 'incomplete' ? 'En cours' :
                                   record.status === 'leave' ? 'Congé' :
                                   record.status === 'holiday' ? 'Jour férié' :
                                   record.status === 'weekend' ? 'Week-end' :
                                   record.status === 'mission' ? 'Mission' :
                                   record.status === 'recovery_off' ? 'À récupérer' :
                                   record.status === 'recovery_paid' ? 'Récup. payée' :
                                   record.status === 'recovery_unpaid' ? 'Récup. non payée' :
                                   record.status === 'absent' ? 'Absent' : record.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="font-medium text-blue-600">
                                {record.worked_minutes != null
                                  ? `${Math.floor(record.worked_minutes / 60)}h ${(record.worked_minutes % 60).toString().padStart(2, '0')}min`
                                  : '-'}
                              </TableCell>
                              <TableCell>
                                {record.correction_request && record.correction_request.status !== 'cancelled' ? (
                                  <CorrectionStatusBadge correction={record.correction_request} />
                                ) : !['weekend', 'holiday'].includes(record.status) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-blue-600 border-blue-300 hover:bg-blue-50"
                                    onClick={() => handleOpenCorrectionModal(
                                      record.date,
                                      record.check_in !== '-' ? record.check_in : '',
                                      record.check_out !== '-' ? record.check_out : ''
                                    )}
                                  >
                                    <FileEdit className="h-3 w-3 mr-1" />
                                    Demande
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'demandes':
        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Mes Demandes RH
              </CardTitle>
              <Button onClick={() => setShowNewDemandeModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle demande
              </Button>
            </CardHeader>
            <CardContent>
              {loadingRequests ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Date soumission</TableHead>
                      <TableHead>Periode</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requestsData?.requests?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                          Aucune demande
                        </TableCell>
                      </TableRow>
                    ) : (
                      requestsData?.requests?.map(demande => {
                        // Vérifier si la demande peut être annulée (pending ou en cours de validation)
                        const canCancel = demande.status === 'pending' ||
                          (demande.status as string)?.startsWith('approved_n');

                        return (
                          <TableRow key={`${demande.request_type}-${demande.id}`}>
                            <TableCell className="font-medium">
                              {demande.type_name}
                            </TableCell>
                            <TableCell>
                              {new Date(demande.date_soumission).toLocaleDateString('fr-FR')}
                            </TableCell>
                            <TableCell>
                              {demande.start_date && demande.end_date && demande.start_date !== demande.end_date
                                ? `${new Date(demande.start_date).toLocaleDateString('fr-FR')} - ${new Date(demande.end_date).toLocaleDateString('fr-FR')}`
                                : demande.start_date
                                ? new Date(demande.start_date).toLocaleDateString('fr-FR')
                                : '-'}
                            </TableCell>
                            <TableCell className="max-w-xs truncate">{demande.description}</TableCell>
                            <TableCell>{getStatusBadge(demande.status)}</TableCell>
                            <TableCell>
                              {canCancel ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => setRequestToCancel(demande)}
                                  disabled={cancelRequestMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Clock className="h-8 w-8 text-blue-600" />
            Portail Employe RH
          </h1>
          <p className="text-gray-500 mt-1">
            Gerez votre pointage et vos demandes RH
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-4" aria-label="Tabs">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        {renderTabContent()}

        {/* Modal nouvelle demande */}
        <Dialog open={showNewDemandeModal} onOpenChange={setShowNewDemandeModal}>
          <DialogContent className="w-[95vw] sm:w-[500px] md:w-[550px] max-w-[95vw]">
            <DialogHeader>
              <DialogTitle>Nouvelle demande RH</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Type de demande *</Label>
                <Select
                  value={newDemande.type}
                  onValueChange={v => setNewDemande({ ...newDemande, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selectionnez le type" />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES_DEMANDES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {['conge_annuel', 'conge_sans_solde', 'conge_maladie'].includes(newDemande.type) && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Date debut</Label>
                    <Input
                      type="date"
                      value={newDemande.date_debut}
                      onChange={e => setNewDemande({ ...newDemande, date_debut: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Date fin</Label>
                    <Input
                      type="date"
                      value={newDemande.date_fin}
                      onChange={e => setNewDemande({ ...newDemande, date_fin: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Description *</Label>
                <Textarea
                  value={newDemande.description}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewDemande({ ...newDemande, description: e.target.value })}
                  placeholder="Decrivez votre demande..."
                  rows={4}
                />
              </div>

              {/* Pièce jointe (pour congé maladie) */}
              {newDemande.type === 'conge_maladie' && (
                <div className="space-y-2">
                  <Label htmlFor="attachment-employee">Certificat médical *</Label>
                  <div className="relative">
                    <input
                      type="file"
                      id="attachment-employee"
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
                      htmlFor="attachment-employee"
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
                          const input = document.getElementById('attachment-employee') as HTMLInputElement;
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
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewDemandeModal(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleSubmitDemande}
                disabled={createRequestMutation.isPending}
              >
                {createRequestMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Soumettre
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal demande de correction de pointage */}
        <Dialog open={showCorrectionModal} onOpenChange={setShowCorrectionModal}>
          <DialogContent className="w-[95vw] sm:w-[450px] max-w-[95vw]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileEdit className="h-5 w-5 text-blue-600" />
                Demande de correction de pointage
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="text"
                  value={correctionData.date ? new Date(correctionData.date).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  }) : ''}
                  disabled
                  className="bg-gray-100"
                />
              </div>

              {/* Box orange - Pointage actuel enregistré (lecture seule) */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <div className="text-sm font-medium text-orange-800 mb-2">Pointage actuel enregistre</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-orange-600">Entree:</span>{' '}
                    <span className="font-bold text-orange-900">
                      {correctionData.original_check_in || 'Non enregistree'}
                    </span>
                  </div>
                  <div>
                    <span className="text-orange-600">Sortie:</span>{' '}
                    <span className="font-bold text-orange-900">
                      {correctionData.original_check_out || 'Non enregistree'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Box bleu - Nouveau pointage demandé (modifiable) */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-sm font-medium text-blue-800 mb-2">Nouveau pointage demande</div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-blue-600">Nouvelle entree</Label>
                    <Input
                      type="text"
                      placeholder="HH:MM"
                      pattern="[0-2][0-9]:[0-5][0-9]"
                      value={correctionData.requested_check_in}
                      onChange={e => {
                        let val = e.target.value.replace(/[^0-9:]/g, '');
                        if (val.length === 2 && !val.includes(':')) val += ':';
                        if (val.length > 5) val = val.slice(0, 5);
                        setCorrectionData({ ...correctionData, requested_check_in: val });
                      }}
                      maxLength={5}
                      className="bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-blue-600">Nouvelle sortie</Label>
                    <Input
                      type="text"
                      placeholder="HH:MM"
                      pattern="[0-2][0-9]:[0-5][0-9]"
                      value={correctionData.requested_check_out}
                      onChange={e => {
                        let val = e.target.value.replace(/[^0-9:]/g, '');
                        if (val.length === 2 && !val.includes(':')) val += ':';
                        if (val.length > 5) val = val.slice(0, 5);
                        setCorrectionData({ ...correctionData, requested_check_out: val });
                      }}
                      maxLength={5}
                      className="bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Motif *</Label>
                <Textarea
                  value={correctionData.reason}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCorrectionData({ ...correctionData, reason: e.target.value })}
                  placeholder="Expliquez la raison de cette demande de correction..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCorrectionModal(false)}>
                Annuler
              </Button>
              <Button
                onClick={handleSubmitCorrection}
                disabled={correctionMutation.isPending || !correctionData.reason.trim() || (!correctionData.requested_check_in && !correctionData.requested_check_out)}
              >
                {correctionMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                Soumettre
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog confirmation annulation demande */}
        <AlertDialog open={!!requestToCancel} onOpenChange={(open) => !open && setRequestToCancel(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                Annuler cette demande ?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {requestToCancel && (
                  <div className="space-y-2">
                    <p>Etes-vous sur de vouloir annuler cette demande ?</p>
                    <div className="bg-gray-50 p-3 rounded-lg text-sm">
                      <p><strong>Type:</strong> {requestToCancel.type_name}</p>
                      {requestToCancel.start_date && (
                        <p><strong>Date:</strong> {new Date(requestToCancel.start_date).toLocaleDateString('fr-FR')}</p>
                      )}
                      {requestToCancel.description && (
                        <p><strong>Motif:</strong> {requestToCancel.description}</p>
                      )}
                    </div>
                    <p className="text-red-600 text-sm">
                      Cette action est irreversible. Vous devrez soumettre une nouvelle demande si necessaire.
                    </p>
                  </div>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cancelRequestMutation.isPending}>
                Conserver
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (requestToCancel) {
                    cancelRequestMutation.mutate(requestToCancel.id.toString());
                  }
                }}
                className="bg-red-600 hover:bg-red-700"
                disabled={cancelRequestMutation.isPending}
              >
                {cancelRequestMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
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
    </AppLayout>
  );
}
