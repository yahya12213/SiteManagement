/**
 * Migration 106: Table multi-managers pour les employés HR
 *
 * Permet de configurer plusieurs managers par employé avec des rangs (N, N+1, N+2...)
 * - Rang 0 (N) = manager direct (obligatoire)
 * - Rang 1 (N+1) = manager supérieur
 * - Rang 2+ = niveaux supérieurs illimités
 *
 * Les demandes (congés, corrections, etc.) suivent la chaîne séquentielle
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

export async function runMigration106() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🔄 Migration 106: Creating hr_employee_managers table...');

    // Créer la table hr_employee_managers
    await client.query(`
      CREATE TABLE IF NOT EXISTS hr_employee_managers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        manager_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
        rank INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),

        -- Un employé ne peut pas avoir le même manager deux fois
        CONSTRAINT unique_employee_manager UNIQUE(employee_id, manager_id),
        -- Un employé ne peut avoir qu'un seul manager par rang
        CONSTRAINT unique_employee_rank UNIQUE(employee_id, rank),
        -- Un employé ne peut pas être son propre manager
        CONSTRAINT no_self_manager CHECK(employee_id != manager_id)
      )
    `);

    console.log('✅ Table hr_employee_managers created');

    // Créer les index pour optimiser les requêtes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hr_employee_managers_employee
      ON hr_employee_managers(employee_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hr_employee_managers_manager
      ON hr_employee_managers(manager_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hr_employee_managers_rank
      ON hr_employee_managers(employee_id, rank)
    `);

    console.log('✅ Indexes created');

    // Migrer les données existantes de manager_id vers la nouvelle table
    const existingManagers = await client.query(`
      SELECT id, manager_id
      FROM hr_employees
      WHERE manager_id IS NOT NULL
    `);

    if (existingManagers.rows.length > 0) {
      console.log(`🔄 Migrating ${existingManagers.rows.length} existing manager relationships...`);

      for (const row of existingManagers.rows) {
        await client.query(`
          INSERT INTO hr_employee_managers (employee_id, manager_id, rank, is_active)
          VALUES ($1, $2, 0, true)
          ON CONFLICT (employee_id, manager_id) DO NOTHING
        `, [row.id, row.manager_id]);
      }

      console.log('✅ Existing manager relationships migrated to rank 0 (N)');
    }

    // Ajouter une colonne pour tracker le nombre de niveaux d'approbation requis
    // Cette colonne sera utilisée pour déterminer combien de managers doivent approuver
    await client.query(`
      ALTER TABLE hr_employees
      ADD COLUMN IF NOT EXISTS approval_levels INTEGER DEFAULT 1
    `);

    console.log('✅ Added approval_levels column to hr_employees');

    await client.query('COMMIT');
    console.log('✅ Migration 106 completed successfully');

    return { success: true, message: 'Migration 106 completed' };

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 106 failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Route pour exécuter la migration
router.post('/run', async (req, res) => {
  try {
    const result = await runMigration106();
    res.json(result);
  } catch (error) {
    console.error('Migration 106 error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
