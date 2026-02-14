/**
 * Migration: Add historique_rdv column to prospects table
 *
 * Cette colonne stocke l'historique des RDV passés lors des réinjections
 * Format: "15/12/2024 10:30, 18/12/2024 14:00, ..."
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  try {
    console.log('🔄 Migration: Ajout de la colonne historique_rdv...');

    // Vérifier si la colonne existe déjà
    const checkColumn = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'prospects'
        AND column_name = 'historique_rdv'
    `);

    if (checkColumn.rows.length > 0) {
      return res.json({
        success: true,
        message: 'La colonne historique_rdv existe déjà',
        created: false
      });
    }

    // Ajouter la colonne
    await pool.query(`
      ALTER TABLE prospects
      ADD COLUMN historique_rdv TEXT DEFAULT NULL
    `);

    // Ajouter un commentaire sur la colonne
    await pool.query(`
      COMMENT ON COLUMN prospects.historique_rdv IS 'Historique des dates de RDV lors des réinjections (format: dd/mm/yyyy hh:mm, ...)'
    `);

    console.log('✅ Colonne historique_rdv ajoutée avec succès');

    res.json({
      success: true,
      message: 'Colonne historique_rdv ajoutée à la table prospects',
      created: true
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
