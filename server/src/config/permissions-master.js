/**
 * PERMISSIONS MASTER - Source Unique de Verite
 *
 * Ce fichier definit TOUTES les permissions du systeme avec leurs labels et descriptions en francais.
 * Format: section.sous_menu.{onglet?}.action
 *
 * Sections:
 * - gestion_comptable: Gestion Comptable
 * - formation: Formation
 * - ressources_humaines: Ressources Humaines
 * - mon_equipe: Mon Equipe
 * - mon_espace_rh: Mon Espace RH
 * - commercialisation: Commercialisation
 */

export const PERMISSIONS_MASTER = {
  // ============================================================
  // SECTION 1: GESTION COMPTABLE
  // ============================================================
  gestion_comptable: {
    // Permission d'acces a la section
    _section: [
      {
        action: 'acces',
        label: 'Acces Gestion Comptable',
        description: 'Permet d\'acceder a la section Gestion Comptable',
        sort_order: 0
      }
    ],

    tableau_de_bord: [
      {
        action: 'voir',
        label: 'Voir le tableau de bord',
        description: 'Permet d\'acceder au tableau de bord principal avec les statistiques generales',
        sort_order: 1
      }
    ],

    segments: [
      {
        action: 'voir',
        label: 'Voir les segments',
        description: 'Permet d\'acceder a la liste des segments',
        sort_order: 1
      },
      {
        action: 'creer',
        label: 'Creer un segment',
        description: 'Permet de creer un nouveau segment de formation',
        sort_order: 2
      },
      {
        action: 'modifier',
        label: 'Modifier un segment',
        description: 'Permet de modifier les informations d\'un segment existant',
        sort_order: 3
      },
      {
        action: 'supprimer',
        label: 'Supprimer un segment',
        description: 'Permet de supprimer definitivement un segment',
        sort_order: 4
      },
      {
        action: 'importer_villes',
        label: 'Importer des villes',
        description: 'Permet d\'importer des villes dans un segment',
        sort_order: 5
      }
    ],

    villes: [
      {
        action: 'voir',
        label: 'Voir les villes',
        description: 'Permet d\'acceder a la liste des villes',
        sort_order: 1
      },
      {
        action: 'creer',
        label: 'Creer une ville',
        description: 'Permet d\'ajouter une nouvelle ville au systeme',
        sort_order: 2
      },
      {
        action: 'modifier',
        label: 'Modifier une ville',
        description: 'Permet de modifier les informations d\'une ville',
        sort_order: 3
      },
      {
        action: 'supprimer',
        label: 'Supprimer une ville',
        description: 'Permet de supprimer une ville du systeme',
        sort_order: 4
      },
      {
        action: 'supprimer_masse',
        label: 'Suppression en masse',
        description: 'Permet de supprimer plusieurs villes en une seule action',
        sort_order: 5
      }
    ],

    utilisateurs: [
      {
        action: 'voir',
        label: 'Voir les utilisateurs',
        description: 'Permet d\'acceder a la liste des utilisateurs du systeme',
        sort_order: 1
      },
      {
        action: 'creer',
        label: 'Creer un utilisateur',
        description: 'Permet de creer un nouveau compte utilisateur',
        sort_order: 2
      },
      {
        action: 'modifier',
        label: 'Modifier un utilisateur',
        description: 'Permet de modifier les informations d\'un utilisateur',
        sort_order: 3
      },
      {
        action: 'supprimer',
        label: 'Supprimer un utilisateur',
        description: 'Permet de supprimer un compte utilisateur',
        sort_order: 4
      },
      {
        action: 'assigner_segments',
        label: 'Assigner des segments',
        description: 'Permet d\'assigner des segments a un utilisateur',
        sort_order: 5
      },
      {
        action: 'assigner_villes',
        label: 'Assigner des villes',
        description: 'Permet d\'assigner des villes a un utilisateur',
        sort_order: 6
      },
      {
        action: 'assigner_roles',
        label: 'Assigner des roles',
        description: 'Permet d\'assigner un role a un utilisateur',
        sort_order: 7
      }
    ],

    roles_permissions: [
      {
        action: 'voir',
        label: 'Voir les roles et permissions',
        description: 'Permet d\'acceder a la gestion des roles et permissions',
        sort_order: 1
      },
      {
        action: 'creer',
        label: 'Creer un role',
        description: 'Permet de creer un nouveau role',
        sort_order: 2
      },
      {
        action: 'modifier',
        label: 'Modifier un role',
        description: 'Permet de modifier les permissions d\'un role',
        sort_order: 3
      },
      {
        action: 'supprimer',
        label: 'Supprimer un role',
        description: 'Permet de supprimer un role (sauf roles systeme)',
        sort_order: 4
      }
    ],

    fiches_calcul: [
      {
        action: 'voir',
        label: 'Voir les fiches de calcul',
        description: 'Permet d\'acceder aux fiches de calcul',
        sort_order: 1
      },
      {
        action: 'creer',
        label: 'Creer une fiche',
        description: 'Permet de creer une nouvelle fiche de calcul',
        sort_order: 2
      },
      {
        action: 'modifier',
        label: 'Modifier une fiche',
        description: 'Permet de modifier une fiche de calcul existante',
        sort_order: 3
      },
      {
        action: 'supprimer',
        label: 'Supprimer une fiche',
        description: 'Permet de supprimer une fiche de calcul',
        sort_order: 4
      },
      {
        action: 'publier',
        label: 'Publier une fiche',
        description: 'Permet de publier une fiche pour les professeurs',
        sort_order: 5
      },
      {
        action: 'dupliquer',
        label: 'Dupliquer une fiche',
        description: 'Permet de dupliquer une fiche existante',
        sort_order: 6
      },
      {
        action: 'exporter',
        label: 'Exporter une fiche',
        description: 'Permet d\'exporter une fiche en PDF ou Excel',
        sort_order: 7
      },
      {
        action: 'parametres',
        label: 'Parametres des fiches',
        description: 'Permet d\'acceder aux parametres des fiches de calcul',
        sort_order: 8
      }
    ],

    declarations: [
      {
        action: 'voir',
        label: 'Voir les declarations',
        description: 'Permet de voir ses propres declarations',
        sort_order: 1
      },
      {
        action: 'voir_toutes',
        label: 'Voir toutes les declarations',
        description: 'Permet de voir les declarations de tous les utilisateurs',
        sort_order: 2
      },
      {
        action: 'creer',
        label: 'Creer une declaration',
        description: 'Permet de creer une nouvelle declaration',
        sort_order: 3
      },
      {
        action: 'remplir',
        label: 'Remplir une declaration',
        description: 'Permet de remplir les donnees d\'une declaration',
        sort_order: 4
      },
      {
        action: 'modifier_metadata',
        label: 'Modifier les metadonnees',
        description: 'Permet de modifier les metadonnees d\'une declaration',
        sort_order: 5
      },
      {
        action: 'supprimer',
        label: 'Supprimer une declaration',
        description: 'Permet de supprimer une declaration',
        sort_order: 6
      },
      {
        action: 'approuver',
        label: 'Approuver une declaration',
        description: 'Permet d\'approuver une declaration soumise',
        sort_order: 7
      },
      {
        action: 'rejeter',
        label: 'Rejeter une declaration',
        description: 'Permet de rejeter une declaration',
        sort_order: 8
      },
      {
        action: 'soumettre',
        label: 'Soumettre une declaration',
        description: 'Permet de soumettre une declaration pour validation',
        sort_order: 9
      }
    ],

    gestion_projet: [
      {
        action: 'voir',
        label: 'Voir les projets',
        description: 'Permet d\'acceder a la gestion de projet',
        sort_order: 1
      },
      {
        action: 'creer',
        label: 'Creer un projet',
        description: 'Permet de creer un nouveau projet',
        sort_order: 2
      },
      {
        action: 'modifier',
        label: 'Modifier un projet',
        description: 'Permet de modifier un projet existant',
        sort_order: 3
      },
      {
        action: 'supprimer',
        label: 'Supprimer un projet',
        description: 'Permet de supprimer un projet',
        sort_order: 4
      },
      {
        action: 'exporter',
        label: 'Exporter les projets',
        description: 'Permet d\'exporter les donnees des projets',
        sort_order: 5
      }
    ]
  },

  // ============================================================
  // SECTION 2: FORMATION
  // ============================================================
  formation: {
    _section: [
      {
        action: 'acces',
        label: 'Acces Formation',
        description: 'Permet d\'acceder a la section Formation',
        sort_order: 0
      }
    ],

    gestion_formations: [
      {
        action: 'voir',
        label: 'Voir les formations',
        description: 'Permet d\'acceder a la liste des formations',
        sort_order: 1
      },
      {
        action: 'creer',
        label: 'Creer une formation',
        description: 'Permet de creer une nouvelle formation',
        sort_order: 2
      },
      {
        action: 'modifier',
        label: 'Modifier une formation',
        description: 'Permet de modifier une formation existante',
        sort_order: 3
      },
      {
        action: 'supprimer',
        label: 'Supprimer une formation',
        description: 'Permet de supprimer une formation',
        sort_order: 4
      },
      {
        action: 'dupliquer',
        label: 'Dupliquer une formation',
        description: 'Permet de dupliquer une formation existante',
        sort_order: 5
      },
      {
        action: 'creer_pack',
        label: 'Creer un pack',
        description: 'Permet de creer un pack de formations',
        sort_order: 6
      },
      {
        action: 'editer_contenu',
        label: 'Editer le contenu',
        description: 'Permet d\'editer le contenu d\'une formation',
        sort_order: 7
      }
    ],

    sessions_formation: [
      {
        action: 'voir',
        label: 'Voir les sessions',
        description: 'Permet d\'acceder a la liste des sessions de formation',
        sort_order: 1
      },
      {
        action: 'creer',
        label: 'Creer une session',
        description: 'Permet de creer une nouvelle session',
        sort_order: 2
      },
      {
        action: 'modifier',
        label: 'Modifier une session',
        description: 'Permet de modifier une session existante',
        sort_order: 3
      },
      {
        action: 'supprimer',
        label: 'Supprimer une session',
        description: 'Permet de supprimer une session',
        sort_order: 4
      },
      {
        action: 'ajouter_etudiant',
        label: 'Ajouter un etudiant',
        description: 'Permet d\'ajouter un etudiant a une session',
        sort_order: 5
      },
      {
        action: 'modifier_etudiant',
        label: 'Modifier un etudiant',
        description: 'Permet de modifier un etudiant dans une session',
        sort_order: 6
      }
    ],

    analytics: [
      {
        action: 'voir',
        label: 'Voir les analytics',
        description: 'Permet d\'acceder aux statistiques de formation',
        sort_order: 1
      },
      {
        action: 'exporter',
        label: 'Exporter les analytics',
        description: 'Permet d\'exporter les statistiques',
        sort_order: 2
      },
      {
        action: 'changer_periode',
        label: 'Changer la periode',
        description: 'Permet de changer la periode d\'analyse',
        sort_order: 3
      }
    ],

    rapports_etudiants: [
      {
        action: 'voir',
        label: 'Voir les rapports',
        description: 'Permet d\'acceder aux rapports des etudiants',
        sort_order: 1
      },
      {
        action: 'rechercher',
        label: 'Rechercher',
        description: 'Permet de rechercher dans les rapports',
        sort_order: 2
      },
      {
        action: 'exporter_csv',
        label: 'Exporter en CSV',
        description: 'Permet d\'exporter les rapports en CSV',
        sort_order: 3
      },
      {
        action: 'exporter_pdf',
        label: 'Exporter en PDF',
        description: 'Permet d\'exporter les rapports en PDF',
        sort_order: 4
      }
    ],

    liste_etudiants: [
      {
        action: 'voir',
        label: 'Voir les etudiants',
        description: 'Permet d\'acceder a la liste des etudiants',
        sort_order: 1
      },
      {
        action: 'creer',
        label: 'Creer un etudiant',
        description: 'Permet de creer un nouvel etudiant',
        sort_order: 2
      },
      {
        action: 'modifier',
        label: 'Modifier un etudiant',
        description: 'Permet de modifier un etudiant',
        sort_order: 3
      },
      {
        action: 'supprimer',
        label: 'Supprimer un etudiant',
        description: 'Permet de supprimer un etudiant',
        sort_order: 4
      }
    ],

    templates_certificats: [
      {
        action: 'voir',
        label: 'Voir les templates',
        description: 'Permet d\'acceder aux templates de certificats',
        sort_order: 1
      },
      {
        action: 'creer_dossier',
        label: 'Creer un dossier',
        description: 'Permet de creer un dossier pour organiser les templates',
        sort_order: 2
      },
      {
        action: 'creer_template',
        label: 'Creer un template',
        description: 'Permet de creer un nouveau template de certificat',
        sort_order: 3
      },
      {
        action: 'renommer',
        label: 'Renommer',
        description: 'Permet de renommer un template ou dossier',
        sort_order: 4
      },
      {
        action: 'supprimer',
        label: 'Supprimer',
        description: 'Permet de supprimer un template ou dossier',
        sort_order: 5
      },
      {
        action: 'dupliquer',
        label: 'Dupliquer',
        description: 'Permet de dupliquer un template',
        sort_order: 6
      },
      {
        action: 'editer_canvas',
        label: 'Editer le canvas',
        description: 'Permet d\'editer le design du certificat',
        sort_order: 7
      }
    ],

    // Certificats generes (distinct des templates)
    certificats: [
      {
        action: 'voir',
        label: 'Voir les certificats',
        description: 'Permet de voir les certificats generes',
        sort_order: 1
      },
      {
        action: 'generer',
        label: 'Generer un certificat',
        description: 'Permet de generer un nouveau certificat pour un etudiant',
        sort_order: 2
      },
      {
        action: 'modifier',
        label: 'Modifier un certificat',
        description: 'Permet de modifier un certificat existant',
        sort_order: 3
      },
      {
        action: 'supprimer',
        label: 'Supprimer un certificat',
        description: 'Permet de supprimer un certificat',
        sort_order: 4
      },
      {
        action: 'telecharger',
        label: 'Telecharger un certificat',
        description: 'Permet de telecharger un certificat en PDF',
        sort_order: 5
      }
    ],

    forums: [
      {
        action: 'voir',
        label: 'Voir les forums',
        description: 'Permet d\'acceder aux forums de discussion',
        sort_order: 1
      },
      {
        action: 'creer_discussion',
        label: 'Creer une discussion',
        description: 'Permet de creer une nouvelle discussion',
        sort_order: 2
      },
      {
        action: 'repondre',
        label: 'Repondre',
        description: 'Permet de repondre a une discussion',
        sort_order: 3
      },
      {
        action: 'reagir',
        label: 'Reagir',
        description: 'Permet de reagir a un message',
        sort_order: 4
      },
      {
        action: 'supprimer',
        label: 'Supprimer',
        description: 'Permet de supprimer une discussion ou reponse',
        sort_order: 5
      },
      {
        action: 'epingler',
        label: 'Epingler',
        description: 'Permet d\'epingler une discussion',
        sort_order: 6
      },
      {
        action: 'verrouiller',
        label: 'Verrouiller',
        description: 'Permet de verrouiller une discussion',
        sort_order: 7
      },
      {
        action: 'moderer',
        label: 'Moderer',
        description: 'Permet de moderer les discussions',
        sort_order: 8
      }
    ]
  },

  // ============================================================
  // SECTION 3: RESSOURCES HUMAINES
  // ============================================================
  ressources_humaines: {
    _section: [
      {
        action: 'acces',
        label: 'Acces Ressources Humaines',
        description: 'Permet d\'acceder a la section Ressources Humaines',
        sort_order: 0
      }
    ],

    boucles_validation: [
      {
        action: 'voir',
        label: 'Voir les boucles de validation',
        description: 'Permet d\'acceder a la gestion des workflows de validation',
        sort_order: 1
      },
      {
        action: 'creer',
        label: 'Creer une boucle',
        description: 'Permet de creer un nouveau workflow de validation',
        sort_order: 2
      },
      {
        action: 'modifier',
        label: 'Modifier une boucle',
        description: 'Permet de modifier un workflow existant',
        sort_order: 3
      },
      {
        action: 'supprimer',
        label: 'Supprimer une boucle',
        description: 'Permet de supprimer un workflow',
        sort_order: 4
      }
    ],

    gestion_horaires: [
      {
        action: 'voir',
        label: 'Voir la gestion des horaires',
        description: 'Permet d\'acceder a la gestion des horaires',
        sort_order: 1
      },
      // Onglet Modeles
      {
        action: 'modeles.creer',
        label: 'Creer un modele d\'horaire',
        description: 'Permet de creer un nouveau modele d\'horaire',
        sort_order: 10
      },
      {
        action: 'modeles.modifier',
        label: 'Modifier un modele',
        description: 'Permet de modifier un modele d\'horaire',
        sort_order: 11
      },
      {
        action: 'modeles.supprimer',
        label: 'Supprimer un modele',
        description: 'Permet de supprimer un modele d\'horaire',
        sort_order: 12
      },
      // Onglet Jours Feries
      {
        action: 'jours_feries.creer',
        label: 'Creer un jour ferie',
        description: 'Permet de creer un jour ferie',
        sort_order: 20
      },
      {
        action: 'jours_feries.modifier',
        label: 'Modifier un jour ferie',
        description: 'Permet de modifier un jour ferie',
        sort_order: 21
      },
      {
        action: 'jours_feries.supprimer',
        label: 'Supprimer un jour ferie',
        description: 'Permet de supprimer un jour ferie',
        sort_order: 22
      },
      // Onglet Conges Valides
      {
        action: 'conges_valides.voir',
        label: 'Voir les conges valides',
        description: 'Permet de voir les conges valides',
        sort_order: 30
      },
      // Onglet Heures Supplementaires
      {
        action: 'heures_sup.voir',
        label: 'Voir les heures supplementaires',
        description: 'Permet de voir les heures supplementaires',
        sort_order: 40
      },
      {
        action: 'heures_sup.approuver',
        label: 'Approuver les heures sup',
        description: 'Permet d\'approuver les heures supplementaires',
        sort_order: 41
      },
      {
        action: 'heures_sup.rejeter',
        label: 'Rejeter les heures sup',
        description: 'Permet de rejeter les heures supplementaires',
        sort_order: 42
      },
      {
        action: 'heures_sup.creer_periode',
        label: 'Creer une periode HS',
        description: 'Permet de creer une periode d\'heures supplementaires',
        sort_order: 43
      },
      {
        action: 'heures_sup.supprimer_periode',
        label: 'Supprimer une periode HS',
        description: 'Permet de supprimer une periode d\'heures supplementaires',
        sort_order: 44
      },
      {
        action: 'heures_sup.recalculer',
        label: 'Recalculer les heures sup',
        description: 'Permet de recalculer les heures supplementaires',
        sort_order: 45
      },
      // Onglet Config HS
      {
        action: 'config_hs.voir',
        label: 'Voir la config HS',
        description: 'Permet de voir la configuration des heures supplementaires',
        sort_order: 50
      },
      {
        action: 'config_hs.modifier',
        label: 'Modifier la config HS',
        description: 'Permet de modifier la configuration des heures supplementaires',
        sort_order: 51
      }
    ],

    gestion_paie: [
      {
        action: 'voir',
        label: 'Voir la gestion de paie',
        description: 'Permet d\'acceder a la gestion de paie',
        sort_order: 1
      },
      // Onglet Periodes
      {
        action: 'periodes.creer',
        label: 'Creer une periode de paie',
        description: 'Permet de creer une nouvelle periode de paie',
        sort_order: 10
      },
      {
        action: 'periodes.ouvrir',
        label: 'Ouvrir une periode',
        description: 'Permet d\'ouvrir une periode de paie',
        sort_order: 11
      },
      {
        action: 'periodes.fermer',
        label: 'Fermer une periode',
        description: 'Permet de fermer une periode de paie',
        sort_order: 12
      },
      {
        action: 'periodes.supprimer',
        label: 'Supprimer une periode',
        description: 'Permet de supprimer une periode de paie',
        sort_order: 13
      },
      // Onglet Calculs
      {
        action: 'calculs.calculer',
        label: 'Calculer la paie',
        description: 'Permet de lancer le calcul de la paie',
        sort_order: 20
      },
      // Onglet Bulletins
      {
        action: 'bulletins.voir',
        label: 'Voir les bulletins',
        description: 'Permet de voir les bulletins de paie',
        sort_order: 30
      },
      {
        action: 'bulletins.valider',
        label: 'Valider un bulletin',
        description: 'Permet de valider un bulletin de paie',
        sort_order: 31
      },
      {
        action: 'bulletins.valider_tous',
        label: 'Valider tous les bulletins',
        description: 'Permet de valider tous les bulletins en une fois',
        sort_order: 32
      },
      {
        action: 'bulletins.telecharger',
        label: 'Telecharger un bulletin',
        description: 'Permet de telecharger un bulletin en PDF',
        sort_order: 33
      },
      {
        action: 'bulletins.exporter_cnss',
        label: 'Exporter CNSS',
        description: 'Permet d\'exporter les donnees CNSS',
        sort_order: 34
      },
      {
        action: 'bulletins.exporter_virements',
        label: 'Exporter virements',
        description: 'Permet d\'exporter les virements bancaires',
        sort_order: 35
      },
      // Onglet Tests
      {
        action: 'tests.voir',
        label: 'Voir les tests et logs',
        description: 'Permet de voir les tests et logs de paie',
        sort_order: 40
      },
      // Onglet Automatisation
      {
        action: 'automatisation.voir',
        label: 'Voir l\'automatisation',
        description: 'Permet de voir les taches automatisees',
        sort_order: 50
      },
      {
        action: 'automatisation.configurer',
        label: 'Configurer l\'automatisation',
        description: 'Permet de configurer les taches automatisees',
        sort_order: 51
      },
      // Onglet Configuration
      {
        action: 'configuration.voir',
        label: 'Voir la configuration paie',
        description: 'Permet de voir la configuration de paie',
        sort_order: 60
      },
      {
        action: 'configuration.modifier',
        label: 'Modifier la configuration paie',
        description: 'Permet de modifier la configuration de paie',
        sort_order: 61
      }
    ],

    gestion_pointage: [
      {
        action: 'voir',
        label: 'Voir le pointage',
        description: 'Permet d\'acceder a la gestion du pointage',
        sort_order: 1
      },
      {
        action: 'pointer',
        label: 'Pointer',
        description: 'Permet de pointer pour un employe',
        sort_order: 2
      },
      {
        action: 'corriger',
        label: 'Corriger le pointage',
        description: 'Permet de corriger les enregistrements de pointage',
        sort_order: 3
      },
      {
        action: 'importer',
        label: 'Importer le pointage',
        description: 'Permet d\'importer des donnees de pointage',
        sort_order: 4
      },
      {
        action: 'exporter',
        label: 'Exporter le pointage',
        description: 'Permet d\'exporter les donnees de pointage',
        sort_order: 5
      },
      {
        action: 'valider',
        label: 'Valider le pointage',
        description: 'Permet de valider les pointages',
        sort_order: 6
      }
    ],

    dossier_employe: [
      {
        action: 'voir',
        label: 'Voir les dossiers employes',
        description: 'Permet d\'acceder aux dossiers des employes',
        sort_order: 1
      },
      {
        action: 'creer',
        label: 'Creer un dossier',
        description: 'Permet de creer un nouveau dossier employe',
        sort_order: 2
      },
      {
        action: 'modifier',
        label: 'Modifier un dossier',
        description: 'Permet de modifier un dossier employe',
        sort_order: 3
      },
      {
        action: 'supprimer',
        label: 'Supprimer un dossier',
        description: 'Permet de supprimer un dossier employe',
        sort_order: 4
      },
      {
        action: 'voir_salaire',
        label: 'Voir le salaire',
        description: 'Permet de voir les informations salariales',
        sort_order: 5
      },
      {
        action: 'gerer_contrats',
        label: 'Gerer les contrats',
        description: 'Permet de gerer les contrats de travail',
        sort_order: 6
      },
      {
        action: 'gerer_documents',
        label: 'Gerer les documents',
        description: 'Permet de gerer les documents employe',
        sort_order: 7
      },
      {
        action: 'gerer_discipline',
        label: 'Gerer la discipline',
        description: 'Permet de gerer les actions disciplinaires',
        sort_order: 8
      }
    ],

    validation_demandes: [
      {
        action: 'voir',
        label: 'Voir les demandes a valider',
        description: 'Permet de voir les demandes en attente de validation',
        sort_order: 1
      },
      {
        action: 'approuver',
        label: 'Approuver une demande',
        description: 'Permet d\'approuver une demande',
        sort_order: 2
      },
      {
        action: 'rejeter',
        label: 'Rejeter une demande',
        description: 'Permet de rejeter une demande',
        sort_order: 3
      }
    ],

    delegations: [
      {
        action: 'voir',
        label: 'Voir les delegations',
        description: 'Permet de voir les delegations d\'approbation',
        sort_order: 1
      },
      {
        action: 'creer',
        label: 'Creer une delegation',
        description: 'Permet de creer une delegation d\'approbation',
        sort_order: 2
      },
      {
        action: 'gerer_toutes',
        label: 'Gerer toutes les delegations',
        description: 'Permet de gerer toutes les delegations du systeme',
        sort_order: 3
      }
    ]
  },

  // ============================================================
  // SECTION 4: MON EQUIPE
  // ============================================================
  mon_equipe: {
    _section: [
      {
        action: 'acces',
        label: 'Acces Mon Equipe',
        description: 'Permet d\'acceder a la section Mon Equipe',
        sort_order: 0
      }
    ],

    pointages_equipe: [
      {
        action: 'voir',
        label: 'Voir les pointages de l\'equipe',
        description: 'Permet de voir les pointages des membres de son equipe',
        sort_order: 1
      },
      {
        action: 'supprimer',
        label: 'Supprimer un pointage',
        description: 'Permet de supprimer un pointage de l\'equipe',
        sort_order: 2
      }
    ],

    demandes_equipe: [
      {
        action: 'voir',
        label: 'Voir les demandes de l\'equipe',
        description: 'Permet de voir les demandes des membres de son equipe',
        sort_order: 1
      },
      {
        action: 'approuver',
        label: 'Approuver une demande',
        description: 'Permet d\'approuver une demande de l\'equipe',
        sort_order: 2
      },
      {
        action: 'rejeter',
        label: 'Rejeter une demande',
        description: 'Permet de rejeter une demande de l\'equipe',
        sort_order: 3
      }
    ]
  },

  // ============================================================
  // SECTION 5: MON ESPACE RH
  // ============================================================
  mon_espace_rh: {
    _section: [
      {
        action: 'acces',
        label: 'Acces Mon Espace RH',
        description: 'Permet d\'acceder a la section Mon Espace RH',
        sort_order: 0
      }
    ],

    mon_pointage: [
      {
        action: 'voir',
        label: 'Voir mon pointage',
        description: 'Permet de voir son propre pointage',
        sort_order: 1
      },
      {
        action: 'pointer',
        label: 'Pointer',
        description: 'Permet de pointer (entree/sortie)',
        sort_order: 2
      }
    ],

    mes_demandes: [
      {
        action: 'voir',
        label: 'Voir mes demandes',
        description: 'Permet de voir ses propres demandes',
        sort_order: 1
      },
      {
        action: 'creer',
        label: 'Creer une demande',
        description: 'Permet de creer une nouvelle demande (conge, absence, etc.)',
        sort_order: 2
      },
      {
        action: 'annuler',
        label: 'Annuler une demande',
        description: 'Permet d\'annuler une demande en attente',
        sort_order: 3
      }
    ],

    mes_bulletins: [
      {
        action: 'voir',
        label: 'Voir mes bulletins',
        description: 'Permet de voir ses bulletins de paie',
        sort_order: 1
      },
      {
        action: 'telecharger',
        label: 'Telecharger un bulletin',
        description: 'Permet de telecharger un bulletin en PDF',
        sort_order: 2
      }
    ]
  },

  // ============================================================
  // SECTION 6: COMMERCIALISATION
  // ============================================================
  commercialisation: {
    _section: [
      {
        action: 'acces',
        label: 'Acces Commercialisation',
        description: 'Permet d\'acceder a la section Commercialisation',
        sort_order: 0
      }
    ],

    tableau_de_bord: [
      {
        action: 'voir',
        label: 'Voir le tableau de bord',
        description: 'Permet d\'acceder au tableau de bord commercial',
        sort_order: 1
      },
      {
        action: 'voir_stats',
        label: 'Voir les statistiques',
        description: 'Permet de voir les statistiques detaillees',
        sort_order: 2
      },
      {
        action: 'exporter',
        label: 'Exporter',
        description: 'Permet d\'exporter les donnees du tableau de bord',
        sort_order: 3
      }
    ],

    prospects: [
      {
        action: 'voir',
        label: 'Voir les prospects',
        description: 'Permet de voir ses prospects assignes',
        sort_order: 1
      },
      {
        action: 'voir_tous',
        label: 'Voir tous les prospects',
        description: 'Permet de voir tous les prospects du systeme',
        sort_order: 2
      },
      {
        action: 'creer',
        label: 'Creer un prospect',
        description: 'Permet de creer un nouveau prospect',
        sort_order: 3
      },
      {
        action: 'modifier',
        label: 'Modifier un prospect',
        description: 'Permet de modifier un prospect',
        sort_order: 4
      },
      {
        action: 'supprimer',
        label: 'Supprimer un prospect',
        description: 'Permet de supprimer un prospect',
        sort_order: 5
      },
      {
        action: 'appeler',
        label: 'Appeler un prospect',
        description: 'Permet d\'appeler un prospect',
        sort_order: 6
      },
      {
        action: 'convertir',
        label: 'Convertir un prospect',
        description: 'Permet de convertir un prospect en client',
        sort_order: 7
      },
      {
        action: 'importer',
        label: 'Importer des prospects',
        description: 'Permet d\'importer des prospects depuis un fichier',
        sort_order: 8
      },
      {
        action: 'exporter',
        label: 'Exporter des prospects',
        description: 'Permet d\'exporter la liste des prospects',
        sort_order: 9
      },
      {
        action: 'assigner',
        label: 'Assigner un prospect',
        description: 'Permet d\'assigner un prospect a un commercial',
        sort_order: 10
      },
      {
        action: 'reinjecter',
        label: 'Reinjecter un prospect',
        description: 'Permet de reinjecter un prospect dans le pipeline',
        sort_order: 11
      }
    ],

    nettoyage_prospects: [
      {
        action: 'voir',
        label: 'Voir le nettoyage prospects',
        description: 'Permet d\'acceder a la page de nettoyage des prospects',
        sort_order: 1
      },
      {
        action: 'nettoyer',
        label: 'Nettoyer les prospects',
        description: 'Permet de nettoyer/supprimer les prospects invalides',
        sort_order: 2
      }
    ],

    gestion_gcontacte: [
      {
        action: 'voir',
        label: 'Voir G-Contacte',
        description: 'Permet d\'acceder a la gestion Google Contacts',
        sort_order: 1
      },
      {
        action: 'configurer',
        label: 'Configurer G-Contacte',
        description: 'Permet de configurer l\'integration Google Contacts',
        sort_order: 2
      },
      {
        action: 'synchroniser',
        label: 'Synchroniser',
        description: 'Permet de synchroniser les contacts Google',
        sort_order: 3
      },
      {
        action: 'tester',
        label: 'Tester la connexion',
        description: 'Permet de tester la connexion Google',
        sort_order: 4
      }
    ]
  }
};

// ============================================================
// HELPERS
// ============================================================

/**
 * Get all permissions as flat array with full codes
 * Format: [{ code: 'section.menu.action', label, description, module, menu, sort_order }]
 */
export function getAllPermissionsFlat() {
  const permissions = [];

  Object.entries(PERMISSIONS_MASTER).forEach(([sectionKey, menus]) => {
    Object.entries(menus).forEach(([menuKey, actions]) => {
      // Handle section-level permissions (_section)
      const actualMenuKey = menuKey === '_section' ? '' : menuKey;

      actions.forEach(perm => {
        // Build the permission code
        let code;
        if (actualMenuKey === '') {
          code = `${sectionKey}.${perm.action}`;
        } else if (perm.action.includes('.')) {
          // For nested actions like 'modeles.creer'
          code = `${sectionKey}.${actualMenuKey}.${perm.action}`;
        } else {
          code = `${sectionKey}.${actualMenuKey}.${perm.action}`;
        }

        permissions.push({
          code,
          label: perm.label,
          description: perm.description,
          module: sectionKey,
          menu: actualMenuKey || sectionKey,
          sort_order: perm.sort_order
        });
      });
    });
  });

  return permissions;
}

/**
 * Get permissions grouped by module for tree view
 */
export function getPermissionsTree() {
  const tree = {};

  Object.entries(PERMISSIONS_MASTER).forEach(([sectionKey, menus]) => {
    tree[sectionKey] = {
      label: getSectionLabel(sectionKey),
      menus: {}
    };

    Object.entries(menus).forEach(([menuKey, actions]) => {
      if (menuKey === '_section') {
        // Section-level permissions go at root
        tree[sectionKey].permissions = actions.map(perm => ({
          code: `${sectionKey}.${perm.action}`,
          ...perm
        }));
      } else {
        tree[sectionKey].menus[menuKey] = {
          label: getMenuLabel(sectionKey, menuKey),
          permissions: actions.map(perm => {
            const code = perm.action.includes('.')
              ? `${sectionKey}.${menuKey}.${perm.action}`
              : `${sectionKey}.${menuKey}.${perm.action}`;
            return { code, ...perm };
          })
        };
      }
    });
  });

  return tree;
}

/**
 * Get human-readable section label
 */
function getSectionLabel(sectionKey) {
  const labels = {
    gestion_comptable: 'Gestion Comptable',
    formation: 'Formation',
    ressources_humaines: 'Ressources Humaines',
    mon_equipe: 'Mon Equipe',
    mon_espace_rh: 'Mon Espace RH',
    commercialisation: 'Commercialisation'
  };
  return labels[sectionKey] || sectionKey;
}

/**
 * Get human-readable menu label
 */
function getMenuLabel(sectionKey, menuKey) {
  const labels = {
    // Gestion Comptable
    tableau_de_bord: 'Tableau de bord',
    segments: 'Segments',
    villes: 'Villes',
    utilisateurs: 'Utilisateurs',
    roles_permissions: 'Roles & Permissions',
    fiches_calcul: 'Fiches de calcul',
    declarations: 'Declarations',
    gestion_projet: 'Gestion de Projet',
    // Formation
    gestion_formations: 'Gestion des Formations',
    sessions_formation: 'Sessions de Formation',
    analytics: 'Analytics',
    rapports_etudiants: 'Rapports Etudiants',
    liste_etudiants: 'Liste des Etudiants',
    templates_certificats: 'Templates de Certificats',
    certificats: 'Certificats',
    forums: 'Forums',
    // Ressources Humaines
    boucles_validation: 'Boucles de Validation',
    gestion_horaires: 'Gestion des Horaires',
    gestion_paie: 'Gestion de Paie',
    gestion_pointage: 'Gestion Pointage',
    dossier_employe: 'Dossier Employe',
    validation_demandes: 'Validation des Demandes',
    delegations: 'Delegations',
    // Mon Equipe
    pointages_equipe: 'Pointages equipe',
    demandes_equipe: 'Demandes equipe',
    // Mon Espace RH
    mon_pointage: 'Mon Pointage',
    mes_demandes: 'Mes Demandes',
    mes_bulletins: 'Mes Bulletins',
    // Commercialisation
    prospects: 'Prospects',
    nettoyage_prospects: 'Nettoyage Prospects',
    gestion_gcontacte: 'Gestion G-Contacte'
  };
  return labels[menuKey] || menuKey;
}

// Legacy mapping for backward compatibility
export const LEGACY_PERMISSION_MAPPING = {
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
  'accounting.declarations.view_page': 'gestion_comptable.declarations.voir',
  'accounting.projects.view_page': 'gestion_comptable.gestion_projet.voir',
  'system.roles.view_page': 'gestion_comptable.roles_permissions.voir',
  'system.roles.create': 'gestion_comptable.roles_permissions.creer',
  'system.roles.update': 'gestion_comptable.roles_permissions.modifier',
  'system.roles.delete': 'gestion_comptable.roles_permissions.supprimer',

  // Training -> Formation
  'training.formations.view_page': 'formation.gestion_formations.voir',
  'training.sessions.view_page': 'formation.sessions_formation.voir',
  'training.analytics.view_page': 'formation.analytics.voir',
  'training.student_reports.view_page': 'formation.rapports_etudiants.voir',
  'training.students.view_page': 'formation.liste_etudiants.voir',
  'training.certificate_templates.view_page': 'formation.templates_certificats.voir',
  'training.forums.view_page': 'formation.forums.voir',

  // HR -> Ressources Humaines
  'hr.validation_workflows.view_page': 'ressources_humaines.boucles_validation.voir',
  'hr.schedules.view_page': 'ressources_humaines.gestion_horaires.voir',
  'hr.payroll.view_page': 'ressources_humaines.gestion_paie.voir',
  'hr.employee_portal.view_page': 'ressources_humaines.gestion_pointage.voir',
  'hr.employees.view_page': 'ressources_humaines.dossier_employe.voir',
  'hr.requests_validation.view_page': 'ressources_humaines.validation_demandes.voir',
  'hr.delegation.view_page': 'ressources_humaines.delegations.voir',

  // HR Manager -> Mon Equipe
  'hr.manager.team_attendance': 'mon_equipe.pointages_equipe.voir',
  'hr.manager.team_requests': 'mon_equipe.demandes_equipe.voir',

  // HR Self-Service -> Mon Espace RH
  'hr.clocking.self': 'mon_espace_rh.mon_pointage.voir',
  'hr.my.requests': 'mon_espace_rh.mes_demandes.voir',
  'hr.my.payslips': 'mon_espace_rh.mes_bulletins.voir',

  // Commercialisation
  'commercialisation.dashboard.view_page': 'commercialisation.tableau_de_bord.voir',
  'commercialisation.prospects.view_page': 'commercialisation.prospects.voir',
  'commercialisation.prospects.clean': 'commercialisation.nettoyage_prospects.nettoyer',
  'commercialisation.google_contacts.view_page': 'commercialisation.gestion_gcontacte.voir'
};

/**
 * Convert legacy permission code to new format
 */
export function convertLegacyPermission(code) {
  return LEGACY_PERMISSION_MAPPING[code] || code;
}
