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

    console.log('Starting migration 021: Rename formation_id to corps_formation_id...');

    // Check if the column formation_id exists
    const checkColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'sessions_formation'
      AND column_name = 'formation_id'
    `);

    if (checkColumn.rows.length > 0) {
      // Drop existing index on formation_id
      await client.query(`
        DROP INDEX IF EXISTS idx_sessions_formation_formation
      `);
      console.log('✓ Dropped old index on formation_id');

      // Rename column from formation_id to corps_formation_id
      await client.query(`
        ALTER TABLE sessions_formation
        RENAME COLUMN formation_id TO corps_formation_id
      `);
      console.log('✓ Renamed column formation_id to corps_formation_id');

      // Create new index on corps_formation_id
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_sessions_formation_corps
        ON sessions_formation(corps_formation_id)
      `);
      console.log('✓ Created new index on corps_formation_id');
    } else {
      console.log('✓ Column formation_id does not exist, skipping rename (already migrated)');
    }

    await client.query('COMMIT');
    console.log('Migration 021 completed successfully!');

    return { success: true, message: 'Migration 021 completed successfully!' };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 021 failed:', error);
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
      message: 'Migration 021 failed',
    });
  }
});

export default router;
