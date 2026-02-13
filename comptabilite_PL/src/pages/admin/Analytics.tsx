import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Users,
  BookOpen,
  Calendar,
  CheckCircle,
  Video,
  FileCheck,
  TrendingUp,
  Award,
  Download,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AnalyticsStatCard } from '@/components/admin/AnalyticsStatCard';
import {
  useOverviewStats,
  usePopularFormations,
  useEnrollmentTrends,
  useActiveStudents,
  useFormationCompletionRates,
  usePeriodStats,
} from '@/hooks/useAnalytics';
import {
  exportFormationsCSV,
  exportActiveStudentsCSV,
  exportEnrollmentTrendsCSV,
} from '@/lib/utils/exportUtils';

const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4'];

export const Analytics: React.FC = () => {
  const [periodDays, setPeriodDays] = useState(30);

  // Charger toutes les données analytics
  const { data: overviewData, isLoading: overviewLoading } = useOverviewStats();
  const { data: popularData, isLoading: popularLoading } = usePopularFormations(10);
  const { data: trendsData, isLoading: trendsLoading } = useEnrollmentTrends(6);
  const { data: activeStudentsData, isLoading: studentsLoading } = useActiveStudents(10);
  const { data: completionRatesData, isLoading: completionLoading } = useFormationCompletionRates();
  const { data: periodStatsData, isLoading: periodLoading } = usePeriodStats(periodDays);

  const overview = overviewData?.overview;
  const isLoading = overviewLoading || popularLoading || trendsLoading || studentsLoading || completionLoading || periodLoading;

  if (isLoading) {
    return (
      <AppLayout title="Analytics" subtitle="Vue d'ensemble des performances">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title="Tableau de bord Analytics"
      subtitle="Vue d'ensemble des performances de votre plateforme de formation"
    >
      <div className="space-y-8">

      {/* Statistiques de période */}
      {periodStatsData && (
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Statistiques des {periodStatsData.period_days} derniers jours</h2>
            <div className="flex gap-2">
              {[7, 30, 90].map((days) => (
                <button
                  key={days}
                  onClick={() => setPeriodDays(days)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    periodDays === days
                      ? 'bg-white text-blue-600'
                      : 'bg-white/20 hover:bg-white/30'
                  }`}
                >
                  {days}j
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-sm opacity-90">Nouvelles inscriptions</p>
              <p className="text-3xl font-bold mt-1">{periodStatsData.stats.new_enrollments}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-sm opacity-90">Formations complétées</p>
              <p className="text-3xl font-bold mt-1">{periodStatsData.stats.completed_formations}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-sm opacity-90">Vidéos terminées</p>
              <p className="text-3xl font-bold mt-1">{periodStatsData.stats.videos_completed}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-sm opacity-90">Tests passés</p>
              <p className="text-3xl font-bold mt-1">{periodStatsData.stats.tests_total}</p>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <p className="text-sm opacity-90">Tests réussis</p>
              <p className="text-3xl font-bold mt-1">{periodStatsData.stats.tests_passed}</p>
            </div>
          </div>
        </div>
      )}

      {/* Cartes de statistiques globales */}
      {overview && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <AnalyticsStatCard
            title="Total Étudiants"
            value={overview.students.total}
            icon={Users}
            colorClass="bg-blue-500"
          />
          <AnalyticsStatCard
            title="Total Formations"
            value={overview.formations.total}
            icon={BookOpen}
            colorClass="bg-green-500"
          />
          <AnalyticsStatCard
            title="Sessions Actives"
            value={overview.sessions.active}
            subtitle={`Sur ${overview.sessions.total} sessions`}
            icon={Calendar}
            colorClass="bg-purple-500"
          />
          <AnalyticsStatCard
            title="Taux de Complétion"
            value={`${overview.enrollments.completion_rate.toFixed(1)}%`}
            subtitle={`${overview.enrollments.completed}/${overview.enrollments.total} inscriptions`}
            icon={CheckCircle}
            colorClass="bg-orange-500"
          />
          <AnalyticsStatCard
            title="Vidéos Complétées"
            value={`${overview.videos.completion_rate.toFixed(1)}%`}
            subtitle={`${overview.videos.completed}/${overview.videos.total} vidéos`}
            icon={Video}
            colorClass="bg-cyan-500"
          />
          <AnalyticsStatCard
            title="Taux de Réussite Tests"
            value={`${overview.tests.success_rate.toFixed(1)}%`}
            subtitle={`${overview.tests.passed}/${overview.tests.total} tests`}
            icon={FileCheck}
            colorClass="bg-pink-500"
          />
          <AnalyticsStatCard
            title="Inscriptions Totales"
            value={overview.enrollments.total}
            icon={TrendingUp}
            colorClass="bg-indigo-500"
          />
          <AnalyticsStatCard
            title="Formations Complétées"
            value={overview.enrollments.completed}
            icon={Award}
            colorClass="bg-emerald-500"
          />
        </div>
      )}

      {/* Graphiques en 2 colonnes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Formations Populaires (Bar Chart) */}
        {popularData?.formations && popularData.formations.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Formations les Plus Populaires
              </h2>
              <button
                onClick={() => exportFormationsCSV(popularData.formations)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                CSV
              </button>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={popularData.formations.slice(0, 8)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="title"
                  angle={-45}
                  textAnchor="end"
                  height={120}
                  interval={0}
                  tick={{ fontSize: 11 }}
                />
                <YAxis />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border rounded-lg shadow-lg">
                          <p className="font-semibold text-sm mb-1">{data.title}</p>
                          <p className="text-xs text-gray-600">
                            Inscriptions: <span className="font-medium">{data.enrollment_count}</span>
                          </p>
                          <p className="text-xs text-gray-600">
                            Complétés: <span className="font-medium">{data.completed_count}</span>
                          </p>
                          <p className="text-xs text-gray-600">
                            Taux: <span className="font-medium">{data.completion_rate}%</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Bar dataKey="enrollment_count" name="Inscriptions" fill="#3B82F6" />
                <Bar dataKey="completed_count" name="Complétés" fill="#10B981" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tendances d'Inscriptions (Line Chart) */}
        {trendsData?.trends && trendsData.trends.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Tendances d'Inscriptions (6 mois)
              </h2>
              <button
                onClick={() => exportEnrollmentTrendsCSV(trendsData.trends)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="h-4 w-4" />
                CSV
              </button>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendsData.trends}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border rounded-lg shadow-lg">
                          <p className="font-semibold text-sm mb-1">{data.month}</p>
                          <p className="text-xs text-blue-600">
                            Inscriptions: <span className="font-medium">{data.enrollment_count}</span>
                          </p>
                          <p className="text-xs text-green-600">
                            Complétés: <span className="font-medium">{data.completed_count}</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="enrollment_count"
                  name="Inscriptions"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="completed_count"
                  name="Complétés"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Taux de Complétion par Formation (Pie Chart) */}
      {completionRatesData?.data && completionRatesData.data.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Répartition des Taux de Complétion
          </h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={completionRatesData.data.slice(0, 6) as any[]}
                  dataKey="completion_rate"
                  nameKey="title"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(props: any) => `${props.name}: ${props.value}%`}
                >
                  {completionRatesData.data.slice(0, 6).map((_entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-white p-3 border rounded-lg shadow-lg">
                          <p className="font-semibold text-sm mb-1">{data.title}</p>
                          <p className="text-xs text-gray-600">
                            Taux: <span className="font-medium">{data.completion_rate}%</span>
                          </p>
                          <p className="text-xs text-gray-600">
                            Complétés: <span className="font-medium">{data.completed_enrollments}/{data.total_enrollments}</span>
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2">
              <h3 className="font-medium text-gray-900 mb-3">Détails par Formation</h3>
              <div className="space-y-2 max-h-[280px] overflow-y-auto">
                {completionRatesData.data.map((formation, index) => (
                  <div
                    key={formation.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: COLORS[index % COLORS.length] }}
                      />
                      <span className="text-sm font-medium text-gray-900">{formation.title}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        {formation.completion_rate}%
                      </p>
                      <p className="text-xs text-gray-500">
                        {formation.completed_enrollments}/{formation.total_enrollments}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Étudiants les Plus Actifs (Table) */}
      {activeStudentsData?.students && activeStudentsData.students.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          <div className="p-6 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Étudiants les Plus Actifs
            </h2>
            <button
              onClick={() => exportActiveStudentsCSV(activeStudentsData.students)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Étudiant
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Inscriptions
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vidéos Vues
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Vidéos Complétées
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tests Passés
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tests Réussis
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {activeStudentsData.students.map((student) => (
                  <tr key={student.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{student.full_name}</p>
                        <p className="text-sm text-gray-500">{student.email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                        {student.enrollments_count}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-gray-900">
                      {student.videos_watched}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                        {student.videos_completed}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center text-gray-900">
                      {student.tests_taken}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                        {student.tests_passed}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>
    </AppLayout>
  );
};
