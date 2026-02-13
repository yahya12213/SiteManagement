/**
 * Migration 144: Ajouter champs objectif d'inscription aux employés
 *
 * Ajoute:
 * - inscription_objective: Nombre d'inscriptions à atteindre
 * - objective_period_start: Début de la période d'objectif
 * - objective_period_end: Fin de la période d'objectif
 *
 * Ces champs permettent de valider si l'employé a atteint son objectif
 * pour que ses primes soient comptabilisées dans le bulletin de paie.
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Migration 144: Ajout des champs objectif aux employés...');

    // Vérifier et ajouter inscription_objective
    const col1Check = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'hr_employees' AND column_name = 'inscription_objective'
    `);

    if (col1Check.rows.length === 0) {
      await client.query(`
        ALTER TABLE hr_employees
        ADD COLUMN inscription_objective INTEGER DEFAULT 0
      `);
      console.log('  - Colonne inscription_objective ajoutée');
    }

    // Vérifier et ajouter objective_period_start
    const col2Check = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'hr_employees' AND column_name = 'objective_period_start'
    `);

    if (col2Check.rows.length === 0) {
      await client.query(`
        ALTER TABLE hr_employees
        ADD COLUMN objective_period_start DATE
      `);
      console.log('  - Colonne objective_period_start ajoutée');
    }

    // Vérifier et ajouter objective_period_end
    const col3Check = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'hr_employees' AND column_name = 'objective_period_end'
    `);

    if (col3Check.rows.length === 0) {
      await client.query(`
        ALTER TABLE hr_employees
        ADD COLUMN objective_period_end DATE
      `);
      console.log('  - Colonne objective_period_end ajoutée');
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 144 completed: Champs objectif ajoutés aux employés',
      changes: [
        'Colonne inscription_objective ajoutée',
        'Colonne objective_period_start ajoutée',
        'Colonne objective_period_end ajoutée'
      ]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 144 failed:', error);
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
    const columnsCheck = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'hr_employees'
        AND column_name IN ('inscription_objective', 'objective_period_start', 'objective_period_end')
    `);

    const applied = columnsCheck.rows.length === 3;
    const partiallyApplied = columnsCheck.rows.length > 0 && columnsCheck.rows.length < 3;

    res.json({
      success: true,
      applied,
      partiallyApplied,
      existingColumns: columnsCheck.rows.map(r => r.column_name),
      message: applied
        ? 'Migration appliquée - Tous les champs objectif existent'
        : partiallyApplied
          ? 'Migration partiellement appliquée'
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
    await client.query('ALTER TABLE hr_employees DROP COLUMN IF EXISTS inscription_objective');
    await client.query('ALTER TABLE hr_employees DROP COLUMN IF EXISTS objective_period_start');
    await client.query('ALTER TABLE hr_employees DROP COLUMN IF EXISTS objective_period_end');
    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 144 rolled back successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

export default router;
