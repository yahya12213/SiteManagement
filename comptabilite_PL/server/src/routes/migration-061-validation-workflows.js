/**
 * Migration 051: HR Validation Workflows
 * Tables pour gérer les circuits d'approbation automatiques
 */

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

    console.log('=== Migration 051: HR Validation Workflows ===');

    // Step 1: Create hr_validation_workflows table
    console.log('Step 1: Creating hr_validation_workflows table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_validation_workflows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        description TEXT,
        trigger_type VARCHAR(50) NOT NULL,
        segment_id TEXT REFERENCES segments(id) ON DELETE SET NULL,
        is_active BOOLEAN DEFAULT false,
        priority INT DEFAULT 0,
        conditions JSONB DEFAULT '{}',
        created_by TEXT REFERENCES profiles(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('hr_validation_workflows table created');

    // Step 2: Create hr_validation_workflow_steps table
    console.log('Step 2: Creating hr_validation_workflow_steps table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_validation_workflow_steps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id UUID NOT NULL REFERENCES hr_validation_workflows(id) ON DELETE CASCADE,
        step_order INT NOT NULL,
        approver_type VARCHAR(20) NOT NULL CHECK (approver_type IN ('user', 'role', 'manager', 'hr')),
        approver_id TEXT,
        approver_role VARCHAR(50),
        approver_name VARCHAR(255),
        condition_expression TEXT,
        timeout_hours INT DEFAULT 48,
        reminder_hours INT DEFAULT 24,
        allow_delegation BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(workflow_id, step_order)
      )
    `);
    console.log('hr_validation_workflow_steps table created');

    // Step 3: Create hr_validation_instances table (for tracking active validations)
    console.log('Step 3: Creating hr_validation_instances table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_validation_instances (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workflow_id UUID NOT NULL REFERENCES hr_validation_workflows(id),
        request_type VARCHAR(50) NOT NULL,
        request_id UUID NOT NULL,
        current_step INT DEFAULT 1,
        status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled', 'expired')),
        initiated_by TEXT REFERENCES profiles(id),
        initiated_at TIMESTAMP DEFAULT NOW(),
        completed_at TIMESTAMP,
        completed_by TEXT REFERENCES profiles(id),
        final_decision TEXT CHECK (final_decision IN ('approved', 'rejected', 'cancelled')),
        notes TEXT,
        metadata JSONB DEFAULT '{}'
      )
    `);
    console.log('hr_validation_instances table created');

    // Step 4: Create hr_validation_actions table (for tracking each approval action)
    console.log('Step 4: Creating hr_validation_actions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_validation_actions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        instance_id UUID NOT NULL REFERENCES hr_validation_instances(id) ON DELETE CASCADE,
        step_id UUID REFERENCES hr_validation_workflow_steps(id),
        step_order INT NOT NULL,
        action VARCHAR(20) NOT NULL CHECK (action IN ('approve', 'reject', 'delegate', 'escalate', 'timeout')),
        performed_by TEXT REFERENCES profiles(id),
        delegated_to TEXT REFERENCES profiles(id),
        comment TEXT,
        performed_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('hr_validation_actions table created');

    // Step 5: Create indexes
    console.log('Step 5: Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON hr_validation_workflows(trigger_type);
      CREATE INDEX IF NOT EXISTS idx_workflows_active ON hr_validation_workflows(is_active);
      CREATE INDEX IF NOT EXISTS idx_workflows_segment ON hr_validation_workflows(segment_id);

      CREATE INDEX IF NOT EXISTS idx_steps_workflow ON hr_validation_workflow_steps(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_steps_order ON hr_validation_workflow_steps(workflow_id, step_order);

      CREATE INDEX IF NOT EXISTS idx_instances_workflow ON hr_validation_instances(workflow_id);
      CREATE INDEX IF NOT EXISTS idx_instances_request ON hr_validation_instances(request_type, request_id);
      CREATE INDEX IF NOT EXISTS idx_instances_status ON hr_validation_instances(status);
      CREATE INDEX IF NOT EXISTS idx_instances_initiated ON hr_validation_instances(initiated_by);

      CREATE INDEX IF NOT EXISTS idx_actions_instance ON hr_validation_actions(instance_id);
      CREATE INDEX IF NOT EXISTS idx_actions_performer ON hr_validation_actions(performed_by);
    `);
    console.log('Indexes created');

    // Step 6: Create default workflow for leave requests
    console.log('Step 6: Creating default workflow...');
    const workflowExists = await client.query(
      `SELECT id FROM hr_validation_workflows WHERE trigger_type = 'demande_conge' LIMIT 1`
    );

    if (workflowExists.rows.length === 0) {
      const workflow = await client.query(`
        INSERT INTO hr_validation_workflows (name, description, trigger_type, is_active, priority)
        VALUES (
          'Approbation Congés Standard',
          'Circuit standard pour les demandes de congés: Manager → RH',
          'demande_conge',
          true,
          1
        )
        RETURNING id
      `);

      const workflowId = workflow.rows[0].id;

      // Add steps
      await client.query(`
        INSERT INTO hr_validation_workflow_steps (workflow_id, step_order, approver_type, approver_role, approver_name)
        VALUES
          ($1, 1, 'manager', 'n1', 'Manager direct (N+1)'),
          ($1, 2, 'hr', 'hr', 'Responsable RH')
      `, [workflowId]);

      console.log('Default workflow created with 2 steps');
    }

    await client.query('COMMIT');

    // Get summary
    const tables = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name LIKE 'hr_validation%'
      ORDER BY table_name
    `);

    const workflows = await client.query('SELECT COUNT(*) FROM hr_validation_workflows');

    console.log('=== Migration 051 Complete ===');

    res.json({
      success: true,
      message: 'Migration 051 completed - HR Validation Workflows',
      summary: {
        tables_created: tables.rows.map(r => r.table_name),
        default_workflows: parseInt(workflows.rows[0].count)
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 051 failed:', error);
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
    await pool.query('DROP TABLE IF EXISTS hr_validation_actions CASCADE');
    await pool.query('DROP TABLE IF EXISTS hr_validation_instances CASCADE');
    await pool.query('DROP TABLE IF EXISTS hr_validation_workflow_steps CASCADE');
    await pool.query('DROP TABLE IF EXISTS hr_validation_workflows CASCADE');

    res.json({ success: true, message: 'Migration 051 rolled back' });
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
    const tables = ['hr_validation_workflows', 'hr_validation_workflow_steps', 'hr_validation_instances', 'hr_validation_actions'];
    const tableStatus = {};

    for (const table of tables) {
      const result = await pool.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = $1)`,
        [table]
      );
      tableStatus[table] = result.rows[0].exists;
    }

    const allTablesExist = Object.values(tableStatus).every(v => v);

    // Format compatible avec MigrationPanel
    res.json({
      status: {
        migrationNeeded: !allTablesExist,
        applied: allTablesExist,
        tables: tableStatus
      },
      message: allTablesExist
        ? 'Migration applied - All HR validation workflow tables exist'
        : 'Migration needed - Some HR validation workflow tables are missing'
    });
  } catch (error) {
    res.status(500).json({
      status: {
        migrationNeeded: true,
        applied: false,
        error: error.message
      },
      message: `Error checking status: ${error.message}`
    });
  } finally {
    await pool.end();
  }
});

export default router;
