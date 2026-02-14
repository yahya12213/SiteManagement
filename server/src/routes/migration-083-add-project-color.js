/**
 * Migration 082: Add color column to projects table
 *
 * Purpose: Allow project cards to have custom colors for better visual organization
 *
 * Changes:
 * - Add color VARCHAR(7) column to projects table
 * - Default color: #3b82f6 (blue)
 * - Format: hex color code (#RRGGBB)
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 082: Add color column to projects table ===\n');

    // 1. Check if color column already exists
    console.log('Step 1: Checking if color column exists...');
    const checkColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'projects'
        AND column_name = 'color'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('⚠ Color column already exists, skipping migration');
      await client.query('COMMIT');
      return res.json({
        success: true,
        message: 'Color column already exists',
        skipped: true
      });
    }

    console.log('✓ Color column does not exist, proceeding with migration\n');

    // 2. Add color column
    console.log('Step 2: Adding color column to projects table...');
    await client.query(`
      ALTER TABLE projects
      ADD COLUMN color VARCHAR(7) DEFAULT '#3b82f6'
    `);
    console.log('✓ Color column added successfully\n');

    // 3. Verify column was added
    console.log('Step 3: Verifying column was added...');
    const verifyColumn = await client.query(`
      SELECT column_name, column_default, data_type
      FROM information_schema.columns
      WHERE table_name = 'projects'
        AND column_name = 'color'
    `);

    if (verifyColumn.rows.length === 0) {
      throw new Error('Failed to add color column');
    }

    console.log('✓ Column verified:');
    console.log(`  - Name: ${verifyColumn.rows[0].column_name}`);
    console.log(`  - Type: ${verifyColumn.rows[0].data_type}`);
    console.log(`  - Default: ${verifyColumn.rows[0].column_default}\n`);

    // 4. Count existing projects
    console.log('Step 4: Checking existing projects...');
    const countResult = await client.query('SELECT COUNT(*) FROM projects');
    const projectCount = parseInt(countResult.rows[0].count);
    console.log(`✓ Found ${projectCount} existing projects (all will have default color #3b82f6)\n`);

    await client.query('COMMIT');

    console.log('=== Migration 082 completed successfully! ===');
    console.log('\n📋 Summary:');
    console.log('  - Color column added to projects table');
    console.log('  - Default color: #3b82f6 (blue)');
    console.log('  - Format: hex color code (#RRGGBB)');
    console.log(`  - ${projectCount} existing projects updated with default color\n`);

    res.json({
      success: true,
      message: 'Color column added to projects table',
      projectsUpdated: projectCount
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 082 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

router.get('/status', async (req, res) => {
  try {
    // Check if color column exists
    const checkColumn = await pool.query(`
      SELECT column_name, column_default
      FROM information_schema.columns
      WHERE table_name = 'projects'
        AND column_name = 'color'
    `);

    const columnExists = checkColumn.rows.length > 0;

    res.json({
      status: {
        migrationNeeded: !columnExists,
        applied: columnExists,
        columnExists
      },
      message: columnExists
        ? 'Color column exists in projects table'
        : 'Color column missing - run migration to add it'
    });
  } catch (error) {
    res.status(500).json({
      status: { migrationNeeded: true, applied: false, error: error.message },
      message: `Error checking status: ${error.message}`
    });
  }
});

export default router;
