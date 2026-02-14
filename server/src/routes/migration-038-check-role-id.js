/**
 * Migration 038 - Debug role_id in database
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.get('/status', async (req, res) => {
  try {
    // Check if role_id column exists
    const columnCheck = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'profiles' AND column_name = 'role_id'
    `);

    // Get El mehdi's profile with role_id
    const elmehdiResult = await pool.query(`
      SELECT id, username, full_name, role, role_id
      FROM profiles
      WHERE LOWER(full_name) LIKE '%mehdi%'
    `);

    // Get role mapping
    const rolesResult = await pool.query('SELECT id, name FROM roles');

    res.json({
      success: true,
      columnExists: columnCheck.rows.length > 0,
      columnInfo: columnCheck.rows[0],
      elmehdiProfile: elmehdiResult.rows[0],
      allRoles: rolesResult.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
