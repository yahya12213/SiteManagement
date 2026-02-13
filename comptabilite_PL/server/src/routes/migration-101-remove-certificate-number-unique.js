/**
 * Migration 101: Remove UNIQUE constraint on certificates.certificate_number
 *
 * This migration removes the UNIQUE constraint on certificate_number in the
 * certificates table because:
 * - The same certificate number should appear on ALL documents for a student/session
 * - Badge, attestation, diploma etc. all share the same certificate number
 * - The uniqueness is now enforced at session_etudiants level, not certificates level
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

export async function runMigration() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 101: Remove UNIQUE constraint on certificates.certificate_number ===\n');

    // Step 1: Find and drop the UNIQUE constraint on certificate_number
    console.log('Step 1: Finding UNIQUE constraints on certificate_number...');

    const constraintResult = await client.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'certificates'::regclass
      AND contype = 'u'
      AND (
        conname LIKE '%certificate_number%'
        OR conname = 'certificates_certificate_number_key'
      )
    `);

    let droppedConstraints = [];

    if (constraintResult.rows.length > 0) {
      for (const row of constraintResult.rows) {
        console.log(`Dropping constraint: ${row.conname}`);
        await client.query(`ALTER TABLE certificates DROP CONSTRAINT IF EXISTS "${row.conname}"`);
        droppedConstraints.push(row.conname);
      }
      console.log(`✓ Dropped ${droppedConstraints.length} constraint(s)\n`);
    } else {
      console.log('✓ No UNIQUE constraint found on certificate_number\n');
    }

    // Step 2: Also check for unique indexes
    console.log('Step 2: Finding unique indexes on certificate_number...');

    const indexResult = await client.query(`
      SELECT indexname
      FROM pg_indexes
      WHERE tablename = 'certificates'
      AND indexdef LIKE '%UNIQUE%'
      AND indexdef LIKE '%certificate_number%'
    `);

    let droppedIndexes = [];

    if (indexResult.rows.length > 0) {
      for (const row of indexResult.rows) {
        console.log(`Dropping index: ${row.indexname}`);
        await client.query(`DROP INDEX IF EXISTS "${row.indexname}"`);
        droppedIndexes.push(row.indexname);
      }
      console.log(`✓ Dropped ${droppedIndexes.length} index(es)\n`);
    } else {
      console.log('✓ No unique index found on certificate_number\n');
    }

    // Step 3: Create a non-unique index for performance (if not exists)
    console.log('Step 3: Creating non-unique index for performance...');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_certificates_cert_number
      ON certificates(certificate_number)
    `);
    console.log('✓ Non-unique index created\n');

    await client.query('COMMIT');

    console.log('=== Migration 101 completed successfully! ===');
    console.log(`   Constraints dropped: ${droppedConstraints.length}`);
    console.log(`   Indexes dropped: ${droppedIndexes.length}`);

    return {
      success: true,
      message: 'UNIQUE constraint removed from certificates.certificate_number',
      constraintsDropped: droppedConstraints,
      indexesDropped: droppedIndexes
    };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 101 failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// POST endpoint
router.post('/', async (req, res) => {
  try {
    const result = await runMigration();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// /run endpoint for MigrationPanel
router.post('/run', async (req, res) => {
  try {
    const result = await runMigration();
    res.json({ success: true, details: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET endpoint - preview
router.get('/', async (req, res) => {
  try {
    // Check if constraint exists
    const constraintResult = await pool.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'certificates'::regclass
      AND contype = 'u'
      AND (
        conname LIKE '%certificate_number%'
        OR conname = 'certificates_certificate_number_key'
      )
    `);

    res.json({
      success: true,
      preview: true,
      constraintsFound: constraintResult.rows.map(r => r.conname),
      message: constraintResult.rows.length > 0
        ? `Found ${constraintResult.rows.length} UNIQUE constraint(s) to remove`
        : 'No UNIQUE constraint found on certificate_number'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// /status endpoint
router.get('/status', async (req, res) => {
  try {
    // Check if UNIQUE constraint exists
    const constraintResult = await pool.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'certificates'::regclass
      AND contype = 'u'
      AND (
        conname LIKE '%certificate_number%'
        OR conname = 'certificates_certificate_number_key'
      )
    `);

    const hasConstraint = constraintResult.rows.length > 0;

    res.json({
      applied: !hasConstraint,
      status: { migrationNeeded: hasConstraint },
      message: hasConstraint
        ? `Migration 101 nécessaire - contrainte UNIQUE à supprimer (${constraintResult.rows.map(r => r.conname).join(', ')})`
        : 'Migration 101 appliquée - pas de contrainte UNIQUE sur certificate_number'
    });
  } catch (error) {
    res.status(500).json({
      applied: false,
      status: { migrationNeeded: true },
      message: error.message
    });
  }
});

export default router;
