/**
 * Migration 137: Ajouter les statuts recovery_paid et recovery_unpaid
 *
 * Permet de distinguer:
 * - recovery_paid: Récupération sur un jour férié (payé)
 * - recovery_unpaid: Récupération sur un jour normal (non payé)
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Migration 137: Ajout des statuts recovery_paid et recovery_unpaid...');

    // Supprimer TOUTES les contraintes CHECK sur day_status (il peut y en avoir plusieurs)
    await client.query(`
      ALTER TABLE hr_attendance_daily
      DROP CONSTRAINT IF EXISTS valid_day_status
    `);
    await client.query(`
      ALTER TABLE hr_attendance_daily
      DROP CONSTRAINT IF EXISTS hr_attendance_daily_day_status_check
    `);

    console.log('  - Anciennes contraintes supprimées (valid_day_status et hr_attendance_daily_day_status_check)');

    // Ajouter la nouvelle contrainte avec les nouveaux statuts
    await client.query(`
      ALTER TABLE hr_attendance_daily
      ADD CONSTRAINT valid_day_status CHECK (
        day_status IN (
          'pending', 'present', 'absent', 'late', 'partial', 'early_leave',
          'holiday', 'leave', 'weekend',
          'recovery_off', 'recovery_day', 'recovery_paid', 'recovery_unpaid',
          'mission', 'training', 'sick', 'overtime', 'holiday_overtime'
        )
      )
    `);

    console.log('  - Nouvelle contrainte ajoutée avec recovery_paid et recovery_unpaid');

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 137 completed: Statuts recovery_paid et recovery_unpaid ajoutés',
      changes: [
        "Ajout du statut 'recovery_paid' - Récupération sur jour férié",
        "Ajout du statut 'recovery_unpaid' - Récupération sur jour normal"
      ]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 137 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      hint: 'Vérifiez que la table hr_attendance_daily existe'
    });
  } finally {
    client.release();
  }
});

// Status endpoint
router.get('/status', async (req, res) => {
  try {
    const constraintCheck = await pool.query(`
      SELECT pg_get_constraintdef(oid) as constraint_def
      FROM pg_constraint
      WHERE conrelid = 'hr_attendance_daily'::regclass
        AND contype = 'c'
        AND conname = 'valid_day_status'
    `);

    const hasRecoveryPaid = constraintCheck.rows[0]?.constraint_def?.includes('recovery_paid');

    res.json({
      success: true,
      applied: hasRecoveryPaid,
      message: hasRecoveryPaid
        ? 'Migration déjà appliquée - recovery_paid et recovery_unpaid disponibles'
        : 'Migration non appliquée - recovery_paid et recovery_unpaid manquants'
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
