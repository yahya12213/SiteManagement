import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 121: Add "partial" Status to hr_attendance_records ===');
    console.log('Purpose: Replace half_day status with partial for simplified attendance tracking');

    // Step 1: Check current constraint
    console.log('Step 1: Checking current status constraint...');

    const currentConstraint = await client.query(`
      SELECT con.conname, pg_get_constraintdef(con.oid) as definition
      FROM pg_constraint con
      INNER JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'hr_attendance_records'
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) LIKE '%status%'
    `);

    if (currentConstraint.rows.length > 0) {
      console.log('Current constraint:');
      currentConstraint.rows.forEach(row => {
        console.log(`  - ${row.conname}: ${row.definition}`);
      });
    }

    // Step 2: Drop existing status constraint
    console.log('Step 2: Dropping existing status constraint...');

    await client.query(`
      ALTER TABLE hr_attendance_records
        DROP CONSTRAINT IF EXISTS hr_attendance_records_status_check
    `);

    console.log('✓ Old constraint dropped');

    // Step 3: Add new constraint with 'partial' status
    console.log('Step 3: Adding new constraint with partial status...');

    await client.query(`
      ALTER TABLE hr_attendance_records
        ADD CONSTRAINT hr_attendance_records_status_check
        CHECK (status IN ('check_in', 'check_out', 'present', 'late', 'partial', 'weekend', 'absent', 'half_day'))
    `);

    console.log('✓ New constraint added (includes: check_in, check_out, present, late, partial, weekend, absent, half_day)');

    // Step 4: Count existing records by status
    console.log('Step 4: Analyzing existing status distribution...');

    const statusStats = await client.query(`
      SELECT status, COUNT(*) as count
      FROM hr_attendance_records
      GROUP BY status
      ORDER BY count DESC
    `);

    console.log('Current status distribution:');
    statusStats.rows.forEach(row => {
      console.log(`  - ${row.status}: ${row.count} records`);
    });

    await client.query('COMMIT');

    console.log('=== Migration 121 Complete ===');
    console.log('NOTE: The "partial" status is now available. Future updates may migrate half_day → partial.');

    res.json({
      success: true,
      message: 'Migration 121 completed - Added "partial" status to hr_attendance_records',
      constraint_definition: 'CHECK (status IN (\'check_in\', \'check_out\', \'present\', \'late\', \'partial\', \'weekend\', \'absent\', \'half_day\'))',
      status_distribution: statusStats.rows
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 121 Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  } finally {
    client.release();
    await pool.end();
  }
});

export default router;
