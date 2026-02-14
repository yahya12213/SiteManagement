/**
 * Migration 031 - Simplified Permission System
 *
 * Replaces complex permissions with a simple, menu-based structure:
 * - Page permissions (view access)
 * - CRUD actions (create, edit, delete)
 * - Special actions (approve, generate, export, etc.)
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting Migration 031 - Simplified Permissions...');
    await client.query('BEGIN');

    // Step 1: Clear existing permissions (we'll recreate them simpler)
    console.log('  📦 Clearing old permissions...');
    await client.query('DELETE FROM role_permissions');
    await client.query('DELETE FROM permissions');

    // Step 2: Insert simplified permissions
    console.log('  📦 Creating simplified permissions...');
    const permissions = [
      // ===== PAGES - GESTION COMPTABLE =====
      { code: 'page.dashboard', name: 'Voir Tableau de bord', module: 'pages_comptabilite', description: 'Accéder au tableau de bord' },
      { code: 'page.segments', name: 'Voir Segments', module: 'pages_comptabilite', description: 'Accéder à la page Segments' },
      { code: 'page.villes', name: 'Voir Villes', module: 'pages_comptabilite', description: 'Accéder à la page Villes' },
      { code: 'page.utilisateurs', name: 'Voir Utilisateurs', module: 'pages_comptabilite', description: 'Accéder à la page Utilisateurs' },
      { code: 'page.roles', name: 'Voir Rôles & Permissions', module: 'pages_comptabilite', description: 'Accéder à la gestion des rôles' },
      { code: 'page.fiches_calcul', name: 'Voir Fiches de calcul', module: 'pages_comptabilite', description: 'Accéder aux fiches de calcul' },
      { code: 'page.declarations', name: 'Voir Déclarations', module: 'pages_comptabilite', description: 'Accéder à la gestion des déclarations' },

      // ===== PAGES - FORMATION EN LIGNE =====
      { code: 'page.formations', name: 'Voir Formations', module: 'pages_formation', description: 'Accéder à la gestion des formations' },
      { code: 'page.sessions', name: 'Voir Sessions', module: 'pages_formation', description: 'Accéder aux sessions de formation' },
      { code: 'page.analytics', name: 'Voir Analytics', module: 'pages_formation', description: 'Accéder aux statistiques' },
      { code: 'page.rapports', name: 'Voir Rapports Étudiants', module: 'pages_formation', description: 'Accéder aux rapports étudiants' },
      { code: 'page.certificats', name: 'Voir Certificats', module: 'pages_formation', description: 'Accéder à la gestion des certificats' },
      { code: 'page.templates', name: 'Voir Templates Certificats', module: 'pages_formation', description: 'Accéder aux templates de certificats' },
      { code: 'page.forums', name: 'Voir Forums', module: 'pages_formation', description: 'Accéder à la modération des forums' },

      // ===== ACTIONS CRUD - UTILISATEURS =====
      { code: 'utilisateurs.creer', name: 'Créer Utilisateur', module: 'actions_utilisateurs', description: 'Créer un nouvel utilisateur' },
      { code: 'utilisateurs.modifier', name: 'Modifier Utilisateur', module: 'actions_utilisateurs', description: 'Modifier les informations utilisateur' },
      { code: 'utilisateurs.supprimer', name: 'Supprimer Utilisateur', module: 'actions_utilisateurs', description: 'Supprimer un utilisateur' },
      { code: 'utilisateurs.assigner_role', name: 'Assigner Rôle', module: 'actions_utilisateurs', description: 'Changer le rôle d\'un utilisateur' },

      // ===== ACTIONS CRUD - SEGMENTS & VILLES =====
      { code: 'segments.creer', name: 'Créer Segment', module: 'actions_parametres', description: 'Créer un nouveau segment' },
      { code: 'segments.modifier', name: 'Modifier Segment', module: 'actions_parametres', description: 'Modifier un segment' },
      { code: 'segments.supprimer', name: 'Supprimer Segment', module: 'actions_parametres', description: 'Supprimer un segment' },
      { code: 'villes.creer', name: 'Créer Ville', module: 'actions_parametres', description: 'Créer une nouvelle ville' },
      { code: 'villes.modifier', name: 'Modifier Ville', module: 'actions_parametres', description: 'Modifier une ville' },
      { code: 'villes.supprimer', name: 'Supprimer Ville', module: 'actions_parametres', description: 'Supprimer une ville' },

      // ===== ACTIONS CRUD - FICHES DE CALCUL =====
      { code: 'fiches.creer', name: 'Créer Fiche', module: 'actions_fiches', description: 'Créer une fiche de calcul' },
      { code: 'fiches.modifier', name: 'Modifier Fiche', module: 'actions_fiches', description: 'Modifier une fiche de calcul' },
      { code: 'fiches.supprimer', name: 'Supprimer Fiche', module: 'actions_fiches', description: 'Supprimer une fiche de calcul' },
      { code: 'fiches.publier', name: 'Publier/Dépublier Fiche', module: 'actions_fiches', description: 'Publier ou dépublier une fiche' },

      // ===== ACTIONS CRUD - DECLARATIONS =====
      { code: 'declarations.creer', name: 'Créer Déclaration', module: 'actions_declarations', description: 'Créer une nouvelle déclaration' },
      { code: 'declarations.modifier', name: 'Modifier Déclaration', module: 'actions_declarations', description: 'Modifier une déclaration' },
      { code: 'declarations.supprimer', name: 'Supprimer Déclaration', module: 'actions_declarations', description: 'Supprimer une déclaration' },
      { code: 'declarations.remplir', name: 'Remplir Déclaration', module: 'actions_declarations', description: 'Remplir les informations d\'une déclaration' },
      { code: 'declarations.approuver', name: 'Approuver/Rejeter', module: 'actions_declarations', description: 'Approuver ou rejeter une déclaration' },

      // ===== ACTIONS CRUD - FORMATIONS =====
      { code: 'formations.creer', name: 'Créer Formation', module: 'actions_formations', description: 'Créer une formation ou corps' },
      { code: 'formations.modifier', name: 'Modifier Formation', module: 'actions_formations', description: 'Modifier une formation' },
      { code: 'formations.supprimer', name: 'Supprimer Formation', module: 'actions_formations', description: 'Supprimer une formation' },

      // ===== ACTIONS CRUD - SESSIONS =====
      { code: 'sessions.creer', name: 'Créer Session', module: 'actions_sessions', description: 'Créer une session de formation' },
      { code: 'sessions.modifier', name: 'Modifier Session', module: 'actions_sessions', description: 'Modifier une session' },
      { code: 'sessions.supprimer', name: 'Supprimer Session', module: 'actions_sessions', description: 'Supprimer une session' },
      { code: 'sessions.gerer_etudiants', name: 'Gérer Étudiants', module: 'actions_sessions', description: 'Ajouter/retirer des étudiants' },

      // ===== ACTIONS SPECIALES =====
      { code: 'certificats.generer', name: 'Générer Certificats', module: 'actions_speciales', description: 'Générer des certificats pour les étudiants' },
      { code: 'certificats.telecharger', name: 'Télécharger Certificats', module: 'actions_speciales', description: 'Télécharger les PDF des certificats' },
      { code: 'templates.designer', name: 'Designer Templates', module: 'actions_speciales', description: 'Créer et modifier les templates de certificats' },
      { code: 'rapports.exporter', name: 'Exporter Données', module: 'actions_speciales', description: 'Exporter les données en PDF/Excel' },
      { code: 'forums.moderer', name: 'Modérer Forums', module: 'actions_speciales', description: 'Modérer les discussions du forum' },
    ];

    const permissionIdMap = {};
    for (const perm of permissions) {
      const result = await client.query(
        `INSERT INTO permissions (code, name, module, description)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [perm.code, perm.name, perm.module, perm.description]
      );
      permissionIdMap[perm.code] = result.rows[0].id;
    }
    console.log(`    ✅ ${Object.keys(permissionIdMap).length} permissions simplifiées créées`);

    // Step 3: Get existing roles
    const rolesResult = await client.query('SELECT id, name FROM roles');
    const roleIdMap = {};
    for (const role of rolesResult.rows) {
      roleIdMap[role.name] = role.id;
    }

    // Step 4: Assign permissions to roles based on simple logic
    console.log('  📦 Attribution des permissions aux rôles...');

    const rolePermissions = {
      'admin': Object.keys(permissionIdMap), // Admin = TOUT

      'gerant': [
        // Pages
        'page.dashboard', 'page.segments', 'page.villes', 'page.utilisateurs',
        'page.fiches_calcul', 'page.declarations',
        'page.formations', 'page.sessions', 'page.analytics', 'page.rapports',
        'page.certificats', 'page.templates', 'page.forums',
        // Actions
        'utilisateurs.creer', 'utilisateurs.modifier',
        'segments.creer', 'segments.modifier', 'segments.supprimer',
        'villes.creer', 'villes.modifier', 'villes.supprimer',
        'fiches.creer', 'fiches.modifier', 'fiches.publier',
        'declarations.creer', 'declarations.modifier', 'declarations.approuver',
        'formations.creer', 'formations.modifier',
        'sessions.creer', 'sessions.modifier', 'sessions.gerer_etudiants',
        'certificats.generer', 'certificats.telecharger',
        'rapports.exporter', 'forums.moderer',
      ],

      'professor': [
        'page.dashboard',
        'page.declarations',
        'page.forums',
        'declarations.remplir',
      ],

      'assistante': [
        'page.dashboard',
        'page.fiches_calcul',
        'page.declarations',
        'page.certificats',
        'declarations.creer',
        'certificats.generer',
        'certificats.telecharger',
      ],

      'comptable': [
        'page.dashboard',
        'page.fiches_calcul',
        'page.declarations',
        'page.rapports',
        'fiches.creer', 'fiches.modifier',
        'declarations.creer', 'declarations.modifier',
        'rapports.exporter',
      ],

      'superviseur': [
        'page.dashboard',
        'page.segments', 'page.villes', 'page.utilisateurs',
        'page.fiches_calcul', 'page.declarations',
        'page.formations', 'page.sessions',
        'page.analytics', 'page.rapports',
        // Lecture seule - pas d'actions de modification
        'rapports.exporter',
      ],
    };

    let assignedCount = 0;
    for (const [roleName, permCodes] of Object.entries(rolePermissions)) {
      const roleId = roleIdMap[roleName];
      if (!roleId) continue;

      for (const permCode of permCodes) {
        const permId = permissionIdMap[permCode];
        if (!permId) continue;

        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [roleId, permId]
        );
        assignedCount++;
      }
      console.log(`    ✅ ${roleName}: ${permCodes.length} permissions`);
    }

    await client.query('COMMIT');
    console.log('✅ Migration 031 completed successfully!');

    res.json({
      success: true,
      message: 'Permissions simplifiées créées avec succès',
      details: {
        totalPermissions: Object.keys(permissionIdMap).length,
        rolesUpdated: Object.keys(rolePermissions).length,
        totalAssignments: assignedCount,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 031 failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    client.release();
  }
});

router.get('/status', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT module, COUNT(*) as count
      FROM permissions
      GROUP BY module
      ORDER BY module
    `);

    const hasSimplifiedStructure = result.rows.some(r => r.module.startsWith('pages_') || r.module.startsWith('actions_'));

    res.json({
      success: true,
      migrationComplete: hasSimplifiedStructure,
      modules: result.rows,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
