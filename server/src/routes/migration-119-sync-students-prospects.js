/**
 * Migration 119 - Synchroniser Étudiants avec Prospects
 *
 * Problème résolu:
 * - Les étudiants ont des téléphones en format national (0671014022)
 * - Les prospects ont des téléphones en format international (+212671014022)
 * - Le système ne faisait pas la correspondance
 *
 * Cette migration:
 * - Parcourt tous les étudiants avec téléphone
 * - Normalise le format (0 → +212 pour le Maroc)
 * - Met à jour le statut du prospect correspondant en 'inscrit'
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting Student-Prospect Sync Migration 119...');
    await client.query('BEGIN');

    // ============================================================
    // STEP 1: Compter les étudiants et prospects avant sync
    // ============================================================
    console.log('  📊 Counting students and prospects before sync...');

    const beforeStats = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM students WHERE phone IS NOT NULL) as students_with_phone,
        (SELECT COUNT(*) FROM prospects WHERE statut_contact = 'inscrit') as prospects_inscrit_before
    `);
    const { students_with_phone, prospects_inscrit_before } = beforeStats.rows[0];
    console.log(`  📊 Students with phone: ${students_with_phone}`);
    console.log(`  📊 Prospects 'inscrit' before: ${prospects_inscrit_before}`);

    // ============================================================
    // STEP 2: Mettre à jour les prospects correspondants
    // ============================================================
    console.log('  🔄 Syncing students with prospects...');

    // Requête qui gère plusieurs formats:
    // - Correspondance directe (numéro identique)
    // - Format marocain: 0xxx → +212xxx
    // - Format avec espaces ou tirets (déjà nettoyé normalement)
    const syncResult = await client.query(`
      UPDATE prospects p
      SET statut_contact = 'inscrit',
          updated_at = NOW()
      FROM students s
      WHERE (
        -- Correspondance directe
        p.phone_international = s.phone
        OR p.phone_international = s.whatsapp
        -- Format marocain: 0xxx → +212xxx (enlever le 0 et ajouter +212)
        OR (s.phone LIKE '0%' AND p.phone_international = '+212' || SUBSTRING(s.phone FROM 2))
        OR (s.whatsapp LIKE '0%' AND p.phone_international = '+212' || SUBSTRING(s.whatsapp FROM 2))
        -- Format sans le + initial
        OR (s.phone LIKE '212%' AND p.phone_international = '+' || s.phone)
        OR (s.whatsapp LIKE '212%' AND p.phone_international = '+' || s.whatsapp)
      )
      AND p.statut_contact != 'inscrit'
      AND (s.phone IS NOT NULL OR s.whatsapp IS NOT NULL)
      RETURNING p.id, p.nom, p.prenom, p.phone_international, s.phone as student_phone
    `);

    const syncedCount = syncResult.rows.length;
    console.log(`  ✅ Synced ${syncedCount} prospects to 'inscrit' status`);

    // Afficher les prospects synchronisés
    if (syncedCount > 0) {
      console.log('  📋 Synced prospects:');
      for (const row of syncResult.rows) {
        console.log(`     - ${row.nom} ${row.prenom} (${row.phone_international}) ← Student phone: ${row.student_phone}`);
      }
    }

    // ============================================================
    // STEP 3: Compter après sync
    // ============================================================
    const afterStats = await client.query(`
      SELECT COUNT(*) as prospects_inscrit_after
      FROM prospects
      WHERE statut_contact = 'inscrit'
    `);
    const { prospects_inscrit_after } = afterStats.rows[0];
    console.log(`  📊 Prospects 'inscrit' after: ${prospects_inscrit_after}`);
    console.log(`  📊 Increase: +${prospects_inscrit_after - prospects_inscrit_before}`);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 119: Sync students-prospects completed successfully',
      stats: {
        students_with_phone: parseInt(students_with_phone),
        prospects_inscrit_before: parseInt(prospects_inscrit_before),
        prospects_inscrit_after: parseInt(prospects_inscrit_after),
        synced_count: syncedCount,
        synced_prospects: syncResult.rows.map(r => ({
          prospect_id: r.id,
          name: `${r.nom} ${r.prenom}`,
          phone_international: r.phone_international,
          student_phone: r.student_phone
        }))
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 119 failed:', error);
    res.status(500).json({
      success: false,
      message: 'Migration 119 failed',
      error: error.message
    });
  } finally {
    client.release();
  }
});

export default router;
