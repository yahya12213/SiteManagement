import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * Migration 022: Add discount columns to session_etudiants
 * Adds discount_amount and discount_reason to session_etudiants table
 */
router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Starting migration 022: Add discount columns to session_etudiants...');

    // Check if columns already exist
    const checkColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'session_etudiants'
      AND column_name IN ('discount_amount', 'discount_reason')
    `);

    const existingColumns = checkColumns.rows.map(row => row.column_name);

    // Add discount_amount if it doesn't exist
    if (!existingColumns.includes('discount_amount')) {
      await client.query(`
        ALTER TABLE session_etudiants
        ADD COLUMN discount_amount DECIMAL(10, 2) DEFAULT 0 CHECK (discount_amount >= 0)
      `);
      console.log('✓ Column discount_amount added to session_etudiants');
    } else {
      console.log('✓ Column discount_amount already exists in session_etudiants');
    }

    // Add discount_reason if it doesn't exist
    if (!existingColumns.includes('discount_reason')) {
      await client.query(`
        ALTER TABLE session_etudiants
        ADD COLUMN discount_reason TEXT
      `);
      console.log('✓ Column discount_reason added to session_etudiants');
    } else {
      console.log('✓ Column discount_reason already exists in session_etudiants');
    }

    await client.query('COMMIT');
    console.log('Migration 022 completed successfully!');

    res.json({
      success: true,
      message: 'Migration 022 completed successfully!',
      columnsAdded: existingColumns.length === 2 ? [] : ['discount_amount', 'discount_reason'].filter(col => !existingColumns.includes(col))
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 022 failed:', error);
    res.status(500).json({
      success: false,
      error: 'Migration 022 failed',
      details: error.message
    });
  } finally {
    client.release();
  }
});

export default router;
