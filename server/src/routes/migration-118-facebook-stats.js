/**
 * Migration 118 - Systeme d'Analyse Publicite Facebook
 *
 * Fonctionnalites :
 * - Enregistrement des declarations Facebook par jour/ville
 * - Comparaison avec les prospects ajoutes en base de donnees
 * - Analytics et taux de conversion
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting Facebook Stats Migration 118...');
    await client.query('BEGIN');

    // ============================================================
    // STEP 1: Table facebook_stats
    // ============================================================
    console.log('  📦 Creating facebook_stats table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS facebook_stats (
        id SERIAL PRIMARY KEY,

        -- Date des statistiques
        date DATE NOT NULL,

        -- Localisation
        city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
        segment_id TEXT NOT NULL REFERENCES segments(id) ON DELETE CASCADE,

        -- Donnees
        declared_count INTEGER NOT NULL DEFAULT 0 CHECK (declared_count >= 0),

        -- Notes optionnelles (campagne, remarques)
        notes TEXT,

        -- Metadonnees
        created_by TEXT REFERENCES profiles(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),

        -- Contrainte unique: une seule entree par date/ville
        CONSTRAINT unique_facebook_stat_per_day_city UNIQUE (date, city_id)
      )
    `);

    // Creer les index
    console.log('  📦 Creating indexes on facebook_stats table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_facebook_stats_date ON facebook_stats(date DESC);
      CREATE INDEX IF NOT EXISTS idx_facebook_stats_city ON facebook_stats(city_id);
      CREATE INDEX IF NOT EXISTS idx_facebook_stats_segment ON facebook_stats(segment_id);
      CREATE INDEX IF NOT EXISTS idx_facebook_stats_date_segment ON facebook_stats(date, segment_id);
      CREATE INDEX IF NOT EXISTS idx_facebook_stats_created_by ON facebook_stats(created_by);
    `);

    console.log('  ✅ Table facebook_stats created with indexes');

    // ============================================================
    // STEP 2: Permissions RBAC pour Analyse Publicite
    // ============================================================
    console.log('  📦 Creating analyse_publicite permissions...');

    const permissions = [
      {
        module: 'commercialisation',
        menu: 'analyse_publicite',
        action: 'voir',
        code: 'commercialisation.analyse_publicite.voir',
        label: 'Voir l\'analyse publicite',
        description: 'Acces a la page d\'analyse des publicites Facebook'
      },
      {
        module: 'commercialisation',
        menu: 'analyse_publicite',
        action: 'creer',
        code: 'commercialisation.analyse_publicite.creer',
        label: 'Saisir les stats Facebook',
        description: 'Saisir les declarations de prospects Facebook'
      },
      {
        module: 'commercialisation',
        menu: 'analyse_publicite',
        action: 'modifier',
        code: 'commercialisation.analyse_publicite.modifier',
        label: 'Modifier les stats Facebook',
        description: 'Modifier les declarations existantes'
      },
      {
        module: 'commercialisation',
        menu: 'analyse_publicite',
        action: 'supprimer',
        code: 'commercialisation.analyse_publicite.supprimer',
        label: 'Supprimer les stats Facebook',
        description: 'Supprimer des declarations'
      },
      {
        module: 'commercialisation',
        menu: 'analyse_publicite',
        action: 'exporter',
        code: 'commercialisation.analyse_publicite.exporter',
        label: 'Exporter les analyses',
        description: 'Exporter les donnees d\'analyse en CSV'
      }
    ];

    for (const perm of permissions) {
      const existing = await client.query(
        'SELECT id FROM permissions WHERE code = $1',
        [perm.code]
      );

      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO permissions (module, menu, action, code, label, description, sort_order, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, 0, NOW())`,
          [perm.module, perm.menu, perm.action, perm.code, perm.label, perm.description]
        );
        console.log(`    ✅ Created permission: ${perm.code}`);
      } else {
        console.log(`    ⏭️ Permission exists: ${perm.code}`);
      }
    }

    console.log(`  ✅ Created ${permissions.length} analyse_publicite permissions`);

    // ============================================================
    // STEP 3: Assigner les permissions a l'admin et au gerant
    // ============================================================
    console.log('  📦 Assigning permissions to admin and gerant roles...');

    const roles = await client.query(
      "SELECT id, name FROM roles WHERE name IN ('admin', 'gerant')"
    );

    for (const role of roles.rows) {
      for (const perm of permissions) {
        const permResult = await client.query(
          'SELECT id FROM permissions WHERE code = $1',
          [perm.code]
        );

        if (permResult.rows.length > 0) {
          const permId = permResult.rows[0].id;

          await client.query(`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT (role_id, permission_id) DO NOTHING
          `, [role.id, permId]);
        }
      }
      console.log(`  ✅ Assigned all permissions to ${role.name}`);
    }

    // Assigner les permissions de base a l'assistante (voir + creer)
    const assistanteRole = await client.query(
      "SELECT id FROM roles WHERE name = 'assistante'"
    );

    if (assistanteRole.rows.length > 0) {
      const assistantePermissions = [
        'commercialisation.analyse_publicite.voir',
        'commercialisation.analyse_publicite.creer'
      ];

      for (const permCode of assistantePermissions) {
        const permResult = await client.query(
          'SELECT id FROM permissions WHERE code = $1',
          [permCode]
        );

        if (permResult.rows.length > 0) {
          await client.query(`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT (role_id, permission_id) DO NOTHING
          `, [assistanteRole.rows[0].id, permResult.rows[0].id]);
        }
      }
      console.log('  ✅ Assigned basic permissions to assistante (voir, creer)');
    }

    await client.query('COMMIT');
    console.log('✅ Migration 118 completed successfully!');

    res.json({
      success: true,
      message: 'Facebook stats migration completed',
      details: {
        tables: ['facebook_stats'],
        permissions: permissions.length,
        indexes: 5
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 118 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  } finally {
    client.release();
  }
});

// GET /status - Check if migration has been applied
router.get('/status', async (req, res) => {
  try {
    const tableCheck = await pool.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'facebook_stats'
      ) as table_exists
    `);

    if (!tableCheck.rows[0].table_exists) {
      return res.json({
        status: {
          migrationNeeded: true,
          applied: false
        },
        message: 'Migration needed - facebook_stats table does not exist'
      });
    }

    const statsCount = await pool.query('SELECT COUNT(*) as count FROM facebook_stats');
    const permCount = await pool.query(
      "SELECT COUNT(*) as count FROM permissions WHERE code LIKE 'commercialisation.analyse_publicite.%'"
    );

    res.json({
      status: {
        migrationNeeded: false,
        applied: true,
        stats_entries: parseInt(statsCount.rows[0].count),
        permissions: parseInt(permCount.rows[0].count)
      },
      message: `Migration 118 already applied (${permCount.rows[0].count} permissions configured)`
    });

  } catch (error) {
    console.error('Error checking migration 118 status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
