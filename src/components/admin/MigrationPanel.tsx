import { useState } from 'react';
import { CheckCircle, XCircle, AlertCircle, Play, RefreshCw, X, Trash2, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/lib/api/client';

interface Migration {
  id: string;
  name: string;
  description: string;
  endpoint: string;
}

interface MigrationStatus {
  applied: boolean;
  needsRun: boolean;
  message?: string;
  details?: any;
}

const MIGRATIONS: Migration[] = [
  {
    id: 'migration-047',
    name: 'Migration 047',
    description: 'FIX HORAIRES: Ajoute colonnes jour-spécifiques (monday_start, tuesday_start, etc.) à hr_work_schedules + weekly_hours',
    endpoint: '/migration-047'
  },
  {
    id: 'migration-049',
    name: 'Migration 049',
    description: 'Ajouter colonne requires_clocking à hr_employees (requis pour le pointage)',
    endpoint: '/migration-049'
  },
  {
    id: 'migration-050',
    name: 'Migration 050',
    description: 'Table hr_public_holidays - Gestion jours fériés pour calculs pointage et congés',
    endpoint: '/migration-050'
  },
  {
    id: 'migration-054',
    name: 'Migration 054',
    description: 'PREREQUIS GERANT: Crée le rôle gerant et assigne TOUTES les permissions disponibles',
    endpoint: '/migration-054'
  },
  {
    id: 'migration-055',
    name: 'Migration 055',
    description: 'Fix critical permissions (system.roles, corps.view_page, professor/student permissions)',
    endpoint: '/migration-055'
  },
  {
    id: 'migration-056',
    name: 'Migration 056',
    description: 'Repopulate all accounting permissions (calculation_sheets, declarations, etc.)',
    endpoint: '/migration-056'
  },
  {
    id: 'migration-058',
    name: 'Migration 058',
    description: 'Synchroniser permissions manquantes (declarations.submit, cities.bulk_delete, corps.duplicate)',
    endpoint: '/migration-058'
  },
  {
    id: 'migration-059',
    name: 'Migration 059',
    description: 'Corriger chevauchements permissions - 20 permissions (fill_data vs edit_metadata, folder vs template, protéger 16 boutons)',
    endpoint: '/migration-059'
  },
  {
    id: 'migration-060',
    name: 'Migration 060',
    description: 'Système de gestion des prospects - 4 tables, 180 pays, 11 permissions, normalisation téléphone internationale',
    endpoint: '/migration-060'
  },
  {
    id: 'migration-061',
    name: 'Migration 061',
    description: 'Boucles de validation RH - tables hr_validation_workflows, hr_validation_workflow_steps, hr_validation_instances, hr_validation_actions',
    endpoint: '/migration-061'
  },
  {
    id: 'migration-projects',
    name: 'Migration Projects',
    description: 'Tables projects et project_actions pour la gestion de projet (Plan d\'Action)',
    endpoint: '/migration-projects'
  },
  {
    id: 'migration-063',
    name: 'Migration 063',
    description: 'Permissions sessions étudiants - training.sessions.add_student et training.sessions.edit_student',
    endpoint: '/migration-063'
  },
  {
    id: 'migration-064',
    name: 'Migration 064',
    description: 'Labels et descriptions en français pour toutes les permissions (affichage dans le tooltip info)',
    endpoint: '/migration-064'
  },
  {
    id: 'migration-065',
    name: 'Migration 065',
    description: 'Permissions professeurs - view_page, create, edit, delete, assign_segments, assign_cities',
    endpoint: '/migration-065'
  },
  {
    id: 'migration-066',
    name: 'Migration 066',
    description: 'Permissions manquantes - hr.employee_portal.*, hr.leaves.approve, system.roles.*, commercialisation.clients.*',
    endpoint: '/migration-066'
  },
  {
    id: 'migration-067',
    name: 'Migration 067',
    description: 'Alignement HR/Sidebar - hr.validation_workflows.*, hr.schedules.*, hr.payroll.*, hr.requests_validation.*',
    endpoint: '/migration-067'
  },
  {
    id: 'migration-068',
    name: 'Migration 068',
    description: 'Auto-création fiches employés pour utilisateurs avec permission hr.employee_portal.clock_in_out',
    endpoint: '/migration-068'
  },
  {
    id: 'migration-069',
    name: 'Migration 069',
    description: 'FIX CRITIQUE: Ajoute colonne clock_time et CHECK constraints pour hr_attendance_records (pointage)',
    endpoint: '/migration-069'
  },
  {
    id: 'migration-070',
    name: 'Migration 070',
    description: 'Structure de permissions complète - Ajoute 45+ permissions manquantes avec labels/descriptions FR (RH, Formation, Comptabilité)',
    endpoint: '/migration-070'
  },
  {
    id: 'migration-071',
    name: 'Migration 071',
    description: 'FIX SÉCURITÉ: Ajoute permission training.sessions.remove_student et protège route DELETE étudiant',
    endpoint: '/migration-071'
  },
  {
    id: 'migration-072',
    name: 'Migration 072',
    description: 'FIX HORAIRES RH: Contrainte horaire actif unique + Calculs pointage avec pauses/tolérances + UI configuration complète',
    endpoint: '/migration-072'
  },
  {
    id: 'migration-073',
    name: 'Migration 073',
    description: 'AUDIT SÉCURITÉ: Ajoute 5 permissions (delete_payment, approve_overtime, reject_overtime, holidays.*) + Protège 10 routes vulnérables',
    endpoint: '/migration-073'
  },
  {
    id: 'migration-074',
    name: 'Migration 074',
    description: 'FIX CRITIQUE GERANT: Assigne TOUTES les permissions au rôle gerant (training.certificate_templates.*, etc.)',
    endpoint: '/migration-074'
  },
  {
    id: 'migration-075',
    name: 'Migration 075',
    description: 'FIX DROPDOWNS GERANT: Ajoute permissions accounting.segments.view_page et accounting.cities.view_page (requis pour React Query)',
    endpoint: '/migration-075'
  },
  {
    id: 'migration-076',
    name: 'Migration 076',
    description: 'FIX VISIBILITÉ: Corrige affichage permissions segments/villes dans module Système (system.roles.*)',
    endpoint: '/migration-076'
  },
  {
    id: 'migration-077',
    name: 'Migration 077',
    description: 'FIX TEMPLATES: Crée permission training.certificate_templates.create manquante (requis pour créer templates)',
    endpoint: '/migration-077'
  },
  {
    id: 'migration-078',
    name: 'Migration 078',
    description: 'AUDIT COMPLET: Crée 54 permissions manquantes (HR: 31, Training: 15, Accounting: 7, Commercial: 1)',
    endpoint: '/migration-078'
  },
  {
    id: 'migration-079',
    name: 'Migration 079',
    description: '🔴 FIX CRITIQUE: Synchronise profiles.role avec roles.name pour bypass admin (403 Forbidden)',
    endpoint: '/migration-079-fix-admin-bypass'
  },
  {
    id: 'migration-080',
    name: 'Migration 080',
    description: '🚨 URGENCE: Crée permission system.roles.view_page et l\'assigne à admin (requis pour diagnostic)',
    endpoint: '/migration-080-create-system-roles-view-permission'
  },
  {
    id: 'migration-081',
    name: 'Migration 081',
    description: '🔍 DEBUG: Analyser quelles permissions getUserPermissions retourne pour admin',
    endpoint: '/migration-081-debug-admin-permissions'
  },
  {
    id: 'migration-083',
    name: 'Migration 083',
    description: '🎨 Ajoute colonne color aux projets pour personnalisation visuelle des cartes',
    endpoint: '/migration-083-add-project-color'
  },
  {
    id: 'migration-084',
    name: 'Migration 084',
    description: 'Système d\'archivage automatique - Tables archive_folders, student_archive_folders + colonnes certificates (session_id, file_path)',
    endpoint: '/migration-084-archive-system'
  },
  {
    id: 'migration-085',
    name: 'Migration 085',
    description: '📋 Suivi documents & impression - Colonnes document_type, template_name, printed_at, printer_name, print_status pour tracking et QZ Tray',
    endpoint: '/migration-085-document-tracking'
  },
  {
    id: 'migration-086',
    name: 'Migration 086',
    description: '🔧 FIX CRITIQUE: Corrige contrainte UNIQUE certificates (student_id, formation_id, session_id, document_type) + Index performance',
    endpoint: '/migration-086-fix-certificates'
  },
  {
    id: 'migration-fix-khalid-role',
    name: 'FIX: Synchroniser role_id de Khalid Fathi',
    description: '🔧 CRITIQUE: Corrige le role_id de "khalid fathi" pour pointer vers le rôle gérant au lieu de professor',
    endpoint: '/migration-fix-khalid-role'
  },
  {
    id: 'migration-verify-gerant-permissions',
    name: 'DEBUG: Vérifier Permissions Gérant',
    description: '🔍 DIAGNOSTIC: Vérifie toutes les permissions training.certificate_templates.* et les assigne si manquantes',
    endpoint: '/migration-verify-gerant-permissions'
  },
  {
    id: 'migration-add-certificate-update-permission',
    name: 'FIX: Créer permission certificate update',
    description: '🚨 CRITIQUE: Crée la permission training.certificate_templates.update manquante et l\'assigne au gérant',
    endpoint: '/migration-add-certificate-update-permission'
  },
  {
    id: 'migration-create-gerant-tables',
    name: 'CRITICAL: Créer tables gerant_segments et gerant_cities',
    description: '🔴 URGENT: Crée les tables gerant_segments et gerant_cities pour le SBAC des gérants',
    endpoint: '/migration-create-gerant-tables'
  },
  {
    id: 'migration-debug-khalid',
    name: 'DEBUG: Analyse Khalid Fathi',
    description: '🔍 Affiche le rôle, permissions et diagnostic complet pour l\'utilisateur khalid fathi',
    endpoint: '/migration-debug-khalid'
  },
  {
    id: 'migration-add-historique-rdv',
    name: 'Migration 087: Historique RDV Prospects',
    description: '📅 Ajoute colonne historique_rdv à prospects pour tracer les anciens RDV lors des réinjections',
    endpoint: '/migration-add-historique-rdv'
  },
  {
    id: 'migration-add-historique-villes',
    name: 'Migration 088: Historique Villes Prospects',
    description: '📍 Ajoute colonne historique_villes à prospects pour tracer les anciennes villes lors des réinjections',
    endpoint: '/migration-add-historique-villes'
  },
  {
    id: 'migration-087',
    name: 'Migration 087: Système Visites Physiques',
    description: '👣 Gestion des visites physiques au centre - Table prospect_visits, motifs non-inscription, analytics par zone, permissions RBAC',
    endpoint: '/migration-087'
  },
  {
    id: 'migration-089',
    name: 'Migration 089: Google Contacts Integration',
    description: '📱 Intégration Google Contacts - Sync automatique des prospects vers Google Contacts par ville (OAuth 2.0)',
    endpoint: '/migration-089'
  },
  {
    id: 'migration-090',
    name: 'Migration 090: Nom de session déclarations',
    description: '📝 Ajoute le champ session_name aux déclarations professeur pour nommer chaque session',
    endpoint: '/migration-090'
  },
  {
    id: 'migration-091',
    name: 'Migration 091: Sync Role IDs',
    description: '🔧 FIX CRITIQUE: Synchronise role_id pour tous les utilisateurs (corrige le comptage utilisateurs dans Rôles & Permissions)',
    endpoint: '/migration-091-sync-role-ids'
  },
  {
    id: 'migration-093',
    name: 'Migration 093: Fix Badge Document Type',
    description: '🔧 FIX BADGE: Ajoute "badge" comme type de document valide dans formation_templates (corrige la génération des badges)',
    endpoint: '/migration-093-fix-formation-templates-badge'
  },
  {
    id: 'migration-094',
    name: 'Migration 094: Fix Existing Badge Associations',
    description: '🔧 FIX BADGE: Corrige les associations existantes - détecte automatiquement le type (badge/attestation/diplome) basé sur le nom du template',
    endpoint: '/migration-094-fix-badge-document-types'
  },
  {
    id: 'migration-095',
    name: 'Migration 095: Fix Certificates Unique Constraint',
    description: '🔧 FIX CRITIQUE: Change la contrainte UNIQUE de (student_id, formation_id, session_id, document_type) vers (student_id, formation_id, session_id, template_id) - Permet plusieurs types de documents avec le même document_type',
    endpoint: '/migration-095-fix-certificates-unique-constraint'
  },
  {
    id: 'migration-096',
    name: 'Migration 096: Permission Génération Certificats pour Gérant',
    description: '🔧 FIX GÉRANT: Ajoute la permission training.certificates.generate au rôle gérant - Permet au gérant de générer des certificats/documents',
    endpoint: '/migration-096-gerant-certificates-generate-permission'
  },
  {
    id: 'migration-097',
    name: 'Migration 097: CRÉER Permission Génération Certificats',
    description: '🔧 FIX CRITIQUE: Crée la permission training.certificates.generate si elle n\'existe pas ET l\'assigne au gérant - Résout le problème de génération de documents',
    endpoint: '/migration-097-create-and-assign-certificates-generate'
  },
  {
    id: 'migration-098',
    name: 'Migration 098: Permission Voir Certificat pour Gérant',
    description: '🔧 FIX GÉRANT: Ajoute la permission training.certificates.view - Permet de voir/télécharger les certificats individuels',
    endpoint: '/migration-098-add-certificates-view-permission'
  },
  {
    id: 'migration-099',
    name: 'Migration 099: Standardiser Données Étudiants',
    description: '📝 FORMATAGE: Standardise automatiquement les données existantes - Noms en majuscule initiale (Jean Dupont), CIN en majuscules (T209876), emails en minuscules',
    endpoint: '/migration-099-standardize-existing-data'
  },
  {
    id: 'migration-100',
    name: 'Migration 100: Numéro Certificat Unique par Étudiant',
    description: '🔢 SÉRIE UNIQUE: Ajoute un numéro de certificat unique par inscription (CERT_SEGMENT_VILLE_000001) qui reste le même pour tous les documents de l\'étudiant',
    endpoint: '/migration-100-student-certificate-number'
  },
  {
    id: 'migration-101',
    name: 'Migration 101: Permettre Même Numéro sur Plusieurs Documents',
    description: '🔧 FIX CRITIQUE: Supprime la contrainte UNIQUE sur certificate_number dans certificates - Permet badge, attestation, diplôme avec le même numéro',
    endpoint: '/migration-101-remove-certificate-number-unique'
  },
  {
    id: 'fix-dateformat',
    name: 'Fix: Corriger Format de Date dans Templates',
    description: '📅 FIX DATE: Applique le format "En lettres" (01 Janvier 2026) à tous les éléments de date dans tous les templates de certificats',
    endpoint: '/debug-template-dateformat/fix-all'
  },
  {
    id: 'migration-103',
    name: 'Migration 103: Délégation RH',
    description: '🔄 Système de délégation RH - Table hr_approval_delegations pour déléguer les approbations de congés et demandes',
    endpoint: '/migration-103-hr-delegation'
  },
  {
    id: 'migration-104',
    name: 'Migration 104: Fix Création Horaires RH',
    description: '🔧 FIX CRITIQUE: Rend les colonnes start_time et end_time nullable dans hr_work_schedules - Corrige erreur "Erreur lors de la sauvegarde de l\'horaire"',
    endpoint: '/migration-104-fix-hr-schedules-constraints'
  },
  {
    id: 'migration-106',
    name: 'Migration 106: Multi-Managers RH',
    description: '👥 Système multi-managers pour employés RH - Table hr_employee_managers avec rangs (N, N+1, N+2...), validation séquentielle des demandes',
    endpoint: '/migration-106-hr-multi-managers'
  },
  {
    id: 'migration-107',
    name: 'Migration 107: Demandes de Correction Pointage',
    description: '📝 Table hr_attendance_correction_requests - Permet aux employés de demander des corrections de pointage avec validation multi-niveaux (N -> N+1 -> N+2...)',
    endpoint: '/migration-107-hr-correction-requests'
  },
  {
    id: 'migration-108',
    name: 'Migration 108: Périodes Heures Supplémentaires',
    description: '⏰ Tables hr_overtime_periods et hr_overtime_config - Déclaration des périodes HS par les managers, calcul automatique basé sur pointage, taux 25%/50%/100%',
    endpoint: '/migration-108-hr-overtime-periods'
  },
  {
    id: 'migration-109',
    name: 'Migration 109: Refactorisation Permissions Français',
    description: '🇫🇷 Refactorisation complète des permissions en français - Structure hiérarchique (section.sous_menu.onglet.action), ~150 nouvelles permissions alignées avec le menu latéral',
    endpoint: '/migration-109-refactor-permissions-french'
  },
  {
    id: 'migration-110',
    name: 'Migration 110: Renommer Permissions en Français',
    description: '🔄 Renomme les permissions anglaises existantes en français (UPDATE, pas INSERT) - Assure la cohérence entre la DB et le frontend sans créer de doublons',
    endpoint: '/migration-110-rename-permissions-french'
  },
  {
    id: 'migration-111',
    name: 'Migration 111: Nettoyer Doublons Permissions',
    description: '🧹 Supprime les permissions dupliquées (même code, ID différent) - Garde l\'ID le plus bas, migre les role_permissions, supprime les doublons',
    endpoint: '/migration-111-cleanup-duplicates'
  },
  {
    id: 'migration-112',
    name: 'Migration 112: Supprimer Permissions Anglaises',
    description: '🗑️ Supprime les permissions anglaises qui ont un équivalent français - Migre role_permissions vers la version FR, supprime les EN (428 → ~200 permissions)',
    endpoint: '/migration-112-cleanup-english-permissions'
  },
  {
    id: 'migration-113',
    name: 'Migration 113: Classification Types Permissions',
    description: '🏷️ Ajoute colonne permission_type (menu, sous_menu, page, bouton) pour distinguer le niveau hiérarchique de chaque permission',
    endpoint: '/migration-113-permission-types'
  },
  {
    id: 'migration-114',
    name: 'Migration 114: Ajouter Permissions Certificats',
    description: '📜 Ajoute les permissions formation.certificats.* (voir, generer, modifier, supprimer, telecharger) manquantes pour les routes certificates.js',
    endpoint: '/migration-114-add-certificats-permissions'
  },
  {
    id: 'migration-115',
    name: 'Migration 115: Ajouter TOUTES Permissions Manquantes',
    description: '🔧 Ajoute les 34 permissions manquantes identifiees par la validation: sessions (3), templates (2), certificats (4), forums (3), centres (2), corps (4), pointage (4), conges (4), dashboard RH (1), parametres (2), jours feries (2), declarations (2)',
    endpoint: '/migration-115-add-all-missing-permissions'
  },
  {
    id: 'migration-116',
    name: 'Migration 116: Consolider Permissions Doublons',
    description: '🔗 Migre les role_permissions des anciens codes EN (training.certificates.*) vers les nouveaux codes FR (formation.certificats.*) et supprime les doublons. Corrige les erreurs "Permission denied".',
    endpoint: '/migration-116-consolidate-permissions'
  },
  {
    id: 'migration-117',
    name: 'Migration 117: Fix Colonnes hr_leave_requests',
    description: '🔧 FIX CRITIQUE: Ajoute les colonnes n1_approved_at, n2_approved_at, hr_approved_at manquantes dans hr_leave_requests - Corrige l\'erreur "column n1_approved_at does not exist"',
    endpoint: '/migration-117-fix-leave-request-columns'
  },
  {
    id: 'migration-118',
    name: 'Migration 118: Analyse Publicite Facebook',
    description: '📊 Systeme de tracking Facebook - Table facebook_stats pour enregistrer les declarations par jour/ville, comparaison avec prospects en BDD, 5 permissions commercialisation.analyse_publicite.*',
    endpoint: '/migration-118-facebook-stats'
  },
  {
    id: 'migration-119',
    name: 'Migration 119: Sync Etudiants-Prospects',
    description: '🔄 Synchroniser les etudiants avec prospects - Normalise les telephones (0xxx → +212xxx) et met a jour le statut des prospects correspondants en "inscrit"',
    endpoint: '/migration-119-sync-students-prospects'
  },
  {
    id: 'migration-127',
    name: 'Migration 127: Admin Correction Tracking',
    description: '🔧 FIX CRITIQUE: Ajoute les colonnes admin_cancelled_at, admin_cancelled_by, admin_cancellation_reason à hr_attendance_correction_requests - Résout erreur "column admin_cancelled_at does not exist" bloquant modifications/déclarations pointages',
    endpoint: '/migration-127'
  },
  {
    id: 'migration-130',
    name: 'Migration 130: Refactorisation Pointage Unifié',
    description: '🔄 REFONTE POINTAGE: Crée table hr_attendance_daily unifiée (1 ligne = 1 jour = 1 employé), table hr_attendance_audit pour traçabilité, migre données depuis hr_attendance_records. Utilise NOW() PostgreSQL uniquement. Calculs centralisés côté backend.',
    endpoint: '/migration-130-attendance-refactor'
  },
  {
    id: 'migration-132',
    name: 'Migration 132: Sélection Employés Heures Sup',
    description: '🕐 HEURES SUP: Crée table hr_overtime_period_employees pour permettre la sélection manuelle des employés concernés par une période d\'heures supplémentaires. Remplace l\'auto-détection basée sur le pointage.',
    endpoint: '/migration-132-overtime-period-employees'
  },
  {
    id: 'migration-133',
    name: 'Migration 133: Statut Heures Sup',
    description: '⏰ STATUT OVERTIME: Ajoute le statut "overtime" dans la contrainte day_status de hr_attendance_daily. Permet d\'afficher "Heures Sup" comme statut de pointage distinct.',
    endpoint: '/migration-133-overtime-status'
  },
  {
    id: 'migration-134',
    name: 'Migration 134: Fix Contrainte day_status',
    description: '🔧 FIX CONTRAINTE: Supprime la contrainte obsolète valid_day_status qui bloquait la mise à jour vers le statut "overtime". Corrige le problème où le pointage restait "present" au lieu de "overtime".',
    endpoint: '/migration-134-fix-day-status-constraint'
  },
  {
    id: 'migration-135',
    name: 'Migration 135: Fix Rate Type Heures Sup',
    description: '💰 FIX TAUX HS: Ajoute "extended" (50%) à la contrainte rate_type de hr_overtime_records. Corrige le bug où le taux 50% était converti en 25% (normal). Permet le calcul correct de la paie pour les heures sup 8-16h.',
    endpoint: '/migration-135-fix-overtime-rate-type'
  },
  {
    id: 'migration-136',
    name: 'Migration 136: Colonne is_primary',
    description: '🔧 FIX SCHEMA: Ajoute la colonne is_primary à hr_employee_schedules. Corrige l\'erreur 500 sur /employee-schedules.',
    endpoint: '/migration-136-add-is-primary-column'
  },
  {
    id: 'migration-137',
    name: 'Migration 137: Statuts Récupération Payée/Non Payée',
    description: '💼 RÉCUPÉRATION: Ajoute les statuts recovery_paid et recovery_unpaid. Permet de distinguer les jours de récupération sur jour férié (payé) vs jour normal (non payé).',
    endpoint: '/migration-137-add-recovery-paid-status'
  },
  {
    id: 'migration-102',
    name: 'Migration 102: Système de Paie HR',
    description: '💰 PAIE: Crée les tables hr_payroll_periods, hr_payslips, hr_payslip_lines, hr_payroll_config, hr_payroll_audit_logs. Configuration CNSS/AMO/IGR Maroc 2025.',
    endpoint: '/migration-102-hr-payroll'
  },
  {
    id: 'migration-138',
    name: 'Migration 138: Champ CNSS par Employé',
    description: '🏥 CNSS: Ajoute les champs is_cnss_subject et is_amo_subject à hr_employees. Permet de désactiver les cotisations sociales pour certains employés (stagiaires, temps partiel).',
    endpoint: '/migration-138-add-cnss-subject'
  },
  {
    id: 'migration-139',
    name: 'Migration 139: Primes d\'Inscription',
    description: '🎓 PRIMES: Crée les tables hr_enrollment_bonus_rates et hr_enrollment_bonuses. Permet de gérer les primes d\'inscription par type de formation (licence, master, doctorat).',
    endpoint: '/migration-139-enrollment-bonuses'
  },
  {
    id: 'migration-140',
    name: 'Migration 140: Initialiser Pointage Quotidien',
    description: '📅 POINTAGE: Crée les lignes de pointage pour AUJOURD\'HUI pour tous les employés actifs. Exécutable à tout moment pour initialiser les lignes manquantes.',
    endpoint: '/migration-140-init-daily-attendance'
  },
  {
    id: 'migration-141',
    name: 'Migration 141: Salaire Horaire',
    description: '💰 PAIE: Ajoute la colonne hourly_rate à hr_employees. Vérifie également la présence de is_cnss_subject et is_amo_subject.',
    endpoint: '/migration-141-add-hourly-rate'
  },
  {
    id: 'migration-142',
    name: 'Migration 142: Recalculer Statuts Pointage',
    description: '🔄 SYNC: Recalcule day_status pour toutes les lignes hr_attendance_daily basé sur les déclarations de récupération et jours fériés. Corrige les désynchronisations vue employé/admin.',
    endpoint: '/migration-142-recalculate-day-status'
  },
  {
    id: 'migration-143',
    name: 'Migration 143: Prime Assistante Formation',
    description: '💰 PRIME: Ajoute colonne prime_assistante (DECIMAL) à la table formations. Permet de définir une prime par inscription pour chaque formation.',
    endpoint: '/migration-143-formation-prime'
  },
  {
    id: 'migration-144',
    name: 'Migration 144: Objectif Inscription Employé',
    description: '🎯 OBJECTIF: Ajoute colonnes inscription_objective (INTEGER), objective_period_start (DATE), objective_period_end (DATE) à hr_employees. Permet de définir un objectif d\'inscriptions par période pour le calcul des primes.',
    endpoint: '/migration-144-employee-objective'
  },
  {
    id: 'migration-145',
    name: 'Migration 145: Jour Coupure Paie',
    description: '📅 PÉRIODE: Ajoute colonne payroll_cutoff_day (INTEGER, défaut=18) à hr_employees. Calcule automatiquement la période d\'objectif: du 19 mois précédent au 18 mois courant = paie du mois courant.',
    endpoint: '/migration-145-payroll-cutoff-day'
  },
  {
    id: 'migration-146',
    name: 'Migration 146: Jour Ouvrable pour Paie',
    description: '📊 PAIE: Ajoute colonne is_working_day (BOOLEAN) à hr_attendance_daily. Les fériés/récupérations ne comptent pour la paie que s\'ils tombent sur un jour ouvrable du modèle horaire.',
    endpoint: '/migration-146-working-day-payroll'
  },
  {
    id: 'migration-147',
    name: 'Migration 147: Statut de Livraison Sessions En Ligne',
    description: '📦 SESSIONS: Ajoute colonne delivery_status (non_livree/livree) à session_etudiants. Permet de suivre la livraison des documents aux étudiants des sessions en ligne.',
    endpoint: '/migration-147-add-delivery-status'
  },
  {
    id: 'migration-148',
    name: 'Migration 148: Fusionner Statuts Récupération',
    description: '🔄 RÉCUP: Fusionne recovery_paid et recovery_unpaid en un seul statut "recovery". Le jour de récupération n\'a plus de paie (le salarié "rembourse" les heures déjà payées).',
    endpoint: '/migration-148-merge-recovery-statuses'
  },
  {
    id: 'migration-151',
    name: 'Migration 151: Ville Assignation pour Employés',
    description: '🏙️ PRIME RH: Ajoute colonne ville_id à hr_employees. Auto-assigne les employés à leur ville basé sur les inscriptions de leur segment. Résout l\'erreur PostgreSQL "could not determine data type of parameter $2" et permet le calcul des primes d\'inscription par ville.',
    endpoint: '/migration-151-add-ville-to-employees'
  },
  {
    id: 'migration-152',
    name: 'Migration 152: Date de Livraison Auto pour Sessions En Ligne',
    description: '📅 SESSIONS: Ajoute colonne original_date_inscription à session_etudiants. La date d\'inscription change automatiquement à la date de livraison pour les sessions en ligne, et se restaure quand le statut repasse à "non livré".',
    endpoint: '/migration-152-delivery-date-tracking'
  },
  {
    id: 'migration-157',
    name: 'Migration 157: Attestations de Travail',
    description: '📄 ATTESTATIONS RH: Crée table hr_work_certificates pour les attestations de travail. Ajoute 5 permissions (attestations.voir/creer/supprimer/telecharger, disciplinaire_vue.voir). Générateur PDF professionnel inclus.',
    endpoint: '/migration-157-work-certificates'
  },
  {
    id: 'migration-158',
    name: 'Migration 158: Sync Photos Employés → Profiles',
    description: '📸 PHOTOS: Synchronise les photos uploadées par admin (hr_employees.photo_url) vers profiles.profile_image_url. Corrige le bug où l\'employé ne voit pas sa photo quand il est connecté.',
    endpoint: '/migration-158-sync-employee-photos'
  }
];

interface MigrationPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MigrationPanel({ open, onOpenChange }: MigrationPanelProps) {
  const navigate = useNavigate();
  const [statuses, setStatuses] = useState<Record<string, MigrationStatus>>({});
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  const checkMigrationStatus = async (migration: Migration) => {
    try {
      addLog(`Checking status of ${migration.name}...`);
      const response = await apiClient.get<any>(`${migration.endpoint}/status`);

      // Handle different response formats from migrations
      // Format 1: { status: { migrationNeeded: boolean }, message: string }
      // Format 2: { success: boolean, applied: boolean, details: object }
      const isApplied = response.applied ?? (response.status && !response.status.migrationNeeded);
      const needsRun = !isApplied;

      setStatuses(prev => ({
        ...prev,
        [migration.id]: {
          applied: isApplied,
          needsRun: needsRun,
          message: response.message || (isApplied ? 'Migration applied' : 'Migration needed'),
          details: response.details || response.status
        }
      }));

      addLog(`✓ ${migration.name}: ${response.message || (isApplied ? 'Applied' : 'Needs run')}`);
    } catch (error: any) {
      addLog(`✗ Error checking ${migration.name}: ${error.message}`);
      setStatuses(prev => ({
        ...prev,
        [migration.id]: {
          applied: false,
          needsRun: true,
          message: `Error: ${error.message}`
        }
      }));
    }
  };

  const runMigration = async (migration: Migration) => {
    setLoading(prev => ({ ...prev, [migration.id]: true }));

    try {
      addLog(`Running ${migration.name}...`);
      const response = await apiClient.post<any>(`${migration.endpoint}/run`);

      addLog(`✓ ${migration.name} completed successfully!`);
      addLog(`Details: ${JSON.stringify(response.details, null, 2)}`);

      // Refresh status
      await checkMigrationStatus(migration);
    } catch (error: any) {
      addLog(`✗ ${migration.name} failed: ${error.message}`);
      if (error.stack) {
        addLog(`Stack: ${error.stack}`);
      }
    } finally {
      setLoading(prev => ({ ...prev, [migration.id]: false }));
    }
  };

  const checkAllStatuses = async () => {
    setLogs([]);
    addLog('Checking all migration statuses...');

    for (const migration of MIGRATIONS) {
      await checkMigrationStatus(migration);
    }

    addLog('Status check complete!');
  };

  const runDebugPermissions = async () => {
    try {
      addLog('Running permission diagnostics...');
      const response = await apiClient.get<any>('/auth/debug-permissions');

      setDebugInfo(response.debug);
      addLog('✓ Debug complete!');
      addLog(`User: ${response.debug.user?.username} (${response.debug.user?.role})`);
      addLog(`Permissions loaded: ${response.debug.permissionsCount}`);
      addLog(`Has calculation_sheets permission: ${response.debug.summary?.hasCalculationSheetsPermission}`);
      addLog(`Recommendation: ${response.debug.summary?.recommendation}`);
    } catch (error: any) {
      addLog(`✗ Debug failed: ${error.message}`);
    }
  };

  const runCleanupOrphans = async () => {
    setLoading(prev => ({ ...prev, 'cleanup-orphans': true }));

    try {
      addLog('🧹 Starting automatic cleanup of duplicate corps...');
      const response = await apiClient.post<any>('/corps-formation/cleanup-all-orphans');

      if (response.success) {
        addLog('✓ Cleanup completed successfully!');
        addLog(`📊 Summary:`);
        addLog(`  - Duplicates found: ${response.report.total_duplicates_found}`);
        addLog(`  - Corps cleaned: ${response.report.corps_cleaned.length}`);
        addLog(`  - Corps deleted: ${response.report.corps_deleted.length}`);
        addLog(`  - Errors: ${response.report.errors.length}`);

        if (response.report.corps_deleted.length > 0) {
          addLog(`\n🗑️ Deleted corps:`);
          response.report.corps_deleted.forEach((corps: any) => {
            addLog(`  - ${corps.corps_name} (${corps.formations_detached} formations detached)`);
          });
        }

        if (response.report.errors.length > 0) {
          addLog(`\n⚠️ Errors:`);
          response.report.errors.forEach((error: any) => {
            addLog(`  - ${error.corps_name}: ${error.error}`);
          });
        }
      } else {
        addLog(`✗ Cleanup failed: ${response.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      addLog(`✗ Cleanup failed: ${error.message}`);
      if (error.stack) {
        addLog(`Stack: ${error.stack}`);
      }
    } finally {
      setLoading(prev => ({ ...prev, 'cleanup-orphans': false }));
    }
  };

  const getStatusIcon = (status: MigrationStatus | undefined) => {
    if (!status) return <AlertCircle className="h-5 w-5 text-gray-400" />;
    if (status.applied) return <CheckCircle className="h-5 w-5 text-green-500" />;
    return <XCircle className="h-5 w-5 text-red-500" />;
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal Content */}
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Database Migrations & Diagnostics
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Action Buttons */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={checkAllStatuses}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm"
            >
              <RefreshCw className="h-4 w-4" />
              Check All Status
            </button>
            <button
              onClick={runDebugPermissions}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm"
            >
              <AlertCircle className="h-4 w-4" />
              Debug Permissions
            </button>
            <button
              onClick={runCleanupOrphans}
              disabled={loading['cleanup-orphans']}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading['cleanup-orphans'] ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Cleanup Duplicate Corps
            </button>
            <button
              onClick={() => navigate('/admin/permissions-diagnostic')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
            >
              <Shield className="h-4 w-4" />
              Permission Diagnostic
            </button>
          </div>

          {/* Migrations List */}
          <div className="grid gap-3">
            {MIGRATIONS.map(migration => {
              const status = statuses[migration.id];
              const isLoading = loading[migration.id];

              return (
                <div key={migration.id} className="border rounded-lg p-4 bg-white">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {getStatusIcon(status)}
                      <div className="flex-1">
                        <h3 className="font-semibold">{migration.name}</h3>
                        <p className="text-sm text-gray-600">
                          {migration.description}
                        </p>
                        {status && (
                          <p className="text-sm mt-1">
                            <span className={status.applied ? 'text-green-600' : 'text-orange-600'}>
                              {status.message}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => checkMigrationStatus(migration)}
                        disabled={isLoading}
                        className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
                      >
                        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={() => runMigration(migration)}
                        disabled={isLoading}
                        className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 text-sm ${
                          status?.needsRun
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'border border-gray-300 hover:bg-gray-50'
                        } disabled:opacity-50`}
                      >
                        {isLoading ? (
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        Run
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Debug Info */}
          {debugInfo && (
            <div className="border rounded-lg p-4 bg-slate-50">
              <h3 className="font-semibold mb-2">Debug Summary</h3>
              <div className="text-sm space-y-1">
                <p><strong>User:</strong> {debugInfo.user?.username} ({debugInfo.user?.role})</p>
                <p><strong>Role ID:</strong> {debugInfo.user?.role_id || 'NULL ⚠️'}</p>
                <p><strong>Permissions Count:</strong> {debugInfo.permissionsCount}</p>
                <p><strong>Has calculation_sheets permission:</strong> {debugInfo.summary?.hasCalculationSheetsPermission ? '✓ Yes' : '✗ No'}</p>
                <p><strong>Is Admin:</strong> {debugInfo.summary?.isAdmin ? '✓ Yes' : '✗ No'}</p>
                <p><strong>Should Bypass Check:</strong> {debugInfo.summary?.shouldBypassPermissionCheck ? '✓ Yes' : '✗ No'}</p>
                {debugInfo.summary?.recommendation && (
                  <p className="text-orange-600 mt-2"><strong>Recommendation:</strong> {debugInfo.summary.recommendation}</p>
                )}
              </div>
            </div>
          )}

          {/* Logs */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Logs</h3>
            <div className="h-64 w-full rounded border bg-slate-50 p-3 overflow-auto">
              <div className="font-mono text-xs space-y-1">
                {logs.length === 0 ? (
                  <p className="text-gray-500">No logs yet. Click "Check All Status" to begin.</p>
                ) : (
                  logs.map((log, i) => (
                    <div key={i} className="whitespace-pre-wrap break-words">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
