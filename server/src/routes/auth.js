import express from 'express';
import pool from '../config/database.js';
import bcrypt from 'bcryptjs';
import { generateToken, loginRateLimiter, authenticateToken, getUserPermissions } from '../middleware/auth.js';

const router = express.Router();

/**
 * Determine which segment/city tables to use based on user role
 * Ensures gérant users query gerant_segments/gerant_cities tables
 * and professors query professor_segments/professor_cities tables
 */
function getTablesForRole(role) {
  if (role === 'gerant') {
    return {
      segmentsTable: 'gerant_segments',
      citiesTable: 'gerant_cities',
      userIdColumn: 'gerant_id'
    };
  }
  // Default to professor tables for backwards compatibility
  return {
    segmentsTable: 'professor_segments',
    citiesTable: 'professor_cities',
    userIdColumn: 'professor_id'
  };
}

// Helper function to check if RBAC tables exist
const checkRbacTablesExist = async () => {
  try {
    const result = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'roles'
      ) as exists
    `);
    return result.rows[0].exists;
  } catch (err) {
    console.warn('Could not check for RBAC tables:', err.message);
    return false;
  }
};

// POST login with JWT token generation
router.post('/login', loginRateLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    // DEBUG: Log login attempt
    console.log('🔍 [LOGIN] Login attempt for username:', username);

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Missing username or password',
      });
    }

    // Check if RBAC tables exist (backward compatibility)
    const rbacEnabled = await checkRbacTablesExist();

    // Strategy 1: Try to find user by username in profiles table
    let result;
    if (rbacEnabled) {
      result = await pool.query(
        `SELECT p.*, r.name as role_name, r.description as role_description
         FROM profiles p
         LEFT JOIN roles r ON p.role_id::uuid = r.id
         WHERE p.username = $1`,
        [username]
      );
    } else {
      // Fallback to old query without role join (backward compatibility)
      result = await pool.query(
        'SELECT * FROM profiles WHERE username = $1',
        [username]
      );
    }

    // Strategy 2: If not found by username, try to find student by CIN
    let user = null;
    let isStudentCINLogin = false;

    if (result.rows.length === 0) {
      // Check if username is a CIN in students table
      const studentResult = await pool.query(
        `SELECT s.*, p.id as profile_id, p.password as profile_password
         FROM students s
         LEFT JOIN profiles p ON p.username = s.cin
         WHERE s.cin = $1`,
        [username.toUpperCase()] // CIN is usually uppercase
      );

      if (studentResult.rows.length > 0) {
        const student = studentResult.rows[0];
        isStudentCINLogin = true;

        // Check if student has a linked profile account
        if (student.profile_id) {
          // Profile exists, use it for authentication
          user = {
            id: student.profile_id,
            username: student.cin,
            full_name: `${student.prenom} ${student.nom}`,
            role: 'student',
            password: student.profile_password,
            student_id: student.id,
            student_cin: student.cin,
            student_email: student.email,
            student_phone: student.phone
          };
        } else {
          // No profile exists yet - create one automatically for CIN-based login
          const hashedPassword = await bcrypt.hash(password, 10);

          const newProfileResult = await pool.query(
            `INSERT INTO profiles (username, password, full_name, role, created_at)
             VALUES ($1, $2, $3, 'student', NOW())
             RETURNING *`,
            [student.cin, hashedPassword, `${student.prenom} ${student.nom}`]
          );

          user = {
            ...newProfileResult.rows[0],
            student_id: student.id,
            student_cin: student.cin,
            student_email: student.email,
            student_phone: student.phone
          };

          console.log(`✅ Auto-created profile for student CIN: ${student.cin}`);
        }
      }
    } else {
      user = result.rows[0];

      // DEBUG: Log user found in database
      console.log('🔍 [LOGIN] User found in database:', {
        id: user.id,
        username: user.username,
        passwordLength: user.password?.length,
        passwordPrefix: user.password?.substring(0, 10),
        roleId: user.role_id,
        role: user.role
      });

      // 🔧 FIX: Sync profiles.role with roles.name for JWT token admin bypass
      // If user has a role_id and we fetched role_name from roles table,
      // but profiles.role is NULL or doesn't match, update it
      if (rbacEnabled && user.role_id && user.role_name && (!user.role || user.role !== user.role_name)) {
        console.log(`🔄 Syncing role for user ${user.username}: "${user.role}" -> "${user.role_name}"`);
        user.role = user.role_name;

        // Update profiles.role in database permanently (self-healing)
        try {
          await pool.query(
            'UPDATE profiles SET role = $1 WHERE id = $2',
            [user.role_name, user.id]
          );
          console.log(`✅ Updated profiles.role to "${user.role_name}" for user ${user.username}`);
        } catch (updateErr) {
          console.warn(`⚠️ Could not update profiles.role in database:`, updateErr.message);
          // Continue anyway - at least the JWT token will have correct role
        }
      }
    }

    // If still no user found, return error
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Verify password
    console.log('🔍 [LOGIN] Comparing passwords...');
    console.log('🔍 [LOGIN] Password provided length:', password?.length);
    console.log('🔍 [LOGIN] Hash in database length:', user.password?.length);

    const isValid = await bcrypt.compare(password, user.password);

    console.log('🔍 [LOGIN] Password comparison result:', isValid);

    if (!isValid) {
      console.log('❌ [LOGIN] Password mismatch for user:', username);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    console.log('✅ [LOGIN] Password valid for user:', username);

    // Additional check for CIN-based login: Verify student is enrolled in at least one online session
    if (isStudentCINLogin && user.student_id) {
      const enrollmentCheck = await pool.query(
        `SELECT COUNT(*) as count
         FROM session_etudiants se
         JOIN sessions_formation sf ON se.session_id = sf.id
         WHERE se.student_id = $1
         AND sf.session_type = 'en_ligne'
         AND se.student_status != 'abandonne'`,
        [user.student_id]
      );

      const enrollmentCount = parseInt(enrollmentCheck.rows[0]?.count || 0);

      if (enrollmentCount === 0) {
        return res.status(403).json({
          success: false,
          error: 'Vous n\'êtes pas inscrit à une session de formation en ligne. Veuillez contacter l\'administration.',
        });
      }

      console.log(`✅ Student ${user.student_cin} verified: enrolled in ${enrollmentCount} online session(s)`);
    }

    // Get user permissions (only if RBAC is enabled)
    let permissions = [];
    if (rbacEnabled) {
      try {
        permissions = await getUserPermissions(user.id);
      } catch (err) {
        console.warn('Could not load permissions (tables may not exist yet):', err.message);
      }
    }

    // Load user's assigned segments and cities for SBAC
    let segment_ids = [];
    let city_ids = [];
    try {
      // Use correct tables based on role (gerant_segments OR professor_segments)
      const tables = getTablesForRole(user.role);

      // Query segments table (professor_segments OR gerant_segments)
      const segmentsResult = await pool.query(
        `SELECT segment_id FROM ${tables.segmentsTable} WHERE ${tables.userIdColumn} = $1`,
        [user.id]
      );
      segment_ids = segmentsResult.rows.map(row => row.segment_id);

      // Query cities table (professor_cities OR gerant_cities)
      const citiesResult = await pool.query(
        `SELECT city_id FROM ${tables.citiesTable} WHERE ${tables.userIdColumn} = $1`,
        [user.id]
      );
      city_ids = citiesResult.rows.map(row => row.city_id);

      console.log(`📊 Loaded scopes for user ${user.username} (${user.role}): ${segment_ids.length} segments, ${city_ids.length} cities`);
    } catch (err) {
      console.warn('Could not load user scopes (tables may not exist yet):', err.message);
    }

    // Add scopes to user object
    user.segment_ids = segment_ids;
    user.city_ids = city_ids;

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    // Generate JWT token
    const token = generateToken(userWithoutPassword);

    // Return user data with token and permissions
    res.json({
      success: true,
      user: userWithoutPassword,
      token,
      permissions,
      expiresIn: '24h',
    });
  } catch (error) {
    console.error('Error during login:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET current user (verify token and get fresh user data)
router.get('/me', authenticateToken, async (req, res) => {
  try {
    // Check if RBAC tables exist (backward compatibility)
    const rbacEnabled = await checkRbacTablesExist();

    let result;
    if (rbacEnabled) {
      result = await pool.query(
        `SELECT p.*, r.name as role_name, r.description as role_description
         FROM profiles p
         LEFT JOIN roles r ON p.role_id::uuid = r.id
         WHERE p.id = $1`,
        [req.user.id]
      );
    } else {
      // Fallback to old query without role join
      result = await pool.query(
        'SELECT * FROM profiles WHERE id = $1',
        [req.user.id]
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = result.rows[0];
    const { password: _, ...userWithoutPassword } = user;

    // Get fresh permissions (only if RBAC is enabled)
    let permissions = [];
    if (rbacEnabled) {
      try {
        permissions = await getUserPermissions(user.id);
      } catch (err) {
        console.warn('Could not load permissions:', err.message);
      }
    }

    res.json({
      success: true,
      user: userWithoutPassword,
      permissions,
    });
  } catch (error) {
    console.error('Error getting current user:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// GET /debug-permissions - Diagnostic endpoint pour déboguer les problèmes de permissions
router.get('/debug-permissions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const debug = {
      timestamp: new Date().toISOString(),
      user: null,
      role: null,
      permissions: [],
      specificPermission: null,
      rolePermissions: [],
      tables: {},
      errors: []
    };

    // 1. Get user info from profiles
    try {
      const userResult = await pool.query(`
        SELECT id, username, role, role_id, full_name, created_at
        FROM profiles
        WHERE id = $1
      `, [userId]);

      if (userResult.rows.length > 0) {
        debug.user = userResult.rows[0];
      } else {
        debug.errors.push('User not found in profiles table');
      }
    } catch (err) {
      debug.errors.push(`Error fetching user: ${err.message}`);
    }

    // 2. Get role info if role_id exists
    if (debug.user && debug.user.role_id) {
      try {
        const roleResult = await pool.query(`
          SELECT id, name, description, created_at
          FROM roles
          WHERE id = $1
        `, [debug.user.role_id]);

        if (roleResult.rows.length > 0) {
          debug.role = roleResult.rows[0];
        } else {
          debug.errors.push(`Role with id ${debug.user.role_id} not found`);
        }
      } catch (err) {
        debug.errors.push(`Error fetching role: ${err.message}`);
      }
    }

    // 3. Get user permissions via getUserPermissions function
    try {
      debug.permissions = await getUserPermissions(userId);
      debug.permissionsCount = debug.permissions.length;
    } catch (err) {
      debug.errors.push(`Error getting user permissions: ${err.message}`);
    }

    // 4. Check specific permission: accounting.calculation_sheets.view_page
    try {
      const permResult = await pool.query(`
        SELECT id, module, menu, action, code, label, sort_order
        FROM permissions
        WHERE code = 'accounting.calculation_sheets.view_page'
      `);

      if (permResult.rows.length > 0) {
        debug.specificPermission = {
          exists: true,
          ...permResult.rows[0],
          userHasIt: debug.permissions.includes('accounting.calculation_sheets.view_page')
        };
      } else {
        debug.specificPermission = {
          exists: false,
          message: 'Permission accounting.calculation_sheets.view_page not found in permissions table'
        };
      }
    } catch (err) {
      debug.errors.push(`Error checking specific permission: ${err.message}`);
    }

    // 5. Get all permissions assigned to user's role
    if (debug.user && debug.user.role_id) {
      try {
        const rolePermsResult = await pool.query(`
          SELECT p.code, p.label, p.module, p.menu, p.action
          FROM permissions p
          INNER JOIN role_permissions rp ON p.id = rp.permission_id
          WHERE rp.role_id = $1
          ORDER BY p.module, p.menu, p.sort_order
        `, [debug.user.role_id]);

        debug.rolePermissions = rolePermsResult.rows;
        debug.rolePermissionsCount = rolePermsResult.rows.length;
      } catch (err) {
        debug.errors.push(`Error fetching role permissions: ${err.message}`);
      }
    }

    // 6. Check tables exist
    try {
      const tablesCheck = await pool.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('profiles', 'roles', 'permissions', 'role_permissions', 'user_roles')
      `);

      debug.tables.existing = tablesCheck.rows.map(r => r.table_name);
      debug.tables.rbacEnabled = rbacEnabled;
    } catch (err) {
      debug.errors.push(`Error checking tables: ${err.message}`);
    }

    // 7. Summary
    debug.summary = {
      userExists: !!debug.user,
      userRole: debug.user?.role,
      userRoleId: debug.user?.role_id,
      roleFound: !!debug.role,
      permissionsLoaded: debug.permissions.length > 0,
      hasCalculationSheetsPermission: debug.permissions.includes('accounting.calculation_sheets.view_page'),
      isAdmin: debug.user?.role === 'admin',
      shouldBypassPermissionCheck: debug.user?.role === 'admin' || debug.permissions.includes('*'),
      recommendation: null
    };

    // 8. Recommendation
    if (debug.summary.isAdmin && !debug.summary.hasCalculationSheetsPermission) {
      debug.summary.recommendation = 'Admin users should bypass permission checks. Check middleware requirePermission() logic.';
    } else if (!debug.summary.hasCalculationSheetsPermission && debug.specificPermission?.exists) {
      debug.summary.recommendation = 'Permission exists in DB but not assigned to user role. Run migration to assign permissions.';
    } else if (!debug.specificPermission?.exists) {
      debug.summary.recommendation = 'Permission does not exist in DB. Run migration 056 to create accounting permissions.';
    } else if (!debug.user?.role_id) {
      debug.summary.recommendation = 'User role_id is NULL. Run migration to sync role_id fields.';
    } else {
      debug.summary.recommendation = 'All checks passed. Logout and login again to refresh token.';
    }

    res.json({
      success: true,
      debug
    });

  } catch (error) {
    console.error('Debug permissions error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// POST refresh token
router.post('/refresh', authenticateToken, (req, res) => {
  try {
    const newToken = generateToken(req.user);

    res.json({
      success: true,
      token: newToken,
      expiresIn: '24h',
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// POST external-login - Authentication endpoint for external applications (Diray Centre)
// This endpoint allows Diray Centre to authenticate students via API
router.post('/external-login', async (req, res) => {
  try {
    const { email, password, app_key } = req.body;

    // Validate API key from external application
    const validApiKey = process.env.DIRAY_API_KEY;
    if (!validApiKey) {
      console.error('❌ [EXTERNAL-LOGIN] DIRAY_API_KEY not configured in environment');
      return res.status(500).json({
        success: false,
        error: 'External authentication not configured',
      });
    }

    if (!app_key || app_key !== validApiKey) {
      console.log('❌ [EXTERNAL-LOGIN] Invalid API key attempt');
      return res.status(401).json({
        success: false,
        error: 'Invalid API key',
      });
    }

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
      });
    }

    console.log('🔍 [EXTERNAL-LOGIN] Authentication attempt for email:', email);

    // Strategy 1: Find student by email in students table
    let studentResult = await pool.query(
      `SELECT s.*, p.id as profile_id, p.password as profile_password, p.username
       FROM students s
       LEFT JOIN profiles p ON p.username = s.cin
       WHERE LOWER(s.email) = LOWER($1)`,
      [email]
    );

    let student = null;
    let user = null;

    if (studentResult.rows.length > 0) {
      student = studentResult.rows[0];

      // Check if student has a linked profile account
      if (student.profile_id) {
        user = {
          id: student.profile_id,
          username: student.cin,
          full_name: `${student.prenom} ${student.nom}`,
          role: 'student',
          password: student.profile_password,
          student_id: student.id,
          student_cin: student.cin,
          student_email: student.email,
          student_phone: student.phone
        };
      } else {
        // No profile exists - return error (profile should be created first)
        return res.status(401).json({
          success: false,
          error: 'No account found. Please contact administration.',
        });
      }
    } else {
      // Strategy 2: Try to find by email in profiles table (for admin/professor accounts if needed)
      const profileResult = await pool.query(
        `SELECT p.*, s.id as student_id, s.cin as student_cin, s.email as student_email, s.phone as student_phone, s.prenom, s.nom
         FROM profiles p
         LEFT JOIN students s ON p.username = s.cin
         WHERE LOWER(p.email) = LOWER($1) OR p.username = $1`,
        [email]
      );

      if (profileResult.rows.length > 0) {
        const profile = profileResult.rows[0];
        user = {
          id: profile.id,
          username: profile.username,
          full_name: profile.full_name || `${profile.prenom || ''} ${profile.nom || ''}`.trim(),
          role: profile.role || 'student',
          password: profile.password,
          student_id: profile.student_id,
          student_cin: profile.student_cin,
          student_email: profile.student_email || profile.email,
          student_phone: profile.student_phone || profile.phone
        };
      }
    }

    // If no user found
    if (!user) {
      console.log('❌ [EXTERNAL-LOGIN] No user found for email:', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      console.log('❌ [EXTERNAL-LOGIN] Password mismatch for email:', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    console.log('✅ [EXTERNAL-LOGIN] Password valid for email:', email);

    // Get student's enrolled formations
    let formations = [];
    if (user.student_id) {
      const formationsResult = await pool.query(
        `SELECT DISTINCT f.id, f.nom as name, f.code, sf.id as session_id, sf.nom as session_name,
                sf.date_debut, sf.date_fin, sf.session_type
         FROM session_etudiants se
         JOIN sessions_formation sf ON se.session_id = sf.id
         JOIN formations f ON sf.formation_id = f.id
         WHERE se.student_id = $1
         AND se.student_status != 'abandonne'
         ORDER BY sf.date_debut DESC`,
        [user.student_id]
      );
      formations = formationsResult.rows;
    }

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    // Generate JWT token
    const token = generateToken(userWithoutPassword);

    // Return success response with student data
    res.json({
      success: true,
      student: {
        id: user.student_id,
        profile_id: user.id,
        cin: user.student_cin,
        full_name: user.full_name,
        email: user.student_email,
        phone: user.student_phone,
        role: user.role,
        formations: formations
      },
      token,
      expiresIn: '24h',
    });

    console.log(`✅ [EXTERNAL-LOGIN] Successful login for student: ${user.full_name} (${user.student_email})`);

  } catch (error) {
    console.error('❌ [EXTERNAL-LOGIN] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed. Please try again.',
    });
  }
});

// POST logout (client-side token removal, but we can log it)
router.post('/logout', authenticateToken, (req, res) => {
  // In a more advanced system, you would invalidate the token here
  // For now, just acknowledge the logout
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// POST change password
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters',
      });
    }

    // Get current user
    const userResult = await pool.query(
      'SELECT * FROM profiles WHERE id = $1',
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
      });
    }

    const user = userResult.rows[0];

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect',
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await pool.query(
      'UPDATE profiles SET password = $1 WHERE id = $2',
      [hashedPassword, req.user.id]
    );

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// TEMPORARY DEBUG ROUTE - NO AUTH REQUIRED
// To diagnose 401 login issue
router.get('/debug-check-admin', async (req, res) => {
  try {
    console.log('🔍 [DEBUG] Checking admin user in profiles table...');

    // Check if profiles table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'profiles'
      ) as table_exists
    `);

    if (!tableCheck.rows[0].table_exists) {
      return res.json({
        success: false,
        error: 'Table profiles does not exist!'
      });
    }

    // Get all column names from profiles table
    const columnsCheck = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'profiles'
      ORDER BY ordinal_position
    `);

    // Count total users
    const countResult = await pool.query(`
      SELECT COUNT(*) as total_users FROM profiles
    `);

    // Check for admin users (try both role_id values)
    const adminCheck = await pool.query(`
      SELECT
        id,
        username,
        LENGTH(password) as password_length,
        SUBSTRING(password, 1, 10) as password_prefix,
        role_id,
        created_at
      FROM profiles
      WHERE role_id = 'admin' OR username LIKE '%admin%'
      ORDER BY created_at
      LIMIT 10
    `);

    res.json({
      success: true,
      data: {
        table_exists: true,
        total_users: countResult.rows[0].total_users,
        columns: columnsCheck.rows,
        admin_users: adminCheck.rows
      }
    });

  } catch (error) {
    console.error('❌ [DEBUG] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

export default router;
