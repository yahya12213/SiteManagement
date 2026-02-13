import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 042: HR Attendance & Time Tracking Tables
// Creates: hr_work_schedules, hr_employee_schedules, hr_attendance_records,
//          hr_overtime_requests, hr_overtime_records

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 042: HR Attendance & Time Tracking ===');

    // Step 1: Create hr_work_schedules table
    console.log('Step 1: Creating hr_work_schedules table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_work_schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        break_start TIME,
        break_end TIME,
        break_duration_minutes INT DEFAULT 60,
        working_days INT[] DEFAULT '{1,2,3,4,5}',
        total_hours_per_day DECIMAL(4,2),
        tolerance_late_minutes INT DEFAULT 15,
        tolerance_early_leave_minutes INT DEFAULT 10,
        min_hours_for_half_day DECIMAL(4,2) DEFAULT 4,
        valid_from DATE,
        valid_to DATE,
        is_default BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        segment_id TEXT REFERENCES segments(id) ON DELETE SET NULL,
        centre_id UUID, -- Optional: centres table may not exist
        created_by TEXT REFERENCES profiles(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Insert default schedule
    const defaultScheduleExists = await client.query(`
      SELECT COUNT(*) FROM hr_work_schedules WHERE name = 'Horaire Normal'
    `);

    if (parseInt(defaultScheduleExists.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO hr_work_schedules (
          name, description, start_time, end_time, break_start, break_end,
          working_days, tolerance_late_minutes, is_default
        ) VALUES
        ('Horaire Normal', 'Horaire standard de travail', '08:30', '17:30', '13:00', '14:00', '{1,2,3,4,5}', 15, true),
        ('Horaire Ramadan', 'Horaire durant le mois de Ramadan', '09:00', '15:00', NULL, NULL, '{1,2,3,4,5}', 10, false),
        ('Shift Matin', 'Equipe du matin', '06:00', '14:00', '10:00', '10:30', '{1,2,3,4,5,6}', 10, false),
        ('Shift Apres-midi', 'Equipe de l''apres-midi', '14:00', '22:00', '18:00', '18:30', '{1,2,3,4,5,6}', 10, false)
      `);
    }

    console.log('hr_work_schedules table created with default schedules');

    // Step 2: Create hr_employee_schedules table
    console.log('Step 2: Creating hr_employee_schedules table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_employee_schedules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        schedule_id UUID NOT NULL REFERENCES hr_work_schedules(id) ON DELETE RESTRICT,
        start_date DATE NOT NULL,
        end_date DATE,
        reason TEXT,
        created_by TEXT REFERENCES profiles(id),
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT no_overlapping_schedules UNIQUE (employee_id, start_date)
      )
    `);

    console.log('hr_employee_schedules table created');

    // Step 3: Create hr_attendance_records table
    console.log('Step 3: Creating hr_attendance_records table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_attendance_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        attendance_date DATE NOT NULL,
        check_in TIME,
        check_out TIME,
        check_in_location TEXT,
        check_out_location TEXT,
        scheduled_start TIME,
        scheduled_end TIME,
        actual_work_minutes INT DEFAULT 0,
        late_minutes INT DEFAULT 0,
        early_leave_minutes INT DEFAULT 0,
        overtime_minutes INT DEFAULT 0,
        break_minutes INT DEFAULT 0,
        status TEXT DEFAULT 'present' CHECK (status IN ('present', 'absent', 'late', 'half_day', 'holiday', 'leave', 'weekend', 'mission', 'training')),
        absence_type TEXT CHECK (absence_type IN ('justified', 'unjustified', 'mission', 'training', 'leave', 'sick', 'other')),
        absence_justification TEXT,
        notes TEXT,
        is_anomaly BOOLEAN DEFAULT FALSE,
        anomaly_type TEXT CHECK (anomaly_type IN ('no_check_in', 'no_check_out', 'missing_record', 'inconsistent_times', 'excessive_hours', 'manual_entry')),
        anomaly_resolved BOOLEAN DEFAULT FALSE,
        anomaly_resolved_by TEXT REFERENCES profiles(id),
        anomaly_resolved_at TIMESTAMP,
        anomaly_resolution_note TEXT,
        is_manual_entry BOOLEAN DEFAULT FALSE,
        corrected_by TEXT REFERENCES profiles(id),
        correction_reason TEXT,
        corrected_at TIMESTAMP,
        original_check_in TIME,
        original_check_out TIME,
        source TEXT DEFAULT 'system' CHECK (source IN ('system', 'biometric', 'manual', 'import')),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(employee_id, attendance_date)
      )
    `);

    console.log('hr_attendance_records table created');

    // Step 4: Create hr_overtime_requests table
    console.log('Step 4: Creating hr_overtime_requests table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_overtime_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        request_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        estimated_hours DECIMAL(4,2),
        reason TEXT NOT NULL,
        project_code TEXT,
        request_type TEXT DEFAULT 'planned' CHECK (request_type IN ('planned', 'exceptional', 'emergency')),
        status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'completed')),
        priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        requested_by TEXT REFERENCES profiles(id),
        n1_approver_id TEXT REFERENCES profiles(id),
        n1_approved_at TIMESTAMP,
        n1_comment TEXT,
        n2_approver_id TEXT REFERENCES profiles(id),
        n2_approved_at TIMESTAMP,
        n2_comment TEXT,
        final_approver_id TEXT REFERENCES profiles(id),
        final_approved_at TIMESTAMP,
        rejection_reason TEXT,
        cancelled_at TIMESTAMP,
        cancelled_by TEXT REFERENCES profiles(id),
        cancellation_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('hr_overtime_requests table created');

    // Step 5: Create hr_overtime_records table
    console.log('Step 5: Creating hr_overtime_records table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_overtime_records (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        overtime_date DATE NOT NULL,
        request_id UUID REFERENCES hr_overtime_requests(id) ON DELETE SET NULL,
        attendance_id UUID REFERENCES hr_attendance_records(id) ON DELETE SET NULL,
        approved_start TIME,
        approved_end TIME,
        approved_minutes INT NOT NULL,
        actual_start TIME,
        actual_end TIME,
        actual_minutes INT,
        validated_minutes INT,
        rate_type TEXT DEFAULT 'normal' CHECK (rate_type IN ('normal', 'night', 'weekend', 'holiday')),
        rate_multiplier DECIMAL(3,2) DEFAULT 1.25,
        is_night_shift BOOLEAN DEFAULT FALSE,
        is_weekend BOOLEAN DEFAULT FALSE,
        is_holiday BOOLEAN DEFAULT FALSE,
        validated_for_payroll BOOLEAN DEFAULT FALSE,
        validated_by TEXT REFERENCES profiles(id),
        validated_at TIMESTAMP,
        payroll_period TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(employee_id, overtime_date, request_id)
      )
    `);

    console.log('hr_overtime_records table created');

    // Step 6: Create indexes
    console.log('Step 6: Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hr_work_schedules_active ON hr_work_schedules(is_active);
      CREATE INDEX IF NOT EXISTS idx_hr_work_schedules_default ON hr_work_schedules(is_default);

      CREATE INDEX IF NOT EXISTS idx_hr_emp_schedules_employee ON hr_employee_schedules(employee_id);
      CREATE INDEX IF NOT EXISTS idx_hr_emp_schedules_dates ON hr_employee_schedules(start_date, end_date);

      CREATE INDEX IF NOT EXISTS idx_hr_attendance_employee ON hr_attendance_records(employee_id);
      CREATE INDEX IF NOT EXISTS idx_hr_attendance_date ON hr_attendance_records(attendance_date);
      CREATE INDEX IF NOT EXISTS idx_hr_attendance_status ON hr_attendance_records(status);
      CREATE INDEX IF NOT EXISTS idx_hr_attendance_anomaly ON hr_attendance_records(is_anomaly, anomaly_resolved);
      CREATE INDEX IF NOT EXISTS idx_hr_attendance_emp_date ON hr_attendance_records(employee_id, attendance_date);

      CREATE INDEX IF NOT EXISTS idx_hr_ot_requests_employee ON hr_overtime_requests(employee_id);
      CREATE INDEX IF NOT EXISTS idx_hr_ot_requests_date ON hr_overtime_requests(request_date);
      CREATE INDEX IF NOT EXISTS idx_hr_ot_requests_status ON hr_overtime_requests(status);

      CREATE INDEX IF NOT EXISTS idx_hr_ot_records_employee ON hr_overtime_records(employee_id);
      CREATE INDEX IF NOT EXISTS idx_hr_ot_records_date ON hr_overtime_records(overtime_date);
      CREATE INDEX IF NOT EXISTS idx_hr_ot_records_payroll ON hr_overtime_records(validated_for_payroll);
    `);

    console.log('Indexes created');

    // Step 7: Create triggers for updated_at
    console.log('Step 7: Creating triggers...');
    await client.query(`
      DROP TRIGGER IF EXISTS update_hr_work_schedules_updated_at ON hr_work_schedules;
      CREATE TRIGGER update_hr_work_schedules_updated_at
        BEFORE UPDATE ON hr_work_schedules
        FOR EACH ROW EXECUTE FUNCTION update_hr_updated_at();

      DROP TRIGGER IF EXISTS update_hr_attendance_updated_at ON hr_attendance_records;
      CREATE TRIGGER update_hr_attendance_updated_at
        BEFORE UPDATE ON hr_attendance_records
        FOR EACH ROW EXECUTE FUNCTION update_hr_updated_at();

      DROP TRIGGER IF EXISTS update_hr_ot_requests_updated_at ON hr_overtime_requests;
      CREATE TRIGGER update_hr_ot_requests_updated_at
        BEFORE UPDATE ON hr_overtime_requests
        FOR EACH ROW EXECUTE FUNCTION update_hr_updated_at();

      DROP TRIGGER IF EXISTS update_hr_ot_records_updated_at ON hr_overtime_records;
      CREATE TRIGGER update_hr_ot_records_updated_at
        BEFORE UPDATE ON hr_overtime_records
        FOR EACH ROW EXECUTE FUNCTION update_hr_updated_at();
    `);

    console.log('Triggers created');

    await client.query('COMMIT');

    // Get summary
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'hr_%'
      ORDER BY table_name
    `);

    const schedules = await client.query('SELECT COUNT(*) FROM hr_work_schedules');

    console.log('=== Migration 042 Complete ===');

    res.json({
      success: true,
      message: 'Migration 042 completed successfully - HR Attendance & Time Tracking',
      summary: {
        tables_created: ['hr_work_schedules', 'hr_employee_schedules', 'hr_attendance_records', 'hr_overtime_requests', 'hr_overtime_records'],
        default_schedules_created: parseInt(schedules.rows[0].count),
        total_hr_tables: tables.rows.length
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 042 failed:', error);
    res.status(500).json({
      success: false,
      message: 'Migration 042 failed',
      error: error.message
    });
  } finally {
    client.release();
    await pool.end();
  }
});

// Rollback
router.post('/rollback', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Rolling back Migration 042...');

    await client.query('DROP TABLE IF EXISTS hr_overtime_records CASCADE');
    await client.query('DROP TABLE IF EXISTS hr_overtime_requests CASCADE');
    await client.query('DROP TABLE IF EXISTS hr_attendance_records CASCADE');
    await client.query('DROP TABLE IF EXISTS hr_employee_schedules CASCADE');
    await client.query('DROP TABLE IF EXISTS hr_work_schedules CASCADE');

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 042 rolled back successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
    await pool.end();
  }
});

// Status check
router.get('/status', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    const tables = ['hr_work_schedules', 'hr_employee_schedules', 'hr_attendance_records', 'hr_overtime_requests', 'hr_overtime_records'];
    const status = {};

    for (const table of tables) {
      const result = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = $1
        )
      `, [table]);
      status[table] = result.rows[0].exists;
    }

    res.json({
      success: true,
      migrated: Object.values(status).every(v => v === true),
      tables: status
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

export default router;
