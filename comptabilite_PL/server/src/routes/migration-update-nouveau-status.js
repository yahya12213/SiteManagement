/**
 * Migration: Mettre à jour tous les prospects avec statut 'nouveau' vers 'non contacté'
 * Le statut 'nouveau' n'est plus utilisé dans l'application
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  try {
    console.log('🔄 Migration: Mise à jour des statuts "nouveau" vers "non contacté"...');

    // Compter les prospects avec statut 'nouveau'
    const countResult = await pool.query(
      "SELECT COUNT(*) as count FROM prospects WHERE statut_contact = 'nouveau'"
    );
    const countBefore = parseInt(countResult.rows[0].count);

    if (countBefore === 0) {
      return res.json({
        success: true,
        message: 'Aucun prospect avec statut "nouveau" trouvé',
        updated: 0
      });
    }

    // Mettre à jour les prospects
    const updateResult = await pool.query(
      "UPDATE prospects SET statut_contact = 'non contacté' WHERE statut_contact = 'nouveau' RETURNING id"
    );

    console.log(`✅ ${updateResult.rowCount} prospect(s) mis à jour`);

    res.json({
      success: true,
      message: `${updateResult.rowCount} prospect(s) mis à jour de "nouveau" vers "non contacté"`,
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
