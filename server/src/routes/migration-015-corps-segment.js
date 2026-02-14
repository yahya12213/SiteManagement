import express from 'express';
import pkg from 'pg';
const { Pool } = pkg;

const router = express.Router();
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

/**
 * Migration 015: Add segment_id to corps_formation
 *
 * Permet d'affecter chaque corps de formation à un segment géographique
 */
router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🔄 Migration 015 - Add segment_id to corps_formation - Démarrage...');

    // 1. Vérifier si la colonne segment_id existe déjà
    const checkColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'corps_formation'
      AND column_name = 'segment_id'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ La colonne segment_id existe déjà');
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'Migration déjà effectuée',
        already_migrated: true
      });
    }

    // 2. Ajouter la colonne segment_id
    console.log('📦 Ajout de la colonne segment_id à corps_formation...');
    await client.query(`
      ALTER TABLE corps_formation
      ADD COLUMN segment_id TEXT REFERENCES segments(id) ON DELETE SET NULL
    `);
    console.log('✅ Colonne segment_id ajoutée');

    // 3. Créer un index pour améliorer les performances
    console.log('🔍 Création de l\'index sur segment_id...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_corps_segment
      ON corps_formation(segment_id)
    `);
    console.log('✅ Index créé');

    await client.query('COMMIT');

    console.log('✅ Migration 015 terminée avec succès');

    res.status(200).json({
      success: true,
      message: 'Migration 015 effectuée avec succès',
      changes: [
        'Ajout de la colonne segment_id à corps_formation',
        'Création de l\'index idx_corps_segment'
      ]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur lors de la migration 015:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

export default router;
