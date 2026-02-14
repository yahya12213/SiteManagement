import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Shield, AlertTriangle, CheckCircle2, Activity, Users, Key, FileCheck } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';

interface DiagnosticData {
  overview: {
    totalPermissions: number;
    totalRoles: number;
    totalUsers: number;
    totalAssignments: number;
    totalUserRoleAssignments: number;
    orphanPermissions: number;
    orphanPercentage: number;
    avgPermissionsPerRole: number;
    healthScore: number;
  };
  byModule: Array<{
    module: string;
    permission_count: string;
    menu_count: string;
    action_count: string;
  }>;
  topAssignedPermissions: Array<{
    code: string;
    label: string;
    module: string;
    assigned_to_roles: string;
  }>;
  orphanPermissions: Array<{
    code: string;
    label: string;
    module: string;
    menu: string;
  }>;
  topRoles: Array<{
    id: string;
    name: string;
    description: string;
    permission_count: string;
  }>;
  topUsers: Array<{
    id: string;
    username: string;
    full_name: string;
    legacy_role: string;
    role_count: string;
  }>;
  testResults: {
    totalTests: number;
    passed: number;
    failed: number;
    coverage: number;
  };
  securityIssues: Array<{
    severity: string;
    code: string;
    message: string;
    count?: number;
  }>;
  frontendAnalysis?: {
    scannedFiles: number;
    scanDuration: number;
    routes: {
      total: number;
      protected: number;
      unprotected: number;
      list: Array<{
        path: string;
        file: string;
        line: number;
        hasProtection: boolean;
        permission: string | null;
      }>;
    };
    buttons: {
      total: number;
      protected: number;
      unprotected: number;
      list: Array<{
        file: string;
        line: number;
        element: string;
        handler: string;
        hasProtection: boolean;
      }>;
    };
    permissionsUsed: string[];
    issues: Array<{
      type: string;
      severity: string;
      file: string;
      path?: string;
      handler?: string;
      line: number;
      recommendation: string;
    }>;
  } | null;
  uiStructure?: {
    menuStructure: Record<string, any>;
    menuItems: number;
    validMenuItems: number;
    invalidMenuItems: number;
    issues: Array<{
      type: string;
      severity: string;
      menu?: string;
      path?: string;
      permission?: string;
      menuPermission?: string;
      pagePermission?: string;
      file?: string;
      recommendation: string;
    }>;
  } | null;
  permissionCoverage?: {
    totalPermissions: number;
    usedInFrontend: number;
    unusedInFrontend: string[];
    usedButNotInMaster: string[];
  } | null;
  recommendations: Array<{
    priority: string;
    message: string;
    action: string;
  }>;
}

const MODULE_LABELS: Record<string, string> = {
  accounting: 'Gestion Comptable',
  training: 'Formation en Ligne',
  hr: 'Ressources Humaines',
  commercialisation: 'Commercialisation',
  system: 'Système'
};

export default function PermissionsDiagnostic() {
  const [data, setData] = useState<DiagnosticData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDiagnostic();
  }, []);

  const fetchDiagnostic = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token'); // Fixed: use correct token key
      const response = await fetch('/api/permissions/diagnostic', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Échec du chargement du diagnostic');
      }

      const result = await response.json();
      setData(result.data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">Critique</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-500">Avertissement</Badge>;
      default:
        return <Badge variant="secondary">Info</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high':
        return <Badge variant="destructive">Haute</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-500">Moyenne</Badge>;
      default:
        return <Badge variant="secondary">Basse</Badge>;
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Activity className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-gray-600">Chargement du diagnostic...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !data) {
    return (
      <AppLayout>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error || 'Erreur lors du chargement'}</AlertDescription>
        </Alert>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Diagnostic des Permissions</h1>
            <p className="text-gray-600 mt-1">Vue d'ensemble du système de permissions et de sécurité</p>
          </div>
          <button
            onClick={fetchDiagnostic}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
          >
            Actualiser
          </button>
        </div>

        {/* Health Score Card */}
        <Card className={`border-2 ${data.overview.healthScore >= 80 ? 'border-green-200' : data.overview.healthScore >= 60 ? 'border-yellow-200' : 'border-red-200'}`}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-6 w-6" />
              Score de Santé Global
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <div className={`text-6xl font-bold ${getHealthScoreColor(data.overview.healthScore)}`}>
                {data.overview.healthScore}
              </div>
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className={`h-4 rounded-full transition-all ${data.overview.healthScore >= 80 ? 'bg-green-600' : data.overview.healthScore >= 60 ? 'bg-yellow-600' : 'bg-red-600'}`}
                    style={{ width: `${data.overview.healthScore}%` }}
                  />
                </div>
                <p className="text-sm text-gray-600 mt-2">
                  {data.overview.healthScore >= 80 ? '✓ Excellent - Système de permissions en bonne santé' :
                   data.overview.healthScore >= 60 ? '⚠ Acceptable - Quelques améliorations nécessaires' :
                   '✗ Critique - Action requise immédiatement'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Permissions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Key className="h-8 w-8 text-blue-600" />
                <div className="text-3xl font-bold">{data.overview.totalPermissions}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Rôles</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Shield className="h-8 w-8 text-purple-600" />
                <div className="text-3xl font-bold">{data.overview.totalRoles}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Total Utilisateurs</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Users className="h-8 w-8 text-green-600" />
                <div className="text-3xl font-bold">{data.overview.totalUsers}</div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Permissions Orphelines</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-8 w-8 ${data.overview.orphanPermissions > 0 ? 'text-yellow-600' : 'text-gray-400'}`} />
                <div className="text-3xl font-bold">{data.overview.orphanPermissions}</div>
              </div>
              <p className="text-xs text-gray-600 mt-1">{data.overview.orphanPercentage}% du total</p>
            </CardContent>
          </Card>
        </div>

        {/* Security Issues */}
        {data.securityIssues.length > 0 && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-800">
                <AlertTriangle className="h-5 w-5" />
                Problèmes de Sécurité ({data.securityIssues.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.securityIssues.map((issue, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-white p-3 rounded border border-yellow-200">
                  {getSeverityBadge(issue.severity)}
                  <div className="flex-1">
                    <p className="font-medium">{issue.message}</p>
                    <p className="text-xs text-gray-600 mt-1">Code: {issue.code}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Test Results */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5" />
              Résultats des Tests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-gray-600">Total Tests</p>
                <p className="text-2xl font-bold">{data.testResults.totalTests}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Réussis</p>
                <p className="text-2xl font-bold text-green-600">{data.testResults.passed}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Échoués</p>
                <p className="text-2xl font-bold text-red-600">{data.testResults.failed}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Couverture</p>
                <p className="text-2xl font-bold">{data.testResults.coverage}%</p>
              </div>
            </div>
            <div className="mt-4 w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all"
                style={{ width: `${data.testResults.coverage}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Module Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>Permissions par Module</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.byModule.map((mod, idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <div className="w-48">
                    <Badge variant="outline">{MODULE_LABELS[mod.module] || mod.module}</Badge>
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                    <div
                      className="bg-blue-600 h-6 flex items-center justify-end pr-2 text-white text-xs font-medium"
                      style={{ width: `${(parseInt(mod.permission_count) / data.overview.totalPermissions) * 100}%` }}
                    >
                      {mod.permission_count}
                    </div>
                  </div>
                  <div className="text-sm text-gray-600 w-32">
                    {mod.menu_count} menus, {mod.action_count} actions
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recommendations */}
        {data.recommendations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Recommandations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.recommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-gray-50 rounded border">
                  {getPriorityBadge(rec.priority)}
                  <div className="flex-1">
                    <p className="font-medium">{rec.message}</p>
                    <p className="text-xs text-gray-600 mt-1">Action: {rec.action}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Top Roles */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Top Rôles (par permissions)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.topRoles.slice(0, 5).map((role, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div>
                      <p className="font-medium">{role.name}</p>
                      <p className="text-xs text-gray-600">{role.description}</p>
                    </div>
                    <Badge variant="secondary">{role.permission_count} perms</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Permissions les Plus Assignées</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {data.topAssignedPermissions.slice(0, 5).map((perm, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{perm.label}</p>
                      <p className="text-xs text-gray-600 truncate">{perm.code}</p>
                    </div>
                    <Badge variant="secondary">{perm.assigned_to_roles} rôles</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Frontend Analysis */}
        {data.frontendAnalysis && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-blue-600" />
                Analyse Frontend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="p-3 bg-blue-50 rounded">
                  <p className="text-xs text-gray-600">Fichiers scannés</p>
                  <p className="text-2xl font-bold text-blue-600">{data.frontendAnalysis.scannedFiles}</p>
                </div>
                <div className="p-3 bg-green-50 rounded">
                  <p className="text-xs text-gray-600">Routes protégées</p>
                  <p className="text-2xl font-bold text-green-600">
                    {data.frontendAnalysis.routes.protected}/{data.frontendAnalysis.routes.total}
                  </p>
                </div>
                <div className="p-3 bg-green-50 rounded">
                  <p className="text-xs text-gray-600">Boutons protégés</p>
                  <p className="text-2xl font-bold text-green-600">
                    {data.frontendAnalysis.buttons.protected}/{data.frontendAnalysis.buttons.total}
                  </p>
                </div>
                <div className="p-3 bg-purple-50 rounded">
                  <p className="text-xs text-gray-600">Permissions utilisées</p>
                  <p className="text-2xl font-bold text-purple-600">{data.frontendAnalysis.permissionsUsed.length}</p>
                </div>
              </div>

              {data.frontendAnalysis.issues.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    Problèmes détectés ({data.frontendAnalysis.issues.length})
                  </h4>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {data.frontendAnalysis.issues.map((issue, idx) => (
                      <div key={idx} className={`p-3 rounded border ${
                        issue.severity === 'CRITICAL' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
                      }`}>
                        <div className="flex items-start gap-2">
                          <Badge variant={issue.severity === 'CRITICAL' ? 'destructive' : 'default'}>
                            {issue.type}
                          </Badge>
                          <div className="flex-1 text-sm">
                            <p className="font-mono text-xs text-gray-700">{issue.file}:{issue.line}</p>
                            {issue.path && <p className="text-xs text-gray-600 mt-1">Route: {issue.path}</p>}
                            {issue.handler && <p className="text-xs text-gray-600 mt-1">Handler: {issue.handler}</p>}
                            <p className="text-xs text-gray-600 mt-1 italic">{issue.recommendation}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* UI Structure Validation */}
        {data.uiStructure && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-indigo-600" />
                Structure UI
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="p-3 bg-indigo-50 rounded">
                  <p className="text-xs text-gray-600">Menus total</p>
                  <p className="text-2xl font-bold text-indigo-600">{data.uiStructure.menuItems}</p>
                </div>
                <div className="p-3 bg-green-50 rounded">
                  <p className="text-xs text-gray-600">Menus valides</p>
                  <p className="text-2xl font-bold text-green-600">{data.uiStructure.validMenuItems}</p>
                </div>
                <div className="p-3 bg-red-50 rounded">
                  <p className="text-xs text-gray-600">Menus invalides</p>
                  <p className="text-2xl font-bold text-red-600">{data.uiStructure.invalidMenuItems}</p>
                </div>
              </div>

              {data.uiStructure.issues.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2">Problèmes de structure ({data.uiStructure.issues.length})</h4>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {data.uiStructure.issues.map((issue, idx) => (
                      <div key={idx} className="p-3 bg-yellow-50 rounded border border-yellow-200">
                        <div className="flex items-start gap-2">
                          <Badge className="bg-orange-500">{issue.type}</Badge>
                          <div className="flex-1 text-sm">
                            {issue.menu && <p className="font-semibold">{issue.menu}</p>}
                            {issue.path && <p className="text-xs text-gray-600">Path: {issue.path}</p>}
                            {issue.menuPermission && issue.pagePermission && (
                              <p className="text-xs text-gray-600 mt-1">
                                Menu: {issue.menuPermission} → Page: {issue.pagePermission}
                              </p>
                            )}
                            {issue.file && <p className="font-mono text-xs text-gray-700">{issue.file}</p>}
                            <p className="text-xs text-gray-600 mt-1 italic">{issue.recommendation}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Permission Coverage */}
        {data.permissionCoverage && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5 text-teal-600" />
                Couverture des Permissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="p-3 bg-teal-50 rounded">
                  <p className="text-xs text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-teal-600">{data.permissionCoverage.totalPermissions}</p>
                </div>
                <div className="p-3 bg-green-50 rounded">
                  <p className="text-xs text-gray-600">Utilisées</p>
                  <p className="text-2xl font-bold text-green-600">{data.permissionCoverage.usedInFrontend}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <p className="text-xs text-gray-600">Non utilisées</p>
                  <p className="text-2xl font-bold text-gray-600">{data.permissionCoverage.unusedInFrontend.length}</p>
                </div>
                <div className="p-3 bg-red-50 rounded">
                  <p className="text-xs text-gray-600">Manquantes</p>
                  <p className="text-2xl font-bold text-red-600">{data.permissionCoverage.usedButNotInMaster.length}</p>
                </div>
              </div>

              {data.permissionCoverage.unusedInFrontend.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2 text-sm">
                    Top 10 permissions inutilisées (candidates à la suppression)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {data.permissionCoverage.unusedInFrontend.slice(0, 10).map((code, idx) => (
                      <div key={idx} className="p-2 bg-gray-50 rounded">
                        <code className="text-xs text-gray-700">{code}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.permissionCoverage.usedButNotInMaster.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-semibold mb-2 text-sm text-red-600">
                    Permissions utilisées mais non définies dans PERMISSIONS_MASTER
                  </h4>
                  <div className="space-y-1">
                    {data.permissionCoverage.usedButNotInMaster.map((code, idx) => (
                      <div key={idx} className="p-2 bg-red-50 rounded border border-red-200">
                        <code className="text-xs text-red-700">{code}</code>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Orphan Permissions */}
        {data.orphanPermissions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Permissions Orphelines ({data.orphanPermissions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-h-64 overflow-y-auto space-y-1">
                {data.orphanPermissions.map((perm, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 text-sm bg-gray-50 rounded">
                    <Badge variant="outline" className="text-xs">{perm.module}</Badge>
                    <span className="text-gray-600">{perm.menu}</span>
                    <span className="font-mono text-xs text-gray-800">{perm.code}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
