/**
 * Migration 089: Google Contacts Integration
 *
 * Ajoute les colonnes nécessaires pour l'intégration Google Contacts :
 * - cities: google_token, google_sync_enabled
 * - prospects: google_contact_id, google_sync_status, google_last_sync
 */

import { Router } from 'express';
import pool from '../config/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Check migration status
router.get('/migration-089/status', authenticateToken, async (req, res) => {
  try {
    // Check if columns exist
    const checkCities = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'cities' AND column_name IN ('google_token', 'google_sync_enabled')
    `);

    const checkProspects = await pool.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'prospects' AND column_name IN ('google_contact_id', 'google_sync_status', 'google_last_sync', 'google_sync_error')
    `);

    const citiesColumnsCount = checkCities.rows.length;
    const prospectsColumnsCount = checkProspects.rows.length;

    const isApplied = citiesColumnsCount >= 2 && prospectsColumnsCount >= 4;

    res.json({
      applied: isApplied,
      message: isApplied
        ? 'Migration déjà appliquée'
        : `Migration nécessaire (cities: ${citiesColumnsCount}/2, prospects: ${prospectsColumnsCount}/4)`,
      details: {
        citiesColumns: checkCities.rows.map(r => r.column_name),
        prospectsColumns: checkProspects.rows.map(r => r.column_name)
      }
    });
  } catch (error) {
    console.error('Migration 089 status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Run migration
router.post('/migration-089/run', authenticateToken, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const results = [];

    // ========================================
    // 1. Ajouter colonnes à cities
    // ========================================

    // google_token - Stocke le token JSON complet
    const checkGoogleToken = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'cities' AND column_name = 'google_token'
    `);

    if (checkGoogleToken.rows.length === 0) {
      await client.query(`
        ALTER TABLE cities ADD COLUMN google_token TEXT
      `);
      results.push('✅ Colonne cities.google_token ajoutée');
    } else {
      results.push('⏭️ Colonne cities.google_token existe déjà');
    }

    // google_sync_enabled - Active/désactive la sync pour cette ville
    const checkGoogleEnabled = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'cities' AND column_name = 'google_sync_enabled'
    `);

    if (checkGoogleEnabled.rows.length === 0) {
      await client.query(`
        ALTER TABLE cities ADD COLUMN google_sync_enabled BOOLEAN DEFAULT false
      `);
      results.push('✅ Colonne cities.google_sync_enabled ajoutée');
    } else {
      results.push('⏭️ Colonne cities.google_sync_enabled existe déjà');
    }

    // ========================================
    // 2. Ajouter colonnes à prospects
    // ========================================

    // google_contact_id - Resource name du contact Google (people/c123456789)
    const checkContactId = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'prospects' AND column_name = 'google_contact_id'
    `);

    if (checkContactId.rows.length === 0) {
      await client.query(`
        ALTER TABLE prospects ADD COLUMN google_contact_id TEXT
      `);
      results.push('✅ Colonne prospects.google_contact_id ajoutée');
    } else {
      results.push('⏭️ Colonne prospects.google_contact_id existe déjà');
    }

    // google_sync_status - Statut de synchronisation (pending, synced, failed, skipped)
    const checkSyncStatus = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'prospects' AND column_name = 'google_sync_status'
    `);

    if (checkSyncStatus.rows.length === 0) {
      await client.query(`
        ALTER TABLE prospects ADD COLUMN google_sync_status TEXT DEFAULT 'pending'
      `);
      results.push('✅ Colonne prospects.google_sync_status ajoutée');
    } else {
      results.push('⏭️ Colonne prospects.google_sync_status existe déjà');
    }

    // google_last_sync - Date de dernière synchronisation
    const checkLastSync = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'prospects' AND column_name = 'google_last_sync'
    `);

    if (checkLastSync.rows.length === 0) {
      await client.query(`
        ALTER TABLE prospects ADD COLUMN google_last_sync TIMESTAMP
      `);
      results.push('✅ Colonne prospects.google_last_sync ajoutée');
    } else {
      results.push('⏭️ Colonne prospects.google_last_sync existe déjà');
    }

    // google_sync_error - Message d'erreur en cas d'échec
    const checkSyncError = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'prospects' AND column_name = 'google_sync_error'
    `);

    if (checkSyncError.rows.length === 0) {
      await client.query(`
        ALTER TABLE prospects ADD COLUMN google_sync_error TEXT
      `);
      results.push('✅ Colonne prospects.google_sync_error ajoutée');
    } else {
      results.push('⏭️ Colonne prospects.google_sync_error existe déjà');
    }

    // ========================================
    // 3. Créer index pour les recherches
    // ========================================

    // Index sur google_contact_id
    const checkIdx1 = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'prospects' AND indexname = 'idx_prospects_google_contact_id'
    `);

    if (checkIdx1.rows.length === 0) {
      await client.query(`
        CREATE INDEX idx_prospects_google_contact_id ON prospects(google_contact_id)
        WHERE google_contact_id IS NOT NULL
      `);
      results.push('✅ Index idx_prospects_google_contact_id créé');
    } else {
      results.push('⏭️ Index idx_prospects_google_contact_id existe déjà');
    }

    // Index sur google_sync_status pour trouver les pending/failed
    const checkIdx2 = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'prospects' AND indexname = 'idx_prospects_google_sync_status'
    `);

    if (checkIdx2.rows.length === 0) {
      await client.query(`
        CREATE INDEX idx_prospects_google_sync_status ON prospects(google_sync_status)
        WHERE google_sync_status IN ('pending', 'failed')
      `);
      results.push('✅ Index idx_prospects_google_sync_status créé');
    } else {
      results.push('⏭️ Index idx_prospects_google_sync_status existe déjà');
    }

    // Index sur cities.google_sync_enabled
    const checkIdx3 = await client.query(`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'cities' AND indexname = 'idx_cities_google_sync_enabled'
    `);

    if (checkIdx3.rows.length === 0) {
      await client.query(`
        CREATE INDEX idx_cities_google_sync_enabled ON cities(google_sync_enabled)
        WHERE google_sync_enabled = true
      `);
      results.push('✅ Index idx_cities_google_sync_enabled créé');
    } else {
      results.push('⏭️ Index idx_cities_google_sync_enabled existe déjà');
    }

    // ========================================
    // 4. Stats finales
    // ========================================

    const citiesCount = await client.query(`SELECT COUNT(*) FROM cities`);
    const prospectsCount = await client.query(`SELECT COUNT(*) FROM prospects`);

    results.push('');
    results.push('📊 Statistiques:');
    results.push(`   - ${citiesCount.rows[0].count} villes (prêtes pour config Google)`);
    results.push(`   - ${prospectsCount.rows[0].count} prospects (prêts pour sync)`);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Migration 089 Google Contacts exécutée avec succès',
      details: results
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 089 error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

export default router;
