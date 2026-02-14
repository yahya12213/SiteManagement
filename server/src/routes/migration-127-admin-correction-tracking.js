import express from 'express';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const router = express.Router();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Migration 127: Admin Correction Tracking
// Adds columns to hr_attendance_correction_requests for tracking admin cancellations

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 127: Admin Correction Tracking ===');

    // Read SQL file from server/migrations folder
    const migrationPath = path.join(__dirname, '../../migrations/127-admin-correction-tracking.sql');

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing migration SQL...');

    // Execute the migration SQL
    await client.query(migrationSQL);

    console.log('✓ Migration 127 completed successfully');

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 127 completed successfully - Added admin cancellation tracking to hr_attendance_correction_requests',
      details: {
        columnsAdded: [
          'admin_cancelled_at',
          'admin_cancelled_by',
          'admin_cancellation_reason'
        ],
        indexCreated: 'idx_correction_requests_admin_cancelled'
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 127 Error:', error);

    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Failed to execute migration 127',
      hint: 'Check if columns already exist or database connection is valid'
    });
  } finally {
    client.release();
    await pool.end();
  }
});

// Status check endpoint
router.get('/status', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Check if columns exist
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'hr_attendance_correction_requests'
        AND column_name IN ('admin_cancelled_at', 'admin_cancelled_by', 'admin_cancellation_reason')
      ORDER BY column_name
    `);

    const columnsExist = result.rows.length === 3;

    res.json({
      success: true,
      migrationApplied: columnsExist,
      columns: result.rows,
      message: columnsExist
        ? 'Migration 127 already applied'
        : 'Migration 127 not yet applied'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

export default router;
