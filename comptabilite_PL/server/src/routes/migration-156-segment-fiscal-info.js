/**
 * Migration 156: Add fiscal information to segments
 *
 * Adds:
 * - identifiant_fiscal (IF)
 * - registre_commerce (RC)
 * - ice
 * - company_address
 */
import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.get('/run', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🚀 Starting migration 156: Add fiscal info to segments...');

    // Add identifiant_fiscal column
    await client.query(`
      ALTER TABLE segments
      ADD COLUMN IF NOT EXISTS identifiant_fiscal VARCHAR(50)
    `);
    console.log('✅ Added identifiant_fiscal column');

    // Add registre_commerce column
    await client.query(`
      ALTER TABLE segments
      ADD COLUMN IF NOT EXISTS registre_commerce VARCHAR(50)
    `);
    console.log('✅ Added registre_commerce column');

    // Add ICE column
    await client.query(`
      ALTER TABLE segments
      ADD COLUMN IF NOT EXISTS ice VARCHAR(20)
    `);
    console.log('✅ Added ice column');

    // Add company_address column
    await client.query(`
      ALTER TABLE segments
      ADD COLUMN IF NOT EXISTS company_address TEXT
    `);
    console.log('✅ Added company_address column');

    await client.query('COMMIT');
    console.log('✅ Migration 156 completed successfully');

    res.json({
      success: true,
      message: 'Migration 156 completed: Fiscal info columns added to segments table',
      columns_added: ['identifiant_fiscal', 'registre_commerce', 'ice', 'company_address']
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 156 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Status check
router.get('/status', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'segments'
      AND column_name IN ('identifiant_fiscal', 'registre_commerce', 'ice', 'company_address')
    `);

    const existingColumns = result.rows.map(r => r.column_name);
    const requiredColumns = ['identifiant_fiscal', 'registre_commerce', 'ice', 'company_address'];
    const allExist = requiredColumns.every(col => existingColumns.includes(col));

    res.json({
      success: true,
      migrated: allExist,
      existing_columns: existingColumns,
      missing_columns: requiredColumns.filter(col => !existingColumns.includes(col))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
