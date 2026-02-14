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

    console.log('=== Migration 125: Update Status CHECK Constraint ===');
    console.log('Purpose: Add partial (bug fix), sortie_anticipee, recovery_off, recovery_day statuses');

    // Step 1: Check current constraint
    console.log('Step 1: Checking current constraint...');

    const currentConstraint = await client.query(`
      SELECT pg_get_constraintdef(con.oid) as definition
      FROM pg_constraint con
      INNER JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'hr_attendance_records'
        AND con.conname = 'hr_attendance_records_status_check'
    `);

    if (currentConstraint.rows.length > 0) {
      console.log('Current constraint:', currentConstraint.rows[0].definition);
    }

    // Step 2: Drop existing constraint
    console.log('Step 2: Dropping existing status constraint...');

    await client.query(`
      ALTER TABLE hr_attendance_records
        DROP CONSTRAINT IF EXISTS hr_attendance_records_status_check
    `);

    console.log('✓ Old constraint dropped');

    // Step 3: Add new constraint
    console.log('Step 3: Adding new constraint with all statuses...');

    await client.query(`
      ALTER TABLE hr_attendance_records
        ADD CONSTRAINT hr_attendance_records_status_check
        CHECK (status IN (
          -- Statuts existants
          'present', 'absent', 'late', 'half_day', 'holiday', 'leave',
          'weekend', 'mission', 'training', 'check_in', 'check_out',
          -- BUG FIX: Statut utilisé mais manquant
          'partial',
          -- Nouveaux statuts
          'sortie_anticipee',
          'recovery_off',
          'recovery_day'
        ))
    `);

    console.log('✓ New constraint added');
    console.log('  Statuts ajoutés:');
    console.log('    - partial (BUG FIX: déjà utilisé ligne 604 mais absent)');
    console.log('    - sortie_anticipee (départ anticipé, remplace late pour ce cas)');
    console.log('    - recovery_off (jour de récupération chomé)');
    console.log('    - recovery_day (jour de récupération travaillé)');

    // Step 4: Verify new constraint
    console.log('Step 4: Verifying new constraint...');

    const newConstraint = await client.query(`
      SELECT pg_get_constraintdef(con.oid) as definition
      FROM pg_constraint con
      INNER JOIN pg_class rel ON rel.oid = con.conrelid
      WHERE rel.relname = 'hr_attendance_records'
        AND con.conname = 'hr_attendance_records_status_check'
    `);

    console.log('New constraint:', newConstraint.rows[0].definition);

    // Step 5: Count existing records by status
    console.log('Step 5: Analyzing existing status distribution...');

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

    console.log('=== Migration 125 Complete ===');
    console.log('NOTE: The system can now use 4 new statuses: partial, sortie_anticipee, recovery_off, recovery_day');

    res.json({
      success: true,
      message: 'Migration 125 completed - Status constraint updated successfully',
      constraint_definition: newConstraint.rows[0].definition,
      status_distribution: statusStats.rows,
      new_statuses: ['partial', 'sortie_anticipee', 'recovery_off', 'recovery_day']
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 125 Error:', error);
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
