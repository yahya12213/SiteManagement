import express from 'express';
import pool from '../config/database.js';
import bcrypt from 'bcryptjs';

const router = express.Router();

// Route de diagnostic pour vérifier l'état de la table profiles
router.get('/check-profiles', async (req, res) => {
  try {
    console.log('🔍 [DEBUG-AUTH] Checking profiles table...');

    // Vérifier si la table profiles existe
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

    // Vérifier la structure de la table profiles
    const structureCheck = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'profiles'
      ORDER BY ordinal_position
    `);

    // Compter les utilisateurs
    const countResult = await pool.query(`
      SELECT COUNT(*) as total_users FROM profiles
    `);

    // Vérifier si un user avec role admin existe (sans révéler les détails sensibles)
    const adminCheck = await pool.query(`
      SELECT
        id,
        username,
        LENGTH(password) as password_length,
        role_id,
        created_at
      FROM profiles
      WHERE role_id = 'admin' OR role_id IN (SELECT id FROM roles WHERE name = 'admin')
      ORDER BY created_at
      LIMIT 5
    `);

    // Vérifier si la table roles existe et son contenu
    const rolesCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'roles'
      ) as roles_table_exists
    `);

    let rolesInfo = null;
    if (rolesCheck.rows[0].roles_table_exists) {
      const rolesData = await pool.query(`
        SELECT id, name, description FROM roles ORDER BY created_at LIMIT 10
      `);
      rolesInfo = rolesData.rows;
    }

    res.json({
      success: true,
      data: {
        table_exists: true,
        total_users: countResult.rows[0].total_users,
        structure: structureCheck.rows,
        admin_users: adminCheck.rows,
        roles_table_exists: rolesCheck.rows[0].roles_table_exists,
        roles: rolesInfo
      }
    });

  } catch (error) {
    console.error('❌ [DEBUG-AUTH] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

// Route pour tester l'authentification d'un username spécifique (sans password)
router.get('/check-user/:username', async (req, res) => {
  try {
    const { username } = req.params;

    console.log('🔍 [DEBUG-AUTH] Checking user:', username);

    const result = await pool.query(`
      SELECT
        p.id,
        p.username,
        LENGTH(p.password) as password_length,
        SUBSTRING(p.password, 1, 10) as password_prefix,
        p.role_id,
        p.created_at,
        p.updated_at,
        r.name as role_name
      FROM profiles p
      LEFT JOIN roles r ON p.role_id = r.id
      WHERE p.username = $1
    `, [username]);

    if (result.rows.length === 0) {
      return res.json({
        success: false,
        error: `User '${username}' not found in profiles table`
      });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });

  } catch (error) {
    console.error('❌ [DEBUG-AUTH] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// TEMPORARY: Force reset password for a user (DEBUG ONLY)
router.get('/reset-password-force/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const newPassword = 'Admin!Secure2026Setup'; // Stronger password

    console.log(`⚠️ [DEBUG-AUTH] Forcing password reset for ${username} to '${newPassword}'`);

    // Check column type to ensure it can hold the hash
    const colCheck = await pool.query(`
      SELECT character_maximum_length, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'profiles' AND column_name = 'password'
    `);

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const result = await pool.query(
      'UPDATE profiles SET password = $1 WHERE username = $2 RETURNING id, username',
      [hashedPassword, username]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: `User ${username} not found`
      });
    }

    res.json({
      success: true,
      message: `Password for ${username} reset to '${newPassword}'`,
      user: result.rows[0],
      columnInfo: colCheck.rows[0]
    });

  } catch (error) {
    console.error('❌ [DEBUG-AUTH] Reset Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
