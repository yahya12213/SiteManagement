/**
 * Migration 115: Add ALL missing permissions identified by validation
 *
 * This migration adds 34 missing permissions across multiple modules.
 *
 * FIXED: Uses correct permissions table schema with 8 columns:
 * module, menu, action, code, label, description, sort_order, permission_type
 */

import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

router.post('/run', authenticateToken, requireRole('admin'), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('🚀 Migration 115: Adding all missing permissions...');

    // All 34 missing permissions with correct 8-column schema
    const allPermissions = [
      // === FORMATION - Sessions Formation ===
      {
        module: 'formation',
        menu: 'sessions_formation',
        action: 'retirer_etudiant',
        code: 'formation.sessions_formation.retirer_etudiant',
        label: 'Retirer un etudiant',
        description: 'Permet de retirer un etudiant d\'une session',
        sort_order: 7,
        permission_type: 'bouton'
      },
      {
        module: 'formation',
        menu: 'sessions_formation',
        action: 'supprimer_paiement',
        code: 'formation.sessions_formation.supprimer_paiement',
        label: 'Supprimer un paiement',
        description: 'Permet de supprimer un paiement d\'un etudiant',
        sort_order: 8,
        permission_type: 'bouton'
      },
      {
        module: 'formation',
        menu: 'sessions_formation',
        action: 'transfert_etudiant',
        code: 'formation.sessions_formation.transfert_etudiant',
        label: 'Transferer un etudiant',
        description: 'Permet de transferer un etudiant vers une autre session',
        sort_order: 9,
        permission_type: 'bouton'
      },

      // === FORMATION - Templates Certificats ===
      {
        module: 'formation',
        menu: 'templates_certificats',
        action: 'creer',
        code: 'formation.templates_certificats.creer',
        label: 'Creer un template',
        description: 'Permet de creer un nouveau template de certificat',
        sort_order: 2,
        permission_type: 'bouton'
      },
      {
        module: 'formation',
        menu: 'templates_certificats',
        action: 'modifier',
        code: 'formation.templates_certificats.modifier',
        label: 'Modifier un template',
        description: 'Permet de modifier un template de certificat existant',
        sort_order: 3,
        permission_type: 'bouton'
      },

      // === FORMATION - Certificats (backup - migration 114 should have these) ===
      {
        module: 'formation',
        menu: 'certificats',
        action: 'voir',
        code: 'formation.certificats.voir',
        label: 'Voir les certificats',
        description: 'Permet de voir les certificats generes',
        sort_order: 1,
        permission_type: 'bouton'
      },
      {
        module: 'formation',
        menu: 'certificats',
        action: 'generer',
        code: 'formation.certificats.generer',
        label: 'Generer un certificat',
        description: 'Permet de generer un nouveau certificat',
        sort_order: 2,
        permission_type: 'bouton'
      },
      {
        module: 'formation',
        menu: 'certificats',
        action: 'modifier',
        code: 'formation.certificats.modifier',
        label: 'Modifier un certificat',
        description: 'Permet de modifier un certificat existant',
        sort_order: 3,
        permission_type: 'bouton'
      },
      {
        module: 'formation',
        menu: 'certificats',
        action: 'supprimer',
        code: 'formation.certificats.supprimer',
        label: 'Supprimer un certificat',
        description: 'Permet de supprimer un certificat',
        sort_order: 4,
        permission_type: 'bouton'
      },
      {
        module: 'formation',
        menu: 'certificats',
        action: 'telecharger',
        code: 'formation.certificats.telecharger',
        label: 'Telecharger un certificat',
        description: 'Permet de telecharger un certificat en PDF',
        sort_order: 5,
        permission_type: 'bouton'
      },

      // === FORMATION - Forums ===
      {
        module: 'formation',
        menu: 'forums',
        action: 'creer_sujet',
        code: 'formation.forums.creer_sujet',
        label: 'Creer un sujet',
        description: 'Permet de creer un nouveau sujet de discussion',
        sort_order: 2,
        permission_type: 'bouton'
      },
      {
        module: 'formation',
        menu: 'forums',
        action: 'modifier_sujet',
        code: 'formation.forums.modifier_sujet',
        label: 'Modifier un sujet',
        description: 'Permet de modifier un sujet existant',
        sort_order: 3,
        permission_type: 'bouton'
      },
      {
        module: 'formation',
        menu: 'forums',
        action: 'gerer',
        code: 'formation.forums.gerer',
        label: 'Gerer les forums',
        description: 'Permet de gerer les forums (moderation)',
        sort_order: 8,
        permission_type: 'bouton'
      },

      // === FORMATION - Centres ===
      {
        module: 'formation',
        menu: 'centres',
        action: 'voir',
        code: 'formation.centres.voir',
        label: 'Voir les centres',
        description: 'Permet de voir la liste des centres de formation',
        sort_order: 1,
        permission_type: 'page'
      },
      {
        module: 'formation',
        menu: 'centres',
        action: 'creer',
        code: 'formation.centres.creer',
        label: 'Creer un centre',
        description: 'Permet de creer un nouveau centre de formation',
        sort_order: 2,
        permission_type: 'bouton'
      },

      // === FORMATION - Corps ===
      {
        module: 'formation',
        menu: 'corps',
        action: 'voir',
        code: 'formation.corps.voir',
        label: 'Voir les corps',
        description: 'Permet de voir la liste des corps de formation',
        sort_order: 1,
        permission_type: 'page'
      },
      {
        module: 'formation',
        menu: 'corps',
        action: 'creer',
        code: 'formation.corps.creer',
        label: 'Creer un corps',
        description: 'Permet de creer un nouveau corps',
        sort_order: 2,
        permission_type: 'bouton'
      },
      {
        module: 'formation',
        menu: 'corps',
        action: 'modifier',
        code: 'formation.corps.modifier',
        label: 'Modifier un corps',
        description: 'Permet de modifier un corps existant',
        sort_order: 3,
        permission_type: 'bouton'
      },
      {
        module: 'formation',
        menu: 'corps',
        action: 'supprimer',
        code: 'formation.corps.supprimer',
        label: 'Supprimer un corps',
        description: 'Permet de supprimer un corps',
        sort_order: 4,
        permission_type: 'bouton'
      },

      // === RESSOURCES HUMAINES - Gestion Pointage ===
      {
        module: 'ressources_humaines',
        menu: 'gestion_pointage',
        action: 'creer',
        code: 'ressources_humaines.gestion_pointage.creer',
        label: 'Creer un pointage',
        description: 'Permet de creer un nouveau pointage',
        sort_order: 2,
        permission_type: 'bouton'
      },
      {
        module: 'ressources_humaines',
        menu: 'gestion_pointage',
        action: 'modifier',
        code: 'ressources_humaines.gestion_pointage.modifier',
        label: 'Modifier un pointage',
        description: 'Permet de modifier un pointage existant',
        sort_order: 3,
        permission_type: 'bouton'
      },
      {
        module: 'ressources_humaines',
        menu: 'gestion_pointage',
        action: 'approuver',
        code: 'ressources_humaines.gestion_pointage.approuver',
        label: 'Approuver les heures sup',
        description: 'Permet d\'approuver les heures supplementaires',
        sort_order: 4,
        permission_type: 'bouton'
      },
      {
        module: 'ressources_humaines',
        menu: 'gestion_pointage',
        action: 'rejeter',
        code: 'ressources_humaines.gestion_pointage.rejeter',
        label: 'Rejeter les heures sup',
        description: 'Permet de rejeter les heures supplementaires',
        sort_order: 5,
        permission_type: 'bouton'
      },

      // === RESSOURCES HUMAINES - Conges ===
      {
        module: 'ressources_humaines',
        menu: 'conges',
        action: 'voir',
        code: 'ressources_humaines.conges.voir',
        label: 'Voir les conges',
        description: 'Permet de voir les demandes de conges',
        sort_order: 1,
        permission_type: 'page'
      },
      {
        module: 'ressources_humaines',
        menu: 'conges',
        action: 'creer',
        code: 'ressources_humaines.conges.creer',
        label: 'Creer une demande de conge',
        description: 'Permet de creer une demande de conge',
        sort_order: 2,
        permission_type: 'bouton'
      },
      {
        module: 'ressources_humaines',
        menu: 'conges',
        action: 'approuver',
        code: 'ressources_humaines.conges.approuver',
        label: 'Approuver un conge',
        description: 'Permet d\'approuver une demande de conge',
        sort_order: 3,
        permission_type: 'bouton'
      },
      {
        module: 'ressources_humaines',
        menu: 'conges',
        action: 'modifier',
        code: 'ressources_humaines.conges.modifier',
        label: 'Modifier un conge',
        description: 'Permet de modifier une demande de conge',
        sort_order: 4,
        permission_type: 'bouton'
      },

      // === RESSOURCES HUMAINES - Tableau de Bord ===
      {
        module: 'ressources_humaines',
        menu: 'tableau_de_bord',
        action: 'voir',
        code: 'ressources_humaines.tableau_de_bord.voir',
        label: 'Voir le tableau de bord RH',
        description: 'Permet d\'acceder au tableau de bord RH',
        sort_order: 1,
        permission_type: 'page'
      },

      // === RESSOURCES HUMAINES - Parametres ===
      {
        module: 'ressources_humaines',
        menu: 'parametres',
        action: 'voir',
        code: 'ressources_humaines.parametres.voir',
        label: 'Voir les parametres RH',
        description: 'Permet de voir les parametres RH',
        sort_order: 1,
        permission_type: 'page'
      },
      {
        module: 'ressources_humaines',
        menu: 'parametres',
        action: 'modifier',
        code: 'ressources_humaines.parametres.modifier',
        label: 'Modifier les parametres RH',
        description: 'Permet de modifier les parametres RH',
        sort_order: 2,
        permission_type: 'bouton'
      },

      // === RESSOURCES HUMAINES - Jours Feries ===
      {
        module: 'ressources_humaines',
        menu: 'gestion_horaires',
        action: 'jours_feries.voir',
        code: 'ressources_humaines.gestion_horaires.jours_feries.voir',
        label: 'Voir les jours feries',
        description: 'Permet de voir les jours feries',
        sort_order: 10,
        permission_type: 'page'
      },
      {
        module: 'ressources_humaines',
        menu: 'gestion_horaires',
        action: 'jours_feries.gerer',
        code: 'ressources_humaines.gestion_horaires.jours_feries.gerer',
        label: 'Gerer les jours feries',
        description: 'Permet de gerer les jours feries',
        sort_order: 11,
        permission_type: 'bouton'
      },

      // === GESTION COMPTABLE - Declarations ===
      {
        module: 'gestion_comptable',
        menu: 'declarations',
        action: 'voir_tous',
        code: 'gestion_comptable.declarations.voir_tous',
        label: 'Voir toutes les declarations',
        description: 'Permet de voir toutes les declarations (admin)',
        sort_order: 2,
        permission_type: 'bouton'
      },
      {
        module: 'gestion_comptable',
        menu: 'declarations',
        action: 'edit_metadata',
        code: 'gestion_comptable.declarations.edit_metadata',
        label: 'Modifier les metadonnees',
        description: 'Permet de modifier les metadonnees d\'une declaration',
        sort_order: 6,
        permission_type: 'bouton'
      }
    ];

    let created = 0;
    let skipped = 0;

    for (const perm of allPermissions) {
      // Check if permission already exists
      const existing = await client.query(`
        SELECT id FROM permissions WHERE code = $1
      `, [perm.code]);

      if (existing.rows.length === 0) {
        await client.query(`
          INSERT INTO permissions (module, menu, action, code, label, description, sort_order, permission_type)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [perm.module, perm.menu, perm.action, perm.code, perm.label, perm.description, perm.sort_order, perm.permission_type]);
        console.log(`  ✓ Created: ${perm.code}`);
        created++;
      } else {
        console.log(`  - Skipped (exists): ${perm.code}`);
        skipped++;
      }
    }

    await client.query('COMMIT');

    console.log('✅ Migration 115 completed!');
    console.log(`   - Created: ${created} permissions`);
    console.log(`   - Skipped: ${skipped} (already exist)`);

    res.json({
      success: true,
      message: 'Migration 115 completed successfully',
      details: { created, skipped, total: allPermissions.length }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 115 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Status check endpoint
router.get('/status', authenticateToken, async (req, res) => {
  try {
    // Check a sample of permissions from each category
    const sampleCodes = [
      'formation.sessions_formation.retirer_etudiant',
      'formation.certificats.voir',
      'formation.centres.voir',
      'ressources_humaines.conges.voir',
      'ressources_humaines.gestion_horaires.jours_feries.voir',
      'gestion_comptable.declarations.voir_tous'
    ];

    const result = await pool.query(`
      SELECT code FROM permissions WHERE code = ANY($1)
    `, [sampleCodes]);

    const foundCount = result.rows.length;
    const migrationApplied = foundCount >= 4;

    res.json({
      success: true,
      migrationApplied,
      foundPermissions: result.rows.map(r => r.code),
      expectedSamples: sampleCodes.length,
      foundSamples: foundCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
