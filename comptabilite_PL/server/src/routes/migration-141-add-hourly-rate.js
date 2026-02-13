/**
 * Migration 141: Ajouter hourly_rate à hr_employees
 *
 * Ajoute la colonne salaire horaire pour le calcul de paie.
 * Les champs is_cnss_subject et is_amo_subject existent déjà (migration 138).
 */

import express from 'express';
import pg from 'pg';

const { Pool } = pg;
const router = express.Router();

const getPool = () => new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Run migration
router.post('/run', async (req, res) => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    console.log('Migration 141: Adding hourly_rate to hr_employees...');

    await client.query('BEGIN');

    // Check if column already exists
    const checkColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'hr_employees' AND column_name = 'hourly_rate'
    `);

    if (checkColumn.rows.length === 0) {
      // Add hourly_rate column
      await client.query(`
        ALTER TABLE hr_employees
        ADD COLUMN hourly_rate DECIMAL(10,2)
      `);
      console.log('  ✓ Colonne hourly_rate ajoutée');
    } else {
      console.log('  - Colonne hourly_rate existe déjà');
    }

    // Also verify is_cnss_subject and is_amo_subject exist (from migration 138)
    const checkCnss = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'hr_employees' AND column_name = 'is_cnss_subject'
    `);

    const checkAmo = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'hr_employees' AND column_name = 'is_amo_subject'
    `);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 141 appliquée avec succès',
      changes: [
        checkColumn.rows.length === 0 ? 'Colonne hourly_rate ajoutée' : 'Colonne hourly_rate existait déjà',
        checkCnss.rows.length > 0 ? 'Colonne is_cnss_subject présente' : 'ATTENTION: is_cnss_subject manquante',
        checkAmo.rows.length > 0 ? 'Colonne is_amo_subject présente' : 'ATTENTION: is_amo_subject manquante'
      ]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 141 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Vérifiez que la table hr_employees existe'
    });
  } finally {
    client.release();
    await pool.end();
  }
});

// Status endpoint
router.get('/status', async (req, res) => {
  const pool = getPool();

  try {
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'hr_employees'
        AND column_name IN ('hourly_rate', 'is_cnss_subject', 'is_amo_subject')
    `);

    const columns = result.rows.map(r => r.column_name);
    const allPresent = ['hourly_rate', 'is_cnss_subject', 'is_amo_subject'].every(c => columns.includes(c));

    res.json({
      success: true,
      applied: allPresent,
      columns: columns,
      message: allPresent
        ? 'Toutes les colonnes (hourly_rate, is_cnss_subject, is_amo_subject) sont présentes'
        : `Colonnes manquantes: ${['hourly_rate', 'is_cnss_subject', 'is_amo_subject'].filter(c => !columns.includes(c)).join(', ')}`
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

export default router;
