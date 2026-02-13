import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 044: HR Settings, Monthly Summaries & Audit Log

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 044: HR Settings & Monthly Summaries ===');

    // Step 1: Create hr_settings table
    console.log('Step 1: Creating hr_settings table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        setting_key TEXT UNIQUE NOT NULL,
        setting_value JSONB NOT NULL,
        category TEXT DEFAULT 'general',
        description TEXT,
        is_editable BOOLEAN DEFAULT TRUE,
        updated_at TIMESTAMP DEFAULT NOW(),
        updated_by TEXT REFERENCES profiles(id)
      )
    `);

    // Insert default settings
    const settingsExist = await client.query(`SELECT COUNT(*) FROM hr_settings`);
    if (parseInt(settingsExist.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO hr_settings (setting_key, setting_value, category, description) VALUES
        ('attendance_rules', '{
          "late_tolerance_minutes": 15,
          "early_leave_tolerance_minutes": 10,
          "min_hours_for_full_day": 7,
          "min_hours_for_half_day": 3.5,
          "auto_mark_absent_after_hours": 2,
          "require_justification_for_absence": true
        }'::jsonb, 'attendance', 'Regles de pointage et presence'),

        ('overtime_rules', '{
          "require_prior_approval": true,
          "exceptional_allowed": true,
          "max_hours_per_day": 4,
          "max_hours_per_week": 10,
          "max_hours_per_month": 40,
          "rate_normal": 1.25,
          "rate_night": 1.5,
          "rate_weekend": 1.5,
          "rate_holiday": 2.0,
          "night_start_time": "21:00",
          "night_end_time": "06:00"
        }'::jsonb, 'overtime', 'Regles des heures supplementaires'),

        ('leave_rules', '{
          "annual_leave_accrual_rate": 1.5,
          "annual_leave_max_days": 18,
          "allow_negative_balance": false,
          "max_negative_days": 0,
          "carry_over_allowed": true,
          "max_carry_over_days": 10,
          "carry_over_expiry_months": 3,
          "min_advance_notice_days": 3,
          "block_overlapping_requests": true
        }'::jsonb, 'leave', 'Regles de gestion des conges'),

        ('workflow_rules', '{
          "leave_n2_threshold_days": 5,
          "leave_hr_approval_required": false,
          "overtime_n2_threshold_hours": 3,
          "discipline_requires_hr": true,
          "contract_alert_days": [60, 30, 15],
          "probation_alert_days": [60, 30, 15]
        }'::jsonb, 'workflow', 'Configuration des workflows de validation'),

        ('payroll_integration', '{
          "export_format": "csv",
          "include_overtime": true,
          "include_leave_deductions": true,
          "include_late_deductions": true,
          "late_deduction_per_minute": 0,
          "absence_deduction_per_day": 0,
          "auto_generate_monthly": false,
          "generation_day": 25
        }'::jsonb, 'payroll', 'Integration avec le systeme de paie'),

        ('notifications', '{
          "email_enabled": false,
          "notify_on_leave_request": true,
          "notify_on_overtime_request": true,
          "notify_on_contract_expiry": true,
          "notify_on_probation_end": true,
          "notify_on_anomaly": true,
          "reminder_days_before": 3
        }'::jsonb, 'notifications', 'Configuration des notifications')
      `);
    }

    console.log('hr_settings table created with defaults');

    // Step 2: Create hr_monthly_summaries table
    console.log('Step 2: Creating hr_monthly_summaries table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_monthly_summaries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        year INT NOT NULL,
        month INT NOT NULL CHECK (month >= 1 AND month <= 12),
        contract_id UUID REFERENCES hr_contracts(id),

        -- Working days
        total_working_days INT DEFAULT 0,
        days_worked INT DEFAULT 0,
        days_absent INT DEFAULT 0,
        days_leave_paid INT DEFAULT 0,
        days_leave_unpaid INT DEFAULT 0,
        days_sick INT DEFAULT 0,
        days_mission INT DEFAULT 0,
        days_training INT DEFAULT 0,
        days_holiday INT DEFAULT 0,
        days_weekend INT DEFAULT 0,

        -- Hours
        scheduled_hours DECIMAL(6,2) DEFAULT 0,
        actual_hours DECIMAL(6,2) DEFAULT 0,
        normal_hours DECIMAL(6,2) DEFAULT 0,
        overtime_hours_125 DECIMAL(6,2) DEFAULT 0,
        overtime_hours_150 DECIMAL(6,2) DEFAULT 0,
        overtime_hours_200 DECIMAL(6,2) DEFAULT 0,
        night_hours DECIMAL(6,2) DEFAULT 0,
        holiday_hours DECIMAL(6,2) DEFAULT 0,

        -- Attendance issues
        late_count INT DEFAULT 0,
        late_total_minutes INT DEFAULT 0,
        early_leave_count INT DEFAULT 0,
        early_leave_total_minutes INT DEFAULT 0,
        unjustified_absences INT DEFAULT 0,
        justified_absences INT DEFAULT 0,
        anomaly_count INT DEFAULT 0,

        -- Leave balances
        leave_balance_start DECIMAL(5,2) DEFAULT 0,
        leave_accrued DECIMAL(5,2) DEFAULT 0,
        leave_taken DECIMAL(5,2) DEFAULT 0,
        leave_balance_end DECIMAL(5,2) DEFAULT 0,

        -- Financial (for payroll)
        base_salary DECIMAL(10,2),
        overtime_amount DECIMAL(10,2) DEFAULT 0,
        deductions_late DECIMAL(10,2) DEFAULT 0,
        deductions_absence DECIMAL(10,2) DEFAULT 0,
        gross_salary DECIMAL(10,2),

        -- Status
        status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'reviewed', 'validated', 'exported', 'locked')),
        generated_at TIMESTAMP,
        reviewed_by TEXT REFERENCES profiles(id),
        reviewed_at TIMESTAMP,
        review_notes TEXT,
        validated_by TEXT REFERENCES profiles(id),
        validated_at TIMESTAMP,
        validation_notes TEXT,
        exported_at TIMESTAMP,
        exported_by TEXT REFERENCES profiles(id),
        export_reference TEXT,
        locked_at TIMESTAMP,
        locked_by TEXT REFERENCES profiles(id),

        -- Metadata
        data_snapshot JSONB,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),

        UNIQUE(employee_id, year, month)
      )
    `);

    console.log('hr_monthly_summaries table created');

    // Step 3: Create hr_audit_log table
    console.log('Step 3: Creating hr_audit_log table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        table_name TEXT NOT NULL,
        record_id UUID NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'approve', 'reject', 'cancel', 'correct', 'validate', 'export')),
        old_values JSONB,
        new_values JSONB,
        changed_fields TEXT[],
        reason TEXT,
        ip_address TEXT,
        user_agent TEXT,
        performed_by TEXT REFERENCES profiles(id),
        performed_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('hr_audit_log table created');

    // Step 4: Create indexes
    console.log('Step 4: Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hr_settings_key ON hr_settings(setting_key);
      CREATE INDEX IF NOT EXISTS idx_hr_settings_category ON hr_settings(category);

      CREATE INDEX IF NOT EXISTS idx_hr_monthly_employee ON hr_monthly_summaries(employee_id);
      CREATE INDEX IF NOT EXISTS idx_hr_monthly_period ON hr_monthly_summaries(year, month);
      CREATE INDEX IF NOT EXISTS idx_hr_monthly_status ON hr_monthly_summaries(status);
      CREATE INDEX IF NOT EXISTS idx_hr_monthly_emp_period ON hr_monthly_summaries(employee_id, year, month);

      CREATE INDEX IF NOT EXISTS idx_hr_audit_table ON hr_audit_log(table_name);
      CREATE INDEX IF NOT EXISTS idx_hr_audit_record ON hr_audit_log(record_id);
      CREATE INDEX IF NOT EXISTS idx_hr_audit_action ON hr_audit_log(action);
      CREATE INDEX IF NOT EXISTS idx_hr_audit_date ON hr_audit_log(performed_at);
      CREATE INDEX IF NOT EXISTS idx_hr_audit_user ON hr_audit_log(performed_by);
    `);

    // Step 5: Create triggers
    console.log('Step 5: Creating triggers...');
    await client.query(`
      DROP TRIGGER IF EXISTS update_hr_settings_updated_at ON hr_settings;
      CREATE TRIGGER update_hr_settings_updated_at
        BEFORE UPDATE ON hr_settings
        FOR EACH ROW EXECUTE FUNCTION update_hr_updated_at();

      DROP TRIGGER IF EXISTS update_hr_monthly_updated_at ON hr_monthly_summaries;
      CREATE TRIGGER update_hr_monthly_updated_at
        BEFORE UPDATE ON hr_monthly_summaries
        FOR EACH ROW EXECUTE FUNCTION update_hr_updated_at();
    `);

    await client.query('COMMIT');

    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'hr_%'
      ORDER BY table_name
    `);

    const settings = await client.query('SELECT COUNT(*) FROM hr_settings');

    console.log('=== Migration 044 Complete ===');

    res.json({
      success: true,
      message: 'Migration 044 completed - HR Settings & Monthly Summaries',
      summary: {
        tables_created: ['hr_settings', 'hr_monthly_summaries', 'hr_audit_log'],
        default_settings: parseInt(settings.rows[0].count),
        total_hr_tables: tables.rows.length
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 044 failed:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
    await pool.end();
  }
});

router.post('/rollback', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    await pool.query('DROP TABLE IF EXISTS hr_audit_log CASCADE');
    await pool.query('DROP TABLE IF EXISTS hr_monthly_summaries CASCADE');
    await pool.query('DROP TABLE IF EXISTS hr_settings CASCADE');

    res.json({ success: true, message: 'Migration 044 rolled back' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

router.get('/status', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    const tables = ['hr_settings', 'hr_monthly_summaries', 'hr_audit_log'];
    const status = {};

    for (const table of tables) {
      const result = await pool.query(`
        SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)
      `, [table]);
      status[table] = result.rows[0].exists;
    }

    res.json({
      success: true,
      migrated: Object.values(status).every(v => v),
      tables: status
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

export default router;
