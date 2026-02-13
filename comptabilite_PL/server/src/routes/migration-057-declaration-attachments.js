import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 057: Créer la table declaration_attachments pour les pièces jointes
router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 057: Créer table declaration_attachments ===');

    // Créer la table declaration_attachments
    await client.query(`
      CREATE TABLE IF NOT EXISTS declaration_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        declaration_id UUID NOT NULL REFERENCES professor_declarations(id) ON DELETE CASCADE,
        filename VARCHAR(500) NOT NULL,
        original_filename VARCHAR(500) NOT NULL,
        file_url VARCHAR(1000) NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
        uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);
    console.log('  ✓ Table declaration_attachments created');

    // Créer un index sur declaration_id pour accélérer les requêtes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_declaration_attachments_declaration_id
      ON declaration_attachments(declaration_id)
    `);
    console.log('  ✓ Index on declaration_id created');

    // Créer un index sur uploaded_at pour le tri
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_declaration_attachments_uploaded_at
      ON declaration_attachments(uploaded_at DESC)
    `);
    console.log('  ✓ Index on uploaded_at created');

    await client.query('COMMIT');

    console.log('\n=== Migration 057 completed successfully! ===');

    res.json({
      success: true,
      message: 'Migration 057 executed successfully - declaration_attachments table created'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 057 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  } finally {
    client.release();
    await pool.end();
  }
});

// GET endpoint to check migration status
router.get('/status', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Check if table exists
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'declaration_attachments'
      )
    `);

    // Check if indexes exist
    const indexCheck = await pool.query(`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE tablename = 'declaration_attachments'
    `);

    // Count attachments if table exists
    let attachmentCount = 0;
    if (tableCheck.rows[0].exists) {
      const countResult = await pool.query(`SELECT COUNT(*) as count FROM declaration_attachments`);
      attachmentCount = parseInt(countResult.rows[0].count);
    }

    const status = {
      tableExists: tableCheck.rows[0].exists,
      indexCount: parseInt(indexCheck.rows[0].count),
      attachmentCount: attachmentCount,
      migrationNeeded: !tableCheck.rows[0].exists
    };

    res.json({
      success: true,
      status,
      message: status.migrationNeeded ?
        'Migration 057 needs to be run - declaration_attachments table does not exist' :
        'Migration 057 already applied - declaration_attachments table exists'
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
