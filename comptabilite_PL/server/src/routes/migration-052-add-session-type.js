import express from 'express';
import pg from 'pg';

const { Pool } = pg;
const router = express.Router();

// Database connection
const getPool = () => new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

router.post('/', async (req, res) => {
  const pool = getPool();

  try {
    console.log('🚀 Starting Migration 052: Add session_type to sessions_formation');

    // Step 1: Check if session_type column already exists
    const columnCheck = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'sessions_formation'
      AND column_name = 'session_type'
    `);

    if (columnCheck.rows.length > 0) {
      console.log('✅ Migration 052 already applied - session_type column exists');
      return res.json({
        success: true,
        message: 'Migration 052 already applied',
        alreadyApplied: true
      });
    }

    // Step 2: Add session_type column with CHECK constraint
    console.log('📝 Adding session_type column to sessions_formation...');
    await pool.query(`
      ALTER TABLE sessions_formation
      ADD COLUMN session_type VARCHAR(50) NOT NULL DEFAULT 'presentielle'
      CHECK (session_type IN ('presentielle', 'en_ligne'))
    `);
    console.log('✅ session_type column added');

    // Step 3: Add optional columns for online sessions
    console.log('📝 Adding meeting_platform column...');
    await pool.query(`
      ALTER TABLE sessions_formation
      ADD COLUMN meeting_platform VARCHAR(100)
    `);
    console.log('✅ meeting_platform column added');

    console.log('📝 Adding meeting_link column...');
    await pool.query(`
      ALTER TABLE sessions_formation
      ADD COLUMN meeting_link VARCHAR(500)
    `);
    console.log('✅ meeting_link column added');

    // Step 4: Add index for better performance on session_type filtering
    console.log('📝 Creating index on session_type...');
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_formation_type
      ON sessions_formation(session_type)
    `);
    console.log('✅ Index created');

    // Step 5: Update existing sessions to 'presentielle' (already default, but explicit)
    const updateResult = await pool.query(`
      UPDATE sessions_formation
      SET session_type = 'presentielle'
      WHERE session_type IS NULL
    `);
    console.log(`✅ Updated ${updateResult.rowCount} existing sessions to 'presentielle'`);

    // Step 6: Add comment to column for documentation
    await pool.query(`
      COMMENT ON COLUMN sessions_formation.session_type IS
      'Type de session: presentielle (en face-à-face) ou en_ligne (formation à distance)'
    `);
    console.log('✅ Column comment added');

    console.log('✅ Migration 052 completed successfully!');

    res.json({
      success: true,
      message: 'Migration 052: session_type added to sessions_formation',
      changes: {
        columnsAdded: ['session_type', 'meeting_platform', 'meeting_link'],
        indexesCreated: ['idx_sessions_formation_type'],
        rowsUpdated: updateResult.rowCount
      }
    });

  } catch (error) {
    console.error('❌ Migration 052 failed:', error);
    res.status(500).json({
      success: false,
      error: 'Migration 052 failed',
      details: error.message,
      stack: error.stack
    });
  } finally {
    await pool.end();
  }
});

export default router;
