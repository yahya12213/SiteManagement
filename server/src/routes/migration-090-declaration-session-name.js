/**
 * Migration 090: Ajout du champ session_name aux déclarations
 *
 * Ajoute la colonne session_name à la table professor_declarations
 * pour permettre aux utilisateurs de nommer leurs sessions.
 */

import { Router } from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Check migration status
router.get('/migration-090/status', authenticateToken, async (req, res) => {
  try {
    const checkColumn = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'professor_declarations' AND column_name = 'session_name'
    `);

    const isApplied = checkColumn.rows.length > 0;

    res.json({
      applied: isApplied,
      message: isApplied
        ? 'Migration déjà appliquée'
        : 'Migration nécessaire - colonne session_name manquante'
    });
  } catch (error) {
    console.error('Migration 090 status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Run migration
router.post('/migration-090/run', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const results = [];

    // ========================================
    // 1. Ajouter colonne session_name
    // ========================================

    const checkColumn = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'professor_declarations' AND column_name = 'session_name'
    `);

    if (checkColumn.rows.length === 0) {
      await client.query(`
        ALTER TABLE professor_declarations
        ADD COLUMN session_name VARCHAR(255) DEFAULT ''
      `);
      results.push('✅ Colonne professor_declarations.session_name ajoutée');
    } else {
      results.push('⏭️ Colonne professor_declarations.session_name existe déjà');
    }

    // ========================================
    // 2. Stats finales
    // ========================================

    const declarationsCount = await client.query(`SELECT COUNT(*) FROM professor_declarations`);
    const emptySessionNames = await client.query(`
      SELECT COUNT(*) FROM professor_declarations WHERE session_name = '' OR session_name IS NULL
    `);

    results.push('');
    results.push('📊 Statistiques:');
    results.push(`   - ${declarationsCount.rows[0].count} déclarations au total`);
    results.push(`   - ${emptySessionNames.rows[0].count} déclarations sans nom de session`);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 090 session_name exécutée avec succès',
      details: results
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 090 error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

export default router;
