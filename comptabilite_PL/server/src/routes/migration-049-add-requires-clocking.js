import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 049: Add requires_clocking column to hr_employees
// Allows distinguishing employees who must clock in/out from contractors/vacataires

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 049: Add requires_clocking to hr_employees ===');

    // Check if column already exists
    const checkColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'hr_employees'
        AND column_name = 'requires_clocking'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✓ Column requires_clocking already exists - skipping');
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'Migration 049 already applied - requires_clocking column exists',
        skipped: true
      });
    }

    // Add requires_clocking column
    console.log('Adding requires_clocking column...');
    await client.query(`
      ALTER TABLE hr_employees
      ADD COLUMN requires_clocking BOOLEAN DEFAULT false NOT NULL
    `);
    console.log('✓ Column requires_clocking added');

    // Add comment to column
    await client.query(`
      COMMENT ON COLUMN hr_employees.requires_clocking IS
      'Indicates if employee must clock in/out for attendance tracking. False for contractors/vacataires.'
    `);

    await client.query('COMMIT');

    console.log('=== Migration 049 Complete ===');

    res.json({
      success: true,
      message: 'Migration 049 completed successfully - Added requires_clocking column to hr_employees',
      details: 'Employees can now be marked as requiring clock in/out for attendance tracking'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 049 Error:', error);

    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Failed to add requires_clocking column',
      hint: 'Check if the hr_employees table exists and if Migration 041 has been run'
    });
  } finally {
    client.release();
    await pool.end();
  }
});

// Check migration status
router.get('/status', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    const checkColumn = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'hr_employees'
        AND column_name = 'requires_clocking'
    `);

    const columnExists = checkColumn.rows.length > 0;

    res.json({
      status: {
        migrationNeeded: !columnExists,
        applied: columnExists,
        column_requires_clocking: columnExists
      },
      message: columnExists
        ? 'Migration 049 applied - requires_clocking column exists'
        : 'Migration needed - requires_clocking column does not exist'
    });
  } catch (error) {
    res.status(500).json({
      status: {
        migrationNeeded: true,
        applied: false,
        error: error.message
      },
      message: `Error checking status: ${error.message}`
    });
  } finally {
    await pool.end();
  }
});

export default router;
