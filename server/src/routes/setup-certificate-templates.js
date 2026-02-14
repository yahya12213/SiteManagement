import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * Setup endpoint to create certificate_templates table
 * GET /api/setup-certificate-templates/run-setup
 */
router.get('/run-setup', async (req, res) => {
  try {
    console.log('🔧 Starting certificate templates table setup...');

    // Create certificate_templates table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS certificate_templates (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        name TEXT NOT NULL,
        description TEXT,
        template_config JSONB NOT NULL,
        is_default BOOLEAN DEFAULT false,
        preview_image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✅ certificate_templates table created');

    // Create indexes for better performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_certificate_templates_default
      ON certificate_templates(is_default)
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_certificate_templates_name
      ON certificate_templates(name)
    `);

    console.log('✅ Indexes created');

    // Alter certificates table to add template_id column
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'certificates' AND column_name = 'template_id'
        ) THEN
          ALTER TABLE certificates ADD COLUMN template_id TEXT REFERENCES certificate_templates(id) ON DELETE SET NULL;
          CREATE INDEX idx_certificates_template ON certificates(template_id);
        END IF;
      END $$;
    `);
    console.log('✅ certificates table altered (template_id added)');

    // Alter formations table to add default_certificate_template_id column
    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'formations' AND column_name = 'default_certificate_template_id'
        ) THEN
          ALTER TABLE formations ADD COLUMN default_certificate_template_id TEXT REFERENCES certificate_templates(id) ON DELETE SET NULL;
          CREATE INDEX idx_formations_template ON formations(default_certificate_template_id);
        END IF;
      END $$;
    `);
    console.log('✅ formations table altered (default_certificate_template_id added)');

    console.log('🎉 Certificate templates setup complete!');

    res.json({
      success: true,
      message: 'Certificate templates tables created successfully',
      tables: ['certificate_templates'],
      altered_tables: ['certificates', 'formations'],
    });
  } catch (error) {
    console.error('❌ Error during certificate templates setup:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      detail: error.detail || 'No additional details',
    });
  }
});

/**
 * Verify if the tables exist and are properly configured
 * GET /api/setup-certificate-templates/verify
 */
router.get('/verify', async (req, res) => {
  try {
    // Check certificate_templates table
    const templatesTable = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'certificate_templates'
      ORDER BY ordinal_position;
    `);

    // Check certificates.template_id column
    const certificatesColumn = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'certificates' AND column_name = 'template_id';
    `);

    // Check formations.default_certificate_template_id column
    const formationsColumn = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'formations' AND column_name = 'default_certificate_template_id';
    `);

    // Count existing templates
    const countResult = await pool.query('SELECT COUNT(*) as count FROM certificate_templates');

    res.json({
      success: true,
      certificate_templates_table: {
        exists: templatesTable.rows.length > 0,
        columns: templatesTable.rows,
      },
      certificates_template_id: {
        exists: certificatesColumn.rows.length > 0,
        column: certificatesColumn.rows[0] || null,
      },
      formations_template_id: {
        exists: formationsColumn.rows.length > 0,
        column: formationsColumn.rows[0] || null,
      },
      templates_count: parseInt(countResult.rows[0].count),
    });
  } catch (error) {
    console.error('Error verifying certificate templates setup:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
