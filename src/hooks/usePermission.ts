import { useAuth } from '@/contexts/AuthContext';
import { useCallback, useMemo } from 'react';
import { convertLegacyPermission } from '@/config/permissions';

/**
 * Hook pour verifier les permissions utilisateur
 * Utilise le nouveau systeme hierarchique (section.sous_menu.onglet?.action)
 *
 * Exemples de codes:
 * - gestion_comptable.segments.voir
 * - gestion_comptable.segments.creer
 * - ressources_humaines.gestion_horaires.modeles.creer
 * - formation.gestion_formations.supprimer
 */
export function usePermission() {
  const { user, permissions } = useAuth();

  // Normaliser les permissions en convertissant les codes legacy vers les nouveaux codes français
  const normalizedPermissions = useMemo(() => {
    if (!permissions || permissions.length === 0) return [];
    const normalized = new Set<string>();
    permissions.forEach(p => {
      // Ajouter le code original
      normalized.add(p);
      // Ajouter aussi le code converti (si différent)
      const converted = convertLegacyPermission(p);
      if (converted !== p) {
        normalized.add(converted);
      }
    });
    return Array.from(normalized);
  }, [permissions]);

  // Verifier si l'utilisateur a une permission specifique
  const can = useCallback((permissionCode: string): boolean => {
    // Admin a toujours toutes les permissions
    if (user?.role === 'admin') return true;

    // Verifier permission wildcard
    if (permissions.includes('*')) return true;

    // Convertir ancien code si necessaire
    const normalizedCode = convertLegacyPermission(permissionCode);

    // Verifier permission specifique
    return permissions.includes(normalizedCode);
  }, [user, permissions]);

  // Verifier si l'utilisateur a l'une des permissions specifiees
  const canAny = useCallback((...permissionCodes: string[]): boolean => {
    if (user?.role === 'admin') return true;
    if (permissions.includes('*')) return true;
    return permissionCodes.some(code => {
      const normalized = convertLegacyPermission(code);
      return permissions.includes(normalized);
    });
  }, [user, permissions]);

  // Verifier si l'utilisateur a toutes les permissions specifiees
  const canAll = useCallback((...permissionCodes: string[]): boolean => {
    if (user?.role === 'admin') return true;
    if (permissions.includes('*')) return true;
    return permissionCodes.every(code => {
      const normalized = convertLegacyPermission(code);
      return permissions.includes(normalized);
    });
  }, [user, permissions]);

  // Verifier si l'utilisateur peut voir une page specifique (menu)
  const canViewPage = useCallback((section: string, sousMenu: string): boolean => {
    const code = `${section}.${sousMenu}.voir`;
    return can(code);
  }, [can]);

  // Verifier si l'utilisateur peut effectuer une action sur un menu/page
  const canAction = useCallback((section: string, sousMenu: string, action: string): boolean => {
    const code = `${section}.${sousMenu}.${action}`;
    return can(code);
  }, [can]);

  // Verifier action avec onglet (pour pages avec onglets comme gestion_horaires)
  const canOngletAction = useCallback((section: string, sousMenu: string, onglet: string, action: string): boolean => {
    const code = `${section}.${sousMenu}.${onglet}.${action}`;
    return can(code);
  }, [can]);

  // Obtenir toutes les permissions de vue (pour visibilite des menus)
  const viewablePages = useMemo(() => {
    if (user?.role === 'admin' || normalizedPermissions.includes('*')) {
      // Admin voit toutes les pages
      return ['*'];
    }
    return normalizedPermissions.filter(p => p.endsWith('.voir'));
  }, [user, normalizedPermissions]);

  // Verifier si l'utilisateur peut voir une section
  const canAccessSection = useCallback((section: string): boolean => {
    if (user?.role === 'admin') return true;
    if (normalizedPermissions.includes('*')) return true;
    // Verifier permission d'acces a la section ou au moins une permission .voir dans la section
    // Utilise normalizedPermissions qui inclut les codes legacy convertis
    return normalizedPermissions.includes(`${section}.acces`) ||
           normalizedPermissions.some(p => p.startsWith(`${section}.`) && p.endsWith('.voir'));
  }, [user, normalizedPermissions]);

  // ==================== GESTION COMPTABLE ====================
  const gestionComptable = useMemo(() => ({
    // Acces section
    acces: can('gestion_comptable.acces'),

    // Tableau de bord
    voirTableauDeBord: can('gestion_comptable.tableau_de_bord.voir'),

    // Segments
    voirSegments: can('gestion_comptable.segments.voir'),
    creerSegment: can('gestion_comptable.segments.creer'),
    modifierSegment: can('gestion_comptable.segments.modifier'),
    supprimerSegment: can('gestion_comptable.segments.supprimer'),
    importerVilles: can('gestion_comptable.segments.importer_villes'),

    // Villes
    voirVilles: can('gestion_comptable.villes.voir'),
    creerVille: can('gestion_comptable.villes.creer'),
    modifierVille: can('gestion_comptable.villes.modifier'),
    supprimerVille: can('gestion_comptable.villes.supprimer'),
    supprimerVillesMasse: can('gestion_comptable.villes.supprimer_masse'),

    // Utilisateurs
    voirUtilisateurs: can('gestion_comptable.utilisateurs.voir'),
    creerUtilisateur: can('gestion_comptable.utilisateurs.creer'),
    modifierUtilisateur: can('gestion_comptable.utilisateurs.modifier'),
    supprimerUtilisateur: can('gestion_comptable.utilisateurs.supprimer'),
    assignerSegments: can('gestion_comptable.utilisateurs.assigner_segments'),
    assignerVilles: can('gestion_comptable.utilisateurs.assigner_villes'),
    assignerRoles: can('gestion_comptable.utilisateurs.assigner_roles'),

    // Roles & Permissions
    voirRoles: can('gestion_comptable.roles_permissions.voir'),
    creerRole: can('gestion_comptable.roles_permissions.creer'),
    modifierRole: can('gestion_comptable.roles_permissions.modifier'),
    supprimerRole: can('gestion_comptable.roles_permissions.supprimer'),

    // Fiches de calcul
    voirFiches: can('gestion_comptable.fiches_calcul.voir'),
    creerFiche: can('gestion_comptable.fiches_calcul.creer'),
    modifierFiche: can('gestion_comptable.fiches_calcul.modifier'),
    supprimerFiche: can('gestion_comptable.fiches_calcul.supprimer'),
    publierFiche: can('gestion_comptable.fiches_calcul.publier'),
    dupliquerFiche: can('gestion_comptable.fiches_calcul.dupliquer'),
    exporterFiche: can('gestion_comptable.fiches_calcul.exporter'),
    parametresFiche: can('gestion_comptable.fiches_calcul.parametres'),

    // Declarations
    voirDeclarations: can('gestion_comptable.declarations.voir'),
    voirToutesDeclarations: can('gestion_comptable.declarations.voir_toutes'),
    creerDeclaration: can('gestion_comptable.declarations.creer'),
    remplirDeclaration: can('gestion_comptable.declarations.remplir'),
    modifierMetadata: can('gestion_comptable.declarations.modifier_metadata'),
    supprimerDeclaration: can('gestion_comptable.declarations.supprimer'),
    approuverDeclaration: can('gestion_comptable.declarations.approuver'),
    rejeterDeclaration: can('gestion_comptable.declarations.rejeter'),
    soumettreDeclaration: can('gestion_comptable.declarations.soumettre'),

    // Gestion de Projet
    voirProjets: can('gestion_comptable.gestion_projet.voir'),
    creerProjet: can('gestion_comptable.gestion_projet.creer'),
    modifierProjet: can('gestion_comptable.gestion_projet.modifier'),
    supprimerProjet: can('gestion_comptable.gestion_projet.supprimer'),
    exporterProjets: can('gestion_comptable.gestion_projet.exporter'),
  }), [can]);

  // ==================== FORMATION ====================
  const formation = useMemo(() => ({
    // Acces section
    acces: can('formation.acces'),

    // Gestion des Formations
    voirFormations: can('formation.gestion_formations.voir'),
    creerFormation: can('formation.gestion_formations.creer'),
    modifierFormation: can('formation.gestion_formations.modifier'),
    supprimerFormation: can('formation.gestion_formations.supprimer'),
    dupliquerFormation: can('formation.gestion_formations.dupliquer'),
    creerPack: can('formation.gestion_formations.creer_pack'),
    editerContenu: can('formation.gestion_formations.editer_contenu'),

    // Sessions de Formation
    voirSessions: can('formation.sessions_formation.voir'),
    creerSession: can('formation.sessions_formation.creer'),
    modifierSession: can('formation.sessions_formation.modifier'),
    supprimerSession: can('formation.sessions_formation.supprimer'),
    ajouterEtudiant: can('formation.sessions_formation.ajouter_etudiant'),
    modifierEtudiant: can('formation.sessions_formation.modifier_etudiant'),

    // Analytics
    voirAnalytics: can('formation.analytics.voir'),
    exporterAnalytics: can('formation.analytics.exporter'),
    changerPeriode: can('formation.analytics.changer_periode'),

    // Rapports Etudiants
    voirRapports: can('formation.rapports_etudiants.voir'),
    rechercherRapports: can('formation.rapports_etudiants.rechercher'),
    exporterCsv: can('formation.rapports_etudiants.exporter_csv'),
    exporterPdf: can('formation.rapports_etudiants.exporter_pdf'),

    // Liste des Etudiants
    voirEtudiants: can('formation.liste_etudiants.voir'),
    creerEtudiant: can('formation.liste_etudiants.creer'),
    modifierEtudiantListe: can('formation.liste_etudiants.modifier'),
    supprimerEtudiant: can('formation.liste_etudiants.supprimer'),

    // Templates de Certificats
    voirTemplates: can('formation.templates_certificats.voir'),
    creerDossier: can('formation.templates_certificats.creer_dossier'),
    creerTemplate: can('formation.templates_certificats.creer_template'),
    renommerTemplate: can('formation.templates_certificats.renommer'),
    supprimerTemplate: can('formation.templates_certificats.supprimer'),
    dupliquerTemplate: can('formation.templates_certificats.dupliquer'),
    editerCanvas: can('formation.templates_certificats.editer_canvas'),

    // Forums
    voirForums: can('formation.forums.voir'),
    creerDiscussion: can('formation.forums.creer_discussion'),
    repondre: can('formation.forums.repondre'),
    reagir: can('formation.forums.reagir'),
    supprimerForum: can('formation.forums.supprimer'),
    epingler: can('formation.forums.epingler'),
    verrouiller: can('formation.forums.verrouiller'),
    moderer: can('formation.forums.moderer'),
  }), [can]);

  // ==================== RESSOURCES HUMAINES ====================
  const ressourcesHumaines = useMemo(() => ({
    // Acces section
    acces: can('ressources_humaines.acces'),

    // Boucles de Validation
    voirBouclesValidation: can('ressources_humaines.boucles_validation.voir'),
    creerBoucle: can('ressources_humaines.boucles_validation.creer'),
    modifierBoucle: can('ressources_humaines.boucles_validation.modifier'),
    supprimerBoucle: can('ressources_humaines.boucles_validation.supprimer'),

    // Gestion des Horaires
    voirGestionHoraires: can('ressources_humaines.gestion_horaires.voir'),
    // Onglet Modeles
    creerModele: can('ressources_humaines.gestion_horaires.modeles.creer'),
    modifierModele: can('ressources_humaines.gestion_horaires.modeles.modifier'),
    supprimerModele: can('ressources_humaines.gestion_horaires.modeles.supprimer'),
    // Onglet Jours Feries
    creerJourFerie: can('ressources_humaines.gestion_horaires.jours_feries.creer'),
    modifierJourFerie: can('ressources_humaines.gestion_horaires.jours_feries.modifier'),
    supprimerJourFerie: can('ressources_humaines.gestion_horaires.jours_feries.supprimer'),
    // Onglet Conges Valides
    voirCongesValides: can('ressources_humaines.gestion_horaires.conges_valides.voir'),
    // Onglet Heures Supplementaires
    voirHeuresSup: can('ressources_humaines.gestion_horaires.heures_sup.voir'),
    approuverHeuresSup: can('ressources_humaines.gestion_horaires.heures_sup.approuver'),
    rejeterHeuresSup: can('ressources_humaines.gestion_horaires.heures_sup.rejeter'),
    creerPeriodeHS: can('ressources_humaines.gestion_horaires.heures_sup.creer_periode'),
    supprimerPeriodeHS: can('ressources_humaines.gestion_horaires.heures_sup.supprimer_periode'),
    recalculerHeuresSup: can('ressources_humaines.gestion_horaires.heures_sup.recalculer'),
    // Onglet Config HS
    voirConfigHS: can('ressources_humaines.gestion_horaires.config_hs.voir'),
    modifierConfigHS: can('ressources_humaines.gestion_horaires.config_hs.modifier'),
    // Onglet Récupération
    voirRecuperation: can('ressources_humaines.gestion_horaires.recuperation.voir'),
    creerPeriodeRecup: can('ressources_humaines.gestion_horaires.recuperation.creer_periode'),
    modifierPeriodeRecup: can('ressources_humaines.gestion_horaires.recuperation.modifier_periode'),
    supprimerPeriodeRecup: can('ressources_humaines.gestion_horaires.recuperation.supprimer_periode'),
    declarerJourRecup: can('ressources_humaines.gestion_horaires.recuperation.declarer_jour'),
    modifierDeclarationRecup: can('ressources_humaines.gestion_horaires.recuperation.modifier_declaration'),
    supprimerDeclarationRecup: can('ressources_humaines.gestion_horaires.recuperation.supprimer_declaration'),
    verifierRecuperation: can('ressources_humaines.gestion_horaires.recuperation.verifier'),

    // Gestion de Paie
    voirGestionPaie: can('ressources_humaines.gestion_paie.voir'),
    // Onglet Periodes de Paie
    creerPeriode: can('ressources_humaines.gestion_paie.periodes.creer'),
    ouvrirPeriode: can('ressources_humaines.gestion_paie.periodes.ouvrir'),
    fermerPeriode: can('ressources_humaines.gestion_paie.periodes.fermer'),
    supprimerPeriode: can('ressources_humaines.gestion_paie.periodes.supprimer'),
    // Onglet Calculs de Paie
    calculerPaie: can('ressources_humaines.gestion_paie.calculs.calculer'),
    // Onglet Bulletins de Paie
    voirBulletins: can('ressources_humaines.gestion_paie.bulletins.voir'),
    validerBulletin: can('ressources_humaines.gestion_paie.bulletins.valider'),
    validerTousBulletins: can('ressources_humaines.gestion_paie.bulletins.valider_tous'),
    telechargerBulletin: can('ressources_humaines.gestion_paie.bulletins.telecharger'),
    exporterCnss: can('ressources_humaines.gestion_paie.bulletins.exporter_cnss'),
    exporterVirements: can('ressources_humaines.gestion_paie.bulletins.exporter_virements'),
    // Onglet Tests & Logs
    voirTests: can('ressources_humaines.gestion_paie.tests.voir'),
    // Onglet Automatisation
    voirAutomatisation: can('ressources_humaines.gestion_paie.automatisation.voir'),
    configurerAutomatisation: can('ressources_humaines.gestion_paie.automatisation.configurer'),
    // Onglet Configuration
    voirConfiguration: can('ressources_humaines.gestion_paie.configuration.voir'),
    modifierConfiguration: can('ressources_humaines.gestion_paie.configuration.modifier'),

    // Gestion Pointage
    voirGestionPointage: can('ressources_humaines.gestion_pointage.voir'),
    pointer: can('ressources_humaines.gestion_pointage.pointer'),
    corrigerPointage: can('ressources_humaines.gestion_pointage.corriger'),
    importerPointage: can('ressources_humaines.gestion_pointage.importer'),
    exporterPointage: can('ressources_humaines.gestion_pointage.exporter'),
    validerPointage: can('ressources_humaines.gestion_pointage.valider'),

    // Dossier Employe
    voirDossierEmploye: can('ressources_humaines.dossier_employe.voir'),
    creerDossier: can('ressources_humaines.dossier_employe.creer'),
    modifierDossier: can('ressources_humaines.dossier_employe.modifier'),
    supprimerDossier: can('ressources_humaines.dossier_employe.supprimer'),
    voirSalaire: can('ressources_humaines.dossier_employe.voir_salaire'),
    gererContrats: can('ressources_humaines.dossier_employe.gerer_contrats'),
    gererDocuments: can('ressources_humaines.dossier_employe.gerer_documents'),
    gererDiscipline: can('ressources_humaines.dossier_employe.gerer_discipline'),

    // Validation des Demandes
    voirValidationDemandes: can('ressources_humaines.validation_demandes.voir'),
    approuverDemande: can('ressources_humaines.validation_demandes.approuver'),
    rejeterDemande: can('ressources_humaines.validation_demandes.rejeter'),

    // Delegations
    voirDelegations: can('ressources_humaines.delegations.voir'),
    creerDelegation: can('ressources_humaines.delegations.creer'),
    gererToutesDelegations: can('ressources_humaines.delegations.gerer_toutes'),
  }), [can]);

  // ==================== MON EQUIPE ====================
  const monEquipe = useMemo(() => ({
    // Acces section
    acces: can('mon_equipe.acces'),

    // Pointages equipe
    voirPointagesEquipe: can('mon_equipe.pointages_equipe.voir'),
    supprimerPointage: can('mon_equipe.pointages_equipe.supprimer'),

    // Demandes equipe
    voirDemandesEquipe: can('mon_equipe.demandes_equipe.voir'),
    approuverDemande: can('mon_equipe.demandes_equipe.approuver'),
    rejeterDemande: can('mon_equipe.demandes_equipe.rejeter'),
  }), [can]);

  // ==================== MON ESPACE RH ====================
  const monEspaceRh = useMemo(() => ({
    // Acces section
    acces: can('mon_espace_rh.acces'),

    // Mon Pointage
    voirMonPointage: can('mon_espace_rh.mon_pointage.voir'),
    pointer: can('mon_espace_rh.mon_pointage.pointer'),

    // Mes Demandes
    voirMesDemandes: can('mon_espace_rh.mes_demandes.voir'),
    creerDemande: can('mon_espace_rh.mes_demandes.creer'),
    annulerDemande: can('mon_espace_rh.mes_demandes.annuler'),

    // Mes Bulletins
    voirMesBulletins: can('mon_espace_rh.mes_bulletins.voir'),
    telechargerBulletin: can('mon_espace_rh.mes_bulletins.telecharger'),
  }), [can]);

  // ==================== COMMERCIALISATION ====================
  const commercialisation = useMemo(() => ({
    // Acces section
    acces: can('commercialisation.acces'),

    // Tableau de bord
    voirTableauDeBord: can('commercialisation.tableau_de_bord.voir'),
    voirStats: can('commercialisation.tableau_de_bord.voir_stats'),
    exporterStats: can('commercialisation.tableau_de_bord.exporter'),

    // Prospects
    voirProspects: can('commercialisation.prospects.voir'),
    voirTousProspects: can('commercialisation.prospects.voir_tous'),
    creerProspect: can('commercialisation.prospects.creer'),
    modifierProspect: can('commercialisation.prospects.modifier'),
    supprimerProspect: can('commercialisation.prospects.supprimer'),
    appelerProspect: can('commercialisation.prospects.appeler'),
    convertirProspect: can('commercialisation.prospects.convertir'),
    importerProspects: can('commercialisation.prospects.importer'),
    exporterProspects: can('commercialisation.prospects.exporter'),
    assignerProspect: can('commercialisation.prospects.assigner'),
    reinjecterProspect: can('commercialisation.prospects.reinjecter'),

    // Nettoyage Prospects
    voirNettoyage: can('commercialisation.nettoyage_prospects.voir'),
    nettoyer: can('commercialisation.nettoyage_prospects.nettoyer'),

    // Legacy - Client aliases
    canCreateClient: can('commercialisation.prospects.creer'),
    canUpdateClient: can('commercialisation.prospects.modifier'),
    canDeleteClient: can('commercialisation.prospects.supprimer'),
    canViewClient: can('commercialisation.prospects.voir'),

    // Legacy - Prospect aliases (utilisés par Prospects.tsx)
    canCreateProspect: can('commercialisation.prospects.creer'),
    canUpdateProspect: can('commercialisation.prospects.modifier'),
    canDeleteProspect: can('commercialisation.prospects.supprimer'),
    canViewProspects: can('commercialisation.prospects.voir'),
    canImportProspects: can('commercialisation.prospects.importer'),
    canExportProspects: can('commercialisation.prospects.exporter'),
    canCallProspect: can('commercialisation.prospects.appeler'),
    canAssignProspect: can('commercialisation.prospects.assigner'),
    canReinjectProspect: can('commercialisation.prospects.reinjecter'),

    // Visits object (utilisé par Visits.tsx)
    visits: {
      create: can('commercialisation.visites.creer'),
      update: can('commercialisation.visites.modifier'),
      delete: can('commercialisation.visites.supprimer'),
      view_page: can('commercialisation.visites.voir'),
      export: can('commercialisation.visites.exporter'),
      view_analytics: can('commercialisation.visites.voir_analytics'),
    },

    // Gestion G-Contacte
    voirGContacte: can('commercialisation.gestion_gcontacte.voir'),
    configurerGContacte: can('commercialisation.gestion_gcontacte.configurer'),
    synchroniserGContacte: can('commercialisation.gestion_gcontacte.synchroniser'),
    testerGContacte: can('commercialisation.gestion_gcontacte.tester'),
  }), [can]);

  // ==================== LEGACY ALIASES ====================
  // Ces objets permettent la compatibilite avec l'ancien code (flat structure)
  const accounting = useMemo(() => ({
    // Segments
    canViewSegments: gestionComptable.voirSegments,
    canCreateSegment: gestionComptable.creerSegment,
    canUpdateSegment: gestionComptable.modifierSegment,
    canDeleteSegment: gestionComptable.supprimerSegment,
    // Cities
    canViewCities: gestionComptable.voirVilles,
    canCreateCity: gestionComptable.creerVille,
    canUpdateCity: gestionComptable.modifierVille,
    canDeleteCity: gestionComptable.supprimerVille,
    canBulkDeleteCity: gestionComptable.supprimerVillesMasse,
    // Users
    canViewUsers: gestionComptable.voirUtilisateurs,
    canCreateUser: gestionComptable.creerUtilisateur,
    canUpdateUser: gestionComptable.modifierUtilisateur,
    canDeleteUser: gestionComptable.supprimerUtilisateur,
    canAssignSegments: gestionComptable.assignerSegments,
    canAssignCities: gestionComptable.assignerVilles,
    canAssignProfessorCities: gestionComptable.assignerVilles,
    // Professors (map to users)
    canViewProfessor: gestionComptable.voirUtilisateurs,
    canCreateProfessor: gestionComptable.creerUtilisateur,
    canUpdateProfessor: gestionComptable.modifierUtilisateur,
    canDeleteProfessor: gestionComptable.supprimerUtilisateur,
    // Calculation Sheets
    canViewSheet: gestionComptable.voirFiches,
    canCreateSheet: gestionComptable.creerFiche,
    canUpdateSheet: gestionComptable.modifierFiche,
    canEditCalculationSheet: gestionComptable.modifierFiche,
    canDeleteSheet: gestionComptable.supprimerFiche,
    canPublishSheet: gestionComptable.publierFiche,
    canDuplicateSheet: gestionComptable.dupliquerFiche,
    canExportSheet: gestionComptable.exporterFiche,
    canManageSheetSettings: gestionComptable.parametresFiche,
    // Declarations
    canViewDeclarations: gestionComptable.voirDeclarations,
    canViewAllDeclarations: gestionComptable.voirToutesDeclarations,
    canCreateDeclaration: gestionComptable.creerDeclaration,
    canFillData: gestionComptable.remplirDeclaration,
    canEditMetadata: gestionComptable.modifierMetadata,
    canDeleteDeclaration: gestionComptable.supprimerDeclaration,
    canApproveDeclaration: gestionComptable.approuverDeclaration,
    canSubmitDeclaration: gestionComptable.soumettreDeclaration,
    // Import
    canImportCities: gestionComptable.importerVilles,
  }), [gestionComptable]);

  const training = useMemo(() => ({
    // Formations
    canViewFormations: formation.voirFormations,
    canCreateFormation: formation.creerFormation,
    canUpdateFormation: formation.modifierFormation,
    canDeleteFormation: formation.supprimerFormation,
    canDuplicateFormation: formation.dupliquerFormation,
    canCreatePack: formation.creerPack,
    canEditContent: formation.editerContenu,
    // Corps
    canViewCorps: formation.voirFormations,
    canCreateCorps: formation.creerFormation,
    canUpdateCorps: formation.modifierFormation,
    canDeleteCorps: formation.supprimerFormation,
    canDuplicateCorps: formation.dupliquerFormation,
    // Sessions
    canViewSessions: formation.voirSessions,
    canCreateSession: formation.creerSession,
    canUpdateSession: formation.modifierSession,
    canDeleteSession: formation.supprimerSession,
    canAddStudent: formation.ajouterEtudiant,
    // Students
    canViewStudents: formation.voirEtudiants,
    canCreateStudent: formation.creerEtudiant,
    canUpdateStudent: formation.modifierEtudiantListe,
    canDeleteStudent: formation.supprimerEtudiant,
    // Certificate Templates
    canViewTemplates: formation.voirTemplates,
    canCreateTemplate: formation.creerTemplate,
    canCreateFolder: formation.creerDossier,
    canDeleteTemplate: formation.supprimerTemplate,
    canDuplicateTemplate: formation.dupliquerTemplate,
    canEditCanvas: formation.editerCanvas,
    canRenameFolder: formation.renommerTemplate,
    canRenameTemplate: formation.renommerTemplate,
    canDeleteFolder: formation.supprimerTemplate,
    canOrganize: formation.voirTemplates,
    // Certificates
    canViewCertificates: formation.voirTemplates,
    canGenerateCertificate: formation.creerTemplate,
    canDownloadCertificate: formation.voirTemplates,
    canDeleteCertificate: formation.supprimerTemplate,
    // Forums
    canViewForums: formation.voirForums,
    canCreateThread: formation.creerDiscussion,
    canReply: formation.repondre,
    canDeleteForum: formation.supprimerForum,
    canModerate: formation.moderer,
  }), [formation]);

  const hr = useMemo(() => ({
    // Schedules
    canViewSchedules: ressourcesHumaines.voirGestionHoraires,
    canManageModels: ressourcesHumaines.creerModele,
    canManageHolidays: ressourcesHumaines.creerJourFerie,
    canManageOvertime: ressourcesHumaines.creerPeriodeHS,
    canViewRecovery: ressourcesHumaines.voirRecuperation,
    canManageRecovery: ressourcesHumaines.creerPeriodeRecup,
    // Payroll
    canViewPayroll: ressourcesHumaines.voirGestionPaie,
    canManagePeriods: ressourcesHumaines.creerPeriode,
    canCalculate: ressourcesHumaines.calculerPaie,
    canViewPayslips: ressourcesHumaines.voirBulletins,
    canGeneratePayslips: ressourcesHumaines.validerBulletin,
    canExportPayroll: ressourcesHumaines.exporterCnss,
    canManagePayrollConfig: ressourcesHumaines.modifierConfiguration,
    // Attendance
    canViewAttendance: ressourcesHumaines.voirGestionPointage,
    canRecordAttendance: ressourcesHumaines.pointer,
    canCorrectAttendance: ressourcesHumaines.corrigerPointage,
    canImportAttendance: ressourcesHumaines.importerPointage,
    canExportAttendance: ressourcesHumaines.exporterPointage,
    canValidateAttendance: ressourcesHumaines.validerPointage,
    // Employees
    canViewEmployees: ressourcesHumaines.voirDossierEmploye,
    canCreateEmployee: ressourcesHumaines.creerDossier,
    canUpdateEmployee: ressourcesHumaines.modifierDossier,
    canDeleteEmployee: ressourcesHumaines.supprimerDossier,
    canViewSalary: ressourcesHumaines.voirSalaire,
    canViewContracts: ressourcesHumaines.gererContrats,
    canManageDocuments: ressourcesHumaines.gererDocuments,
    canViewDisciplinary: ressourcesHumaines.gererDiscipline,
    // Leaves
    canViewLeaves: ressourcesHumaines.voirValidationDemandes,
    canApproveLeave: ressourcesHumaines.approuverDemande,
    canRejectLeave: ressourcesHumaines.rejeterDemande,
    canRequestLeave: monEspaceRh.creerDemande,
    canManageLeaveTypes: ressourcesHumaines.modifierConfiguration,
    // Settings
    canViewSettings: ressourcesHumaines.voirConfiguration,
    canUpdateSettings: ressourcesHumaines.modifierConfiguration,
    // Schedules
    canManageSchedules: ressourcesHumaines.creerModele,
  }), [ressourcesHumaines, monEspaceRh]);

  return {
    // Verifications generiques
    can,
    canAny,
    canAll,
    canViewPage,
    canAction,
    canOngletAction,
    canAccessSection,

    // Utilitaires
    viewablePages,
    permissions,
    normalizedPermissions, // Permissions avec codes legacy convertis
    isAdmin: user?.role === 'admin',

    // Permissions par section
    gestionComptable,
    formation,
    ressourcesHumaines,
    monEquipe,
    monEspaceRh,
    commercialisation,

    // Legacy aliases
    accounting,
    training,
    hr,
  };
}

// Type pour les codes de permission - utile pour la securite de type
export type PermissionCode =
  // Gestion Comptable
  | 'gestion_comptable.acces'
  | 'gestion_comptable.tableau_de_bord.voir'
  | 'gestion_comptable.segments.voir' | 'gestion_comptable.segments.creer' | 'gestion_comptable.segments.modifier' | 'gestion_comptable.segments.supprimer' | 'gestion_comptable.segments.importer_villes'
  | 'gestion_comptable.villes.voir' | 'gestion_comptable.villes.creer' | 'gestion_comptable.villes.modifier' | 'gestion_comptable.villes.supprimer' | 'gestion_comptable.villes.supprimer_masse'
  | 'gestion_comptable.utilisateurs.voir' | 'gestion_comptable.utilisateurs.creer' | 'gestion_comptable.utilisateurs.modifier' | 'gestion_comptable.utilisateurs.supprimer' | 'gestion_comptable.utilisateurs.assigner_segments' | 'gestion_comptable.utilisateurs.assigner_villes' | 'gestion_comptable.utilisateurs.assigner_roles'
  | 'gestion_comptable.roles_permissions.voir' | 'gestion_comptable.roles_permissions.creer' | 'gestion_comptable.roles_permissions.modifier' | 'gestion_comptable.roles_permissions.supprimer'
  | 'gestion_comptable.fiches_calcul.voir' | 'gestion_comptable.fiches_calcul.creer' | 'gestion_comptable.fiches_calcul.modifier' | 'gestion_comptable.fiches_calcul.supprimer' | 'gestion_comptable.fiches_calcul.publier' | 'gestion_comptable.fiches_calcul.dupliquer' | 'gestion_comptable.fiches_calcul.exporter' | 'gestion_comptable.fiches_calcul.parametres'
  | 'gestion_comptable.declarations.voir' | 'gestion_comptable.declarations.voir_toutes' | 'gestion_comptable.declarations.creer' | 'gestion_comptable.declarations.remplir' | 'gestion_comptable.declarations.modifier_metadata' | 'gestion_comptable.declarations.supprimer' | 'gestion_comptable.declarations.approuver' | 'gestion_comptable.declarations.rejeter' | 'gestion_comptable.declarations.soumettre'
  | 'gestion_comptable.gestion_projet.voir' | 'gestion_comptable.gestion_projet.creer' | 'gestion_comptable.gestion_projet.modifier' | 'gestion_comptable.gestion_projet.supprimer' | 'gestion_comptable.gestion_projet.exporter'
  // Formation
  | 'formation.acces'
  | 'formation.gestion_formations.voir' | 'formation.gestion_formations.creer' | 'formation.gestion_formations.modifier' | 'formation.gestion_formations.supprimer' | 'formation.gestion_formations.dupliquer' | 'formation.gestion_formations.creer_pack' | 'formation.gestion_formations.editer_contenu'
  | 'formation.sessions_formation.voir' | 'formation.sessions_formation.creer' | 'formation.sessions_formation.modifier' | 'formation.sessions_formation.supprimer' | 'formation.sessions_formation.ajouter_etudiant' | 'formation.sessions_formation.modifier_etudiant'
  | 'formation.analytics.voir' | 'formation.analytics.exporter' | 'formation.analytics.changer_periode'
  | 'formation.rapports_etudiants.voir' | 'formation.rapports_etudiants.rechercher' | 'formation.rapports_etudiants.exporter_csv' | 'formation.rapports_etudiants.exporter_pdf'
  | 'formation.liste_etudiants.voir' | 'formation.liste_etudiants.creer' | 'formation.liste_etudiants.modifier' | 'formation.liste_etudiants.supprimer'
  | 'formation.templates_certificats.voir' | 'formation.templates_certificats.creer_dossier' | 'formation.templates_certificats.creer_template' | 'formation.templates_certificats.renommer' | 'formation.templates_certificats.supprimer' | 'formation.templates_certificats.dupliquer' | 'formation.templates_certificats.editer_canvas'
  | 'formation.forums.voir' | 'formation.forums.creer_discussion' | 'formation.forums.repondre' | 'formation.forums.reagir' | 'formation.forums.supprimer' | 'formation.forums.epingler' | 'formation.forums.verrouiller' | 'formation.forums.moderer'
  // Ressources Humaines
  | 'ressources_humaines.acces'
  | 'ressources_humaines.boucles_validation.voir' | 'ressources_humaines.boucles_validation.creer' | 'ressources_humaines.boucles_validation.modifier' | 'ressources_humaines.boucles_validation.supprimer'
  | 'ressources_humaines.gestion_horaires.voir'
  | 'ressources_humaines.gestion_horaires.modeles.creer' | 'ressources_humaines.gestion_horaires.modeles.modifier' | 'ressources_humaines.gestion_horaires.modeles.supprimer'
  | 'ressources_humaines.gestion_horaires.jours_feries.creer' | 'ressources_humaines.gestion_horaires.jours_feries.modifier' | 'ressources_humaines.gestion_horaires.jours_feries.supprimer'
  | 'ressources_humaines.gestion_horaires.conges_valides.voir'
  | 'ressources_humaines.gestion_horaires.heures_sup.voir' | 'ressources_humaines.gestion_horaires.heures_sup.approuver' | 'ressources_humaines.gestion_horaires.heures_sup.rejeter' | 'ressources_humaines.gestion_horaires.heures_sup.creer_periode' | 'ressources_humaines.gestion_horaires.heures_sup.supprimer_periode' | 'ressources_humaines.gestion_horaires.heures_sup.recalculer'
  | 'ressources_humaines.gestion_horaires.config_hs.voir' | 'ressources_humaines.gestion_horaires.config_hs.modifier'
  | 'ressources_humaines.gestion_paie.voir'
  | 'ressources_humaines.gestion_paie.periodes.creer' | 'ressources_humaines.gestion_paie.periodes.ouvrir' | 'ressources_humaines.gestion_paie.periodes.fermer' | 'ressources_humaines.gestion_paie.periodes.supprimer'
  | 'ressources_humaines.gestion_paie.calculs.calculer'
  | 'ressources_humaines.gestion_paie.bulletins.voir' | 'ressources_humaines.gestion_paie.bulletins.valider' | 'ressources_humaines.gestion_paie.bulletins.valider_tous' | 'ressources_humaines.gestion_paie.bulletins.telecharger' | 'ressources_humaines.gestion_paie.bulletins.exporter_cnss' | 'ressources_humaines.gestion_paie.bulletins.exporter_virements'
  | 'ressources_humaines.gestion_paie.tests.voir'
  | 'ressources_humaines.gestion_paie.automatisation.voir' | 'ressources_humaines.gestion_paie.automatisation.configurer'
  | 'ressources_humaines.gestion_paie.configuration.voir' | 'ressources_humaines.gestion_paie.configuration.modifier'
  | 'ressources_humaines.gestion_pointage.voir' | 'ressources_humaines.gestion_pointage.pointer' | 'ressources_humaines.gestion_pointage.corriger' | 'ressources_humaines.gestion_pointage.importer' | 'ressources_humaines.gestion_pointage.exporter' | 'ressources_humaines.gestion_pointage.valider'
  | 'ressources_humaines.dossier_employe.voir' | 'ressources_humaines.dossier_employe.creer' | 'ressources_humaines.dossier_employe.modifier' | 'ressources_humaines.dossier_employe.supprimer' | 'ressources_humaines.dossier_employe.voir_salaire' | 'ressources_humaines.dossier_employe.gerer_contrats' | 'ressources_humaines.dossier_employe.gerer_documents' | 'ressources_humaines.dossier_employe.gerer_discipline'
  | 'ressources_humaines.validation_demandes.voir' | 'ressources_humaines.validation_demandes.approuver' | 'ressources_humaines.validation_demandes.rejeter'
  | 'ressources_humaines.delegations.voir' | 'ressources_humaines.delegations.creer' | 'ressources_humaines.delegations.gerer_toutes'
  // Mon Equipe
  | 'mon_equipe.acces'
  | 'mon_equipe.pointages_equipe.voir' | 'mon_equipe.pointages_equipe.supprimer'
  | 'mon_equipe.demandes_equipe.voir' | 'mon_equipe.demandes_equipe.approuver' | 'mon_equipe.demandes_equipe.rejeter'
  // Mon Espace RH
  | 'mon_espace_rh.acces'
  | 'mon_espace_rh.mon_pointage.voir' | 'mon_espace_rh.mon_pointage.pointer'
  | 'mon_espace_rh.mes_demandes.voir' | 'mon_espace_rh.mes_demandes.creer' | 'mon_espace_rh.mes_demandes.annuler'
  | 'mon_espace_rh.mes_bulletins.voir' | 'mon_espace_rh.mes_bulletins.telecharger'
  // Commercialisation
  | 'commercialisation.acces'
  | 'commercialisation.tableau_de_bord.voir' | 'commercialisation.tableau_de_bord.voir_stats' | 'commercialisation.tableau_de_bord.exporter'
  | 'commercialisation.prospects.voir' | 'commercialisation.prospects.voir_tous' | 'commercialisation.prospects.creer' | 'commercialisation.prospects.modifier' | 'commercialisation.prospects.supprimer' | 'commercialisation.prospects.appeler' | 'commercialisation.prospects.convertir' | 'commercialisation.prospects.importer' | 'commercialisation.prospects.exporter' | 'commercialisation.prospects.assigner' | 'commercialisation.prospects.reinjecter'
  | 'commercialisation.nettoyage_prospects.voir' | 'commercialisation.nettoyage_prospects.nettoyer'
  | 'commercialisation.gestion_gcontacte.voir' | 'commercialisation.gestion_gcontacte.configurer' | 'commercialisation.gestion_gcontacte.synchroniser' | 'commercialisation.gestion_gcontacte.tester';
