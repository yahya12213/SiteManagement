/**
 * Migration 064: Update permission labels and descriptions in French
 * Updates existing permissions with clearer French labels and helpful descriptions
 * SAFE: Does NOT modify permission codes, only updates display text
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// Complete list of permissions with French labels and descriptions
const permissionUpdates = [
  // ========== ACCOUNTING MODULE ==========
  // Dashboard
  { code: 'accounting.dashboard.view_page', label: 'Voir le tableau de bord', description: 'Permet d\'accéder au tableau de bord principal avec les statistiques générales' },

  // Segments
  { code: 'accounting.segments.view_page', label: 'Voir la page des segments', description: 'Permet d\'accéder à la liste des segments de formation' },
  { code: 'accounting.segments.create', label: 'Créer un segment', description: 'Permet de créer un nouveau segment de formation' },
  { code: 'accounting.segments.update', label: 'Modifier un segment', description: 'Permet de modifier les informations d\'un segment existant' },
  { code: 'accounting.segments.delete', label: 'Supprimer un segment', description: 'Permet de supprimer définitivement un segment' },

  // Cities
  { code: 'accounting.cities.view_page', label: 'Voir la page des villes', description: 'Permet d\'accéder à la liste des villes' },
  { code: 'accounting.cities.create', label: 'Créer une ville', description: 'Permet d\'ajouter une nouvelle ville au système' },
  { code: 'accounting.cities.update', label: 'Modifier une ville', description: 'Permet de modifier les informations d\'une ville' },
  { code: 'accounting.cities.delete', label: 'Supprimer une ville', description: 'Permet de supprimer une ville du système' },
  { code: 'accounting.cities.bulk_delete', label: 'Suppression en masse', description: 'Permet de supprimer plusieurs villes en une seule action' },

  // Users
  { code: 'accounting.users.view_page', label: 'Voir la page des utilisateurs', description: 'Permet d\'accéder à la liste des utilisateurs du système' },
  { code: 'accounting.users.create', label: 'Créer un utilisateur', description: 'Permet de créer un nouveau compte utilisateur' },
  { code: 'accounting.users.update', label: 'Modifier un utilisateur', description: 'Permet de modifier les informations d\'un utilisateur' },
  { code: 'accounting.users.delete', label: 'Supprimer un utilisateur', description: 'Permet de supprimer un compte utilisateur' },
  { code: 'accounting.users.assign_segments', label: 'Assigner des segments', description: 'Permet d\'attribuer des segments à un utilisateur pour limiter son accès' },
  { code: 'accounting.users.assign_cities', label: 'Assigner des villes', description: 'Permet d\'attribuer des villes à un utilisateur pour limiter son accès' },

  // Calculation Sheets
  { code: 'accounting.calculation_sheets.view_page', label: 'Voir la page des fiches', description: 'Permet d\'accéder à la liste des fiches de calcul' },
  { code: 'accounting.calculation_sheets.view', label: 'Voir les détails', description: 'Permet de consulter le contenu d\'une fiche de calcul' },
  { code: 'accounting.calculation_sheets.create', label: 'Créer une fiche', description: 'Permet de créer une nouvelle fiche de calcul' },
  { code: 'accounting.calculation_sheets.update', label: 'Modifier une fiche', description: 'Permet de modifier les métadonnées d\'une fiche' },
  { code: 'accounting.calculation_sheets.edit', label: 'Éditer le contenu', description: 'Permet d\'éditer les cellules et formules de la fiche' },
  { code: 'accounting.calculation_sheets.delete', label: 'Supprimer une fiche', description: 'Permet de supprimer définitivement une fiche de calcul' },
  { code: 'accounting.calculation_sheets.publish', label: 'Publier une fiche', description: 'Permet de publier une fiche pour qu\'elle soit accessible aux professeurs' },
  { code: 'accounting.calculation_sheets.duplicate', label: 'Dupliquer une fiche', description: 'Permet de créer une copie d\'une fiche existante' },
  { code: 'accounting.calculation_sheets.export', label: 'Exporter une fiche', description: 'Permet d\'exporter les données au format Excel' },
  { code: 'accounting.calculation_sheets.settings', label: 'Paramètres de fiche', description: 'Permet de modifier les paramètres avancés d\'une fiche' },

  // Declarations
  { code: 'accounting.declarations.view_page', label: 'Voir la page des déclarations', description: 'Permet d\'accéder à la liste des déclarations' },
  { code: 'accounting.declarations.view_all', label: 'Voir toutes les déclarations', description: 'Permet de voir les déclarations de tous les utilisateurs' },
  { code: 'accounting.declarations.create', label: 'Créer une déclaration', description: 'Permet de créer une nouvelle déclaration' },
  { code: 'accounting.declarations.fill_data', label: 'Remplir les données', description: 'Permet de saisir les données dans une déclaration' },
  { code: 'accounting.declarations.edit_metadata', label: 'Modifier les métadonnées', description: 'Permet de modifier les informations générales de la déclaration' },
  { code: 'accounting.declarations.delete', label: 'Supprimer une déclaration', description: 'Permet de supprimer définitivement une déclaration' },
  { code: 'accounting.declarations.submit', label: 'Soumettre une déclaration', description: 'Permet de soumettre une déclaration pour approbation' },
  { code: 'accounting.declarations.approve', label: 'Approuver une déclaration', description: 'Permet d\'approuver une déclaration soumise' },
  { code: 'accounting.declarations.reject', label: 'Rejeter une déclaration', description: 'Permet de rejeter une déclaration avec un commentaire' },

  // Professor declarations
  { code: 'accounting.professor.declarations.view_page', label: 'Voir mes déclarations', description: 'Permet d\'accéder à ses propres déclarations' },
  { code: 'accounting.professor.declarations.fill', label: 'Remplir ma déclaration', description: 'Permet de saisir les données dans sa propre déclaration' },

  // Projects
  { code: 'accounting.projects.view_page', label: 'Voir la page des projets', description: 'Permet d\'accéder à la liste des projets' },
  { code: 'accounting.projects.create', label: 'Créer un projet', description: 'Permet de créer un nouveau projet' },
  { code: 'accounting.projects.update', label: 'Modifier un projet', description: 'Permet de modifier les informations d\'un projet' },
  { code: 'accounting.projects.delete', label: 'Supprimer un projet', description: 'Permet de supprimer un projet' },
  { code: 'accounting.projects.export', label: 'Exporter les projets', description: 'Permet d\'exporter la liste des projets' },

  // Actions
  { code: 'accounting.actions.view_page', label: 'Voir la page des actions', description: 'Permet d\'accéder à la liste des actions de projet' },
  { code: 'accounting.actions.create', label: 'Créer une action', description: 'Permet de créer une nouvelle action de projet' },
  { code: 'accounting.actions.update', label: 'Modifier une action', description: 'Permet de modifier une action de projet' },
  { code: 'accounting.actions.delete', label: 'Supprimer une action', description: 'Permet de supprimer une action de projet' },

  // ========== SYSTEM MODULE ==========
  { code: 'system.roles.view_page', label: 'Voir la page des rôles', description: 'Permet d\'accéder à la gestion des rôles et permissions' },
  { code: 'system.roles.create', label: 'Créer un rôle', description: 'Permet de créer un nouveau rôle avec des permissions personnalisées' },
  { code: 'system.roles.update', label: 'Modifier un rôle', description: 'Permet de modifier les permissions d\'un rôle existant' },
  { code: 'system.roles.delete', label: 'Supprimer un rôle', description: 'Permet de supprimer un rôle (si aucun utilisateur n\'y est assigné)' },

  // ========== TRAINING MODULE ==========
  // Formations
  { code: 'training.formations.view_page', label: 'Voir la page des formations', description: 'Permet d\'accéder à la liste des formations' },
  { code: 'training.formations.create', label: 'Créer une formation', description: 'Permet de créer une nouvelle formation' },
  { code: 'training.formations.update', label: 'Modifier une formation', description: 'Permet de modifier les informations d\'une formation' },
  { code: 'training.formations.delete', label: 'Supprimer une formation', description: 'Permet de supprimer une formation et son contenu' },
  { code: 'training.formations.duplicate', label: 'Dupliquer une formation', description: 'Permet de créer une copie d\'une formation existante' },
  { code: 'training.formations.create_pack', label: 'Créer un pack', description: 'Permet de regrouper plusieurs formations en un pack' },
  { code: 'training.formations.edit_content', label: 'Éditer le contenu', description: 'Permet d\'ajouter ou modifier des modules, vidéos et tests' },

  // Corps
  { code: 'training.corps.view_page', label: 'Voir les corps de formation', description: 'Permet de voir les catégories de formations' },
  { code: 'training.corps.create', label: 'Créer un corps', description: 'Permet de créer une nouvelle catégorie de formations' },
  { code: 'training.corps.update', label: 'Modifier un corps', description: 'Permet de modifier une catégorie de formations' },
  { code: 'training.corps.delete', label: 'Supprimer un corps', description: 'Permet de supprimer une catégorie (formations incluses)' },
  { code: 'training.corps.duplicate', label: 'Dupliquer un corps', description: 'Permet de dupliquer une catégorie avec ses formations' },

  // Centres
  { code: 'training.centres.view_page', label: 'Voir la page des centres', description: 'Permet d\'accéder à la liste des centres de formation' },
  { code: 'training.centres.create', label: 'Créer un centre', description: 'Permet de créer un nouveau centre de formation' },
  { code: 'training.centres.update', label: 'Modifier un centre', description: 'Permet de modifier les informations d\'un centre' },
  { code: 'training.centres.delete', label: 'Supprimer un centre', description: 'Permet de supprimer un centre de formation' },

  // Sessions
  { code: 'training.sessions.view_page', label: 'Voir la page des sessions', description: 'Permet d\'accéder à la liste des sessions de formation' },
  { code: 'training.sessions.create', label: 'Créer une session', description: 'Permet de créer une nouvelle session de formation' },
  { code: 'training.sessions.update', label: 'Modifier une session', description: 'Permet de modifier les informations d\'une session' },
  { code: 'training.sessions.delete', label: 'Supprimer une session', description: 'Permet de supprimer une session et ses inscriptions' },
  { code: 'training.sessions.add_student', label: 'Ajouter un étudiant', description: 'Permet d\'inscrire un étudiant à une session' },
  { code: 'training.sessions.edit_student', label: 'Modifier un étudiant', description: 'Permet de modifier l\'inscription d\'un étudiant' },

  // Students
  { code: 'training.students.view_page', label: 'Voir la page des étudiants', description: 'Permet d\'accéder à la liste des étudiants' },
  { code: 'training.students.create', label: 'Créer un étudiant', description: 'Permet de créer un nouveau profil étudiant' },
  { code: 'training.students.update', label: 'Modifier un étudiant', description: 'Permet de modifier les informations d\'un étudiant' },
  { code: 'training.students.delete', label: 'Supprimer un étudiant', description: 'Permet de supprimer un profil étudiant' },

  // Analytics
  { code: 'training.analytics.view_page', label: 'Voir la page analytics', description: 'Permet d\'accéder aux statistiques de formation' },
  { code: 'training.analytics.export', label: 'Exporter les analytics', description: 'Permet d\'exporter les statistiques au format Excel' },

  // Student reports
  { code: 'training.student_reports.view_page', label: 'Voir les rapports étudiants', description: 'Permet d\'accéder aux rapports de progression des étudiants' },
  { code: 'training.student_reports.export', label: 'Exporter les rapports', description: 'Permet d\'exporter les rapports étudiants' },

  // Certificates
  { code: 'training.certificates.view_page', label: 'Voir la page des certificats', description: 'Permet d\'accéder à la liste des certificats générés' },
  { code: 'training.certificates.view', label: 'Voir un certificat', description: 'Permet de visualiser un certificat spécifique' },
  { code: 'training.certificates.generate', label: 'Générer un certificat', description: 'Permet de générer un certificat pour un étudiant' },
  { code: 'training.certificates.update', label: 'Modifier un certificat', description: 'Permet de modifier les informations d\'un certificat' },
  { code: 'training.certificates.download', label: 'Télécharger un certificat', description: 'Permet de télécharger le PDF du certificat' },
  { code: 'training.certificates.delete', label: 'Supprimer un certificat', description: 'Permet de révoquer ou supprimer un certificat' },

  // Certificate templates
  { code: 'training.certificate_templates.view_page', label: 'Voir la page des templates', description: 'Permet d\'accéder à la liste des modèles de certificats' },
  { code: 'training.certificate_templates.view', label: 'Voir un template', description: 'Permet de visualiser un modèle de certificat' },
  { code: 'training.certificate_templates.create', label: 'Créer un template', description: 'Permet de créer un nouveau modèle de certificat' },
  { code: 'training.certificate_templates.create_folder', label: 'Créer un dossier', description: 'Permet de créer un dossier pour organiser les templates' },
  { code: 'training.certificate_templates.create_template', label: 'Créer un modèle', description: 'Permet de créer un nouveau modèle dans un dossier' },
  { code: 'training.certificate_templates.update', label: 'Modifier un template', description: 'Permet de modifier un modèle de certificat' },
  { code: 'training.certificate_templates.rename_folder', label: 'Renommer un dossier', description: 'Permet de renommer un dossier de templates' },
  { code: 'training.certificate_templates.rename_template', label: 'Renommer un template', description: 'Permet de renommer un modèle de certificat' },
  { code: 'training.certificate_templates.delete_folder', label: 'Supprimer un dossier', description: 'Permet de supprimer un dossier de templates' },
  { code: 'training.certificate_templates.delete_template', label: 'Supprimer un template', description: 'Permet de supprimer un modèle de certificat' },
  { code: 'training.certificate_templates.duplicate', label: 'Dupliquer un template', description: 'Permet de créer une copie d\'un modèle' },
  { code: 'training.certificate_templates.edit_canvas', label: 'Éditer le design', description: 'Permet d\'utiliser l\'éditeur visuel pour personnaliser le certificat' },
  { code: 'training.certificate_templates.organize', label: 'Organiser les templates', description: 'Permet de déplacer les templates entre dossiers' },

  // Forums
  { code: 'training.forums.view_page', label: 'Voir la page des forums', description: 'Permet d\'accéder à la modération des forums' },
  { code: 'training.forums.view', label: 'Voir les discussions', description: 'Permet de lire les discussions des forums' },
  { code: 'training.forums.create_thread', label: 'Créer une discussion', description: 'Permet de créer une nouvelle discussion' },
  { code: 'training.forums.update_thread', label: 'Modifier une discussion', description: 'Permet de modifier une discussion existante' },
  { code: 'training.forums.reply', label: 'Répondre', description: 'Permet de répondre aux discussions' },
  { code: 'training.forums.react', label: 'Réagir', description: 'Permet de réagir aux messages (like, etc.)' },
  { code: 'training.forums.delete', label: 'Supprimer', description: 'Permet de supprimer des messages ou discussions' },
  { code: 'training.forums.manage', label: 'Gérer les forums', description: 'Permet d\'épingler ou verrouiller des discussions' },
  { code: 'training.forums.moderate', label: 'Modérer', description: 'Permet de modérer le contenu des forums' },

  // Student portal
  { code: 'training.student.dashboard.view_page', label: 'Voir le tableau de bord étudiant', description: 'Permet d\'accéder au dashboard étudiant' },
  { code: 'training.student.catalog.view_page', label: 'Voir le catalogue', description: 'Permet de consulter le catalogue des formations' },
  { code: 'training.student.course.view', label: 'Voir un cours', description: 'Permet d\'accéder au contenu d\'une formation' },
  { code: 'training.student.course.videos.view', label: 'Voir les vidéos', description: 'Permet de regarder les vidéos de formation' },
  { code: 'training.student.course.tests.take', label: 'Passer les tests', description: 'Permet de passer les examens et quiz' },
  { code: 'training.student.certificates.view', label: 'Voir mes certificats', description: 'Permet de consulter ses propres certificats' },
  { code: 'training.student.forums.participate', label: 'Participer aux forums', description: 'Permet de participer aux discussions des forums' },

  // ========== HR MODULE ==========
  // Clocking
  { code: 'hr.clocking.self', label: 'Pointer soi-même', description: 'Permet d\'enregistrer ses propres entrées et sorties' },

  // Employees
  { code: 'hr.employees.view_page', label: 'Voir la page des employés', description: 'Permet d\'accéder aux dossiers des employés' },
  { code: 'hr.employees.create', label: 'Créer un employé', description: 'Permet de créer un nouveau dossier employé' },
  { code: 'hr.employees.update', label: 'Modifier un employé', description: 'Permet de modifier les informations d\'un employé' },
  { code: 'hr.employees.delete', label: 'Supprimer un employé', description: 'Permet de supprimer un dossier employé' },
  { code: 'hr.employees.view_salary', label: 'Voir le salaire', description: 'Permet de consulter les informations salariales confidentielles' },

  // HR contracts, documents, discipline
  { code: 'hr.contracts.manage', label: 'Gérer les contrats', description: 'Permet de gérer les contrats de travail des employés' },
  { code: 'hr.documents.manage', label: 'Gérer les documents', description: 'Permet de gérer les documents RH des employés' },
  { code: 'hr.discipline.manage', label: 'Gérer la discipline', description: 'Permet de gérer les dossiers disciplinaires' },

  // Attendance
  { code: 'hr.attendance.view_page', label: 'Voir la page de présence', description: 'Permet d\'accéder aux enregistrements de présence' },
  { code: 'hr.attendance.view_all', label: 'Voir toutes les présences', description: 'Permet de voir les pointages de tous les employés' },
  { code: 'hr.attendance.edit', label: 'Modifier les présences', description: 'Permet de corriger les enregistrements de présence' },
  { code: 'hr.attendance.edit_anomalies', label: 'Traiter les anomalies', description: 'Permet de résoudre les anomalies de pointage' },
  { code: 'hr.attendance.correct_records', label: 'Corriger les enregistrements', description: 'Permet de corriger manuellement les pointages' },
  { code: 'hr.attendance.import_records', label: 'Importer les présences', description: 'Permet d\'importer des données de pointage' },
  { code: 'hr.attendance.record', label: 'Enregistrer une présence', description: 'Permet d\'enregistrer manuellement une présence' },
  { code: 'hr.attendance.validate', label: 'Valider les présences', description: 'Permet de valider les pointages du mois' },
  { code: 'hr.attendance.export', label: 'Exporter les présences', description: 'Permet d\'exporter les données de présence' },

  // Overtime
  { code: 'hr.overtime.view_page', label: 'Voir les heures supplémentaires', description: 'Permet d\'accéder aux demandes d\'heures supplémentaires' },
  { code: 'hr.overtime.request', label: 'Demander des heures sup', description: 'Permet de soumettre une demande d\'heures supplémentaires' },
  { code: 'hr.overtime.approve', label: 'Approuver les heures sup', description: 'Permet d\'approuver les demandes d\'heures supplémentaires' },
  { code: 'hr.overtime.validate_payroll', label: 'Valider pour la paie', description: 'Permet de valider les heures sup pour le calcul de paie' },
  { code: 'hr.overtime.view_reports', label: 'Voir les rapports', description: 'Permet de consulter les rapports d\'heures supplémentaires' },

  // Leaves
  { code: 'hr.leaves.view_page', label: 'Voir la page des congés', description: 'Permet d\'accéder aux demandes de congés' },
  { code: 'hr.leaves.request', label: 'Demander un congé', description: 'Permet de soumettre une demande de congé' },
  { code: 'hr.leaves.approve', label: 'Approuver un congé', description: 'Permet d\'approuver les demandes de congés' },
  { code: 'hr.leaves.approve_n1', label: 'Approuver (N+1)', description: 'Permet au manager direct d\'approuver les congés' },
  { code: 'hr.leaves.approve_n2', label: 'Approuver (N+2)', description: 'Permet au manager supérieur d\'approuver les congés' },
  { code: 'hr.leaves.approve_hr', label: 'Approuver (RH)', description: 'Permet aux RH de valider définitivement les congés' },
  { code: 'hr.leaves.manage_balances', label: 'Gérer les soldes', description: 'Permet de modifier les soldes de congés des employés' },
  { code: 'hr.leaves.view_calendar', label: 'Voir le calendrier', description: 'Permet de consulter le calendrier des congés' },
  { code: 'hr.leaves.export', label: 'Exporter les congés', description: 'Permet d\'exporter les données de congés' },

  // Holidays
  { code: 'hr.holidays.manage', label: 'Gérer les jours fériés', description: 'Permet de définir les jours fériés de l\'entreprise' },

  // HR Dashboard
  { code: 'hr.dashboard.view_page', label: 'Voir le tableau de bord RH', description: 'Permet d\'accéder aux statistiques RH' },
  { code: 'hr.dashboard.export', label: 'Exporter le dashboard', description: 'Permet d\'exporter les données du tableau de bord' },
  { code: 'hr.dashboard.export_reports', label: 'Exporter les rapports', description: 'Permet d\'exporter les rapports RH détaillés' },
  { code: 'hr.dashboard.view_monthly_reports', label: 'Voir les rapports mensuels', description: 'Permet de consulter les synthèses mensuelles' },
  { code: 'hr.dashboard.generate_payroll_summary', label: 'Générer le résumé de paie', description: 'Permet de générer un résumé pour la paie' },
  { code: 'hr.dashboard.export_payroll', label: 'Exporter la paie', description: 'Permet d\'exporter les données de paie' },
  { code: 'hr.dashboard.view_alerts', label: 'Voir les alertes', description: 'Permet de consulter les alertes RH' },

  // Monthly summary
  { code: 'hr.monthly_summary.view', label: 'Voir le résumé mensuel', description: 'Permet de consulter le résumé mensuel des présences' },
  { code: 'hr.monthly_summary.validate', label: 'Valider le résumé', description: 'Permet de valider le résumé mensuel' },
  { code: 'hr.monthly_summary.export', label: 'Exporter le résumé', description: 'Permet d\'exporter le résumé mensuel' },

  // HR Settings
  { code: 'hr.settings.view_page', label: 'Voir les paramètres RH', description: 'Permet d\'accéder aux paramètres du module RH' },
  { code: 'hr.settings.manage', label: 'Gérer les paramètres', description: 'Permet de modifier les paramètres RH généraux' },
  { code: 'hr.settings.manage_schedules', label: 'Gérer les horaires', description: 'Permet de configurer les modèles d\'horaires' },
  { code: 'hr.settings.manage_leave_rules', label: 'Gérer les règles de congés', description: 'Permet de configurer les règles d\'attribution des congés' },
  { code: 'hr.settings.manage_workflows', label: 'Gérer les workflows', description: 'Permet de configurer les workflows de validation' },
  { code: 'hr.settings.update', label: 'Modifier les paramètres', description: 'Permet de sauvegarder les modifications des paramètres' },

  // Validation workflows
  { code: 'hr.validation_workflows.view_page', label: 'Voir les boucles de validation', description: 'Permet d\'accéder à la gestion des workflows de validation' },
  { code: 'hr.validation_workflows.create', label: 'Créer une boucle', description: 'Permet de créer un nouveau workflow de validation' },
  { code: 'hr.validation_workflows.update', label: 'Modifier une boucle', description: 'Permet de modifier les étapes d\'un workflow' },
  { code: 'hr.validation_workflows.delete', label: 'Supprimer une boucle', description: 'Permet de supprimer un workflow de validation' },

  // Schedules
  { code: 'hr.schedules.view_page', label: 'Voir la page des horaires', description: 'Permet d\'accéder à la gestion des plannings' },
  { code: 'hr.schedules.manage_models', label: 'Gérer les modèles', description: 'Permet de créer et modifier des modèles d\'horaires' },
  { code: 'hr.schedules.manage_holidays', label: 'Gérer les jours fériés', description: 'Permet de définir les jours fériés dans le planning' },
  { code: 'hr.schedules.view_validated_leaves', label: 'Voir les congés validés', description: 'Permet de consulter le calendrier des congés approuvés' },
  { code: 'hr.schedules.manage_overtime', label: 'Gérer les heures sup', description: 'Permet de gérer les demandes d\'heures supplémentaires' },

  // Payroll
  { code: 'hr.payroll.view_page', label: 'Voir la page de paie', description: 'Permet d\'accéder au module de gestion de la paie' },
  { code: 'hr.payroll.manage_periods', label: 'Gérer les périodes', description: 'Permet de créer et clôturer des périodes de paie' },
  { code: 'hr.payroll.calculate', label: 'Calculer la paie', description: 'Permet de lancer le calcul des salaires' },
  { code: 'hr.payroll.view_payslips', label: 'Voir les fiches de paie', description: 'Permet de consulter les bulletins de salaire' },
  { code: 'hr.payroll.generate_payslips', label: 'Générer les fiches', description: 'Permet de générer les bulletins de salaire PDF' },
  { code: 'hr.payroll.view_tests', label: 'Voir les tests', description: 'Permet de tester les calculs de paie' },
  { code: 'hr.payroll.manage_automation', label: 'Gérer l\'automatisation', description: 'Permet de configurer l\'automatisation de la paie' },
  { code: 'hr.payroll.manage_config', label: 'Configurer la paie', description: 'Permet de configurer les règles de calcul de paie' },

  // Employee portal
  { code: 'hr.employee_portal.view_page', label: 'Voir le portail employé', description: 'Permet d\'accéder au portail libre-service employé' },
  { code: 'hr.employee_portal.clock_in_out', label: 'Pointer', description: 'Permet d\'enregistrer ses entrées et sorties' },
  { code: 'hr.employee_portal.submit_requests', label: 'Soumettre des demandes', description: 'Permet de faire des demandes de congés ou absences' },
  { code: 'hr.employee_portal.view_history', label: 'Voir l\'historique', description: 'Permet de consulter l\'historique de ses pointages' },

  // Requests validation
  { code: 'hr.requests_validation.view_page', label: 'Voir les demandes à valider', description: 'Permet d\'accéder aux demandes en attente de validation' },
  { code: 'hr.requests_validation.approve', label: 'Approuver une demande', description: 'Permet d\'approuver les demandes de congés ou absences' },
  { code: 'hr.requests_validation.reject', label: 'Rejeter une demande', description: 'Permet de rejeter une demande avec un motif' },

  // ========== COMMERCIALISATION MODULE ==========
  // Dashboard
  { code: 'commercialisation.dashboard.view_page', label: 'Voir le tableau de bord commercial', description: 'Permet d\'accéder aux statistiques commerciales' },
  { code: 'commercialisation.dashboard.view_stats', label: 'Voir les statistiques', description: 'Permet de consulter les KPIs commerciaux' },
  { code: 'commercialisation.dashboard.export', label: 'Exporter le dashboard', description: 'Permet d\'exporter les statistiques commerciales' },

  // Clients
  { code: 'commercialisation.clients.view_page', label: 'Voir la page des clients', description: 'Permet d\'accéder à la liste des clients' },
  { code: 'commercialisation.clients.view', label: 'Voir un client', description: 'Permet de consulter la fiche d\'un client' },
  { code: 'commercialisation.clients.create', label: 'Créer un client', description: 'Permet de créer une nouvelle fiche client' },
  { code: 'commercialisation.clients.edit', label: 'Modifier un client', description: 'Permet de modifier les informations d\'un client' },
  { code: 'commercialisation.clients.delete', label: 'Supprimer un client', description: 'Permet de supprimer un client' },
  { code: 'commercialisation.clients.export', label: 'Exporter les clients', description: 'Permet d\'exporter la liste des clients' },

  // Prospects
  { code: 'commercialisation.prospects.view_page', label: 'Voir la page des prospects', description: 'Permet d\'accéder à la liste des prospects' },
  { code: 'commercialisation.prospects.view', label: 'Voir un prospect', description: 'Permet de consulter la fiche d\'un prospect' },
  { code: 'commercialisation.prospects.view_all', label: 'Voir tous les prospects', description: 'Permet de voir les prospects de tous les commerciaux' },
  { code: 'commercialisation.prospects.create', label: 'Créer un prospect', description: 'Permet d\'ajouter un nouveau prospect' },
  { code: 'commercialisation.prospects.edit', label: 'Modifier un prospect', description: 'Permet de modifier les informations d\'un prospect' },
  { code: 'commercialisation.prospects.call', label: 'Appeler un prospect', description: 'Permet d\'enregistrer un appel téléphonique' },
  { code: 'commercialisation.prospects.update', label: 'Mettre à jour un prospect', description: 'Permet de mettre à jour le statut d\'un prospect' },
  { code: 'commercialisation.prospects.delete', label: 'Supprimer un prospect', description: 'Permet de supprimer un prospect' },
  { code: 'commercialisation.prospects.convert', label: 'Convertir en client', description: 'Permet de transformer un prospect en client' },
  { code: 'commercialisation.prospects.import', label: 'Importer des prospects', description: 'Permet d\'importer des prospects depuis un fichier' },
  { code: 'commercialisation.prospects.export', label: 'Exporter les prospects', description: 'Permet d\'exporter la liste des prospects' },
  { code: 'commercialisation.prospects.assign', label: 'Assigner un prospect', description: 'Permet d\'attribuer un prospect à un commercial' },
  { code: 'commercialisation.prospects.reinject', label: 'Réinjecter un prospect', description: 'Permet de remettre un prospect dans le pool' },
  { code: 'commercialisation.prospects.clean', label: 'Nettoyer les prospects', description: 'Permet de supprimer les prospects obsolètes ou doublons' },

  // Devis
  { code: 'commercialisation.devis.view_page', label: 'Voir la page des devis', description: 'Permet d\'accéder à la liste des devis' },
  { code: 'commercialisation.devis.view', label: 'Voir un devis', description: 'Permet de consulter un devis' },
  { code: 'commercialisation.devis.create', label: 'Créer un devis', description: 'Permet de créer un nouveau devis' },
  { code: 'commercialisation.devis.edit', label: 'Modifier un devis', description: 'Permet de modifier un devis existant' },
  { code: 'commercialisation.devis.delete', label: 'Supprimer un devis', description: 'Permet de supprimer un devis' },
  { code: 'commercialisation.devis.validate', label: 'Valider un devis', description: 'Permet de valider un devis pour envoi' },
  { code: 'commercialisation.devis.send', label: 'Envoyer un devis', description: 'Permet d\'envoyer le devis au client' },
  { code: 'commercialisation.devis.export', label: 'Exporter les devis', description: 'Permet d\'exporter la liste des devis' },

  // Contrats
  { code: 'commercialisation.contrats.view_page', label: 'Voir la page des contrats', description: 'Permet d\'accéder à la liste des contrats' },
  { code: 'commercialisation.contrats.view', label: 'Voir un contrat', description: 'Permet de consulter un contrat' },
  { code: 'commercialisation.contrats.create', label: 'Créer un contrat', description: 'Permet de créer un nouveau contrat' },
  { code: 'commercialisation.contrats.edit', label: 'Modifier un contrat', description: 'Permet de modifier un contrat' },
  { code: 'commercialisation.contrats.delete', label: 'Supprimer un contrat', description: 'Permet de supprimer un contrat' },
  { code: 'commercialisation.contrats.sign', label: 'Signer un contrat', description: 'Permet de marquer un contrat comme signé' },
  { code: 'commercialisation.contrats.archive', label: 'Archiver un contrat', description: 'Permet d\'archiver un contrat terminé' },
  { code: 'commercialisation.contrats.export', label: 'Exporter les contrats', description: 'Permet d\'exporter la liste des contrats' },
];

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    let updatedCount = 0;
    let skippedCount = 0;

    for (const perm of permissionUpdates) {
      const result = await client.query(`
        UPDATE permissions
        SET label = $1, description = $2
        WHERE code = $3
      `, [perm.label, perm.description, perm.code]);

      if (result.rowCount > 0) {
        updatedCount++;
      } else {
        skippedCount++;
        console.log(`⚠️ Permission not found: ${perm.code}`);
      }
    }

    await client.query('COMMIT');

    console.log(`✅ Migration 064 completed: ${updatedCount} permissions updated, ${skippedCount} skipped`);

    res.json({
      success: true,
      message: 'Migration 064 completed successfully',
      stats: {
        updated: updatedCount,
        skipped: skippedCount,
        total: permissionUpdates.length
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 064 error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Check migration status
router.get('/status', async (req, res) => {
  try {
    // Check if permissions have descriptions
    const result = await pool.query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN description IS NOT NULL AND description != '' THEN 1 END) as with_description
      FROM permissions
    `);

    const { total, with_description } = result.rows[0];
    const percentComplete = total > 0 ? Math.round((with_description / total) * 100) : 0;

    res.json({
      status: {
        migrationNeeded: percentComplete < 90,
        applied: percentComplete >= 90,
        percentComplete,
        permissionsWithDescription: parseInt(with_description),
        totalPermissions: parseInt(total)
      },
      message: percentComplete >= 90
        ? 'Migration 064 already applied - most permissions have descriptions'
        : `Migration needed - only ${percentComplete}% of permissions have descriptions`
    });
  } catch (error) {
    res.status(500).json({
      status: {
        migrationNeeded: true,
        applied: false,
        error: error.message
      },
      message: `Error checking status: ${error.message}`
    });
  }
});

export default router;
