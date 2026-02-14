import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * Migration 014: Migrer les données existantes vers session_formations
 * Copie les relations formation_sessions.formation_id vers la table session_formations
 * et supprime ensuite la colonne formation_id de formation_sessions
 *
 * GET /api/migration-014/migrate-data
 */
router.get('/migrate-data', async (req, res) => {
  try {
    console.log('🔧 Migration 014: Migrating existing session-formation data...');

    // Vérifier si la table session_formations existe
    const checkTable = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_name = 'session_formations'
    `);

    if (checkTable.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Table session_formations does not exist. Run migration 010 first.',
      });
    }

    // Vérifier si la colonne formation_id existe dans formation_sessions
    const checkColumn = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'formation_sessions'
      AND column_name = 'formation_id'
    `);

    if (checkColumn.rows.length === 0) {
      console.log('✅ Column formation_id does not exist - migration already completed or not needed');
      return res.json({
        success: true,
        message: 'Column formation_id does not exist in formation_sessions - migration already completed',
        migrated_count: 0,
      });
    }

    // Compter combien de sessions ont un formation_id (non NULL)
    const countQuery = await pool.query(`
      SELECT COUNT(*) as count
      FROM formation_sessions
      WHERE formation_id IS NOT NULL
    `);
    const totalToMigrate = parseInt(countQuery.rows[0].count);
    console.log(`📊 Found ${totalToMigrate} sessions with formation_id to migrate`);

    if (totalToMigrate === 0) {
      console.log('✅ No data to migrate');
      return res.json({
        success: true,
        message: 'No sessions with formation_id found - nothing to migrate',
        migrated_count: 0,
      });
    }

    // Migrer les données vers session_formations
    // INSERT ... ON CONFLICT DO NOTHING pour éviter les doublons si la migration est relancée
    const migrateQuery = await pool.query(`
      INSERT INTO session_formations (session_id, formation_id, created_at)
      SELECT
        id as session_id,
        formation_id,
        created_at
      FROM formation_sessions
      WHERE formation_id IS NOT NULL
      ON CONFLICT (session_id, formation_id) DO NOTHING
      RETURNING *
    `);

    const migratedCount = migrateQuery.rows.length;
    console.log(`✅ Migrated ${migratedCount} session-formation relationships`);

    res.json({
      success: true,
      message: 'Migration 014 completed: Data migrated to session_formations',
      migrated_count: migratedCount,
      total_found: totalToMigrate,
      next_step: 'Run /drop-formation-id-column to remove the old column from formation_sessions',
    });
  } catch (error) {
    console.error('❌ Error during migration 014:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      detail: error.detail || 'No additional details',
    });
  }
});

/**
 * Migration 014B: Supprimer la colonne formation_id de formation_sessions
 * À exécuter APRÈS avoir vérifié que la migration des données est réussie
 *
 * GET /api/migration-014/drop-formation-id-column
 */
router.get('/drop-formation-id-column', async (req, res) => {
  try {
    console.log('🔧 Migration 014B: Dropping formation_id column...');

    // Vérifier si la colonne existe
    const checkColumn = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'formation_sessions'
      AND column_name = 'formation_id'
    `);

    if (checkColumn.rows.length === 0) {
      console.log('✅ Column formation_id already dropped');
      return res.json({
        success: true,
        message: 'Column formation_id does not exist - already dropped',
        alreadyDropped: true,
      });
    }

    // Supprimer la colonne formation_id
    await pool.query(`
      ALTER TABLE formation_sessions
      DROP COLUMN formation_id
    `);
    console.log('✅ Column formation_id dropped from formation_sessions');

    console.log('🎉 Migration 014B completed successfully!');

    res.json({
      success: true,
      message: 'Migration 014B completed: formation_id column dropped from formation_sessions',
    });
  } catch (error) {
    console.error('❌ Error during migration 014B:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      detail: error.detail || 'No additional details',
    });
  }
});

/**
 * Diagnostic: comparer les données avant/après migration
 * GET /api/migration-014/check-data
 */
router.get('/check-data', async (req, res) => {
  try {
    // Compter les sessions avec formation_id (si la colonne existe encore)
    let oldColumnCount = 0;
    let oldColumnExists = false;

    const checkColumn = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'formation_sessions'
      AND column_name = 'formation_id'
    `);

    if (checkColumn.rows.length > 0) {
      oldColumnExists = true;
      const countOld = await pool.query(`
        SELECT COUNT(*) as count
        FROM formation_sessions
        WHERE formation_id IS NOT NULL
      `);
      oldColumnCount = parseInt(countOld.rows[0].count);
    }

    // Compter les relations dans session_formations
    const countNew = await pool.query(`
      SELECT COUNT(*) as count
      FROM session_formations
    `);
    const newTableCount = parseInt(countNew.rows[0].count);

    // Obtenir quelques exemples de relations
    const examples = await pool.query(`
      SELECT
        sf.session_id,
        fs.name as session_name,
        f.title as formation_title,
        sf.created_at
      FROM session_formations sf
      LEFT JOIN formation_sessions fs ON sf.session_id = fs.id
      LEFT JOIN formations f ON sf.formation_id = f.id
      ORDER BY sf.created_at DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      old_column: {
        exists: oldColumnExists,
        count: oldColumnCount,
      },
      new_table: {
        count: newTableCount,
      },
      migration_status: oldColumnExists
        ? oldColumnCount === newTableCount
          ? 'ready_to_drop_column'
          : 'data_mismatch'
        : 'completed',
      examples: examples.rows,
    });
  } catch (error) {
    console.error('Error checking data:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
