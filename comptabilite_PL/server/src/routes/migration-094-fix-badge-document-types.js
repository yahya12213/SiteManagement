/**
 * Migration 094 - Fix existing formation_templates document_type based on template name
 *
 * Problem: Templates with "BADGE" in their name were associated to formations
 * with document_type='certificat' instead of 'badge'. This causes badge generation
 * to create certificates instead of badges.
 *
 * This migration scans all formation_templates and updates document_type based on
 * the template name pattern:
 * - "BADGE" -> badge
 * - "ATTESTATION" -> attestation
 * - "DIPLOME/DIPLÔME" -> diplome
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting Migration 094 - Fix badge document types...');
    await client.query('BEGIN');

    // Find all formation_templates with mismatched document_type
    const mismatchedResult = await client.query(`
      SELECT ft.id, ft.formation_id, ft.template_id, ft.document_type, ct.name as template_name
      FROM formation_templates ft
      JOIN certificate_templates ct ON ct.id = ft.template_id
      WHERE (
        (UPPER(ct.name) LIKE '%BADGE%' AND ft.document_type != 'badge')
        OR (UPPER(ct.name) LIKE '%ATTESTATION%' AND ft.document_type != 'attestation')
        OR ((UPPER(ct.name) LIKE '%DIPLOME%' OR UPPER(ct.name) LIKE '%DIPLÔME%') AND ft.document_type != 'diplome')
      )
    `);

    console.log(`  📋 Found ${mismatchedResult.rows.length} formation_templates with incorrect document_type`);

    let updatedCount = 0;
    const updates = [];

    for (const row of mismatchedResult.rows) {
      const templateNameUpper = row.template_name.toUpperCase();
      let newDocumentType;

      if (templateNameUpper.includes('BADGE')) {
        newDocumentType = 'badge';
      } else if (templateNameUpper.includes('ATTESTATION')) {
        newDocumentType = 'attestation';
      } else if (templateNameUpper.includes('DIPLOME') || templateNameUpper.includes('DIPLÔME')) {
        newDocumentType = 'diplome';
      }

      if (newDocumentType && newDocumentType !== row.document_type) {
        await client.query(
          `UPDATE formation_templates SET document_type = $1 WHERE id = $2`,
          [newDocumentType, row.id]
        );

        updates.push({
          template_name: row.template_name,
          old_type: row.document_type,
          new_type: newDocumentType
        });

        console.log(`  ✅ Updated "${row.template_name}": ${row.document_type} → ${newDocumentType}`);
        updatedCount++;
      }
    }

    await client.query('COMMIT');

    console.log('✅ Migration 094 completed!');
    console.log(`  - ${updatedCount} formation_templates updated`);

    res.json({
      success: true,
      message: 'Migration 094 completed: Fixed document types based on template names',
      details: {
        totalMismatched: mismatchedResult.rows.length,
        updated: updatedCount,
        updates
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 094 failed:', error.message);
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
    // Find all formation_templates with potentially mismatched document_type
    const mismatchedResult = await pool.query(`
      SELECT ft.id, ft.document_type, ct.name as template_name
      FROM formation_templates ft
      JOIN certificate_templates ct ON ct.id = ft.template_id
      WHERE (
        (UPPER(ct.name) LIKE '%BADGE%' AND ft.document_type != 'badge')
        OR (UPPER(ct.name) LIKE '%ATTESTATION%' AND ft.document_type != 'attestation')
        OR ((UPPER(ct.name) LIKE '%DIPLOME%' OR UPPER(ct.name) LIKE '%DIPLÔME%') AND ft.document_type != 'diplome')
      )
    `);

    const needsRun = mismatchedResult.rows.length > 0;

    res.json({
      success: true,
      applied: !needsRun,
      needsRun: needsRun,
      message: needsRun
        ? `${mismatchedResult.rows.length} formation_templates have incorrect document_type`
        : 'All document types are correctly set based on template names',
      details: {
        mismatched: mismatchedResult.rows.map(r => ({
          template_name: r.template_name,
          current_type: r.document_type
        }))
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
