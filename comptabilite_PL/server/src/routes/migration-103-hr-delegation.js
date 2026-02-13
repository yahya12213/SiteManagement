import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 103: HR Approval Delegation System
// Creates: hr_approval_delegations and adds delegation tracking columns

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 103: HR Approval Delegation System ===');

    // Step 1: Create hr_approval_delegations table
    console.log('Step 1: Creating hr_approval_delegations table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_approval_delegations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

        -- Who delegates and to whom
        delegator_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        delegate_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

        -- Validity period
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,

        -- Type of delegation
        delegation_type TEXT DEFAULT 'all' CHECK (delegation_type IN ('all', 'leaves', 'overtime', 'corrections', 'expenses')),

        -- Optional restrictions
        excluded_employees UUID[],  -- List of employee IDs excluded from this delegation
        max_amount DECIMAL(10,2),   -- Maximum amount authorized (for advances, expenses)

        -- Notifications
        requires_notification BOOLEAN DEFAULT TRUE,
        notification_sent_to_delegate BOOLEAN DEFAULT FALSE,
        notification_sent_to_team BOOLEAN DEFAULT FALSE,

        -- Reason/notes
        reason TEXT,
        notes TEXT,

        -- Status
        is_active BOOLEAN DEFAULT TRUE,
        cancelled_at TIMESTAMP,
        cancelled_by TEXT REFERENCES profiles(id),
        cancellation_reason TEXT,

        -- Audit
        created_at TIMESTAMP DEFAULT NOW(),
        created_by TEXT REFERENCES profiles(id),
        updated_at TIMESTAMP DEFAULT NOW(),

        -- Constraints
        CONSTRAINT valid_delegation_dates CHECK (end_date >= start_date),
        CONSTRAINT different_users CHECK (delegator_id != delegate_id)
      )
    `);
    console.log('hr_approval_delegations table created');

    // Step 2: Add delegation tracking columns to hr_leave_requests
    console.log('Step 2: Adding delegation tracking to hr_leave_requests...');
    await client.query(`
      DO $$ BEGIN
        -- Add approved_on_behalf_of column
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'hr_leave_requests' AND column_name = 'approved_on_behalf_of'
        ) THEN
          ALTER TABLE hr_leave_requests ADD COLUMN approved_on_behalf_of TEXT REFERENCES profiles(id);
        END IF;

        -- Add delegation_id column
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'hr_leave_requests' AND column_name = 'delegation_id'
        ) THEN
          ALTER TABLE hr_leave_requests ADD COLUMN delegation_id UUID REFERENCES hr_approval_delegations(id);
        END IF;
      END $$;
    `);
    console.log('hr_leave_requests updated');

    // Step 3: Add delegation tracking columns to hr_overtime_requests (if exists)
    console.log('Step 3: Adding delegation tracking to overtime requests...');
    await client.query(`
      DO $$ BEGIN
        -- Check if hr_overtime_requests exists
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_name = 'hr_overtime_requests'
        ) THEN
          -- Add approved_on_behalf_of column
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'hr_overtime_requests' AND column_name = 'approved_on_behalf_of'
          ) THEN
            ALTER TABLE hr_overtime_requests ADD COLUMN approved_on_behalf_of TEXT REFERENCES profiles(id);
          END IF;

          -- Add delegation_id column
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'hr_overtime_requests' AND column_name = 'delegation_id'
          ) THEN
            ALTER TABLE hr_overtime_requests ADD COLUMN delegation_id UUID REFERENCES hr_approval_delegations(id);
          END IF;
        END IF;
      END $$;
    `);
    console.log('Overtime requests updated (if table exists)');

    // Step 4: Create hr_delegation_notifications table
    console.log('Step 4: Creating hr_delegation_notifications table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_delegation_notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        delegation_id UUID NOT NULL REFERENCES hr_approval_delegations(id) ON DELETE CASCADE,
        recipient_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        notification_type TEXT NOT NULL CHECK (notification_type IN ('delegate_assigned', 'team_informed', 'delegation_expired', 'delegation_cancelled')),
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        read_at TIMESTAMP,
        sent_email BOOLEAN DEFAULT FALSE,
        email_sent_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('hr_delegation_notifications table created');

    // Step 5: Create indexes
    console.log('Step 5: Creating indexes...');
    await client.query(`
      -- Delegation indexes
      CREATE INDEX IF NOT EXISTS idx_delegations_delegator ON hr_approval_delegations(delegator_id);
      CREATE INDEX IF NOT EXISTS idx_delegations_delegate ON hr_approval_delegations(delegate_id);
      CREATE INDEX IF NOT EXISTS idx_delegations_dates ON hr_approval_delegations(start_date, end_date);
      CREATE INDEX IF NOT EXISTS idx_delegations_active ON hr_approval_delegations(is_active);
      CREATE INDEX IF NOT EXISTS idx_delegations_type ON hr_approval_delegations(delegation_type);

      -- Active delegations view index
      CREATE INDEX IF NOT EXISTS idx_delegations_active_period ON hr_approval_delegations(delegate_id, start_date, end_date)
        WHERE is_active = TRUE;

      -- Notification indexes
      CREATE INDEX IF NOT EXISTS idx_delegation_notif_recipient ON hr_delegation_notifications(recipient_id);
      CREATE INDEX IF NOT EXISTS idx_delegation_notif_delegation ON hr_delegation_notifications(delegation_id);
      CREATE INDEX IF NOT EXISTS idx_delegation_notif_unread ON hr_delegation_notifications(recipient_id)
        WHERE is_read = FALSE;
    `);
    console.log('Indexes created');

    // Step 6: Create helper function to check if user can approve
    console.log('Step 6: Creating helper functions...');
    await client.query(`
      -- Function to check if a user can approve requests for another user
      CREATE OR REPLACE FUNCTION hr_can_approve_for(
        p_approver_id TEXT,
        p_original_approver_id TEXT,
        p_delegation_type TEXT DEFAULT 'all'
      ) RETURNS TABLE (
        can_approve BOOLEAN,
        is_delegation BOOLEAN,
        delegation_id UUID,
        delegator_name TEXT
      ) AS $$
      BEGIN
        -- Direct approval (same person)
        IF p_approver_id = p_original_approver_id THEN
          RETURN QUERY SELECT TRUE, FALSE, NULL::UUID, NULL::TEXT;
          RETURN;
        END IF;

        -- Check for active delegation
        RETURN QUERY
        SELECT
          TRUE,
          TRUE,
          d.id,
          CONCAT(p.first_name, ' ', p.last_name)
        FROM hr_approval_delegations d
        JOIN profiles p ON p.id = d.delegator_id
        WHERE d.delegate_id = p_approver_id
          AND d.delegator_id = p_original_approver_id
          AND d.is_active = TRUE
          AND CURRENT_DATE BETWEEN d.start_date AND d.end_date
          AND (d.delegation_type = 'all' OR d.delegation_type = p_delegation_type)
        LIMIT 1;

        -- If no delegation found, return cannot approve
        IF NOT FOUND THEN
          RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, NULL::TEXT;
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('Helper functions created');

    // Step 7: Create view for active delegations
    console.log('Step 7: Creating views...');
    await client.query(`
      CREATE OR REPLACE VIEW hr_active_delegations AS
      SELECT
        d.*,
        delegator.first_name || ' ' || delegator.last_name AS delegator_name,
        delegator.email AS delegator_email,
        delegate.first_name || ' ' || delegate.last_name AS delegate_name,
        delegate.email AS delegate_email,
        CASE
          WHEN CURRENT_DATE < d.start_date THEN 'upcoming'
          WHEN CURRENT_DATE BETWEEN d.start_date AND d.end_date THEN 'active'
          ELSE 'expired'
        END AS current_status
      FROM hr_approval_delegations d
      JOIN profiles delegator ON delegator.id = d.delegator_id
      JOIN profiles delegate ON delegate.id = d.delegate_id
      WHERE d.is_active = TRUE;
    `);
    console.log('Views created');

    // Step 8: Create trigger for updated_at
    console.log('Step 8: Creating triggers...');
    await client.query(`
      DROP TRIGGER IF EXISTS update_hr_approval_delegations_updated_at ON hr_approval_delegations;
      CREATE TRIGGER update_hr_approval_delegations_updated_at
        BEFORE UPDATE ON hr_approval_delegations
        FOR EACH ROW EXECUTE FUNCTION update_hr_updated_at();
    `);
    console.log('Triggers created');

    // Step 9: Add delegation permissions
    console.log('Step 9: Adding delegation permissions...');
    await client.query(`
      INSERT INTO permissions (id, name, description, category, parent_id) VALUES
        ('hr.delegation', 'Gestion des délégations', 'Accès au système de délégation', 'hr', 'hr'),
        ('hr.delegation.view_page', 'Voir page délégations', 'Accès à la page de gestion des délégations', 'hr', 'hr.delegation'),
        ('hr.delegation.create', 'Créer délégation', 'Créer une délégation de ses approbations', 'hr', 'hr.delegation'),
        ('hr.delegation.view_all', 'Voir toutes délégations', 'Voir les délégations de tous les utilisateurs', 'hr', 'hr.delegation'),
        ('hr.delegation.cancel', 'Annuler délégation', 'Annuler une délégation existante', 'hr', 'hr.delegation'),
        ('hr.delegation.receive', 'Recevoir délégation', 'Pouvoir être désigné comme délégué', 'hr', 'hr.delegation')
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        category = EXCLUDED.category
    `);
    console.log('Permissions added');

    await client.query('COMMIT');

    // Get summary
    const tables = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public' AND (
        table_name = 'hr_approval_delegations' OR
        table_name = 'hr_delegation_notifications'
      )
      ORDER BY table_name
    `);

    console.log('=== Migration 103 Complete ===');

    res.json({
      success: true,
      message: 'Migration 103 completed successfully - HR Approval Delegation System',
      summary: {
        tables_created: tables.rows.map(t => t.table_name),
        total_tables: tables.rows.length,
        columns_added: ['approved_on_behalf_of', 'delegation_id'],
        functions_created: ['hr_can_approve_for'],
        views_created: ['hr_active_delegations']
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 103 failed:', error);
    res.status(500).json({
      success: false,
      message: 'Migration 103 failed',
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

    console.log('Rolling back Migration 103...');

    // Drop view
    await client.query('DROP VIEW IF EXISTS hr_active_delegations CASCADE');

    // Drop function
    await client.query('DROP FUNCTION IF EXISTS hr_can_approve_for CASCADE');

    // Remove columns from hr_leave_requests
    await client.query(`
      ALTER TABLE hr_leave_requests DROP COLUMN IF EXISTS approved_on_behalf_of;
      ALTER TABLE hr_leave_requests DROP COLUMN IF EXISTS delegation_id;
    `);

    // Remove columns from hr_overtime_requests if exists
    await client.query(`
      DO $$ BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hr_overtime_requests') THEN
          ALTER TABLE hr_overtime_requests DROP COLUMN IF EXISTS approved_on_behalf_of;
          ALTER TABLE hr_overtime_requests DROP COLUMN IF EXISTS delegation_id;
        END IF;
      END $$;
    `);

    // Drop tables
    await client.query('DROP TABLE IF EXISTS hr_delegation_notifications CASCADE');
    await client.query('DROP TABLE IF EXISTS hr_approval_delegations CASCADE');

    // Remove permissions
    await client.query(`
      DELETE FROM permissions WHERE id LIKE 'hr.delegation%'
    `);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 103 rolled back successfully'
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
    const tables = ['hr_approval_delegations', 'hr_delegation_notifications'];
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

    // Check for columns
    const columnsResult = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'hr_leave_requests' AND column_name IN ('approved_on_behalf_of', 'delegation_id')
    `);
    status['leave_requests_columns'] = columnsResult.rows.length === 2;

    const allExists = Object.values(status).every(v => v === true);

    res.json({
      success: true,
      migrated: allExists,
      status: status
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
