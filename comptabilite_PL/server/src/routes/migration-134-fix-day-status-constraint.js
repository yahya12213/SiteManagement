/**
 * Migration 134: Supprimer contrainte valid_day_status obsolète
 * Cette contrainte bloquait la mise à jour vers 'overtime'
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('🔄 Starting Migration 134 - Fix day_status constraint...');
    await client.query('BEGIN');

    // Supprimer la contrainte obsolète valid_day_status (sans 'overtime')
    await client.query(`
      ALTER TABLE hr_attendance_daily
      DROP CONSTRAINT IF EXISTS valid_day_status
    `);
    console.log('✅ Contrainte valid_day_status supprimée');

    // Vérifier que hr_attendance_daily_day_status_check inclut 'overtime'
    const constraintCheck = await client.query(`
      SELECT pg_get_constraintdef(c.oid) as constraint_def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'hr_attendance_daily'
        AND c.conname = 'hr_attendance_daily_day_status_check'
    `);

    let hasOvertime = false;
    if (constraintCheck.rows.length > 0) {
      hasOvertime = constraintCheck.rows[0].constraint_def.includes('overtime');
    }

    if (!hasOvertime) {
      // Recréer la contrainte avec 'overtime'
      await client.query(`
        ALTER TABLE hr_attendance_daily
        DROP CONSTRAINT IF EXISTS hr_attendance_daily_day_status_check
      `);
      await client.query(`
        ALTER TABLE hr_attendance_daily
        ADD CONSTRAINT hr_attendance_daily_day_status_check
        CHECK (day_status IN ('pending', 'present', 'absent', 'late', 'partial',
          'early_leave', 'holiday', 'leave', 'weekend', 'recovery_off',
          'recovery_day', 'mission', 'training', 'sick', 'overtime'))
      `);
      console.log('✅ Contrainte hr_attendance_daily_day_status_check recréée avec overtime');
    }

    await client.query('COMMIT');
    console.log('✅ Migration 134 completed successfully!');

    res.json({
      success: true,
      message: 'Migration 134 - Contrainte day_status corrigée',
      details: {
        removed_constraint: 'valid_day_status',
        verified_constraint: 'hr_attendance_daily_day_status_check',
        overtime_included: true
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 134 failed:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

router.get('/status', async (req, res) => {
  try {
    // Vérifier si la contrainte obsolète existe encore
    const obsoleteCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'hr_attendance_daily'
          AND c.conname = 'valid_day_status'
      )
    `);

    const hasObsolete = obsoleteCheck.rows[0].exists;

    // Vérifier si la contrainte correcte inclut 'overtime'
    const correctCheck = await pool.query(`
      SELECT pg_get_constraintdef(c.oid) as constraint_def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'hr_attendance_daily'
        AND c.conname = 'hr_attendance_daily_day_status_check'
    `);

    let hasOvertime = false;
    if (correctCheck.rows.length > 0) {
      hasOvertime = correctCheck.rows[0].constraint_def.includes('overtime');
    }

    const applied = !hasObsolete && hasOvertime;

    res.json({
      success: true,
      applied,
      needsRun: !applied,
      details: {
        has_obsolete_constraint: hasObsolete,
        has_overtime_in_check: hasOvertime
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
