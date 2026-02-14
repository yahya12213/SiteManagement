/**
 * Migration 138: Ajouter champ is_cnss_subject à hr_employees
 *
 * Permet de définir par employé s'il est assujetti à la CNSS/AMO.
 * Par défaut true, mais peut être désactivé pour stagiaires, temps partiel, etc.
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Migration 138: Ajout du champ is_cnss_subject...');

    // Vérifier si la colonne existe déjà
    const columnExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'hr_employees'
        AND column_name = 'is_cnss_subject'
      )
    `);

    if (columnExists.rows[0].exists) {
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'Migration 138 déjà appliquée - is_cnss_subject existe',
        alreadyApplied: true
      });
    }

    // Ajouter la colonne is_cnss_subject
    await client.query(`
      ALTER TABLE hr_employees
      ADD COLUMN is_cnss_subject BOOLEAN DEFAULT true
    `);

    console.log('  - Colonne is_cnss_subject ajoutée');
    console.log('  - Tous les employés sont assujettis CNSS par défaut (modifiable manuellement)');

    // Ajouter la colonne is_amo_subject également (optionnel, même logique)
    await client.query(`
      ALTER TABLE hr_employees
      ADD COLUMN IF NOT EXISTS is_amo_subject BOOLEAN DEFAULT true
    `);

    // Synchroniser avec is_cnss_subject
    await client.query(`
      UPDATE hr_employees
      SET is_amo_subject = is_cnss_subject
    `);

    console.log('  - Colonne is_amo_subject ajoutée et synchronisée');

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 138 completed: Champs is_cnss_subject et is_amo_subject ajoutés',
      changes: [
        'Ajout colonne is_cnss_subject (BOOLEAN DEFAULT true)',
        'Ajout colonne is_amo_subject (BOOLEAN DEFAULT true)',
        'Tous les employés assujettis par défaut (modifiable via interface)'
      ]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 138 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Vérifiez que la table hr_employees existe'
    });
  } finally {
    client.release();
  }
});

// Status endpoint
router.get('/status', async (req, res) => {
  try {
    const columnCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'hr_employees'
        AND column_name = 'is_cnss_subject'
      )
    `);

    const hasColumn = columnCheck.rows[0].exists;

    // Compter les employés par statut CNSS
    let stats = null;
    if (hasColumn) {
      const statsResult = await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE is_cnss_subject = true) as cnss_subject,
          COUNT(*) FILTER (WHERE is_cnss_subject = false) as cnss_exempt,
          COUNT(*) as total
        FROM hr_employees
        WHERE employment_status = 'active'
      `);
      stats = statsResult.rows[0];
    }

    res.json({
      success: true,
      applied: hasColumn,
      message: hasColumn
        ? 'Migration appliquée - is_cnss_subject disponible'
        : 'Migration non appliquée',
      stats
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
