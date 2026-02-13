import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 051: Add break_rules setting to hr_settings
// Configures automatic break deduction for attendance calculations

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 051: Add break_rules to hr_settings ===');

    // Check if break_rules setting already exists
    const checkSetting = await client.query(`
      SELECT setting_key
      FROM hr_settings
      WHERE setting_key = 'break_rules'
    `);

    if (checkSetting.rows.length > 0) {
      console.log('✓ break_rules setting already exists - skipping');
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'Migration 051 already applied - break_rules setting exists',
        skipped: true
      });
    }

    // Insert break_rules setting with default values
    console.log('Adding break_rules setting...');

    const defaultBreakRules = {
      default_break_minutes: 60,
      break_start_after_hours: 4,
      deduct_break_automatically: true,
      allow_multiple_breaks: false,
      max_breaks_per_day: 1
    };

    await client.query(`
      INSERT INTO hr_settings (
        setting_key,
        setting_value,
        description,
        category,
        is_editable,
        created_at,
        updated_at
      ) VALUES (
        'break_rules',
        $1::jsonb,
        'Règles de pause : durée automatique, déduction des heures travaillées',
        'attendance',
        true,
        NOW(),
        NOW()
      )
    `, [JSON.stringify(defaultBreakRules)]);

    console.log('✓ break_rules setting added with defaults:');
    console.log('  - Default break: 60 minutes');
    console.log('  - Applied after: 4 hours of work');
    console.log('  - Auto-deduction: enabled');

    await client.query('COMMIT');

    console.log('=== Migration 051 Complete ===');

    res.json({
      success: true,
      message: 'Migration 051 completed successfully - Added break_rules setting',
      details: {
        setting: 'break_rules',
        defaults: defaultBreakRules,
        description: 'Employees do not need to clock out for regular breaks. Break time is automatically deducted.'
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 051 Error:', error);

    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Failed to add break_rules setting',
      hint: 'Check if hr_settings table exists and if Migration 044 has been run'
    });
  } finally {
    client.release();
    await pool.end();
  }
});

export default router;
