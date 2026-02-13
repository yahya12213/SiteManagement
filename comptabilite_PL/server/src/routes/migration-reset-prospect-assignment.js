/**
 * Migration: Reset assigned_to to NULL for all prospects
 *
 * Les prospects ne sont plus assignés à des utilisateurs spécifiques.
 * Les assistantes voient les prospects basés sur leurs villes assignées (via professor_cities).
 * La colonne "Assigné à" affichera "À assigner" pour indiquer qu'aucun utilisateur
 * n'est explicitement assigné au prospect.
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  try {
    console.log('🔄 Migration: Reset de assigned_to pour tous les prospects...');

    // Compter les prospects avec assigned_to non null
    const countResult = await pool.query(
      "SELECT COUNT(*) as count FROM prospects WHERE assigned_to IS NOT NULL"
    );
    const countBefore = parseInt(countResult.rows[0].count);

    if (countBefore === 0) {
      return res.json({
        success: true,
        message: 'Aucun prospect avec assigned_to à réinitialiser',
        updated: 0
      });
    }

    // Reset assigned_to et is_auto_assigned
    const updateResult = await pool.query(`
      UPDATE prospects
      SET
        assigned_to = NULL,
        is_auto_assigned = false,
        updated_at = NOW()
      WHERE assigned_to IS NOT NULL
      RETURNING id
    `);

    console.log(`✅ ${updateResult.rowCount} prospect(s) mis à jour (assigned_to = NULL)`);

    res.json({
      success: true,
      message: `${updateResult.rowCount} prospect(s) - assigned_to réinitialisé à NULL`,
      updated: updateResult.rowCount
    });

  } catch (error) {
    console.error('❌ Erreur migration:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
