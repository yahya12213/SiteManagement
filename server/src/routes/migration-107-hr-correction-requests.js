/**
 * Migration 107: Table des demandes de correction de pointage
 *
 * Permet aux employés de soumettre des demandes de correction pour les pointages incomplets
 * - Approbation séquentielle: N → N+1 → N+2...
 * - À l'approbation finale, les enregistrements de pointage sont créés/modifiés
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

export async function runMigration107() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🔄 Migration 107: Creating hr_attendance_correction_requests table...');

    // Créer la table hr_attendance_correction_requests
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_attendance_correction_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        request_date DATE NOT NULL,
        requested_check_in TIME,
        requested_check_out TIME,
        reason TEXT NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',

        -- Approbation N (manager direct)
        n1_approver_id UUID REFERENCES hr_employees(id),
        n1_approved_at TIMESTAMP,
        n1_comment TEXT,

        -- Approbation N+1
        n2_approver_id UUID REFERENCES hr_employees(id),
        n2_approved_at TIMESTAMP,
        n2_comment TEXT,

        -- Approbation N+2
        n3_approver_id UUID REFERENCES hr_employees(id),
        n3_approved_at TIMESTAMP,
        n3_comment TEXT,

        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log('✅ Table hr_attendance_correction_requests created');

    // Créer les index pour optimiser les requêtes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hr_correction_requests_employee
      ON hr_attendance_correction_requests(employee_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hr_correction_requests_status
      ON hr_attendance_correction_requests(status)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hr_correction_requests_date
      ON hr_attendance_correction_requests(request_date)
    `);

    console.log('✅ Indexes created');

    await client.query('COMMIT');
    console.log('✅ Migration 107 completed successfully');

    return { success: true, message: 'Migration 107 completed' };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 107 failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Route pour exécuter la migration
router.post('/run', async (req, res) => {
  try {
    const result = await runMigration107();
    res.json(result);
  } catch (error) {
    console.error('Migration 107 error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
