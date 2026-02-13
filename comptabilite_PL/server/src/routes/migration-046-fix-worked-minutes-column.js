import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 046: Fix Column Name - Rename actual_work_minutes to worked_minutes
// This fixes the mismatch between the migration schema and application code

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 046: Fix worked_minutes Column Name ===');

    // Check if column already renamed
    const checkColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'hr_attendance_records'
        AND column_name IN ('actual_work_minutes', 'worked_minutes')
    `);

    const columns = checkColumn.rows.map(r => r.column_name);

    if (columns.includes('worked_minutes') && !columns.includes('actual_work_minutes')) {
      console.log('✓ Column already renamed to worked_minutes - skipping');
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'Migration 046 already applied - column already named worked_minutes',
        skipped: true
      });
    }

    if (!columns.includes('actual_work_minutes')) {
      console.log('⚠ Column actual_work_minutes does not exist - migration may not be needed');
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'Migration 046 not needed - neither column exists (table may not exist)',
        skipped: true
      });
    }

    // Rename the column
    console.log('Renaming actual_work_minutes to worked_minutes...');
    await client.query(`
      ALTER TABLE hr_attendance_records
      RENAME COLUMN actual_work_minutes TO worked_minutes
    `);
    console.log('✓ Column renamed successfully');

    await client.query('COMMIT');

    console.log('=== Migration 046 Complete ===');

    res.json({
      success: true,
      message: 'Migration 046 completed successfully - Column renamed from actual_work_minutes to worked_minutes'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 046 Error:', error);

    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Failed to rename column actual_work_minutes to worked_minutes',
      hint: 'Check if the hr_attendance_records table exists and if Migration 042 has been run'
    });
  } finally {
    client.release();
    await pool.end();
  }
});

export default router;
