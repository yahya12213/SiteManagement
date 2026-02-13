import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * Migration 025: Add discount percentage system to session_etudiants
 * Adds discount_percentage and formation_original_price columns
 * Migrates existing discount_amount data to percentage format
 */
router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Starting migration 025: Add discount percentage system...');

    // Check if columns already exist
    const checkColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'session_etudiants'
      AND column_name IN ('discount_percentage', 'formation_original_price')
    `);

    const existingColumns = checkColumns.rows.map(row => row.column_name);

    // Add discount_percentage if it doesn't exist
    if (!existingColumns.includes('discount_percentage')) {
      await client.query(`
        ALTER TABLE session_etudiants
        ADD COLUMN discount_percentage DECIMAL(5, 2) DEFAULT 0
        CHECK (discount_percentage >= 0 AND discount_percentage <= 100)
      `);
      console.log('✓ Column discount_percentage added to session_etudiants');
    } else {
      console.log('✓ Column discount_percentage already exists in session_etudiants');
    }

    // Add formation_original_price if it doesn't exist
    if (!existingColumns.includes('formation_original_price')) {
      await client.query(`
        ALTER TABLE session_etudiants
        ADD COLUMN formation_original_price DECIMAL(10, 2)
      `);
      console.log('✓ Column formation_original_price added to session_etudiants');
    } else {
      console.log('✓ Column formation_original_price already exists in session_etudiants');
    }

    // Migrate existing data
    console.log('Migrating existing discount data to percentage format...');

    // Update formation_original_price and discount_percentage for existing records
    // formation_original_price = montant_total + discount_amount
    // discount_percentage = (discount_amount / formation_original_price) * 100
    await client.query(`
      UPDATE session_etudiants
      SET
        formation_original_price = COALESCE(montant_total, 0) + COALESCE(discount_amount, 0),
        discount_percentage = CASE
          WHEN (COALESCE(montant_total, 0) + COALESCE(discount_amount, 0)) > 0
          THEN ROUND((COALESCE(discount_amount, 0) / (COALESCE(montant_total, 0) + COALESCE(discount_amount, 0))) * 100, 2)
          ELSE 0
        END
      WHERE formation_original_price IS NULL
    `);

    const migrationResult = await client.query(`
      SELECT COUNT(*) as count
      FROM session_etudiants
      WHERE formation_original_price IS NOT NULL
    `);

    console.log(`✓ Migrated ${migrationResult.rows[0].count} records`);

    await client.query('COMMIT');
    console.log('Migration 025 completed successfully!');

    res.json({
      success: true,
      message: 'Migration 025 completed successfully!',
      columnsAdded: ['discount_percentage', 'formation_original_price'].filter(col => !existingColumns.includes(col)),
      recordsMigrated: migrationResult.rows[0].count
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 025 failed:', error);
    res.status(500).json({
      success: false,
      error: 'Migration 025 failed',
      details: error.message
    });
  } finally {
    client.release();
  }
});

export default router;
