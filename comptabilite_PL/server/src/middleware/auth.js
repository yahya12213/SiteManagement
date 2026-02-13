/**
 * JWT Authentication Middleware
 * Secures API routes with token-based authentication
 */

import jwt from 'jsonwebtoken';
import pool from '../config/database.js';

// JWT Secret - MUST be set in .env - Fail-fast if missing
let JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Security validation at module load
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ CRITICAL SECURITY ERROR: JWT_SECRET environment variable is not set!');
    console.error('   Set JWT_SECRET in your Railway environment variables');
    console.error('   Generate a secure secret with: openssl rand -base64 64');
    process.exit(1); // Fail-fast in production
  } else {
    // Development fallback
    console.warn('⚠️  WARNING: JWT_SECRET environment variable is not set!');
    console.warn('   Using a temporary development secret. NOT SECURE FOR PRODUCTION.');
    console.warn('   To fix this, create a .env file in the server directory with a secure JWT_SECRET.');
    JWT_SECRET = 'dev-secret-key-at-least-32-characters-long-for-security';
  }
}

if (JWT_SECRET.length < 32) {
  if (process.env.NODE_ENV === 'production') {
    console.error(`❌ CRITICAL SECURITY ERROR: JWT_SECRET is too short (${JWT_SECRET.length} chars, minimum 32)`);
    console.error('   Generate a secure secret with: openssl rand -base64 64');
    process.exit(1);
  } else {
    console.warn(`⚠️  WARNING: JWT_SECRET is too short (${JWT_SECRET.length} chars, minimum 32)`);
    console.warn('   Check your .env file or environment variables.');
  }
}

if (process.env.NODE_ENV === 'production' || process.env.JWT_SECRET) {
  console.log('✓ JWT_SECRET validated successfully');
}

// ==========================================
// PERMISSION CODE CONVERSION EN → FR
// ==========================================
// Le backend utilise des codes anglais mais la DB a des codes français
// Cette fonction convertit automatiquement les codes pour assurer la compatibilité

const EN_TO_FR_PERMISSION_MAP = {
  // === HR DIRECT MAPPINGS (codes backend EN → codes DB FR) ===
  // Ces mappings convertissent directement hr.X → ressources_humaines.Y
  'hr.leaves.': 'ressources_humaines.conges.',
  'hr.employees.': 'ressources_humaines.dossier_employe.',
  'hr.attendance.': 'ressources_humaines.gestion_pointage.',
  'hr.payroll.': 'ressources_humaines.gestion_paie.',
  'hr.validation_workflows.': 'ressources_humaines.boucles_validation.',
  'hr.holidays.': 'ressources_humaines.gestion_horaires.jours_feries.',
  'hr.settings.': 'ressources_humaines.parametres.',
  'hr.dashboard.': 'ressources_humaines.tableau_de_bord.',
  'hr.contracts.': 'ressources_humaines.contrats.',
  'hr.documents.': 'ressources_humaines.documents.',
  'hr.discipline.': 'ressources_humaines.discipline.',
  'hr.delegation.': 'ressources_humaines.delegations.',
  'hr.employee_portal.': 'ressources_humaines.gestion_pointage.',

  // === TRAINING DIRECT MAPPINGS ===
  'training.sessions.': 'formation.sessions_formation.',
  'training.formations.': 'formation.gestion_formations.',
  'training.students.': 'formation.liste_etudiants.',
  'training.certificate_templates.': 'formation.templates_certificats.',
  'training.certificates.': 'formation.certificats.',
  'training.analytics.': 'formation.analytics.',
  'training.forums.': 'formation.forums.',
  'training.centres.': 'formation.centres.',
  'training.corps.': 'formation.corps.',
  'training.student.': 'formation.etudiant.',

  // === ACCOUNTING DIRECT MAPPINGS ===
  'accounting.actions.': 'gestion_comptable.gestion_projet.',
  'accounting.calculation_sheets.': 'gestion_comptable.fiches_calcul.',
  'accounting.projects.': 'gestion_comptable.gestion_projet.',
  'accounting.users.': 'gestion_comptable.utilisateurs.',
  'accounting.cities.': 'gestion_comptable.villes.',
  'accounting.segments.': 'gestion_comptable.segments.',
  'accounting.declarations.': 'gestion_comptable.declarations.',
  'accounting.dashboard.': 'gestion_comptable.tableau_de_bord.',

  // === SYSTEM DIRECT MAPPINGS ===
  'system.roles.': 'gestion_comptable.roles_permissions.',

  // === COMMERCIALISATION DIRECT MAPPINGS ===
  'commercialisation.visits.': 'commercialisation.visites.',
  'commercialisation.prospects.': 'commercialisation.prospects.',

  // === FALLBACK MODULE PREFIXES (si pas de mapping direct) ===
  'accounting.': 'gestion_comptable.',
  'training.': 'formation.',
  'hr.': 'ressources_humaines.',
};

// Actions anglais → français
const EN_TO_FR_ACTION_MAP = {
  // === ACTIONS DE VISUALISATION ===
  '.view_page': '.voir',
  '.view_list': '.voir_liste',
  '.view': '.voir',
  '.view_all': '.voir_tous',
  '.view_analytics': '.voir_analytics',
  '.view_all_payslips': '.bulletins.voir',

  // === ACTIONS CRUD ===
  '.create': '.creer',
  '.update': '.modifier',
  '.edit': '.modifier',
  '.delete': '.supprimer',

  // === ACTIONS DE VALIDATION ===
  '.approve': '.approuver',
  '.reject': '.rejeter',
  '.submit': '.soumettre',
  '.validate': '.valider',
  '.approve_overtime': '.approuver',
  '.reject_overtime': '.rejeter',

  // === ACTIONS DIVERSES ===
  '.export': '.exporter',
  '.import': '.importer',
  '.manage': '.gerer',
  '.verify': '.verifier',
  '.cancel': '.annuler',
  '.clean': '.nettoyer',
  '.call': '.appeler',
  '.reinject': '.reinjecter',
  '.assign': '.assigner',
  '.duplicate': '.dupliquer',
  '.publish': '.publier',
  '.fill': '.remplir',
  '.fill_data': '.remplir',
  '.config': '.configurer',
  '.calculate': '.calculer',
  '.clock_in_out': '.pointer',
  '.generate': '.generer',

  // === ACTIONS FORMATION (étudiants) ===
  '.add_student': '.ajouter_etudiant',
  '.edit_student': '.modifier_etudiant',
  '.remove_student': '.retirer_etudiant',
  '.delete_payment': '.supprimer_paiement',
  '.transfer_student': '.transfert_etudiant',
  '.edit_content': '.editer_contenu',
  '.create_pack': '.creer_pack',

  // === ACTIONS DOSSIERS/FORUMS ===
  '.create_folder': '.creer_dossier',
  '.rename_folder': '.renommer_dossier',
  '.delete_folder': '.supprimer_dossier',
  '.create_thread': '.creer_sujet',
  '.update_thread': '.modifier_sujet',
  '.reply': '.repondre',
  '.react': '.reagir',

  // === ACTIONS ASSIGNATION ===
  '.assign_roles': '.assigner_roles',
  '.assign_segments': '.assigner_segments',
  '.assign_cities': '.assigner_villes',

  // === ACTIONS PAIE/PÉRIODES ===
  '.periods.create': '.periodes.creer',
  '.periods.close': '.periodes.fermer',
};

/**
 * Convertit un code de permission anglais en français
 * @param {string} code - Code de permission (peut être EN ou FR)
 * @returns {string} - Code de permission en français
 */
function convertToFrenchPermission(code) {
  if (!code || typeof code !== 'string') return code;

  let converted = code;

  // 1. Convertir les préfixes de modules (ordre important: plus spécifique d'abord)
  const sortedPrefixes = Object.entries(EN_TO_FR_PERMISSION_MAP)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [en, fr] of sortedPrefixes) {
    if (converted.includes(en)) {
      converted = converted.replace(en, fr);
      break; // Un seul remplacement de préfixe
    }
  }

  // 2. Convertir les actions (suffixes)
  const sortedActions = Object.entries(EN_TO_FR_ACTION_MAP)
    .sort((a, b) => b[0].length - a[0].length);

  for (const [en, fr] of sortedActions) {
    if (converted.endsWith(en)) {
      converted = converted.slice(0, -en.length) + fr;
      break; // Un seul remplacement d'action
    }
  }

  // Log si conversion effectuée
  if (converted !== code) {
    console.log(`🔄 Permission converted: ${code} → ${converted}`);
  }

  return converted;
}

// Token generation
export const generateToken = (user) => {
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    role_id: user.role_id,
    full_name: user.full_name,
    segment_ids: user.segment_ids || [],
    city_ids: user.city_ids || [],
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

// Token verification middleware
export const authenticateToken = (req, res, next) => {
  // Allow public routes
  if (req.path === '/api/auth/login' || req.path === '/api/health') {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. No token provided.',
      code: 'NO_TOKEN',
    });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          error: 'Token expired. Please login again.',
          code: 'TOKEN_EXPIRED',
        });
      }
      return res.status(403).json({
        success: false,
        error: 'Invalid token.',
        code: 'INVALID_TOKEN',
      });
    }

    req.user = decoded;
    next();
  });
};

// Optional authentication - doesn't fail if no token, just sets req.user if valid
export const optionalAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = null;
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      req.user = null;
    } else {
      req.user = decoded;
    }
    next();
  });
};

// Role-based access control middleware
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
        code: 'NOT_AUTHENTICATED',
      });
    }

    const userRole = req.user.role;
    const hasRole = allowedRoles.includes(userRole);

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}. Your role: ${userRole}`,
        code: 'INSUFFICIENT_ROLE',
      });
    }

    next();
  };
};

// Permission-based access control middleware
export const requirePermission = (...requiredPermissions) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
        code: 'NOT_AUTHENTICATED',
      });
    }

    // 🔄 CONVERT: Convertir les codes anglais en français AVANT vérification
    const convertedPermissions = requiredPermissions.map(convertToFrenchPermission);

    try {
      // 🔧 FIX: Check admin role FIRST, before any database queries
      // This ensures admin users bypass permission checks entirely and prevents
      // database errors from blocking admin access
      if (req.user.role === 'admin') {
        console.log(`✅ Admin bypass for user ${req.user.username} on ${convertedPermissions.join(', ')}`);
        return next();
      }

      // Only query permissions if NOT admin
      const permissions = await getUserPermissions(req.user.id);

      // Check wildcard permission
      if (permissions.includes('*')) {
        console.log(`✅ Wildcard permission bypass for user ${req.user.username}`);
        return next();
      }

      // Vérifier avec les codes FRANÇAIS convertis
      const hasPermission = convertedPermissions.some(perm => permissions.includes(perm));

      if (!hasPermission) {
        console.log(`❌ Permission denied for user ${req.user.username}: required ${convertedPermissions.join(' or ')} (original: ${requiredPermissions.join(' or ')})`);
        return res.status(403).json({
          success: false,
          error: `Access denied. Required permission: ${convertedPermissions.join(' or ')}`,
          code: 'INSUFFICIENT_PERMISSION',
        });
      }

      console.log(`✅ Permission granted for user ${req.user.username}: ${convertedPermissions.join(', ')}`);
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Error checking permissions',
        code: 'PERMISSION_CHECK_ERROR',
      });
    }
  };
};

// Get user's permissions from database
// Supports both old system (profiles.role_id) and new system (user_roles table)
export const getUserPermissions = async (userId) => {
  try {
    // First try the new user_roles table (N-N relationship)
    let query = `
      SELECT DISTINCT p.code
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      INNER JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = $1
    `;
    let result = await pool.query(query, [userId]);

    // If no results from user_roles, fallback to old profiles.role_id system
    if (result.rows.length === 0) {
      query = `
        SELECT DISTINCT p.code
        FROM permissions p
        INNER JOIN role_permissions rp ON p.id = rp.permission_id
        INNER JOIN roles r ON rp.role_id = r.id
        INNER JOIN profiles pr ON pr.role_id = r.id
        WHERE pr.id = $1
      `;
      result = await pool.query(query, [userId]);
    }

    // If still no results, try matching by role name (text) - ultimate fallback
    if (result.rows.length === 0) {
      query = `
        SELECT DISTINCT p.code
        FROM permissions p
        INNER JOIN role_permissions rp ON p.id = rp.permission_id
        INNER JOIN roles r ON rp.role_id = r.id
        INNER JOIN profiles pr ON pr.role = r.name
        WHERE pr.id = $1
      `;
      result = await pool.query(query, [userId]);

      // Log if this fallback was used (means role_id needs to be synced)
      if (result.rows.length > 0) {
        console.warn(`⚠️ User ${userId} loaded permissions via role text fallback - role_id should be synchronized`);
      }
    }

    // 🔄 CONVERT: Convertir les permissions utilisateur EN → FR pour cohérence avec requirePermission
    return result.rows.map(row => convertToFrenchPermission(row.code));
  } catch (error) {
    // If tables don't exist yet (before migration), fall back to role-based
    console.warn('Permission tables not available, using role-based fallback:', error.message);
    return [];
  }
};

// Get user's role information
export const getUserRole = async (userId) => {
  try {
    const query = `
      SELECT r.*
      FROM roles r
      INNER JOIN profiles p ON p.role_id = r.id
      WHERE p.id = $1
    `;
    const result = await pool.query(query, [userId]);
    return result.rows[0] || null;
  } catch (error) {
    console.warn('Roles table not available');
    return null;
  }
};

// Refresh token (issue new token with same user data)
export const refreshToken = (req, res) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'No valid token to refresh',
    });
  }

  const newToken = generateToken(req.user);
  res.json({
    success: true,
    token: newToken,
    expiresIn: JWT_EXPIRES_IN,
  });
};

// Rate limiting middleware
import rateLimit from 'express-rate-limit';

export const loginRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes (reduced from 15)
  max: 20, // 20 attempts per window (increased from 5)
  message: {
    success: false,
    error: 'Too many login attempts. Please try again in 5 minutes.',
    code: 'RATE_LIMITED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per window
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
    code: 'RATE_LIMITED',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export { JWT_SECRET, JWT_EXPIRES_IN, EN_TO_FR_PERMISSION_MAP, EN_TO_FR_ACTION_MAP, convertToFrenchPermission };
