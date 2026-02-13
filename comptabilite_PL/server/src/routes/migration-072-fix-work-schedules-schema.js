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

    console.log('=== Migration 072: Fix Work Schedules Schema ===');

    // Step 1: Ensure only one schedule is active
    console.log('Step 1: Deactivating all but one schedule...');

    // First, check if we have any active schedules
    const activeCheck = await client.query(`
      SELECT id, name, is_default, created_at
      FROM hr_work_schedules
      WHERE is_active = true
      ORDER BY is_default DESC, created_at DESC
    `);

    if (activeCheck.rows.length > 0) {
      console.log(`Found ${activeCheck.rows.length} active schedule(s)`);

      // Keep the first one (default or most recent), deactivate the rest
      const scheduleToKeep = activeCheck.rows[0];
      console.log(`Keeping schedule: ${scheduleToKeep.name} (ID: ${scheduleToKeep.id})`);

      await client.query(`
        UPDATE hr_work_schedules
        SET is_active = false
        WHERE id != $1 AND is_active = true
      `, [scheduleToKeep.id]);

      console.log(`Deactivated ${activeCheck.rows.length - 1} other schedule(s)`);
    } else {
      // No active schedules, activate the default or first one
      console.log('No active schedules found, activating default or first schedule...');
      const firstSchedule = await client.query(`
        SELECT id, name FROM hr_work_schedules
        ORDER BY is_default DESC, created_at DESC
        LIMIT 1
      `);

      if (firstSchedule.rows.length > 0) {
        await client.query(`
          UPDATE hr_work_schedules
          SET is_active = true
          WHERE id = $1
        `, [firstSchedule.rows[0].id]);
        console.log(`Activated schedule: ${firstSchedule.rows[0].name}`);
      } else {
        console.log('No schedules found in database');
      }
    }

    // Step 2: Drop existing index if it exists
    console.log('Step 2: Preparing unique index...');
    await client.query(`
      DROP INDEX IF EXISTS idx_hr_work_schedules_single_active
    `);

    // Create unique partial index to enforce single active schedule
    await client.query(`
      CREATE UNIQUE INDEX idx_hr_work_schedules_single_active
      ON hr_work_schedules (is_active)
      WHERE is_active = true
    `);
    console.log('Created unique index for single active schedule');

    // Step 3: Create validation function
    console.log('Step 3: Creating validation function...');
    await client.query(`
      CREATE OR REPLACE FUNCTION validate_work_schedule_active()
      RETURNS TRIGGER AS $$
      BEGIN
        -- If setting this schedule to active, deactivate all others
        IF NEW.is_active = true THEN
          UPDATE hr_work_schedules
          SET is_active = false
          WHERE id != NEW.id AND is_active = true;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    console.log('Created validation function');

    // Step 4: Create trigger
    console.log('Step 4: Creating trigger...');
    await client.query(`
      DROP TRIGGER IF EXISTS trg_work_schedule_active ON hr_work_schedules;
    `);

    await client.query(`
      CREATE TRIGGER trg_work_schedule_active
        BEFORE INSERT OR UPDATE ON hr_work_schedules
        FOR EACH ROW
        EXECUTE FUNCTION validate_work_schedule_active();
    `);
    console.log('Created trigger');

    await client.query('COMMIT');

    console.log('=== Migration 072 Complete ===');

    // Get current active schedule
    const activeSchedule = await client.query(`
      SELECT id, name, is_active, is_default
      FROM hr_work_schedules
      WHERE is_active = true
      LIMIT 1
    `);

    res.json({
      success: true,
      message: 'Migration 072 completed - Single active schedule enforced',
      active_schedule: activeSchedule.rows[0] || null
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 072 Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  } finally {
    client.release();
    await pool.end();
  }
});

export default router;
