import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

/**
 * Migration complète pour ajouter toutes les colonnes manquantes
 * GET /api/migration-sessions-complete/run
 */
router.get('/run', async (req, res) => {
  try {
    console.log('🔧 Starting complete migration for sessions table...');

    const changes = [];

    // Vérifier et ajouter segment_id
    const checkSegmentId = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'formation_sessions'
      AND column_name = 'segment_id'
    `);

    if (checkSegmentId.rows.length === 0) {
      await pool.query(`
        ALTER TABLE formation_sessions
        ADD COLUMN segment_id TEXT REFERENCES segments(id) ON DELETE SET NULL
      `);
      console.log('✅ Added segment_id column');
      changes.push('Added segment_id (TEXT, nullable, FK to segments)');
    } else {
      console.log('ℹ️ segment_id already exists');
    }

    // Vérifier et ajouter city_id
    const checkCityId = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'formation_sessions'
      AND column_name = 'city_id'
    `);

    if (checkCityId.rows.length === 0) {
      await pool.query(`
        ALTER TABLE formation_sessions
        ADD COLUMN city_id TEXT REFERENCES cities(id) ON DELETE SET NULL
      `);
      console.log('✅ Added city_id column');
      changes.push('Added city_id (TEXT, nullable, FK to cities)');
    } else {
      console.log('ℹ️ city_id already exists');
    }

    // Créer des index pour améliorer les performances
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_formation_sessions_segment_id
      ON formation_sessions(segment_id)
    `);
    console.log('✅ Index on segment_id created');

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_formation_sessions_city_id
      ON formation_sessions(city_id)
    `);
    console.log('✅ Index on city_id created');

    console.log('🎉 Complete migration finished!');

    res.json({
      success: true,
      message: 'Complete migration executed successfully',
      changes: changes.length > 0 ? changes : ['No changes needed - all columns already exist'],
    });
  } catch (error) {
    console.error('❌ Error during complete migration:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      detail: error.detail || 'No additional details',
    });
  }
});

/**
 * Vérifier toutes les colonnes de formation_sessions
 * GET /api/migration-sessions-complete/verify
 */
router.get('/verify', async (req, res) => {
  try {
    const requiredColumns = [
      'id',
      'name',
      'description',
      'formation_id',
      'start_date',
      'end_date',
      'segment_id',
      'city_id',
      'instructor_id',
      'max_capacity',
      'status',
      'created_at',
      'updated_at',
    ];

    const existingColumns = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'formation_sessions'
      ORDER BY ordinal_position
    `);

    const columnNames = existingColumns.rows.map(c => c.column_name);
    const missing = requiredColumns.filter(col => !columnNames.includes(col));
    const present = requiredColumns.filter(col => columnNames.includes(col));

    res.json({
      success: true,
      required: requiredColumns,
      present: present,
      missing: missing,
      allColumnsPresent: missing.length === 0,
      existingColumns: existingColumns.rows,
    });
  } catch (error) {
    console.error('Error verifying columns:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
