import pool from '../config/database.js';

/**
 * Middleware to check if user has a specific permission
 * Admins bypass all permission checks
 * Regular users must have the specific permission code in their role/user permissions
 */
export const checkPermission = (permissionCode) => {
  return async (req, res, next) => {
    try {
      // Admin users have all permissions
      if (req.user && req.user.role === 'admin') {
        return next();
      }

      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED'
        });
      }

      // Use singleton pool from config (no pool leak)
      const result = await pool.query(`
        SELECT DISTINCT p.code
        FROM profiles pr
        LEFT JOIN roles r ON pr.role_id = r.id
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
        LEFT JOIN permissions p ON rp.permission_id = p.id
        WHERE pr.id = $1
          AND (p.code = $2 OR p.code = '*')
      `, [req.user.id, permissionCode]);

      if (result.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'FORBIDDEN',
          required: permissionCode
        });
      }

      // User has permission, continue
      next();

    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Permission validation failed',
        code: 'PERMISSION_CHECK_ERROR'
      });
    }
  };
};

/**
 * Middleware to check if user has ANY of the specified permissions
 */
export const checkAnyPermission = (...permissionCodes) => {
  return async (req, res, next) => {
    try {
      // Admin users have all permissions
      if (req.user && req.user.role === 'admin') {
        return next();
      }

      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'UNAUTHORIZED'
        });
      }

      // Use singleton pool from config (no pool leak)
      const placeholders = permissionCodes.map((_, i) => `$${i + 2}`).join(', ');
      const result = await pool.query(`
        SELECT DISTINCT p.code
        FROM profiles pr
        LEFT JOIN roles r ON pr.role_id = r.id
        LEFT JOIN role_permissions rp ON r.id = rp.role_id
        LEFT JOIN permissions p ON rp.permission_id = p.id
        WHERE pr.id = $1
          AND (p.code IN (${placeholders}) OR p.code = '*')
        LIMIT 1
      `, [req.user.id, ...permissionCodes]);

      if (result.rows.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'FORBIDDEN',
          required_any: permissionCodes
        });
      }

      // User has at least one permission, continue
      next();

    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Permission validation failed',
        code: 'PERMISSION_CHECK_ERROR'
      });
    }
  };
};
