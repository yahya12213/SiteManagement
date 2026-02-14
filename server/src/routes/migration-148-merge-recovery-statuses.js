/**
 * Migration 148: Fusionner les statuts de récupération
 *
 * Convertit recovery_paid et recovery_unpaid en un seul statut: recovery
 *
 * Règle métier:
 * - recovery_off = jour où le salarié ne travaille pas mais est payé (crédit)
 * - recovery = jour où le salarié travaille pour "rembourser" (pas de paie, même si férié)
 *
 * Les anciens statuts recovery_paid/recovery_unpaid avaient une distinction
 * qui créait de la confusion. Maintenant: un seul statut "recovery" sans paie.
 */

import express from 'express';
import pg from 'pg';

const { Pool } = pg;
const router = express.Router();

const getPool = () => new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Run migration
router.post('/run', async (req, res) => {
  const pool = getPool();

  try {
    console.log('Migration 148: Fusionner recovery_paid/recovery_unpaid → recovery...');

    // 1. Vérifier combien de records à convertir
    const countResult = await pool.query(`
      SELECT
        day_status,
        COUNT(*) as count
      FROM hr_attendance_daily
      WHERE day_status IN ('recovery_paid', 'recovery_unpaid')
      GROUP BY day_status
    `);

    console.log('  - Statuts à convertir:', countResult.rows);

    const totalToConvert = countResult.rows.reduce((sum, row) => sum + parseInt(row.count), 0);

    if (totalToConvert === 0) {
      return res.json({
        success: true,
        message: 'Aucun enregistrement à convertir',
        stats: { converted: 0 }
      });
    }

    // 2. Convertir les statuts
    const updateResult = await pool.query(`
      UPDATE hr_attendance_daily
      SET
        day_status = 'recovery',
        notes = COALESCE(notes || ' | ', '') || 'Migré depuis ' || day_status || ' (Migration 148)',
        updated_at = NOW()
      WHERE day_status IN ('recovery_paid', 'recovery_unpaid')
      RETURNING id, work_date, day_status
    `);

    console.log(`  - ${updateResult.rowCount} enregistrements convertis`);

    // 3. Vérifier le résultat
    const verifyResult = await pool.query(`
      SELECT
        day_status,
        COUNT(*) as count
      FROM hr_attendance_daily
      WHERE day_status IN ('recovery', 'recovery_off', 'recovery_paid', 'recovery_unpaid')
      GROUP BY day_status
      ORDER BY day_status
    `);

    console.log('Migration 148 terminée avec succès');
    console.log('  - Nouveaux totaux:', verifyResult.rows);

    res.json({
      success: true,
      message: `Migration 148: ${updateResult.rowCount} statuts convertis (recovery_paid/recovery_unpaid → recovery)`,
      stats: {
        converted: updateResult.rowCount,
        before: countResult.rows,
        after: verifyResult.rows
      }
    });

  } catch (error) {
    console.error('Migration 148 échouée:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

// Status endpoint
router.get('/status', async (req, res) => {
  const pool = getPool();

  try {
    // Compter les statuts de récupération
    const result = await pool.query(`
      SELECT
        day_status,
        COUNT(*) as count
      FROM hr_attendance_daily
      WHERE day_status IN ('recovery', 'recovery_off', 'recovery_paid', 'recovery_unpaid')
      GROUP BY day_status
      ORDER BY day_status
    `);

    const hasOldStatuses = result.rows.some(
      r => r.day_status === 'recovery_paid' || r.day_status === 'recovery_unpaid'
    );

    res.json({
      success: true,
      applied: !hasOldStatuses,
      message: hasOldStatuses
        ? 'Anciens statuts recovery_paid/recovery_unpaid trouvés - migration nécessaire'
        : 'Tous les statuts sont déjà migrés vers recovery',
      stats: result.rows
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

export default router;
