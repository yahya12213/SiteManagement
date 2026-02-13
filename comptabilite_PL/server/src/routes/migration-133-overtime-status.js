/**
 * Migration 133: Ajouter statut "overtime" pour les heures supplementaires
 * Permet d'afficher "Heures Sup" comme statut de pointage
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();
  try {
    console.log('🔄 Starting Migration 133 - Overtime Status...');
    await client.query('BEGIN');

    // 1. Supprimer l'ancienne contrainte
    await client.query(`
      ALTER TABLE hr_attendance_daily
      DROP CONSTRAINT IF EXISTS hr_attendance_daily_day_status_check
    `);
    console.log('✅ Ancienne contrainte supprimée');

    // 2. Ajouter la nouvelle contrainte avec 'overtime'
    await client.query(`
      ALTER TABLE hr_attendance_daily
      ADD CONSTRAINT hr_attendance_daily_day_status_check
      CHECK (day_status IN ('pending', 'present', 'absent', 'late', 'partial',
        'early_leave', 'holiday', 'leave', 'weekend', 'recovery_off',
        'recovery_day', 'mission', 'training', 'sick', 'overtime'))
    `);
    console.log('✅ Nouvelle contrainte avec "overtime" ajoutée');

    await client.query('COMMIT');
    console.log('✅ Migration 133 completed successfully!');

    res.json({
      success: true,
      message: 'Migration 133 - Statut "overtime" ajouté avec succès',
      details: {
        constraint_updated: 'hr_attendance_daily_day_status_check',
        new_status_added: 'overtime'
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 133 failed:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

router.get('/status', async (req, res) => {
  try {
    // Vérifier si la contrainte inclut 'overtime'
    const constraintCheck = await pool.query(`
      SELECT pg_get_constraintdef(c.oid) as constraint_def
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'hr_attendance_daily'
        AND c.conname = 'hr_attendance_daily_day_status_check'
    `);

    let applied = false;
    let constraintDef = null;

    if (constraintCheck.rows.length > 0) {
      constraintDef = constraintCheck.rows[0].constraint_def;
      applied = constraintDef.includes('overtime');
    }

    res.json({
      success: true,
      applied,
      needsRun: !applied,
      details: {
        constraint_exists: constraintCheck.rows.length > 0,
        includes_overtime: applied,
        current_constraint: constraintDef
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
