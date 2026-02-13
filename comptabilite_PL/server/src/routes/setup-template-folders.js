import express from 'express';
import pool from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

/**
 * Execute template folders migration
 * GET /api/setup-template-folders/run-setup
 */
router.get('/run-setup', async (req, res) => {
  try {
    console.log('🔧 Starting template folders migration (009)...');

    // Read migration file
    const migrationPath = path.join(__dirname, '../../migrations/009_template_folders.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute migration
    await pool.query(migrationSQL);

    console.log('✅ Template folders migration completed successfully!');

    res.json({
      success: true,
      message: 'Template folders migration completed',
      details: {
        created_tables: ['template_folders'],
        altered_tables: ['certificate_templates', 'formations'],
        removed_columns: ['certificate_templates.is_default', 'formations.default_certificate_template_id'],
        default_folder: 'Général (created and populated with existing templates)',
      },
    });
  } catch (error) {
    console.error('❌ Error during template folders migration:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      detail: error.detail || 'No additional details',
      hint: error.hint || 'Check server logs for more information',
    });
  }
});

/**
 * Verify migration status
 * GET /api/setup-template-folders/verify
 */
router.get('/verify', async (req, res) => {
  try {
    // Check template_folders table exists
    const foldersTable = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'template_folders'
      ORDER BY ordinal_position
    `);

    // Check certificate_templates.folder_id column
    const folderIdColumn = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'certificate_templates' AND column_name = 'folder_id'
    `);

    // Check if is_default was removed
    const isDefaultExists = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'certificate_templates' AND column_name = 'is_default'
    `);

    // Check if formations.default_certificate_template_id was removed
    const formationsDefaultExists = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'formations' AND column_name = 'default_certificate_template_id'
    `);

    // Count folders
    const foldersCount = await pool.query('SELECT COUNT(*) as count FROM template_folders');

    // Check "Général" folder
    const generalFolder = await pool.query(`
      SELECT id, name, parent_id
      FROM template_folders
      WHERE name = 'Général' AND parent_id IS NULL
    `);

    // Count templates in each folder
    const templatesPerFolder = await pool.query(`
      SELECT
        tf.id,
        tf.name as folder_name,
        COUNT(ct.id) as template_count
      FROM template_folders tf
      LEFT JOIN certificate_templates ct ON ct.folder_id = tf.id
      GROUP BY tf.id, tf.name
      ORDER BY tf.name
    `);

    res.json({
      success: true,
      migration_status: {
        template_folders_table: {
          exists: foldersTable.rows.length > 0,
          columns: foldersTable.rows,
          total_folders: parseInt(foldersCount.rows[0].count),
        },
        certificate_templates_folder_id: {
          exists: folderIdColumn.rows.length > 0,
          column: folderIdColumn.rows[0] || null,
        },
        is_default_removed: {
          removed: isDefaultExists.rows.length === 0,
          status: isDefaultExists.rows.length === 0 ? '✅ Removed' : '⚠️ Still exists',
        },
        formations_default_removed: {
          removed: formationsDefaultExists.rows.length === 0,
          status: formationsDefaultExists.rows.length === 0 ? '✅ Removed' : '⚠️ Still exists',
        },
        general_folder: {
          exists: generalFolder.rows.length > 0,
          folder: generalFolder.rows[0] || null,
        },
        templates_per_folder: templatesPerFolder.rows,
      },
    });
  } catch (error) {
    console.error('Error verifying template folders migration:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
