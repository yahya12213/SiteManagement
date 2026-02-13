/**
 * Migration 078: Create 54 missing permissions from Migration 064 labels
 *
 * Problem: Migration 064 attempted to UPDATE labels for 54 permissions that were
 * never created. This causes silent failures and blocks functionality.
 *
 * Missing permissions by module:
 * - Accounting: 7 permissions (actions, calculation_sheets.settings, professor.declarations)
 * - HR: 31 permissions (dashboard, overtime, settings, clocking, attendance, etc.)
 * - Training: 15 permissions (centres, students, certificate_templates, forums, student portal)
 * - Commercialisation: 1 permission (prospects.update)
 *
 * Solution: Create all missing permissions and assign to admin role
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// All 54 missing permissions with exact labels/descriptions from Migration 064
const MISSING_PERMISSIONS = [
  // ========== ACCOUNTING MODULE (7) ==========
  { module: 'accounting', menu: 'calculation_sheets', action: 'settings', code: 'accounting.calculation_sheets.settings', label: 'Paramètres de fiche', description: 'Permet de modifier les paramètres avancés d\'une fiche', sort_order: 390 },
  { module: 'accounting', menu: 'professor', sub_menu: 'declarations', action: 'view_page', code: 'accounting.professor.declarations.view_page', label: 'Voir mes déclarations', description: 'Permet d\'accéder à ses propres déclarations', sort_order: 395 },
  { module: 'accounting', menu: 'professor', sub_menu: 'declarations', action: 'fill', code: 'accounting.professor.declarations.fill', label: 'Remplir ma déclaration', description: 'Permet de saisir les données dans sa propre déclaration', sort_order: 396 },
  { module: 'accounting', menu: 'actions', action: 'view_page', code: 'accounting.actions.view_page', label: 'Voir la page des actions', description: 'Permet d\'accéder à la liste des actions de projet', sort_order: 710 },
  { module: 'accounting', menu: 'actions', action: 'create', code: 'accounting.actions.create', label: 'Créer une action', description: 'Permet de créer une nouvelle action de projet', sort_order: 711 },
  { module: 'accounting', menu: 'actions', action: 'update', code: 'accounting.actions.update', label: 'Modifier une action', description: 'Permet de modifier une action de projet', sort_order: 712 },
  { module: 'accounting', menu: 'actions', action: 'delete', code: 'accounting.actions.delete', label: 'Supprimer une action', description: 'Permet de supprimer une action de projet', sort_order: 713 },

  // ========== TRAINING MODULE (15) ==========
  { module: 'training', menu: 'centres', action: 'view_page', code: 'training.centres.view_page', label: 'Voir la page des centres', description: 'Permet d\'accéder à la liste des centres de formation', sort_order: 1020 },
  { module: 'training', menu: 'centres', action: 'create', code: 'training.centres.create', label: 'Créer un centre', description: 'Permet de créer un nouveau centre de formation', sort_order: 1021 },
  { module: 'training', menu: 'centres', action: 'update', code: 'training.centres.update', label: 'Modifier un centre', description: 'Permet de modifier les informations d\'un centre', sort_order: 1022 },
  { module: 'training', menu: 'centres', action: 'delete', code: 'training.centres.delete', label: 'Supprimer un centre', description: 'Permet de supprimer un centre de formation', sort_order: 1023 },

  { module: 'training', menu: 'students', action: 'view_page', code: 'training.students.view_page', label: 'Voir la page des étudiants', description: 'Permet d\'accéder à la liste des étudiants', sort_order: 1150 },
  { module: 'training', menu: 'students', action: 'create', code: 'training.students.create', label: 'Créer un étudiant', description: 'Permet de créer un nouveau profil étudiant', sort_order: 1151 },
  { module: 'training', menu: 'students', action: 'update', code: 'training.students.update', label: 'Modifier un étudiant', description: 'Permet de modifier les informations d\'un étudiant', sort_order: 1152 },
  { module: 'training', menu: 'students', action: 'delete', code: 'training.students.delete', label: 'Supprimer un étudiant', description: 'Permet de supprimer un profil étudiant', sort_order: 1153 },

  { module: 'training', menu: 'certificate_templates', action: 'view', code: 'training.certificate_templates.view', label: 'Voir un template', description: 'Permet de visualiser un modèle de certificat', sort_order: 1502 },
  { module: 'training', menu: 'certificate_templates', action: 'create_template', code: 'training.certificate_templates.create_template', label: 'Créer un modèle', description: 'Permet de créer un nouveau modèle dans un dossier', sort_order: 1503 },
  { module: 'training', menu: 'certificate_templates', action: 'rename_folder', code: 'training.certificate_templates.rename_folder', label: 'Renommer un dossier', description: 'Permet de renommer un dossier de templates', sort_order: 1507 },
  { module: 'training', menu: 'certificate_templates', action: 'rename_template', code: 'training.certificate_templates.rename_template', label: 'Renommer un template', description: 'Permet de renommer un modèle de certificat', sort_order: 1508 },

  { module: 'training', menu: 'forums', action: 'update_thread', code: 'training.forums.update_thread', label: 'Modifier une discussion', description: 'Permet de modifier une discussion existante', sort_order: 1603 },
  { module: 'training', menu: 'forums', action: 'react', code: 'training.forums.react', label: 'Réagir', description: 'Permet de réagir aux messages (like, etc.)', sort_order: 1605 },

  { module: 'training', menu: 'student', sub_menu: 'dashboard', action: 'view_page', code: 'training.student.dashboard.view_page', label: 'Voir le tableau de bord étudiant', description: 'Permet d\'accéder au dashboard étudiant', sort_order: 1700 },
  { module: 'training', menu: 'student', sub_menu: 'catalog', action: 'view_page', code: 'training.student.catalog.view_page', label: 'Voir le catalogue', description: 'Permet de consulter le catalogue des formations', sort_order: 1701 },
  { module: 'training', menu: 'student', sub_menu: 'course', action: 'view', code: 'training.student.course.view', label: 'Voir un cours', description: 'Permet d\'accéder au contenu d\'une formation', sort_order: 1702 },
  { module: 'training', menu: 'student', sub_menu: 'course', sub_menu_2: 'videos', action: 'view', code: 'training.student.course.videos.view', label: 'Voir les vidéos', description: 'Permet de regarder les vidéos de formation', sort_order: 1703 },
  { module: 'training', menu: 'student', sub_menu: 'course', sub_menu_2: 'tests', action: 'take', code: 'training.student.course.tests.take', label: 'Passer les tests', description: 'Permet de passer les examens et quiz', sort_order: 1704 },
  { module: 'training', menu: 'student', sub_menu: 'certificates', action: 'view', code: 'training.student.certificates.view', label: 'Voir mes certificats', description: 'Permet de consulter ses propres certificats', sort_order: 1705 },
  { module: 'training', menu: 'student', sub_menu: 'forums', action: 'participate', code: 'training.student.forums.participate', label: 'Participer aux forums', description: 'Permet de participer aux discussions des forums', sort_order: 1706 },

  // ========== HR MODULE (31) ==========
  { module: 'hr', menu: 'clocking', action: 'self', code: 'hr.clocking.self', label: 'Pointer soi-même', description: 'Permet d\'enregistrer ses propres entrées et sorties', sort_order: 2010 },

  { module: 'hr', menu: 'contracts', action: 'manage', code: 'hr.contracts.manage', label: 'Gérer les contrats', description: 'Permet de gérer les contrats de travail des employés', sort_order: 2105 },
  { module: 'hr', menu: 'documents', action: 'manage', code: 'hr.documents.manage', label: 'Gérer les documents', description: 'Permet de gérer les documents RH des employés', sort_order: 2106 },
  { module: 'hr', menu: 'discipline', action: 'manage', code: 'hr.discipline.manage', label: 'Gérer la discipline', description: 'Permet de gérer les dossiers disciplinaires', sort_order: 2107 },

  { module: 'hr', menu: 'attendance', action: 'correct_records', code: 'hr.attendance.correct_records', label: 'Corriger les enregistrements', description: 'Permet de corriger manuellement les pointages', sort_order: 2206 },
  { module: 'hr', menu: 'attendance', action: 'import_records', code: 'hr.attendance.import_records', label: 'Importer les présences', description: 'Permet d\'importer des données de pointage', sort_order: 2207 },
  { module: 'hr', menu: 'attendance', action: 'record', code: 'hr.attendance.record', label: 'Enregistrer une présence', description: 'Permet d\'enregistrer manuellement une présence', sort_order: 2208 },

  { module: 'hr', menu: 'overtime', action: 'view_page', code: 'hr.overtime.view_page', label: 'Voir les heures supplémentaires', description: 'Permet d\'accéder aux demandes d\'heures supplémentaires', sort_order: 2300 },
  { module: 'hr', menu: 'overtime', action: 'request', code: 'hr.overtime.request', label: 'Demander des heures sup', description: 'Permet de soumettre une demande d\'heures supplémentaires', sort_order: 2301 },
  { module: 'hr', menu: 'overtime', action: 'approve', code: 'hr.overtime.approve', label: 'Approuver les heures sup', description: 'Permet d\'approuver les demandes d\'heures supplémentaires', sort_order: 2302 },
  { module: 'hr', menu: 'overtime', action: 'validate_payroll', code: 'hr.overtime.validate_payroll', label: 'Valider pour la paie', description: 'Permet de valider les heures sup pour le calcul de paie', sort_order: 2303 },
  { module: 'hr', menu: 'overtime', action: 'view_reports', code: 'hr.overtime.view_reports', label: 'Voir les rapports', description: 'Permet de consulter les rapports d\'heures supplémentaires', sort_order: 2304 },

  { module: 'hr', menu: 'leaves', action: 'approve', code: 'hr.leaves.approve', label: 'Approuver un congé', description: 'Permet d\'approuver les demandes de congés', sort_order: 2402 },
  { module: 'hr', menu: 'leaves', action: 'view_calendar', code: 'hr.leaves.view_calendar', label: 'Voir le calendrier', description: 'Permet de consulter le calendrier des congés', sort_order: 2407 },

  { module: 'hr', menu: 'dashboard', action: 'view_page', code: 'hr.dashboard.view_page', label: 'Voir le tableau de bord RH', description: 'Permet d\'accéder aux statistiques RH', sort_order: 2500 },
  { module: 'hr', menu: 'dashboard', action: 'export', code: 'hr.dashboard.export', label: 'Exporter le dashboard', description: 'Permet d\'exporter les données du tableau de bord', sort_order: 2501 },
  { module: 'hr', menu: 'dashboard', action: 'export_reports', code: 'hr.dashboard.export_reports', label: 'Exporter les rapports', description: 'Permet d\'exporter les rapports RH détaillés', sort_order: 2502 },
  { module: 'hr', menu: 'dashboard', action: 'view_monthly_reports', code: 'hr.dashboard.view_monthly_reports', label: 'Voir les rapports mensuels', description: 'Permet de consulter les synthèses mensuelles', sort_order: 2503 },
  { module: 'hr', menu: 'dashboard', action: 'generate_payroll_summary', code: 'hr.dashboard.generate_payroll_summary', label: 'Générer le résumé de paie', description: 'Permet de générer un résumé pour la paie', sort_order: 2504 },
  { module: 'hr', menu: 'dashboard', action: 'export_payroll', code: 'hr.dashboard.export_payroll', label: 'Exporter la paie', description: 'Permet d\'exporter les données de paie', sort_order: 2505 },
  { module: 'hr', menu: 'dashboard', action: 'view_alerts', code: 'hr.dashboard.view_alerts', label: 'Voir les alertes', description: 'Permet de consulter les alertes RH', sort_order: 2506 },

  { module: 'hr', menu: 'monthly_summary', action: 'view', code: 'hr.monthly_summary.view', label: 'Voir le résumé mensuel', description: 'Permet de consulter le résumé mensuel des présences', sort_order: 2600 },
  { module: 'hr', menu: 'monthly_summary', action: 'validate', code: 'hr.monthly_summary.validate', label: 'Valider le résumé', description: 'Permet de valider le résumé mensuel', sort_order: 2601 },
  { module: 'hr', menu: 'monthly_summary', action: 'export', code: 'hr.monthly_summary.export', label: 'Exporter le résumé', description: 'Permet d\'exporter le résumé mensuel', sort_order: 2602 },

  { module: 'hr', menu: 'settings', action: 'view_page', code: 'hr.settings.view_page', label: 'Voir les paramètres RH', description: 'Permet d\'accéder aux paramètres du module RH', sort_order: 2700 },
  { module: 'hr', menu: 'settings', action: 'manage', code: 'hr.settings.manage', label: 'Gérer les paramètres', description: 'Permet de modifier les paramètres RH généraux', sort_order: 2701 },
  { module: 'hr', menu: 'settings', action: 'manage_schedules', code: 'hr.settings.manage_schedules', label: 'Gérer les horaires', description: 'Permet de configurer les modèles d\'horaires', sort_order: 2702 },
  { module: 'hr', menu: 'settings', action: 'manage_leave_rules', code: 'hr.settings.manage_leave_rules', label: 'Gérer les règles de congés', description: 'Permet de configurer les règles d\'attribution des congés', sort_order: 2703 },
  { module: 'hr', menu: 'settings', action: 'manage_workflows', code: 'hr.settings.manage_workflows', label: 'Gérer les workflows', description: 'Permet de configurer les workflows de validation', sort_order: 2704 },
  { module: 'hr', menu: 'settings', action: 'update', code: 'hr.settings.update', label: 'Modifier les paramètres', description: 'Permet de sauvegarder les modifications des paramètres', sort_order: 2705 },

  { module: 'hr', menu: 'payroll', action: 'view_tests', code: 'hr.payroll.view_tests', label: 'Voir les tests', description: 'Permet de tester les calculs de paie', sort_order: 2806 },
  { module: 'hr', menu: 'payroll', action: 'manage_automation', code: 'hr.payroll.manage_automation', label: 'Gérer l\'automatisation', description: 'Permet de configurer l\'automatisation de la paie', sort_order: 2807 },

  // ========== COMMERCIALISATION MODULE (1) ==========
  { module: 'commercialisation', menu: 'prospects', action: 'update', code: 'commercialisation.prospects.update', label: 'Mettre à jour un prospect', description: 'Permet de mettre à jour le statut d\'un prospect', sort_order: 3105 },
];

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 078: Create 54 missing permissions ===\n');

    let created = 0;
    let skipped = 0;
    const createdPermissions = [];

    // 1. Create each permission
    console.log('Step 1: Creating missing permissions...\n');
    for (const perm of MISSING_PERMISSIONS) {
      const result = await client.query(`
        INSERT INTO permissions (module, menu, action, code, label, description, sort_order, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (code) DO NOTHING
        RETURNING id, code
      `, [perm.module, perm.menu, perm.action, perm.code, perm.label, perm.description, perm.sort_order]);

      if (result.rowCount > 0) {
        created++;
        createdPermissions.push({ id: result.rows[0].id, code: perm.code });
        console.log(`✓ Created: ${perm.code}`);
      } else {
        skipped++;
        console.log(`⚠ Already exists: ${perm.code}`);
      }
    }

    console.log(`\n${created} permissions created, ${skipped} skipped\n`);

    // 2. Assign all new permissions to admin role
    if (created > 0) {
      console.log('Step 2: Assigning all permissions to admin role...\n');
      const adminRole = await client.query(`SELECT id FROM roles WHERE name = 'admin'`);

      if (adminRole.rows.length > 0) {
        const adminRoleId = adminRole.rows[0].id;

        for (const perm of createdPermissions) {
          await client.query(`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT (role_id, permission_id) DO NOTHING
          `, [adminRoleId, perm.id]);
        }

        console.log(`✓ Assigned ${createdPermissions.length} new permissions to admin role\n`);
      }
    }

    await client.query('COMMIT');

    console.log('=== Migration 078 completed successfully! ===\n');
    console.log('📋 Summary:');
    console.log(`  - Accounting: 7 permissions`);
    console.log(`  - Training: 15 permissions`);
    console.log(`  - HR: 31 permissions`);
    console.log(`  - Commercialisation: 1 permission`);
    console.log(`  - Total created: ${created}`);
    console.log(`  - Total skipped: ${skipped}`);
    console.log('\n⚠ Note: New permissions assigned to admin role only.');
    console.log('   Other roles can activate them manually in UI.\n');

    res.json({
      success: true,
      message: `Created ${created} missing permissions, skipped ${skipped}`,
      created,
      skipped,
      breakdown: {
        accounting: 7,
        training: 15,
        hr: 31,
        commercialisation: 1
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 078 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

router.get('/status', async (req, res) => {
  try {
    // Check how many of the 54 permissions exist
    const codes = MISSING_PERMISSIONS.map(p => p.code);
    const placeholders = codes.map((_, i) => `$${i + 1}`).join(', ');

    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM permissions
      WHERE code IN (${placeholders})
    `, codes);

    const existingCount = parseInt(result.rows[0].count);
    const missingCount = MISSING_PERMISSIONS.length - existingCount;
    const applied = missingCount === 0;

    res.json({
      status: {
        migrationNeeded: !applied,
        applied,
        existingCount,
        missingCount,
        totalPermissions: MISSING_PERMISSIONS.length
      },
      message: applied
        ? 'All 54 permissions exist'
        : `${missingCount} permissions missing - run migration to create them`
    });
  } catch (error) {
    res.status(500).json({
      status: { migrationNeeded: true, applied: false, error: error.message },
      message: `Error checking status: ${error.message}`
    });
  }
});

export default router;
