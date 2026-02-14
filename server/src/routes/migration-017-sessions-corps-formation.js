import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * Migration 017: Modifier Sessions de Formation pour utiliser Corps de Formation
 *
 * Modifications:
 * - sessions_formation: Remplacer formation_id par corps_formation_id
 * - session_etudiants: Ajouter formation_id pour stocker le choix de chaque étudiant
 */

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 017: Sessions Corps de Formation ===');

    // 1. Modifier la table sessions_formation
    console.log('Modification de la table sessions_formation...');

    // Vérifier si la colonne corps_formation_id existe déjà
    const checkCorpsColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'sessions_formation'
      AND column_name = 'corps_formation_id'
    `);

    if (checkCorpsColumn.rows.length === 0) {
      // Ajouter corps_formation_id
      await client.query(`
        ALTER TABLE sessions_formation
        ADD COLUMN corps_formation_id TEXT
      `);
      console.log('✓ Colonne corps_formation_id ajoutée');
    } else {
      console.log('✓ Colonne corps_formation_id existe déjà');
    }

    // Supprimer formation_id si elle existe
    const checkFormationColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'sessions_formation'
      AND column_name = 'formation_id'
    `);

    if (checkFormationColumn.rows.length > 0) {
      await client.query(`
        ALTER TABLE sessions_formation
        DROP COLUMN IF EXISTS formation_id
      `);
      console.log('✓ Colonne formation_id supprimée');
    } else {
      console.log('✓ Colonne formation_id déjà supprimée');
    }

    // Ajouter index pour performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_formation_corps
      ON sessions_formation(corps_formation_id)
    `);

    // 2. Modifier la table session_etudiants
    console.log('Modification de la table session_etudiants...');

    // Vérifier si la colonne formation_id existe déjà
    const checkEtudiantFormation = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'session_etudiants'
      AND column_name = 'formation_id'
    `);

    if (checkEtudiantFormation.rows.length === 0) {
      // Ajouter formation_id
      await client.query(`
        ALTER TABLE session_etudiants
        ADD COLUMN formation_id TEXT
      `);
      console.log('✓ Colonne formation_id ajoutée à session_etudiants');
    } else {
      console.log('✓ Colonne formation_id existe déjà dans session_etudiants');
    }

    // Ajouter index pour performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_session_etudiants_formation
      ON session_etudiants(formation_id)
    `);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 017 exécutée avec succès',
      changes: [
        'sessions_formation: formation_id → corps_formation_id',
        'session_etudiants: ajout de formation_id'
      ]
    });

    console.log('✅ Migration 017 terminée avec succès');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur lors de la migration 017:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

export default router;
