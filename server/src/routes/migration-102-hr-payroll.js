import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 102: HR Payroll System Tables
// Creates: hr_payroll_periods, hr_payslips, hr_payslip_lines, hr_payroll_config, hr_payroll_audit_logs

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 102: HR Payroll System Tables ===');

    // Step 1: Create hr_payroll_periods table
    console.log('Step 1: Creating hr_payroll_periods table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_payroll_periods (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        year INT NOT NULL,
        month INT NOT NULL CHECK (month >= 1 AND month <= 12),
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        pay_date DATE,
        status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'calculating', 'calculated', 'validated', 'closed', 'cancelled')),
        total_employees INT DEFAULT 0,
        total_gross DECIMAL(12,2) DEFAULT 0,
        total_net DECIMAL(12,2) DEFAULT 0,
        total_cnss_employee DECIMAL(12,2) DEFAULT 0,
        total_cnss_employer DECIMAL(12,2) DEFAULT 0,
        total_amo DECIMAL(12,2) DEFAULT 0,
        total_igr DECIMAL(12,2) DEFAULT 0,
        notes TEXT,
        calculated_at TIMESTAMP,
        validated_at TIMESTAMP,
        validated_by TEXT REFERENCES profiles(id),
        closed_at TIMESTAMP,
        closed_by TEXT REFERENCES profiles(id),
        created_by TEXT REFERENCES profiles(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT unique_period_year_month UNIQUE (year, month)
      )
    `);
    console.log('hr_payroll_periods table created');

    // Step 2: Create hr_payslips table
    console.log('Step 2: Creating hr_payslips table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_payslips (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        period_id UUID NOT NULL REFERENCES hr_payroll_periods(id) ON DELETE CASCADE,
        employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        employee_number TEXT NOT NULL,
        employee_name TEXT NOT NULL,
        position TEXT,
        department TEXT,
        hire_date DATE,

        -- Base salary info
        base_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
        hourly_rate DECIMAL(8,4) DEFAULT 0,
        working_hours DECIMAL(6,2) DEFAULT 191,
        worked_hours DECIMAL(6,2) DEFAULT 0,

        -- Overtime
        overtime_hours_25 DECIMAL(6,2) DEFAULT 0,
        overtime_hours_50 DECIMAL(6,2) DEFAULT 0,
        overtime_hours_100 DECIMAL(6,2) DEFAULT 0,
        overtime_amount DECIMAL(10,2) DEFAULT 0,

        -- Absences
        absence_days DECIMAL(5,2) DEFAULT 0,
        absence_deduction DECIMAL(10,2) DEFAULT 0,
        late_minutes INT DEFAULT 0,
        late_deduction DECIMAL(10,2) DEFAULT 0,

        -- Gross calculations
        gross_salary DECIMAL(10,2) DEFAULT 0,
        gross_taxable DECIMAL(10,2) DEFAULT 0,

        -- Deductions - Social
        cnss_base DECIMAL(10,2) DEFAULT 0,
        cnss_employee DECIMAL(10,2) DEFAULT 0,
        cnss_employer DECIMAL(10,2) DEFAULT 0,
        amo_base DECIMAL(10,2) DEFAULT 0,
        amo_employee DECIMAL(10,2) DEFAULT 0,
        amo_employer DECIMAL(10,2) DEFAULT 0,

        -- Deductions - Tax
        igr_base DECIMAL(10,2) DEFAULT 0,
        igr_amount DECIMAL(10,2) DEFAULT 0,

        -- Other deductions
        other_deductions DECIMAL(10,2) DEFAULT 0,
        advances DECIMAL(10,2) DEFAULT 0,
        loans DECIMAL(10,2) DEFAULT 0,

        -- Total deductions
        total_deductions DECIMAL(10,2) DEFAULT 0,

        -- Net salary
        net_salary DECIMAL(10,2) DEFAULT 0,

        -- Banking info
        bank_name TEXT,
        bank_account TEXT,
        rib TEXT,

        -- Status
        status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'calculated', 'validated', 'paid', 'cancelled')),

        -- Audit
        generated_at TIMESTAMP,
        validated_at TIMESTAMP,
        validated_by TEXT REFERENCES profiles(id),
        paid_at TIMESTAMP,
        paid_by TEXT REFERENCES profiles(id),
        pdf_url TEXT,

        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT unique_payslip_period_employee UNIQUE (period_id, employee_id)
      )
    `);
    console.log('hr_payslips table created');

    // Step 3: Create hr_payslip_lines table (for variable elements)
    console.log('Step 3: Creating hr_payslip_lines table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_payslip_lines (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        payslip_id UUID NOT NULL REFERENCES hr_payslips(id) ON DELETE CASCADE,
        line_type TEXT NOT NULL CHECK (line_type IN ('earning', 'deduction', 'employer_charge')),
        category TEXT NOT NULL CHECK (category IN (
          'base_salary', 'overtime', 'bonus', 'allowance', 'commission',
          'cnss', 'amo', 'igr', 'advance', 'loan', 'other_deduction',
          'mutuelle', 'cimr', 'other'
        )),
        code TEXT NOT NULL,
        label TEXT NOT NULL,
        quantity DECIMAL(10,2) DEFAULT 1,
        rate DECIMAL(10,4) DEFAULT 0,
        base_amount DECIMAL(10,2) DEFAULT 0,
        amount DECIMAL(10,2) NOT NULL,
        is_taxable BOOLEAN DEFAULT TRUE,
        is_cnss_subject BOOLEAN DEFAULT TRUE,
        display_order INT DEFAULT 0,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('hr_payslip_lines table created');

    // Step 4: Create hr_payroll_config table
    console.log('Step 4: Creating hr_payroll_config table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_payroll_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        config_key TEXT UNIQUE NOT NULL,
        config_value TEXT NOT NULL,
        config_type TEXT DEFAULT 'string' CHECK (config_type IN ('string', 'number', 'boolean', 'json')),
        description TEXT,
        category TEXT DEFAULT 'general' CHECK (category IN ('general', 'cnss', 'amo', 'igr', 'overtime', 'allowances', 'other')),
        is_active BOOLEAN DEFAULT TRUE,
        effective_date DATE DEFAULT CURRENT_DATE,
        updated_by TEXT REFERENCES profiles(id),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('hr_payroll_config table created');

    // Step 5: Insert default config values (Morocco 2025)
    console.log('Step 5: Inserting default payroll configuration...');
    await client.query(`
      INSERT INTO hr_payroll_config (config_key, config_value, config_type, description, category) VALUES
        -- CNSS Configuration
        ('cnss_employee_rate', '4.48', 'number', 'Taux CNSS salarié (%)', 'cnss'),
        ('cnss_employer_rate', '8.98', 'number', 'Taux CNSS employeur (%)', 'cnss'),
        ('cnss_ceiling', '6000', 'number', 'Plafond CNSS (MAD)', 'cnss'),

        -- AMO Configuration
        ('amo_employee_rate', '2.26', 'number', 'Taux AMO salarié (%)', 'amo'),
        ('amo_employer_rate', '4.11', 'number', 'Taux AMO employeur (%)', 'amo'),

        -- IGR Configuration (Morocco 2025 brackets)
        ('igr_brackets', '[
          {"min": 0, "max": 30000, "rate": 0, "deduction": 0},
          {"min": 30001, "max": 50000, "rate": 10, "deduction": 3000},
          {"min": 50001, "max": 60000, "rate": 20, "deduction": 8000},
          {"min": 60001, "max": 80000, "rate": 30, "deduction": 14000},
          {"min": 80001, "max": 180000, "rate": 34, "deduction": 17200},
          {"min": 180001, "max": null, "rate": 38, "deduction": 24400}
        ]', 'json', 'Barème IGR annuel (MAD)', 'igr'),
        ('igr_family_deduction', '360', 'number', 'Déduction par personne à charge (MAD/an)', 'igr'),
        ('igr_max_family_deductions', '6', 'number', 'Nombre max de personnes à charge', 'igr'),
        ('igr_professional_expenses_rate', '20', 'number', 'Taux frais professionnels (%)', 'igr'),
        ('igr_professional_expenses_cap', '30000', 'number', 'Plafond frais professionnels (MAD/an)', 'igr'),

        -- Overtime Configuration
        ('overtime_rate_25', '1.25', 'number', 'Majoration heures sup 25%', 'overtime'),
        ('overtime_rate_50', '1.50', 'number', 'Majoration heures sup 50%', 'overtime'),
        ('overtime_rate_100', '2.00', 'number', 'Majoration heures sup 100%', 'overtime'),
        ('overtime_threshold_daily', '8', 'number', 'Seuil quotidien heures normales', 'overtime'),
        ('overtime_threshold_weekly', '44', 'number', 'Seuil hebdomadaire heures normales', 'overtime'),

        -- General Configuration
        ('working_hours_monthly', '191', 'number', 'Heures de travail mensuelles', 'general'),
        ('working_days_monthly', '26', 'number', 'Jours de travail mensuels', 'general'),
        ('smig_hourly', '17.07', 'number', 'SMIG horaire (MAD)', 'general'),
        ('smig_monthly', '3258.37', 'number', 'SMIG mensuel (MAD)', 'general'),

        -- Allowances
        ('transport_allowance_default', '500', 'number', 'Indemnité transport par défaut (MAD)', 'allowances'),
        ('meal_allowance_default', '0', 'number', 'Indemnité repas par défaut (MAD)', 'allowances'),

        -- Seniority bonus rates (by year)
        ('seniority_bonus_rates', '[
          {"years": 2, "rate": 5},
          {"years": 5, "rate": 10},
          {"years": 12, "rate": 15},
          {"years": 20, "rate": 20},
          {"years": 25, "rate": 25}
        ]', 'json', 'Prime d''ancienneté par années de service (%)', 'allowances')
      ON CONFLICT (config_key) DO NOTHING
    `);
    console.log('Default configuration inserted');

    // Step 6: Create hr_payroll_audit_logs table
    console.log('Step 6: Creating hr_payroll_audit_logs table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_payroll_audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        entity_type TEXT NOT NULL CHECK (entity_type IN ('period', 'payslip', 'config')),
        entity_id UUID NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'calculate', 'validate', 'close', 'export', 'view', 'download')),
        old_values JSONB,
        new_values JSONB,
        changes JSONB,
        ip_address TEXT,
        user_agent TEXT,
        performed_by TEXT REFERENCES profiles(id),
        performed_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('hr_payroll_audit_logs table created');

    // Step 7: Create indexes
    console.log('Step 7: Creating indexes...');
    await client.query(`
      -- Payroll periods indexes
      CREATE INDEX IF NOT EXISTS idx_payroll_periods_year_month ON hr_payroll_periods(year, month);
      CREATE INDEX IF NOT EXISTS idx_payroll_periods_status ON hr_payroll_periods(status);
      CREATE INDEX IF NOT EXISTS idx_payroll_periods_dates ON hr_payroll_periods(start_date, end_date);

      -- Payslips indexes
      CREATE INDEX IF NOT EXISTS idx_payslips_period ON hr_payslips(period_id);
      CREATE INDEX IF NOT EXISTS idx_payslips_employee ON hr_payslips(employee_id);
      CREATE INDEX IF NOT EXISTS idx_payslips_status ON hr_payslips(status);
      CREATE INDEX IF NOT EXISTS idx_payslips_employee_number ON hr_payslips(employee_number);

      -- Payslip lines indexes
      CREATE INDEX IF NOT EXISTS idx_payslip_lines_payslip ON hr_payslip_lines(payslip_id);
      CREATE INDEX IF NOT EXISTS idx_payslip_lines_type ON hr_payslip_lines(line_type);
      CREATE INDEX IF NOT EXISTS idx_payslip_lines_category ON hr_payslip_lines(category);

      -- Config indexes
      CREATE INDEX IF NOT EXISTS idx_payroll_config_key ON hr_payroll_config(config_key);
      CREATE INDEX IF NOT EXISTS idx_payroll_config_category ON hr_payroll_config(category);

      -- Audit logs indexes
      CREATE INDEX IF NOT EXISTS idx_payroll_audit_entity ON hr_payroll_audit_logs(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_payroll_audit_action ON hr_payroll_audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_payroll_audit_user ON hr_payroll_audit_logs(performed_by);
      CREATE INDEX IF NOT EXISTS idx_payroll_audit_date ON hr_payroll_audit_logs(performed_at);
    `);
    console.log('Indexes created');

    // Step 8: Create updated_at triggers
    console.log('Step 8: Creating triggers...');
    await client.query(`
      -- Trigger for hr_payroll_periods
      DROP TRIGGER IF EXISTS update_hr_payroll_periods_updated_at ON hr_payroll_periods;
      CREATE TRIGGER update_hr_payroll_periods_updated_at
        BEFORE UPDATE ON hr_payroll_periods
        FOR EACH ROW EXECUTE FUNCTION update_hr_updated_at();

      -- Trigger for hr_payslips
      DROP TRIGGER IF EXISTS update_hr_payslips_updated_at ON hr_payslips;
      CREATE TRIGGER update_hr_payslips_updated_at
        BEFORE UPDATE ON hr_payslips
        FOR EACH ROW EXECUTE FUNCTION update_hr_updated_at();

      -- Trigger for hr_payroll_config
      DROP TRIGGER IF EXISTS update_hr_payroll_config_updated_at ON hr_payroll_config;
      CREATE TRIGGER update_hr_payroll_config_updated_at
        BEFORE UPDATE ON hr_payroll_config
        FOR EACH ROW EXECUTE FUNCTION update_hr_updated_at();
    `);
    console.log('Triggers created');

    // Step 9: Add payroll-related permissions
    console.log('Step 9: Adding payroll permissions...');
    await client.query(`
      INSERT INTO permissions (module, menu, action, code, label, description, sort_order, permission_type) VALUES
        ('hr', 'paie', 'view_page', 'hr.payroll.view_page', 'Voir la page paie', 'Accès à la page de gestion de paie', 1, 'page'),
        ('hr', 'paie', 'periods.create', 'hr.payroll.periods.create', 'Créer période de paie', 'Créer une nouvelle période de paie', 2, 'bouton'),
        ('hr', 'paie', 'periods.close', 'hr.payroll.periods.close', 'Clôturer période', 'Clôturer une période de paie', 3, 'bouton'),
        ('hr', 'paie', 'calculate', 'hr.payroll.calculate', 'Calculer la paie', 'Lancer le calcul de paie', 4, 'bouton'),
        ('hr', 'paie', 'validate', 'hr.payroll.validate', 'Valider les bulletins', 'Valider les bulletins de paie', 5, 'bouton'),
        ('hr', 'paie', 'export', 'hr.payroll.export', 'Exporter les données', 'Exporter les données de paie (CNSS, virements)', 6, 'bouton'),
        ('hr', 'paie', 'config', 'hr.payroll.config', 'Configurer la paie', 'Modifier la configuration de paie', 7, 'bouton'),
        ('hr', 'paie', 'view_all_payslips', 'hr.payroll.view_all_payslips', 'Voir tous les bulletins', 'Voir les bulletins de tous les employés', 8, 'bouton'),
        ('hr', 'paie', 'view_own_payslip', 'hr.payroll.view_own_payslip', 'Voir mes bulletins', 'Voir ses propres bulletins de paie', 9, 'bouton')
      ON CONFLICT (code) DO NOTHING
    `);
    console.log('Permissions added');

    await client.query('COMMIT');

    // Get summary
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'hr_payroll%'
      ORDER BY table_name
    `);

    const configCount = await client.query(`
      SELECT COUNT(*) FROM hr_payroll_config
    `);

    console.log('=== Migration 102 Complete ===');

    res.json({
      success: true,
      message: 'Migration 102 completed successfully - HR Payroll System',
      summary: {
        tables_created: tables.rows.map(t => t.table_name),
        config_entries: parseInt(configCount.rows[0].count),
        total_tables: tables.rows.length
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 102 failed:', error);
    res.status(500).json({
      success: false,
      message: 'Migration 102 failed',
      error: error.message
    });
  } finally {
    client.release();
    await pool.end();
  }
});

// Rollback migration
router.post('/rollback', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Rolling back Migration 102...');

    // Drop tables in reverse order
    await client.query('DROP TABLE IF EXISTS hr_payroll_audit_logs CASCADE');
    await client.query('DROP TABLE IF EXISTS hr_payslip_lines CASCADE');
    await client.query('DROP TABLE IF EXISTS hr_payslips CASCADE');
    await client.query('DROP TABLE IF EXISTS hr_payroll_periods CASCADE');
    await client.query('DROP TABLE IF EXISTS hr_payroll_config CASCADE');

    // Remove permissions
    await client.query(`
      DELETE FROM permissions WHERE code LIKE 'hr.payroll%'
    `);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 102 rolled back successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({
      success: false,
      message: 'Rollback failed',
      error: error.message
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
    const tables = ['hr_payroll_periods', 'hr_payslips', 'hr_payslip_lines', 'hr_payroll_config', 'hr_payroll_audit_logs'];
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

    const allExists = Object.values(status).every(v => v === true);

    res.json({
      success: true,
      migrated: allExists,
      tables: status
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

export default router;
