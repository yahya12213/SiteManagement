/**
 * Migration 033 - Menu-Based Permissions
 *
 * Simplifies permissions to match exactly the sidebar menu structure.
 * Each permission corresponds to one menu item = full access to that page.
 *
 * Before: 43 permissions (pages + actions like create, modify, delete, etc.)
 * After: 15 permissions (one per menu item)
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// New simplified permissions - exactly matching the menu
const MENU_PERMISSIONS = [
  // Gestion Comptable (8 items)
  {
    code: 'menu.tableau_bord',
    name: 'Tableau de bord',
    module: 'gestion_comptable',
    description: 'Accès au tableau de bord principal'
  },
  {
    code: 'menu.segments',
    name: 'Segments',
    module: 'gestion_comptable',
    description: 'Gestion des segments (voir, créer, modifier, supprimer)'
  },
  {
    code: 'menu.villes',
    name: 'Villes',
    module: 'gestion_comptable',
    description: 'Gestion des villes (voir, créer, modifier, supprimer)'
  },
  {
    code: 'menu.utilisateurs',
    name: 'Utilisateurs',
    module: 'gestion_comptable',
    description: 'Gestion des utilisateurs (voir, créer, modifier, supprimer, assigner)'
  },
  {
    code: 'menu.roles',
    name: 'Rôles & Permissions',
    module: 'gestion_comptable',
    description: 'Gestion des rôles et permissions'
  },
  {
    code: 'menu.fiches_calcul',
    name: 'Fiches de calcul',
    module: 'gestion_comptable',
    description: 'Gestion des fiches de calcul (voir, créer, modifier, publier)'
  },
  {
    code: 'menu.creer_declaration',
    name: 'Créer déclaration',
    module: 'gestion_comptable',
    description: 'Créer des déclarations pour les professeurs'
  },
  {
    code: 'menu.gerer_declarations',
    name: 'Gérer déclarations',
    module: 'gestion_comptable',
    description: 'Gérer et approuver les déclarations'
  },

  // Formation en Ligne (7 items)
  {
    code: 'menu.formations',
    name: 'Gestion des Formations',
    module: 'formation_en_ligne',
    description: 'Gestion des formations (voir, créer, modifier, supprimer)'
  },
  {
    code: 'menu.sessions',
    name: 'Sessions de Formation',
    module: 'formation_en_ligne',
    description: 'Gestion des sessions de formation'
  },
  {
    code: 'menu.analytics',
    name: 'Analytics',
    module: 'formation_en_ligne',
    description: 'Voir les statistiques et analytics'
  },
  {
    code: 'menu.rapports',
    name: 'Rapports Étudiants',
    module: 'formation_en_ligne',
    description: 'Consulter et exporter les rapports étudiants'
  },
  {
    code: 'menu.certificats',
    name: 'Certificats',
    module: 'formation_en_ligne',
    description: 'Générer et gérer les certificats'
  },
  {
    code: 'menu.templates',
    name: 'Templates de Certificats',
    module: 'formation_en_ligne',
    description: 'Designer et gérer les templates de certificats'
  },
  {
    code: 'menu.forums',
    name: 'Forums',
    module: 'formation_en_ligne',
    description: 'Modérer les forums de discussion'
  }
];

// Role permission assignments - each role gets specific menu access
const ROLE_PERMISSIONS = {
  admin: [
    'menu.tableau_bord',
    'menu.segments',
    'menu.villes',
    'menu.utilisateurs',
    'menu.roles',
    'menu.fiches_calcul',
    'menu.creer_declaration',
    'menu.gerer_declarations',
    'menu.formations',
    'menu.sessions',
    'menu.analytics',
    'menu.rapports',
    'menu.certificats',
    'menu.templates',
    'menu.forums'
  ],
  gerant: [
    'menu.tableau_bord',
    'menu.segments',
    'menu.villes',
    'menu.utilisateurs',
    'menu.fiches_calcul',
    'menu.creer_declaration',
    'menu.gerer_declarations',
    'menu.formations',
    'menu.sessions',
    'menu.analytics',
    'menu.rapports',
    'menu.certificats',
    'menu.templates',
    'menu.forums'
  ],
  professor: [
    'menu.tableau_bord',
    'menu.gerer_declarations',
    'menu.forums'
  ],
  assistante: [
    'menu.tableau_bord',
    'menu.fiches_calcul',
    'menu.creer_declaration',
    'menu.gerer_declarations',
    'menu.certificats'
  ],
  comptable: [
    'menu.tableau_bord',
    'menu.fiches_calcul',
    'menu.gerer_declarations',
    'menu.rapports'
  ],
  superviseur: [
    'menu.tableau_bord',
    'menu.segments',
    'menu.villes',
    'menu.utilisateurs',
    'menu.fiches_calcul',
    'menu.gerer_declarations',
    'menu.formations',
    'menu.sessions',
    'menu.analytics',
    'menu.rapports'
  ]
};

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting Migration 033 - Menu-Based Permissions...');
    await client.query('BEGIN');

    // Step 1: Delete all existing role_permissions
    console.log('  📦 Clearing existing role permissions...');
    await client.query('DELETE FROM role_permissions');
    console.log('    ✅ Role permissions cleared');

    // Step 2: Delete all existing permissions
    console.log('  📦 Clearing existing permissions...');
    await client.query('DELETE FROM permissions');
    console.log('    ✅ Permissions cleared');

    // Step 3: Create new menu-based permissions
    console.log('  📦 Creating new menu-based permissions...');
    const permissionMap = {};

    for (const perm of MENU_PERMISSIONS) {
      const result = await client.query(
        `INSERT INTO permissions (id, code, name, module, description)
         VALUES (gen_random_uuid(), $1, $2, $3, $4)
         RETURNING id`,
        [perm.code, perm.name, perm.module, perm.description]
      );
      permissionMap[perm.code] = result.rows[0].id;
    }
    console.log(`    ✅ Created ${MENU_PERMISSIONS.length} permissions`);

    // Step 4: Get existing roles
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
    console.log('✅ Migration 033 completed successfully!');

    res.json({
      success: true,
      message: 'Permissions simplified to match menu structure',
      details: {
        permissionsCreated: MENU_PERMISSIONS.length,
        permissionsAssigned: assignmentCount,
        modules: ['gestion_comptable', 'formation_en_ligne']
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 033 failed:', error.message);
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
    // Check if we have menu-based permissions
    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM permissions
      WHERE code LIKE 'menu.%'
    `);

    const menuPermCount = parseInt(result.rows[0].count);
    const migrationComplete = menuPermCount === MENU_PERMISSIONS.length;

    res.json({
      success: true,
      migrationComplete,
      menuPermissionsCount: menuPermCount,
      expectedCount: MENU_PERMISSIONS.length,
      message: migrationComplete
        ? 'Menu-based permissions are configured'
        : 'Migration needed - still using old permission structure'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
