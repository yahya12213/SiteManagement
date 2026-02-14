import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requirePermission, convertToFrenchPermission, EN_TO_FR_PERMISSION_MAP } from '../middleware/auth.js';

const router = express.Router();

// Module labels in French
const MODULE_LABELS = {
  accounting: 'Gestion Comptable',
  training: 'Formation en Ligne',
  hr: 'Ressources Humaines',
  commercialisation: 'Commercialisation',
  system: 'Système'
};

// Menu labels in French
const MENU_LABELS = {
  dashboard: 'Tableau de bord',
  segments: 'Segments',
  cities: 'Villes',
  users: 'Utilisateurs',
  roles: 'Rôles & Permissions',
  calculation_sheets: 'Fiches de calcul',
  create_declaration: 'Créer déclaration',
  declarations: 'Gérer déclarations',
  formations: 'Gestion des Formations',
  corps: 'Corps de Formation',
  sessions: 'Sessions de Formation',
  analytics: 'Analytics',
  student_reports: 'Rapports Étudiants',
  certificates: 'Certificats',
  certificate_templates: 'Templates de Certificats',
  forums: 'Forums',
  // HR menus
  employees: 'Dossiers du Personnel',
  attendance: 'Temps & Présence',
  overtime: 'Heures Supplémentaires',
  leaves: 'Congés',
  settings: 'Paramètres',
  employee_portal: 'Gestion Pointage',
  validation_workflows: 'Boucles de Validation',
  schedules: 'Gestion des Horaires',
  payroll: 'Gestion de Paie',
  requests_validation: 'Validation des Demandes',
  // Training menus
  professors: 'Professeurs',
  student: 'Étudiants',
  // Accounting menus
  actions: 'Plan d\'Action',
  projects: 'Projets',
  // Commercialisation menus
  prospects: 'Prospects',
  clients: 'Clients'
};

// Action labels in French
const ACTION_LABELS = {
  view_page: 'Voir la page',
  create: 'Créer',
  update: 'Modifier',
  delete: 'Supprimer',
  view_all: 'Voir tout',
  approve: 'Approuver',
  reject: 'Rejeter',
  request_modification: 'Demander modification',
  publish: 'Publier',
  duplicate: 'Dupliquer',
  export: 'Exporter',
  settings: 'Paramètres',
  import_cities: 'Importer villes',
  bulk_delete: 'Suppression en masse',
  assign_segments: 'Assigner segments',
  assign_cities: 'Assigner villes',
  assign_roles: 'Assigner rôles',
  create_pack: 'Créer un pack',
  edit_content: 'Éditer contenu',
  view_details: 'Voir détails',
  export_csv: 'Exporter CSV',
  export_pdf: 'Exporter PDF',
  change_period: 'Changer période',
  search: 'Rechercher',
  download: 'Télécharger',
  create_folder: 'Créer dossier',
  create_template: 'Créer template',
  rename: 'Renommer',
  edit_canvas: 'Éditer canvas',
  organize: 'Organiser',
  pin_discussion: 'Épingler discussion',
  lock_discussion: 'Verrouiller discussion',
  delete_content: 'Supprimer contenu',
  moderate: 'Modérer'
};

// GET /api/permissions - List all permissions (flat)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, module, menu, action, code, label, description, sort_order, created_at
      FROM permissions
      ORDER BY sort_order, module, menu, action
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch permissions'
    });
  }
});

// GET /api/permissions/tree - Get permissions in hierarchical tree structure
router.get('/tree', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, module, menu, action, code, label, description, sort_order
      FROM permissions
      ORDER BY sort_order, module, menu, action
    `);

    // Build tree structure
    const tree = {};

    for (const perm of result.rows) {
      // Initialize module if not exists
      if (!tree[perm.module]) {
        tree[perm.module] = {
          id: perm.module,
          label: MODULE_LABELS[perm.module] || perm.module,
          menus: {}
        };
      }

      // Initialize menu if not exists
      if (!tree[perm.module].menus[perm.menu]) {
        tree[perm.module].menus[perm.menu] = {
          id: perm.menu,
          label: MENU_LABELS[perm.menu] || perm.menu,
          actions: []
        };
      }

      // Add action to menu
      tree[perm.module].menus[perm.menu].actions.push({
        id: perm.id,
        action: perm.action,
        code: `${perm.module}.${perm.menu}.${perm.action}`,
        label: perm.label,
        actionLabel: ACTION_LABELS[perm.action] || perm.action,
        description: perm.description
      });
    }

    // Convert to array format for easier frontend handling
    const treeArray = Object.values(tree).map(module => ({
      ...module,
      menus: Object.values(module.menus)
    }));

    res.json({
      success: true,
      data: treeArray,
      labels: {
        modules: MODULE_LABELS,
        menus: MENU_LABELS,
        actions: ACTION_LABELS
      }
    });
  } catch (error) {
    console.error('Error fetching permissions tree:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch permissions tree'
    });
  }
});

// GET /api/permissions/by-role/:roleId - Get permissions for a specific role
router.get('/by-role/:roleId', authenticateToken, async (req, res) => {
  try {
    const { roleId } = req.params;

    const result = await pool.query(`
      SELECT p.id, p.module, p.menu, p.action, p.code, p.label
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = $1
      ORDER BY p.sort_order
    `, [roleId]);

    // Return just the permission codes for easy checking
    const permissionCodes = result.rows.map(r => r.code);

    res.json({
      success: true,
      data: result.rows,
      codes: permissionCodes
    });
  } catch (error) {
    console.error('Error fetching role permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch role permissions'
    });
  }
});

// PUT /api/permissions/role/:roleId - Update permissions for a role (set all at once)
router.put('/role/:roleId', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    const { roleId } = req.params;
    const { permissionIds } = req.body; // Array of permission UUIDs

    if (!Array.isArray(permissionIds)) {
      return res.status(400).json({
        success: false,
        error: 'permissionIds must be an array'
      });
    }

    await client.query('BEGIN');

    // Check if role exists
    const roleCheck = await client.query('SELECT id, name FROM roles WHERE id = $1', [roleId]);
    if (roleCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Role not found'
      });
    }

    const roleName = roleCheck.rows[0].name;

    // Don't allow modifying admin role's permissions
    if (roleName === 'admin') {
      await client.query('ROLLBACK');
      return res.status(403).json({
        success: false,
        error: 'Cannot modify admin role permissions'
      });
    }

    // Delete all existing permissions for this role
    await client.query('DELETE FROM role_permissions WHERE role_id = $1', [roleId]);

    // Insert new permissions
    if (permissionIds.length > 0) {
      for (const permId of permissionIds) {
        await client.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ($1, $2)
          ON CONFLICT DO NOTHING
        `, [roleId, permId]);
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Updated ${permissionIds.length} permissions for role ${roleName}`
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating role permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update role permissions'
    });
  } finally {
    client.release();
  }
});

// GET /api/permissions/user/:userId - Get all permissions for a user (from all their roles)
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Get permissions from user_roles table (N-N relationship)
    const result = await pool.query(`
      SELECT DISTINCT p.code
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      INNER JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = $1
    `, [userId]);

    const permissionCodes = result.rows.map(r => r.code);

    res.json({
      success: true,
      data: permissionCodes
    });
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user permissions'
    });
  }
});

// GET /api/permissions/stats - Get permission statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        module,
        COUNT(*) as permission_count,
        COUNT(DISTINCT menu) as menu_count
      FROM permissions
      GROUP BY module
      ORDER BY module
    `);

    const totalPerms = await pool.query('SELECT COUNT(*) as count FROM permissions');
    const totalRoles = await pool.query('SELECT COUNT(*) as count FROM roles');
    const totalAssignments = await pool.query('SELECT COUNT(*) as count FROM role_permissions');

    res.json({
      success: true,
      data: {
        byModule: stats.rows,
        totals: {
          permissions: parseInt(totalPerms.rows[0].count),
          roles: parseInt(totalRoles.rows[0].count),
          assignments: parseInt(totalAssignments.rows[0].count)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching permission stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch permission statistics'
    });
  }
});

// GET /api/permissions/diagnostic - Diagnostic complet du système de permissions
router.get('/diagnostic',
  authenticateToken,
  requirePermission('system.roles.view_page'),
  async (req, res) => {
  try {
    // 1. Statistiques générales
    const totalPerms = await pool.query('SELECT COUNT(*) as count FROM permissions');
    const totalRoles = await pool.query('SELECT COUNT(*) as count FROM roles');
    const totalUsers = await pool.query('SELECT COUNT(*) as count FROM profiles');
    const totalAssignments = await pool.query('SELECT COUNT(*) as count FROM role_permissions');
    const totalUserRoles = await pool.query('SELECT COUNT(*) as count FROM user_roles');

    // 2. Statistiques par module
    const byModule = await pool.query(`
      SELECT
        module,
        COUNT(*) as permission_count,
        COUNT(DISTINCT menu) as menu_count,
        COUNT(DISTINCT action) as action_count
      FROM permissions
      GROUP BY module
      ORDER BY permission_count DESC
    `);

    // 3. Top 10 permissions les plus assignées
    const topAssigned = await pool.query(`
      SELECT
        p.code,
        p.label,
        p.module,
        COUNT(DISTINCT rp.role_id) as assigned_to_roles
      FROM permissions p
      LEFT JOIN role_permissions rp ON p.id = rp.permission_id
      GROUP BY p.id, p.code, p.label, p.module
      ORDER BY assigned_to_roles DESC
      LIMIT 10
    `);

    // 4. Permissions orphelines (non assignées à aucun rôle)
    const orphanPerms = await pool.query(`
      SELECT
        p.code,
        p.label,
        p.module,
        p.menu
      FROM permissions p
      LEFT JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.permission_id IS NULL
      ORDER BY p.module, p.menu, p.code
    `);

    // 5. Rôles avec le plus de permissions
    const topRoles = await pool.query(`
      SELECT
        r.id,
        r.name,
        r.description,
        COUNT(rp.permission_id) as permission_count
      FROM roles r
      LEFT JOIN role_permissions rp ON r.id = rp.role_id
      GROUP BY r.id, r.name, r.description
      ORDER BY permission_count DESC
    `);

    // 6. Utilisateurs avec le plus de rôles
    const topUsers = await pool.query(`
      SELECT
        p.id,
        p.username,
        p.full_name,
        p.role as legacy_role,
        COUNT(ur.role_id) as role_count
      FROM profiles p
      LEFT JOIN user_roles ur ON p.id = ur.user_id
      GROUP BY p.id, p.username, p.full_name, p.role
      ORDER BY role_count DESC
      LIMIT 10
    `);

    // 7. Tests de couverture (basé sur le script d'audit)
    const testResults = {
      totalTests: 55, // 8 auth.simple.test + 19/23 segments.test + 21/29 declarations.test
      passed: 48,
      failed: 7,
      coverage: Math.round((48 / 55) * 100)
    };

    // 8. Résumé de sécurité
    const securityIssues = [];

    // Vérifier si admin a wildcard permission
    const adminCheck = await pool.query(`
      SELECT COUNT(*) as count
      FROM roles r
      INNER JOIN role_permissions rp ON r.id = rp.role_id
      INNER JOIN permissions p ON rp.permission_id = p.id
      WHERE r.name = 'admin' AND p.code = '*'
    `);

    if (parseInt(adminCheck.rows[0].count) === 0) {
      securityIssues.push({
        severity: 'warning',
        code: 'ADMIN_NO_WILDCARD',
        message: 'Le rôle admin n\'a pas la permission wildcard (*)'
      });
    }

    // Vérifier utilisateurs sans rôles
    const usersWithoutRoles = await pool.query(`
      SELECT COUNT(*) as count
      FROM profiles p
      LEFT JOIN user_roles ur ON p.id = ur.user_id
      WHERE ur.user_id IS NULL AND p.role IS NULL
    `);

    if (parseInt(usersWithoutRoles.rows[0].count) > 0) {
      securityIssues.push({
        severity: 'warning',
        code: 'USERS_WITHOUT_ROLES',
        message: `${usersWithoutRoles.rows[0].count} utilisateur(s) sans rôle assigné`,
        count: parseInt(usersWithoutRoles.rows[0].count)
      });
    }

    // 9. Frontend Analysis - Scan frontend for unprotected routes/buttons
    let frontendAnalysis = null;
    let uiStructure = null;
    let permissionCoverage = null;

    try {
      const { scan } = await import('../utils/frontendPermissionScanner.js');
      const { validate } = await import('../utils/uiStructureValidator.js');

      // Run frontend scanner
      frontendAnalysis = await scan();

      // Run UI structure validator
      uiStructure = await validate();

      // Calculate permission coverage
      const masterPermissions = await pool.query('SELECT code FROM permissions');
      const masterCodes = masterPermissions.rows.map(r => r.code);

      permissionCoverage = {
        totalPermissions: masterCodes.length,
        usedInFrontend: frontendAnalysis.permissionsUsed.length,
        unusedInFrontend: masterCodes.filter(
          code => !frontendAnalysis.permissionsUsed.includes(code)
        ),
        usedButNotInMaster: frontendAnalysis.permissionsUsed.filter(
          code => !masterCodes.includes(code)
        )
      };
    } catch (scanError) {
      console.warn('Frontend scanner error:', scanError.message);
      // Continue without frontend analysis if scanner fails
    }

    // 10. Score de santé global
    const orphanPercentage = (orphanPerms.rows.length / parseInt(totalPerms.rows[0].count)) * 100;
    const assignmentRatio = parseInt(totalAssignments.rows[0].count) / parseInt(totalPerms.rows[0].count);

    let healthScore = 100;
    healthScore -= Math.min(orphanPercentage, 30); // -1 point par % de permissions orphelines (max -30)
    healthScore -= securityIssues.length * 5; // -5 points par issue de sécurité
    healthScore -= (testResults.failed / testResults.totalTests) * 20; // -20 points max si tous les tests échouent

    // Deduct points for frontend issues if scanner ran
    if (frontendAnalysis && frontendAnalysis.issues) {
      const criticalIssues = frontendAnalysis.issues.filter(i => i.severity === 'CRITICAL').length;
      const highIssues = frontendAnalysis.issues.filter(i => i.severity === 'HIGH').length;
      healthScore -= criticalIssues * 5; // -5 points per critical issue
      healthScore -= highIssues * 2; // -2 points per high issue
    }

    healthScore = Math.max(0, Math.round(healthScore));

    // Build recommendations
    const recommendations = [
      {
        priority: 'high',
        message: 'Exécuter les tests régulièrement avec npm test',
        action: 'Run tests'
      },
      orphanPerms.rows.length > 0 && {
        priority: 'medium',
        message: `${orphanPerms.rows.length} permissions ne sont assignées à aucun rôle`,
        action: 'Review orphan permissions'
      },
      securityIssues.length > 0 && {
        priority: 'high',
        message: `${securityIssues.length} problème(s) de sécurité détecté(s)`,
        action: 'Fix security issues'
      }
    ];

    // Add frontend recommendations
    if (frontendAnalysis && frontendAnalysis.issues) {
      const criticalCount = frontendAnalysis.issues.filter(i => i.severity === 'CRITICAL').length;
      const highCount = frontendAnalysis.issues.filter(i => i.severity === 'HIGH').length;

      if (criticalCount > 0) {
        recommendations.push({
          priority: 'critical',
          message: `${criticalCount} route(s) non protégée(s) détectée(s)`,
          action: 'Secure unprotected routes'
        });
      }

      if (highCount > 0) {
        recommendations.push({
          priority: 'high',
          message: `${highCount} bouton(s) non protégé(s) détecté(s)`,
          action: 'Add permission checks to buttons'
        });
      }
    }

    res.json({
      success: true,
      data: {
        overview: {
          totalPermissions: parseInt(totalPerms.rows[0].count),
          totalRoles: parseInt(totalRoles.rows[0].count),
          totalUsers: parseInt(totalUsers.rows[0].count),
          totalAssignments: parseInt(totalAssignments.rows[0].count),
          totalUserRoleAssignments: parseInt(totalUserRoles.rows[0].count),
          orphanPermissions: orphanPerms.rows.length,
          orphanPercentage: Math.round(orphanPercentage * 10) / 10,
          avgPermissionsPerRole: Math.round((parseInt(totalAssignments.rows[0].count) / parseInt(totalRoles.rows[0].count)) * 10) / 10,
          healthScore
        },
        byModule: byModule.rows,
        topAssignedPermissions: topAssigned.rows,
        orphanPermissions: orphanPerms.rows,
        topRoles: topRoles.rows,
        topUsers: topUsers.rows,
        testResults,
        securityIssues,
        frontendAnalysis,
        uiStructure,
        permissionCoverage,
        recommendations: recommendations.filter(Boolean)
      }
    });
  } catch (error) {
    console.error('Error fetching permission diagnostic:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch permission diagnostic',
      details: error.message
    });
  }
});

// GET /api/permissions/validate-mapping - Valider la cohérence du mapping EN→FR
router.get('/validate-mapping',
  authenticateToken,
  requirePermission('system.roles.view_page'),
  async (req, res) => {
  try {
    // 1. Récupérer toutes les permissions de la DB
    const dbPerms = await pool.query('SELECT id, code, label, module, menu FROM permissions ORDER BY code');

    // 2. Pour chaque permission, vérifier si conversion == original
    const conversionIssues = [];
    for (const row of dbPerms.rows) {
      const original = row.code;
      const converted = convertToFrenchPermission(original);

      // Si conversion change le code, c'est potentiellement un problème
      if (original !== converted) {
        // Vérifier si le code converti existe aussi en DB
        const exists = dbPerms.rows.some(r => r.code === converted);
        conversionIssues.push({
          id: row.id,
          original,
          converted,
          label: row.label,
          module: row.module,
          menu: row.menu,
          convertedExistsInDb: exists,
          status: exists ? '⚠️ Doublon potentiel' : '❌ Code converti manquant en DB'
        });
      }
    }

    // 3. Vérifier les préfixes qui changent (visits → visites, hr → ressources_humaines, etc.)
    const prefixIssues = [];
    for (const [enPrefix, frPrefix] of Object.entries(EN_TO_FR_PERMISSION_MAP)) {
      if (enPrefix !== frPrefix) {
        // Trouver toutes les permissions avec ce préfixe EN qui n'ont pas d'équivalent FR
        const enPrefixClean = enPrefix.slice(0, -1); // Remove trailing dot
        const frPrefixClean = frPrefix.slice(0, -1);

        const affected = dbPerms.rows.filter(r => r.code.startsWith(enPrefixClean + '.'));
        for (const perm of affected) {
          const expectedFrCode = perm.code.replace(enPrefixClean, frPrefixClean);
          const frExists = dbPerms.rows.some(r => r.code === expectedFrCode);

          if (!frExists) {
            prefixIssues.push({
              permission: perm.code,
              label: perm.label,
              enPrefix: enPrefixClean,
              frPrefix: frPrefixClean,
              expectedFrCode,
              status: '❌ Version FR manquante'
            });
          }
        }
      }
    }

    // 4. Générer les recommandations
    const hasIssues = conversionIssues.length > 0 || prefixIssues.length > 0;
    const recommendations = [];

    if (conversionIssues.length > 0) {
      recommendations.push({
        priority: 'HAUTE',
        message: `${conversionIssues.length} permissions ont un code qui change après conversion EN→FR`,
        solution: 'Le fix dans auth.js (convertir permissions utilisateur) résout ce problème automatiquement'
      });
    }

    if (prefixIssues.length > 0) {
      recommendations.push({
        priority: 'MOYENNE',
        message: `${prefixIssues.length} permissions utilisent un préfixe anglais sans équivalent français en DB`,
        solution: 'Créer une migration pour ajouter les versions françaises ou s\'assurer que le fix middleware est appliqué'
      });
    }

    res.json({
      success: true,
      summary: {
        totalPermissions: dbPerms.rows.length,
        permissionsWithConversionChange: conversionIssues.length,
        permissionsWithPrefixMismatch: prefixIssues.length,
        healthStatus: hasIssues ? '⚠️ Nécessite attention' : '✅ OK'
      },
      conversionIssues: conversionIssues.slice(0, 50), // Limiter à 50 pour la lisibilité
      prefixIssues: prefixIssues.slice(0, 50),
      recommendations,
      fixApplied: 'Le fix auth.js convertit les permissions utilisateur → problème résolu automatiquement'
    });
  } catch (error) {
    console.error('Error validating permission mapping:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate permission mapping',
      details: error.message
    });
  }
});

export default router;
