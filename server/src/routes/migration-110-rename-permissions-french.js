import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 110: Renommer les permissions de l'anglais vers le français
// Cette migration UPDATE les codes existants, elle ne crée pas de doublons
// Les role_permissions restent valides car on modifie le code, pas l'ID

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 110: Renommer les permissions en français ===');

    // Mapping des anciennes permissions (anglais) vers les nouvelles (français)
    const permissionMappings = [
      // ==================== GESTION COMPTABLE ====================
      // Tableau de bord
      { old: 'accounting.dashboard.view_page', new: 'gestion_comptable.tableau_de_bord.voir' },

      // Segments
      { old: 'accounting.segments.view_page', new: 'gestion_comptable.segments.voir' },
      { old: 'accounting.segments.create', new: 'gestion_comptable.segments.creer' },
      { old: 'accounting.segments.update', new: 'gestion_comptable.segments.modifier' },
      { old: 'accounting.segments.delete', new: 'gestion_comptable.segments.supprimer' },
      { old: 'accounting.segments.import_cities', new: 'gestion_comptable.segments.importer_villes' },

      // Villes
      { old: 'accounting.cities.view_page', new: 'gestion_comptable.villes.voir' },
      { old: 'accounting.cities.create', new: 'gestion_comptable.villes.creer' },
      { old: 'accounting.cities.update', new: 'gestion_comptable.villes.modifier' },
      { old: 'accounting.cities.delete', new: 'gestion_comptable.villes.supprimer' },
      { old: 'accounting.cities.bulk_delete', new: 'gestion_comptable.villes.supprimer_masse' },

      // Utilisateurs
      { old: 'accounting.users.view_page', new: 'gestion_comptable.utilisateurs.voir' },
      { old: 'accounting.users.create', new: 'gestion_comptable.utilisateurs.creer' },
      { old: 'accounting.users.update', new: 'gestion_comptable.utilisateurs.modifier' },
      { old: 'accounting.users.delete', new: 'gestion_comptable.utilisateurs.supprimer' },
      { old: 'accounting.users.assign_segments', new: 'gestion_comptable.utilisateurs.assigner_segments' },
      { old: 'accounting.users.assign_cities', new: 'gestion_comptable.utilisateurs.assigner_villes' },
      { old: 'accounting.users.assign_roles', new: 'gestion_comptable.utilisateurs.assigner_roles' },
      // Aussi essayer les variantes system.users.*
      { old: 'system.users.view_page', new: 'gestion_comptable.utilisateurs.voir' },
      { old: 'system.users.create', new: 'gestion_comptable.utilisateurs.creer' },
      { old: 'system.users.update', new: 'gestion_comptable.utilisateurs.modifier' },
      { old: 'system.users.delete', new: 'gestion_comptable.utilisateurs.supprimer' },

      // Rôles & Permissions
      { old: 'system.roles.view_page', new: 'gestion_comptable.roles_permissions.voir' },
      { old: 'system.roles.create', new: 'gestion_comptable.roles_permissions.creer' },
      { old: 'system.roles.update', new: 'gestion_comptable.roles_permissions.modifier' },
      { old: 'system.roles.delete', new: 'gestion_comptable.roles_permissions.supprimer' },

      // Fiches de calcul
      { old: 'accounting.calculation_sheets.view_page', new: 'gestion_comptable.fiches_calcul.voir' },
      { old: 'accounting.calculation_sheets.create', new: 'gestion_comptable.fiches_calcul.creer' },
      { old: 'accounting.calculation_sheets.update', new: 'gestion_comptable.fiches_calcul.modifier' },
      { old: 'accounting.calculation_sheets.delete', new: 'gestion_comptable.fiches_calcul.supprimer' },
      { old: 'accounting.calculation_sheets.publish', new: 'gestion_comptable.fiches_calcul.publier' },
      { old: 'accounting.calculation_sheets.duplicate', new: 'gestion_comptable.fiches_calcul.dupliquer' },
      { old: 'accounting.calculation_sheets.export', new: 'gestion_comptable.fiches_calcul.exporter' },
      { old: 'accounting.calculation_sheets.settings', new: 'gestion_comptable.fiches_calcul.parametres' },
      // Variantes avec sheets
      { old: 'accounting.sheets.view_page', new: 'gestion_comptable.fiches_calcul.voir' },
      { old: 'accounting.sheets.create', new: 'gestion_comptable.fiches_calcul.creer' },
      { old: 'accounting.sheets.update', new: 'gestion_comptable.fiches_calcul.modifier' },
      { old: 'accounting.sheets.delete', new: 'gestion_comptable.fiches_calcul.supprimer' },

      // Déclarations
      { old: 'accounting.declarations.view_page', new: 'gestion_comptable.declarations.voir' },
      { old: 'accounting.declarations.view_all', new: 'gestion_comptable.declarations.voir_toutes' },
      { old: 'accounting.declarations.create', new: 'gestion_comptable.declarations.creer' },
      { old: 'accounting.declarations.fill_data', new: 'gestion_comptable.declarations.remplir' },
      { old: 'accounting.declarations.update', new: 'gestion_comptable.declarations.modifier_metadata' },
      { old: 'accounting.declarations.edit_metadata', new: 'gestion_comptable.declarations.modifier_metadata' },
      { old: 'accounting.declarations.delete', new: 'gestion_comptable.declarations.supprimer' },
      { old: 'accounting.declarations.approve', new: 'gestion_comptable.declarations.approuver' },
      { old: 'accounting.declarations.reject', new: 'gestion_comptable.declarations.rejeter' },
      { old: 'accounting.declarations.submit', new: 'gestion_comptable.declarations.soumettre' },

      // Gestion de Projet
      { old: 'accounting.projects.view_page', new: 'gestion_comptable.gestion_projet.voir' },
      { old: 'accounting.projects.create', new: 'gestion_comptable.gestion_projet.creer' },
      { old: 'accounting.projects.update', new: 'gestion_comptable.gestion_projet.modifier' },
      { old: 'accounting.projects.delete', new: 'gestion_comptable.gestion_projet.supprimer' },
      { old: 'accounting.projects.export', new: 'gestion_comptable.gestion_projet.exporter' },

      // ==================== FORMATION ====================
      // Gestion des Formations
      { old: 'training.formations.view_page', new: 'formation.gestion_formations.voir' },
      { old: 'training.formations.create', new: 'formation.gestion_formations.creer' },
      { old: 'training.formations.update', new: 'formation.gestion_formations.modifier' },
      { old: 'training.formations.delete', new: 'formation.gestion_formations.supprimer' },
      { old: 'training.formations.duplicate', new: 'formation.gestion_formations.dupliquer' },
      { old: 'training.formations.create_pack', new: 'formation.gestion_formations.creer_pack' },
      { old: 'training.formations.edit_content', new: 'formation.gestion_formations.editer_contenu' },
      // Variantes centres/corps
      { old: 'training.centres.view_page', new: 'formation.gestion_formations.voir' },
      { old: 'training.centres.create', new: 'formation.gestion_formations.creer' },
      { old: 'training.corps.view_page', new: 'formation.gestion_formations.voir' },
      { old: 'training.corps.create', new: 'formation.gestion_formations.creer' },
      { old: 'training.corps.update', new: 'formation.gestion_formations.modifier' },
      { old: 'training.corps.delete', new: 'formation.gestion_formations.supprimer' },

      // Sessions de Formation
      { old: 'training.sessions.view_page', new: 'formation.sessions_formation.voir' },
      { old: 'training.sessions.create', new: 'formation.sessions_formation.creer' },
      { old: 'training.sessions.update', new: 'formation.sessions_formation.modifier' },
      { old: 'training.sessions.delete', new: 'formation.sessions_formation.supprimer' },
      { old: 'training.sessions.add_student', new: 'formation.sessions_formation.ajouter_etudiant' },
      { old: 'training.sessions.edit_student', new: 'formation.sessions_formation.modifier_etudiant' },

      // Analytics
      { old: 'training.analytics.view_page', new: 'formation.analytics.voir' },
      { old: 'training.analytics.export', new: 'formation.analytics.exporter' },
      { old: 'training.analytics.change_period', new: 'formation.analytics.changer_periode' },

      // Rapports Étudiants
      { old: 'training.student_reports.view_page', new: 'formation.rapports_etudiants.voir' },
      { old: 'training.student_reports.search', new: 'formation.rapports_etudiants.rechercher' },
      { old: 'training.student_reports.export_csv', new: 'formation.rapports_etudiants.exporter_csv' },
      { old: 'training.student_reports.export_pdf', new: 'formation.rapports_etudiants.exporter_pdf' },
      { old: 'training.reports.view_page', new: 'formation.rapports_etudiants.voir' },

      // Liste des Étudiants
      { old: 'training.students.view_page', new: 'formation.liste_etudiants.voir' },
      { old: 'training.students.create', new: 'formation.liste_etudiants.creer' },
      { old: 'training.students.update', new: 'formation.liste_etudiants.modifier' },
      { old: 'training.students.delete', new: 'formation.liste_etudiants.supprimer' },

      // Templates de Certificats
      { old: 'training.certificate_templates.view_page', new: 'formation.templates_certificats.voir' },
      { old: 'training.certificate_templates.create_folder', new: 'formation.templates_certificats.creer_dossier' },
      { old: 'training.certificate_templates.create', new: 'formation.templates_certificats.creer_template' },
      { old: 'training.certificate_templates.rename', new: 'formation.templates_certificats.renommer' },
      { old: 'training.certificate_templates.delete', new: 'formation.templates_certificats.supprimer' },
      { old: 'training.certificate_templates.duplicate', new: 'formation.templates_certificats.dupliquer' },
      { old: 'training.certificate_templates.edit_canvas', new: 'formation.templates_certificats.editer_canvas' },
      // Variantes certificates
      { old: 'training.certificates.view_page', new: 'formation.templates_certificats.voir' },
      { old: 'training.certificates.create', new: 'formation.templates_certificats.creer_template' },
      { old: 'training.certificates.generate', new: 'formation.templates_certificats.creer_template' },
      { old: 'training.certificates.update', new: 'formation.templates_certificats.renommer' },
      { old: 'training.certificates.delete', new: 'formation.templates_certificats.supprimer' },

      // Forums
      { old: 'training.forums.view_page', new: 'formation.forums.voir' },
      { old: 'training.forums.create_thread', new: 'formation.forums.creer_discussion' },
      { old: 'training.forums.reply', new: 'formation.forums.repondre' },
      { old: 'training.forums.react', new: 'formation.forums.reagir' },
      { old: 'training.forums.delete', new: 'formation.forums.supprimer' },
      { old: 'training.forums.pin', new: 'formation.forums.epingler' },
      { old: 'training.forums.lock', new: 'formation.forums.verrouiller' },
      { old: 'training.forums.moderate', new: 'formation.forums.moderer' },
      { old: 'training.forums.manage', new: 'formation.forums.moderer' },

      // ==================== RESSOURCES HUMAINES ====================
      // Boucles de Validation
      { old: 'hr.validation_workflows.view_page', new: 'ressources_humaines.boucles_validation.voir' },
      { old: 'hr.validation_workflows.create', new: 'ressources_humaines.boucles_validation.creer' },
      { old: 'hr.validation_workflows.update', new: 'ressources_humaines.boucles_validation.modifier' },
      { old: 'hr.validation_workflows.delete', new: 'ressources_humaines.boucles_validation.supprimer' },

      // Gestion des Horaires
      { old: 'hr.schedules.view_page', new: 'ressources_humaines.gestion_horaires.voir' },
      { old: 'hr.schedules.create_model', new: 'ressources_humaines.gestion_horaires.modeles.creer' },
      { old: 'hr.schedules.update_model', new: 'ressources_humaines.gestion_horaires.modeles.modifier' },
      { old: 'hr.schedules.delete_model', new: 'ressources_humaines.gestion_horaires.modeles.supprimer' },
      { old: 'hr.schedules.create_holiday', new: 'ressources_humaines.gestion_horaires.jours_feries.creer' },
      { old: 'hr.schedules.update_holiday', new: 'ressources_humaines.gestion_horaires.jours_feries.modifier' },
      { old: 'hr.schedules.delete_holiday', new: 'ressources_humaines.gestion_horaires.jours_feries.supprimer' },
      { old: 'hr.schedules.view_overtime', new: 'ressources_humaines.gestion_horaires.heures_sup.voir' },
      { old: 'hr.schedules.approve_overtime', new: 'ressources_humaines.gestion_horaires.heures_sup.approuver' },
      { old: 'hr.schedules.reject_overtime', new: 'ressources_humaines.gestion_horaires.heures_sup.rejeter' },
      { old: 'hr.attendance.approve_overtime', new: 'ressources_humaines.gestion_horaires.heures_sup.approuver' },
      { old: 'hr.attendance.reject_overtime', new: 'ressources_humaines.gestion_horaires.heures_sup.rejeter' },

      // Gestion de Paie
      { old: 'hr.payroll.view_page', new: 'ressources_humaines.gestion_paie.voir' },
      { old: 'hr.payroll.create_period', new: 'ressources_humaines.gestion_paie.periodes.creer' },
      { old: 'hr.payroll.open_period', new: 'ressources_humaines.gestion_paie.periodes.ouvrir' },
      { old: 'hr.payroll.close_period', new: 'ressources_humaines.gestion_paie.periodes.fermer' },
      { old: 'hr.payroll.delete_period', new: 'ressources_humaines.gestion_paie.periodes.supprimer' },
      { old: 'hr.payroll.calculate', new: 'ressources_humaines.gestion_paie.calculs.calculer' },
      { old: 'hr.payroll.view_payslips', new: 'ressources_humaines.gestion_paie.bulletins.voir' },
      { old: 'hr.payroll.validate_payslip', new: 'ressources_humaines.gestion_paie.bulletins.valider' },
      { old: 'hr.payroll.validate_all_payslips', new: 'ressources_humaines.gestion_paie.bulletins.valider_tous' },
      { old: 'hr.payroll.download_payslip', new: 'ressources_humaines.gestion_paie.bulletins.telecharger' },
      { old: 'hr.payroll.export_cnss', new: 'ressources_humaines.gestion_paie.bulletins.exporter_cnss' },
      { old: 'hr.payroll.export_transfers', new: 'ressources_humaines.gestion_paie.bulletins.exporter_virements' },
      { old: 'hr.payroll.view_config', new: 'ressources_humaines.gestion_paie.configuration.voir' },
      { old: 'hr.payroll.update_config', new: 'ressources_humaines.gestion_paie.configuration.modifier' },

      // Gestion Pointage (admin)
      { old: 'hr.employee_portal.view_page', new: 'ressources_humaines.gestion_pointage.voir' },
      { old: 'hr.attendance.view_page', new: 'ressources_humaines.gestion_pointage.voir' },
      { old: 'hr.attendance.create', new: 'ressources_humaines.gestion_pointage.pointer' },
      { old: 'hr.attendance.clock_in_out', new: 'ressources_humaines.gestion_pointage.pointer' },
      { old: 'hr.attendance.edit', new: 'ressources_humaines.gestion_pointage.corriger' },
      { old: 'hr.attendance.correct', new: 'ressources_humaines.gestion_pointage.corriger' },
      { old: 'hr.attendance.import', new: 'ressources_humaines.gestion_pointage.importer' },
      { old: 'hr.attendance.export', new: 'ressources_humaines.gestion_pointage.exporter' },
      { old: 'hr.attendance.validate', new: 'ressources_humaines.gestion_pointage.valider' },

      // Dossier Employé
      { old: 'hr.employees.view_page', new: 'ressources_humaines.dossier_employe.voir' },
      { old: 'hr.employees.create', new: 'ressources_humaines.dossier_employe.creer' },
      { old: 'hr.employees.update', new: 'ressources_humaines.dossier_employe.modifier' },
      { old: 'hr.employees.delete', new: 'ressources_humaines.dossier_employe.supprimer' },
      { old: 'hr.employees.view_salary', new: 'ressources_humaines.dossier_employe.voir_salaire' },
      { old: 'hr.employees.manage_contracts', new: 'ressources_humaines.dossier_employe.gerer_contrats' },
      { old: 'hr.employees.manage_documents', new: 'ressources_humaines.dossier_employe.gerer_documents' },
      { old: 'hr.employees.manage_discipline', new: 'ressources_humaines.dossier_employe.gerer_discipline' },

      // Validation des Demandes
      { old: 'hr.requests_validation.view_page', new: 'ressources_humaines.validation_demandes.voir' },
      { old: 'hr.requests_validation.approve', new: 'ressources_humaines.validation_demandes.approuver' },
      { old: 'hr.requests_validation.reject', new: 'ressources_humaines.validation_demandes.rejeter' },
      { old: 'hr.leaves.view_page', new: 'ressources_humaines.validation_demandes.voir' },
      { old: 'hr.leaves.approve', new: 'ressources_humaines.validation_demandes.approuver' },
      { old: 'hr.leaves.reject', new: 'ressources_humaines.validation_demandes.rejeter' },

      // Délégations
      { old: 'hr.delegation.view_page', new: 'ressources_humaines.delegations.voir' },
      { old: 'hr.delegation.create', new: 'ressources_humaines.delegations.creer' },
      { old: 'hr.delegation.manage_all', new: 'ressources_humaines.delegations.gerer_toutes' },
      { old: 'hr.delegations.view_page', new: 'ressources_humaines.delegations.voir' },
      { old: 'hr.delegations.create', new: 'ressources_humaines.delegations.creer' },
      { old: 'hr.delegations.manage_all', new: 'ressources_humaines.delegations.gerer_toutes' },

      // ==================== MON ÉQUIPE ====================
      { old: 'manager.team_attendance.view_page', new: 'mon_equipe.pointages_equipe.voir' },
      { old: 'manager.team_attendance.delete', new: 'mon_equipe.pointages_equipe.supprimer' },
      { old: 'manager.team_requests.view_page', new: 'mon_equipe.demandes_equipe.voir' },
      { old: 'manager.team_requests.approve', new: 'mon_equipe.demandes_equipe.approuver' },
      { old: 'manager.team_requests.reject', new: 'mon_equipe.demandes_equipe.rejeter' },

      // ==================== MON ESPACE RH ====================
      { old: 'employee.clocking.view_page', new: 'mon_espace_rh.mon_pointage.voir' },
      { old: 'employee.clocking.clock', new: 'mon_espace_rh.mon_pointage.pointer' },
      { old: 'employee.attendance.view_page', new: 'mon_espace_rh.mon_pointage.voir' },
      { old: 'employee.attendance.clock', new: 'mon_espace_rh.mon_pointage.pointer' },
      { old: 'employee.requests.view_page', new: 'mon_espace_rh.mes_demandes.voir' },
      { old: 'employee.requests.create', new: 'mon_espace_rh.mes_demandes.creer' },
      { old: 'employee.requests.cancel', new: 'mon_espace_rh.mes_demandes.annuler' },
      { old: 'employee.payslips.view_page', new: 'mon_espace_rh.mes_bulletins.voir' },
      { old: 'employee.payslips.download', new: 'mon_espace_rh.mes_bulletins.telecharger' },

      // ==================== COMMERCIALISATION ====================
      // (déjà en français, pas de renommage nécessaire)
    ];

    let updatedCount = 0;
    let skippedCount = 0;

    console.log(`Processing ${permissionMappings.length} permission mappings...`);

    for (const mapping of permissionMappings) {
      // Vérifier si l'ancien code existe
      const checkResult = await client.query(
        'SELECT id, code FROM permissions WHERE code = $1',
        [mapping.old]
      );

      if (checkResult.rows.length > 0) {
        // Vérifier si le nouveau code n'existe pas déjà (éviter les doublons)
        const newExists = await client.query(
          'SELECT id FROM permissions WHERE code = $1',
          [mapping.new]
        );

        if (newExists.rows.length === 0) {
          // Renommer la permission
          await client.query(
            'UPDATE permissions SET code = $1 WHERE code = $2',
            [mapping.new, mapping.old]
          );
          console.log(`✅ Renamed: ${mapping.old} → ${mapping.new}`);
          updatedCount++;
        } else {
          console.log(`⚠️ Skipped (new code already exists): ${mapping.old} → ${mapping.new}`);
          skippedCount++;
        }
      } else {
        // L'ancien code n'existe pas, vérifier si le nouveau existe déjà
        const newExists = await client.query(
          'SELECT id FROM permissions WHERE code = $1',
          [mapping.new]
        );
        if (newExists.rows.length > 0) {
          console.log(`ℹ️ Already migrated: ${mapping.new}`);
        }
      }
    }

    // Mettre à jour les colonnes module/menu si elles existent
    console.log('\nUpdating module/menu columns for renamed permissions...');
    await client.query(`
      UPDATE permissions
      SET
        module = split_part(code, '.', 1),
        menu = CASE
          WHEN array_length(string_to_array(code, '.'), 1) > 2
          THEN split_part(code, '.', 2)
          ELSE split_part(code, '.', 2)
        END
      WHERE code LIKE 'gestion_comptable.%'
         OR code LIKE 'formation.%'
         OR code LIKE 'ressources_humaines.%'
         OR code LIKE 'mon_equipe.%'
         OR code LIKE 'mon_espace_rh.%'
    `);

    await client.query('COMMIT');

    console.log('\n=== Migration 110 terminée ===');
    console.log(`✅ Permissions renommées: ${updatedCount}`);
    console.log(`⚠️ Permissions ignorées (déjà migrées): ${skippedCount}`);

    res.json({
      success: true,
      message: 'Migration 110 exécutée avec succès',
      stats: {
        renamed: updatedCount,
        skipped: skippedCount
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur Migration 110:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
    await pool.end();
  }
});

export default router;
