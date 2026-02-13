/**
 * Migration 093 - Fix formation_templates document_type constraint to include 'badge'
 *
 * Problem: The CHECK constraint on formation_templates.document_type doesn't include 'badge'
 * as a valid type, while the certificates table does include it. This causes badge templates
 * to fail when being linked to formations.
 *
 * Old constraint: CHECK(document_type IN ('certificat', 'attestation', 'diplome', 'autre'))
 * New constraint: CHECK(document_type IN ('certificat', 'attestation', 'badge', 'diplome', 'autre'))
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting Migration 093 - Fix formation_templates badge constraint...');
    await client.query('BEGIN');

    // Step 1: Find and drop the existing CHECK constraint
    console.log('  Step 1: Finding existing CHECK constraint...');

    const constraintResult = await client.query(`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'formation_templates'::regclass
      AND contype = 'c'
      AND conname LIKE '%document_type%'
    `);

    let constraintDropped = false;
    if (constraintResult.rows.length > 0) {
      const constraintName = constraintResult.rows[0].conname;
      console.log(`    Found constraint: ${constraintName}`);
      await client.query(`ALTER TABLE formation_templates DROP CONSTRAINT ${constraintName}`);
      console.log(`    ✅ Dropped constraint: ${constraintName}`);
      constraintDropped = true;
    } else {
      // Try to find any unnamed CHECK constraint on the column
      console.log('    No named constraint found, checking for inline constraint...');

      // Get all CHECK constraints for the table
      const allConstraints = await client.query(`
        SELECT conname, pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = 'formation_templates'::regclass
        AND contype = 'c'
      `);

      for (const constraint of allConstraints.rows) {
        if (constraint.definition.includes('document_type')) {
          console.log(`    Found constraint: ${constraint.conname} - ${constraint.definition}`);
          await client.query(`ALTER TABLE formation_templates DROP CONSTRAINT ${constraint.conname}`);
          console.log(`    ✅ Dropped constraint: ${constraint.conname}`);
          constraintDropped = true;
          break;
        }
      }
    }

    if (!constraintDropped) {
      console.log('    ⚠️ No document_type CHECK constraint found to drop');
    }

    // Step 2: Add the new CHECK constraint with 'badge' included
    console.log('  Step 2: Adding new CHECK constraint with badge...');

    await client.query(`
      ALTER TABLE formation_templates
      ADD CONSTRAINT formation_templates_document_type_check
      CHECK (document_type IN ('certificat', 'attestation', 'badge', 'diplome', 'autre'))
    `);
    console.log('    ✅ New CHECK constraint added');

    // Step 3: Verify the constraint is in place
    console.log('  Step 3: Verifying constraint...');

    const verifyResult = await client.query(`
      SELECT pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'formation_templates'::regclass
      AND conname = 'formation_templates_document_type_check'
    `);

    if (verifyResult.rows.length > 0) {
      console.log(`    ✅ Constraint verified: ${verifyResult.rows[0].definition}`);
    }

    await client.query('COMMIT');

    console.log('✅ Migration 093 completed successfully!');

    res.json({
      success: true,
      message: 'Migration 093 completed: formation_templates now accepts badge document_type',
      details: {
        constraintDropped,
        newConstraint: 'formation_templates_document_type_check',
        allowedTypes: ['certificat', 'attestation', 'badge', 'diplome', 'autre']
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 093 failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Check current status
router.get('/status', async (req, res) => {
  try {
    // Check if the constraint exists and includes 'badge'
    const constraintResult = await pool.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition
      FROM pg_constraint
      WHERE conrelid = 'formation_templates'::regclass
      AND contype = 'c'
    `);

    let hasBadgeSupport = false;
    let constraintDefinition = null;

    for (const constraint of constraintResult.rows) {
      if (constraint.definition.includes('document_type')) {
        constraintDefinition = constraint.definition;
        hasBadgeSupport = constraint.definition.includes('badge');
        break;
      }
    }

    res.json({
      success: true,
      applied: hasBadgeSupport,
      needsRun: !hasBadgeSupport,
      message: hasBadgeSupport
        ? 'formation_templates already supports badge document_type'
        : 'formation_templates needs badge support - run migration',
      details: {
        constraintDefinition,
        hasBadgeSupport
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
