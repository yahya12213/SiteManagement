/**
 * SINGLE SOURCE OF TRUTH for all application permissions
 * Structure: {section}.{sous_menu}.{onglet?}.{action}
 *
 * Conventions:
 * - Noms en français alignés avec les menus
 * - Hiérarchie: Section > Sous-menu > Onglet (optionnel) > Action
 * - Chaque permission = un élément UI visible (menu, bouton, onglet)
 */

// ==================== PERMISSIONS ====================
export const PERMISSIONS = {
  // ==================== GESTION COMPTABLE ====================
  gestion_comptable: {
    // Permission de section
    acces: 'gestion_comptable.acces',

    tableau_de_bord: {
      voir: 'gestion_comptable.tableau_de_bord.voir',
    },

    segments: {
      voir: 'gestion_comptable.segments.voir',
      creer: 'gestion_comptable.segments.creer',
      modifier: 'gestion_comptable.segments.modifier',
      supprimer: 'gestion_comptable.segments.supprimer',
      importer_villes: 'gestion_comptable.segments.importer_villes',
    },

    villes: {
      voir: 'gestion_comptable.villes.voir',
      creer: 'gestion_comptable.villes.creer',
      modifier: 'gestion_comptable.villes.modifier',
      supprimer: 'gestion_comptable.villes.supprimer',
      supprimer_masse: 'gestion_comptable.villes.supprimer_masse',
    },

    utilisateurs: {
      voir: 'gestion_comptable.utilisateurs.voir',
      creer: 'gestion_comptable.utilisateurs.creer',
      modifier: 'gestion_comptable.utilisateurs.modifier',
      supprimer: 'gestion_comptable.utilisateurs.supprimer',
      assigner_segments: 'gestion_comptable.utilisateurs.assigner_segments',
      assigner_villes: 'gestion_comptable.utilisateurs.assigner_villes',
      assigner_roles: 'gestion_comptable.utilisateurs.assigner_roles',
    },

    roles_permissions: {
      voir: 'gestion_comptable.roles_permissions.voir',
      creer: 'gestion_comptable.roles_permissions.creer',
      modifier: 'gestion_comptable.roles_permissions.modifier',
      supprimer: 'gestion_comptable.roles_permissions.supprimer',
    },

    fiches_calcul: {
      voir: 'gestion_comptable.fiches_calcul.voir',
      creer: 'gestion_comptable.fiches_calcul.creer',
      modifier: 'gestion_comptable.fiches_calcul.modifier',
      supprimer: 'gestion_comptable.fiches_calcul.supprimer',
      publier: 'gestion_comptable.fiches_calcul.publier',
      dupliquer: 'gestion_comptable.fiches_calcul.dupliquer',
      exporter: 'gestion_comptable.fiches_calcul.exporter',
      parametres: 'gestion_comptable.fiches_calcul.parametres',
    },

    declarations: {
      voir: 'gestion_comptable.declarations.voir',
      voir_toutes: 'gestion_comptable.declarations.voir_toutes',
      creer: 'gestion_comptable.declarations.creer',
      remplir: 'gestion_comptable.declarations.remplir',
      modifier_metadata: 'gestion_comptable.declarations.modifier_metadata',
      supprimer: 'gestion_comptable.declarations.supprimer',
      approuver: 'gestion_comptable.declarations.approuver',
      rejeter: 'gestion_comptable.declarations.rejeter',
      soumettre: 'gestion_comptable.declarations.soumettre',
    },

    gestion_projet: {
      voir: 'gestion_comptable.gestion_projet.voir',
      creer: 'gestion_comptable.gestion_projet.creer',
      modifier: 'gestion_comptable.gestion_projet.modifier',
      supprimer: 'gestion_comptable.gestion_projet.supprimer',
      exporter: 'gestion_comptable.gestion_projet.exporter',
    },
  },

  // ==================== FORMATION ====================
  formation: {
    acces: 'formation.acces',

    gestion_formations: {
      voir: 'formation.gestion_formations.voir',
      creer: 'formation.gestion_formations.creer',
      modifier: 'formation.gestion_formations.modifier',
      supprimer: 'formation.gestion_formations.supprimer',
      dupliquer: 'formation.gestion_formations.dupliquer',
      creer_pack: 'formation.gestion_formations.creer_pack',
      editer_contenu: 'formation.gestion_formations.editer_contenu',
    },

    sessions_formation: {
      voir: 'formation.sessions_formation.voir',
      creer: 'formation.sessions_formation.creer',
      modifier: 'formation.sessions_formation.modifier',
      supprimer: 'formation.sessions_formation.supprimer',
      ajouter_etudiant: 'formation.sessions_formation.ajouter_etudiant',
      modifier_etudiant: 'formation.sessions_formation.modifier_etudiant',
    },

    analytics: {
      voir: 'formation.analytics.voir',
      exporter: 'formation.analytics.exporter',
      changer_periode: 'formation.analytics.changer_periode',
    },

    rapports_etudiants: {
      voir: 'formation.rapports_etudiants.voir',
      rechercher: 'formation.rapports_etudiants.rechercher',
      exporter_csv: 'formation.rapports_etudiants.exporter_csv',
      exporter_pdf: 'formation.rapports_etudiants.exporter_pdf',
    },

    liste_etudiants: {
      voir: 'formation.liste_etudiants.voir',
      creer: 'formation.liste_etudiants.creer',
      modifier: 'formation.liste_etudiants.modifier',
      supprimer: 'formation.liste_etudiants.supprimer',
    },

    templates_certificats: {
      voir: 'formation.templates_certificats.voir',
      creer_dossier: 'formation.templates_certificats.creer_dossier',
      creer_template: 'formation.templates_certificats.creer_template',
      renommer: 'formation.templates_certificats.renommer',
      supprimer: 'formation.templates_certificats.supprimer',
      dupliquer: 'formation.templates_certificats.dupliquer',
      editer_canvas: 'formation.templates_certificats.editer_canvas',
    },

    certificats: {
      voir: 'formation.certificats.voir',
      generer: 'formation.certificats.generer',
      modifier: 'formation.certificats.modifier',
      supprimer: 'formation.certificats.supprimer',
      telecharger: 'formation.certificats.telecharger',
    },

    forums: {
      voir: 'formation.forums.voir',
      creer_discussion: 'formation.forums.creer_discussion',
      repondre: 'formation.forums.repondre',
      reagir: 'formation.forums.reagir',
      supprimer: 'formation.forums.supprimer',
      epingler: 'formation.forums.epingler',
      verrouiller: 'formation.forums.verrouiller',
      moderer: 'formation.forums.moderer',
    },
  },

  // ==================== RESSOURCES HUMAINES ====================
  ressources_humaines: {
    acces: 'ressources_humaines.acces',

    boucles_validation: {
      voir: 'ressources_humaines.boucles_validation.voir',
      creer: 'ressources_humaines.boucles_validation.creer',
      modifier: 'ressources_humaines.boucles_validation.modifier',
      supprimer: 'ressources_humaines.boucles_validation.supprimer',
    },

    gestion_horaires: {
      voir: 'ressources_humaines.gestion_horaires.voir',
      // Onglet Modeles d'Horaires
      modeles: {
        creer: 'ressources_humaines.gestion_horaires.modeles.creer',
        modifier: 'ressources_humaines.gestion_horaires.modeles.modifier',
        supprimer: 'ressources_humaines.gestion_horaires.modeles.supprimer',
      },
      // Onglet Jours Feries
      jours_feries: {
        creer: 'ressources_humaines.gestion_horaires.jours_feries.creer',
        modifier: 'ressources_humaines.gestion_horaires.jours_feries.modifier',
        supprimer: 'ressources_humaines.gestion_horaires.jours_feries.supprimer',
      },
      // Onglet Conges Valides
      conges_valides: {
        voir: 'ressources_humaines.gestion_horaires.conges_valides.voir',
      },
      // Onglet Heures Supplementaires
      heures_sup: {
        voir: 'ressources_humaines.gestion_horaires.heures_sup.voir',
        approuver: 'ressources_humaines.gestion_horaires.heures_sup.approuver',
        rejeter: 'ressources_humaines.gestion_horaires.heures_sup.rejeter',
        creer_periode: 'ressources_humaines.gestion_horaires.heures_sup.creer_periode',
        supprimer_periode: 'ressources_humaines.gestion_horaires.heures_sup.supprimer_periode',
        recalculer: 'ressources_humaines.gestion_horaires.heures_sup.recalculer',
      },
      // Onglet Config HS
      config_hs: {
        voir: 'ressources_humaines.gestion_horaires.config_hs.voir',
        modifier: 'ressources_humaines.gestion_horaires.config_hs.modifier',
      },
      // Onglet Récupération
      recuperation: {
        voir: 'ressources_humaines.gestion_horaires.recuperation.voir',
        creer_periode: 'ressources_humaines.gestion_horaires.recuperation.creer_periode',
        modifier_periode: 'ressources_humaines.gestion_horaires.recuperation.modifier_periode',
        supprimer_periode: 'ressources_humaines.gestion_horaires.recuperation.supprimer_periode',
        declarer_jour: 'ressources_humaines.gestion_horaires.recuperation.declarer_jour',
        modifier_declaration: 'ressources_humaines.gestion_horaires.recuperation.modifier_declaration',
        supprimer_declaration: 'ressources_humaines.gestion_horaires.recuperation.supprimer_declaration',
        verifier: 'ressources_humaines.gestion_horaires.recuperation.verifier',
      },
    },

    gestion_paie: {
      voir: 'ressources_humaines.gestion_paie.voir',
      // Onglet Periodes de Paie
      periodes: {
        creer: 'ressources_humaines.gestion_paie.periodes.creer',
        ouvrir: 'ressources_humaines.gestion_paie.periodes.ouvrir',
        fermer: 'ressources_humaines.gestion_paie.periodes.fermer',
        supprimer: 'ressources_humaines.gestion_paie.periodes.supprimer',
      },
      // Onglet Calculs de Paie
      calculs: {
        calculer: 'ressources_humaines.gestion_paie.calculs.calculer',
      },
      // Onglet Bulletins de Paie
      bulletins: {
        voir: 'ressources_humaines.gestion_paie.bulletins.voir',
        valider: 'ressources_humaines.gestion_paie.bulletins.valider',
        valider_tous: 'ressources_humaines.gestion_paie.bulletins.valider_tous',
        telecharger: 'ressources_humaines.gestion_paie.bulletins.telecharger',
        exporter_cnss: 'ressources_humaines.gestion_paie.bulletins.exporter_cnss',
        exporter_virements: 'ressources_humaines.gestion_paie.bulletins.exporter_virements',
      },
      // Onglet Tests & Logs
      tests: {
        voir: 'ressources_humaines.gestion_paie.tests.voir',
      },
      // Onglet Automatisation
      automatisation: {
        voir: 'ressources_humaines.gestion_paie.automatisation.voir',
        configurer: 'ressources_humaines.gestion_paie.automatisation.configurer',
      },
      // Onglet Configuration
      configuration: {
        voir: 'ressources_humaines.gestion_paie.configuration.voir',
        modifier: 'ressources_humaines.gestion_paie.configuration.modifier',
      },
      // Onglet Attestations de travail
      attestations: {
        voir: 'ressources_humaines.gestion_paie.attestations.voir',
        creer: 'ressources_humaines.gestion_paie.attestations.creer',
        supprimer: 'ressources_humaines.gestion_paie.attestations.supprimer',
        telecharger: 'ressources_humaines.gestion_paie.attestations.telecharger',
      },
      // Vue disciplinaire centralisee
      disciplinaire_vue: {
        voir: 'ressources_humaines.gestion_paie.disciplinaire_vue.voir',
      },
    },

    gestion_pointage: {
      voir: 'ressources_humaines.gestion_pointage.voir',
      pointer: 'ressources_humaines.gestion_pointage.pointer',
      corriger: 'ressources_humaines.gestion_pointage.corriger',
      importer: 'ressources_humaines.gestion_pointage.importer',
      exporter: 'ressources_humaines.gestion_pointage.exporter',
      valider: 'ressources_humaines.gestion_pointage.valider',
    },

    dossier_employe: {
      voir: 'ressources_humaines.dossier_employe.voir',
      creer: 'ressources_humaines.dossier_employe.creer',
      modifier: 'ressources_humaines.dossier_employe.modifier',
      supprimer: 'ressources_humaines.dossier_employe.supprimer',
      voir_salaire: 'ressources_humaines.dossier_employe.voir_salaire',
      gerer_contrats: 'ressources_humaines.dossier_employe.gerer_contrats',
      gerer_documents: 'ressources_humaines.dossier_employe.gerer_documents',
      gerer_discipline: 'ressources_humaines.dossier_employe.gerer_discipline',
    },

    validation_demandes: {
      voir: 'ressources_humaines.validation_demandes.voir',
      approuver: 'ressources_humaines.validation_demandes.approuver',
      rejeter: 'ressources_humaines.validation_demandes.rejeter',
    },

    delegations: {
      voir: 'ressources_humaines.delegations.voir',
      creer: 'ressources_humaines.delegations.creer',
      gerer_toutes: 'ressources_humaines.delegations.gerer_toutes',
    },
  },

  // ==================== MON EQUIPE ====================
  mon_equipe: {
    acces: 'mon_equipe.acces',

    pointages_equipe: {
      voir: 'mon_equipe.pointages_equipe.voir',
      supprimer: 'mon_equipe.pointages_equipe.supprimer',
    },

    demandes_equipe: {
      voir: 'mon_equipe.demandes_equipe.voir',
      approuver: 'mon_equipe.demandes_equipe.approuver',
      rejeter: 'mon_equipe.demandes_equipe.rejeter',
    },
  },

  // ==================== MON ESPACE RH ====================
  mon_espace_rh: {
    acces: 'mon_espace_rh.acces',

    mon_pointage: {
      voir: 'mon_espace_rh.mon_pointage.voir',
      pointer: 'mon_espace_rh.mon_pointage.pointer',
    },

    mes_demandes: {
      voir: 'mon_espace_rh.mes_demandes.voir',
      creer: 'mon_espace_rh.mes_demandes.creer',
      annuler: 'mon_espace_rh.mes_demandes.annuler',
    },

    mes_bulletins: {
      voir: 'mon_espace_rh.mes_bulletins.voir',
      telecharger: 'mon_espace_rh.mes_bulletins.telecharger',
    },
  },

  // ==================== COMMERCIALISATION ====================
  commercialisation: {
    acces: 'commercialisation.acces',

    tableau_de_bord: {
      voir: 'commercialisation.tableau_de_bord.voir',
      voir_stats: 'commercialisation.tableau_de_bord.voir_stats',
      exporter: 'commercialisation.tableau_de_bord.exporter',
    },

    prospects: {
      voir: 'commercialisation.prospects.voir',
      voir_tous: 'commercialisation.prospects.voir_tous',
      creer: 'commercialisation.prospects.creer',
      modifier: 'commercialisation.prospects.modifier',
      supprimer: 'commercialisation.prospects.supprimer',
      appeler: 'commercialisation.prospects.appeler',
      convertir: 'commercialisation.prospects.convertir',
      importer: 'commercialisation.prospects.importer',
      exporter: 'commercialisation.prospects.exporter',
      assigner: 'commercialisation.prospects.assigner',
      reinjecter: 'commercialisation.prospects.reinjecter',
      // Legacy aliases
      view_page: 'commercialisation.prospects.voir',
      view_all: 'commercialisation.prospects.voir_tous',
      create: 'commercialisation.prospects.creer',
      edit: 'commercialisation.prospects.modifier',
      update: 'commercialisation.prospects.modifier',
      delete: 'commercialisation.prospects.supprimer',
      call: 'commercialisation.prospects.appeler',
      convert: 'commercialisation.prospects.convertir',
      import: 'commercialisation.prospects.importer',
      export: 'commercialisation.prospects.exporter',
      assign: 'commercialisation.prospects.assigner',
      reinject: 'commercialisation.prospects.reinjecter',
      clean: 'commercialisation.nettoyage_prospects.nettoyer',
    },

    nettoyage_prospects: {
      voir: 'commercialisation.nettoyage_prospects.voir',
      nettoyer: 'commercialisation.nettoyage_prospects.nettoyer',
    },

    gestion_gcontacte: {
      voir: 'commercialisation.gestion_gcontacte.voir',
      configurer: 'commercialisation.gestion_gcontacte.configurer',
      synchroniser: 'commercialisation.gestion_gcontacte.synchroniser',
      tester: 'commercialisation.gestion_gcontacte.tester',
    },

    analyse_publicite: {
      voir: 'commercialisation.analyse_publicite.voir',
      creer: 'commercialisation.analyse_publicite.creer',
      modifier: 'commercialisation.analyse_publicite.modifier',
      supprimer: 'commercialisation.analyse_publicite.supprimer',
      exporter: 'commercialisation.analyse_publicite.exporter',
    },

    // ===== LEGACY ALIASES (commercialisation.*) =====
    dashboard: {
      view_page: 'commercialisation.tableau_de_bord.voir',
      view_stats: 'commercialisation.tableau_de_bord.voir_stats',
      export: 'commercialisation.tableau_de_bord.exporter',
    },
    clients: {
      view_page: 'commercialisation.prospects.voir',
      create: 'commercialisation.prospects.creer',
      update: 'commercialisation.prospects.modifier',
      delete: 'commercialisation.prospects.supprimer',
    },
    visits: {
      view_page: 'commercialisation.prospects.voir',
      create: 'commercialisation.prospects.creer',
      update: 'commercialisation.prospects.modifier',
      delete: 'commercialisation.prospects.supprimer',
    },
    google_contacts: {
      view_page: 'commercialisation.gestion_gcontacte.voir',
      configure: 'commercialisation.gestion_gcontacte.configurer',
      sync: 'commercialisation.gestion_gcontacte.synchroniser',
      test: 'commercialisation.gestion_gcontacte.tester',
    },
    devis: {
      view_page: 'commercialisation.prospects.voir',
      create: 'commercialisation.prospects.creer',
      update: 'commercialisation.prospects.modifier',
      delete: 'commercialisation.prospects.supprimer',
    },
    contrats: {
      view_page: 'commercialisation.prospects.voir',
      create: 'commercialisation.prospects.creer',
      update: 'commercialisation.prospects.modifier',
      delete: 'commercialisation.prospects.supprimer',
    },
  },

  // =====================================================
  // LEGACY ALIASES - Pour compatibilite avec ancien code
  // =====================================================

  // ===== ACCOUNTING -> GESTION_COMPTABLE =====
  accounting: {
    dashboard: {
      view_page: 'gestion_comptable.tableau_de_bord.voir',
    },
    segments: {
      view_page: 'gestion_comptable.segments.voir',
      create: 'gestion_comptable.segments.creer',
      update: 'gestion_comptable.segments.modifier',
      delete: 'gestion_comptable.segments.supprimer',
      import_cities: 'gestion_comptable.segments.importer_villes',
    },
    cities: {
      view_page: 'gestion_comptable.villes.voir',
      create: 'gestion_comptable.villes.creer',
      update: 'gestion_comptable.villes.modifier',
      delete: 'gestion_comptable.villes.supprimer',
      bulk_delete: 'gestion_comptable.villes.supprimer_masse',
    },
    users: {
      view_page: 'gestion_comptable.utilisateurs.voir',
      create: 'gestion_comptable.utilisateurs.creer',
      update: 'gestion_comptable.utilisateurs.modifier',
      delete: 'gestion_comptable.utilisateurs.supprimer',
      assign_segments: 'gestion_comptable.utilisateurs.assigner_segments',
      assign_cities: 'gestion_comptable.utilisateurs.assigner_villes',
      assign_roles: 'gestion_comptable.utilisateurs.assigner_roles',
    },
    calculation_sheets: {
      view_page: 'gestion_comptable.fiches_calcul.voir',
      create: 'gestion_comptable.fiches_calcul.creer',
      update: 'gestion_comptable.fiches_calcul.modifier',
      edit: 'gestion_comptable.fiches_calcul.modifier',
      delete: 'gestion_comptable.fiches_calcul.supprimer',
      publish: 'gestion_comptable.fiches_calcul.publier',
      duplicate: 'gestion_comptable.fiches_calcul.dupliquer',
      export: 'gestion_comptable.fiches_calcul.exporter',
      settings: 'gestion_comptable.fiches_calcul.parametres',
    },
    professor: {
      view_page: 'gestion_comptable.utilisateurs.voir',
      create: 'gestion_comptable.utilisateurs.creer',
      update: 'gestion_comptable.utilisateurs.modifier',
      delete: 'gestion_comptable.utilisateurs.supprimer',
      declarations: {
        view_page: 'gestion_comptable.declarations.voir',
        create: 'gestion_comptable.declarations.creer',
        fill: 'gestion_comptable.declarations.remplir',
      },
    },
    declarations: {
      view_page: 'gestion_comptable.declarations.voir',
      view_all: 'gestion_comptable.declarations.voir_toutes',
      create: 'gestion_comptable.declarations.creer',
      fill_data: 'gestion_comptable.declarations.remplir',
      edit_metadata: 'gestion_comptable.declarations.modifier_metadata',
      delete: 'gestion_comptable.declarations.supprimer',
      approve: 'gestion_comptable.declarations.approuver',
      reject: 'gestion_comptable.declarations.rejeter',
      submit: 'gestion_comptable.declarations.soumettre',
    },
    actions: {
      view_page: 'gestion_comptable.gestion_projet.voir',
      create: 'gestion_comptable.gestion_projet.creer',
      update: 'gestion_comptable.gestion_projet.modifier',
      delete: 'gestion_comptable.gestion_projet.supprimer',
    },
    projects: {
      view_page: 'gestion_comptable.gestion_projet.voir',
      create: 'gestion_comptable.gestion_projet.creer',
      update: 'gestion_comptable.gestion_projet.modifier',
      delete: 'gestion_comptable.gestion_projet.supprimer',
      export: 'gestion_comptable.gestion_projet.exporter',
    },
  },

  // ===== SYSTEM -> GESTION_COMPTABLE (roles_permissions) =====
  system: {
    roles: {
      view_page: 'gestion_comptable.roles_permissions.voir',
      create: 'gestion_comptable.roles_permissions.creer',
      update: 'gestion_comptable.roles_permissions.modifier',
      delete: 'gestion_comptable.roles_permissions.supprimer',
    },
    users: {
      view_page: 'gestion_comptable.utilisateurs.voir',
      create: 'gestion_comptable.utilisateurs.creer',
      update: 'gestion_comptable.utilisateurs.modifier',
      delete: 'gestion_comptable.utilisateurs.supprimer',
      assign_roles: 'gestion_comptable.utilisateurs.assigner_roles',
    },
  },

  // ===== TRAINING -> FORMATION =====
  training: {
    formations: {
      view_page: 'formation.gestion_formations.voir',
      create: 'formation.gestion_formations.creer',
      update: 'formation.gestion_formations.modifier',
      delete: 'formation.gestion_formations.supprimer',
      duplicate: 'formation.gestion_formations.dupliquer',
      create_pack: 'formation.gestion_formations.creer_pack',
      edit_content: 'formation.gestion_formations.editer_contenu',
    },
    corps: {
      view_page: 'formation.gestion_formations.voir',
      create: 'formation.gestion_formations.creer',
      update: 'formation.gestion_formations.modifier',
      delete: 'formation.gestion_formations.supprimer',
    },
    sessions: {
      view_page: 'formation.sessions_formation.voir',
      create: 'formation.sessions_formation.creer',
      update: 'formation.sessions_formation.modifier',
      delete: 'formation.sessions_formation.supprimer',
      add_student: 'formation.sessions_formation.ajouter_etudiant',
      edit_student: 'formation.sessions_formation.modifier_etudiant',
    },
    analytics: {
      view_page: 'formation.analytics.voir',
      export: 'formation.analytics.exporter',
      change_period: 'formation.analytics.changer_periode',
    },
    student_reports: {
      view_page: 'formation.rapports_etudiants.voir',
      search: 'formation.rapports_etudiants.rechercher',
      export_csv: 'formation.rapports_etudiants.exporter_csv',
      export_pdf: 'formation.rapports_etudiants.exporter_pdf',
      export: 'formation.rapports_etudiants.exporter_csv',
    },
    students: {
      view_page: 'formation.liste_etudiants.voir',
      create: 'formation.liste_etudiants.creer',
      update: 'formation.liste_etudiants.modifier',
      delete: 'formation.liste_etudiants.supprimer',
    },
    student: {
      view_page: 'formation.liste_etudiants.voir',
      create: 'formation.liste_etudiants.creer',
      update: 'formation.liste_etudiants.modifier',
      delete: 'formation.liste_etudiants.supprimer',
      // Nested sections for student portal
      dashboard: {
        view_page: 'formation.liste_etudiants.voir',
      },
      catalog: {
        view_page: 'formation.gestion_formations.voir',
      },
      course: {
        view_page: 'formation.gestion_formations.voir',
        view: 'formation.gestion_formations.voir',
        take: 'formation.sessions_formation.voir',
        complete: 'formation.sessions_formation.voir',
        videos: {
          view: 'formation.gestion_formations.voir',
          view_page: 'formation.gestion_formations.voir',
        },
        tests: {
          take: 'formation.sessions_formation.voir',
          view: 'formation.sessions_formation.voir',
        },
      },
      certificates: {
        view_page: 'formation.templates_certificats.voir',
        view: 'formation.templates_certificats.voir',
        download: 'formation.templates_certificats.voir',
      },
      forums: {
        view_page: 'formation.forums.voir',
        create_thread: 'formation.forums.creer_discussion',
        reply: 'formation.forums.repondre',
        participate: 'formation.forums.voir',
      },
    },
    certificate_templates: {
      view_page: 'formation.templates_certificats.voir',
      create_folder: 'formation.templates_certificats.creer_dossier',
      create: 'formation.templates_certificats.creer_template',
      create_template: 'formation.templates_certificats.creer_template',
      rename: 'formation.templates_certificats.renommer',
      delete_template: 'formation.templates_certificats.supprimer',
      delete: 'formation.templates_certificats.supprimer',
      duplicate: 'formation.templates_certificats.dupliquer',
      edit_canvas: 'formation.templates_certificats.editer_canvas',
      organize: 'formation.templates_certificats.voir',
    },
    certificates: {
      view_page: 'formation.templates_certificats.voir',
      generate: 'formation.templates_certificats.creer_template',
      download: 'formation.templates_certificats.voir',
    },
    forums: {
      view_page: 'formation.forums.voir',
      create_thread: 'formation.forums.creer_discussion',
      reply: 'formation.forums.repondre',
      react: 'formation.forums.reagir',
      delete: 'formation.forums.supprimer',
      pin: 'formation.forums.epingler',
      lock: 'formation.forums.verrouiller',
      moderate: 'formation.forums.moderer',
    },
  },

  // ===== HR -> RESSOURCES_HUMAINES =====
  hr: {
    validation_workflows: {
      view_page: 'ressources_humaines.boucles_validation.voir',
      create: 'ressources_humaines.boucles_validation.creer',
      update: 'ressources_humaines.boucles_validation.modifier',
      delete: 'ressources_humaines.boucles_validation.supprimer',
    },
    schedules: {
      view_page: 'ressources_humaines.gestion_horaires.voir',
      manage_models: 'ressources_humaines.gestion_horaires.modeles.creer',
      manage_holidays: 'ressources_humaines.gestion_horaires.jours_feries.creer',
      manage_overtime: 'ressources_humaines.gestion_horaires.heures_sup.creer_periode',
    },
    payroll: {
      view_page: 'ressources_humaines.gestion_paie.voir',
      manage_periods: 'ressources_humaines.gestion_paie.periodes.creer',
      calculate: 'ressources_humaines.gestion_paie.calculs.calculer',
      view_payslips: 'ressources_humaines.gestion_paie.bulletins.voir',
      generate_payslips: 'ressources_humaines.gestion_paie.bulletins.valider',
      validate_payslip: 'ressources_humaines.gestion_paie.bulletins.valider',
      validate_all: 'ressources_humaines.gestion_paie.bulletins.valider_tous',
      download: 'ressources_humaines.gestion_paie.bulletins.telecharger',
      export_cnss: 'ressources_humaines.gestion_paie.bulletins.exporter_cnss',
      export_transfers: 'ressources_humaines.gestion_paie.bulletins.exporter_virements',
      manage_config: 'ressources_humaines.gestion_paie.configuration.modifier',
    },
    employee_portal: {
      view_page: 'ressources_humaines.gestion_pointage.voir',
      clock_in_out: 'ressources_humaines.gestion_pointage.pointer',
    },
    attendance: {
      view_page: 'ressources_humaines.gestion_pointage.voir',
      clock: 'ressources_humaines.gestion_pointage.pointer',
      correct: 'ressources_humaines.gestion_pointage.corriger',
      import: 'ressources_humaines.gestion_pointage.importer',
      export: 'ressources_humaines.gestion_pointage.exporter',
      validate: 'ressources_humaines.gestion_pointage.valider',
    },
    employees: {
      view_page: 'ressources_humaines.dossier_employe.voir',
      create: 'ressources_humaines.dossier_employe.creer',
      update: 'ressources_humaines.dossier_employe.modifier',
      delete: 'ressources_humaines.dossier_employe.supprimer',
      view_salary: 'ressources_humaines.dossier_employe.voir_salaire',
      manage_contracts: 'ressources_humaines.dossier_employe.gerer_contrats',
      manage_documents: 'ressources_humaines.dossier_employe.gerer_documents',
      manage_discipline: 'ressources_humaines.dossier_employe.gerer_discipline',
    },
    requests_validation: {
      view_page: 'ressources_humaines.validation_demandes.voir',
      approve: 'ressources_humaines.validation_demandes.approuver',
      reject: 'ressources_humaines.validation_demandes.rejeter',
    },
    leaves: {
      view_page: 'ressources_humaines.validation_demandes.voir',
      approve: 'ressources_humaines.validation_demandes.approuver',
      reject: 'ressources_humaines.validation_demandes.rejeter',
      create: 'mon_espace_rh.mes_demandes.creer',
    },
    delegation: {
      view_page: 'ressources_humaines.delegations.voir',
      create: 'ressources_humaines.delegations.creer',
      manage_all: 'ressources_humaines.delegations.gerer_toutes',
    },
    recovery: {
      view_page: 'ressources_humaines.gestion_horaires.recuperation.voir',
      manage: 'ressources_humaines.gestion_horaires.recuperation.creer_periode',
    },
    settings: {
      view_page: 'ressources_humaines.gestion_paie.configuration.voir',
      update: 'ressources_humaines.gestion_paie.configuration.modifier',
    },
    dashboard: {
      view_page: 'ressources_humaines.gestion_pointage.voir',
    },
    manager: {
      team_attendance: 'mon_equipe.pointages_equipe.voir',
      team_requests: 'mon_equipe.demandes_equipe.voir',
      approve_requests: 'mon_equipe.demandes_equipe.approuver',
      reject_requests: 'mon_equipe.demandes_equipe.rejeter',
    },
    clocking: {
      self: 'mon_espace_rh.mon_pointage.voir',
      view_own: 'mon_espace_rh.mon_pointage.voir',
      clock: 'mon_espace_rh.mon_pointage.pointer',
    },
    my: {
      requests: 'mon_espace_rh.mes_demandes.voir',
      payslips: 'mon_espace_rh.mes_bulletins.voir',
    },
  },

  // ===== MANAGER -> MON_EQUIPE =====
  manager: {
    team_attendance: {
      view_page: 'mon_equipe.pointages_equipe.voir',
      delete: 'mon_equipe.pointages_equipe.supprimer',
    },
    team_requests: {
      view_page: 'mon_equipe.demandes_equipe.voir',
      approve: 'mon_equipe.demandes_equipe.approuver',
      reject: 'mon_equipe.demandes_equipe.rejeter',
    },
  },

  // ===== EMPLOYEE -> MON_ESPACE_RH =====
  employee: {
    clocking: {
      view_page: 'mon_espace_rh.mon_pointage.voir',
      clock: 'mon_espace_rh.mon_pointage.pointer',
    },
    requests: {
      view_page: 'mon_espace_rh.mes_demandes.voir',
      create: 'mon_espace_rh.mes_demandes.creer',
      cancel: 'mon_espace_rh.mes_demandes.annuler',
    },
    payslips: {
      view_page: 'mon_espace_rh.mes_bulletins.voir',
      download: 'mon_espace_rh.mes_bulletins.telecharger',
    },
  },
} as const;

// ==================== TYPE UTILITIES ====================
export type PermissionModule = keyof typeof PERMISSIONS;

// Helper to get all permissions as flat array
export function getAllPermissionCodes(): string[] {
  const codes: string[] = [];

  const extractCodes = (obj: unknown, prefix = ''): void => {
    if (typeof obj === 'string') {
      codes.push(obj);
    } else if (typeof obj === 'object' && obj !== null) {
      Object.entries(obj).forEach(([key, value]) => {
        extractCodes(value, prefix ? `${prefix}.${key}` : key);
      });
    }
  };

  extractCodes(PERMISSIONS);
  return codes;
}

// Helper to validate if a permission code exists
export function isValidPermission(code: string): boolean {
  return getAllPermissionCodes().includes(code);
}

// ==================== PERMISSION LABELS (French) ====================
export function getPermissionLabel(code: string): string {
  const labels: Record<string, string> = {
    // ==================== GESTION COMPTABLE ====================
    'gestion_comptable.acces': 'Acces Gestion Comptable',

    // Tableau de bord
    'gestion_comptable.tableau_de_bord.voir': 'Voir le tableau de bord',

    // Segments
    'gestion_comptable.segments.voir': 'Voir les segments',
    'gestion_comptable.segments.creer': 'Creer un segment',
    'gestion_comptable.segments.modifier': 'Modifier un segment',
    'gestion_comptable.segments.supprimer': 'Supprimer un segment',
    'gestion_comptable.segments.importer_villes': 'Importer des villes',

    // Villes
    'gestion_comptable.villes.voir': 'Voir les villes',
    'gestion_comptable.villes.creer': 'Creer une ville',
    'gestion_comptable.villes.modifier': 'Modifier une ville',
    'gestion_comptable.villes.supprimer': 'Supprimer une ville',
    'gestion_comptable.villes.supprimer_masse': 'Supprimer en masse',

    // Utilisateurs
    'gestion_comptable.utilisateurs.voir': 'Voir les utilisateurs',
    'gestion_comptable.utilisateurs.creer': 'Creer un utilisateur',
    'gestion_comptable.utilisateurs.modifier': 'Modifier un utilisateur',
    'gestion_comptable.utilisateurs.supprimer': 'Supprimer un utilisateur',
    'gestion_comptable.utilisateurs.assigner_segments': 'Assigner des segments',
    'gestion_comptable.utilisateurs.assigner_villes': 'Assigner des villes',
    'gestion_comptable.utilisateurs.assigner_roles': 'Assigner des roles',

    // Roles & Permissions
    'gestion_comptable.roles_permissions.voir': 'Voir les roles et permissions',
    'gestion_comptable.roles_permissions.creer': 'Creer un role',
    'gestion_comptable.roles_permissions.modifier': 'Modifier un role',
    'gestion_comptable.roles_permissions.supprimer': 'Supprimer un role',

    // Fiches de calcul
    'gestion_comptable.fiches_calcul.voir': 'Voir les fiches de calcul',
    'gestion_comptable.fiches_calcul.creer': 'Creer une fiche',
    'gestion_comptable.fiches_calcul.modifier': 'Modifier une fiche',
    'gestion_comptable.fiches_calcul.supprimer': 'Supprimer une fiche',
    'gestion_comptable.fiches_calcul.publier': 'Publier une fiche',
    'gestion_comptable.fiches_calcul.dupliquer': 'Dupliquer une fiche',
    'gestion_comptable.fiches_calcul.exporter': 'Exporter une fiche',
    'gestion_comptable.fiches_calcul.parametres': 'Parametres des fiches',

    // Declarations
    'gestion_comptable.declarations.voir': 'Voir les declarations',
    'gestion_comptable.declarations.voir_toutes': 'Voir toutes les declarations',
    'gestion_comptable.declarations.creer': 'Creer une declaration',
    'gestion_comptable.declarations.remplir': 'Remplir une declaration',
    'gestion_comptable.declarations.modifier_metadata': 'Modifier les metadonnees',
    'gestion_comptable.declarations.supprimer': 'Supprimer une declaration',
    'gestion_comptable.declarations.approuver': 'Approuver une declaration',
    'gestion_comptable.declarations.rejeter': 'Rejeter une declaration',
    'gestion_comptable.declarations.soumettre': 'Soumettre une declaration',

    // Gestion de Projet
    'gestion_comptable.gestion_projet.voir': 'Voir les projets',
    'gestion_comptable.gestion_projet.creer': 'Creer un projet',
    'gestion_comptable.gestion_projet.modifier': 'Modifier un projet',
    'gestion_comptable.gestion_projet.supprimer': 'Supprimer un projet',
    'gestion_comptable.gestion_projet.exporter': 'Exporter les projets',

    // ==================== FORMATION ====================
    'formation.acces': 'Acces Formation',

    // Gestion des Formations
    'formation.gestion_formations.voir': 'Voir les formations',
    'formation.gestion_formations.creer': 'Creer une formation',
    'formation.gestion_formations.modifier': 'Modifier une formation',
    'formation.gestion_formations.supprimer': 'Supprimer une formation',
    'formation.gestion_formations.dupliquer': 'Dupliquer une formation',
    'formation.gestion_formations.creer_pack': 'Creer un pack',
    'formation.gestion_formations.editer_contenu': 'Editer le contenu',

    // Sessions de Formation
    'formation.sessions_formation.voir': 'Voir les sessions',
    'formation.sessions_formation.creer': 'Creer une session',
    'formation.sessions_formation.modifier': 'Modifier une session',
    'formation.sessions_formation.supprimer': 'Supprimer une session',
    'formation.sessions_formation.ajouter_etudiant': 'Ajouter un etudiant',
    'formation.sessions_formation.modifier_etudiant': 'Modifier un etudiant',

    // Analytics
    'formation.analytics.voir': 'Voir les analytics',
    'formation.analytics.exporter': 'Exporter les analytics',
    'formation.analytics.changer_periode': 'Changer la periode',

    // Rapports Etudiants
    'formation.rapports_etudiants.voir': 'Voir les rapports',
    'formation.rapports_etudiants.rechercher': 'Rechercher',
    'formation.rapports_etudiants.exporter_csv': 'Exporter en CSV',
    'formation.rapports_etudiants.exporter_pdf': 'Exporter en PDF',

    // Liste des Etudiants
    'formation.liste_etudiants.voir': 'Voir les etudiants',
    'formation.liste_etudiants.creer': 'Creer un etudiant',
    'formation.liste_etudiants.modifier': 'Modifier un etudiant',
    'formation.liste_etudiants.supprimer': 'Supprimer un etudiant',

    // Templates de Certificats
    'formation.templates_certificats.voir': 'Voir les templates',
    'formation.templates_certificats.creer_dossier': 'Creer un dossier',
    'formation.templates_certificats.creer_template': 'Creer un template',
    'formation.templates_certificats.renommer': 'Renommer',
    'formation.templates_certificats.supprimer': 'Supprimer',
    'formation.templates_certificats.dupliquer': 'Dupliquer',
    'formation.templates_certificats.editer_canvas': 'Editer le canvas',

    // Forums
    'formation.forums.voir': 'Voir les forums',
    'formation.forums.creer_discussion': 'Creer une discussion',
    'formation.forums.repondre': 'Repondre',
    'formation.forums.reagir': 'Reagir',
    'formation.forums.supprimer': 'Supprimer',
    'formation.forums.epingler': 'Epingler',
    'formation.forums.verrouiller': 'Verrouiller',
    'formation.forums.moderer': 'Moderer',

    // ==================== RESSOURCES HUMAINES ====================
    'ressources_humaines.acces': 'Acces Ressources Humaines',

    // Boucles de Validation
    'ressources_humaines.boucles_validation.voir': 'Voir les boucles de validation',
    'ressources_humaines.boucles_validation.creer': 'Creer une boucle',
    'ressources_humaines.boucles_validation.modifier': 'Modifier une boucle',
    'ressources_humaines.boucles_validation.supprimer': 'Supprimer une boucle',

    // Gestion des Horaires
    'ressources_humaines.gestion_horaires.voir': 'Voir la gestion des horaires',
    'ressources_humaines.gestion_horaires.modeles.creer': 'Creer un modele d\'horaire',
    'ressources_humaines.gestion_horaires.modeles.modifier': 'Modifier un modele',
    'ressources_humaines.gestion_horaires.modeles.supprimer': 'Supprimer un modele',
    'ressources_humaines.gestion_horaires.jours_feries.creer': 'Creer un jour ferie',
    'ressources_humaines.gestion_horaires.jours_feries.modifier': 'Modifier un jour ferie',
    'ressources_humaines.gestion_horaires.jours_feries.supprimer': 'Supprimer un jour ferie',
    'ressources_humaines.gestion_horaires.conges_valides.voir': 'Voir les conges valides',
    'ressources_humaines.gestion_horaires.heures_sup.voir': 'Voir les heures supplementaires',
    'ressources_humaines.gestion_horaires.heures_sup.approuver': 'Approuver les heures sup',
    'ressources_humaines.gestion_horaires.heures_sup.rejeter': 'Rejeter les heures sup',
    'ressources_humaines.gestion_horaires.heures_sup.creer_periode': 'Creer une periode HS',
    'ressources_humaines.gestion_horaires.heures_sup.supprimer_periode': 'Supprimer une periode HS',
    'ressources_humaines.gestion_horaires.heures_sup.recalculer': 'Recalculer les heures sup',
    'ressources_humaines.gestion_horaires.config_hs.voir': 'Voir la config HS',
    'ressources_humaines.gestion_horaires.config_hs.modifier': 'Modifier la config HS',

    // Gestion de Paie
    'ressources_humaines.gestion_paie.voir': 'Voir la gestion de paie',
    'ressources_humaines.gestion_paie.periodes.creer': 'Creer une periode de paie',
    'ressources_humaines.gestion_paie.periodes.ouvrir': 'Ouvrir une periode',
    'ressources_humaines.gestion_paie.periodes.fermer': 'Fermer une periode',
    'ressources_humaines.gestion_paie.periodes.supprimer': 'Supprimer une periode',
    'ressources_humaines.gestion_paie.calculs.calculer': 'Calculer la paie',
    'ressources_humaines.gestion_paie.bulletins.voir': 'Voir les bulletins',
    'ressources_humaines.gestion_paie.bulletins.valider': 'Valider un bulletin',
    'ressources_humaines.gestion_paie.bulletins.valider_tous': 'Valider tous les bulletins',
    'ressources_humaines.gestion_paie.bulletins.telecharger': 'Telecharger un bulletin',
    'ressources_humaines.gestion_paie.bulletins.exporter_cnss': 'Exporter CNSS',
    'ressources_humaines.gestion_paie.bulletins.exporter_virements': 'Exporter virements',
    'ressources_humaines.gestion_paie.tests.voir': 'Voir les tests et logs',
    'ressources_humaines.gestion_paie.automatisation.voir': 'Voir l\'automatisation',
    'ressources_humaines.gestion_paie.automatisation.configurer': 'Configurer l\'automatisation',
    'ressources_humaines.gestion_paie.configuration.voir': 'Voir la configuration paie',
    'ressources_humaines.gestion_paie.configuration.modifier': 'Modifier la configuration paie',

    // Gestion Pointage
    'ressources_humaines.gestion_pointage.voir': 'Voir le pointage',
    'ressources_humaines.gestion_pointage.pointer': 'Pointer',
    'ressources_humaines.gestion_pointage.corriger': 'Corriger le pointage',
    'ressources_humaines.gestion_pointage.importer': 'Importer le pointage',
    'ressources_humaines.gestion_pointage.exporter': 'Exporter le pointage',
    'ressources_humaines.gestion_pointage.valider': 'Valider le pointage',

    // Dossier Employe
    'ressources_humaines.dossier_employe.voir': 'Voir les dossiers employes',
    'ressources_humaines.dossier_employe.creer': 'Creer un dossier',
    'ressources_humaines.dossier_employe.modifier': 'Modifier un dossier',
    'ressources_humaines.dossier_employe.supprimer': 'Supprimer un dossier',
    'ressources_humaines.dossier_employe.voir_salaire': 'Voir le salaire',
    'ressources_humaines.dossier_employe.gerer_contrats': 'Gerer les contrats',
    'ressources_humaines.dossier_employe.gerer_documents': 'Gerer les documents',
    'ressources_humaines.dossier_employe.gerer_discipline': 'Gerer la discipline',

    // Validation des Demandes
    'ressources_humaines.validation_demandes.voir': 'Voir les demandes a valider',
    'ressources_humaines.validation_demandes.approuver': 'Approuver une demande',
    'ressources_humaines.validation_demandes.rejeter': 'Rejeter une demande',

    // Delegations
    'ressources_humaines.delegations.voir': 'Voir les delegations',
    'ressources_humaines.delegations.creer': 'Creer une delegation',
    'ressources_humaines.delegations.gerer_toutes': 'Gerer toutes les delegations',

    // ==================== MON EQUIPE ====================
    'mon_equipe.acces': 'Acces Mon Equipe',

    // Pointages equipe
    'mon_equipe.pointages_equipe.voir': 'Voir les pointages de l\'equipe',
    'mon_equipe.pointages_equipe.supprimer': 'Supprimer un pointage',

    // Demandes equipe
    'mon_equipe.demandes_equipe.voir': 'Voir les demandes de l\'equipe',
    'mon_equipe.demandes_equipe.approuver': 'Approuver une demande',
    'mon_equipe.demandes_equipe.rejeter': 'Rejeter une demande',

    // ==================== MON ESPACE RH ====================
    'mon_espace_rh.acces': 'Acces Mon Espace RH',

    // Mon Pointage
    'mon_espace_rh.mon_pointage.voir': 'Voir mon pointage',
    'mon_espace_rh.mon_pointage.pointer': 'Pointer',

    // Mes Demandes
    'mon_espace_rh.mes_demandes.voir': 'Voir mes demandes',
    'mon_espace_rh.mes_demandes.creer': 'Creer une demande',
    'mon_espace_rh.mes_demandes.annuler': 'Annuler une demande',

    // Mes Bulletins
    'mon_espace_rh.mes_bulletins.voir': 'Voir mes bulletins',
    'mon_espace_rh.mes_bulletins.telecharger': 'Telecharger un bulletin',

    // ==================== COMMERCIALISATION ====================
    'commercialisation.acces': 'Acces Commercialisation',

    // Tableau de bord
    'commercialisation.tableau_de_bord.voir': 'Voir le tableau de bord',
    'commercialisation.tableau_de_bord.voir_stats': 'Voir les statistiques',
    'commercialisation.tableau_de_bord.exporter': 'Exporter',

    // Prospects
    'commercialisation.prospects.voir': 'Voir les prospects',
    'commercialisation.prospects.voir_tous': 'Voir tous les prospects',
    'commercialisation.prospects.creer': 'Creer un prospect',
    'commercialisation.prospects.modifier': 'Modifier un prospect',
    'commercialisation.prospects.supprimer': 'Supprimer un prospect',
    'commercialisation.prospects.appeler': 'Appeler un prospect',
    'commercialisation.prospects.convertir': 'Convertir un prospect',
    'commercialisation.prospects.importer': 'Importer des prospects',
    'commercialisation.prospects.exporter': 'Exporter des prospects',
    'commercialisation.prospects.assigner': 'Assigner un prospect',
    'commercialisation.prospects.reinjecter': 'Reinjecter un prospect',

    // Nettoyage Prospects
    'commercialisation.nettoyage_prospects.voir': 'Voir le nettoyage prospects',
    'commercialisation.nettoyage_prospects.nettoyer': 'Nettoyer les prospects',

    // Gestion G-Contacte
    'commercialisation.gestion_gcontacte.voir': 'Voir G-Contacte',
    'commercialisation.gestion_gcontacte.configurer': 'Configurer G-Contacte',
    'commercialisation.gestion_gcontacte.synchroniser': 'Synchroniser',
    'commercialisation.gestion_gcontacte.tester': 'Tester la connexion',

    // Analyse Publicite
    'commercialisation.analyse_publicite.voir': 'Voir l\'analyse publicite',
    'commercialisation.analyse_publicite.creer': 'Saisir les stats Facebook',
    'commercialisation.analyse_publicite.modifier': 'Modifier les stats Facebook',
    'commercialisation.analyse_publicite.supprimer': 'Supprimer les stats Facebook',
    'commercialisation.analyse_publicite.exporter': 'Exporter les analyses',
  };

  return labels[code] || code;
}

// ==================== LEGACY MAPPING ====================
// Mapping from old permission codes to new ones for backward compatibility
export const LEGACY_PERMISSION_MAPPING: Record<string, string> = {
  // Accounting -> Gestion Comptable
  'accounting.dashboard.view_page': 'gestion_comptable.tableau_de_bord.voir',
  'accounting.segments.view_page': 'gestion_comptable.segments.voir',
  'accounting.segments.create': 'gestion_comptable.segments.creer',
  'accounting.segments.update': 'gestion_comptable.segments.modifier',
  'accounting.segments.delete': 'gestion_comptable.segments.supprimer',
  'accounting.cities.view_page': 'gestion_comptable.villes.voir',
  'accounting.cities.create': 'gestion_comptable.villes.creer',
  'accounting.cities.update': 'gestion_comptable.villes.modifier',
  'accounting.cities.delete': 'gestion_comptable.villes.supprimer',
  'accounting.cities.bulk_delete': 'gestion_comptable.villes.supprimer_masse',
  'accounting.users.view_page': 'gestion_comptable.utilisateurs.voir',
  'accounting.users.create': 'gestion_comptable.utilisateurs.creer',
  'accounting.users.update': 'gestion_comptable.utilisateurs.modifier',
  'accounting.users.delete': 'gestion_comptable.utilisateurs.supprimer',
  'accounting.users.assign_segments': 'gestion_comptable.utilisateurs.assigner_segments',
  'accounting.users.assign_cities': 'gestion_comptable.utilisateurs.assigner_villes',
  'accounting.calculation_sheets.view_page': 'gestion_comptable.fiches_calcul.voir',
  'accounting.calculation_sheets.create': 'gestion_comptable.fiches_calcul.creer',
  'accounting.calculation_sheets.update': 'gestion_comptable.fiches_calcul.modifier',
  'accounting.calculation_sheets.delete': 'gestion_comptable.fiches_calcul.supprimer',
  'accounting.calculation_sheets.publish': 'gestion_comptable.fiches_calcul.publier',
  'accounting.calculation_sheets.duplicate': 'gestion_comptable.fiches_calcul.dupliquer',
  'accounting.calculation_sheets.export': 'gestion_comptable.fiches_calcul.exporter',
  'accounting.declarations.view_page': 'gestion_comptable.declarations.voir',
  'accounting.declarations.view_all': 'gestion_comptable.declarations.voir_toutes',
  'accounting.declarations.create': 'gestion_comptable.declarations.creer',
  'accounting.declarations.fill_data': 'gestion_comptable.declarations.remplir',
  'accounting.declarations.edit_metadata': 'gestion_comptable.declarations.modifier_metadata',
  'accounting.declarations.delete': 'gestion_comptable.declarations.supprimer',
  'accounting.declarations.approve': 'gestion_comptable.declarations.approuver',
  'accounting.declarations.submit': 'gestion_comptable.declarations.soumettre',
  'accounting.projects.view_page': 'gestion_comptable.gestion_projet.voir',
  'accounting.projects.create': 'gestion_comptable.gestion_projet.creer',
  'accounting.projects.update': 'gestion_comptable.gestion_projet.modifier',
  'accounting.projects.delete': 'gestion_comptable.gestion_projet.supprimer',
  'accounting.projects.export': 'gestion_comptable.gestion_projet.exporter',

  // System -> Gestion Comptable (Roles)
  'system.roles.view_page': 'gestion_comptable.roles_permissions.voir',
  'system.roles.create': 'gestion_comptable.roles_permissions.creer',
  'system.roles.update': 'gestion_comptable.roles_permissions.modifier',
  'system.roles.delete': 'gestion_comptable.roles_permissions.supprimer',

  // Training -> Formation
  'training.formations.view_page': 'formation.gestion_formations.voir',
  'training.formations.create': 'formation.gestion_formations.creer',
  'training.formations.update': 'formation.gestion_formations.modifier',
  'training.formations.delete': 'formation.gestion_formations.supprimer',
  'training.formations.duplicate': 'formation.gestion_formations.dupliquer',
  'training.formations.create_pack': 'formation.gestion_formations.creer_pack',
  'training.formations.edit_content': 'formation.gestion_formations.editer_contenu',
  'training.sessions.view_page': 'formation.sessions_formation.voir',
  'training.sessions.create': 'formation.sessions_formation.creer',
  'training.sessions.update': 'formation.sessions_formation.modifier',
  'training.sessions.delete': 'formation.sessions_formation.supprimer',
  'training.sessions.add_student': 'formation.sessions_formation.ajouter_etudiant',
  'training.sessions.edit_student': 'formation.sessions_formation.modifier_etudiant',
  'training.analytics.view_page': 'formation.analytics.voir',
  'training.analytics.export': 'formation.analytics.exporter',
  'training.student_reports.view_page': 'formation.rapports_etudiants.voir',
  'training.student_reports.export': 'formation.rapports_etudiants.exporter_csv',
  'training.students.view_page': 'formation.liste_etudiants.voir',
  'training.students.create': 'formation.liste_etudiants.creer',
  'training.students.update': 'formation.liste_etudiants.modifier',
  'training.students.delete': 'formation.liste_etudiants.supprimer',
  'training.certificate_templates.view_page': 'formation.templates_certificats.voir',
  'training.certificate_templates.create': 'formation.templates_certificats.creer_template',
  'training.certificate_templates.create_folder': 'formation.templates_certificats.creer_dossier',
  'training.certificate_templates.delete_template': 'formation.templates_certificats.supprimer',
  'training.certificate_templates.duplicate': 'formation.templates_certificats.dupliquer',
  'training.certificate_templates.edit_canvas': 'formation.templates_certificats.editer_canvas',
  'training.forums.view_page': 'formation.forums.voir',
  'training.forums.create_thread': 'formation.forums.creer_discussion',
  'training.forums.reply': 'formation.forums.repondre',
  'training.forums.react': 'formation.forums.reagir',
  'training.forums.delete': 'formation.forums.supprimer',
  'training.forums.moderate': 'formation.forums.moderer',

  // HR -> Ressources Humaines
  'hr.validation_workflows.view_page': 'ressources_humaines.boucles_validation.voir',
  'hr.validation_workflows.create': 'ressources_humaines.boucles_validation.creer',
  'hr.validation_workflows.update': 'ressources_humaines.boucles_validation.modifier',
  'hr.validation_workflows.delete': 'ressources_humaines.boucles_validation.supprimer',
  'hr.schedules.view_page': 'ressources_humaines.gestion_horaires.voir',
  'hr.schedules.manage_models': 'ressources_humaines.gestion_horaires.modeles.creer',
  'hr.schedules.manage_holidays': 'ressources_humaines.gestion_horaires.jours_feries.creer',
  'hr.schedules.manage_overtime': 'ressources_humaines.gestion_horaires.heures_sup.creer_periode',
  'hr.recovery.view_page': 'ressources_humaines.gestion_horaires.recuperation.voir',
  'hr.recovery.manage': 'ressources_humaines.gestion_horaires.recuperation.creer_periode',
  'hr.payroll.view_page': 'ressources_humaines.gestion_paie.voir',
  'hr.payroll.manage_periods': 'ressources_humaines.gestion_paie.periodes.creer',
  'hr.payroll.calculate': 'ressources_humaines.gestion_paie.calculs.calculer',
  'hr.payroll.view_payslips': 'ressources_humaines.gestion_paie.bulletins.voir',
  'hr.payroll.generate_payslips': 'ressources_humaines.gestion_paie.bulletins.valider',
  'hr.payroll.manage_config': 'ressources_humaines.gestion_paie.configuration.modifier',
  'hr.employee_portal.view_page': 'ressources_humaines.gestion_pointage.voir',
  'hr.employee_portal.clock_in_out': 'ressources_humaines.gestion_pointage.pointer',
  'hr.employees.view_page': 'ressources_humaines.dossier_employe.voir',
  'hr.employees.create': 'ressources_humaines.dossier_employe.creer',
  'hr.employees.update': 'ressources_humaines.dossier_employe.modifier',
  'hr.employees.delete': 'ressources_humaines.dossier_employe.supprimer',
  'hr.employees.view_salary': 'ressources_humaines.dossier_employe.voir_salaire',
  'hr.requests_validation.view_page': 'ressources_humaines.validation_demandes.voir',
  'hr.requests_validation.approve': 'ressources_humaines.validation_demandes.approuver',
  'hr.requests_validation.reject': 'ressources_humaines.validation_demandes.rejeter',
  'hr.delegation.view_page': 'ressources_humaines.delegations.voir',
  'hr.delegation.create': 'ressources_humaines.delegations.creer',
  'hr.delegation.manage_all': 'ressources_humaines.delegations.gerer_toutes',

  // HR Manager -> Mon Equipe
  'hr.manager.team_attendance': 'mon_equipe.pointages_equipe.voir',
  'hr.manager.team_requests': 'mon_equipe.demandes_equipe.voir',
  'hr.manager.approve_requests': 'mon_equipe.demandes_equipe.approuver',

  // HR Self-Service -> Mon Espace RH
  'hr.clocking.self': 'mon_espace_rh.mon_pointage.voir',
  'hr.clocking.view_own': 'mon_espace_rh.mon_pointage.voir',
  'hr.clocking.clock': 'mon_espace_rh.mon_pointage.pointer',
  'hr.my.requests': 'mon_espace_rh.mes_demandes.voir',
  'hr.my.payslips': 'mon_espace_rh.mes_bulletins.voir',

  // Employee -> Mon Espace RH
  'employee.clocking.view_page': 'mon_espace_rh.mon_pointage.voir',
  'employee.clocking.clock': 'mon_espace_rh.mon_pointage.pointer',
  'employee.requests.view_page': 'mon_espace_rh.mes_demandes.voir',
  'employee.requests.create': 'mon_espace_rh.mes_demandes.creer',
  'employee.requests.cancel': 'mon_espace_rh.mes_demandes.annuler',
  'employee.payslips.view_page': 'mon_espace_rh.mes_bulletins.voir',
  'employee.payslips.download': 'mon_espace_rh.mes_bulletins.telecharger',

  // Manager -> Mon Equipe
  'manager.team_attendance.view_page': 'mon_equipe.pointages_equipe.voir',
  'manager.team_attendance.delete': 'mon_equipe.pointages_equipe.supprimer',
  'manager.team_requests.view_page': 'mon_equipe.demandes_equipe.voir',
  'manager.team_requests.approve': 'mon_equipe.demandes_equipe.approuver',
  'manager.team_requests.reject': 'mon_equipe.demandes_equipe.rejeter',

  // Commercialisation
  'commercialisation.dashboard.view_page': 'commercialisation.tableau_de_bord.voir',
  'commercialisation.dashboard.view_stats': 'commercialisation.tableau_de_bord.voir_stats',
  'commercialisation.dashboard.export': 'commercialisation.tableau_de_bord.exporter',
  'commercialisation.prospects.view_page': 'commercialisation.prospects.voir',
  'commercialisation.prospects.view_all': 'commercialisation.prospects.voir_tous',
  'commercialisation.prospects.create': 'commercialisation.prospects.creer',
  'commercialisation.prospects.edit': 'commercialisation.prospects.modifier',
  'commercialisation.prospects.update': 'commercialisation.prospects.modifier',
  'commercialisation.prospects.delete': 'commercialisation.prospects.supprimer',
  'commercialisation.prospects.call': 'commercialisation.prospects.appeler',
  'commercialisation.prospects.convert': 'commercialisation.prospects.convertir',
  'commercialisation.prospects.import': 'commercialisation.prospects.importer',
  'commercialisation.prospects.export': 'commercialisation.prospects.exporter',
  'commercialisation.prospects.assign': 'commercialisation.prospects.assigner',
  'commercialisation.prospects.reinject': 'commercialisation.prospects.reinjecter',
  'commercialisation.prospects.clean': 'commercialisation.nettoyage_prospects.nettoyer',
  'commercialisation.google_contacts.view_page': 'commercialisation.gestion_gcontacte.voir',
  'commercialisation.google_contacts.configure': 'commercialisation.gestion_gcontacte.configurer',
  'commercialisation.google_contacts.sync': 'commercialisation.gestion_gcontacte.synchroniser',
  'commercialisation.google_contacts.test': 'commercialisation.gestion_gcontacte.tester',
};

// Helper to convert legacy permission to new permission
export function convertLegacyPermission(code: string): string {
  return LEGACY_PERMISSION_MAPPING[code] || code;
}
