/**
 * Migration 143: Ajouter prime_assistante aux formations
 *
 * Permet de configurer une prime versée à l'assistante pour chaque inscription
 * dans une formation donnée.
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Migration 143: Ajout de prime_assistante aux formations...');

    // Vérifier si la colonne existe déjà
    const columnCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'formations' AND column_name = 'prime_assistante'
    `);

    if (columnCheck.rows.length === 0) {
      await client.query(`
        ALTER TABLE formations
        ADD COLUMN prime_assistante DECIMAL(10,2) DEFAULT 0
      `);
      console.log('  - Colonne prime_assistante ajoutée à formations');
    } else {
      console.log('  - Colonne prime_assistante existe déjà');
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 143 completed: prime_assistante ajouté aux formations',
      changes: ['Colonne prime_assistante ajoutée à la table formations']
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 143 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

router.get('/status', async (req, res) => {
  try {
    const columnCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'formations' AND column_name = 'prime_assistante'
    `);

    const applied = columnCheck.rows.length > 0;

    res.json({
      success: true,
      applied,
      message: applied
        ? 'Migration appliquée - Colonne prime_assistante existe'
        : 'Migration non appliquée'
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/rollback', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('ALTER TABLE formations DROP COLUMN IF EXISTS prime_assistante');
    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 143 rolled back successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

export default router;
