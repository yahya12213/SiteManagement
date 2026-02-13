/**
 * Migration 116: Consolidate duplicate permissions
 *
 * Problem: Multiple permission codes exist for the same action
 * - training.certificates.view vs formation.certificats.voir
 * - Roles are assigned to wrong codes, causing permission denied errors
 *
 * Solution:
 * 1. Map all role_permissions from old codes to new codes
 * 2. Delete duplicate/old permission entries
 *
 * This fixes the issue where users have permissions assigned but still get denied
 * because the permission codes don't match what the backend expects.
 */

import express from 'express';
import pool from '../config/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// All permission consolidations: old_code → new_code
// This maps the English codes to their French equivalents
const CONSOLIDATION_MAP = {
  // Certificats
  'training.certificates.view': 'formation.certificats.voir',
  'training.certificates.view_page': 'formation.certificats.voir',
  'training.certificates.generate': 'formation.certificats.generer',
  'training.certificates.update': 'formation.certificats.modifier',
  'training.certificates.delete': 'formation.certificats.supprimer',
  'training.certificates.download': 'formation.certificats.telecharger',

  // Templates certificats
  'training.certificate_templates.view_page': 'formation.templates_certificats.voir',
  'training.certificate_templates.view': 'formation.templates_certificats.voir',
  'training.certificate_templates.create': 'formation.templates_certificats.creer',
  'training.certificate_templates.update': 'formation.templates_certificats.modifier',
  'training.certificate_templates.delete': 'formation.templates_certificats.supprimer',

  // Forums
  'training.forums.view_page': 'formation.forums.voir',
  'training.forums.view': 'formation.forums.voir',
  'training.forums.create_thread': 'formation.forums.creer_sujet',
  'training.forums.update_thread': 'formation.forums.modifier_sujet',
  'training.forums.manage': 'formation.forums.gerer',
  'training.forums.reply': 'formation.forums.repondre',
  'training.forums.delete': 'formation.forums.supprimer',
  'training.forums.react': 'formation.forums.reagir',

  // Sessions de formation
  'training.sessions.remove_student': 'formation.sessions_formation.retirer_etudiant',
  'training.sessions.delete_payment': 'formation.sessions_formation.supprimer_paiement',
  'training.sessions.transfer_student': 'formation.sessions_formation.transfert_etudiant',
  'training.sessions.add_student': 'formation.sessions_formation.ajouter_etudiant',
  'training.sessions.edit_student': 'formation.sessions_formation.modifier_etudiant',

  // Centres et Corps
  'training.centres.view_page': 'formation.centres.voir',
  'training.centres.create': 'formation.centres.creer',
  'training.corps.view_page': 'formation.corps.voir',
  'training.corps.create': 'formation.corps.creer',
  'training.corps.update': 'formation.corps.modifier',
  'training.corps.delete': 'formation.corps.supprimer',

  // RH - Gestion Pointage
  'hr.attendance.view_page': 'ressources_humaines.gestion_pointage.voir',
  'hr.attendance.create': 'ressources_humaines.gestion_pointage.creer',
  'hr.attendance.edit': 'ressources_humaines.gestion_pointage.modifier',
  'hr.attendance.approve_overtime': 'ressources_humaines.gestion_pointage.approuver',
  'hr.attendance.reject_overtime': 'ressources_humaines.gestion_pointage.rejeter',

  // RH - Conges
  'hr.leaves.view_page': 'ressources_humaines.conges.voir',
  'hr.leaves.create': 'ressources_humaines.conges.creer',
  'hr.leaves.approve': 'ressources_humaines.conges.approuver',
  'hr.leaves.edit': 'ressources_humaines.conges.modifier',

  // RH - Dashboard et Parametres
  'hr.dashboard.view_page': 'ressources_humaines.tableau_de_bord.voir',
  'hr.settings.view_page': 'ressources_humaines.parametres.voir',
  'hr.settings.edit': 'ressources_humaines.parametres.modifier',

  // RH - Jours feries
  'hr.holidays.view_page': 'ressources_humaines.gestion_horaires.jours_feries.voir',
  'hr.holidays.manage': 'ressources_humaines.gestion_horaires.jours_feries.gerer',

  // Declarations
  'accounting.declarations.view_all': 'gestion_comptable.declarations.voir_tous',
  'accounting.declarations.edit_metadata': 'gestion_comptable.declarations.edit_metadata',
};

router.post('/run', authenticateToken, requireRole('admin'), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    console.log('🚀 Migration 116: Consolidating permissions...');

    let consolidated = 0;
    let renamed = 0;
    let skipped = 0;
    const details = [];

    for (const [oldCode, newCode] of Object.entries(CONSOLIDATION_MAP)) {
      // Find both permissions
      const oldPerm = await client.query(
        'SELECT id FROM permissions WHERE code = $1', [oldCode]
      );
      const newPerm = await client.query(
        'SELECT id FROM permissions WHERE code = $1', [newCode]
      );

      if (oldPerm.rows.length > 0 && newPerm.rows.length > 0) {
        // CASE 1: Both exist - migrate role_permissions and delete old
        const oldId = oldPerm.rows[0].id;
        const newId = newPerm.rows[0].id;

        // Migrate role_permissions (avoid duplicates)
        const migrated = await client.query(`
          UPDATE role_permissions
          SET permission_id = $1
          WHERE permission_id = $2
          AND role_id NOT IN (
            SELECT role_id FROM role_permissions WHERE permission_id = $1
          )
          RETURNING role_id
        `, [newId, oldId]);

        // Delete remaining old assignments (duplicates)
        await client.query(
          'DELETE FROM role_permissions WHERE permission_id = $1', [oldId]
        );

        // Delete old permission
        await client.query(
          'DELETE FROM permissions WHERE id = $1', [oldId]
        );

        const msg = `Consolidated: ${oldCode} → ${newCode} (${migrated.rowCount} roles)`;
        console.log(`  ✓ ${msg}`);
        details.push(msg);
        consolidated++;

      } else if (oldPerm.rows.length > 0 && newPerm.rows.length === 0) {
        // CASE 2: Only old exists - rename it to new code
        const parts = newCode.split('.');
        const module = parts[0];
        const menu = parts[1];
        const action = parts.slice(2).join('.');

        await client.query(`
          UPDATE permissions
          SET code = $1, module = $2, menu = $3, action = $4
          WHERE id = $5
        `, [newCode, module, menu, action, oldPerm.rows[0].id]);

        const msg = `Renamed: ${oldCode} → ${newCode}`;
        console.log(`  ✓ ${msg}`);
        details.push(msg);
        renamed++;

      } else {
        console.log(`  - Skipped: ${oldCode} (not found in DB)`);
        skipped++;
      }
    }

    await client.query('COMMIT');

    console.log('✅ Migration 116 completed!');
    console.log(`   - Consolidated: ${consolidated}`);
    console.log(`   - Renamed: ${renamed}`);
    console.log(`   - Skipped: ${skipped}`);

    res.json({
      success: true,
      message: 'Migration 116 completed',
      details: { consolidated, renamed, skipped, actions: details }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 116 failed:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// Status check endpoint
router.get('/status', authenticateToken, async (req, res) => {
  try {
    // Check if any old codes still exist in the database
    const oldCodes = Object.keys(CONSOLIDATION_MAP);
    const result = await pool.query(`
      SELECT code FROM permissions WHERE code = ANY($1)
    `, [oldCodes]);

    const migrationApplied = result.rows.length === 0;

    res.json({
      success: true,
      migrationApplied,
      statusMessage: migrationApplied
        ? 'Toutes les permissions sont consolidees'
        : `${result.rows.length} anciens codes a migrer`,
      remainingOldCodes: result.rows.map(r => r.code)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
