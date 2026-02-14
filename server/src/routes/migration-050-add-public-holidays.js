import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 050: Create hr_public_holidays table
// Stores public holidays that affect attendance calculations

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 050: Create hr_public_holidays table ===');

    // Check if table already exists
    const checkTable = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'hr_public_holidays'
    `);

    if (checkTable.rows.length > 0) {
      console.log('✓ Table hr_public_holidays already exists - skipping');
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'Migration 050 already applied - hr_public_holidays table exists',
        skipped: true
      });
    }

    // Create hr_public_holidays table
    console.log('Creating hr_public_holidays table...');
    await client.query(`
      CREATE TABLE hr_public_holidays (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        holiday_date DATE NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        is_recurring BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ Table hr_public_holidays created');

    // Create index on holiday_date for faster lookups
    await client.query(`
      CREATE INDEX idx_hr_public_holidays_date ON hr_public_holidays(holiday_date)
    `);
    console.log('✓ Index created on holiday_date');

    // Add comments
    await client.query(`
      COMMENT ON TABLE hr_public_holidays IS
      'Stores public holidays and non-working days for attendance calculations';

      COMMENT ON COLUMN hr_public_holidays.holiday_date IS
      'Date of the public holiday';

      COMMENT ON COLUMN hr_public_holidays.is_recurring IS
      'If true, holiday recurs annually (e.g., national day)';
    `);

    await client.query('COMMIT');

    console.log('=== Migration 050 Complete ===');

    res.json({
      success: true,
      message: 'Migration 050 completed successfully - Created hr_public_holidays table',
      details: 'Admin can now manage public holidays for attendance tracking'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 050 Error:', error);

    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Failed to create hr_public_holidays table',
      hint: 'Check database connection and permissions'
    });
  } finally {
    client.release();
    await pool.end();
  }
});

export default router;
