import React, { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { rolesApi, type Role, type GroupedPermissions } from '@/lib/api/roles';
import { permissionsApi } from '@/lib/api/permissions';
import { apiClient } from '@/lib/api/client';
import { PermissionTree } from '@/components/admin/PermissionTree';
import { ProtectedButton } from '@/components/ui/ProtectedButton';
import {
  Shield,
  Plus,
  Edit,
  Trash2,
  Users,
  Key,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  Lock,
  Unlock,
  Database,
  CheckCircle,
  AlertTriangle,
  Copy,
} from 'lucide-react';

export const RolesManagement: React.FC = () => {
  const [roles, setRoles] = useState<Role[]>([]);
  const [groupedPermissions, setGroupedPermissions] = useState<GroupedPermissions>({});
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [roleUsers, setRoleUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Migration states
  const [migrationComplete, setMigrationComplete] = useState<boolean | null>(null);
  const [migrationChecks, setMigrationChecks] = useState<any>(null);
  const [isRunningMigration, setIsRunningMigration] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPermissions, setFormPermissions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const useNewTree = true; // Always use new hierarchical tree UI

  // Validation states
  const [isValidating, setIsValidating] = useState(false);
  const [validationResults, setValidationResults] = useState<{
    total: number;
    errors: number;
    valid: number;
    details: Array<{ en: string; fr: string; status: string; message: string }>;
  } | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);

  useEffect(() => {
    checkMigration();
  }, []);

  const checkMigration = async () => {
    setIsLoading(true);
    try {
      const statusRes = await rolesApi.checkMigrationStatus();
      setMigrationComplete(statusRes.migrationComplete);
      setMigrationChecks(statusRes.checks);

      if (statusRes.migrationComplete) {
        await loadData();
      }
    } catch (error: any) {
      console.error('Error checking migration:', error);
      setMigrationComplete(false);
    } finally {
      setIsLoading(false);
    }
  };

  const runMigration = async () => {
    if (!confirm('Voulez-vous exécuter la migration RBAC ? Cette opération va créer les tables de rôles et permissions, et migrer vos utilisateurs actuels vers le nouveau système. Vos données existantes seront préservées.')) {
      return;
    }

    setIsRunningMigration(true);
    try {
      const result = await rolesApi.runMigration();
      if (result.success) {
        alert(`Migration réussie !\n\n- ${result.details?.rolesCreated} rôles créés\n- ${result.details?.permissionsCreated} permissions créées\n- ${result.details?.usersMigrated} utilisateurs migrés\n\nVos utilisateurs conservent leur niveau d'accès actuel.`);
        await checkMigration();
      } else {
        alert('Erreur lors de la migration: ' + result.message);
      }
    } catch (error: any) {
      console.error('Migration error:', error);
      alert('Erreur lors de la migration: ' + error.message);
    } finally {
      setIsRunningMigration(false);
    }
  };

  const loadData = async () => {
    try {
      const [rolesRes, permsRes] = await Promise.all([
        rolesApi.getAllRoles(),
        rolesApi.getAllPermissions(),
      ]);

      if (rolesRes.success) setRoles(rolesRes.roles);
      if (permsRes.success) {
        setGroupedPermissions(permsRes.grouped);
      }
    } catch (error: any) {
      console.error('Error loading data:', error);
      alert('Erreur lors du chargement: ' + error.message);
    }
  };

  const loadRoleDetails = async (role: Role) => {
    try {
      const res = await rolesApi.getRole(role.id);
      if (res.success) {
        setSelectedRole(role);
        setRolePermissions(res.permissions.map(p => p.id));
        setRoleUsers(res.users);
      }
    } catch (error: any) {
      console.error('Error loading role details:', error);
    }
  };

  const handleCreateRole = async () => {
    if (!formName.trim()) {
      alert('Le nom du rôle est requis');
      return;
    }

    setIsSaving(true);
    try {
      // Use new permissions API if available
      const res = await rolesApi.createRole({
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        permission_ids: formPermissions,
      });

      if (res.success) {
        alert('Rôle créé avec succès');
        setShowCreateModal(false);
        resetForm();
        loadData();
      }
    } catch (error: any) {
      alert('Erreur: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditRole = async () => {
    if (!selectedRole) return;

    setIsSaving(true);
    try {
      // Try new permissions API first
      if (useNewTree) {
        await permissionsApi.updateRolePermissions(selectedRole.id, formPermissions);
      }

      const res = await rolesApi.updateRole(selectedRole.id, {
        name: formName.trim() || undefined,
        description: formDescription.trim(),
        permission_ids: formPermissions,
      });

      if (res.success) {
        alert('Rôle mis à jour avec succès');
        setShowEditModal(false);
        resetForm();
        loadData();
        setSelectedRole(null);
      }
    } catch (error: any) {
      alert('Erreur: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRole = async (role: Role) => {
    if (role.is_system_role) {
      alert('Impossible de supprimer un rôle système');
      return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir supprimer le rôle "${role.name}" ?`)) {
      return;
    }

    try {
      const res = await rolesApi.deleteRole(role.id);
      if (res.success) {
        alert('Rôle supprimé');
        loadData();
        if (selectedRole?.id === role.id) {
          setSelectedRole(null);
        }
      }
    } catch (error: any) {
      alert('Erreur: ' + error.message);
    }
  };

  const handleDuplicateRole = async (role: Role) => {
    const newName = prompt(`Nom du nouveau rôle (copie de "${role.name}"):`, `${role.name} (copie)`);
    if (!newName) return;

    try {
      const res = await rolesApi.duplicateRole(role.id, { name: newName });
      if (res.success) {
        alert(`Rôle dupliqué avec succès ! ${res.permissions_count} permissions copiées.`);
        loadData();
        // Sélectionner le nouveau rôle
        if (res.role) {
          loadRoleDetails(res.role);
        }
      }
    } catch (error: any) {
      alert('Erreur: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormPermissions([]);
  };

  const handleValidateMappings = async () => {
    setIsValidating(true);
    try {
      const response = await apiClient.get<{
        success: boolean;
        data: typeof validationResults;
        error?: string;
      }>('/roles/validate-mappings');

      if (response.success && response.data) {
        setValidationResults(response.data);
        setShowValidationModal(true);
      } else {
        alert('Erreur: ' + (response.error || 'Réponse invalide'));
      }
    } catch (error: any) {
      console.error('Validation error:', error);
      alert('Erreur lors de la validation: ' + error.message);
    } finally {
      setIsValidating(false);
    }
  };

  const openEditModal = (role: Role) => {
    setFormName(role.name);
    setFormDescription(role.description || '');
    setFormPermissions([...rolePermissions]);
    setShowEditModal(true);
  };

  const toggleModule = (module: string) => {
    setExpandedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(module)) {
        newSet.delete(module);
      } else {
        newSet.add(module);
      }
      return newSet;
    });
  };

  const togglePermission = (permId: string) => {
    setFormPermissions(prev => {
      if (prev.includes(permId)) {
        return prev.filter(id => id !== permId);
      } else {
        return [...prev, permId];
      }
    });
  };

  const toggleAllInModule = (module: string) => {
    const modulePerms = groupedPermissions[module] || [];
    const allSelected = modulePerms.every(p => formPermissions.includes(p.id));

    setFormPermissions(prev => {
      if (allSelected) {
        return prev.filter(id => !modulePerms.some(p => p.id === id));
      } else {
        const newIds = modulePerms.map(p => p.id).filter(id => !prev.includes(id));
        return [...prev, ...newIds];
      }
    });
  };

  const moduleLabels: Record<string, string> = {
    // Hierarchical structure - Gestion Comptable
    'gestion_comptable.tableau_bord': 'Tableau de bord',
    'gestion_comptable.segments': 'Segments',
    'gestion_comptable.villes': 'Villes',
    'gestion_comptable.utilisateurs': 'Utilisateurs',
    'gestion_comptable.roles': 'Rôles & Permissions',
    'gestion_comptable.fiches_calcul': 'Fiches de calcul',
    'gestion_comptable.creer_declaration': 'Créer déclaration',
    'gestion_comptable.gerer_declarations': 'Gérer déclarations',
    // Hierarchical structure - Formation en Ligne
    'formation_en_ligne.formations': 'Gestion des Formations',
    'formation_en_ligne.sessions': 'Sessions de Formation',
    'formation_en_ligne.analytics': 'Analytics',
    'formation_en_ligne.rapports': 'Rapports Étudiants',
    'formation_en_ligne.certificats': 'Certificats',
    'formation_en_ligne.templates': 'Templates de Certificats',
    'formation_en_ligne.forums': 'Forums',
    // Menu-based structure (simplified)
    gestion_comptable: 'Gestion Comptable',
    formation_en_ligne: 'Formation en Ligne',
    // Old structures (backward compatibility)
    pages_comptabilite: 'Pages - Gestion Comptable',
    pages_formation: 'Pages - Formation en Ligne',
    actions_utilisateurs: 'Actions - Utilisateurs',
    actions_parametres: 'Actions - Segments & Villes',
    actions_fiches: 'Actions - Fiches de Calcul',
    actions_declarations: 'Actions - Déclarations',
    actions_formations: 'Actions - Formations',
    actions_sessions: 'Actions - Sessions',
    actions_speciales: 'Actions Spéciales',
    declarations: 'Gestion Comptable',
    users: 'Utilisateurs',
    students: 'Étudiants',
    sessions: 'Sessions',
    documents: 'Documents',
    finances: 'Finances',
    formations: 'Formations',
    settings: 'Paramètres',
    reports: 'Rapports',
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Chargement...</div>
        </div>
      </AppLayout>
    );
  }

  // Show migration UI if not complete
  if (migrationComplete === false) {
    return (
      <AppLayout>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="h-8 w-8 text-purple-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestion des Rôles</h1>
              <p className="text-sm text-gray-600">
                Configuration initiale requise
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 max-w-2xl">
            <div className="flex items-center gap-3 mb-4">
              <Database className="h-6 w-6 text-orange-500" />
              <h2 className="text-lg font-semibold text-gray-900">
                Migration RBAC requise
              </h2>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm text-yellow-800 font-medium mb-2">
                    Le système de rôles et permissions n'est pas encore initialisé.
                  </p>
                  <p className="text-sm text-yellow-700">
                    Cette migration va créer les tables nécessaires et migrer vos utilisateurs existants
                    vers le nouveau système. <strong>Vos données actuelles seront préservées</strong> et
                    chaque utilisateur conservera son niveau d'accès actuel.
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Ce qui va être créé :</h3>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Tables : roles, permissions, role_permissions
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  6 rôles par défaut (admin, gerant, professor, assistante, comptable, superviseur)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  35+ permissions granulaires (utilisateurs, étudiants, sessions, documents, finances...)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Migration automatique de vos utilisateurs existants
                </li>
              </ul>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-800">
                <strong>Exemple :</strong> Si vous avez un utilisateur avec le rôle "admin",
                il sera automatiquement migré vers le nouveau rôle "admin" avec toutes les permissions.
                Un "gerant" aura les permissions de gestion quotidienne, etc.
              </p>
            </div>

            <ProtectedButton
              permission="system.roles.view_page"
              onClick={runMigration}
              disabled={isRunningMigration}
              className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {isRunningMigration ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                  Migration en cours...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4" />
                  Exécuter la Migration
                </>
              )}
            </ProtectedButton>

            {migrationChecks && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">État actuel :</h3>
                <div className="space-y-1 text-xs text-gray-500">
                  <p>Table roles : {migrationChecks.rolesTableExists ? '✅' : '❌'}</p>
                  <p>Table permissions : {migrationChecks.permissionsTableExists ? '✅' : '❌'}</p>
                  <p>Table role_permissions : {migrationChecks.rolePermissionsTableExists ? '✅' : '❌'}</p>
                  <p>Colonne role_id dans profiles : {migrationChecks.roleIdColumnExists ? '✅' : '❌'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield className="h-8 w-8 text-purple-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gestion des Rôles</h1>
              <p className="text-sm text-gray-600">
                Créez et gérez les rôles et permissions des utilisateurs
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleValidateMappings}
              disabled={isValidating}
              className="flex items-center gap-2 px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {isValidating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-orange-700 border-t-transparent" />
                  Validation...
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  Valider Mappings
                </>
              )}
            </button>
            <ProtectedButton
              permission="system.roles.create"
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Nouveau Rôle
            </ProtectedButton>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Roles List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Rôles ({roles.length})</h2>
              </div>
              <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
                {roles.map(role => (
                  <div
                    key={role.id}
                    className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                      selectedRole?.id === role.id ? 'bg-purple-50 border-l-4 border-purple-600' : ''
                    }`}
                    onClick={() => loadRoleDetails(role)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {role.is_system_role ? (
                          <Lock className="h-4 w-4 text-orange-500" />
                        ) : (
                          <Unlock className="h-4 w-4 text-green-500" />
                        )}
                        <span className="font-medium text-gray-900">{role.name}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Bouton Dupliquer - disponible pour tous les rôles */}
                        <ProtectedButton
                          permission="system.roles.create"
                          onClick={e => {
                            e.stopPropagation();
                            handleDuplicateRole(role);
                          }}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          title="Dupliquer ce rôle"
                        >
                          <Copy className="h-4 w-4" />
                        </ProtectedButton>
                        {/* Bouton Supprimer - seulement pour rôles non-système */}
                        {!role.is_system_role && (
                          <ProtectedButton
                            permission="system.roles.delete"
                            onClick={e => {
                              e.stopPropagation();
                              handleDeleteRole(role);
                            }}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Supprimer ce rôle"
                          >
                            <Trash2 className="h-4 w-4" />
                          </ProtectedButton>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">{role.description || 'Pas de description'}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Key className="h-3 w-3" />
                        {role.permission_count || 0} permissions
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {role.user_count || 0} utilisateurs
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Role Details */}
          <div className="lg:col-span-2">
            {selectedRole ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {selectedRole.name}
                      {selectedRole.is_system_role && (
                        <span className="ml-2 text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                          Système
                        </span>
                      )}
                    </h2>
                    <p className="text-sm text-gray-600">{selectedRole.description}</p>
                  </div>
                  <ProtectedButton
                    permission="system.roles.update"
                    onClick={() => openEditModal(selectedRole)}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Edit className="h-4 w-4" />
                    Modifier
                  </ProtectedButton>
                </div>

                <div className="p-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Permissions ({rolePermissions.length})
                  </h3>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {Object.entries(groupedPermissions).map(([module, perms]) => {
                      const hasAny = perms.some(p => rolePermissions.includes(p.id));
                      if (!hasAny) return null;
                      return (
                        <div key={module} className="bg-gray-50 rounded-lg p-3">
                          <div className="font-medium text-gray-700 mb-2">
                            {moduleLabels[module] || module}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {perms
                              .filter(p => rolePermissions.includes(p.id))
                              .map(perm => (
                                <span
                                  key={perm.id}
                                  className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded"
                                >
                                  {perm.name}
                                </span>
                              ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <h3 className="text-sm font-semibold text-gray-700 mt-6 mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Utilisateurs avec ce rôle ({roleUsers.length})
                  </h3>
                  {roleUsers.length > 0 ? (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
                      {roleUsers.map(user => (
                        <div
                          key={user.id}
                          className="flex items-center gap-2 p-2 bg-gray-50 rounded"
                        >
                          <Users className="h-4 w-4 text-gray-500" />
                          <span className="font-medium">{user.full_name}</span>
                          <span className="text-sm text-gray-500">({user.username})</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic">Aucun utilisateur</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Sélectionnez un rôle pour voir ses détails</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Role Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Créer un nouveau rôle</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom du rôle *
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    placeholder="ex: assistante, comptable, superviseur"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    rows={2}
                    placeholder="Décrivez les responsabilités de ce rôle"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Permissions ({formPermissions.length} sélectionnées)
                  </label>
                  {useNewTree ? (
                    <PermissionTree
                      selectedPermissions={formPermissions}
                      onSelectionChange={setFormPermissions}
                      roleName={formName || 'Nouveau rôle'}
                    />
                  ) : (
                    <div className="border border-gray-300 rounded-lg max-h-[300px] overflow-y-auto">
                      {Object.entries(groupedPermissions).map(([module, perms]) => (
                        <div key={module} className="border-b border-gray-200 last:border-0">
                          <div
                            className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                            onClick={() => toggleModule(module)}
                          >
                            <div className="flex items-center gap-2">
                              {expandedModules.has(module) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              <span className="font-medium">{moduleLabels[module] || module}</span>
                              <span className="text-xs text-gray-500">({perms.length})</span>
                            </div>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                toggleAllInModule(module);
                              }}
                              className="text-xs text-purple-600 hover:text-purple-800"
                            >
                              {perms.every(p => formPermissions.includes(p.id)) ? 'Désélectionner tout' : 'Sélectionner tout'}
                            </button>
                          </div>
                          {expandedModules.has(module) && (
                            <div className="p-3 space-y-2">
                              {perms.map(perm => (
                                <label
                                  key={perm.id}
                                  className="flex items-start gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded"
                                >
                                  <input
                                    type="checkbox"
                                    checked={formPermissions.includes(perm.id)}
                                    onChange={() => togglePermission(perm.id)}
                                    className="mt-1"
                                  />
                                  <div>
                                    <div className="font-medium text-sm">{perm.name}</div>
                                    <div className="text-xs text-gray-500">{perm.description}</div>
                                  </div>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Annuler
              </button>
              <button
                onClick={handleCreateRole}
                disabled={isSaving || !formName.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Création...' : 'Créer le rôle'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Role Modal */}
      {showEditModal && selectedRole && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl mx-4 max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Modifier le rôle: {selectedRole.name}</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom du rôle
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    disabled={selectedRole.is_system_role}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 disabled:bg-gray-100"
                  />
                  {selectedRole.is_system_role && (
                    <p className="text-xs text-orange-600 mt-1">
                      Le nom des rôles système ne peut pas être modifié
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={formDescription}
                    onChange={e => setFormDescription(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Permissions ({formPermissions.length} sélectionnées)
                  </label>
                  {useNewTree ? (
                    <PermissionTree
                      selectedPermissions={formPermissions}
                      onSelectionChange={setFormPermissions}
                      roleName={selectedRole?.name || formName}
                    />
                  ) : (
                    <div className="border border-gray-300 rounded-lg max-h-[300px] overflow-y-auto">
                      {Object.entries(groupedPermissions).map(([module, perms]) => (
                        <div key={module} className="border-b border-gray-200 last:border-0">
                          <div
                            className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
                            onClick={() => toggleModule(module)}
                          >
                            <div className="flex items-center gap-2">
                              {expandedModules.has(module) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                              <span className="font-medium">{moduleLabels[module] || module}</span>
                            </div>
                            <button
                              onClick={e => {
                                e.stopPropagation();
                                toggleAllInModule(module);
                              }}
                              className="text-xs text-purple-600 hover:text-purple-800"
                            >
                              {perms.every(p => formPermissions.includes(p.id)) ? 'Désélectionner' : 'Tout sélectionner'}
                            </button>
                          </div>
                          {expandedModules.has(module) && (
                            <div className="p-3 space-y-2">
                              {perms.map(perm => (
                                <label key={perm.id} className="flex items-start gap-2 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={formPermissions.includes(perm.id)}
                                    onChange={() => togglePermission(perm.id)}
                                    className="mt-1"
                                  />
                                  <div>
                                    <div className="font-medium text-sm">{perm.name}</div>
                                    <div className="text-xs text-gray-500">{perm.description}</div>
                                  </div>
                                </label>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2 text-gray-700">
                Annuler
              </button>
              <button
                onClick={handleEditRole}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Validation Results Modal */}
      {showValidationModal && validationResults && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Résultats de validation des mappings</h3>
              <button
                type="button"
                onClick={() => setShowValidationModal(false)}
                className="text-gray-400 hover:text-gray-600"
                title="Fermer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-blue-600">{validationResults.total}</div>
                <div className="text-sm text-blue-600">Total</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-green-600">{validationResults.valid}</div>
                <div className="text-sm text-green-600">Valides</div>
              </div>
              <div className="bg-red-50 p-4 rounded-lg text-center">
                <div className="text-2xl font-bold text-red-600">{validationResults.errors}</div>
                <div className="text-sm text-red-600">Erreurs</div>
              </div>
            </div>

            {validationResults.errors > 0 ? (
              <div className="space-y-3">
                <h4 className="font-medium text-red-600 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Mappings incorrects ({validationResults.errors})
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  Ces codes de permission backend ne correspondent pas aux codes dans la base de données.
                  Il faut corriger auth.js ou ajouter les permissions manquantes.
                </p>
                {validationResults.details.map((d, i) => (
                  <div key={i} className="bg-red-50 border border-red-200 p-3 rounded-lg text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-gray-500">Code EN (backend):</span>
                        <div className="font-mono text-red-700">{d.en}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Code FR converti:</span>
                        <div className="font-mono text-red-700">{d.fr}</div>
                      </div>
                    </div>
                    <div className="mt-2 text-red-600 text-xs">{d.message}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-green-50 border border-green-200 p-6 rounded-lg text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-green-700 font-medium">
                  Tous les mappings sont correctement configurés!
                </p>
                <p className="text-green-600 text-sm mt-1">
                  Les {validationResults.total} permissions backend correspondent aux codes en base de données.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowValidationModal(false)}
              className="mt-6 w-full py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
};
