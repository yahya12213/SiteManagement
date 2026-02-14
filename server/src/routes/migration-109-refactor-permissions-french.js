import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 109: Refactorisation des permissions en francais
// Aligne les codes de permissions avec les noms des menus en francais
// Structure hierarchique: section.sous_menu.onglet?.action

// Helper to parse permission code into module, menu, action
function parsePermissionCode(code) {
  const parts = code.split('.');
  const module = parts[0] || '';
  const menu = parts.length > 2 ? parts.slice(1, -1).join('.') : (parts[1] || '');
  const action = parts[parts.length - 1] || '';
  return { module, menu, action };
}

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 109: Refactorisation des permissions en francais ===');

    // Step 1: Sauvegarder les associations role_permissions actuelles avec mapping
    console.log('Step 1: Sauvegarde des associations role_permissions...');
    await client.query(`
      CREATE TEMP TABLE IF NOT EXISTS temp_role_permissions_backup AS
      SELECT rp.role_id, p.code as permission_code
      FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
    `);

    // Step 2: Creation du mapping ancien -> nouveau
    console.log('Step 2: Creation du mapping des permissions...');
    await client.query(`
      CREATE TEMP TABLE IF NOT EXISTS permission_mapping (
        old_code TEXT PRIMARY KEY,
        new_code TEXT NOT NULL
      )
    `);

    // Mapping des anciennes permissions vers les nouvelles
    await client.query(`
      INSERT INTO permission_mapping (old_code, new_code) VALUES
      -- Gestion Comptable
      ('accounting.dashboard.view_page', 'gestion_comptable.tableau_de_bord.voir'),
      ('accounting.segments.view_page', 'gestion_comptable.segments.voir'),
      ('accounting.segments.create', 'gestion_comptable.segments.creer'),
      ('accounting.segments.update', 'gestion_comptable.segments.modifier'),
      ('accounting.segments.delete', 'gestion_comptable.segments.supprimer'),
      ('accounting.cities.view_page', 'gestion_comptable.villes.voir'),
      ('accounting.cities.create', 'gestion_comptable.villes.creer'),
      ('accounting.cities.update', 'gestion_comptable.villes.modifier'),
      ('accounting.cities.delete', 'gestion_comptable.villes.supprimer'),
      ('system.users.view_page', 'gestion_comptable.utilisateurs.voir'),
      ('system.users.create', 'gestion_comptable.utilisateurs.creer'),
      ('system.users.update', 'gestion_comptable.utilisateurs.modifier'),
      ('system.users.delete', 'gestion_comptable.utilisateurs.supprimer'),
      ('system.roles.view_page', 'gestion_comptable.roles_permissions.voir'),
      ('system.roles.create', 'gestion_comptable.roles_permissions.creer'),
      ('system.roles.update', 'gestion_comptable.roles_permissions.modifier'),
      ('system.roles.delete', 'gestion_comptable.roles_permissions.supprimer'),
      ('accounting.sheets.view_page', 'gestion_comptable.fiches_calcul.voir'),
      ('accounting.sheets.create', 'gestion_comptable.fiches_calcul.creer'),
      ('accounting.sheets.update', 'gestion_comptable.fiches_calcul.modifier'),
      ('accounting.sheets.delete', 'gestion_comptable.fiches_calcul.supprimer'),
      ('accounting.declarations.view_page', 'gestion_comptable.declarations.voir'),
      ('accounting.declarations.create', 'gestion_comptable.declarations.creer'),
      ('accounting.declarations.update', 'gestion_comptable.declarations.modifier_metadata'),
      ('accounting.declarations.delete', 'gestion_comptable.declarations.supprimer'),
      ('accounting.declarations.approve', 'gestion_comptable.declarations.approuver'),
      ('accounting.projects.view_page', 'gestion_comptable.gestion_projet.voir'),
      ('accounting.projects.create', 'gestion_comptable.gestion_projet.creer'),
      ('accounting.projects.update', 'gestion_comptable.gestion_projet.modifier'),
      ('accounting.projects.delete', 'gestion_comptable.gestion_projet.supprimer'),
      -- Formation
      ('training.formations.view_page', 'formation.gestion_formations.voir'),
      ('training.formations.create', 'formation.gestion_formations.creer'),
      ('training.formations.update', 'formation.gestion_formations.modifier'),
      ('training.formations.delete', 'formation.gestion_formations.supprimer'),
      ('training.sessions.view_page', 'formation.sessions_formation.voir'),
      ('training.sessions.create', 'formation.sessions_formation.creer'),
      ('training.sessions.update', 'formation.sessions_formation.modifier'),
      ('training.sessions.delete', 'formation.sessions_formation.supprimer'),
      ('training.analytics.view_page', 'formation.analytics.voir'),
      ('training.reports.view_page', 'formation.rapports_etudiants.voir'),
      ('training.students.view_page', 'formation.liste_etudiants.voir'),
      ('training.students.create', 'formation.liste_etudiants.creer'),
      ('training.students.update', 'formation.liste_etudiants.modifier'),
      ('training.students.delete', 'formation.liste_etudiants.supprimer'),
      ('training.certificates.view_page', 'formation.templates_certificats.voir'),
      ('training.forums.view_page', 'formation.forums.voir'),
      -- Ressources Humaines
      ('hr.workflows.view_page', 'ressources_humaines.boucles_validation.voir'),
      ('hr.workflows.create', 'ressources_humaines.boucles_validation.creer'),
      ('hr.workflows.update', 'ressources_humaines.boucles_validation.modifier'),
      ('hr.workflows.delete', 'ressources_humaines.boucles_validation.supprimer'),
      ('hr.schedules.view_page', 'ressources_humaines.gestion_horaires.voir'),
      ('hr.payroll.view_page', 'ressources_humaines.gestion_paie.voir'),
      ('hr.clocking.view_page', 'ressources_humaines.gestion_pointage.voir'),
      ('hr.employees.view_page', 'ressources_humaines.dossier_employe.voir'),
      ('hr.employees.create', 'ressources_humaines.dossier_employe.creer'),
      ('hr.employees.update', 'ressources_humaines.dossier_employe.modifier'),
      ('hr.employees.delete', 'ressources_humaines.dossier_employe.supprimer'),
      ('hr.requests.view_page', 'ressources_humaines.validation_demandes.voir'),
      ('hr.requests.approve', 'ressources_humaines.validation_demandes.approuver'),
      ('hr.delegation.view_page', 'ressources_humaines.delegations.voir'),
      ('hr.delegation.create', 'ressources_humaines.delegations.creer'),
      -- Mon Equipe
      ('manager.attendance.view_page', 'mon_equipe.pointages_equipe.voir'),
      ('manager.requests.view_page', 'mon_equipe.demandes_equipe.voir'),
      ('manager.requests.approve', 'mon_equipe.demandes_equipe.approuver'),
      -- Mon Espace RH
      ('employee.clocking.view_page', 'mon_espace_rh.mon_pointage.voir'),
      ('employee.requests.view_page', 'mon_espace_rh.mes_demandes.voir'),
      ('employee.requests.create', 'mon_espace_rh.mes_demandes.creer'),
      ('employee.payslips.view_page', 'mon_espace_rh.mes_bulletins.voir'),
      -- Commercialisation
      ('commercialisation.dashboard.view_page', 'commercialisation.tableau_de_bord.voir'),
      ('commercialisation.prospects.view_page', 'commercialisation.prospects.voir'),
      ('commercialisation.prospects.create', 'commercialisation.prospects.creer'),
      ('commercialisation.prospects.update', 'commercialisation.prospects.modifier'),
      ('commercialisation.prospects.delete', 'commercialisation.prospects.supprimer'),
      ('commercialisation.cleaning.view_page', 'commercialisation.nettoyage_prospects.voir'),
      ('commercialisation.gcontact.view_page', 'commercialisation.gestion_gcontacte.voir')
      ON CONFLICT (old_code) DO NOTHING
    `);

    // Step 3: Inserer toutes les nouvelles permissions
    console.log('Step 3: Insertion des nouvelles permissions en francais...');

    const newPermissions = [
      // ==================== GESTION COMPTABLE ====================
      { code: 'gestion_comptable.acces', label: 'Acces Gestion Comptable', description: 'Acces a la section Gestion Comptable' },
      // Tableau de bord
      { code: 'gestion_comptable.tableau_de_bord.voir', label: 'Voir Tableau de bord', description: 'Acces au tableau de bord comptable' },
      // Segments
      { code: 'gestion_comptable.segments.voir', label: 'Voir Segments', description: 'Voir la liste des segments' },
      { code: 'gestion_comptable.segments.creer', label: 'Creer Segment', description: 'Creer un nouveau segment' },
      { code: 'gestion_comptable.segments.modifier', label: 'Modifier Segment', description: 'Modifier un segment existant' },
      { code: 'gestion_comptable.segments.supprimer', label: 'Supprimer Segment', description: 'Supprimer un segment' },
      { code: 'gestion_comptable.segments.importer_villes', label: 'Importer Villes', description: 'Importer des villes dans un segment' },
      // Villes
      { code: 'gestion_comptable.villes.voir', label: 'Voir Villes', description: 'Voir la liste des villes' },
      { code: 'gestion_comptable.villes.creer', label: 'Creer Ville', description: 'Creer une nouvelle ville' },
      { code: 'gestion_comptable.villes.modifier', label: 'Modifier Ville', description: 'Modifier une ville existante' },
      { code: 'gestion_comptable.villes.supprimer', label: 'Supprimer Ville', description: 'Supprimer une ville' },
      { code: 'gestion_comptable.villes.supprimer_masse', label: 'Supprimer Villes en masse', description: 'Supprimer plusieurs villes' },
      // Utilisateurs
      { code: 'gestion_comptable.utilisateurs.voir', label: 'Voir Utilisateurs', description: 'Voir la liste des utilisateurs' },
      { code: 'gestion_comptable.utilisateurs.creer', label: 'Creer Utilisateur', description: 'Creer un nouvel utilisateur' },
      { code: 'gestion_comptable.utilisateurs.modifier', label: 'Modifier Utilisateur', description: 'Modifier un utilisateur' },
      { code: 'gestion_comptable.utilisateurs.supprimer', label: 'Supprimer Utilisateur', description: 'Supprimer un utilisateur' },
      { code: 'gestion_comptable.utilisateurs.assigner_segments', label: 'Assigner Segments', description: 'Assigner des segments aux utilisateurs' },
      { code: 'gestion_comptable.utilisateurs.assigner_villes', label: 'Assigner Villes', description: 'Assigner des villes aux utilisateurs' },
      { code: 'gestion_comptable.utilisateurs.assigner_roles', label: 'Assigner Roles', description: 'Assigner des roles aux utilisateurs' },
      // Roles & Permissions
      { code: 'gestion_comptable.roles_permissions.voir', label: 'Voir Roles & Permissions', description: 'Voir les roles et permissions' },
      { code: 'gestion_comptable.roles_permissions.creer', label: 'Creer Role', description: 'Creer un nouveau role' },
      { code: 'gestion_comptable.roles_permissions.modifier', label: 'Modifier Role', description: 'Modifier un role' },
      { code: 'gestion_comptable.roles_permissions.supprimer', label: 'Supprimer Role', description: 'Supprimer un role' },
      // Fiches de calcul
      { code: 'gestion_comptable.fiches_calcul.voir', label: 'Voir Fiches de calcul', description: 'Voir les fiches de calcul' },
      { code: 'gestion_comptable.fiches_calcul.creer', label: 'Creer Fiche', description: 'Creer une fiche de calcul' },
      { code: 'gestion_comptable.fiches_calcul.modifier', label: 'Modifier Fiche', description: 'Modifier une fiche de calcul' },
      { code: 'gestion_comptable.fiches_calcul.supprimer', label: 'Supprimer Fiche', description: 'Supprimer une fiche de calcul' },
      { code: 'gestion_comptable.fiches_calcul.publier', label: 'Publier Fiche', description: 'Publier une fiche de calcul' },
      { code: 'gestion_comptable.fiches_calcul.dupliquer', label: 'Dupliquer Fiche', description: 'Dupliquer une fiche de calcul' },
      { code: 'gestion_comptable.fiches_calcul.exporter', label: 'Exporter Fiche', description: 'Exporter une fiche de calcul' },
      { code: 'gestion_comptable.fiches_calcul.parametres', label: 'Parametres Fiche', description: 'Gerer les parametres des fiches' },
      // Declarations
      { code: 'gestion_comptable.declarations.voir', label: 'Voir Declarations', description: 'Voir les declarations' },
      { code: 'gestion_comptable.declarations.voir_toutes', label: 'Voir Toutes Declarations', description: 'Voir toutes les declarations' },
      { code: 'gestion_comptable.declarations.creer', label: 'Creer Declaration', description: 'Creer une declaration' },
      { code: 'gestion_comptable.declarations.remplir', label: 'Remplir Declaration', description: 'Remplir une declaration' },
      { code: 'gestion_comptable.declarations.modifier_metadata', label: 'Modifier Metadata', description: 'Modifier les metadonnees' },
      { code: 'gestion_comptable.declarations.supprimer', label: 'Supprimer Declaration', description: 'Supprimer une declaration' },
      { code: 'gestion_comptable.declarations.approuver', label: 'Approuver Declaration', description: 'Approuver une declaration' },
      { code: 'gestion_comptable.declarations.rejeter', label: 'Rejeter Declaration', description: 'Rejeter une declaration' },
      { code: 'gestion_comptable.declarations.soumettre', label: 'Soumettre Declaration', description: 'Soumettre une declaration' },
      // Gestion de Projet
      { code: 'gestion_comptable.gestion_projet.voir', label: 'Voir Projets', description: 'Voir les projets' },
      { code: 'gestion_comptable.gestion_projet.creer', label: 'Creer Projet', description: 'Creer un projet' },
      { code: 'gestion_comptable.gestion_projet.modifier', label: 'Modifier Projet', description: 'Modifier un projet' },
      { code: 'gestion_comptable.gestion_projet.supprimer', label: 'Supprimer Projet', description: 'Supprimer un projet' },
      { code: 'gestion_comptable.gestion_projet.exporter', label: 'Exporter Projets', description: 'Exporter les projets' },

      // ==================== FORMATION ====================
      { code: 'formation.acces', label: 'Acces Formation', description: 'Acces a la section Formation' },
      // Gestion des Formations
      { code: 'formation.gestion_formations.voir', label: 'Voir Formations', description: 'Voir les formations' },
      { code: 'formation.gestion_formations.creer', label: 'Creer Formation', description: 'Creer une formation' },
      { code: 'formation.gestion_formations.modifier', label: 'Modifier Formation', description: 'Modifier une formation' },
      { code: 'formation.gestion_formations.supprimer', label: 'Supprimer Formation', description: 'Supprimer une formation' },
      { code: 'formation.gestion_formations.dupliquer', label: 'Dupliquer Formation', description: 'Dupliquer une formation' },
      { code: 'formation.gestion_formations.creer_pack', label: 'Creer Pack', description: 'Creer un pack de formations' },
      { code: 'formation.gestion_formations.editer_contenu', label: 'Editer Contenu', description: 'Editer le contenu des formations' },
      // Sessions de Formation
      { code: 'formation.sessions_formation.voir', label: 'Voir Sessions', description: 'Voir les sessions de formation' },
      { code: 'formation.sessions_formation.creer', label: 'Creer Session', description: 'Creer une session' },
      { code: 'formation.sessions_formation.modifier', label: 'Modifier Session', description: 'Modifier une session' },
      { code: 'formation.sessions_formation.supprimer', label: 'Supprimer Session', description: 'Supprimer une session' },
      { code: 'formation.sessions_formation.ajouter_etudiant', label: 'Ajouter Etudiant', description: 'Ajouter un etudiant a la session' },
      { code: 'formation.sessions_formation.modifier_etudiant', label: 'Modifier Etudiant Session', description: 'Modifier un etudiant dans la session' },
      // Analytics
      { code: 'formation.analytics.voir', label: 'Voir Analytics', description: 'Voir les analytics' },
      { code: 'formation.analytics.exporter', label: 'Exporter Analytics', description: 'Exporter les analytics' },
      { code: 'formation.analytics.changer_periode', label: 'Changer Periode', description: 'Changer la periode des analytics' },
      // Rapports Etudiants
      { code: 'formation.rapports_etudiants.voir', label: 'Voir Rapports', description: 'Voir les rapports etudiants' },
      { code: 'formation.rapports_etudiants.rechercher', label: 'Rechercher Rapports', description: 'Rechercher dans les rapports' },
      { code: 'formation.rapports_etudiants.exporter_csv', label: 'Exporter CSV', description: 'Exporter les rapports en CSV' },
      { code: 'formation.rapports_etudiants.exporter_pdf', label: 'Exporter PDF', description: 'Exporter les rapports en PDF' },
      // Liste des Etudiants
      { code: 'formation.liste_etudiants.voir', label: 'Voir Etudiants', description: 'Voir la liste des etudiants' },
      { code: 'formation.liste_etudiants.creer', label: 'Creer Etudiant', description: 'Creer un etudiant' },
      { code: 'formation.liste_etudiants.modifier', label: 'Modifier Etudiant', description: 'Modifier un etudiant' },
      { code: 'formation.liste_etudiants.supprimer', label: 'Supprimer Etudiant', description: 'Supprimer un etudiant' },
      // Templates de Certificats
      { code: 'formation.templates_certificats.voir', label: 'Voir Templates', description: 'Voir les templates de certificats' },
      { code: 'formation.templates_certificats.creer_dossier', label: 'Creer Dossier', description: 'Creer un dossier de templates' },
      { code: 'formation.templates_certificats.creer_template', label: 'Creer Template', description: 'Creer un template' },
      { code: 'formation.templates_certificats.renommer', label: 'Renommer Template', description: 'Renommer un template' },
      { code: 'formation.templates_certificats.supprimer', label: 'Supprimer Template', description: 'Supprimer un template' },
      { code: 'formation.templates_certificats.dupliquer', label: 'Dupliquer Template', description: 'Dupliquer un template' },
      { code: 'formation.templates_certificats.editer_canvas', label: 'Editer Canvas', description: 'Editer le canvas du template' },
      // Forums
      { code: 'formation.forums.voir', label: 'Voir Forums', description: 'Voir les forums' },
      { code: 'formation.forums.creer_discussion', label: 'Creer Discussion', description: 'Creer une discussion' },
      { code: 'formation.forums.repondre', label: 'Repondre', description: 'Repondre aux discussions' },
      { code: 'formation.forums.reagir', label: 'Reagir', description: 'Reagir aux messages' },
      { code: 'formation.forums.supprimer', label: 'Supprimer Forum', description: 'Supprimer des messages' },
      { code: 'formation.forums.epingler', label: 'Epingler', description: 'Epingler des discussions' },
      { code: 'formation.forums.verrouiller', label: 'Verrouiller', description: 'Verrouiller des discussions' },
      { code: 'formation.forums.moderer', label: 'Moderer', description: 'Moderer les forums' },

      // ==================== RESSOURCES HUMAINES ====================
      { code: 'ressources_humaines.acces', label: 'Acces RH', description: 'Acces a la section Ressources Humaines' },
      // Boucles de Validation
      { code: 'ressources_humaines.boucles_validation.voir', label: 'Voir Boucles Validation', description: 'Voir les boucles de validation' },
      { code: 'ressources_humaines.boucles_validation.creer', label: 'Creer Boucle', description: 'Creer une boucle de validation' },
      { code: 'ressources_humaines.boucles_validation.modifier', label: 'Modifier Boucle', description: 'Modifier une boucle de validation' },
      { code: 'ressources_humaines.boucles_validation.supprimer', label: 'Supprimer Boucle', description: 'Supprimer une boucle de validation' },
      // Gestion des Horaires
      { code: 'ressources_humaines.gestion_horaires.voir', label: 'Voir Gestion Horaires', description: 'Voir la gestion des horaires' },
      // Onglet Modeles
      { code: 'ressources_humaines.gestion_horaires.modeles.creer', label: 'Creer Modele Horaire', description: 'Creer un modele d\'horaire' },
      { code: 'ressources_humaines.gestion_horaires.modeles.modifier', label: 'Modifier Modele Horaire', description: 'Modifier un modele d\'horaire' },
      { code: 'ressources_humaines.gestion_horaires.modeles.supprimer', label: 'Supprimer Modele Horaire', description: 'Supprimer un modele d\'horaire' },
      // Onglet Jours Feries
      { code: 'ressources_humaines.gestion_horaires.jours_feries.creer', label: 'Creer Jour Ferie', description: 'Creer un jour ferie' },
      { code: 'ressources_humaines.gestion_horaires.jours_feries.modifier', label: 'Modifier Jour Ferie', description: 'Modifier un jour ferie' },
      { code: 'ressources_humaines.gestion_horaires.jours_feries.supprimer', label: 'Supprimer Jour Ferie', description: 'Supprimer un jour ferie' },
      // Onglet Conges Valides
      { code: 'ressources_humaines.gestion_horaires.conges_valides.voir', label: 'Voir Conges Valides', description: 'Voir les conges valides' },
      // Onglet Heures Supplementaires
      { code: 'ressources_humaines.gestion_horaires.heures_sup.voir', label: 'Voir Heures Sup', description: 'Voir les heures supplementaires' },
      { code: 'ressources_humaines.gestion_horaires.heures_sup.approuver', label: 'Approuver Heures Sup', description: 'Approuver les heures supplementaires' },
      { code: 'ressources_humaines.gestion_horaires.heures_sup.rejeter', label: 'Rejeter Heures Sup', description: 'Rejeter les heures supplementaires' },
      { code: 'ressources_humaines.gestion_horaires.heures_sup.creer_periode', label: 'Creer Periode HS', description: 'Creer une periode d\'heures supplementaires' },
      { code: 'ressources_humaines.gestion_horaires.heures_sup.supprimer_periode', label: 'Supprimer Periode HS', description: 'Supprimer une periode d\'heures supplementaires' },
      { code: 'ressources_humaines.gestion_horaires.heures_sup.recalculer', label: 'Recalculer Heures Sup', description: 'Recalculer les heures supplementaires' },
      // Onglet Config HS
      { code: 'ressources_humaines.gestion_horaires.config_hs.voir', label: 'Voir Config HS', description: 'Voir la configuration des heures supplementaires' },
      { code: 'ressources_humaines.gestion_horaires.config_hs.modifier', label: 'Modifier Config HS', description: 'Modifier la configuration des heures supplementaires' },
      // Gestion de Paie
      { code: 'ressources_humaines.gestion_paie.voir', label: 'Voir Gestion Paie', description: 'Voir la gestion de paie' },
      // Onglet Periodes
      { code: 'ressources_humaines.gestion_paie.periodes.creer', label: 'Creer Periode Paie', description: 'Creer une periode de paie' },
      { code: 'ressources_humaines.gestion_paie.periodes.ouvrir', label: 'Ouvrir Periode Paie', description: 'Ouvrir une periode de paie' },
      { code: 'ressources_humaines.gestion_paie.periodes.fermer', label: 'Fermer Periode Paie', description: 'Fermer une periode de paie' },
      { code: 'ressources_humaines.gestion_paie.periodes.supprimer', label: 'Supprimer Periode Paie', description: 'Supprimer une periode de paie' },
      // Onglet Calculs
      { code: 'ressources_humaines.gestion_paie.calculs.calculer', label: 'Calculer Paie', description: 'Lancer le calcul de paie' },
      // Onglet Bulletins
      { code: 'ressources_humaines.gestion_paie.bulletins.voir', label: 'Voir Bulletins', description: 'Voir les bulletins de paie' },
      { code: 'ressources_humaines.gestion_paie.bulletins.valider', label: 'Valider Bulletin', description: 'Valider un bulletin' },
      { code: 'ressources_humaines.gestion_paie.bulletins.valider_tous', label: 'Valider Tous Bulletins', description: 'Valider tous les bulletins' },
      { code: 'ressources_humaines.gestion_paie.bulletins.telecharger', label: 'Telecharger Bulletin', description: 'Telecharger un bulletin' },
      { code: 'ressources_humaines.gestion_paie.bulletins.exporter_cnss', label: 'Exporter CNSS', description: 'Exporter la declaration CNSS' },
      { code: 'ressources_humaines.gestion_paie.bulletins.exporter_virements', label: 'Exporter Virements', description: 'Exporter le fichier de virements' },
      // Onglet Tests
      { code: 'ressources_humaines.gestion_paie.tests.voir', label: 'Voir Tests Paie', description: 'Voir les tests et logs de paie' },
      // Onglet Automatisation
      { code: 'ressources_humaines.gestion_paie.automatisation.voir', label: 'Voir Automatisation', description: 'Voir l\'automatisation de la paie' },
      { code: 'ressources_humaines.gestion_paie.automatisation.configurer', label: 'Configurer Automatisation', description: 'Configurer l\'automatisation' },
      // Onglet Configuration
      { code: 'ressources_humaines.gestion_paie.configuration.voir', label: 'Voir Configuration Paie', description: 'Voir la configuration de la paie' },
      { code: 'ressources_humaines.gestion_paie.configuration.modifier', label: 'Modifier Configuration Paie', description: 'Modifier la configuration de la paie' },
      // Gestion Pointage
      { code: 'ressources_humaines.gestion_pointage.voir', label: 'Voir Gestion Pointage', description: 'Voir la gestion du pointage' },
      { code: 'ressources_humaines.gestion_pointage.pointer', label: 'Pointer', description: 'Effectuer un pointage' },
      { code: 'ressources_humaines.gestion_pointage.corriger', label: 'Corriger Pointage', description: 'Corriger un pointage' },
      { code: 'ressources_humaines.gestion_pointage.importer', label: 'Importer Pointages', description: 'Importer des pointages' },
      { code: 'ressources_humaines.gestion_pointage.exporter', label: 'Exporter Pointages', description: 'Exporter les pointages' },
      { code: 'ressources_humaines.gestion_pointage.valider', label: 'Valider Pointages', description: 'Valider les pointages' },
      // Dossier Employe
      { code: 'ressources_humaines.dossier_employe.voir', label: 'Voir Dossier Employe', description: 'Voir les dossiers employes' },
      { code: 'ressources_humaines.dossier_employe.creer', label: 'Creer Dossier', description: 'Creer un dossier employe' },
      { code: 'ressources_humaines.dossier_employe.modifier', label: 'Modifier Dossier', description: 'Modifier un dossier employe' },
      { code: 'ressources_humaines.dossier_employe.supprimer', label: 'Supprimer Dossier', description: 'Supprimer un dossier employe' },
      { code: 'ressources_humaines.dossier_employe.voir_salaire', label: 'Voir Salaire', description: 'Voir le salaire de l\'employe' },
      { code: 'ressources_humaines.dossier_employe.gerer_contrats', label: 'Gerer Contrats', description: 'Gerer les contrats de l\'employe' },
      { code: 'ressources_humaines.dossier_employe.gerer_documents', label: 'Gerer Documents', description: 'Gerer les documents de l\'employe' },
      { code: 'ressources_humaines.dossier_employe.gerer_discipline', label: 'Gerer Discipline', description: 'Gerer les actions disciplinaires' },
      // Validation des Demandes
      { code: 'ressources_humaines.validation_demandes.voir', label: 'Voir Validation Demandes', description: 'Voir la validation des demandes' },
      { code: 'ressources_humaines.validation_demandes.approuver', label: 'Approuver Demande', description: 'Approuver une demande' },
      { code: 'ressources_humaines.validation_demandes.rejeter', label: 'Rejeter Demande', description: 'Rejeter une demande' },
      // Delegations
      { code: 'ressources_humaines.delegations.voir', label: 'Voir Delegations', description: 'Voir les delegations' },
      { code: 'ressources_humaines.delegations.creer', label: 'Creer Delegation', description: 'Creer une delegation' },
      { code: 'ressources_humaines.delegations.gerer_toutes', label: 'Gerer Toutes Delegations', description: 'Gerer toutes les delegations' },

      // ==================== MON EQUIPE ====================
      { code: 'mon_equipe.acces', label: 'Acces Mon Equipe', description: 'Acces a la section Mon Equipe' },
      { code: 'mon_equipe.pointages_equipe.voir', label: 'Voir Pointages Equipe', description: 'Voir les pointages de l\'equipe' },
      { code: 'mon_equipe.pointages_equipe.supprimer', label: 'Supprimer Pointage Equipe', description: 'Supprimer un pointage de l\'equipe' },
      { code: 'mon_equipe.demandes_equipe.voir', label: 'Voir Demandes Equipe', description: 'Voir les demandes de l\'equipe' },
      { code: 'mon_equipe.demandes_equipe.approuver', label: 'Approuver Demande Equipe', description: 'Approuver une demande de l\'equipe' },
      { code: 'mon_equipe.demandes_equipe.rejeter', label: 'Rejeter Demande Equipe', description: 'Rejeter une demande de l\'equipe' },

      // ==================== MON ESPACE RH ====================
      { code: 'mon_espace_rh.acces', label: 'Acces Mon Espace RH', description: 'Acces a Mon Espace RH' },
      { code: 'mon_espace_rh.mon_pointage.voir', label: 'Voir Mon Pointage', description: 'Voir mes pointages' },
      { code: 'mon_espace_rh.mon_pointage.pointer', label: 'Pointer', description: 'Effectuer mon pointage' },
      { code: 'mon_espace_rh.mes_demandes.voir', label: 'Voir Mes Demandes', description: 'Voir mes demandes' },
      { code: 'mon_espace_rh.mes_demandes.creer', label: 'Creer Demande', description: 'Creer une demande' },
      { code: 'mon_espace_rh.mes_demandes.annuler', label: 'Annuler Demande', description: 'Annuler une demande' },
      { code: 'mon_espace_rh.mes_bulletins.voir', label: 'Voir Mes Bulletins', description: 'Voir mes bulletins de paie' },
      { code: 'mon_espace_rh.mes_bulletins.telecharger', label: 'Telecharger Bulletin', description: 'Telecharger mon bulletin' },

      // ==================== COMMERCIALISATION ====================
      { code: 'commercialisation.acces', label: 'Acces Commercialisation', description: 'Acces a la section Commercialisation' },
      // Tableau de bord
      { code: 'commercialisation.tableau_de_bord.voir', label: 'Voir Tableau de bord', description: 'Voir le tableau de bord commercial' },
      { code: 'commercialisation.tableau_de_bord.voir_stats', label: 'Voir Statistiques', description: 'Voir les statistiques' },
      { code: 'commercialisation.tableau_de_bord.exporter', label: 'Exporter Stats', description: 'Exporter les statistiques' },
      // Prospects
      { code: 'commercialisation.prospects.voir', label: 'Voir Prospects', description: 'Voir les prospects' },
      { code: 'commercialisation.prospects.voir_tous', label: 'Voir Tous Prospects', description: 'Voir tous les prospects' },
      { code: 'commercialisation.prospects.creer', label: 'Creer Prospect', description: 'Creer un prospect' },
      { code: 'commercialisation.prospects.modifier', label: 'Modifier Prospect', description: 'Modifier un prospect' },
      { code: 'commercialisation.prospects.supprimer', label: 'Supprimer Prospect', description: 'Supprimer un prospect' },
      { code: 'commercialisation.prospects.appeler', label: 'Appeler Prospect', description: 'Appeler un prospect' },
      { code: 'commercialisation.prospects.convertir', label: 'Convertir Prospect', description: 'Convertir un prospect en client' },
      { code: 'commercialisation.prospects.importer', label: 'Importer Prospects', description: 'Importer des prospects' },
      { code: 'commercialisation.prospects.exporter', label: 'Exporter Prospects', description: 'Exporter des prospects' },
      { code: 'commercialisation.prospects.assigner', label: 'Assigner Prospect', description: 'Assigner un prospect' },
      { code: 'commercialisation.prospects.reinjecter', label: 'Reinjecter Prospect', description: 'Reinjecter un prospect dans le cycle' },
      // Nettoyage Prospects
      { code: 'commercialisation.nettoyage_prospects.voir', label: 'Voir Nettoyage', description: 'Voir le nettoyage des prospects' },
      { code: 'commercialisation.nettoyage_prospects.nettoyer', label: 'Nettoyer Prospects', description: 'Nettoyer les prospects' },
      // Gestion G-Contacte
      { code: 'commercialisation.gestion_gcontacte.voir', label: 'Voir G-Contacte', description: 'Voir la gestion G-Contacte' },
      { code: 'commercialisation.gestion_gcontacte.configurer', label: 'Configurer G-Contacte', description: 'Configurer G-Contacte' },
      { code: 'commercialisation.gestion_gcontacte.synchroniser', label: 'Synchroniser G-Contacte', description: 'Synchroniser avec G-Contacte' },
      { code: 'commercialisation.gestion_gcontacte.tester', label: 'Tester G-Contacte', description: 'Tester la connexion G-Contacte' },
    ];

    let insertedCount = 0;
    for (const perm of newPermissions) {
      const parsed = parsePermissionCode(perm.code);
      try {
        const result = await client.query(`
          INSERT INTO permissions (module, menu, action, code, label, description, sort_order, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, 0, NOW())
          ON CONFLICT (code) DO UPDATE SET
            label = EXCLUDED.label,
            description = EXCLUDED.description,
            module = EXCLUDED.module,
            menu = EXCLUDED.menu,
            action = EXCLUDED.action
          RETURNING id
        `, [parsed.module, parsed.menu, parsed.action, perm.code, perm.label, perm.description]);
        insertedCount++;
      } catch (err) {
        console.log(`Erreur insertion ${perm.code}:`, err.message);
      }
    }
    console.log(`${insertedCount} permissions inserees/mises a jour`);

    // Step 4: Migrer les associations role_permissions vers les nouveaux codes
    console.log('Step 4: Migration des associations role_permissions...');

    // Get IDs of new permissions
    const newPermIds = await client.query(`
      SELECT id, code FROM permissions
      WHERE code LIKE 'gestion_comptable.%'
         OR code LIKE 'formation.%'
         OR code LIKE 'ressources_humaines.%'
         OR code LIKE 'mon_equipe.%'
         OR code LIKE 'mon_espace_rh.%'
         OR code LIKE 'commercialisation.%'
    `);

    // For each old->new mapping, copy role associations
    const mappingResult = await client.query('SELECT old_code, new_code FROM permission_mapping');
    for (const mapping of mappingResult.rows) {
      // Find old permission ID
      const oldPermResult = await client.query('SELECT id FROM permissions WHERE code = $1', [mapping.old_code]);
      if (oldPermResult.rows.length === 0) continue;

      const oldPermId = oldPermResult.rows[0].id;

      // Find new permission ID
      const newPermResult = await client.query('SELECT id FROM permissions WHERE code = $1', [mapping.new_code]);
      if (newPermResult.rows.length === 0) continue;

      const newPermId = newPermResult.rows[0].id;

      // Copy associations
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT role_id, $1
        FROM role_permissions
        WHERE permission_id = $2
        ON CONFLICT (role_id, permission_id) DO NOTHING
      `, [newPermId, oldPermId]);
    }
    console.log('Associations migreees');

    // Step 5: Assigner toutes les nouvelles permissions au role admin
    console.log('Step 5: Attribution des permissions admin...');
    const adminRoleResult = await client.query("SELECT id FROM roles WHERE name = 'admin' LIMIT 1");

    if (adminRoleResult.rows.length > 0) {
      const adminRoleId = adminRoleResult.rows[0].id;

      for (const row of newPermIds.rows) {
        await client.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ($1, $2)
          ON CONFLICT (role_id, permission_id) DO NOTHING
        `, [adminRoleId, row.id]);
      }
      console.log('Permissions admin attribuees');
    }

    await client.query('COMMIT');

    console.log('=== Migration 109 terminee avec succes ===');
    res.json({
      success: true,
      message: 'Migration 109: Refactorisation des permissions en francais terminee',
      permissions_created: insertedCount
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur migration 109:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      error: error.stack
    });
  } finally {
    client.release();
    await pool.end();
  }
});

export default router;
