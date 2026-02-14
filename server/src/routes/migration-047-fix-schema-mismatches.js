import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 047: Fix Schema Mismatches Between Migrations and Code
// Fixes critical column name and structure issues preventing core HR features from working

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 047: Fix Schema Mismatches ===');

    // ========== FIX #1: hr_contracts table ==========
    console.log('Step 1: Fixing hr_contracts table...');

    // Check if probation_end_date exists (need to rename)
    const checkProbation = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'hr_contracts'
        AND column_name IN ('probation_end_date', 'trial_period_end')
    `);

    const contractCols = checkProbation.rows.map(r => r.column_name);

    if (contractCols.includes('probation_end_date') && !contractCols.includes('trial_period_end')) {
      console.log('  - Renaming probation_end_date to trial_period_end...');
      await client.query(`
        ALTER TABLE hr_contracts
        RENAME COLUMN probation_end_date TO trial_period_end
      `);
      console.log('  ✓ Column renamed');
    } else if (contractCols.includes('trial_period_end')) {
      console.log('  ✓ trial_period_end already exists');
    }

    // Add base_salary and salary_currency columns if missing
    const checkSalary = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'hr_contracts'
        AND column_name IN ('base_salary', 'salary_currency')
    `);

    const salaryCols = checkSalary.rows.map(r => r.column_name);

    if (!salaryCols.includes('base_salary')) {
      console.log('  - Adding base_salary column...');
      await client.query(`
        ALTER TABLE hr_contracts
        ADD COLUMN base_salary DECIMAL(10,2)
      `);
      console.log('  ✓ base_salary added');
    }

    if (!salaryCols.includes('salary_currency')) {
      console.log('  - Adding salary_currency column...');
      await client.query(`
        ALTER TABLE hr_contracts
        ADD COLUMN salary_currency TEXT DEFAULT 'MAD'
      `);
      console.log('  ✓ salary_currency added');
    }

    // ========== FIX #2: hr_disciplinary_actions table ==========
    console.log('Step 2: Fixing hr_disciplinary_actions table...');

    // Check if action_date exists (need to rename)
    const checkActionDate = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'hr_disciplinary_actions'
        AND column_name IN ('action_date', 'issue_date')
    `);

    const actionDateCols = checkActionDate.rows.map(r => r.column_name);

    if (actionDateCols.includes('action_date') && !actionDateCols.includes('issue_date')) {
      console.log('  - Renaming action_date to issue_date...');
      await client.query(`
        ALTER TABLE hr_disciplinary_actions
        RENAME COLUMN action_date TO issue_date
      `);
      console.log('  ✓ Column renamed');
    } else if (actionDateCols.includes('issue_date')) {
      console.log('  ✓ issue_date already exists');
    }

    // Add severity column if missing
    const checkSeverity = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'hr_disciplinary_actions'
        AND column_name = 'severity'
    `);

    if (checkSeverity.rows.length === 0) {
      console.log('  - Adding severity column...');
      await client.query(`
        ALTER TABLE hr_disciplinary_actions
        ADD COLUMN severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium'
      `);
      console.log('  ✓ severity column added');
    } else {
      console.log('  ✓ severity column already exists');
    }

    // ========== FIX #3: hr_work_schedules table ==========
    console.log('Step 3: Fixing hr_work_schedules table...');

    // Check if day-specific columns exist
    const checkScheduleCols = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'hr_work_schedules'
        AND column_name LIKE '%_start'
      ORDER BY column_name
    `);

    const existingDayCols = checkScheduleCols.rows.map(r => r.column_name);
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

    // Add day-specific time columns
    for (const day of days) {
      const startCol = `${day}_start`;
      const endCol = `${day}_end`;

      if (!existingDayCols.includes(startCol)) {
        console.log(`  - Adding ${startCol} and ${endCol} columns...`);
        await client.query(`
          ALTER TABLE hr_work_schedules
          ADD COLUMN ${startCol} TIME,
          ADD COLUMN ${endCol} TIME
        `);
        console.log(`  ✓ ${day} columns added`);
      }
    }

    // Add weekly_hours column if missing
    const checkWeeklyHours = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'hr_work_schedules'
        AND column_name = 'weekly_hours'
    `);

    if (checkWeeklyHours.rows.length === 0) {
      console.log('  - Adding weekly_hours column...');
      await client.query(`
        ALTER TABLE hr_work_schedules
        ADD COLUMN weekly_hours DECIMAL(4,2)
      `);
      console.log('  ✓ weekly_hours column added');
    } else {
      console.log('  ✓ weekly_hours column already exists');
    }

    await client.query('COMMIT');

    console.log('=== Migration 047 Complete ===');

    res.json({
      success: true,
      message: 'Migration 047 completed successfully - Schema mismatches fixed',
      fixes: [
        'hr_contracts: probation_end_date → trial_period_end',
        'hr_contracts: Added base_salary and salary_currency',
        'hr_disciplinary_actions: action_date → issue_date',
        'hr_disciplinary_actions: Added severity column',
        'hr_work_schedules: Added day-specific time columns (monday_start, etc.)',
        'hr_work_schedules: Added weekly_hours column'
      ]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 047 Error:', error);

    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Failed to fix schema mismatches',
      hint: 'Check if the tables exist and if previous migrations (041-042) have been run'
    });
  } finally {
    client.release();
    await pool.end();
  }
});

export default router;
