// @ts-nocheck
/**
 * AnalyseIntelligenteModal - Analyse intelligente avec IA réelle
 * Vérifie si l'IA est configurée et utilise l'API AI pour l'analyse
 */
import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Target,
  Lightbulb,
  ArrowRight,
  Zap,
  Clock,
  Users,
  Phone,
  Calendar,
  UserCheck,
  Activity,
  BarChart3,
  Shield,
  Flame,
  Award,
  AlertCircle,
  ThumbsUp,
  ThumbsDown,
  RefreshCw,
  Settings,
  Sparkles,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { prospectsApi } from '@/lib/api/prospects';
import { apiClient } from '@/lib/api/client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
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
  RadialBarChart,
  RadialBar,
} from 'recharts';

interface Props {
  open: boolean;
  onClose: () => void;
  filters?: {
    segment_id?: string;
    ville_id?: string;
  };
}

type RecommendationType = 'urgent' | 'important' | 'suggestion' | 'success';

interface Recommendation {
  type: RecommendationType;
  title: string;
  description: string;
  action: string;
  metric?: string;
  impact: 'high' | 'medium' | 'low';
}

interface HealthScore {
  score: number;
  label: string;
  color: string;
  icon: React.ReactNode;
}

interface AIStatus {
  configured: boolean;
  provider: string | null;
  enabled: boolean;
}

interface AIAnalysisResult {
  success: boolean;
  analysis: string;
  provider?: string;
  model?: string;
}

// Couleurs pour les graphiques
const COLORS = ['#6366f1', '#22c55e', '#f97316', '#ef4444', '#8b5cf6', '#06b6d4'];

// Fonction pour calculer le score de santé global (fallback)
function calculateHealthScore(current: any, previous: any, ecart: any): HealthScore {
  let score = 50;

  if (current.total > previous.total) score += 10;
  if (current.avec_rdv > previous.avec_rdv) score += 15;
  if (current.inscrits_prospect > previous.inscrits_prospect) score += 20;
  if (current.taux_conversion > previous.taux_conversion) score += 15;

  if (current.non_contactes > current.total * 0.5) score -= 15;
  if (current.sans_rdv > current.avec_rdv) score -= 10;
  if (ecart?.ecart_prospect?.count > 5) score -= 10;

  score = Math.max(0, Math.min(100, score));

  if (score >= 80) {
    return { score, label: 'Excellent', color: 'text-green-600', icon: <Award className="h-6 w-6 text-green-500" /> };
  } else if (score >= 60) {
    return { score, label: 'Bon', color: 'text-blue-600', icon: <ThumbsUp className="h-6 w-6 text-blue-500" /> };
  } else if (score >= 40) {
    return { score, label: 'À améliorer', color: 'text-orange-600', icon: <AlertCircle className="h-6 w-6 text-orange-500" /> };
  } else {
    return { score, label: 'Critique', color: 'text-red-600', icon: <AlertTriangle className="h-6 w-6 text-red-500" /> };
  }
}

// Fonction pour générer les recommandations (fallback)
function generateRecommendations(current: any, previous: any, ecart: any): Recommendation[] {
  const recommendations: Recommendation[] = [];

  const nonContactesRatio = current.total > 0 ? (current.non_contactes / current.total) * 100 : 0;
  if (nonContactesRatio > 50) {
    recommendations.push({
      type: 'urgent',
      title: 'Taux de non-contactés critique',
      description: `${nonContactesRatio.toFixed(0)}% de vos prospects n'ont pas été contactés.`,
      action: 'Planifier une campagne d\'appels intensive cette semaine',
      metric: `${current.non_contactes} prospects à contacter`,
      impact: 'high'
    });
  } else if (nonContactesRatio > 30) {
    recommendations.push({
      type: 'important',
      title: 'Non-contactés à surveiller',
      description: `${nonContactesRatio.toFixed(0)}% de prospects non contactés.`,
      action: 'Allouer 2h/jour aux appels de prospection',
      metric: `${current.non_contactes} en attente`,
      impact: 'medium'
    });
  }

  const rdvRatio = current.total > 0 ? (current.avec_rdv / current.total) * 100 : 0;
  if (rdvRatio < 10 && current.total > 20) {
    recommendations.push({
      type: 'urgent',
      title: 'Taux de RDV très faible',
      description: `Seulement ${rdvRatio.toFixed(0)}% de RDV pris.`,
      action: 'Revoir le script d\'appel et les arguments commerciaux',
      metric: `Objectif: atteindre 20% de RDV`,
      impact: 'high'
    });
  }

  if (ecart?.ecart_prospect?.count > 5) {
    recommendations.push({
      type: 'important',
      title: 'Écart prospect significatif',
      description: `${ecart.ecart_prospect.count} prospects marqués "inscrit" mais sans session.`,
      action: 'Vérifier et régulariser les inscriptions en attente',
      metric: `${ecart.ecart_prospect.count} à régulariser`,
      impact: 'medium'
    });
  }

  if (current.inscrits_prospect > previous.inscrits_prospect * 1.2 && previous.inscrits_prospect > 0) {
    const increase = ((current.inscrits_prospect - previous.inscrits_prospect) / previous.inscrits_prospect * 100).toFixed(0);
    recommendations.push({
      type: 'success',
      title: 'Forte croissance des inscriptions',
      description: `+${increase}% d'inscriptions ce mois!`,
      action: 'Féliciter l\'équipe et maintenir la dynamique',
      metric: `${current.inscrits_prospect} inscrits`,
      impact: 'high'
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: 'suggestion',
      title: 'Objectif du mois prochain',
      description: 'Les indicateurs sont stables.',
      action: `Viser ${Math.ceil(current.inscrits_prospect * 1.15)} inscriptions (+15%)`,
      metric: `Actuel: ${current.inscrits_prospect}`,
      impact: 'medium'
    });
  }

  return recommendations;
}

// Composant pour afficher une recommandation
function RecommendationCard({ rec }: { rec: Recommendation }) {
  const typeStyles = {
    urgent: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: <AlertTriangle className="h-5 w-5 text-red-500" />,
      badge: 'bg-red-100 text-red-700',
      badgeText: 'Urgent'
    },
    important: {
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      icon: <AlertCircle className="h-5 w-5 text-orange-500" />,
      badge: 'bg-orange-100 text-orange-700',
      badgeText: 'Important'
    },
    suggestion: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: <Lightbulb className="h-5 w-5 text-blue-500" />,
      badge: 'bg-blue-100 text-blue-700',
      badgeText: 'Suggestion'
    },
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      icon: <CheckCircle2 className="h-5 w-5 text-green-500" />,
      badge: 'bg-green-100 text-green-700',
      badgeText: 'Succès'
    }
  };

  const style = typeStyles[rec.type] || typeStyles.suggestion;

  return (
    <Card className={`${style.bg} ${style.border} border-2`}>
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{style.icon}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-semibold text-gray-900">{rec.title}</h4>
              <span className={`text-xs px-2 py-0.5 rounded-full ${style.badge}`}>
                {style.badgeText}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-2">{rec.description}</p>
            {rec.metric && (
              <p className="text-xs text-gray-500 mb-2 font-mono bg-white/50 inline-block px-2 py-1 rounded">
                {rec.metric}
              </p>
            )}
            <div className="flex items-center gap-2 text-sm font-medium text-gray-800 mt-2 p-2 bg-white/60 rounded-lg">
              <Zap className="h-4 w-4 text-amber-500" />
              <span>Action: {rec.action}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Composant Score de santé
function HealthScoreDisplay({ health }: { health: HealthScore }) {
  return (
    <Card className="bg-gradient-to-br from-gray-900 to-gray-800 text-white border-0">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-sm mb-1">Score de Santé Global</p>
            <div className="flex items-center gap-3">
              <span className="text-5xl font-bold">{health.score}</span>
              <span className="text-2xl text-gray-400">/100</span>
            </div>
            <p className={`text-lg font-semibold mt-1 ${health.color.replace('text-', 'text-')}`}>
              {health.label}
            </p>
          </div>
          <div className="relative">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke="#374151"
                strokeWidth="8"
                fill="none"
              />
              <circle
                cx="48"
                cy="48"
                r="40"
                stroke={health.score >= 80 ? '#22c55e' : health.score >= 60 ? '#3b82f6' : health.score >= 40 ? '#f97316' : '#ef4444'}
                strokeWidth="8"
                fill="none"
                strokeDasharray={`${health.score * 2.51} 251`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              {health.icon}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Composant KPI rapide
function QuickKPI({ label, value, trend, icon, color }: { label: string; value: string | number; trend?: number; icon: React.ReactNode; color: string }) {
  return (
    <div className={`p-4 rounded-xl ${color} border`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-600 text-sm">{label}</span>
        {icon}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {trend !== undefined && trend !== 0 && (
          <span className={`text-sm flex items-center ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
            {trend > 0 ? '+' : ''}{trend.toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}

// Composant pour afficher quand l'IA n'est pas configurée
function AINotConfigured({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="p-4 bg-purple-100 rounded-full mb-4">
        <Brain className="h-12 w-12 text-purple-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">IA non configurée</h3>
      <p className="text-gray-500 max-w-md mb-6">
        L'analyse intelligente par IA n'est pas encore activée.
        {isAdmin
          ? " En tant qu'administrateur, vous pouvez configurer l'IA pour obtenir des analyses personnalisées."
          : " Contactez votre administrateur pour activer cette fonctionnalité."}
      </p>
      {isAdmin && (
        <Link to="/admin/ai-settings">
          <Button className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700">
            <Settings className="h-4 w-4 mr-2" />
            Configurer l'IA
            <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
        </Link>
      )}
    </div>
  );
}

// Composant pour afficher l'analyse IA
function AIAnalysisDisplay({ analysis, provider }: { analysis: string; provider?: string }) {
  // Parser le contenu pour extraire les sections JSON
  const parseAnalysis = (text: string) => {
    let diagnostic = '';
    let kpisData = null;
    let recommendationsData = null;
    let alerts = '';

    try {
      // Extraire le diagnostic (texte avant le premier bloc JSON)
      const diagnosticMatch = text.match(/\*\*DIAGNOSTIC\*\*[\s\S]*?(?=\*\*|```|$)/i);
      if (diagnosticMatch) {
        diagnostic = diagnosticMatch[0].replace('**DIAGNOSTIC**', '').trim();
      }

      // Extraire les KPIs JSON
      const kpisMatch = text.match(/```json\s*\{[\s\S]*?"healthScore"[\s\S]*?\}\s*```/i);
      if (kpisMatch) {
        const jsonStr = kpisMatch[0].replace(/```json\s*/, '').replace(/\s*```/, '');
        kpisData = JSON.parse(jsonStr);
      }

      // Extraire les recommandations JSON
      const recsMatch = text.match(/```json\s*\{[\s\S]*?"recommendations"[\s\S]*?\}\s*```/i);
      if (recsMatch) {
        const jsonStr = recsMatch[0].replace(/```json\s*/, '').replace(/\s*```/, '');
        recommendationsData = JSON.parse(jsonStr);
      }

      // Extraire les alertes
      const alertsMatch = text.match(/\*\*ALERTES\*\*[\s\S]*?(?=\*\*|$)/i);
      if (alertsMatch) {
        alerts = alertsMatch[0].replace('**ALERTES**', '').trim();
      }
    } catch (e) {
      console.error('Error parsing AI response:', e);
    }

    return { diagnostic, kpisData, recommendationsData, alerts, rawText: text };
  };

  const { diagnostic, kpisData, recommendationsData, alerts, rawText } = parseAnalysis(analysis);

  return (
    <div className="space-y-6">
      {/* Provider Badge */}
      <div className="flex items-center justify-end">
        <Badge variant="info" className="flex items-center gap-1">
          <Sparkles className="h-3 w-3" />
          Analyse par {provider || 'IA'}
        </Badge>
      </div>

      {/* Diagnostic */}
      {diagnostic && (
        <Card className="border-purple-200 bg-purple-50/50">
          <CardContent className="pt-4">
            <h4 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Diagnostic
            </h4>
            <p className="text-gray-700 whitespace-pre-wrap">{diagnostic}</p>
          </CardContent>
        </Card>
      )}

      {/* Score de santé IA */}
      {kpisData?.healthScore !== undefined && (
        <Card className="bg-gradient-to-br from-gray-900 to-gray-800 text-white border-0">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm mb-1">Score IA</p>
                <div className="flex items-center gap-3">
                  <span className="text-5xl font-bold">{kpisData.healthScore}</span>
                  <span className="text-2xl text-gray-400">/100</span>
                </div>
              </div>
              <div className="relative">
                <svg className="w-24 h-24 transform -rotate-90">
                  <circle cx="48" cy="48" r="40" stroke="#374151" strokeWidth="8" fill="none" />
                  <circle
                    cx="48"
                    cy="48"
                    r="40"
                    stroke={kpisData.healthScore >= 80 ? '#22c55e' : kpisData.healthScore >= 60 ? '#3b82f6' : kpisData.healthScore >= 40 ? '#f97316' : '#ef4444'}
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${kpisData.healthScore * 2.51} 251`}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* KPIs Chart */}
      {kpisData?.kpis && kpisData.kpis.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-500" />
              Indicateurs Clés (IA)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpisData.kpis}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8b5cf6" name="Valeur" />
                  <Bar dataKey="target" fill="#22c55e" name="Objectif" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Funnel Chart */}
      {kpisData?.funnelData && kpisData.funnelData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-500" />
              Entonnoir de Conversion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpisData.funnelData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="stage" type="category" width={100} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#6366f1">
                    {kpisData.funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommandations IA */}
      {recommendationsData?.recommendations && recommendationsData.recommendations.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Recommandations IA
          </h3>
          <div className="space-y-3">
            {recommendationsData.recommendations.map((rec: any, index: number) => (
              <Card
                key={index}
                className={`border-2 ${
                  rec.priority === 'urgent'
                    ? 'bg-red-50 border-red-200'
                    : rec.priority === 'high'
                    ? 'bg-orange-50 border-orange-200'
                    : 'bg-blue-50 border-blue-200'
                }`}
              >
                <CardContent className="pt-4">
                  <div className="flex items-start gap-3">
                    {rec.priority === 'urgent' ? (
                      <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                    ) : rec.priority === 'high' ? (
                      <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                    ) : (
                      <Lightbulb className="h-5 w-5 text-blue-500 mt-0.5" />
                    )}
                    <div>
                      <h4 className="font-semibold text-gray-900">{rec.title}</h4>
                      <p className="text-sm text-gray-600 mt-1">{rec.description}</p>
                      {rec.expectedImpact && (
                        <p className="text-xs text-gray-500 mt-2">
                          Impact attendu: {rec.expectedImpact}
                        </p>
                      )}
                      {rec.timeframe && (
                        <Badge variant="outline" className="mt-2">
                          <Clock className="h-3 w-3 mr-1" />
                          {rec.timeframe}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Alertes */}
      {alerts && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-4">
            <h4 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Alertes
            </h4>
            <p className="text-gray-700 whitespace-pre-wrap">{alerts}</p>
          </CardContent>
        </Card>
      )}

      {/* Raw text fallback if parsing failed */}
      {!diagnostic && !kpisData && !recommendationsData && rawText && (
        <Card>
          <CardContent className="pt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Analyse</h4>
            <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
              {rawText}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export function AnalyseIntelligenteModal({ open, onClose, filters = {} }: Props) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [useAI, setUseAI] = useState(true);
  const [aiAnalysis, setAIAnalysis] = useState<string | null>(null);
  const [aiProvider, setAIProvider] = useState<string | null>(null);

  // Check AI status
  const { data: aiStatus, isLoading: aiStatusLoading } = useQuery({
    queryKey: ['ai-status'],
    queryFn: () => apiClient.get<AIStatus>('/ai-settings/status'),
    enabled: open,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Dates pour le mois actuel et précédent
  const currentMonth = new Date();
  const currentStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const currentEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
  const previousStart = format(startOfMonth(subMonths(currentMonth, 1)), 'yyyy-MM-dd');
  const previousEnd = format(endOfMonth(subMonths(currentMonth, 1)), 'yyyy-MM-dd');

  // Query pour les stats actuelles
  const { data: currentStats, isLoading: currentLoading, refetch: refetchCurrent } = useQuery({
    queryKey: ['analyse-current', filters.segment_id, filters.ville_id, currentStart, currentEnd],
    queryFn: () => prospectsApi.getAll({
      segment_id: filters.segment_id,
      ville_id: filters.ville_id,
      date_from: currentStart,
      date_to: currentEnd,
      page: 1,
      limit: 1,
    }),
    enabled: open,
  });

  // Query pour les stats précédentes
  const { data: previousStats, isLoading: previousLoading, refetch: refetchPrevious } = useQuery({
    queryKey: ['analyse-previous', filters.segment_id, filters.ville_id, previousStart, previousEnd],
    queryFn: () => prospectsApi.getAll({
      segment_id: filters.segment_id,
      ville_id: filters.ville_id,
      date_from: previousStart,
      date_to: previousEnd,
      page: 1,
      limit: 1,
    }),
    enabled: open,
  });

  // Query pour les écarts
  const { data: ecartData, refetch: refetchEcart } = useQuery({
    queryKey: ['analyse-ecart', filters.segment_id, filters.ville_id, currentStart, currentEnd],
    queryFn: () => prospectsApi.getEcartDetails({
      segment_id: filters.segment_id,
      ville_id: filters.ville_id,
      date_from: currentStart,
      date_to: currentEnd,
    }),
    enabled: open,
  });

  // Mutation pour l'analyse IA
  const aiAnalysisMutation = useMutation({
    mutationFn: (data: { indicators: any; filters: any }) =>
      apiClient.post<AIAnalysisResult>('/ai-settings/analyze', data),
    onSuccess: (result) => {
      setAIAnalysis(result.analysis);
      setAIProvider(result.provider || null);
    },
    onError: (error: any) => {
      console.error('AI Analysis error:', error);
      setUseAI(false);
    },
  });

  // Lancer l'analyse IA quand les données sont prêtes
  useEffect(() => {
    if (
      open &&
      aiStatus?.configured &&
      aiStatus?.enabled &&
      currentStats?.stats &&
      previousStats?.stats &&
      !aiAnalysisMutation.isPending &&
      !aiAnalysis &&
      useAI
    ) {
      const indicators = {
        current: currentStats.stats,
        previous: previousStats.stats,
        ecart: ecartData,
      };

      aiAnalysisMutation.mutate({ indicators, filters });
    }
  }, [open, aiStatus, currentStats, previousStats, ecartData, aiAnalysis, useAI]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setAIAnalysis(null);
      setAIProvider(null);
      setUseAI(true);
    }
  }, [open]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setAIAnalysis(null);
    await Promise.all([refetchCurrent(), refetchPrevious(), refetchEcart()]);
    setIsRefreshing(false);
  };

  const isLoading = currentLoading || previousLoading || aiStatusLoading;

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

  // Calculer les métriques (fallback)
  const healthScore = useMemo(() => calculateHealthScore(current, previous, ecartData), [current, previous, ecartData]);
  const recommendations = useMemo(() => generateRecommendations(current, previous, ecartData), [current, previous, ecartData]);

  // Calculer les tendances
  const getTrend = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev) * 100 : 0;

  const urgentCount = recommendations.filter(r => r.type === 'urgent').length;
  const importantCount = recommendations.filter(r => r.type === 'important').length;

  // Si l'IA n'est pas configurée
  const showAINotConfigured = !aiStatusLoading && (!aiStatus?.configured || !aiStatus?.enabled);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Brain className="h-6 w-6 text-purple-500" />
              Analyse Intelligente
              {aiStatus?.configured && aiStatus?.enabled && (
                <Badge variant="info" className="ml-2 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  IA Active
                </Badge>
              )}
            </DialogTitle>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {aiStatus?.configured && aiStatus?.enabled
              ? 'Analyse par intelligence artificielle avec recommandations personnalisées'
              : 'Analyse automatique de vos indicateurs'}
          </p>
        </DialogHeader>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Brain className="h-16 w-16 text-purple-400 animate-pulse mb-4" />
            <p className="text-gray-600">Chargement des données...</p>
          </div>
        ) : showAINotConfigured ? (
          <AINotConfigured isAdmin={isAdmin} />
        ) : aiAnalysisMutation.isPending ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative">
              <Brain className="h-16 w-16 text-purple-400" />
              <Loader2 className="h-8 w-8 text-purple-600 animate-spin absolute -bottom-2 -right-2" />
            </div>
            <p className="text-gray-600 mt-4">L'IA analyse vos données...</p>
            <p className="text-sm text-gray-400 mt-1">Cela peut prendre quelques secondes</p>
          </div>
        ) : aiAnalysis ? (
          <AIAnalysisDisplay analysis={aiAnalysis} provider={aiProvider || undefined} />
        ) : (
          // Fallback: affichage classique sans IA
          <div className="space-y-6">
            {/* Score de santé + Alertes */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <HealthScoreDisplay health={healthScore} />
              </div>
              <Card className="border-2 border-dashed border-gray-200">
                <CardContent className="pt-4">
                  <p className="text-sm text-gray-500 mb-3">Résumé des alertes</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-red-50 rounded-lg">
                      <span className="text-sm text-red-700 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Urgentes
                      </span>
                      <span className="font-bold text-red-700">{urgentCount}</span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-orange-50 rounded-lg">
                      <span className="text-sm text-orange-700 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Importantes
                      </span>
                      <span className="font-bold text-orange-700">{importantCount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* KPIs rapides */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-500" />
                Indicateurs Clés - {format(currentMonth, 'MMMM yyyy', { locale: fr })}
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <QuickKPI
                  label="Total Prospects"
                  value={current.total}
                  trend={getTrend(current.total, previous.total)}
                  icon={<Users className="h-5 w-5 text-blue-500" />}
                  color="bg-blue-50 border-blue-200"
                />
                <QuickKPI
                  label="Taux Conversion"
                  value={`${(current.taux_conversion || 0).toFixed(1)}%`}
                  trend={getTrend(current.taux_conversion, previous.taux_conversion)}
                  icon={<Target className="h-5 w-5 text-purple-500" />}
                  color="bg-purple-50 border-purple-200"
                />
                <QuickKPI
                  label="RDV Pris"
                  value={current.avec_rdv}
                  trend={getTrend(current.avec_rdv, previous.avec_rdv)}
                  icon={<Calendar className="h-5 w-5 text-green-500" />}
                  color="bg-green-50 border-green-200"
                />
                <QuickKPI
                  label="Inscriptions"
                  value={current.inscrits_prospect}
                  trend={getTrend(current.inscrits_prospect, previous.inscrits_prospect)}
                  icon={<UserCheck className="h-5 w-5 text-cyan-500" />}
                  color="bg-cyan-50 border-cyan-200"
                />
              </div>
            </div>

            {/* Recommandations */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-amber-500" />
                Recommandations & Actions
              </h3>
              <div className="space-y-3">
                {recommendations.map((rec, index) => (
                  <RecommendationCard key={index} rec={rec} />
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-xs text-gray-400 pt-4 border-t">
              <span>Analyse générée le {format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr })}</span>
              <span className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                Analyse algorithmique (IA non configurée)
              </span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
