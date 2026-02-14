/**
 * Migration: Add historique_villes column to prospects table
 *
 * Cette colonne stocke l'historique des villes déclarées lors des réinjections
 * Format: "Agadir, Beni Mellal, Casablanca, ..."
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  try {
    console.log('🔄 Migration: Ajout de la colonne historique_villes...');

    // Vérifier si la colonne existe déjà
    const checkColumn = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'prospects'
        AND column_name = 'historique_villes'
    `);

    if (checkColumn.rows.length > 0) {
      return res.json({
        success: true,
        message: 'La colonne historique_villes existe déjà',
        created: false
      });
    }

    // Ajouter la colonne
    await pool.query(`
      ALTER TABLE prospects
      ADD COLUMN historique_villes TEXT DEFAULT NULL
    `);

    // Ajouter un commentaire sur la colonne
    await pool.query(`
      COMMENT ON COLUMN prospects.historique_villes IS 'Historique des villes déclarées lors des réinjections (format: Ville1, Ville2, ...)'
    `);

    console.log('✅ Colonne historique_villes ajoutée avec succès');

    res.json({
      success: true,
      message: 'Colonne historique_villes ajoutée à la table prospects',
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
