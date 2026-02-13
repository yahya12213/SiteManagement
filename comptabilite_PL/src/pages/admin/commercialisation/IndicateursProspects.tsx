// @ts-nocheck
/**
 * IndicateursProspects - Dashboard complet des indicateurs commerciaux
 * Utilise Apache ECharts pour des graphiques performants et interactifs
 */
import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import ReactECharts from 'echarts-for-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  BarChart3,
  Users,
  TrendingUp,
  TrendingDown,
  Target,
  Calendar,
  CalendarDays,
  CalendarRange,
  AlertTriangle,
  CheckCircle2,
  Lightbulb,
  RefreshCw,
  Download,
  Sparkles,
  ArrowLeft,
  Phone,
  UserCheck,
  UserX,
  Percent,
  Clock
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, subYears } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api/client';
import { prospectsApi } from '@/lib/api/prospects';

type PeriodType = 'mensuel' | 'annuel';

// Couleurs pour les statuts
const STATUS_COLORS = {
  'non contacté': '#f97316',
  'contacté avec rdv': '#22c55e',
  'contacté sans rdv': '#6b7280',
  'contacté sans reponse': '#94a3b8',
  'boîte vocale': '#a855f7',
  'non intéressé': '#ef4444',
  'déjà inscrit': '#06b6d4',
  'à recontacter': '#eab308',
  'inscrit': '#3b82f6',
  'inconnu': '#d1d5db'
};

// Composant KPI Card
function KPICard({
  title,
  value,
  suffix = '',
  trend,
  trendValue,
  icon,
  color = 'blue'
}: {
  title: string;
  value: number | string;
  suffix?: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  icon: React.ReactNode;
  color?: string;
}) {
  const colorClasses = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    purple: 'from-purple-500 to-purple-600',
    orange: 'from-orange-500 to-orange-600',
    cyan: 'from-cyan-500 to-cyan-600'
  };

  return (
    <Card className="overflow-hidden">
      <div className={`bg-gradient-to-r ${colorClasses[color] || colorClasses.blue} p-4`}>
        <div className="flex items-center justify-between">
          <div className="text-white">
            <p className="text-sm font-medium opacity-90">{title}</p>
            <p className="text-3xl font-bold mt-1">
              {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
              {suffix}
            </p>
          </div>
          <div className="bg-white/20 p-3 rounded-xl">
            {icon}
          </div>
        </div>
        {trendValue && (
          <div className="flex items-center gap-1 mt-2 text-white/90 text-sm">
            {trend === 'up' ? (
              <TrendingUp className="h-4 w-4 text-green-300" />
            ) : trend === 'down' ? (
              <TrendingDown className="h-4 w-4 text-red-300" />
            ) : (
              <span className="h-4 w-4 text-center">≈</span>
            )}
            <span>{trendValue}</span>
          </div>
        )}
      </div>
    </Card>
  );
}

// Composant Recommandation
function RecommendationCard({ rec }: { rec: any }) {
  const priorityConfig = {
    urgent: { color: 'bg-red-100 border-red-300 text-red-800', icon: <AlertTriangle className="h-5 w-5 text-red-500" />, badge: 'destructive' },
    high: { color: 'bg-orange-100 border-orange-300 text-orange-800', icon: <AlertTriangle className="h-5 w-5 text-orange-500" />, badge: 'warning' },
    medium: { color: 'bg-yellow-100 border-yellow-300 text-yellow-800', icon: <Lightbulb className="h-5 w-5 text-yellow-600" />, badge: 'secondary' },
    success: { color: 'bg-green-100 border-green-300 text-green-800', icon: <CheckCircle2 className="h-5 w-5 text-green-500" />, badge: 'success' }
  };

  const config = priorityConfig[rec.priority] || priorityConfig.medium;

  return (
    <div className={`${config.color} border rounded-lg p-4`}>
      <div className="flex items-start gap-3">
        {config.icon}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold">{rec.title}</h4>
            <Badge variant={config.badge as any} className="text-xs">
              {rec.priority.toUpperCase()}
            </Badge>
          </div>
          <p className="text-sm mb-2">{rec.description}</p>
          <div className="text-xs space-y-1 opacity-80">
            <p><strong>Contexte:</strong> {rec.context}</p>
            <p><strong>Impact attendu:</strong> {rec.expectedImpact}</p>
            <p><strong>Responsable:</strong> {rec.responsable} | <strong>Délai:</strong> {rec.timeframe}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IndicateursProspects() {
  const navigate = useNavigate();
  const [periodType, setPeriodType] = useState<PeriodType>('mensuel');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filters, setFilters] = useState({ segment_id: '', ville_id: '' });

  // Calcul des dates
  const dateRanges = useMemo(() => {
    if (periodType === 'mensuel') {
      return {
        current: {
          start: format(startOfMonth(selectedDate), 'yyyy-MM-dd'),
          end: format(endOfMonth(selectedDate), 'yyyy-MM-dd'),
          label: format(selectedDate, 'MMMM yyyy', { locale: fr })
        },
        previous: {
          start: format(startOfMonth(subMonths(selectedDate, 1)), 'yyyy-MM-dd'),
          end: format(endOfMonth(subMonths(selectedDate, 1)), 'yyyy-MM-dd'),
          label: format(subMonths(selectedDate, 1), 'MMMM yyyy', { locale: fr })
        }
      };
    } else {
      return {
        current: {
          start: format(startOfYear(selectedDate), 'yyyy-MM-dd'),
          end: format(endOfYear(selectedDate), 'yyyy-MM-dd'),
          label: format(selectedDate, 'yyyy')
        },
        previous: {
          start: format(startOfYear(subYears(selectedDate, 1)), 'yyyy-MM-dd'),
          end: format(endOfYear(subYears(selectedDate, 1)), 'yyyy-MM-dd'),
          label: format(subYears(selectedDate, 1), 'yyyy')
        }
      };
    }
  }, [periodType, selectedDate]);

  // Fetch stats using existing API (like IndicateursModal)
  const { data: currentData, isLoading, refetch } = useQuery({
    queryKey: ['prospects-dashboard', filters, dateRanges.current],
    queryFn: async () => {
      return prospectsApi.getAll({
        segment_id: filters.segment_id || undefined,
        ville_id: filters.ville_id || undefined,
        date_from: dateRanges.current.start,
        date_to: dateRanges.current.end,
        page: 1,
        limit: 1 // Just get stats, not all prospects
      });
    }
  });

  // Fetch previous period for comparison
  const { data: prevData } = useQuery({
    queryKey: ['prospects-dashboard-prev', filters, dateRanges.previous],
    queryFn: async () => {
      return prospectsApi.getAll({
        segment_id: filters.segment_id || undefined,
        ville_id: filters.ville_id || undefined,
        date_from: dateRanges.previous.start,
        date_to: dateRanges.previous.end,
        page: 1,
        limit: 1
      });
    }
  });

  // Fetch écart details (current period)
  const { data: currentEcart } = useQuery({
    queryKey: ['prospects-ecart-current', filters, dateRanges.current],
    queryFn: () => prospectsApi.getEcartDetails({
      segment_id: filters.segment_id || undefined,
      ville_id: filters.ville_id || undefined,
      date_from: dateRanges.current.start,
      date_to: dateRanges.current.end,
    })
  });

  // Fetch écart details (previous period)
  const { data: prevEcart } = useQuery({
    queryKey: ['prospects-ecart-prev', filters, dateRanges.previous],
    queryFn: () => prospectsApi.getEcartDetails({
      segment_id: filters.segment_id || undefined,
      ville_id: filters.ville_id || undefined,
      date_from: dateRanges.previous.start,
      date_to: dateRanges.previous.end,
    })
  });

  // Use stats from API response (like IndicateursModal)
  const current = currentData?.stats || {
    total: 0,
    non_contactes: 0,
    avec_rdv: 0,
    sans_rdv: 0,
    inscrits_prospect: 0,
    inscrits_session: 0,
    taux_conversion: 0,
  };

  const previous = prevData?.stats || {
    total: 0,
    non_contactes: 0,
    avec_rdv: 0,
    sans_rdv: 0,
    inscrits_prospect: 0,
    inscrits_session: 0,
    taux_conversion: 0,
  };

  // Transform to dashboard stats format using API stats
  const stats = useMemo(() => {
    if (!currentData?.stats) return null;

    const total = current.total;
    const nonContactes = current.non_contactes;
    const avecRdv = current.avec_rdv;
    const sansRdv = current.sans_rdv;
    const inscritsProspect = current.inscrits_prospect;
    const inscritsSession = current.inscrits_session;
    const contactes = total - nonContactes;

    // Distribution par statut (pour pie chart)
    const by_status: Record<string, number> = {
      'non contacté': nonContactes,
      'contacté avec rdv': avecRdv,
      'contacté sans rdv': sansRdv,
      'inscrit': inscritsProspect,
    };

    // Autres statuts = total - somme des statuts connus
    const autresStatuts = total - nonContactes - avecRdv - sansRdv - inscritsProspect;
    if (autresStatuts > 0) {
      by_status['autres'] = autresStatuts;
    }

    // Calculate rates
    const contact_rate = total > 0 ? Math.round((contactes / total) * 100 * 10) / 10 : 0;
    const rdv_rate = contactes > 0 ? Math.round((avecRdv / contactes) * 100 * 10) / 10 : 0;
    const show_up_rate = avecRdv > 0 ? Math.round((inscritsSession / avecRdv) * 100 * 10) / 10 : 0;
    const conversion_rate_global = total > 0 ? Math.round((inscritsProspect / total) * 100 * 10) / 10 : 0;
    const conversion_rate_calls = current.taux_conversion || 0;

    const rates = {
      contact_rate,
      rdv_rate,
      show_up_rate,
      conversion_rate_calls,
      conversion_rate_global
    };

    // Funnel data
    const funnel = [
      { stage: 'Total Prospects', count: total, color: '#3b82f6' },
      { stage: 'Contactés', count: contactes, color: '#8b5cf6' },
      { stage: 'Avec RDV', count: avecRdv, color: '#22c55e' },
      { stage: 'Inscrits Session', count: inscritsSession, color: '#06b6d4' }
    ];

    // Generate algorithmic recommendations
    const recommendations: any[] = [];

    if (contact_rate < 80) {
      recommendations.push({
        priority: contact_rate < 50 ? 'urgent' : 'high',
        title: 'Augmenter le taux de contact',
        description: `${nonContactes} prospects n'ont pas encore été contactés`,
        context: `Taux de contact actuel: ${contact_rate}% (objectif: 80%)`,
        expectedImpact: `+${Math.round(nonContactes * 0.1)} inscriptions potentielles`,
        responsable: 'Équipe commerciale',
        timeframe: 'Cette semaine'
      });
    }

    if (rdv_rate < 25 && contactes > 0) {
      recommendations.push({
        priority: 'high',
        title: 'Améliorer le taux de RDV',
        description: 'Le taux de conversion en RDV est inférieur à l\'objectif',
        context: `Taux de RDV actuel: ${rdv_rate}% (objectif: 25%)`,
        expectedImpact: 'Améliorer l\'argumentaire téléphonique',
        responsable: 'Responsable commercial',
        timeframe: 'Formation cette semaine'
      });
    }

    if (show_up_rate < 60 && avecRdv > 0) {
      recommendations.push({
        priority: 'medium',
        title: 'Améliorer le taux de présence',
        description: 'Trop de prospects avec RDV ne se présentent pas',
        context: `Taux de show-up actuel: ${show_up_rate}% (objectif: 60%)`,
        expectedImpact: `+${Math.round((avecRdv * 0.6 - inscritsSession) * 0.5)} inscriptions potentielles`,
        responsable: 'Assistantes',
        timeframe: 'Rappels J-1'
      });
    }

    if (recommendations.length === 0 && total > 0) {
      recommendations.push({
        priority: 'success',
        title: 'Performance satisfaisante',
        description: 'Les indicateurs sont dans les objectifs',
        context: `Contact: ${contact_rate}%, RDV: ${rdv_rate}%, Show-up: ${show_up_rate}%`,
        expectedImpact: 'Maintenir les efforts',
        responsable: 'Toute l\'équipe',
        timeframe: 'Continu'
      });
    }

    // Global assessment
    let status = 'bon';
    if (contact_rate < 50 || (inscritsSession === 0 && total > 10)) status = 'critique';
    else if (contact_rate < 70 || rdv_rate < 15) status = 'attention';
    else if (contact_rate >= 90 && rdv_rate >= 30 && show_up_rate >= 70) status = 'excellent';

    const globalAssessment = {
      status,
      summary: status === 'excellent'
        ? 'Excellente performance commerciale ce mois-ci'
        : status === 'critique'
        ? 'Situation critique nécessitant une action immédiate'
        : status === 'attention'
        ? 'Performance en dessous des objectifs, ajustements nécessaires'
        : 'Performance correcte, quelques axes d\'amélioration',
      topPriority: recommendations[0]?.title || 'Maintenir la performance',
      projection: `${inscritsSession} inscrits session actuellement`,
      risk: status === 'critique' ? 'Élevé' : status === 'attention' ? 'Modéré' : 'Faible'
    };

    return {
      total,
      by_status,
      rates,
      funnel,
      recommendations,
      globalAssessment,
      inscrits_session: currentData.stats?.inscrits_session || 0
    };
  }, [currentData]);

  // Previous period stats for trends (use API stats)
  const prevStats = useMemo(() => {
    if (!prevData?.stats) return null;
    return {
      total: previous.total,
      inscrits_prospect: previous.inscrits_prospect,
      inscrits_session: previous.inscrits_session,
      by_status: {
        'non contacté': previous.non_contactes,
        'contacté avec rdv': previous.avec_rdv,
        'contacté sans rdv': previous.sans_rdv,
        'inscrit': previous.inscrits_prospect,
      }
    };
  }, [prevData, previous]);

  // Calculate previous period rates for trend comparison
  const prevRates = useMemo(() => {
    const prevContactes = previous.total - previous.non_contactes;
    const prev_contact_rate = previous.total > 0
      ? Math.round((prevContactes / previous.total) * 100 * 10) / 10
      : 0;
    const prev_rdv_rate = prevContactes > 0
      ? Math.round((previous.avec_rdv / prevContactes) * 100 * 10) / 10
      : 0;
    const prev_show_up_rate = previous.avec_rdv > 0
      ? Math.round((previous.inscrits_session / previous.avec_rdv) * 100 * 10) / 10
      : 0;
    return { prev_contact_rate, prev_rdv_rate, prev_show_up_rate };
  }, [previous]);

  // Fetch segments and villes
  const { data: segments } = useQuery({
    queryKey: ['segments'],
    queryFn: () => apiClient.get('/referentiels/segments').then(r => r.data)
  });

  const { data: villes } = useQuery({
    queryKey: ['villes'],
    queryFn: () => apiClient.get('/referentiels/cities').then(r => r.data)
  });

  // Check AI status
  const { data: aiStatus } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => apiClient.get('/ai-settings/status').then(r => r.data)
  });

  // AI Analysis mutation
  const aiMutation = useMutation({
    mutationFn: async () => {
      const indicators = {
        current: {
          total: current.total,
          non_contactes: current.non_contactes,
          avec_rdv: current.avec_rdv,
          sans_rdv: current.sans_rdv,
          inscrits_prospect: current.inscrits_prospect,
          inscrits_session: current.inscrits_session,
          taux_conversion: current.taux_conversion || 0
        },
        previous: prevStats ? {
          total: previous.total,
          inscrits_prospect: previous.inscrits_prospect
        } : null,
        ecart: currentEcart || null
      };
      const res = await apiClient.post('/ai-settings/analyze', { indicators, filters });
      return res.data;
    }
  });

  // ECharts options for Pie Chart (Distribution)
  const pieChartOption = useMemo(() => {
    if (!stats?.by_status) return {};

    const data = Object.entries(stats.by_status).map(([name, value]) => ({
      name,
      value,
      itemStyle: { color: STATUS_COLORS[name] || '#d1d5db' }
    }));

    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        right: 10,
        top: 'center',
        type: 'scroll'
      },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['35%', '50%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 8,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: false
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 14,
            fontWeight: 'bold'
          },
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        },
        data
      }]
    };
  }, [stats?.by_status]);

  // ECharts options for Funnel
  const funnelChartOption = useMemo(() => {
    if (!stats?.funnel) return {};

    return {
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c}'
      },
      series: [{
        type: 'funnel',
        left: '10%',
        width: '80%',
        sort: 'none',
        gap: 2,
        label: {
          show: true,
          position: 'inside',
          formatter: '{b}\n{c}',
          fontSize: 12
        },
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 1
        },
        emphasis: {
          label: {
            fontSize: 14
          }
        },
        data: stats.funnel.map(item => ({
          name: item.stage,
          value: item.count,
          itemStyle: { color: item.color }
        }))
      }]
    };
  }, [stats?.funnel]);

  // ECharts options for Rates Bar Chart
  const ratesChartOption = useMemo(() => {
    if (!stats?.rates) return {};

    const targets = {
      contact_rate: 80,
      rdv_rate: 25,
      show_up_rate: 60,
      conversion_rate_calls: 20,
      conversion_rate_global: 5
    };

    const labels = {
      contact_rate: 'Taux Contact',
      rdv_rate: 'Taux RDV',
      show_up_rate: 'Show-up',
      conversion_rate_calls: 'Conv. Appels',
      conversion_rate_global: 'Conv. Global'
    };

    const data = Object.entries(stats.rates).map(([key, value]) => ({
      name: labels[key] || key,
      value,
      target: targets[key] || 50
    }));

    return {
      tooltip: {
        trigger: 'axis',
        formatter: (params) => {
          const item = params[0];
          const target = data.find(d => d.name === item.name)?.target || 0;
          return `${item.name}<br/>Actuel: ${item.value}%<br/>Cible: ${target}%`;
        }
      },
      xAxis: {
        type: 'category',
        data: data.map(d => d.name),
        axisLabel: { fontSize: 11, rotate: 15 }
      },
      yAxis: {
        type: 'value',
        max: 100,
        axisLabel: { formatter: '{value}%' }
      },
      series: [
        {
          name: 'Actuel',
          type: 'bar',
          data: data.map(d => ({
            value: d.value,
            itemStyle: {
              color: d.value >= d.target ? '#22c55e' : d.value >= d.target * 0.7 ? '#f59e0b' : '#ef4444'
            }
          })),
          barWidth: '50%',
          label: {
            show: true,
            position: 'top',
            formatter: '{c}%',
            fontSize: 11
          }
        },
        {
          name: 'Cible',
          type: 'line',
          data: data.map(d => d.target),
          lineStyle: { type: 'dashed', color: '#94a3b8' },
          symbol: 'circle',
          symbolSize: 8
        }
      ]
    };
  }, [stats?.rates]);

  // Navigation handlers
  const handlePreviousPeriod = () => {
    setSelectedDate(periodType === 'mensuel' ? subMonths(selectedDate, 1) : subYears(selectedDate, 1));
  };

  const handleNextPeriod = () => {
    setSelectedDate(periodType === 'mensuel' ? subMonths(selectedDate, -1) : subYears(selectedDate, -1));
  };

  // Calculate trends - always show something even when previous is 0
  const getTrend = (currentVal: number, previousVal: number) => {
    if (previousVal === 0 && currentVal === 0) {
      return { trend: 'stable' as const, value: `= vs ${dateRanges.previous.label}` };
    }
    if (previousVal === 0) {
      return { trend: 'up' as const, value: `+${currentVal} vs ${dateRanges.previous.label}` };
    }
    const change = ((currentVal - previousVal) / previousVal) * 100;
    return {
      trend: change > 0 ? 'up' as const : change < 0 ? 'down' as const : 'stable' as const,
      value: `${change >= 0 ? '+' : ''}${change.toFixed(1)}% vs ${dateRanges.previous.label}`
    };
  };

  const totalTrend = getTrend(current.total, previous.total);
  const inscritsTrend = getTrend(current.inscrits_prospect, previous.inscrits_prospect);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="h-7 w-7 text-orange-500" />
              Dashboard Indicateurs Commerciaux
            </h1>
            <p className="text-gray-500">Analyse complète de la performance commerciale</p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl shadow-sm">
          {/* Period Toggle */}
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
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

          {/* Period Navigation */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handlePreviousPeriod}>←</Button>
            <div className="min-w-[180px] text-center">
              <p className="font-bold text-gray-900 capitalize">{dateRanges.current.label}</p>
              <p className="text-xs text-gray-500">vs {dateRanges.previous.label}</p>
            </div>
            <Button variant="outline" size="icon" onClick={handleNextPeriod}>→</Button>
          </div>

          {/* Filters */}
          <Select value={filters.segment_id || 'all'} onValueChange={v => setFilters({ ...filters, segment_id: v === 'all' ? '' : v })}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tous les segments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les segments</SelectItem>
              {segments?.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filters.ville_id || 'all'} onValueChange={v => setFilters({ ...filters, ville_id: v === 'all' ? '' : v })}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Toutes les villes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les villes</SelectItem>
              {villes?.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement des indicateurs...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* KPI Cards - Matching IndicateursModal */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
            <KPICard
              title="Total Prospects"
              value={current.total}
              icon={<Users className="h-6 w-6 text-white" />}
              color="blue"
              trend={totalTrend.trend}
              trendValue={totalTrend.value}
            />
            <KPICard
              title="Non Contactés"
              value={current.non_contactes}
              icon={<Phone className="h-6 w-6 text-white" />}
              color="orange"
              trend={getTrend(current.non_contactes, previous.non_contactes).trend}
              trendValue={getTrend(current.non_contactes, previous.non_contactes).value}
            />
            <KPICard
              title="Avec RDV"
              value={current.avec_rdv}
              icon={<Calendar className="h-6 w-6 text-white" />}
              color="green"
              trend={getTrend(current.avec_rdv, previous.avec_rdv).trend}
              trendValue={getTrend(current.avec_rdv, previous.avec_rdv).value}
            />
            <KPICard
              title="Sans RDV"
              value={current.sans_rdv}
              icon={<Calendar className="h-6 w-6 text-white" />}
              color="purple"
              trend={getTrend(current.sans_rdv, previous.sans_rdv).trend}
              trendValue={getTrend(current.sans_rdv, previous.sans_rdv).value}
            />
          </div>

          {/* Second row of KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
            <KPICard
              title="Taux Conversion"
              value={current.taux_conversion?.toFixed(1) || '0'}
              suffix="%"
              icon={<Percent className="h-6 w-6 text-white" />}
              color="purple"
              trend={getTrend(current.taux_conversion || 0, previous.taux_conversion || 0).trend}
              trendValue={getTrend(current.taux_conversion || 0, previous.taux_conversion || 0).value}
            />
            <KPICard
              title="Inscrit Prospect"
              value={current.inscrits_prospect}
              icon={<UserCheck className="h-6 w-6 text-white" />}
              color="cyan"
              trend={inscritsTrend.trend}
              trendValue={inscritsTrend.value}
            />
            <KPICard
              title="Écart Session"
              value={currentEcart?.ecart_session?.count || 0}
              icon={<UserCheck className="h-6 w-6 text-white" />}
              color="green"
              trend={getTrend(currentEcart?.ecart_session?.count || 0, prevEcart?.ecart_session?.count || 0).trend}
              trendValue={getTrend(currentEcart?.ecart_session?.count || 0, prevEcart?.ecart_session?.count || 0).value}
            />
            <KPICard
              title="Écart Prospect"
              value={currentEcart?.ecart_prospect?.count || 0}
              icon={<UserX className="h-6 w-6 text-white" />}
              color="orange"
              trend={getTrend(currentEcart?.ecart_prospect?.count || 0, prevEcart?.ecart_prospect?.count || 0).trend}
              trendValue={getTrend(currentEcart?.ecart_prospect?.count || 0, prevEcart?.ecart_prospect?.count || 0).value}
            />
          </div>

          {/* Third row - Sessions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KPICard
              title="Inscrits Session"
              value={current.inscrits_session}
              icon={<Target className="h-6 w-6 text-white" />}
              color="blue"
              trend={getTrend(current.inscrits_session, previous.inscrits_session).trend}
              trendValue={getTrend(current.inscrits_session, previous.inscrits_session).value}
            />
            <KPICard
              title="Taux de Contact"
              value={stats?.rates?.contact_rate || 0}
              suffix="%"
              icon={<Phone className="h-6 w-6 text-white" />}
              color="purple"
              trend={getTrend(stats?.rates?.contact_rate || 0, prevRates.prev_contact_rate).trend}
              trendValue={getTrend(stats?.rates?.contact_rate || 0, prevRates.prev_contact_rate).value}
            />
            <KPICard
              title="Taux Show-up"
              value={stats?.rates?.show_up_rate || 0}
              suffix="%"
              icon={<Target className="h-6 w-6 text-white" />}
              color="green"
              trend={getTrend(stats?.rates?.show_up_rate || 0, prevRates.prev_show_up_rate).trend}
              trendValue={getTrend(stats?.rates?.show_up_rate || 0, prevRates.prev_show_up_rate).value}
            />
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Distribution Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                  Distribution par Statut
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ReactECharts option={pieChartOption} style={{ height: 350 }} />
              </CardContent>
            </Card>

            {/* Funnel Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  Pipeline Commercial
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ReactECharts option={funnelChartOption} style={{ height: 350 }} />
              </CardContent>
            </Card>
          </div>

          {/* Rates Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                Performance vs Objectifs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ReactECharts option={ratesChartOption} style={{ height: 300 }} />
            </CardContent>
          </Card>

          {/* Recommendations Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Target className="h-5 w-5 text-orange-500" />
                  Recommandations
                  {aiStatus?.configured && aiStatus?.enabled && (
                    <Badge variant="secondary" className="ml-2">
                      <Sparkles className="h-3 w-3 mr-1" />
                      IA Disponible
                    </Badge>
                  )}
                </CardTitle>
                {aiStatus?.configured && aiStatus?.enabled && (
                  <Button
                    size="sm"
                    onClick={() => aiMutation.mutate()}
                    disabled={aiMutation.isPending}
                  >
                    {aiMutation.isPending ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Analyse IA...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Analyse IA
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* Global Assessment */}
              {stats?.globalAssessment && (
                <div className={`mb-6 p-4 rounded-lg border-2 ${
                  stats.globalAssessment.status === 'critique' ? 'bg-red-50 border-red-300' :
                  stats.globalAssessment.status === 'attention' ? 'bg-yellow-50 border-yellow-300' :
                  stats.globalAssessment.status === 'excellent' ? 'bg-green-50 border-green-300' :
                  'bg-blue-50 border-blue-300'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant={
                      stats.globalAssessment.status === 'critique' ? 'destructive' :
                      stats.globalAssessment.status === 'attention' ? 'warning' :
                      stats.globalAssessment.status === 'excellent' ? 'success' :
                      'default'
                    }>
                      {stats.globalAssessment.status.toUpperCase()}
                    </Badge>
                    <span className="font-semibold">Synthèse Globale</span>
                  </div>
                  <p className="text-sm mb-2">{stats.globalAssessment.summary}</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <strong>Priorité #1:</strong> {stats.globalAssessment.topPriority}
                    </div>
                    <div>
                      <strong>Projection:</strong> {stats.globalAssessment.projection}
                    </div>
                    <div>
                      <strong>Risque:</strong> {stats.globalAssessment.risk}
                    </div>
                  </div>
                </div>
              )}

              {/* AI Analysis Result */}
              {aiMutation.isSuccess && aiMutation.data?.analysis && (
                <div className="mb-6 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="h-5 w-5 text-purple-500" />
                    <span className="font-semibold text-purple-800">Analyse IA ({aiMutation.data.provider})</span>
                  </div>
                  <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                    {aiMutation.data.analysis}
                  </div>
                </div>
              )}

              {/* Recommendations List */}
              <div className="space-y-4">
                {stats?.recommendations?.map((rec, index) => (
                  <RecommendationCard key={index} rec={rec} />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
