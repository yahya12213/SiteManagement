import React from 'react';
import {
  AlertTriangle,
  Clock,
  TrendingUp,
  DollarSign,
  Users,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  FileWarning,
  Send,
} from 'lucide-react';
import { useDashboardStats } from '@/hooks/useDashboardStats';

const DashboardStats: React.FC = () => {
  const { data: stats, isLoading, error } = useDashboardStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Erreur lors du chargement des statistiques</p>
      </div>
    );
  }

  const {
    statusStats,
    alerts,
    metrics,
    rankings,
  } = stats;

  return (
    <div className="space-y-6">
      {/* SECTION 1: Statistiques Rapides */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Statistiques Rapides</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {/* Total Fiches */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-sm p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Fiches</p>
                <p className="text-3xl font-bold text-blue-900 mt-1">{statusStats.total}</p>
              </div>
              <FileText className="w-10 h-10 text-blue-500 opacity-50" />
            </div>
          </div>

          {/* Soumises (à traiter) */}
          <div className={`rounded-lg shadow-sm p-4 border ${
            statusStats.soumise > 5
              ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-300 animate-pulse'
              : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${
                  statusStats.soumise > 5 ? 'text-red-600' : 'text-blue-600'
                }`}>
                  Soumises
                </p>
                <p className={`text-3xl font-bold mt-1 ${
                  statusStats.soumise > 5 ? 'text-red-900' : 'text-blue-900'
                }`}>
                  {statusStats.soumise}
                </p>
                {statusStats.soumise > 5 && (
                  <p className="text-xs text-red-700 mt-1">⚠️ À traiter rapidement</p>
                )}
              </div>
              <Send className={`w-10 h-10 opacity-50 ${
                statusStats.soumise > 5 ? 'text-red-500' : 'text-blue-500'
              }`} />
            </div>
          </div>

          {/* À déclarer */}
          <div className={`rounded-lg shadow-sm p-4 border ${
            statusStats.a_declarer > 3
              ? 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-300 animate-pulse'
              : 'bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600">À déclarer</p>
                <p className="text-3xl font-bold text-orange-900 mt-1">{statusStats.a_declarer}</p>
                {statusStats.a_declarer > 3 && (
                  <p className="text-xs text-orange-700 mt-1">⚠️ Attente prof</p>
                )}
              </div>
              <AlertCircle className="w-10 h-10 text-orange-500 opacity-50" />
            </div>
          </div>

          {/* Expirées */}
          <div className={`rounded-lg shadow-sm p-4 border ${
            alerts.expired.total > 0
              ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-300'
              : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm font-medium ${
                  alerts.expired.total > 0 ? 'text-red-600' : 'text-gray-600'
                }`}>
                  Expirées
                </p>
                <p className={`text-3xl font-bold mt-1 ${
                  alerts.expired.total > 0 ? 'text-red-900' : 'text-gray-900'
                }`}>
                  {alerts.expired.total}
                </p>
                {alerts.expired.critical > 0 && (
                  <p className="text-xs text-red-700 mt-1">🔴 {alerts.expired.critical} critique</p>
                )}
              </div>
              <FileWarning className={`w-10 h-10 opacity-50 ${
                alerts.expired.total > 0 ? 'text-red-500' : 'text-gray-400'
              }`} />
            </div>
          </div>

          {/* Revenus Total */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow-sm p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Revenus Total</p>
                <p className="text-2xl font-bold text-green-900 mt-1">
                  {new Intl.NumberFormat('fr-FR').format(metrics.totalRevenue)} MAD
                </p>
              </div>
              <DollarSign className="w-10 h-10 text-green-500 opacity-50" />
            </div>
          </div>

          {/* Délai Moyen */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow-sm p-4 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Délai Moyen</p>
                <p className="text-3xl font-bold text-purple-900 mt-1">
                  {metrics.avgProcessingTime}
                  <span className="text-lg ml-1">j</span>
                </p>
                <p className="text-xs text-purple-700 mt-1">de traitement</p>
              </div>
              <Clock className="w-10 h-10 text-purple-500 opacity-50" />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: Alertes Urgentes */}
      {(statusStats.soumise > 0 || alerts.expired.total > 0 || alerts.expiring > 0 || alerts.lateProcessing > 0) && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">⚠️ Alertes Urgentes</h2>
          <div className="space-y-3">
            {/* Soumises à traiter */}
            {statusStats.soumise > 0 && (
              <div className="bg-blue-50 border-l-4 border-blue-500 rounded-r-lg p-4">
                <div className="flex items-center gap-3">
                  <Send className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  <p className="text-sm font-medium text-blue-900">
                    {statusStats.soumise} déclaration{statusStats.soumise > 1 ? 's' : ''} soumise{statusStats.soumise > 1 ? 's' : ''} à traiter
                  </p>
                </div>
              </div>
            )}

            {/* Expirées critique */}
            {alerts.expired.critical > 0 && (
              <div className="bg-red-50 border-l-4 border-red-600 rounded-r-lg p-4">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
                  <p className="text-sm font-medium text-red-900">
                    🔴 {alerts.expired.critical} déclaration{alerts.expired.critical > 1 ? 's' : ''} expirée{alerts.expired.critical > 1 ? 's' : ''} depuis &gt; 30 jours (CRITIQUE)
                  </p>
                </div>
              </div>
            )}

            {/* Expirées warning */}
            {alerts.expired.warning > 0 && (
              <div className="bg-orange-50 border-l-4 border-orange-500 rounded-r-lg p-4">
                <div className="flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
                  <p className="text-sm font-medium text-orange-900">
                    🟠 {alerts.expired.warning} déclaration{alerts.expired.warning > 1 ? 's' : ''} expirée{alerts.expired.warning > 1 ? 's' : ''} depuis 7-30 jours
                  </p>
                </div>
              </div>
            )}

            {/* Arrivant à échéance */}
            {alerts.expiring > 0 && (
              <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-r-lg p-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-yellow-600 flex-shrink-0" />
                  <p className="text-sm font-medium text-yellow-900">
                    🟡 {alerts.expiring} déclaration{alerts.expiring > 1 ? 's' : ''} arrivant à échéance dans 7 jours
                  </p>
                </div>
              </div>
            )}

            {/* En retard de traitement */}
            {alerts.lateProcessing > 0 && (
              <div className="bg-orange-50 border-l-4 border-orange-600 rounded-r-lg p-4">
                <div className="flex items-center gap-3">
                  <FileWarning className="w-5 h-5 text-orange-600 flex-shrink-0" />
                  <p className="text-sm font-medium text-orange-900">
                    ⏱️ {alerts.lateProcessing} déclaration{alerts.lateProcessing > 1 ? 's' : ''} en retard de traitement (&gt; 7 jours)
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 3: Détails par Statut */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Détails par Statut</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* Brouillon */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-gray-500" />
              <p className="text-xs font-medium text-gray-600">Brouillon</p>
            </div>
            <p className="text-2xl font-bold text-gray-900">{statusStats.brouillon}</p>
          </div>

          {/* À déclarer */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-orange-300">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="w-4 h-4 text-orange-500" />
              <p className="text-xs font-medium text-orange-600">À déclarer</p>
            </div>
            <p className="text-2xl font-bold text-orange-900">{statusStats.a_declarer}</p>
          </div>

          {/* Soumise */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-blue-300">
            <div className="flex items-center gap-2 mb-2">
              <Send className="w-4 h-4 text-blue-500" />
              <p className="text-xs font-medium text-blue-600">Soumise</p>
            </div>
            <p className="text-2xl font-bold text-blue-900">{statusStats.soumise}</p>
          </div>

          {/* En cours */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-yellow-300">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              <p className="text-xs font-medium text-yellow-600">En cours</p>
            </div>
            <p className="text-2xl font-bold text-yellow-900">{statusStats.en_cours}</p>
          </div>

          {/* Approuvée */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-green-300">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <p className="text-xs font-medium text-green-600">Approuvée</p>
            </div>
            <p className="text-2xl font-bold text-green-900">{statusStats.approuvee}</p>
          </div>

          {/* Refusée */}
          <div className="bg-white rounded-lg shadow-sm p-4 border border-red-300">
            <div className="flex items-center gap-2 mb-2">
              <XCircle className="w-4 h-4 text-red-500" />
              <p className="text-xs font-medium text-red-600">Refusée</p>
            </div>
            <p className="text-2xl font-bold text-red-900">{statusStats.refusee}</p>
          </div>
        </div>
      </div>

      {/* SECTION 4: Métriques de Performance */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">📊 Métriques de Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Taux d'approbation */}
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow-sm p-6 border border-green-200">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-6 h-6 text-green-600" />
              <p className="text-sm font-medium text-green-700">Taux d'Approbation</p>
            </div>
            <p className="text-4xl font-bold text-green-900">{metrics.approvalRate.toFixed(1)}%</p>
            <div className="mt-3 bg-green-200 rounded-full h-2 overflow-hidden">
              <div
                className="bg-green-600 h-full transition-all duration-500"
                style={{ width: `${metrics.approvalRate}%` }}
              />
            </div>
          </div>

          {/* Délai moyen de traitement */}
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow-sm p-6 border border-purple-200">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-6 h-6 text-purple-600" />
              <p className="text-sm font-medium text-purple-700">Délai Moyen de Traitement</p>
            </div>
            <p className="text-4xl font-bold text-purple-900">
              {metrics.avgProcessingTime}
              <span className="text-2xl ml-1">jours</span>
            </p>
            <p className="text-xs text-purple-700 mt-2">
              Entre soumission et validation
            </p>
          </div>

          {/* Revenus totaux */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-sm p-6 border border-blue-200">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-6 h-6 text-blue-600" />
              <p className="text-sm font-medium text-blue-700">Revenus Totaux (Approuvées)</p>
            </div>
            <p className="text-3xl font-bold text-blue-900">
              {new Intl.NumberFormat('fr-FR', {
                style: 'currency',
                currency: 'MAD',
                minimumFractionDigits: 0,
              }).format(metrics.totalRevenue)}
            </p>
            <p className="text-xs text-blue-700 mt-2">
              Basé sur les fiches approuvées
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 5: Top Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Segments */}
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Top 3 Segments
          </h3>
          <div className="space-y-2">
            {rankings.topSegments.length > 0 ? (
              rankings.topSegments.map((segment, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-700 truncate">{segment.name}</span>
                  <span className="text-sm font-semibold text-gray-900">{segment.count}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500 italic">Aucune donnée</p>
            )}
          </div>
        </div>

        {/* Top Villes */}
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Top 5 Villes
          </h3>
          <div className="space-y-2">
            {rankings.topCities.length > 0 ? (
              rankings.topCities.map((city, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-700 truncate">{city.name}</span>
                  <span className="text-sm font-semibold text-gray-900">{city.count}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500 italic">Aucune donnée</p>
            )}
          </div>
        </div>

        {/* Top Professeurs */}
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Top 5 Professeurs Actifs
          </h3>
          <div className="space-y-2">
            {rankings.topProfessors.length > 0 ? (
              rankings.topProfessors.map((professor, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-700 truncate">{professor.full_name}</span>
                  <span className="text-sm font-semibold text-gray-900">{professor.count}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500 italic">Aucune donnée</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardStats;
