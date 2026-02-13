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

    console.log('=== Migration 124: Create Recovery Tables ===');
    console.log('Purpose: Create hr_recovery_periods, hr_recovery_declarations, hr_employee_recoveries tables');

    // Table 1: hr_recovery_periods
    console.log('Step 1: Creating hr_recovery_periods table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_recovery_periods (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        total_hours_to_recover NUMERIC(5,2) DEFAULT 0 CHECK (total_hours_to_recover >= 0),
        hours_recovered NUMERIC(5,2) DEFAULT 0 CHECK (hours_recovered >= 0),
        hours_remaining NUMERIC(5,2) GENERATED ALWAYS AS (total_hours_to_recover - hours_recovered) STORED,
        department_id TEXT,
        segment_id TEXT,
        centre_id UUID,
        applies_to_all BOOLEAN DEFAULT false,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
        created_by TEXT REFERENCES profiles(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CHECK (start_date <= end_date)
      )
    `);

    console.log('✓ hr_recovery_periods table created');

    // Table 2: hr_recovery_declarations
    console.log('Step 2: Creating hr_recovery_declarations table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_recovery_declarations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recovery_period_id UUID NOT NULL REFERENCES hr_recovery_periods(id) ON DELETE CASCADE,
        recovery_date DATE NOT NULL,
        hours_to_recover NUMERIC(5,2) NOT NULL CHECK (hours_to_recover > 0),
        is_day_off BOOLEAN DEFAULT false,
        department_id TEXT,
        segment_id TEXT,
        centre_id UUID,
        notes TEXT,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
        created_by TEXT REFERENCES profiles(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('✓ hr_recovery_declarations table created');

    // Table 3: hr_employee_recoveries
    console.log('Step 3: Creating hr_employee_recoveries table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_employee_recoveries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        recovery_declaration_id UUID NOT NULL REFERENCES hr_recovery_declarations(id) ON DELETE CASCADE,
        recovery_date DATE NOT NULL,
        is_day_off BOOLEAN DEFAULT false,
        expected_to_work BOOLEAN DEFAULT false,
        was_present BOOLEAN,
        hours_recovered NUMERIC(5,2) DEFAULT 0 CHECK (hours_recovered >= 0),
        deduction_applied BOOLEAN DEFAULT false,
        deduction_amount NUMERIC(10,2) DEFAULT 0 CHECK (deduction_amount >= 0),
        attendance_record_id UUID REFERENCES hr_attendance_records(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(employee_id, recovery_declaration_id)
      )
    `);

    console.log('✓ hr_employee_recoveries table created');

    // Create indexes
    console.log('Step 4: Creating indexes...');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_recovery_periods_status
        ON hr_recovery_periods(status);
      CREATE INDEX IF NOT EXISTS idx_recovery_periods_dates
        ON hr_recovery_periods(start_date, end_date);
      CREATE INDEX IF NOT EXISTS idx_recovery_periods_dept
        ON hr_recovery_periods(department_id) WHERE department_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_recovery_periods_segment
        ON hr_recovery_periods(segment_id) WHERE segment_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_recovery_declarations_date
        ON hr_recovery_declarations(recovery_date);
      CREATE INDEX IF NOT EXISTS idx_recovery_declarations_period
        ON hr_recovery_declarations(recovery_period_id);
      CREATE INDEX IF NOT EXISTS idx_recovery_declarations_status
        ON hr_recovery_declarations(status);

      CREATE INDEX IF NOT EXISTS idx_employee_recoveries_emp_date
        ON hr_employee_recoveries(employee_id, recovery_date);
      CREATE INDEX IF NOT EXISTS idx_employee_recoveries_declaration
        ON hr_employee_recoveries(recovery_declaration_id);
      CREATE INDEX IF NOT EXISTS idx_employee_recoveries_attendance
        ON hr_employee_recoveries(attendance_record_id) WHERE attendance_record_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_employee_recoveries_deduction
        ON hr_employee_recoveries(deduction_applied) WHERE deduction_applied = true;
    `);

    console.log('✓ Indexes created');

    // Verify tables exist
    console.log('Step 5: Verifying tables...');

    const tablesCheck = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('hr_recovery_periods', 'hr_recovery_declarations', 'hr_employee_recoveries')
      ORDER BY table_name
    `);

    console.log(`Tables verified: ${tablesCheck.rows.map(r => r.table_name).join(', ')}`);

    await client.query('COMMIT');

    console.log('=== Migration 124 Complete ===');

    res.json({
      success: true,
      message: 'Migration 124 completed - Recovery tables created successfully',
      tables: tablesCheck.rows
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 124 Error:', error);
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
