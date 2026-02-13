import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

export async function runMigration122() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('🔄 Migration 122: HR Recovery Management...');

    // Create hr_recovery_periods table
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_recovery_periods (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        total_hours_to_recover DECIMAL(6,2) NOT NULL DEFAULT 0.00,
        hours_recovered DECIMAL(6,2) NOT NULL DEFAULT 0.00,
        hours_remaining DECIMAL(6,2) GENERATED ALWAYS AS (total_hours_to_recover - hours_recovered) STORED,
        department_id TEXT,
        segment_id TEXT,
        centre_id UUID,
        applies_to_all BOOLEAN DEFAULT false,
        status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
        created_by TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT chk_dates CHECK (end_date >= start_date),
        CONSTRAINT chk_hours_positive CHECK (total_hours_to_recover >= 0 AND hours_recovered >= 0)
      )
    `);
    console.log('✅ Created hr_recovery_periods table');

    // Create hr_recovery_declarations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_recovery_declarations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        recovery_period_id UUID NOT NULL REFERENCES hr_recovery_periods(id) ON DELETE CASCADE,
        recovery_date DATE NOT NULL,
        hours_to_recover DECIMAL(5,2) NOT NULL DEFAULT 0.00,
        is_day_off BOOLEAN NOT NULL DEFAULT false,
        department_id TEXT,
        segment_id TEXT,
        centre_id UUID,
        notes TEXT,
        status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
        created_by TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        CONSTRAINT chk_hours_to_recover_positive CHECK (hours_to_recover >= 0)
      )
    `);
    console.log('✅ Created hr_recovery_declarations table');

    // Create hr_employee_recoveries table
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_employee_recoveries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        recovery_declaration_id UUID NOT NULL REFERENCES hr_recovery_declarations(id) ON DELETE CASCADE,
        recovery_date DATE NOT NULL,
        is_day_off BOOLEAN NOT NULL DEFAULT false,
        expected_to_work BOOLEAN NOT NULL DEFAULT false,
        was_present BOOLEAN DEFAULT NULL,
        attendance_record_id UUID REFERENCES hr_attendance_records(id) ON DELETE SET NULL,
        hours_recovered DECIMAL(5,2) DEFAULT 0.00,
        deduction_applied BOOLEAN DEFAULT false,
        deduction_amount DECIMAL(10,2) DEFAULT 0.00,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(employee_id, recovery_declaration_id),
        CONSTRAINT chk_hours_recovered_positive CHECK (hours_recovered >= 0),
        CONSTRAINT chk_deduction_positive CHECK (deduction_amount >= 0)
      )
    `);
    console.log('✅ Created hr_employee_recoveries table');

    // Create indexes for hr_recovery_periods
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_recovery_periods_status
      ON hr_recovery_periods(status)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_recovery_periods_dates
      ON hr_recovery_periods(start_date, end_date)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_recovery_periods_department
      ON hr_recovery_periods(department_id) WHERE department_id IS NOT NULL
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_recovery_periods_segment
      ON hr_recovery_periods(segment_id) WHERE segment_id IS NOT NULL
    `);
    console.log('✅ Created indexes for hr_recovery_periods');

    // Create indexes for hr_recovery_declarations
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_recovery_declarations_period
      ON hr_recovery_declarations(recovery_period_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_recovery_declarations_date
      ON hr_recovery_declarations(recovery_date)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_recovery_declarations_status
      ON hr_recovery_declarations(status)
    `);
    console.log('✅ Created indexes for hr_recovery_declarations');

    // Create indexes for hr_employee_recoveries
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_recoveries_employee
      ON hr_employee_recoveries(employee_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_recoveries_declaration
      ON hr_employee_recoveries(recovery_declaration_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_recoveries_date
      ON hr_employee_recoveries(recovery_date)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_employee_recoveries_deduction
      ON hr_employee_recoveries(deduction_applied) WHERE deduction_applied = true
    `);
    console.log('✅ Created indexes for hr_employee_recoveries');

    // Add updated_at triggers
    await client.query(`
      CREATE OR REPLACE FUNCTION update_hr_recovery_periods_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_update_hr_recovery_periods_updated_at ON hr_recovery_periods;
      CREATE TRIGGER trg_update_hr_recovery_periods_updated_at
        BEFORE UPDATE ON hr_recovery_periods
        FOR EACH ROW
        EXECUTE FUNCTION update_hr_recovery_periods_updated_at();
    `);
    console.log('✅ Created trigger for hr_recovery_periods.updated_at');

    await client.query(`
      CREATE OR REPLACE FUNCTION update_hr_recovery_declarations_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_update_hr_recovery_declarations_updated_at ON hr_recovery_declarations;
      CREATE TRIGGER trg_update_hr_recovery_declarations_updated_at
        BEFORE UPDATE ON hr_recovery_declarations
        FOR EACH ROW
        EXECUTE FUNCTION update_hr_recovery_declarations_updated_at();
    `);
    console.log('✅ Created trigger for hr_recovery_declarations.updated_at');

    await client.query(`
      CREATE OR REPLACE FUNCTION update_hr_employee_recoveries_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_update_hr_employee_recoveries_updated_at ON hr_employee_recoveries;
      CREATE TRIGGER trg_update_hr_employee_recoveries_updated_at
        BEFORE UPDATE ON hr_employee_recoveries
        FOR EACH ROW
        EXECUTE FUNCTION update_hr_employee_recoveries_updated_at();
    `);
    console.log('✅ Created trigger for hr_employee_recoveries.updated_at');

    // Trigger to update hours_recovered in hr_recovery_periods
    await client.query(`
      CREATE OR REPLACE FUNCTION update_recovery_period_hours()
      RETURNS TRIGGER AS $$
      BEGIN
        UPDATE hr_recovery_periods
        SET hours_recovered = (
          SELECT COALESCE(SUM(hours_to_recover), 0)
          FROM hr_recovery_declarations
          WHERE recovery_period_id = COALESCE(NEW.recovery_period_id, OLD.recovery_period_id)
            AND is_day_off = false
            AND status = 'completed'
        )
        WHERE id = COALESCE(NEW.recovery_period_id, OLD.recovery_period_id);
        RETURN COALESCE(NEW, OLD);
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_update_recovery_period_hours ON hr_recovery_declarations;
      CREATE TRIGGER trg_update_recovery_period_hours
        AFTER INSERT OR UPDATE OR DELETE ON hr_recovery_declarations
        FOR EACH ROW
        EXECUTE FUNCTION update_recovery_period_hours();
    `);
    console.log('✅ Created trigger to auto-update hours_recovered');

    // Add new statuses to hr_attendance_records CHECK constraint
    await client.query(`
      DO $$
      BEGIN
        -- Drop existing constraint if it exists
        ALTER TABLE hr_attendance_records
        DROP CONSTRAINT IF EXISTS chk_status;

        -- Add new constraint with recovery statuses
        ALTER TABLE hr_attendance_records
        ADD CONSTRAINT chk_status CHECK (
          status IN (
            'present', 'absent', 'late', 'half_day', 'holiday', 'leave',
            'weekend', 'mission', 'training', 'check_in', 'check_out',
            'recovery_off', 'recovery_day'
          )
        );

        RAISE NOTICE 'Added recovery_off and recovery_day to attendance status constraint';
      EXCEPTION
        WHEN duplicate_object THEN
          RAISE NOTICE 'Constraint chk_status already exists';
        WHEN others THEN
          RAISE EXCEPTION 'Error updating status constraint: %', SQLERRM;
      END $$;
    `);
    console.log('✅ Added recovery_off and recovery_day statuses to hr_attendance_records');

    // Add 'correction' to source CHECK constraint (fixing incohérence #8)
    await client.query(`
      DO $$
      BEGIN
        -- Drop existing constraint if it exists
        ALTER TABLE hr_attendance_records
        DROP CONSTRAINT IF EXISTS chk_source;

        -- Add new constraint with correction source
        ALTER TABLE hr_attendance_records
        ADD CONSTRAINT chk_source CHECK (
          source IN (
            'system', 'biometric', 'manual', 'import', 'self_service', 'correction'
          )
        );

        RAISE NOTICE 'Added correction to attendance source constraint';
      EXCEPTION
        WHEN duplicate_object THEN
          RAISE NOTICE 'Constraint chk_source already exists';
        WHEN others THEN
          RAISE EXCEPTION 'Error updating source constraint: %', SQLERRM;
      END $$;
    `);
    console.log('✅ Added correction to hr_attendance_records.source constraint');

    await client.query('COMMIT');
    console.log('✅ Migration 122 completed successfully');

    return { success: true, message: 'Migration 122 completed: HR Recovery Management tables created' };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 122 failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Route pour exécuter la migration
router.post('/run', async (req, res) => {
  try {
    const result = await runMigration122();
    res.json(result);
  } catch (error) {
    console.error('Migration 122 error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
