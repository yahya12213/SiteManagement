/**
 * Migration CRITICAL: Create gerant_segments and gerant_cities tables
 * Required for SBAC (Segment-Based Access Control) to work for gérant users
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Creating gerant_segments and gerant_cities tables ===\n');

    // 1. Create gerant_segments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS gerant_segments (
        gerant_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        segment_id TEXT NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
        PRIMARY KEY (gerant_id, segment_id)
      )
    `);
    console.log('✓ gerant_segments table created');

    // 2. Create gerant_cities table
    await client.query(`
      CREATE TABLE IF NOT EXISTS gerant_cities (
        gerant_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
        city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
        PRIMARY KEY (gerant_id, city_id)
      )
    `);
    console.log('✓ gerant_cities table created');

    // 3. Create indexes for performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_gerant_segments_gerant_id
      ON gerant_segments(gerant_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_gerant_segments_segment_id
      ON gerant_segments(segment_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_gerant_cities_gerant_id
      ON gerant_cities(gerant_id)
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_gerant_cities_city_id
      ON gerant_cities(city_id)
    `);
    console.log('✓ Indexes created');

    // 4. Check if Khalid Fathi exists and count segments
    const khalidResult = await client.query(`
      SELECT id FROM profiles WHERE username = 'khalid fathi'
    `);

    if (khalidResult.rows.length > 0) {
      const khalidId = khalidResult.rows[0].id;
      const segmentCount = await client.query(`
        SELECT COUNT(*) as count
        FROM gerant_segments
        WHERE gerant_id = $1
      `, [khalidId]);

      console.log(`\n✓ Khalid Fathi found (ID: ${khalidId})`);
      console.log(`  Assigned segments: ${segmentCount.rows[0].count}`);
    } else {
      console.log('\n⚠ Khalid Fathi user not found');
    }

    await client.query('COMMIT');

    console.log('\n✅ Migration completed successfully!');
    console.log('Tables gerant_segments and gerant_cities are now ready.');
    console.log('Assign segments/cities to gérants via the UI.');

    res.json({
      success: true,
      message: 'gerant_segments and gerant_cities tables created successfully'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
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
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('gerant_segments', 'gerant_cities')
    `);

    const tablesExist = result.rows.length === 2;

    res.json({
      status: {
        migrationNeeded: !tablesExist,
        applied: tablesExist
      },
      message: tablesExist
        ? 'gerant_segments and gerant_cities tables exist'
        : 'Tables missing - migration needed to fix "Error loading user scope"'
    });
  } catch (error) {
    res.status(500).json({
      status: { migrationNeeded: true, applied: false, error: error.message },
      message: `Error checking status: ${error.message}`
    });
  }
});

export default router;
