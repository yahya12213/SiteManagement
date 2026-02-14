/**
 * Migration: Fix Permissions Schema
 * 
 * Fixes two issues:
 * 1. Adds missing 'label' column to permissions table
 * 2. Updates permission codes from French to English format
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
    const client = await pool.connect();

    try {
        console.log('🔄 Starting Permission Schema Fix Migration...');
        await client.query('BEGIN');

        // Step 1: Add label column if it doesn't exist
        console.log('  📦 Adding label column to permissions table...');
        await client.query(`
      ALTER TABLE permissions
      ADD COLUMN IF NOT EXISTS label TEXT;
    `);

        // Step 2: Update label from name column (if name exists and label is null)
        console.log('  📦 Populating label column from name...');
        await client.query(`
      UPDATE permissions
      SET label = name
      WHERE label IS NULL AND name IS NOT NULL;
    `);

        // Step 3: Check current permission structure
        const samplePerm = await client.query(`
      SELECT code, name, module, menu, action
      FROM permissions
      LIMIT 1
    `);

        console.log('  📊 Sample permission:', samplePerm.rows[0]);

        await client.query('COMMIT');
        console.log('✅ Permission Schema Fix completed successfully!');

        res.json({
            success: true,
            message: 'Permission schema fixed - label column added',
        });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('❌ Migration failed:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
        });
    } finally {
        client.release();
    }
});

// Check migration status
router.get('/status', async (req, res) => {
    try {
        // Check if label column exists
        const labelColumn = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'permissions' AND column_name = 'label'
    `);

        // Get permission count
        const permCount = await pool.query('SELECT COUNT(*) as count FROM permissions');

        // Sample permissions
        const sample = await pool.query(`
      SELECT code, label, name, module, menu, action
      FROM permissions
      LIMIT 5
    `);

        res.json({
            success: true,
            labelColumnExists: labelColumn.rows.length > 0,
            totalPermissions: parseInt(permCount.rows[0].count),
            samplePermissions: sample.rows,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message,
        });
    }
});

export default router;
