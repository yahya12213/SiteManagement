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

    console.log('Starting migration 019: Create centres and classes tables...');

    // Create centres table
    await client.query(`
      CREATE TABLE IF NOT EXISTS centres (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        name TEXT NOT NULL,
        adresse TEXT,
        ville TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✓ Centres table created');

    // Create classes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS classes (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        name TEXT NOT NULL,
        centre_id TEXT NOT NULL,
        niveau TEXT,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log('✓ Classes table created');

    // Create index on centre_id for fast lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_classes_centre_id ON classes(centre_id)
    `);

    console.log('✓ Index on centre_id created');

    // Insert some default centres and classes for testing
    await client.query(`
      INSERT INTO centres (id, name, ville)
      VALUES
        ('centre-1', 'Centre Principal', 'Casablanca'),
        ('centre-2', 'Centre Rabat', 'Rabat'),
        ('centre-3', 'Centre Marrakech', 'Marrakech')
      ON CONFLICT (id) DO NOTHING
    `);

    console.log('✓ Default centres inserted');

    await client.query(`
      INSERT INTO classes (name, centre_id, niveau)
      VALUES
        ('Classe A', 'centre-1', 'Débutant'),
        ('Classe B', 'centre-1', 'Intermédiaire'),
        ('Classe C', 'centre-1', 'Avancé'),
        ('Classe A', 'centre-2', 'Débutant'),
        ('Classe B', 'centre-2', 'Intermédiaire')
      ON CONFLICT DO NOTHING
    `);

    console.log('✓ Default classes inserted');

    await client.query('COMMIT');
    console.log('Migration 019 completed successfully!');

    return { success: true, message: 'Migration 019 completed successfully!' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 019 failed:', error);
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
      message: 'Migration 019 failed',
    });
  }
});

export default router;
