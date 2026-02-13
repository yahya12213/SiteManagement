import express from 'express';
import pkg from 'pg';

const { Pool } = pkg;
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
});

async function runMigration() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Starting migration 020: Update session_etudiants table...');

    // Add centre_id, classe_id, and numero_bon columns
    await client.query(`
      ALTER TABLE session_etudiants
      ADD COLUMN IF NOT EXISTS centre_id TEXT,
      ADD COLUMN IF NOT EXISTS classe_id TEXT,
      ADD COLUMN IF NOT EXISTS numero_bon TEXT
    `);

    console.log('✓ Columns added to session_etudiants table');

    await client.query('COMMIT');
    console.log('Migration 020 completed successfully!');

    return { success: true, message: 'Migration 020 completed successfully!' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 020 failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Route POST pour exécuter la migration via API
router.post('/', async (req, res) => {
  try {
    const result = await runMigration();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Migration 020 failed',
    });
  }
});

export default router;
