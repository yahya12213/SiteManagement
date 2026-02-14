// @ts-nocheck
/**
 * Page Gestion des Visites Physiques
 * Liste, filtres, stats, analytics (performance par zone, motifs)
 */

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MapPin,
  Plus,
  Download,
  RefreshCw,
  Search,
  UserCheck,
  UserX,
  Users,
  TrendingUp,
  BarChart3,
  AlertTriangle,
  Calendar,
  Trash2,
} from 'lucide-react';
import { useVisits, useVisitAnalytics, useDeleteVisit, useExportVisits, useRejectionReasons } from '@/hooks/useVisits';
import { useCities } from '@/hooks/useCities';
import { usePermission } from '@/hooks/usePermission';
import type { VisitFilters } from '@/lib/api/visits';
import { VisitFormModal } from '@/components/visits/VisitFormModal';
import { toast } from '@/hooks/use-toast';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];

export default function Visits() {
  const { commercialisation } = usePermission();

  // Filtres
  const [filters, setFilters] = useState<VisitFilters>({
    page: 1,
    limit: 50,
  });

  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('list');

  // Données
  const { data, isLoading, error, refetch } = useVisits(filters);
  const { data: analytics, isLoading: analyticsLoading } = useVisitAnalytics();
  const { data: cities = [] } = useCities();
  const { data: rejectionReasons = [] } = useRejectionReasons();
  const deleteVisit = useDeleteVisit();
  const exportVisits = useExportVisits();

  // Modals states
  const [showAddModal, setShowAddModal] = useState(false);

  const visits = data?.visits || [];
  const stats = data?.stats || { total: 0, inscrits: 0, non_inscrits: 0 };
  const pagination = data?.pagination || { page: 1, limit: 50, total: 0 };

  // Handlers
  const handleSearch = () => {
    setFilters({ ...filters, search, page: 1 });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette visite ?')) return;

    try {
      await deleteVisit.mutateAsync(id);
      toast({
        title: 'Succès',
        description: 'Visite supprimée avec succès',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error?.message || 'Impossible de supprimer la visite',
      });
    }
  };

  const handleExport = async () => {
    try {
      await exportVisits.mutateAsync(filters);
      toast({
        title: 'Succès',
        description: 'Export CSV téléchargé',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: "Erreur lors de l'export",
      });
    }
  };

  // Calculate conversion rate
  const conversionRate = stats.total > 0
    ? ((stats.inscrits / stats.total) * 100).toFixed(1)
    : '0';

  // Prepare chart data for zone performance
  const zoneChartData = analytics?.performance_by_zone?.map(zone => ({
    name: zone.ville_name,
    inscrits: zone.inscrits,
    non_inscrits: zone.non_inscrits,
    taux: zone.taux_conversion || 0,
  })) || [];

  // Prepare pie chart data for rejection reasons
  const reasonsPieData = analytics?.top_reasons?.map((reason, index) => ({
    name: reason.motif_label,
    value: reason.count,
    color: COLORS[index % COLORS.length],
  })) || [];

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MapPin className="h-8 w-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Visites</h1>
              <p className="text-sm text-gray-500">
                Suivi des visites physiques au centre
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {commercialisation?.visits?.export && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={exportVisits.isPending}
              >
                <Download className="h-4 w-4 mr-2" />
                Exporter
              </Button>
            )}
            {commercialisation?.visits?.create && (
              <Button onClick={() => setShowAddModal(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle visite
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total visites</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <UserCheck className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Inscrits</p>
                  <p className="text-2xl font-bold text-green-600">{stats.inscrits}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <UserX className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Non inscrits</p>
                  <p className="text-2xl font-bold text-red-600">{stats.non_inscrits}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Taux de conversion</p>
                  <p className="text-2xl font-bold text-purple-600">{conversionRate}%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Liste / Analytics */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="list" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Liste des visites
            </TabsTrigger>
            {commercialisation?.visits?.view_analytics && (
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Analytics
              </TabsTrigger>
            )}
          </TabsList>

          {/* Liste des visites */}
          <TabsContent value="list" className="space-y-4">
            {/* Filtres */}
            <Card>
              <CardContent className="p-4">
                <div className="flex flex-wrap gap-4 items-end">
                  {/* Recherche */}
                  <div className="flex-1 min-w-[200px]">
                    <label className="text-sm text-gray-500 mb-1 block">Recherche</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Téléphone, nom..."
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                          className="pl-10"
                        />
                      </div>
                      <Button variant="outline" onClick={handleSearch}>
                        <Search className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Ville */}
                  <div className="w-48">
                    <label className="text-sm text-gray-500 mb-1 block">Centre</label>
                    <Select
                      value={filters.centre_ville_id || 'all'}
                      onValueChange={(value) =>
                        setFilters({
                          ...filters,
                          centre_ville_id: value === 'all' ? undefined : value,
                          page: 1,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tous les centres" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les centres</SelectItem>
                        {cities?.map((city) => (
                          <SelectItem key={city.id} value={city.id}>
                            {city.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Statut */}
                  <div className="w-40">
                    <label className="text-sm text-gray-500 mb-1 block">Statut</label>
                    <Select
                      value={filters.statut || 'all'}
                      onValueChange={(value) =>
                        setFilters({
                          ...filters,
                          statut: value === 'all' ? undefined : value as 'inscrit' | 'non_inscrit',
                          page: 1,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Tous" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous</SelectItem>
                        <SelectItem value="inscrit">Inscrit</SelectItem>
                        <SelectItem value="non_inscrit">Non inscrit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Date */}
                  <div className="w-40">
                    <label className="text-sm text-gray-500 mb-1 block">Date du</label>
                    <Input
                      type="date"
                      value={filters.date_from || ''}
                      onChange={(e) =>
                        setFilters({ ...filters, date_from: e.target.value || undefined, page: 1 })
                      }
                    />
                  </div>
                  <div className="w-40">
                    <label className="text-sm text-gray-500 mb-1 block">Date au</label>
                    <Input
                      type="date"
                      value={filters.date_to || ''}
                      onChange={(e) =>
                        setFilters({ ...filters, date_to: e.target.value || undefined, page: 1 })
                      }
                    />
                  </div>

                  {/* Refresh */}
                  <Button variant="outline" onClick={() => refetch()}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Table */}
            <Card>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : error ? (
                  <div className="flex items-center justify-center py-12 text-red-600">
                    Erreur: {(error as Error).message}
                  </div>
                ) : visits.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                    <MapPin className="h-12 w-12 mb-4 text-gray-300" />
                    <p>Aucune visite trouvée</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Visiteur</TableHead>
                        <TableHead>Téléphone</TableHead>
                        <TableHead>Centre</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead>Motif</TableHead>
                        <TableHead>Enregistré par</TableHead>
                        {commercialisation?.visits?.delete && (
                          <TableHead className="w-16">Actions</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visits.map((visit) => (
                        <TableRow key={visit.id}>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              {new Date(visit.date_visite).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              {visit.nom || visit.prenom ? (
                                <span className="font-medium">
                                  {[visit.prenom, visit.nom].filter(Boolean).join(' ')}
                                </span>
                              ) : (
                                <span className="text-gray-400 italic">Non renseigné</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {visit.phone_international}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{visit.centre_ville_name}</Badge>
                          </TableCell>
                          <TableCell>
                            {visit.statut === 'inscrit' ? (
                              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                                <UserCheck className="h-3 w-3 mr-1" />
                                Inscrit
                              </Badge>
                            ) : (
                              <Badge className="bg-red-100 text-red-800 hover:bg-red-100">
                                <UserX className="h-3 w-3 mr-1" />
                                Non inscrit
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {visit.statut === 'non_inscrit' && visit.motif_label ? (
                              <span className="text-sm text-gray-600">{visit.motif_label}</span>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {visit.created_by_name || '-'}
                          </TableCell>
                          {commercialisation?.visits?.delete && (
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(visit.id)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Pagination */}
            {pagination.total > pagination.limit && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Affichage de {(pagination.page - 1) * pagination.limit + 1} à{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} sur{' '}
                  {pagination.total} visites
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilters({ ...filters, page: filters.page! - 1 })}
                    disabled={pagination.page === 1}
                  >
                    Précédent
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilters({ ...filters, page: filters.page! + 1 })}
                    disabled={pagination.page * pagination.limit >= pagination.total}
                  >
                    Suivant
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* Analytics */}
          {commercialisation?.visits?.view_analytics && (
            <TabsContent value="analytics" className="space-y-6">
              {analyticsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <>
                  {/* Performance par zone */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5" />
                        Performance par Zone
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {zoneChartData.length > 0 ? (
                        <div className="h-80">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={zoneChartData}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="name" />
                              <YAxis />
                              <Tooltip />
                              <Legend />
                              <Bar dataKey="inscrits" name="Inscrits" fill="#22c55e" />
                              <Bar dataKey="non_inscrits" name="Non inscrits" fill="#ef4444" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="text-center text-gray-500 py-8">Aucune donnée disponible</p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Top des motifs de non-inscription */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-orange-500" />
                          Motifs de non-inscription
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {reasonsPieData.length > 0 ? (
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={reasonsPieData}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  outerRadius={80}
                                  fill="#8884d8"
                                  dataKey="value"
                                  label={({ name, percent }) =>
                                    `${name}: ${(percent * 100).toFixed(0)}%`
                                  }
                                >
                                  {reasonsPieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <p className="text-center text-gray-500 py-8">Aucune donnée disponible</p>
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <TrendingUp className="h-5 w-5" />
                          Classement des Motifs
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {analytics?.top_reasons?.map((reason, index) => (
                            <div
                              key={reason.motif_non_inscription}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                              <div className="flex items-center gap-3">
                                <span className="text-lg font-bold text-gray-400">
                                  #{index + 1}
                                </span>
                                <span className="font-medium">{reason.motif_label}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-2xl font-bold">{reason.count}</span>
                                <Badge variant="outline">{reason.percentage}%</Badge>
                              </div>
                            </div>
                          )) || (
                            <p className="text-center text-gray-500 py-4">Aucun motif enregistré</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Tableau détaillé par zone */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Détail par Centre</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Centre</TableHead>
                            <TableHead className="text-right">Visites</TableHead>
                            <TableHead className="text-right">Inscrits</TableHead>
                            <TableHead className="text-right">Non inscrits</TableHead>
                            <TableHead className="text-right">Taux conversion</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {analytics?.performance_by_zone?.map((zone) => (
                            <TableRow key={zone.ville_id}>
                              <TableCell className="font-medium">{zone.ville_name}</TableCell>
                              <TableCell className="text-right">{zone.total_visites}</TableCell>
                              <TableCell className="text-right text-green-600">
                                {zone.inscrits}
                              </TableCell>
                              <TableCell className="text-right text-red-600">
                                {zone.non_inscrits}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge
                                  variant="outline"
                                  className={
                                    zone.taux_conversion >= 50
                                      ? 'bg-green-100 text-green-800'
                                      : zone.taux_conversion >= 25
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-red-100 text-red-800'
                                  }
                                >
                                  {zone.taux_conversion || 0}%
                                </Badge>
                              </TableCell>
                            </TableRow>
                          )) || (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-gray-500">
                                Aucune donnée disponible
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Modals */}
      <VisitFormModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
      />
    </AppLayout>
  );
}
