import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * Migration pour ajouter la colonne formation_id à la table sessions
 * GET /api/migration-sessions/add-formation-id
 */
router.get('/add-formation-id', async (req, res) => {
  try {
    console.log('🔧 Starting migration: adding formation_id to sessions table...');

    // Vérifier si la colonne existe déjà
    const checkColumn = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'sessions'
      AND column_name = 'formation_id'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ Column formation_id already exists');
      return res.json({
        success: true,
        message: 'Column formation_id already exists',
        alreadyExists: true,
      });
    }

    // Ajouter la colonne formation_id (TEXT pour correspondre à la structure existante)
    await pool.query(`
      ALTER TABLE sessions
      ADD COLUMN formation_id TEXT REFERENCES formations(id) ON DELETE SET NULL
    `);
    console.log('✅ Column formation_id added successfully');

    // Créer un index pour améliorer les performances
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_sessions_formation_id
      ON sessions(formation_id)
    `);
    console.log('✅ Index on formation_id created');

    console.log('🎉 Migration completed successfully!');

    res.json({
      success: true,
      message: 'Migration completed: formation_id column added to sessions table',
      changes: [
        'Added formation_id column (UUID, nullable, FK to formations)',
        'Created index on formation_id',
      ],
    });
  } catch (error) {
    console.error('❌ Error during migration:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      detail: error.detail || 'No additional details',
    });
  }
});

/**
 * Migration alternative si la table s'appelle formation_sessions
 * GET /api/migration-sessions/add-formation-id-alt
 */
router.get('/add-formation-id-alt', async (req, res) => {
  try {
    console.log('🔧 Starting alternative migration...');

    // Vérifier si la table formation_sessions existe
    const checkTable = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'formation_sessions'
    `);

    if (checkTable.rows.length === 0) {
      return res.json({
        success: false,
        message: 'Table formation_sessions does not exist. Use /add-formation-id instead.',
      });
    }

    // Vérifier si la colonne existe
    const checkColumn = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'formation_sessions'
      AND column_name = 'formation_id'
    `);

    if (checkColumn.rows.length > 0) {
      console.log('✅ Column formation_id already exists');
      return res.json({
        success: true,
        message: 'Column formation_id already exists',
        alreadyExists: true,
      });
    }

    // Ajouter la colonne (TEXT pour correspondre à la structure existante)
    await pool.query(`
      ALTER TABLE formation_sessions
      ADD COLUMN formation_id TEXT REFERENCES formations(id) ON DELETE SET NULL
    `);
    console.log('✅ Column formation_id added to formation_sessions');

    // Créer un index
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_formation_sessions_formation_id
      ON formation_sessions(formation_id)
    `);
    console.log('✅ Index created');

    res.json({
      success: true,
      message: 'Migration completed on formation_sessions table',
    });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Diagnostic: vérifier la structure de la table
 * GET /api/migration-sessions/check-structure
 */
router.get('/check-structure', async (req, res) => {
  try {
    // Vérifier quelle table existe
    const tables = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name IN ('sessions', 'formation_sessions')
      ORDER BY table_name
    `);

    const results = {};

    for (const table of tables.rows) {
      const tableName = table.table_name;

      // Obtenir les colonnes de cette table
      const columns = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      results[tableName] = {
        exists: true,
        columns: columns.rows,
      };
    }

    res.json({
      success: true,
      tables: results,
    });
  } catch (error) {
    console.error('Error checking structure:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
