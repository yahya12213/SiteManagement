/**
 * Migration 155: Complete Leave Balance System
 *
 * Features:
 * - Leave balance history tracking
 * - Leave accrual based on 19→18 period rule
 * - Automatic deduction on approval
 * - Seniority bonus calculation
 */
import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.get('/run', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🚀 Starting migration 155: Complete Leave Balance System...');

    // 1. Create leave balance history table
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_leave_balance_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        leave_type_id UUID REFERENCES hr_leave_types(id),
        movement_type TEXT NOT NULL CHECK (movement_type IN (
          'accrual',           -- Acquisition mensuelle (1.5j/mois)
          'deduction',         -- Déduction pour congé pris
          'initial',           -- Solde initial à l'embauche
          'carry_over',        -- Report de l'année précédente
          'adjustment',        -- Ajustement manuel RH
          'seniority_bonus',   -- Bonus ancienneté
          'expiry'             -- Expiration des jours non pris
        )),
        amount DECIMAL(5,2) NOT NULL,
        balance_before DECIMAL(5,2) NOT NULL,
        balance_after DECIMAL(5,2) NOT NULL,
        reference_id UUID,           -- ID de la demande de congé si déduction
        period_id TEXT,              -- Ex: "2026-02" pour la période 19/01→18/02
        description TEXT,
        created_by TEXT REFERENCES profiles(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Created hr_leave_balance_history table');

    // 2. Create accrual periods table (période 19→18)
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_leave_accrual_periods (
        id TEXT PRIMARY KEY,              -- Ex: "2026-02"
        label TEXT NOT NULL,               -- Ex: "Février 2026"
        start_date DATE NOT NULL,          -- Ex: 2026-01-19
        end_date DATE NOT NULL,            -- Ex: 2026-02-18
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        is_closed BOOLEAN DEFAULT FALSE,
        closed_at TIMESTAMP,
        closed_by TEXT REFERENCES profiles(id),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✅ Created hr_leave_accrual_periods table');

    // 3. Create employee worked days tracking per period
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_employee_period_summary (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        period_id TEXT NOT NULL REFERENCES hr_leave_accrual_periods(id),

        -- Compteurs pour CNSS
        days_worked INTEGER DEFAULT 0,
        days_holiday_paid INTEGER DEFAULT 0,
        days_leave_paid INTEGER DEFAULT 0,
        days_sick_paid INTEGER DEFAULT 0,
        days_absent_unpaid INTEGER DEFAULT 0,

        -- Total jours rémunérés (max 26 pour CNSS)
        total_paid_days INTEGER GENERATED ALWAYS AS (
          LEAST(days_worked + days_holiday_paid + days_leave_paid + days_sick_paid, 26)
        ) STORED,

        -- Congés
        leave_accrued DECIMAL(4,2) DEFAULT 0,    -- 1.5 si mois complet
        leave_taken DECIMAL(4,2) DEFAULT 0,
        leave_balance_after DECIMAL(5,2) DEFAULT 0,

        -- Métadonnées
        is_complete_month BOOLEAN DEFAULT FALSE,
        hire_date_in_period DATE,
        termination_date_in_period DATE,

        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(employee_id, period_id)
      )
    `);
    console.log('✅ Created hr_employee_period_summary table');

    // 4. Add seniority bonus fields to hr_employees if not exist
    await client.query(`
      ALTER TABLE hr_employees
      ADD COLUMN IF NOT EXISTS seniority_bonus_days DECIMAL(4,2) DEFAULT 0
    `);
    console.log('✅ Added seniority_bonus_days to hr_employees');

    // 5. Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_leave_balance_history_employee ON hr_leave_balance_history(employee_id);
      CREATE INDEX IF NOT EXISTS idx_leave_balance_history_period ON hr_leave_balance_history(period_id);
      CREATE INDEX IF NOT EXISTS idx_leave_balance_history_type ON hr_leave_balance_history(movement_type);
      CREATE INDEX IF NOT EXISTS idx_employee_period_summary_employee ON hr_employee_period_summary(employee_id);
      CREATE INDEX IF NOT EXISTS idx_employee_period_summary_period ON hr_employee_period_summary(period_id);
      CREATE INDEX IF NOT EXISTS idx_accrual_periods_year ON hr_leave_accrual_periods(year);
    `);
    console.log('✅ Created indexes');

    // 6. Generate accrual periods for 2025 and 2026
    const years = [2025, 2026];
    for (const year of years) {
      for (let month = 1; month <= 12; month++) {
        const monthStr = String(month).padStart(2, '0');
        const periodId = `${year}-${monthStr}`;

        // Début = 19 du mois précédent
        const startMonth = month === 1 ? 12 : month - 1;
        const startYear = month === 1 ? year - 1 : year;
        const startDate = `${startYear}-${String(startMonth).padStart(2, '0')}-19`;

        // Fin = 18 du mois courant
        const endDate = `${year}-${monthStr}-18`;

        const monthNames = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
                           'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
        const label = `${monthNames[month]} ${year}`;

        await client.query(`
          INSERT INTO hr_leave_accrual_periods (id, label, start_date, end_date, year, month)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (id) DO NOTHING
        `, [periodId, label, startDate, endDate, year, month]);
      }
    }
    console.log('✅ Generated accrual periods for 2025-2026');

    await client.query('COMMIT');
    console.log('✅ Migration 155 completed successfully');

    res.json({
      success: true,
      message: 'Migration 155 completed: Complete Leave Balance System'
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 155 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Status check
router.get('/status', async (req, res) => {
  try {
    const tables = ['hr_leave_balance_history', 'hr_leave_accrual_periods', 'hr_employee_period_summary'];
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

    // Check periods count
    let periodsCount = 0;
    if (status['hr_leave_accrual_periods']) {
      const countResult = await pool.query('SELECT COUNT(*) FROM hr_leave_accrual_periods');
      periodsCount = parseInt(countResult.rows[0].count);
    }

    res.json({
      success: true,
      migrated: Object.values(status).every(v => v),
      tables: status,
      periods_count: periodsCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
