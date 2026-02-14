import express from 'express';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const router = express.Router();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Migration 130: Refonte complète du système de pointage
// - Crée hr_attendance_daily (nouvelle table unifiée)
// - Crée hr_attendance_audit (logs d'audit)
// - Migre les données depuis hr_attendance_records
// - Renomme hr_attendance_records en hr_attendance_records_legacy

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    console.log('=== Migration 130: Refonte Système de Pointage ===');
    console.log('Cette migration va:');
    console.log('  1. Créer la table hr_attendance_daily');
    console.log('  2. Créer la table hr_attendance_audit');
    console.log('  3. Migrer les données existantes');
    console.log('  4. Renommer hr_attendance_records en legacy');

    await client.query('BEGIN');

    // Read SQL file from server/migrations folder
    const migrationPath = path.join(__dirname, '../../migrations/130-attendance-refactor.sql');

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Executing migration SQL...');

    // Execute the migration SQL
    await client.query(migrationSQL);

    // Get stats
    const dailyCount = await client.query('SELECT COUNT(*) as count FROM hr_attendance_daily');
    const auditCount = await client.query('SELECT COUNT(*) as count FROM hr_attendance_audit');

    let legacyCount = { rows: [{ count: 0 }] };
    try {
      legacyCount = await client.query('SELECT COUNT(*) as count FROM hr_attendance_records_legacy');
    } catch (e) {
      // Table might not exist if already migrated
    }

    console.log('✓ Migration 130 completed successfully');
    console.log(`  - hr_attendance_daily: ${dailyCount.rows[0].count} records`);
    console.log(`  - hr_attendance_audit: ${auditCount.rows[0].count} records`);
    console.log(`  - hr_attendance_records_legacy: ${legacyCount.rows[0].count} records`);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 130 completed successfully - Système de pointage refactorisé',
      details: {
        tablesCreated: ['hr_attendance_daily', 'hr_attendance_audit'],
        tableRenamed: 'hr_attendance_records → hr_attendance_records_legacy',
        stats: {
          daily_records: parseInt(dailyCount.rows[0].count),
          audit_records: parseInt(auditCount.rows[0].count),
          legacy_records: parseInt(legacyCount.rows[0].count)
        }
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 130 Error:', error);

    res.status(500).json({
      success: false,
      error: error.message,
      details: 'Failed to execute migration 130',
      hint: 'Check if tables already exist or database connection is valid'
    });
  } finally {
    client.release();
    await pool.end();
  }
});

// Status check endpoint
router.get('/status', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Check if new tables exist
    const dailyTableResult = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'hr_attendance_daily'
      ) as exists
    `);

    const auditTableResult = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'hr_attendance_audit'
      ) as exists
    `);

    const legacyTableResult = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'hr_attendance_records_legacy'
      ) as exists
    `);

    const oldTableResult = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'hr_attendance_records'
      ) as exists
    `);

    const dailyExists = dailyTableResult.rows[0].exists;
    const auditExists = auditTableResult.rows[0].exists;
    const legacyExists = legacyTableResult.rows[0].exists;
    const oldExists = oldTableResult.rows[0].exists;

    // Get counts if tables exist
    let dailyCount = 0;
    let auditCount = 0;
    let legacyCount = 0;

    if (dailyExists) {
      const result = await pool.query('SELECT COUNT(*) as count FROM hr_attendance_daily');
      dailyCount = parseInt(result.rows[0].count);
    }

    if (auditExists) {
      const result = await pool.query('SELECT COUNT(*) as count FROM hr_attendance_audit');
      auditCount = parseInt(result.rows[0].count);
    }

    if (legacyExists) {
      const result = await pool.query('SELECT COUNT(*) as count FROM hr_attendance_records_legacy');
      legacyCount = parseInt(result.rows[0].count);
    }

    const migrationApplied = dailyExists && auditExists && !oldExists;
    const migrationPartial = dailyExists && oldExists;

    res.json({
      success: true,
      migrationApplied,
      migrationPartial,
      tables: {
        hr_attendance_daily: { exists: dailyExists, count: dailyCount },
        hr_attendance_audit: { exists: auditExists, count: auditCount },
        hr_attendance_records_legacy: { exists: legacyExists, count: legacyCount },
        hr_attendance_records: { exists: oldExists }
      },
      message: migrationApplied
        ? 'Migration 130 fully applied'
        : migrationPartial
          ? 'Migration 130 partially applied (old table still exists)'
          : 'Migration 130 not yet applied'
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

// Rollback endpoint (for emergencies - restores old table)
router.post('/rollback', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    console.log('=== Migration 130 ROLLBACK ===');

    await client.query('BEGIN');

    // Check if legacy table exists
    const legacyExists = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'hr_attendance_records_legacy'
      ) as exists
    `);

    if (!legacyExists.rows[0].exists) {
      throw new Error('hr_attendance_records_legacy does not exist - cannot rollback');
    }

    // Check if old table exists (if so, drop it first)
    const oldExists = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'hr_attendance_records'
      ) as exists
    `);

    if (oldExists.rows[0].exists) {
      console.log('Dropping existing hr_attendance_records...');
      await client.query('DROP TABLE hr_attendance_records CASCADE');
    }

    // Rename legacy back to original
    console.log('Renaming hr_attendance_records_legacy back to hr_attendance_records...');
    await client.query('ALTER TABLE hr_attendance_records_legacy RENAME TO hr_attendance_records');

    await client.query('COMMIT');

    console.log('✓ Rollback completed - hr_attendance_records restored');

    res.json({
      success: true,
      message: 'Migration 130 rolled back - hr_attendance_records restored',
      note: 'hr_attendance_daily and hr_attendance_audit tables are kept for reference'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Rollback Error:', error);

    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
    await pool.end();
  }
});

export default router;
