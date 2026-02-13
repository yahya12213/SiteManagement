/**
 * Migration 087 - Système de Suivi des Visites Physiques
 *
 * Fonctionnalités :
 * - Enregistrement des visites physiques au centre
 * - Suivi des inscriptions et non-inscriptions
 * - Motifs de non-inscription
 * - Analytics par zone et par motif
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting Prospect Visits Migration 087...');
    await client.query('BEGIN');

    // ============================================================
    // STEP 1: Table prospect_visits
    // ============================================================
    console.log('  📦 Creating prospect_visits table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS prospect_visits (
        id TEXT PRIMARY KEY,

        -- Informations du visiteur
        nom TEXT,
        prenom TEXT,
        phone_raw TEXT,
        phone_international TEXT NOT NULL,
        country_code TEXT REFERENCES country_phone_config(country_code),
        country TEXT,

        -- Localisation (centre de visite)
        centre_ville_id TEXT NOT NULL REFERENCES cities(id),

        -- Statut de la visite
        statut TEXT NOT NULL CHECK (statut IN ('inscrit', 'non_inscrit')),
        motif_non_inscription TEXT,

        -- Horodatage automatique
        date_visite TIMESTAMP NOT NULL DEFAULT NOW(),

        -- Métadonnées
        commentaire TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        created_by TEXT REFERENCES profiles(id)
      )
    `);

    // Créer les index
    console.log('  📦 Creating indexes on prospect_visits table...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_visits_phone_intl ON prospect_visits(phone_international);
      CREATE INDEX IF NOT EXISTS idx_visits_centre ON prospect_visits(centre_ville_id);
      CREATE INDEX IF NOT EXISTS idx_visits_statut ON prospect_visits(statut);
      CREATE INDEX IF NOT EXISTS idx_visits_date ON prospect_visits(date_visite DESC);
      CREATE INDEX IF NOT EXISTS idx_visits_motif ON prospect_visits(motif_non_inscription) WHERE motif_non_inscription IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_visits_created_by ON prospect_visits(created_by);
    `);

    // ============================================================
    // STEP 2: Table des motifs de non-inscription (référentiel)
    // ============================================================
    console.log('  📦 Creating visit_rejection_reasons table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS visit_rejection_reasons (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL UNIQUE,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Insérer les motifs prédéfinis
    console.log('  📦 Seeding rejection reasons...');
    const reasons = [
      ['reason-prix', 'Prix trop élevé', 'Le visiteur trouve le prix trop cher', 1],
      ['reason-reflexion', 'Besoin de réflexion', 'Le visiteur souhaite prendre le temps de réfléchir', 2],
      ['reason-concurrent', 'Concurrent', 'Le visiteur préfère aller chez un concurrent', 3],
      ['reason-planning', 'Planning incompatible', 'Les horaires ne conviennent pas au visiteur', 4],
      ['reason-eloignement', 'Éloignement géographique', 'Le centre est trop loin du domicile/travail', 5],
      ['reason-contenu', 'Contenu inadapté', 'La formation ne correspond pas aux attentes', 6],
      ['reason-famille', 'Consultation famille', 'Doit consulter un proche avant de s\'inscrire', 7],
      ['reason-financement', 'Problème de financement', 'Ne peut pas financer la formation actuellement', 8],
      ['reason-documents', 'Documents manquants', 'Le visiteur n\'a pas les documents requis', 9],
      ['reason-autre', 'Autre', 'Autre motif (préciser en commentaire)', 99],
    ];

    for (const [id, label, description, sortOrder] of reasons) {
      await client.query(`
        INSERT INTO visit_rejection_reasons (id, label, description, sort_order)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (id) DO NOTHING
      `, [id, label, description, sortOrder]);
    }

    console.log(`  ✅ Inserted ${reasons.length} rejection reasons`);

    // ============================================================
    // STEP 3: Permissions RBAC pour les visites
    // ============================================================
    console.log('  📦 Creating visit permissions...');

    const permissions = [
      {
        module: 'commercialisation',
        menu: 'visits',
        action: 'view_page',
        code: 'commercialisation.visits.view_page',
        label: 'Voir la page des visites',
        description: 'Accès à la page de gestion des visites physiques'
      },
      {
        module: 'commercialisation',
        menu: 'visits',
        action: 'create',
        code: 'commercialisation.visits.create',
        label: 'Enregistrer une visite',
        description: 'Enregistrer une nouvelle visite physique'
      },
      {
        module: 'commercialisation',
        menu: 'visits',
        action: 'update',
        code: 'commercialisation.visits.update',
        label: 'Modifier une visite',
        description: 'Modifier les informations d\'une visite'
      },
      {
        module: 'commercialisation',
        menu: 'visits',
        action: 'delete',
        code: 'commercialisation.visits.delete',
        label: 'Supprimer une visite',
        description: 'Supprimer une visite enregistrée'
      },
      {
        module: 'commercialisation',
        menu: 'visits',
        action: 'export',
        code: 'commercialisation.visits.export',
        label: 'Exporter les visites',
        description: 'Exporter la liste des visites en CSV'
      },
      {
        module: 'commercialisation',
        menu: 'visits',
        action: 'view_analytics',
        code: 'commercialisation.visits.view_analytics',
        label: 'Voir les analytics des visites',
        description: 'Accéder aux statistiques et rapports des visites'
      },
      {
        module: 'commercialisation',
        menu: 'visits',
        action: 'view_all',
        code: 'commercialisation.visits.view_all',
        label: 'Voir toutes les visites',
        description: 'Voir toutes les visites sans restriction SBAC'
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
      }
    }

    console.log(`  ✅ Created ${permissions.length} visit permissions`);

    // ============================================================
    // STEP 4: Assigner les permissions à l'admin et au gérant
    // ============================================================
    console.log('  📦 Assigning visit permissions to admin and gerant roles...');

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
      console.log(`  ✅ Assigned permissions to ${role.name}`);
    }

    // Assigner les permissions basiques à l'assistante
    const assistanteRole = await client.query(
      "SELECT id FROM roles WHERE name = 'assistante'"
    );

    if (assistanteRole.rows.length > 0) {
      const assistantePermissions = [
        'commercialisation.visits.view_page',
        'commercialisation.visits.create',
        'commercialisation.visits.update'
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
      console.log('  ✅ Assigned basic visit permissions to assistante');
    }

    await client.query('COMMIT');
    console.log('✅ Migration 087 completed successfully!');

    res.json({
      success: true,
      message: 'Prospect visits migration completed',
      details: {
        tables: ['prospect_visits', 'visit_rejection_reasons'],
        permissions: permissions.length,
        rejection_reasons: reasons.length
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 087 failed:', error);
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
      SELECT
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'prospect_visits') as visits_exists,
        EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'visit_rejection_reasons') as reasons_exists
    `);

    const tablesExist = tableCheck.rows[0].visits_exists && tableCheck.rows[0].reasons_exists;

    if (!tablesExist) {
      return res.json({
        status: {
          migrationNeeded: true,
          applied: false
        },
        message: 'Migration needed - Prospect visits tables do not exist'
      });
    }

    const reasonCount = await pool.query('SELECT COUNT(*) as count FROM visit_rejection_reasons');

    res.json({
      status: {
        migrationNeeded: false,
        applied: true,
        rejection_reasons: parseInt(reasonCount.rows[0].count)
      },
      message: `Migration 087 already applied (${reasonCount.rows[0].count} rejection reasons configured)`
    });

  } catch (error) {
    console.error('Error checking migration 087 status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
