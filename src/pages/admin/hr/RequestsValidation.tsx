/**
 * Validation des Demandes RH
 * Interface de validation pour les responsables/validateurs
 * - Liste des demandes en attente avec filtres
 * - Approbation/Rejet avec commentaires
 * - Historique des decisions
 */

import { useState } from 'react';
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
import {
  CheckSquare,
  Search,
  Filter,
  Check,
  X,
  Clock,
  Calendar,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  Eye,
  ChevronRight,
  Briefcase,
  Plane,
  FileCheck,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  usePendingRequests,
  useValidationHistory,
  useApproveRequest,
  useRejectRequest,
} from '@/hooks/useRequestsValidation';
import type { PendingRequest, HistoryItem } from '@/lib/api/requests-validation';

// Types de demandes
const REQUEST_TYPES = [
  { value: 'ANNUAL', label: 'Conge annuel', icon: Plane, color: 'blue' },
  { value: 'SICK', label: 'Conge maladie', icon: Briefcase, color: 'red' },
  { value: 'UNPAID', label: 'Conge sans solde', icon: Calendar, color: 'orange' },
  { value: 'heures_sup', label: 'Heures supplementaires', icon: Clock, color: 'purple' },
  { value: 'OTHER', label: 'Autre demande', icon: FileCheck, color: 'green' },
];

export default function RequestsValidation() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decisionType, setDecisionType] = useState<'approve' | 'reject'>('approve');
  const [decisionComment, setDecisionComment] = useState('');

  // Queries
  const { data: pendingData, isLoading: loadingPending } = usePendingRequests(typeFilter);
  const { data: historyData, isLoading: loadingHistory } = useValidationHistory(50);

  // Mutations
  const approveMutation = useApproveRequest();
  const rejectMutation = useRejectRequest();

  // Filtrer les demandes par recherche
  const filteredRequests = pendingData?.requests?.filter(request => {
    const matchesSearch =
      request.employee_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.employee_department?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  }) || [];

  // Obtenir les infos du type de demande
  const getRequestTypeInfo = (typeCode: string) => {
    return REQUEST_TYPES.find(t => t.value === typeCode) || REQUEST_TYPES[REQUEST_TYPES.length - 1];
  };

  // Formater la date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  // Ouvrir le modal de detail
  const handleViewDetails = (request: PendingRequest) => {
    setSelectedRequest(request);
    setShowDetailModal(true);
  };

  // Ouvrir le modal de decision
  const handleDecision = (request: PendingRequest, type: 'approve' | 'reject') => {
    setSelectedRequest(request);
    setDecisionType(type);
    setDecisionComment('');
    setShowDecisionModal(true);
  };

  // Soumettre la decision
  const submitDecision = async () => {
    if (!selectedRequest) return;

    if (decisionType === 'reject' && !decisionComment.trim()) {
      toast({
        title: 'Commentaire requis',
        description: 'Veuillez indiquer le motif du rejet',
        variant: 'destructive',
      });
      return;
    }

    try {
      const data = {
        request_type: selectedRequest.request_type,
        comment: decisionComment,
      };

      if (decisionType === 'approve') {
        await approveMutation.mutateAsync({ id: selectedRequest.id, data });
        toast({
          title: 'Demande approuvee',
          description: 'La demande a ete approuvee avec succes.',
        });
      } else {
        await rejectMutation.mutateAsync({ id: selectedRequest.id, data });
        toast({
          title: 'Demande rejetee',
          description: 'La demande a ete rejetee.',
        });
      }
      setShowDecisionModal(false);
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Erreur lors du traitement',
        variant: 'destructive',
      });
    }
  };

  // Rendu d'une carte de demande
  const renderRequestCard = (request: PendingRequest) => {
    const typeInfo = getRequestTypeInfo(request.type_code);
    const TypeIcon = typeInfo.icon;

    return (
      <Card key={`${request.request_type}-${request.id}`} className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg bg-${typeInfo.color}-100`}>
                <TypeIcon className={`h-5 w-5 text-${typeInfo.color}-600`} />
              </div>
              <div>
                <h4 className="font-medium">{request.employee_name}</h4>
                <p className="text-sm text-gray-500">{request.employee_department || 'Non specifie'}</p>
                <Badge variant="outline" className="mt-1">
                  {request.type_name}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">
                Soumis le {formatDate(request.date_soumission)}
              </p>
              <div className="flex items-center gap-1 mt-1 text-sm text-orange-600">
                <Clock className="h-4 w-4" />
                Etape {request.etape_actuelle}/{request.etape_totale}
              </div>
            </div>
          </div>

          {/* Details selon le type */}
          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
            {request.request_type === 'leave' ? (
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Du:</span>
                  <p className="font-medium">{formatDate(request.start_date)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Au:</span>
                  <p className="font-medium">{formatDate(request.end_date)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Duree:</span>
                  <p className="font-medium">{request.days_requested} jour(s)</p>
                </div>
              </div>
            ) : (
              <div className="text-sm">
                <span className="text-gray-500">Heures demandees:</span>
                <p className="font-medium">{request.days_requested}h</p>
              </div>
            )}

            {request.motif && (
              <div className="mt-2 text-sm">
                <span className="text-gray-500">Motif:</span>
                <p className="italic">{request.motif}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-4 flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={() => handleViewDetails(request)}>
              <Eye className="h-4 w-4 mr-1" />
              Details
            </Button>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:bg-red-50"
                onClick={() => handleDecision(request, 'reject')}
                disabled={rejectMutation.isPending}
              >
                <X className="h-4 w-4 mr-1" />
                Rejeter
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700"
                onClick={() => handleDecision(request, 'approve')}
                disabled={approveMutation.isPending}
              >
                <Check className="h-4 w-4 mr-1" />
                Approuver
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <CheckSquare className="h-6 w-6" />
              Validation des Demandes
            </h1>
            <p className="text-gray-600">
              Gerez et validez les demandes RH de vos collaborateurs
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {loadingPending ? '...' : `${pendingData?.count || 0} en attente`}
            </Badge>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              En attente ({loadingPending ? '...' : pendingData?.count || 0})
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Historique
            </TabsTrigger>
          </TabsList>

          {/* Tab: Demandes en attente */}
          <TabsContent value="pending" className="space-y-4">
            {/* Filtres */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-[200px]">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Rechercher par employe ou departement..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="w-[200px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Type de demande" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les types</SelectItem>
                      {REQUEST_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Liste des demandes */}
            {loadingPending ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : filteredRequests.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                  <h3 className="text-lg font-medium">Aucune demande en attente</h3>
                  <p className="text-gray-500">
                    Toutes les demandes ont ete traitees
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredRequests.map(renderRequestCard)}
              </div>
            )}
          </TabsContent>

          {/* Tab: Historique */}
          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Historique des decisions</CardTitle>
                <CardDescription>
                  Vos decisions de validation recentes
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : historyData?.history?.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">Aucun historique</p>
                ) : (
                  <div className="space-y-4">
                    {historyData?.history?.map((item: HistoryItem) => (
                        <div
                          key={`${item.request_type}-${item.id}`}
                          className="flex items-center justify-between p-4 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            {item.decision === 'approved' ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                            <div>
                              <p className="font-medium">{item.employee_name}</p>
                              <p className="text-sm text-gray-500">
                                {item.type_name} - Decide le {formatDate(item.date_decision)}
                              </p>
                              {item.commentaire && (
                                <p className="text-sm italic text-gray-600 mt-1">
                                  "{item.commentaire}"
                                </p>
                              )}
                            </div>
                          </div>
                          <Badge variant={item.decision === 'approved' ? 'default' : 'destructive'}>
                            {item.decision === 'approved' ? 'Approuve' : 'Rejete'}
                          </Badge>
                        </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal Details */}
        <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
          <DialogContent className="w-[95vw] sm:w-[650px] md:w-[750px] lg:w-[850px] max-w-[95vw]">
            <DialogHeader>
              <DialogTitle>Details de la demande</DialogTitle>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-500">Employe</Label>
                    <p className="font-medium">{selectedRequest.employee_name}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Departement</Label>
                    <p className="font-medium">{selectedRequest.employee_department || 'Non specifie'}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Type de demande</Label>
                    <p className="font-medium">{selectedRequest.type_name}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Date de soumission</Label>
                    <p className="font-medium">{formatDate(selectedRequest.date_soumission)}</p>
                  </div>
                </div>

                {/* Circuit de validation */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <Label className="text-gray-500">Circuit de validation</Label>
                  <div className="flex items-center gap-2 mt-2">
                    {Array.from({ length: selectedRequest.etape_totale }).map((_, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center
                          ${i + 1 < selectedRequest.etape_actuelle
                            ? 'bg-green-500 text-white'
                            : i + 1 === selectedRequest.etape_actuelle
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-200'}
                        `}>
                          {i + 1 < selectedRequest.etape_actuelle ? (
                            <Check className="h-4 w-4" />
                          ) : (
                            i + 1
                          )}
                        </div>
                        {i < selectedRequest.etape_totale - 1 && (
                          <ChevronRight className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-gray-500">Motif</Label>
                  <p className="p-3 bg-gray-50 rounded-lg">{selectedRequest.motif || 'Non specifie'}</p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDetailModal(false)}>
                Fermer
              </Button>
              <Button
                variant="outline"
                className="text-red-600"
                onClick={() => {
                  setShowDetailModal(false);
                  if (selectedRequest) handleDecision(selectedRequest, 'reject');
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Rejeter
              </Button>
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={() => {
                  setShowDetailModal(false);
                  if (selectedRequest) handleDecision(selectedRequest, 'approve');
                }}
              >
                <Check className="h-4 w-4 mr-1" />
                Approuver
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modal Decision */}
        <Dialog open={showDecisionModal} onOpenChange={setShowDecisionModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {decisionType === 'approve' ? 'Approuver la demande' : 'Rejeter la demande'}
              </DialogTitle>
              <DialogDescription>
                {selectedRequest?.employee_name} - {selectedRequest?.type_name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className={`p-4 rounded-lg border-2 border-dashed ${
                decisionType === 'approve' ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
              }`}>
                <div className="flex items-center gap-2">
                  {decisionType === 'approve' ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className={decisionType === 'approve' ? 'text-green-700' : 'text-red-700'}>
                    {decisionType === 'approve'
                      ? 'Vous allez approuver cette demande'
                      : 'Vous allez rejeter cette demande'}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="comment">
                  Commentaire {decisionType === 'reject' && <span className="text-red-500">*</span>}
                </Label>
                <Textarea
                  id="comment"
                  placeholder={
                    decisionType === 'approve'
                      ? 'Commentaire optionnel...'
                      : 'Veuillez indiquer le motif du rejet...'
                  }
                  value={decisionComment}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDecisionComment(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDecisionModal(false)}>
                Annuler
              </Button>
              <Button
                className={decisionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
                onClick={submitDecision}
                disabled={
                  (decisionType === 'reject' && !decisionComment.trim()) ||
                  approveMutation.isPending ||
                  rejectMutation.isPending
                }
              >
                {(approveMutation.isPending || rejectMutation.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : decisionType === 'approve' ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Confirmer l'approbation
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 mr-1" />
                    Confirmer le rejet
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
