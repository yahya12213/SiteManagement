// @ts-nocheck
/**
 * Page Analyse Publicite
 * Saisie des stats Facebook et comparaison avec les prospects en BDD
 */

import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SearchableSelect } from '@/components/ui/searchable-select';
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
  Megaphone,
  Database,
  TrendingUp,
  TrendingDown,
  BarChart2,
  Plus,
  RefreshCw,
  Calendar,
  Trash2,
  Filter,
  ArrowUpDown,
} from 'lucide-react';
import {
  useFacebookStats,
  useFacebookStatsComparison,
  useCreateFacebookStat,
  useDeleteFacebookStat,
} from '@/hooks/useFacebookStats';
import { useSegments } from '@/hooks/useSegments';
import { useCities } from '@/hooks/useCities';
import { usePermission } from '@/hooks/usePermission';
import { toast } from '@/hooks/use-toast';

export default function AnalysePublicite() {
  const { commercialisation } = usePermission();

  // ============================================================
  // STATE - Onglet actif
  // ============================================================
  const [activeTab, setActiveTab] = useState<string>('declarations');

  // ============================================================
  // STATE - Filtres (partages entre historique et comparaison)
  // ============================================================
  const [selectedSegment, setSelectedSegment] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');

  // Dates par defaut: 30 derniers jours
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [dateStart, setDateStart] = useState<string>(thirtyDaysAgo.toISOString().split('T')[0]);
  const [dateEnd, setDateEnd] = useState<string>(today.toISOString().split('T')[0]);

  // ============================================================
  // STATE - Formulaire de saisie
  // ============================================================
  const [inputDate, setInputDate] = useState<string>(today.toISOString().split('T')[0]);
  const [inputSegment, setInputSegment] = useState<string>('');
  const [inputCity, setInputCity] = useState<string>('');
  const [inputCount, setInputCount] = useState<string>('');
  const [inputNotes, setInputNotes] = useState<string>('');

  // ============================================================
  // DATA HOOKS
  // ============================================================
  const { data: segments = [] } = useSegments();
  const { data: allCities = [] } = useCities();

  // Villes filtrees par segment pour le formulaire
  const filteredCitiesForInput = useMemo(() => {
    if (!inputSegment) return [];
    return allCities.filter(city => city.segment_id === inputSegment);
  }, [allCities, inputSegment]);

  // Villes filtrees par segment pour les filtres
  const filteredCitiesForFilter = useMemo(() => {
    if (!selectedSegment) return allCities;
    return allCities.filter(city => city.segment_id === selectedSegment);
  }, [allCities, selectedSegment]);

  // Options pour SearchableSelect - Segments
  const segmentOptions = useMemo(() => {
    return segments.map(seg => ({
      value: seg.id,
      label: seg.name
    }));
  }, [segments]);

  // Options pour SearchableSelect - Villes (formulaire de saisie)
  const cityOptionsForInput = useMemo(() => {
    return filteredCitiesForInput.map(city => ({
      value: city.id,
      label: city.name
    }));
  }, [filteredCitiesForInput]);

  // Options pour SearchableSelect - Villes (filtres)
  const cityOptionsForFilter = useMemo(() => {
    const options = [{ value: '', label: 'Toutes les villes' }];
    filteredCitiesForFilter.forEach(city => {
      options.push({ value: city.id, label: city.name });
    });
    return options;
  }, [filteredCitiesForFilter]);

  // Options pour SearchableSelect - Segments (filtres) avec option "Tous"
  const segmentOptionsWithAll = useMemo(() => {
    const options = [{ value: '', label: 'Tous les segments' }];
    segments.forEach(seg => {
      options.push({ value: seg.id, label: seg.name });
    });
    return options;
  }, [segments]);

  // Stats Facebook (historique)
  const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useFacebookStats({
    segment_id: selectedSegment || undefined,
    city_id: selectedCity || undefined,
    date_start: dateStart || undefined,
    date_end: dateEnd || undefined,
    limit: 100,
  });

  // Comparaison Facebook vs BDD (agrege par jour)
  const { data: comparisonData, isLoading: comparisonLoading, refetch: refetchComparison } = useFacebookStatsComparison({
    date_start: dateStart,
    date_end: dateEnd,
  });

  // Mutations
  const createStat = useCreateFacebookStat();
  const deleteStat = useDeleteFacebookStat();

  // Extracted data
  const stats = statsData?.stats || [];
  const comparison = comparisonData?.comparison || [];
  const summary = comparisonData?.summary;

  // ============================================================
  // HANDLERS
  // ============================================================
  const handleSubmit = async () => {
    if (!inputDate || !inputCity || !inputCount) {
      toast({
        title: 'Erreur',
        description: 'Veuillez remplir tous les champs obligatoires (date, ville, nombre)',
        variant: 'destructive',
      });
      return;
    }

    const count = parseInt(inputCount, 10);
    if (isNaN(count) || count < 0) {
      toast({
        title: 'Erreur',
        description: 'Le nombre de prospects doit etre un nombre positif',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createStat.mutateAsync({
        date: inputDate,
        city_id: inputCity,
        declared_count: count,
        notes: inputNotes || undefined,
      });

      toast({
        title: 'Succes',
        description: 'Statistique Facebook enregistree avec succes',
      });

      // Reset form (garder la date et le segment)
      setInputCity('');
      setInputCount('');
      setInputNotes('');
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Erreur lors de l\'enregistrement',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Etes-vous sur de vouloir supprimer cette entree ?')) return;

    try {
      await deleteStat.mutateAsync(id);
      toast({
        title: 'Succes',
        description: 'Entree supprimee avec succes',
      });
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message || 'Erreur lors de la suppression',
        variant: 'destructive',
      });
    }
  };

  const handleRefresh = () => {
    refetchStats();
    refetchComparison();
  };

  // Reset city when segment changes in input form
  const handleInputSegmentChange = (value: string) => {
    setInputSegment(value);
    setInputCity(''); // Reset city selection
  };

  // Reset city when segment changes in filters
  const handleFilterSegmentChange = (value: string) => {
    setSelectedSegment(value);
    setSelectedCity(''); // Reset city selection
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <AppLayout
      title="Analyse Publicite"
      subtitle="Comparaison des prospects Facebook vs Base de donnees"
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[300px]">
          <TabsTrigger value="declarations">Declarations</TabsTrigger>
          <TabsTrigger value="comparison">Comparaison</TabsTrigger>
        </TabsList>

        {/* ============================================================
            ONGLET 1: DECLARATIONS (SAISIE + HISTORIQUE)
            ============================================================ */}
        <TabsContent value="declarations" className="space-y-6">
          {/* Formulaire de saisie */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-blue-600" />
                Declarer les prospects Facebook
              </CardTitle>
              <CardDescription>
                Saisissez le nombre de prospects declares par Facebook pour une date et une ville
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
                {/* Date */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date *</label>
                  <Input
                    type="date"
                    value={inputDate}
                    onChange={(e) => setInputDate(e.target.value)}
                  />
                </div>

                {/* Segment */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Segment *</label>
                  <SearchableSelect
                    options={segmentOptions}
                    value={inputSegment}
                    onValueChange={handleInputSegmentChange}
                    placeholder="Choisir un segment"
                    emptyMessage="Aucun segment trouve"
                  />
                </div>

                {/* Ville */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Ville *</label>
                  <SearchableSelect
                    options={cityOptionsForInput}
                    value={inputCity}
                    onValueChange={setInputCity}
                    placeholder={inputSegment ? "Choisir une ville" : "Segment d'abord"}
                    disabled={!inputSegment}
                    emptyMessage="Aucune ville trouvee"
                  />
                </div>

                {/* Nombre */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nombre *</label>
                  <Input
                    type="number"
                    min="0"
                    value={inputCount}
                    onChange={(e) => setInputCount(e.target.value)}
                    placeholder="0"
                  />
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Notes</label>
                  <Input
                    value={inputNotes}
                    onChange={(e) => setInputNotes(e.target.value)}
                    placeholder="Campagne..."
                  />
                </div>

                {/* Bouton */}
                <Button
                  onClick={handleSubmit}
                  disabled={createStat.isPending || !inputDate || !inputCity || !inputCount}
                  className="h-10"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {createStat.isPending ? 'Ajout...' : 'Ajouter'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Historique des declarations */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Historique des declarations
                </CardTitle>
                <Button onClick={handleRefresh} variant="outline" size="sm">
                  <RefreshCw className={`h-4 w-4 mr-2 ${statsLoading ? 'animate-spin' : ''}`} />
                  Actualiser
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filtres pour l'historique */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500 shrink-0" />
                  <Input
                    type="date"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                    className="bg-white"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500 shrink-0" />
                  <Input
                    type="date"
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                    className="bg-white"
                  />
                </div>

                <SearchableSelect
                  options={segmentOptionsWithAll}
                  value={selectedSegment}
                  onValueChange={handleFilterSegmentChange}
                  placeholder="Tous les segments"
                  emptyMessage="Aucun segment trouve"
                />

                <SearchableSelect
                  options={cityOptionsForFilter}
                  value={selectedCity}
                  onValueChange={setSelectedCity}
                  placeholder="Toutes les villes"
                  emptyMessage="Aucune ville trouvee"
                />
              </div>

              {/* Tableau historique */}
              {statsLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : stats.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucune declaration enregistree pour cette periode
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Ville</TableHead>
                        <TableHead>Segment</TableHead>
                        <TableHead className="text-right">Prospects</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Saisi par</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.map((stat) => (
                        <TableRow key={stat.id}>
                          <TableCell className="font-medium">
                            {new Date(stat.date).toLocaleDateString('fr-FR')}
                          </TableCell>
                          <TableCell>{stat.city_name}</TableCell>
                          <TableCell>
                            <Badge
                              style={{
                                backgroundColor: stat.segment_color || '#3B82F6',
                              }}
                              className="text-white"
                            >
                              {stat.segment_name}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold text-blue-600">
                            {stat.declared_count}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[150px] truncate">
                            {stat.notes || '-'}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {stat.created_by_name || '-'}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(stat.id)}
                              disabled={deleteStat.isPending}
                              className="hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ============================================================
            ONGLET 2: COMPARAISON FACEBOOK VS BDD (Resume par jour)
            ============================================================ */}
        <TabsContent value="comparison" className="space-y-6">
          {/* Filtres - Dates uniquement */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Periode
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500 shrink-0" />
                  <Input
                    type="date"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-500 shrink-0" />
                  <Input
                    type="date"
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                  />
                </div>

                <Button onClick={handleRefresh} variant="outline">
                  <RefreshCw className={`h-4 w-4 mr-2 ${comparisonLoading ? 'animate-spin' : ''}`} />
                  Actualiser
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Cartes KPI */}
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Facebook</p>
                      <p className="text-2xl font-bold text-blue-600">{summary.total_facebook}</p>
                    </div>
                    <Megaphone className="h-10 w-10 text-blue-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Prospects BDD</p>
                      <p className="text-2xl font-bold text-green-600">{summary.total_database}</p>
                    </div>
                    <Database className="h-10 w-10 text-green-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Difference</p>
                      <p className={`text-2xl font-bold ${
                        summary.difference >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {summary.difference >= 0 ? '+' : ''}{summary.difference}
                      </p>
                    </div>
                    {summary.difference >= 0 ? (
                      <TrendingUp className="h-10 w-10 text-green-500 opacity-50" />
                    ) : (
                      <TrendingDown className="h-10 w-10 text-red-500 opacity-50" />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Taux de conversion</p>
                      <p className="text-2xl font-bold text-purple-600">{summary.overall_conversion_rate}%</p>
                    </div>
                    <BarChart2 className="h-10 w-10 text-purple-500 opacity-50" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Tableau de comparaison par jour */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowUpDown className="h-5 w-5" />
                Resume par jour
              </CardTitle>
              <CardDescription>
                Comparaison entre les prospects declares sur Facebook et ceux ajoutes dans la base de donnees
              </CardDescription>
            </CardHeader>
            <CardContent>
              {comparisonLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : comparison.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Aucune donnee pour la periode selectionnee
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Facebook</TableHead>
                        <TableHead className="text-right">Prospects BDD</TableHead>
                        <TableHead className="text-right">Difference</TableHead>
                        <TableHead className="text-right">Taux</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comparison.map((row, index) => (
                        <TableRow key={`${row.date}-${index}`}>
                          <TableCell className="font-medium">
                            {new Date(row.date).toLocaleDateString('fr-FR')}
                          </TableCell>
                          <TableCell className="text-right font-medium text-blue-600">
                            {row.facebook_count}
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            {row.database_count}
                          </TableCell>
                          <TableCell className={`text-right font-medium ${
                            row.difference >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {row.difference >= 0 ? '+' : ''}{row.difference}
                          </TableCell>
                          <TableCell className="text-right">
                            {row.conversion_rate !== null ? (
                              <Badge variant={
                                parseFloat(String(row.conversion_rate)) >= 100 ? 'default' :
                                parseFloat(String(row.conversion_rate)) >= 80 ? 'secondary' : 'destructive'
                              }>
                                {row.conversion_rate}%
                              </Badge>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
