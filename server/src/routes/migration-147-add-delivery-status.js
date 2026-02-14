/**
 * Migration 147: Ajout du champ delivery_status aux session_etudiants
 *
 * Ajoute la colonne delivery_status à la table session_etudiants
 * pour suivre le statut de livraison des documents aux étudiants des sessions en ligne.
 * Valeurs possibles: 'non_livree' (défaut), 'livree'
 */

import { Router } from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Check migration status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const checkColumn = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'session_etudiants' AND column_name = 'delivery_status'
    `);

    const isApplied = checkColumn.rows.length > 0;

    res.json({
      applied: isApplied,
      message: isApplied
        ? 'Migration déjà appliquée'
        : 'Migration nécessaire - colonne delivery_status manquante'
    });
  } catch (error) {
    console.error('Migration 147 status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Run migration
router.post('/run', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const results = [];

    // ========================================
    // 1. Ajouter colonne delivery_status
    // ========================================

    const checkColumn = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'session_etudiants' AND column_name = 'delivery_status'
    `);

    if (checkColumn.rows.length === 0) {
      await client.query(`
        ALTER TABLE session_etudiants
        ADD COLUMN delivery_status VARCHAR(20) DEFAULT 'non_livree' NOT NULL
      `);
      results.push('✅ Colonne session_etudiants.delivery_status ajoutée');

      // Ajouter la contrainte CHECK
      await client.query(`
        ALTER TABLE session_etudiants
        ADD CONSTRAINT session_etudiants_delivery_status_check
        CHECK (delivery_status IN ('non_livree', 'livree'))
      `);
      results.push('✅ Contrainte CHECK delivery_status ajoutée');
    } else {
      results.push('⏭️ Colonne session_etudiants.delivery_status existe déjà');
    }

    // ========================================
    // 2. Stats finales
    // ========================================

    const etudiantsCount = await client.query(`SELECT COUNT(*) FROM session_etudiants`);
    const nonLivreeCount = await client.query(`
      SELECT COUNT(*) FROM session_etudiants WHERE delivery_status = 'non_livree'
    `);

    results.push('');
    results.push('📊 Statistiques:');
    results.push(`   - ${etudiantsCount.rows[0].count} inscriptions au total`);
    results.push(`   - ${nonLivreeCount.rows[0].count} documents non livrés (défaut)`);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 147 delivery_status exécutée avec succès',
      details: results
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 147 error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

export default router;
