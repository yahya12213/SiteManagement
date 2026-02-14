/**
 * Migration 152: Date de Livraison Automatique pour Sessions En Ligne
 *
 * Ajoute la colonne original_date_inscription à la table session_etudiants
 * pour préserver la date d'inscription originale.
 *
 * Logique métier:
 * - Quand delivery_status passe de 'non_livree' à 'livree' pour une session en ligne:
 *   → date_inscription devient la date actuelle (date de livraison)
 * - Quand delivery_status repasse de 'livree' à 'non_livree':
 *   → date_inscription est restaurée depuis original_date_inscription
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🔄 Starting Migration 152: Date de Livraison Automatique');

    // Step 1: Vérifier si la colonne existe déjà
    const checkColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'session_etudiants'
        AND column_name = 'original_date_inscription'
    `);

    if (checkColumn.rows.length > 0) {
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'Migration déjà appliquée',
        details: ['⏭️  Colonne original_date_inscription existe déjà']
      });
    }

    // Step 2: Ajouter la colonne original_date_inscription
    console.log('  Step 1: Ajout de la colonne original_date_inscription...');
    await client.query(`
      ALTER TABLE session_etudiants
      ADD COLUMN original_date_inscription TIMESTAMP
    `);
    console.log('  ✅ Colonne original_date_inscription ajoutée');

    // Step 3: Initialiser avec les valeurs actuelles de date_inscription
    console.log('  Step 2: Initialisation des valeurs existantes...');
    const updateResult = await client.query(`
      UPDATE session_etudiants
      SET original_date_inscription = date_inscription
      WHERE original_date_inscription IS NULL
    `);
    console.log(`  ✅ ${updateResult.rowCount} enregistrements initialisés`);

    // Step 4: Créer un index pour optimiser les requêtes
    console.log('  Step 3: Création d\'un index...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_session_etudiants_original_date
      ON session_etudiants(original_date_inscription)
    `);
    console.log('  ✅ Index créé');

    // Step 5: Statistiques finales
    console.log('  Step 4: Collecte des statistiques...');
    const stats = await client.query(`
      SELECT
        COUNT(*) as total_enrollments,
        COUNT(CASE WHEN delivery_status = 'livree' THEN 1 END) as delivered_count,
        COUNT(CASE WHEN delivery_status = 'non_livree' THEN 1 END) as not_delivered_count
      FROM session_etudiants se
      JOIN sessions_formation sf ON sf.id = se.session_id
      WHERE sf.session_type = 'en_ligne'
    `);

    const statsData = stats.rows[0];
    console.log('  📊 Statistiques:');
    console.log(`     - ${statsData.total_enrollments} inscriptions dans des sessions en ligne`);
    console.log(`     - ${statsData.delivered_count} déjà livrées`);
    console.log(`     - ${statsData.not_delivered_count} non livrées`);

    await client.query('COMMIT');
    console.log('✅ Migration 152 complétée avec succès');

    res.json({
      success: true,
      message: 'Migration 152 exécutée avec succès',
      details: [
        '✅ Colonne original_date_inscription ajoutée',
        `✅ ${updateResult.rowCount} enregistrements initialisés`,
        '✅ Index créé',
        '',
        '📊 Statistiques des sessions en ligne:',
        `   - ${statsData.total_enrollments} inscriptions totales`,
        `   - ${statsData.delivered_count} documents livrés`,
        `   - ${statsData.not_delivered_count} documents non livrés`
      ],
      stats: statsData
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 152 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

export default router;
