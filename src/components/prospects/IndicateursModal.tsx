// @ts-nocheck
/**
 * IndicateursModal - Affiche les indicateurs des prospects avec graphiques et cartes
 */
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  BarChart3,
  Users,
  Phone,
  Calendar,
  UserCheck,
  UserX,
  TrendingUp,
  TrendingDown,
  Target,
  Clock,
  CalendarDays,
  CalendarRange,
  Percent,
  PieChart as PieChartIcon,
  Activity
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { prospectsApi } from '@/lib/api/prospects';
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths, subYears } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
  RadialBarChart,
  RadialBar
} from 'recharts';

interface Props {
  open: boolean;
  onClose: () => void;
  filters?: {
    segment_id?: string;
    ville_id?: string;
  };
}

type PeriodType = 'mensuel' | 'annuel';

// Couleurs pour les graphiques
const COLORS = {
  primary: '#3b82f6',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  purple: '#8b5cf6',
  cyan: '#06b6d4',
  orange: '#f97316',
  gray: '#6b7280',
};

// Composant carte indicateur avec mini graphique
function IndicatorCard({
  title,
  currentValue,
  previousValue,
  icon,
  color,
  suffix = '',
  isPercentage = false
}: {
  title: string;
  currentValue: number;
  previousValue: number;
  icon: React.ReactNode;
  color: string;
  suffix?: string;
  isPercentage?: boolean;
}) {
  const change = previousValue > 0 ? ((currentValue - previousValue) / previousValue) * 100 : 0;
  const isPositive = change > 0;
  const isNeutral = change === 0;

  const colorClasses = {
    blue: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', fill: '#3b82f6' },
    orange: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', fill: '#f97316' },
    green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', fill: '#22c55e' },
    gray: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', fill: '#6b7280' },
    purple: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', fill: '#8b5cf6' },
    cyan: { bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', fill: '#06b6d4' },
    red: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700', fill: '#ef4444' },
  };

  const colorClass = colorClasses[color] || colorClasses.gray;

  // Mini bar chart data
  const miniData = [
    { name: 'Préc.', value: previousValue },
    { name: 'Act.', value: currentValue },
  ];

  return (
    <Card className={`${colorClass.bg} ${colorClass.border} border-2 overflow-hidden`}>
      <CardContent className="pt-4 pb-2">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className={`p-1.5 rounded-lg bg-white/60 ${colorClass.text}`}>
                {icon}
              </span>
              <span className="text-sm font-medium text-gray-700">{title}</span>
            </div>
            <p className={`text-2xl font-bold ${colorClass.text}`}>
              {isPercentage ? currentValue.toFixed(1) : currentValue.toLocaleString('fr-FR')}
              {suffix}
            </p>
          </div>
          {/* Mini chart */}
          <div className="w-20 h-12">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={miniData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <Bar dataKey="value" fill={colorClass.fill} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Evolution indicator */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200/50">
          <span className="text-xs text-gray-500">
            Préc: {isPercentage ? previousValue.toFixed(1) : previousValue.toLocaleString('fr-FR')}{suffix}
          </span>
          {!isNeutral && (
            <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              <span>{isPositive ? '+' : ''}{change.toFixed(1)}%</span>
            </div>
          )}
          {isNeutral && (
            <span className="text-xs text-gray-400">Stable</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function IndicateursModal({ open, onClose, filters = {} }: Props) {
  const [periodType, setPeriodType] = useState<PeriodType>('mensuel');
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Calculer les plages de dates
  const dateRanges = useMemo(() => {
    if (periodType === 'mensuel') {
      const currentStart = startOfMonth(selectedDate);
      const currentEnd = endOfMonth(selectedDate);
      const previousStart = startOfMonth(subMonths(selectedDate, 1));
      const previousEnd = endOfMonth(subMonths(selectedDate, 1));

      return {
        current: {
          start: format(currentStart, 'yyyy-MM-dd'),
          end: format(currentEnd, 'yyyy-MM-dd'),
          label: format(selectedDate, 'MMMM yyyy', { locale: fr })
        },
        previous: {
          start: format(previousStart, 'yyyy-MM-dd'),
          end: format(previousEnd, 'yyyy-MM-dd'),
          label: format(subMonths(selectedDate, 1), 'MMMM yyyy', { locale: fr })
        }
      };
    } else {
      const currentStart = startOfYear(selectedDate);
      const currentEnd = endOfYear(selectedDate);
      const previousStart = startOfYear(subYears(selectedDate, 1));
      const previousEnd = endOfYear(subYears(selectedDate, 1));

      return {
        current: {
          start: format(currentStart, 'yyyy-MM-dd'),
          end: format(currentEnd, 'yyyy-MM-dd'),
          label: format(selectedDate, 'yyyy')
        },
        previous: {
          start: format(previousStart, 'yyyy-MM-dd'),
          end: format(previousEnd, 'yyyy-MM-dd'),
          label: format(subYears(selectedDate, 1), 'yyyy')
        }
      };
    }
  }, [periodType, selectedDate]);

  // Query pour la période actuelle
  const { data: currentStats, isLoading: currentLoading } = useQuery({
    queryKey: ['prospects-indicators-current', filters.segment_id, filters.ville_id, dateRanges.current.start, dateRanges.current.end],
    queryFn: () => prospectsApi.getAll({
      segment_id: filters.segment_id,
      ville_id: filters.ville_id,
      date_from: dateRanges.current.start,
      date_to: dateRanges.current.end,
      page: 1,
      limit: 1,
    }),
    enabled: open,
  });

  // Query pour la période précédente
  const { data: previousStats, isLoading: previousLoading } = useQuery({
    queryKey: ['prospects-indicators-previous', filters.segment_id, filters.ville_id, dateRanges.previous.start, dateRanges.previous.end],
    queryFn: () => prospectsApi.getAll({
      segment_id: filters.segment_id,
      ville_id: filters.ville_id,
      date_from: dateRanges.previous.start,
      date_to: dateRanges.previous.end,
      page: 1,
      limit: 1,
    }),
    enabled: open,
  });

  // Query pour les écarts période actuelle
  const { data: currentEcart } = useQuery({
    queryKey: ['prospects-ecart-current', filters.segment_id, filters.ville_id, dateRanges.current.start, dateRanges.current.end],
    queryFn: () => prospectsApi.getEcartDetails({
      segment_id: filters.segment_id,
      ville_id: filters.ville_id,
      date_from: dateRanges.current.start,
      date_to: dateRanges.current.end,
    }),
    enabled: open,
  });

  // Query pour les écarts période précédente
  const { data: previousEcart } = useQuery({
    queryKey: ['prospects-ecart-previous', filters.segment_id, filters.ville_id, dateRanges.previous.start, dateRanges.previous.end],
    queryFn: () => prospectsApi.getEcartDetails({
      segment_id: filters.segment_id,
      ville_id: filters.ville_id,
      date_from: dateRanges.previous.start,
      date_to: dateRanges.previous.end,
    }),
    enabled: open,
  });

  const isLoading = currentLoading || previousLoading;

  const current = currentStats?.stats || {
    total: 0,
    non_contactes: 0,
    avec_rdv: 0,
    sans_rdv: 0,
    inscrits_prospect: 0,
    inscrits_session: 0,
    inscrits_session_livree: 0,
    inscrits_session_non_livree: 0,
    taux_conversion: 0,
  };

  const previous = previousStats?.stats || {
    total: 0,
    non_contactes: 0,
    avec_rdv: 0,
    sans_rdv: 0,
    inscrits_prospect: 0,
    inscrits_session: 0,
    inscrits_session_livree: 0,
    inscrits_session_non_livree: 0,
    taux_conversion: 0,
  };

  // Données pour le graphique de comparaison
  const comparisonData = [
    { name: 'Total', actuel: current.total, precedent: previous.total },
    { name: 'Non contactés', actuel: current.non_contactes, precedent: previous.non_contactes },
    { name: 'Avec RDV', actuel: current.avec_rdv, precedent: previous.avec_rdv },
    { name: 'Sans RDV', actuel: current.sans_rdv, precedent: previous.sans_rdv },
  ];

  // Données pour le graphique des inscriptions
  const inscriptionData = [
    { name: 'Inscrit Prospect', actuel: current.inscrits_prospect, precedent: previous.inscrits_prospect },
    { name: 'Inscrit Session', actuel: current.inscrits_session, precedent: previous.inscrits_session },
  ];

  // Données pour le pie chart de distribution
  const distributionData = [
    { name: 'Non contactés', value: current.non_contactes, color: COLORS.orange },
    { name: 'Avec RDV', value: current.avec_rdv, color: COLORS.success },
    { name: 'Sans RDV', value: current.sans_rdv, color: COLORS.gray },
    { name: 'Inscrits', value: current.inscrits_prospect, color: COLORS.primary },
  ].filter(d => d.value > 0);

  const handlePreviousPeriod = () => {
    if (periodType === 'mensuel') {
      setSelectedDate(subMonths(selectedDate, 1));
    } else {
      setSelectedDate(subYears(selectedDate, 1));
    }
  };

  const handleNextPeriod = () => {
    if (periodType === 'mensuel') {
      setSelectedDate(subMonths(selectedDate, -1));
    } else {
      setSelectedDate(subYears(selectedDate, -1));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <BarChart3 className="h-6 w-6 text-orange-500" />
            Indicateurs des Prospects
          </DialogTitle>
        </DialogHeader>

        {/* Sélecteur de période */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-gradient-to-r from-orange-50 to-amber-50 rounded-xl border border-orange-200">
          {/* Toggle Mensuel/Annuel */}
          <div className="flex items-center gap-2 bg-white rounded-lg p-1 shadow-sm">
            <Button
              variant={periodType === 'mensuel' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPeriodType('mensuel')}
              className={periodType === 'mensuel' ? 'bg-orange-500 hover:bg-orange-600' : ''}
            >
              <CalendarDays className="h-4 w-4 mr-2" />
              Mensuel
            </Button>
            <Button
              variant={periodType === 'annuel' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPeriodType('annuel')}
              className={periodType === 'annuel' ? 'bg-orange-500 hover:bg-orange-600' : ''}
            >
              <CalendarRange className="h-4 w-4 mr-2" />
              Annuel
            </Button>
          </div>

          {/* Navigation période */}
          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={handlePreviousPeriod} className="rounded-full">
              ←
            </Button>
            <div className="min-w-[200px] text-center">
              <p className="font-bold text-gray-900 capitalize text-lg">{dateRanges.current.label}</p>
              <p className="text-xs text-gray-500">vs {dateRanges.previous.label}</p>
            </div>
            <Button variant="outline" size="icon" onClick={handleNextPeriod} className="rounded-full">
              →
            </Button>
          </div>

          {/* Bouton Aujourd'hui */}
          <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())} className="bg-white">
            <Clock className="h-4 w-4 mr-2" />
            Période actuelle
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
              <p className="text-gray-600">Chargement des indicateurs...</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Section 1: Cartes indicateurs */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-orange-500" />
                Vue d'ensemble
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                <IndicatorCard
                  title="Total Prospects"
                  currentValue={current.total}
                  previousValue={previous.total}
                  icon={<Users className="h-4 w-4" />}
                  color="blue"
                />
                <IndicatorCard
                  title="Non Contactés"
                  currentValue={current.non_contactes}
                  previousValue={previous.non_contactes}
                  icon={<Phone className="h-4 w-4" />}
                  color="orange"
                />
                <IndicatorCard
                  title="Avec RDV"
                  currentValue={current.avec_rdv}
                  previousValue={previous.avec_rdv}
                  icon={<Calendar className="h-4 w-4" />}
                  color="green"
                />
                <IndicatorCard
                  title="Sans RDV"
                  currentValue={current.sans_rdv}
                  previousValue={previous.sans_rdv}
                  icon={<Calendar className="h-4 w-4" />}
                  color="gray"
                />
                <IndicatorCard
                  title="Taux Conversion"
                  currentValue={current.taux_conversion || 0}
                  previousValue={previous.taux_conversion || 0}
                  icon={<Percent className="h-4 w-4" />}
                  color="purple"
                  suffix="%"
                  isPercentage
                />
                <IndicatorCard
                  title="Inscrit Prospect"
                  currentValue={current.inscrits_prospect}
                  previousValue={previous.inscrits_prospect}
                  icon={<UserCheck className="h-4 w-4" />}
                  color="cyan"
                />
                <IndicatorCard
                  title="Écart Session"
                  currentValue={currentEcart?.ecart_session?.count || 0}
                  previousValue={previousEcart?.ecart_session?.count || 0}
                  icon={<UserCheck className="h-4 w-4" />}
                  color="green"
                />
                <IndicatorCard
                  title="Écart Prospect"
                  currentValue={currentEcart?.ecart_prospect?.count || 0}
                  previousValue={previousEcart?.ecart_prospect?.count || 0}
                  icon={<UserX className="h-4 w-4" />}
                  color="red"
                />
              </div>
            </div>

            {/* Section 2: Graphiques */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Graphique de comparaison des volumes */}
              <Card className="shadow-lg border-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    Comparaison des Volumes
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={comparisonData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: 'none',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Bar dataKey="precedent" name={dateRanges.previous.label} fill="#94a3b8" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="actuel" name={dateRanges.current.label} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Pie Chart de distribution */}
              <Card className="shadow-lg border-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <PieChartIcon className="h-4 w-4 text-purple-500" />
                    Distribution des Prospects
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={distributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {distributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => value.toLocaleString('fr-FR')}
                        contentStyle={{
                          borderRadius: '8px',
                          border: 'none',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Graphique des inscriptions */}
              <Card className="shadow-lg border-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-green-500" />
                    Inscriptions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={inscriptionData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorActuel" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0.1}/>
                        </linearGradient>
                        <linearGradient id="colorPrecedent" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.8}/>
                          <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.1}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: '8px',
                          border: 'none',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                      />
                      <Area type="monotone" dataKey="precedent" name="Précédent" stroke="#94a3b8" fillOpacity={1} fill="url(#colorPrecedent)" />
                      <Area type="monotone" dataKey="actuel" name="Actuel" stroke="#22c55e" fillOpacity={1} fill="url(#colorActuel)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Graphique des sessions livrées */}
              <Card className="shadow-lg border-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Target className="h-4 w-4 text-cyan-500" />
                    Sessions Inscrites
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-around h-[200px]">
                    {/* Radial pour sessions livrées */}
                    <div className="text-center">
                      <ResponsiveContainer width={120} height={120}>
                        <RadialBarChart
                          cx="50%"
                          cy="50%"
                          innerRadius="60%"
                          outerRadius="100%"
                          data={[{ value: current.inscrits_session_livree || 0, fill: COLORS.success }]}
                          startAngle={90}
                          endAngle={-270}
                        >
                          <RadialBar dataKey="value" cornerRadius={10} />
                        </RadialBarChart>
                      </ResponsiveContainer>
                      <p className="text-2xl font-bold text-green-600">{current.inscrits_session_livree || 0}</p>
                      <p className="text-xs text-gray-500">Livrées</p>
                    </div>

                    {/* Total sessions */}
                    <div className="text-center px-4">
                      <p className="text-4xl font-bold text-gray-800">{current.inscrits_session || 0}</p>
                      <p className="text-sm text-gray-500">Total Sessions</p>
                    </div>

                    {/* Radial pour non livrées */}
                    <div className="text-center">
                      <ResponsiveContainer width={120} height={120}>
                        <RadialBarChart
                          cx="50%"
                          cy="50%"
                          innerRadius="60%"
                          outerRadius="100%"
                          data={[{ value: current.inscrits_session_non_livree || 0, fill: COLORS.danger }]}
                          startAngle={90}
                          endAngle={-270}
                        >
                          <RadialBar dataKey="value" cornerRadius={10} />
                        </RadialBarChart>
                      </ResponsiveContainer>
                      <p className="text-2xl font-bold text-red-600">{current.inscrits_session_non_livree || 0}</p>
                      <p className="text-xs text-gray-500">Non livrées</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Légende */}
            <div className="flex items-center justify-center gap-8 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                <span>Évolution positive</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span>Évolution négative</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                <span>Période précédente</span>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
