/**
 * Migration 034 - Hierarchical Permissions
 *
 * Creates permissions organized by menu page with specific actions.
 * Each page has: Voir (view), Créer (create), Modifier (edit), Supprimer (delete), etc.
 *
 * Structure: menu.page.action (e.g., menu.segments.voir, menu.segments.creer)
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// Hierarchical permissions - organized by menu page
const HIERARCHICAL_PERMISSIONS = [
  // ==================== GESTION COMPTABLE ====================

  // Tableau de bord
  { code: 'menu.tableau_bord.voir', name: 'Voir', module: 'gestion_comptable.tableau_bord', description: 'Accéder au tableau de bord' },

  // Segments
  { code: 'menu.segments.voir', name: 'Voir', module: 'gestion_comptable.segments', description: 'Voir la liste des segments' },
  { code: 'menu.segments.creer', name: 'Créer', module: 'gestion_comptable.segments', description: 'Créer un nouveau segment' },
  { code: 'menu.segments.modifier', name: 'Modifier', module: 'gestion_comptable.segments', description: 'Modifier un segment existant' },
  { code: 'menu.segments.supprimer', name: 'Supprimer', module: 'gestion_comptable.segments', description: 'Supprimer un segment' },

  // Villes
  { code: 'menu.villes.voir', name: 'Voir', module: 'gestion_comptable.villes', description: 'Voir la liste des villes' },
  { code: 'menu.villes.creer', name: 'Créer', module: 'gestion_comptable.villes', description: 'Créer une nouvelle ville' },
  { code: 'menu.villes.modifier', name: 'Modifier', module: 'gestion_comptable.villes', description: 'Modifier une ville existante' },
  { code: 'menu.villes.supprimer', name: 'Supprimer', module: 'gestion_comptable.villes', description: 'Supprimer une ville' },

  // Utilisateurs
  { code: 'menu.utilisateurs.voir', name: 'Voir', module: 'gestion_comptable.utilisateurs', description: 'Voir la liste des utilisateurs' },
  { code: 'menu.utilisateurs.creer', name: 'Créer', module: 'gestion_comptable.utilisateurs', description: 'Créer un nouvel utilisateur' },
  { code: 'menu.utilisateurs.modifier', name: 'Modifier', module: 'gestion_comptable.utilisateurs', description: 'Modifier un utilisateur' },
  { code: 'menu.utilisateurs.supprimer', name: 'Supprimer', module: 'gestion_comptable.utilisateurs', description: 'Supprimer un utilisateur' },
  { code: 'menu.utilisateurs.assigner', name: 'Assigner', module: 'gestion_comptable.utilisateurs', description: 'Assigner segments/villes' },

  // Rôles & Permissions
  { code: 'menu.roles.voir', name: 'Voir', module: 'gestion_comptable.roles', description: 'Voir les rôles et permissions' },
  { code: 'menu.roles.creer', name: 'Créer', module: 'gestion_comptable.roles', description: 'Créer un nouveau rôle' },
  { code: 'menu.roles.modifier', name: 'Modifier', module: 'gestion_comptable.roles', description: 'Modifier les permissions d\'un rôle' },
  { code: 'menu.roles.supprimer', name: 'Supprimer', module: 'gestion_comptable.roles', description: 'Supprimer un rôle' },

  // Fiches de calcul
  { code: 'menu.fiches_calcul.voir', name: 'Voir', module: 'gestion_comptable.fiches_calcul', description: 'Voir les fiches de calcul' },
  { code: 'menu.fiches_calcul.creer', name: 'Créer', module: 'gestion_comptable.fiches_calcul', description: 'Créer une nouvelle fiche' },
  { code: 'menu.fiches_calcul.modifier', name: 'Modifier', module: 'gestion_comptable.fiches_calcul', description: 'Modifier une fiche existante' },
  { code: 'menu.fiches_calcul.supprimer', name: 'Supprimer', module: 'gestion_comptable.fiches_calcul', description: 'Supprimer une fiche' },
  { code: 'menu.fiches_calcul.publier', name: 'Publier', module: 'gestion_comptable.fiches_calcul', description: 'Publier/Dépublier une fiche' },

  // Créer déclaration
  { code: 'menu.creer_declaration.creer', name: 'Créer', module: 'gestion_comptable.creer_declaration', description: 'Créer des déclarations pour les professeurs' },

  // Gérer déclarations
  { code: 'menu.gerer_declarations.voir', name: 'Voir', module: 'gestion_comptable.gerer_declarations', description: 'Voir toutes les déclarations' },
  { code: 'menu.gerer_declarations.modifier', name: 'Modifier', module: 'gestion_comptable.gerer_declarations', description: 'Modifier une déclaration' },
  { code: 'menu.gerer_declarations.approuver', name: 'Approuver', module: 'gestion_comptable.gerer_declarations', description: 'Approuver ou rejeter une déclaration' },
  { code: 'menu.gerer_declarations.supprimer', name: 'Supprimer', module: 'gestion_comptable.gerer_declarations', description: 'Supprimer une déclaration' },

  // ==================== FORMATION EN LIGNE ====================

  // Gestion des Formations
  { code: 'menu.formations.voir', name: 'Voir', module: 'formation_en_ligne.formations', description: 'Voir les formations' },
  { code: 'menu.formations.creer', name: 'Créer', module: 'formation_en_ligne.formations', description: 'Créer une nouvelle formation' },
  { code: 'menu.formations.modifier', name: 'Modifier', module: 'formation_en_ligne.formations', description: 'Modifier une formation' },
  { code: 'menu.formations.supprimer', name: 'Supprimer', module: 'formation_en_ligne.formations', description: 'Supprimer une formation' },

  // Sessions de Formation
  { code: 'menu.sessions.voir', name: 'Voir', module: 'formation_en_ligne.sessions', description: 'Voir les sessions' },
  { code: 'menu.sessions.creer', name: 'Créer', module: 'formation_en_ligne.sessions', description: 'Créer une nouvelle session' },
  { code: 'menu.sessions.modifier', name: 'Modifier', module: 'formation_en_ligne.sessions', description: 'Modifier une session' },
  { code: 'menu.sessions.supprimer', name: 'Supprimer', module: 'formation_en_ligne.sessions', description: 'Supprimer une session' },
  { code: 'menu.sessions.gerer_etudiants', name: 'Gérer Étudiants', module: 'formation_en_ligne.sessions', description: 'Ajouter/retirer des étudiants' },

  // Analytics
  { code: 'menu.analytics.voir', name: 'Voir', module: 'formation_en_ligne.analytics', description: 'Voir les statistiques' },
  { code: 'menu.analytics.exporter', name: 'Exporter', module: 'formation_en_ligne.analytics', description: 'Exporter les données analytics' },

  // Rapports Étudiants
  { code: 'menu.rapports.voir', name: 'Voir', module: 'formation_en_ligne.rapports', description: 'Voir les rapports étudiants' },
  { code: 'menu.rapports.exporter', name: 'Exporter', module: 'formation_en_ligne.rapports', description: 'Exporter les rapports' },

  // Certificats
  { code: 'menu.certificats.voir', name: 'Voir', module: 'formation_en_ligne.certificats', description: 'Voir les certificats' },
  { code: 'menu.certificats.generer', name: 'Générer', module: 'formation_en_ligne.certificats', description: 'Générer des certificats' },
  { code: 'menu.certificats.telecharger', name: 'Télécharger', module: 'formation_en_ligne.certificats', description: 'Télécharger des certificats' },

  // Templates de Certificats
  { code: 'menu.templates.voir', name: 'Voir', module: 'formation_en_ligne.templates', description: 'Voir les templates' },
  { code: 'menu.templates.creer', name: 'Créer', module: 'formation_en_ligne.templates', description: 'Créer un nouveau template' },
  { code: 'menu.templates.modifier', name: 'Modifier', module: 'formation_en_ligne.templates', description: 'Modifier un template' },
  { code: 'menu.templates.supprimer', name: 'Supprimer', module: 'formation_en_ligne.templates', description: 'Supprimer un template' },

  // Forums
  { code: 'menu.forums.voir', name: 'Voir', module: 'formation_en_ligne.forums', description: 'Voir les forums' },
  { code: 'menu.forums.moderer', name: 'Modérer', module: 'formation_en_ligne.forums', description: 'Modérer les discussions' },
];

// Role permission assignments
const ROLE_PERMISSIONS = {
  admin: HIERARCHICAL_PERMISSIONS.map(p => p.code), // All permissions

  gerant: [
    'menu.tableau_bord.voir',
    'menu.segments.voir', 'menu.segments.creer', 'menu.segments.modifier', 'menu.segments.supprimer',
    'menu.villes.voir', 'menu.villes.creer', 'menu.villes.modifier', 'menu.villes.supprimer',
    'menu.utilisateurs.voir', 'menu.utilisateurs.creer', 'menu.utilisateurs.modifier', 'menu.utilisateurs.assigner',
    'menu.fiches_calcul.voir', 'menu.fiches_calcul.creer', 'menu.fiches_calcul.modifier', 'menu.fiches_calcul.publier',
    'menu.creer_declaration.creer',
    'menu.gerer_declarations.voir', 'menu.gerer_declarations.modifier', 'menu.gerer_declarations.approuver',
    'menu.formations.voir', 'menu.formations.creer', 'menu.formations.modifier',
    'menu.sessions.voir', 'menu.sessions.creer', 'menu.sessions.modifier', 'menu.sessions.gerer_etudiants',
    'menu.analytics.voir',
    'menu.rapports.voir', 'menu.rapports.exporter',
    'menu.certificats.voir', 'menu.certificats.generer', 'menu.certificats.telecharger',
    'menu.templates.voir', 'menu.templates.creer', 'menu.templates.modifier',
    'menu.forums.voir', 'menu.forums.moderer',
  ],

  professor: [
    'menu.tableau_bord.voir',
    'menu.gerer_declarations.voir', 'menu.gerer_declarations.modifier',
    'menu.forums.voir',
  ],

  assistante: [
    'menu.tableau_bord.voir',
    'menu.fiches_calcul.voir',
    'menu.creer_declaration.creer',
    'menu.gerer_declarations.voir',
    'menu.certificats.voir', 'menu.certificats.generer', 'menu.certificats.telecharger',
  ],

  comptable: [
    'menu.tableau_bord.voir',
    'menu.fiches_calcul.voir', 'menu.fiches_calcul.creer', 'menu.fiches_calcul.modifier',
    'menu.gerer_declarations.voir', 'menu.gerer_declarations.modifier',
    'menu.rapports.voir', 'menu.rapports.exporter',
  ],

  superviseur: [
    'menu.tableau_bord.voir',
    'menu.segments.voir',
    'menu.villes.voir',
    'menu.utilisateurs.voir',
    'menu.fiches_calcul.voir',
    'menu.gerer_declarations.voir',
    'menu.formations.voir',
    'menu.sessions.voir',
    'menu.analytics.voir',
    'menu.rapports.voir', 'menu.rapports.exporter',
  ],
};

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting Migration 034 - Hierarchical Permissions...');
    await client.query('BEGIN');

    // Step 1: Delete all existing role_permissions
    console.log('  📦 Clearing existing role permissions...');
    await client.query('DELETE FROM role_permissions');
    console.log('    ✅ Role permissions cleared');

    // Step 2: Delete all existing permissions
    console.log('  📦 Clearing existing permissions...');
    await client.query('DELETE FROM permissions');
    console.log('    ✅ Permissions cleared');

    // Step 3: Create new hierarchical permissions
    console.log('  📦 Creating hierarchical permissions...');
    const permissionMap = {};

    for (const perm of HIERARCHICAL_PERMISSIONS) {
      const result = await client.query(
        `INSERT INTO permissions (id, code, name, module, description)
         VALUES (gen_random_uuid(), $1, $2, $3, $4)
         RETURNING id`,
        [perm.code, perm.name, perm.module, perm.description]
      );
      permissionMap[perm.code] = result.rows[0].id;
    }
    console.log(`    ✅ Created ${HIERARCHICAL_PERMISSIONS.length} permissions`);

    // Step 4: Assign permissions to roles
    console.log('  📦 Assigning permissions to roles...');
    const rolesResult = await client.query('SELECT id, name FROM roles');
    const roles = rolesResult.rows;

    let assignmentCount = 0;
    for (const role of roles) {
      const roleName = role.name.toLowerCase();
      const permissionCodes = ROLE_PERMISSIONS[roleName] || [];

      for (const code of permissionCodes) {
        const permissionId = permissionMap[code];
        if (permissionId) {
          await client.query(
            `INSERT INTO role_permissions (role_id, permission_id)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [role.id, permissionId]
          );
          assignmentCount++;
        }
      }
    }
    console.log(`    ✅ Assigned ${assignmentCount} permissions to roles`);

    await client.query('COMMIT');
    console.log('✅ Migration 034 completed successfully!');

    res.json({
      success: true,
      message: 'Hierarchical permissions created successfully',
      details: {
        permissionsCreated: HIERARCHICAL_PERMISSIONS.length,
        permissionsAssigned: assignmentCount,
        structure: 'menu.page.action'
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 034 failed:', error.message);
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
    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM permissions
      WHERE code LIKE 'menu.%.%'
    `);

    const hierarchicalCount = parseInt(result.rows[0].count);
    const migrationComplete = hierarchicalCount === HIERARCHICAL_PERMISSIONS.length;

    res.json({
      success: true,
      migrationComplete,
      hierarchicalPermissionsCount: hierarchicalCount,
      expectedCount: HIERARCHICAL_PERMISSIONS.length,
      message: migrationComplete
        ? 'Hierarchical permissions are configured'
        : 'Migration needed'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
