import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * Migration 010: Créer la table session_formations (many-to-many)
 * Cette table remplace le champ formation_id direct dans formation_sessions
 * pour permettre à une session d'avoir plusieurs formations
 *
 * GET /api/migration-010/create-session-formations-table
 */
router.get('/create-session-formations-table', async (req, res) => {
  try {
    console.log('🔧 Migration 010: Creating session_formations junction table...');

    // Vérifier si la table existe déjà
    const checkTable = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'session_formations'
    `);

    if (checkTable.rows.length > 0) {
      console.log('✅ Table session_formations already exists');
      return res.json({
        success: true,
        message: 'Table session_formations already exists',
        alreadyExists: true,
      });
    }

    // Créer la table session_formations (many-to-many)
    await pool.query(`
      CREATE TABLE session_formations (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
        session_id TEXT NOT NULL,
        formation_id TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES formation_sessions(id) ON DELETE CASCADE,
        FOREIGN KEY (formation_id) REFERENCES formations(id) ON DELETE CASCADE,
        UNIQUE(session_id, formation_id)
      )
    `);
    console.log('✅ Table session_formations created');

    // Créer des index pour améliorer les performances
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_session_formations_session_id
      ON session_formations(session_id)
    `);
    console.log('✅ Index on session_id created');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_session_formations_formation_id
      ON session_formations(formation_id)
    `);
    console.log('✅ Index on formation_id created');

    console.log('🎉 Migration 010 completed successfully!');

    res.json({
      success: true,
      message: 'Migration 010 completed: session_formations junction table created',
      changes: [
        'Created session_formations table with (id, session_id, formation_id, created_at)',
        'Added UNIQUE constraint on (session_id, formation_id)',
        'Created index on session_id',
        'Created index on formation_id',
      ],
    });
  } catch (error) {
    console.error('❌ Error during migration 010:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      detail: error.detail || 'No additional details',
    });
  }
});

/**
 * Diagnostic: vérifier la structure de la table session_formations
 * GET /api/migration-010/check-structure
 */
router.get('/check-structure', async (req, res) => {
  try {
    // Vérifier si la table existe
    const checkTable = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'session_formations'
    `);

    if (checkTable.rows.length === 0) {
      return res.json({
        success: true,
        exists: false,
        message: 'Table session_formations does not exist yet',
      });
    }

    // Obtenir les colonnes
    const columns = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'session_formations'
      ORDER BY ordinal_position
    `);

    // Obtenir les contraintes
    const constraints = await pool.query(`
      SELECT constraint_name, constraint_type
      FROM information_schema.table_constraints
      WHERE table_name = 'session_formations'
    `);

    // Compter les enregistrements
    const count = await pool.query(`
      SELECT COUNT(*) as count FROM session_formations
    `);

    res.json({
      success: true,
      exists: true,
      columns: columns.rows,
      constraints: constraints.rows,
      record_count: parseInt(count.rows[0].count),
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
