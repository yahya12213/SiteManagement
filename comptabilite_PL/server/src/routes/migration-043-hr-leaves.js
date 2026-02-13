import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 043: HR Leaves Management Tables

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 043: HR Leaves Management ===');

    // Step 1: Create hr_leave_types table
    console.log('Step 1: Creating hr_leave_types table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_leave_types (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        is_paid BOOLEAN DEFAULT TRUE,
        requires_justification BOOLEAN DEFAULT FALSE,
        max_days_per_year INT,
        min_days_per_request DECIMAL(3,1) DEFAULT 0.5,
        max_days_per_request INT,
        accrual_rate DECIMAL(5,2),
        accrual_frequency TEXT DEFAULT 'monthly' CHECK (accrual_frequency IN ('monthly', 'yearly', 'none')),
        can_be_negative BOOLEAN DEFAULT FALSE,
        max_negative_balance DECIMAL(5,2) DEFAULT 0,
        requires_n2_approval BOOLEAN DEFAULT FALSE,
        min_days_for_n2 INT DEFAULT 5,
        advance_notice_days INT DEFAULT 3,
        can_carry_over BOOLEAN DEFAULT TRUE,
        max_carry_over_days INT,
        carry_over_expiry_months INT DEFAULT 3,
        color TEXT DEFAULT '#3B82F6',
        icon TEXT,
        sort_order INT DEFAULT 0,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Insert default leave types
    const typesExist = await client.query(`SELECT COUNT(*) FROM hr_leave_types`);
    if (parseInt(typesExist.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO hr_leave_types (code, name, description, is_paid, accrual_rate, max_days_per_year, color, sort_order) VALUES
        ('ANNUAL', 'Conge Annuel', 'Conge paye annuel legal', true, 1.5, 18, '#10B981', 1),
        ('SICK', 'Conge Maladie', 'Absence pour maladie avec justificatif', true, NULL, NULL, '#EF4444', 2),
        ('MATERNITY', 'Conge Maternite', 'Conge maternite legal', true, NULL, 98, '#EC4899', 3),
        ('PATERNITY', 'Conge Paternite', 'Conge paternite', true, NULL, 3, '#8B5CF6', 4),
        ('UNPAID', 'Conge Sans Solde', 'Absence non remuneree', false, NULL, NULL, '#6B7280', 5),
        ('MARRIAGE', 'Conge Mariage', 'Conge pour mariage', true, NULL, 4, '#F59E0B', 6),
        ('BEREAVEMENT', 'Conge Deces', 'Conge pour deces d''un proche', true, NULL, 3, '#374151', 7),
        ('MISSION', 'Mission', 'Deplacement professionnel', true, NULL, NULL, '#0EA5E9', 8),
        ('TRAINING', 'Formation', 'Formation professionnelle', true, NULL, NULL, '#14B8A6', 9),
        ('AUTHORIZATION', 'Autorisation d''absence', 'Absence autorisee courte duree', true, NULL, 2, '#F97316', 10)
      `);
    }

    console.log('hr_leave_types table created with defaults');

    // Step 2: Create hr_leave_balances table
    console.log('Step 2: Creating hr_leave_balances table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_leave_balances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        leave_type_id UUID NOT NULL REFERENCES hr_leave_types(id) ON DELETE CASCADE,
        year INT NOT NULL,
        initial_balance DECIMAL(5,2) DEFAULT 0,
        accrued DECIMAL(5,2) DEFAULT 0,
        taken DECIMAL(5,2) DEFAULT 0,
        carried_over DECIMAL(5,2) DEFAULT 0,
        adjusted DECIMAL(5,2) DEFAULT 0,
        adjustment_reason TEXT,
        last_accrual_date DATE,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(employee_id, leave_type_id, year)
      )
    `);

    // Add computed column for current balance
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'hr_leave_balances' AND column_name = 'current_balance'
        ) THEN
          ALTER TABLE hr_leave_balances
          ADD COLUMN current_balance DECIMAL(5,2) GENERATED ALWAYS AS (
            initial_balance + accrued + carried_over + adjusted - taken
          ) STORED;
        END IF;
      END $$;
    `);

    console.log('hr_leave_balances table created');

    // Step 3: Create hr_leave_requests table
    console.log('Step 3: Creating hr_leave_requests table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_leave_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        leave_type_id UUID NOT NULL REFERENCES hr_leave_types(id),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        start_half_day BOOLEAN DEFAULT FALSE,
        end_half_day BOOLEAN DEFAULT FALSE,
        days_requested DECIMAL(5,2) NOT NULL,
        reason TEXT,
        justification_url TEXT,
        contact_during_leave TEXT,
        handover_notes TEXT,
        status TEXT DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'approved_n1', 'approved_n2', 'approved', 'rejected', 'cancelled', 'completed')),
        current_approver_level TEXT DEFAULT 'n1' CHECK (current_approver_level IN ('n1', 'n2', 'hr', 'completed')),
        n1_approver_id TEXT REFERENCES profiles(id),
        n1_status TEXT CHECK (n1_status IN ('pending', 'approved', 'rejected')),
        n1_comment TEXT,
        n1_action_at TIMESTAMP,
        n2_approver_id TEXT REFERENCES profiles(id),
        n2_status TEXT CHECK (n2_status IN ('pending', 'approved', 'rejected', 'not_required')),
        n2_comment TEXT,
        n2_action_at TIMESTAMP,
        hr_approver_id TEXT REFERENCES profiles(id),
        hr_status TEXT CHECK (hr_status IN ('pending', 'approved', 'rejected', 'not_required')),
        hr_comment TEXT,
        hr_action_at TIMESTAMP,
        final_status TEXT,
        final_comment TEXT,
        cancelled_at TIMESTAMP,
        cancelled_by TEXT REFERENCES profiles(id),
        cancellation_reason TEXT,
        balance_deducted BOOLEAN DEFAULT FALSE,
        created_by TEXT REFERENCES profiles(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('hr_leave_requests table created');

    // Step 4: Create hr_holidays table
    console.log('Step 4: Creating hr_holidays table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_holidays (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        description TEXT,
        holiday_date DATE NOT NULL,
        holiday_type TEXT DEFAULT 'paid' CHECK (holiday_type IN ('paid', 'unpaid', 'worked_with_bonus', 'optional')),
        bonus_multiplier DECIMAL(3,2) DEFAULT 2.0,
        compensatory_days DECIMAL(3,1) DEFAULT 0,
        applies_to_all BOOLEAN DEFAULT TRUE,
        segment_id TEXT REFERENCES segments(id) ON DELETE CASCADE,
        centre_id UUID, -- Optional: centres table may not exist
        department TEXT,
        year INT NOT NULL,
        is_recurring BOOLEAN DEFAULT TRUE,
        recurring_month INT,
        recurring_day INT,
        created_by TEXT REFERENCES profiles(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Insert default Moroccan holidays for current year
    const currentYear = new Date().getFullYear();
    const holidaysExist = await client.query(`SELECT COUNT(*) FROM hr_holidays WHERE year = $1`, [currentYear]);

    if (parseInt(holidaysExist.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO hr_holidays (name, holiday_date, holiday_type, year, is_recurring, recurring_month, recurring_day) VALUES
        ('Jour de l''An', ($1 || '-01-01')::DATE, 'paid', $2, true, 1, 1),
        ('Manifeste de l''Independance', ($1 || '-01-11')::DATE, 'paid', $2, true, 1, 11),
        ('Fete du Travail', ($1 || '-05-01')::DATE, 'paid', $2, true, 5, 1),
        ('Fete du Trone', ($1 || '-07-30')::DATE, 'paid', $2, true, 7, 30),
        ('Oued Ed-Dahab', ($1 || '-08-14')::DATE, 'paid', $2, true, 8, 14),
        ('Revolution du Roi et du Peuple', ($1 || '-08-20')::DATE, 'paid', $2, true, 8, 20),
        ('Fete de la Jeunesse', ($1 || '-08-21')::DATE, 'paid', $2, true, 8, 21),
        ('Marche Verte', ($1 || '-11-06')::DATE, 'paid', $2, true, 11, 6),
        ('Fete de l''Independance', ($1 || '-11-18')::DATE, 'paid', $2, true, 11, 18)
      `, [currentYear.toString(), currentYear]);
    }

    console.log('hr_holidays table created with Moroccan holidays');

    // Step 5: Create indexes
    console.log('Step 5: Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hr_leave_types_active ON hr_leave_types(is_active);
      CREATE INDEX IF NOT EXISTS idx_hr_leave_types_code ON hr_leave_types(code);

      CREATE INDEX IF NOT EXISTS idx_hr_leave_balances_employee ON hr_leave_balances(employee_id);
      CREATE INDEX IF NOT EXISTS idx_hr_leave_balances_year ON hr_leave_balances(year);
      CREATE INDEX IF NOT EXISTS idx_hr_leave_balances_type ON hr_leave_balances(leave_type_id);

      CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_employee ON hr_leave_requests(employee_id);
      CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_status ON hr_leave_requests(status);
      CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_dates ON hr_leave_requests(start_date, end_date);
      CREATE INDEX IF NOT EXISTS idx_hr_leave_requests_approver ON hr_leave_requests(current_approver_level);

      CREATE INDEX IF NOT EXISTS idx_hr_holidays_date ON hr_holidays(holiday_date);
      CREATE INDEX IF NOT EXISTS idx_hr_holidays_year ON hr_holidays(year);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_hr_holidays_unique ON hr_holidays(holiday_date, COALESCE(segment_id, ''), COALESCE(centre_id, '00000000-0000-0000-0000-000000000000'::UUID));
    `);

    // Step 6: Create triggers
    console.log('Step 6: Creating triggers...');
    await client.query(`
      DROP TRIGGER IF EXISTS update_hr_leave_types_updated_at ON hr_leave_types;
      CREATE TRIGGER update_hr_leave_types_updated_at
        BEFORE UPDATE ON hr_leave_types
        FOR EACH ROW EXECUTE FUNCTION update_hr_updated_at();

      DROP TRIGGER IF EXISTS update_hr_leave_balances_updated_at ON hr_leave_balances;
      CREATE TRIGGER update_hr_leave_balances_updated_at
        BEFORE UPDATE ON hr_leave_balances
        FOR EACH ROW EXECUTE FUNCTION update_hr_updated_at();

      DROP TRIGGER IF EXISTS update_hr_leave_requests_updated_at ON hr_leave_requests;
      CREATE TRIGGER update_hr_leave_requests_updated_at
        BEFORE UPDATE ON hr_leave_requests
        FOR EACH ROW EXECUTE FUNCTION update_hr_updated_at();
    `);

    await client.query('COMMIT');

    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'hr_%'
      ORDER BY table_name
    `);

    const leaveTypes = await client.query('SELECT COUNT(*) FROM hr_leave_types');
    const holidays = await client.query('SELECT COUNT(*) FROM hr_holidays');

    console.log('=== Migration 043 Complete ===');

    res.json({
      success: true,
      message: 'Migration 043 completed - HR Leaves Management',
      summary: {
        tables_created: ['hr_leave_types', 'hr_leave_balances', 'hr_leave_requests', 'hr_holidays'],
        leave_types: parseInt(leaveTypes.rows[0].count),
        holidays: parseInt(holidays.rows[0].count),
        total_hr_tables: tables.rows.length
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 043 failed:', error);
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
    await pool.query('DROP TABLE IF EXISTS hr_leave_requests CASCADE');
    await pool.query('DROP TABLE IF EXISTS hr_leave_balances CASCADE');
    await pool.query('DROP TABLE IF EXISTS hr_holidays CASCADE');
    await pool.query('DROP TABLE IF EXISTS hr_leave_types CASCADE');

    res.json({ success: true, message: 'Migration 043 rolled back' });
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
    const tables = ['hr_leave_types', 'hr_leave_balances', 'hr_leave_requests', 'hr_holidays'];
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
