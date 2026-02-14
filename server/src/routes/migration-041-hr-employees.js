import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 041: HR Employees Core Tables
// Creates: hr_employees, hr_contracts, hr_employee_documents, hr_disciplinary_actions

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 041: HR Employees Core Tables ===');

    // Step 1: Create hr_employees table
    console.log('Step 1: Creating hr_employees table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_employees (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        profile_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
        employee_number TEXT UNIQUE NOT NULL,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        cin TEXT UNIQUE,
        birth_date DATE,
        birth_place TEXT,
        email TEXT,
        phone TEXT,
        address TEXT,
        postal_code TEXT,
        city TEXT,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        hire_date DATE NOT NULL,
        termination_date DATE,
        employment_status TEXT DEFAULT 'active' CHECK (employment_status IN ('active', 'terminated', 'suspended', 'on_leave')),
        employment_type TEXT CHECK (employment_type IN ('full_time', 'part_time', 'intern', 'freelance', 'temporary')),
        position TEXT,
        department TEXT,
        segment_id TEXT REFERENCES segments(id) ON DELETE SET NULL,
        centre_id UUID, -- Optional: centres table may not exist
        manager_id UUID,
        photo_url TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Add self-referencing foreign key for manager
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'hr_employees_manager_fkey'
        ) THEN
          ALTER TABLE hr_employees
          ADD CONSTRAINT hr_employees_manager_fkey
          FOREIGN KEY (manager_id) REFERENCES hr_employees(id) ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    console.log('hr_employees table created');

    // Step 2: Create hr_contracts table
    console.log('Step 2: Creating hr_contracts table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_contracts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        contract_number TEXT UNIQUE,
        contract_type TEXT NOT NULL CHECK (contract_type IN ('CDI', 'CDD', 'stage', 'freelance', 'interim', 'apprenticeship')),
        start_date DATE NOT NULL,
        end_date DATE,
        probation_end_date DATE,
        probation_duration_months INT,
        salary_gross DECIMAL(10,2),
        salary_net DECIMAL(10,2),
        working_hours_per_week DECIMAL(4,1) DEFAULT 44,
        position TEXT,
        department TEXT,
        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'terminated', 'renewed')),
        termination_reason TEXT,
        termination_date DATE,
        renewal_count INT DEFAULT 0,
        previous_contract_id UUID REFERENCES hr_contracts(id),
        document_url TEXT,
        notes TEXT,
        created_by TEXT REFERENCES profiles(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('hr_contracts table created');

    // Step 3: Create hr_employee_documents table
    console.log('Step 3: Creating hr_employee_documents table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_employee_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        document_type TEXT NOT NULL CHECK (document_type IN ('cin', 'contract', 'cnss', 'diploma', 'certificate', 'cv', 'photo', 'medical', 'other')),
        title TEXT NOT NULL,
        description TEXT,
        file_url TEXT NOT NULL,
        file_name TEXT,
        file_size INT,
        mime_type TEXT,
        expiry_date DATE,
        is_verified BOOLEAN DEFAULT FALSE,
        verified_by TEXT REFERENCES profiles(id),
        verified_at TIMESTAMP,
        uploaded_by TEXT REFERENCES profiles(id),
        uploaded_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('hr_employee_documents table created');

    // Step 4: Create hr_disciplinary_actions table
    console.log('Step 4: Creating hr_disciplinary_actions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_disciplinary_actions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        action_type TEXT NOT NULL CHECK (action_type IN ('verbal_warning', 'written_warning', 'blame', 'suspension', 'demotion', 'dismissal', 'other')),
        action_date DATE NOT NULL,
        effective_date DATE,
        end_date DATE,
        reason TEXT NOT NULL,
        description TEXT,
        document_url TEXT,
        duration_days INT,
        salary_impact DECIMAL(10,2),
        witnesses TEXT[],
        employee_response TEXT,
        response_date DATE,
        appeal_status TEXT CHECK (appeal_status IN ('none', 'pending', 'accepted', 'rejected')),
        is_final BOOLEAN DEFAULT FALSE,
        created_by TEXT REFERENCES profiles(id),
        approved_by TEXT REFERENCES profiles(id),
        approved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('hr_disciplinary_actions table created');

    // Step 5: Create indexes for performance
    console.log('Step 5: Creating indexes...');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hr_employees_status ON hr_employees(employment_status);
      CREATE INDEX IF NOT EXISTS idx_hr_employees_segment ON hr_employees(segment_id);
      CREATE INDEX IF NOT EXISTS idx_hr_employees_centre ON hr_employees(centre_id);
      CREATE INDEX IF NOT EXISTS idx_hr_employees_manager ON hr_employees(manager_id);
      CREATE INDEX IF NOT EXISTS idx_hr_employees_hire_date ON hr_employees(hire_date);
      CREATE INDEX IF NOT EXISTS idx_hr_employees_cin ON hr_employees(cin);

      CREATE INDEX IF NOT EXISTS idx_hr_contracts_employee ON hr_contracts(employee_id);
      CREATE INDEX IF NOT EXISTS idx_hr_contracts_status ON hr_contracts(status);
      CREATE INDEX IF NOT EXISTS idx_hr_contracts_end_date ON hr_contracts(end_date);
      CREATE INDEX IF NOT EXISTS idx_hr_contracts_probation ON hr_contracts(probation_end_date);

      CREATE INDEX IF NOT EXISTS idx_hr_documents_employee ON hr_employee_documents(employee_id);
      CREATE INDEX IF NOT EXISTS idx_hr_documents_type ON hr_employee_documents(document_type);

      CREATE INDEX IF NOT EXISTS idx_hr_disciplinary_employee ON hr_disciplinary_actions(employee_id);
      CREATE INDEX IF NOT EXISTS idx_hr_disciplinary_type ON hr_disciplinary_actions(action_type);
      CREATE INDEX IF NOT EXISTS idx_hr_disciplinary_date ON hr_disciplinary_actions(action_date);
    `);

    console.log('Indexes created');

    // Step 6: Create updated_at trigger function
    console.log('Step 6: Creating updated_at trigger...');
    await client.query(`
      CREATE OR REPLACE FUNCTION update_hr_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Apply triggers
    await client.query(`
      DROP TRIGGER IF EXISTS update_hr_employees_updated_at ON hr_employees;
      CREATE TRIGGER update_hr_employees_updated_at
        BEFORE UPDATE ON hr_employees
        FOR EACH ROW EXECUTE FUNCTION update_hr_updated_at();

      DROP TRIGGER IF EXISTS update_hr_contracts_updated_at ON hr_contracts;
      CREATE TRIGGER update_hr_contracts_updated_at
        BEFORE UPDATE ON hr_contracts
        FOR EACH ROW EXECUTE FUNCTION update_hr_updated_at();

      DROP TRIGGER IF EXISTS update_hr_disciplinary_updated_at ON hr_disciplinary_actions;
      CREATE TRIGGER update_hr_disciplinary_updated_at
        BEFORE UPDATE ON hr_disciplinary_actions
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

    console.log('=== Migration 041 Complete ===');

    res.json({
      success: true,
      message: 'Migration 041 completed successfully - HR Employees Core Tables',
      summary: {
        tables_created: tables.rows.map(t => t.table_name),
        total_tables: tables.rows.length
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 041 failed:', error);
    res.status(500).json({
      success: false,
      message: 'Migration 041 failed',
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

    console.log('Rolling back Migration 041...');

    // Drop tables in reverse order (respecting foreign keys)
    await client.query('DROP TABLE IF EXISTS hr_disciplinary_actions CASCADE');
    await client.query('DROP TABLE IF EXISTS hr_employee_documents CASCADE');
    await client.query('DROP TABLE IF EXISTS hr_contracts CASCADE');
    await client.query('DROP TABLE IF EXISTS hr_employees CASCADE');

    // Drop trigger function
    await client.query('DROP FUNCTION IF EXISTS update_hr_updated_at() CASCADE');

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 041 rolled back successfully'
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
    const tables = ['hr_employees', 'hr_contracts', 'hr_employee_documents', 'hr_disciplinary_actions'];
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
