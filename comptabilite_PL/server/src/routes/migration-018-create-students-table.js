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

    console.log('Starting migration 018: Create students table...');

    // Create students table
    await client.query(`
      CREATE TABLE IF NOT EXISTS students (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        nom TEXT NOT NULL,
        prenom TEXT NOT NULL,
        cin TEXT UNIQUE NOT NULL,
        email TEXT,
        phone TEXT NOT NULL,
        whatsapp TEXT,
        date_naissance DATE NOT NULL,
        lieu_naissance TEXT NOT NULL,
        adresse TEXT NOT NULL,
        statut_compte TEXT DEFAULT 'actif' CHECK (statut_compte IN ('actif', 'inactif', 'suspendu', 'diplome')),
        profile_image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✓ Students table created');

    // Create index on CIN for fast lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_students_cin ON students(cin)
    `);

    console.log('✓ Index on CIN created');

    await client.query('COMMIT');
    console.log('Migration 018 completed successfully!');

    return { success: true, message: 'Migration 018 completed successfully!' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 018 failed:', error);
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
      message: 'Migration 018 failed',
    });
  }
});

export default router;
