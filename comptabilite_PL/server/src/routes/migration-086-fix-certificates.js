/**
 * Migration 086: Fix Critical Certificate Issues
 *
 * Problèmes corrigés:
 * 1. Contrainte UNIQUE incorrecte (student_id, formation_id) → empêche plusieurs types de documents
 * 2. Index manquants pour performance des queries
 * 3. Ajout CHECK constraint pour document_type
 *
 * Cette migration est CRITIQUE et doit être exécutée AVANT toute modification UI
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 086: Fix Certificate Constraints ===\n');

    // 1. Vérifier et supprimer l'ancienne contrainte UNIQUE si elle existe
    console.log('Step 1: Checking for old UNIQUE constraint...');

    const constraintCheck = await client.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'certificates'::regclass
      AND conname = 'certificates_student_id_formation_id_key'
    `);

    if (constraintCheck.rows.length > 0) {
      console.log('Found old constraint, dropping...');
      await client.query(`
        ALTER TABLE certificates
        DROP CONSTRAINT certificates_student_id_formation_id_key
      `);
      console.log('✓ Old UNIQUE constraint dropped');
    } else {
      console.log('⚠ Old constraint not found, skipping drop');
    }

    // 2. Ajouter la nouvelle contrainte UNIQUE correcte
    console.log('\nStep 2: Adding new UNIQUE constraint...');

    const newConstraintCheck = await client.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'certificates'::regclass
      AND conname = 'certificates_unique_document'
    `);

    if (newConstraintCheck.rows.length === 0) {
      await client.query(`
        ALTER TABLE certificates
        ADD CONSTRAINT certificates_unique_document
        UNIQUE NULLS NOT DISTINCT (student_id, formation_id, session_id, document_type)
      `);
      console.log('✓ New UNIQUE constraint added (student_id, formation_id, session_id, document_type)');
    } else {
      console.log('⚠ New UNIQUE constraint already exists, skipping');
    }

    // 3. Ajouter CHECK constraint pour document_type (si pas déjà présent)
    console.log('\nStep 3: Adding CHECK constraint for document_type...');

    const checkConstraintExists = await client.query(`
      SELECT conname FROM pg_constraint
      WHERE conrelid = 'certificates'::regclass
      AND conname = 'check_document_type'
    `);

    if (checkConstraintExists.rows.length === 0) {
      await client.query(`
        ALTER TABLE certificates
        ADD CONSTRAINT check_document_type
        CHECK (document_type IN ('certificat', 'attestation', 'badge'))
      `);
      console.log('✓ CHECK constraint added for document_type');
    } else {
      console.log('⚠ CHECK constraint already exists, skipping');
    }

    // 4. Créer index sur session_id (si pas déjà présent)
    console.log('\nStep 4: Creating index on session_id...');

    const sessionIdIndexExists = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'certificates'
      AND indexname = 'idx_certificates_session_id'
    `);

    if (sessionIdIndexExists.rows.length === 0) {
      await client.query(`
        CREATE INDEX idx_certificates_session_id
        ON certificates(session_id)
        WHERE session_id IS NOT NULL
      `);
      console.log('✓ Index idx_certificates_session_id created');
    } else {
      console.log('⚠ Index idx_certificates_session_id already exists, skipping');
    }

    // 5. Créer index composite pour (session_id, document_type)
    console.log('\nStep 5: Creating composite index on (session_id, document_type)...');

    const compositeIndexExists = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'certificates'
      AND indexname = 'idx_certificates_session_document'
    `);

    if (compositeIndexExists.rows.length === 0) {
      await client.query(`
        CREATE INDEX idx_certificates_session_document
        ON certificates(session_id, document_type)
        WHERE session_id IS NOT NULL
      `);
      console.log('✓ Index idx_certificates_session_document created');
    } else {
      console.log('⚠ Index idx_certificates_session_document already exists, skipping');
    }

    // 6. Analyser la table pour mettre à jour les statistiques
    console.log('\nStep 6: Analyzing table for updated statistics...');
    await client.query('ANALYZE certificates');
    console.log('✓ Table analyzed');

    await client.query('COMMIT');

    console.log('\n=== Migration 086 Completed Successfully ===');

    res.json({
      success: true,
      message: 'Migration 086 completed: Fixed UNIQUE constraint and added indexes',
      details: {
        constraint_dropped: constraintCheck.rows.length > 0,
        new_constraint_added: newConstraintCheck.rows.length === 0,
        check_constraint_added: checkConstraintExists.rows.length === 0,
        session_index_created: sessionIdIndexExists.rows.length === 0,
        composite_index_created: compositeIndexExists.rows.length === 0
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 086 Failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.detail || 'Check server logs for more information'
    });
  } finally {
    client.release();
  }
});

// Route pour vérifier le statut
router.get('/status', async (req, res) => {
  try {
    // Vérifier si les contraintes et index existent
    const [newConstraint, checkConstraint, sessionIndex, compositeIndex] = await Promise.all([
      pool.query(`
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'certificates'::regclass
        AND conname = 'certificates_unique_document'
      `),
      pool.query(`
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'certificates'::regclass
        AND conname = 'check_document_type'
      `),
      pool.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'certificates'
        AND indexname = 'idx_certificates_session_id'
      `),
      pool.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'certificates'
        AND indexname = 'idx_certificates_session_document'
      `)
    ]);

    const allApplied =
      newConstraint.rows.length > 0 &&
      checkConstraint.rows.length > 0 &&
      sessionIndex.rows.length > 0 &&
      compositeIndex.rows.length > 0;

    res.json({
      success: true,
      applied: allApplied,
      details: {
        unique_constraint: newConstraint.rows.length > 0,
        check_constraint: checkConstraint.rows.length > 0,
        session_index: sessionIndex.rows.length > 0,
        composite_index: compositeIndex.rows.length > 0
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
