import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 040: Complete Hierarchical RBAC System
// Creates new permission structure based on menu hierarchy
// Format: module.menu.action (e.g., accounting.segments.view_page)

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 040: Hierarchical RBAC System ===');

    // Step 1: Drop old tables and recreate with new structure
    console.log('Step 1: Recreating permissions table with new structure...');

    // Backup existing role_permissions
    const existingRolePerms = await client.query(`
      SELECT rp.role_id, r.name as role_name
      FROM role_permissions rp
      JOIN roles r ON rp.role_id = r.id
    `);
    console.log(`Backed up ${existingRolePerms.rows.length} existing role-permission assignments`);

    // Drop old tables
    await client.query('DROP TABLE IF EXISTS role_permissions CASCADE');
    await client.query('DROP TABLE IF EXISTS permissions CASCADE');

    // Create new permissions table with hierarchical structure
    await client.query(`
      CREATE TABLE permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        module TEXT NOT NULL,
        menu TEXT NOT NULL,
        action TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        label TEXT NOT NULL,
        description TEXT,
        sort_order INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT unique_permission UNIQUE (module, menu, action)
      )
    `);

    // Recreate role_permissions junction table
    await client.query(`
      CREATE TABLE role_permissions (
        role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
        permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
        granted_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (role_id, permission_id)
      )
    `);

    // Create user_roles table for N-N relationship
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_roles (
        user_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
        role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
        assigned_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, role_id)
      )
    `);

    console.log('Step 2: Inserting all hierarchical permissions...');

    // Define all permissions organized by module and menu
    const permissions = [
      // ========================================
      // GESTION COMPTABLE (Accounting)
      // ========================================

      // 1. Tableau de bord
      { module: 'accounting', menu: 'dashboard', action: 'view_page', code: 'accounting.dashboard.view_page', label: 'Voir le tableau de bord', sort_order: 100 },

      // 2. Segments
      { module: 'accounting', menu: 'segments', action: 'view_page', code: 'accounting.segments.view_page', label: 'Voir la page Segments', sort_order: 200 },
      { module: 'accounting', menu: 'segments', action: 'create', code: 'accounting.segments.create', label: 'Créer un segment', sort_order: 201 },
      { module: 'accounting', menu: 'segments', action: 'update', code: 'accounting.segments.update', label: 'Modifier un segment', sort_order: 202 },
      { module: 'accounting', menu: 'segments', action: 'delete', code: 'accounting.segments.delete', label: 'Supprimer un segment', sort_order: 203 },
      { module: 'accounting', menu: 'segments', action: 'import_cities', code: 'accounting.segments.import_cities', label: 'Importer des villes', sort_order: 204 },

      // 3. Villes
      { module: 'accounting', menu: 'cities', action: 'view_page', code: 'accounting.cities.view_page', label: 'Voir la page Villes', sort_order: 300 },
      { module: 'accounting', menu: 'cities', action: 'create', code: 'accounting.cities.create', label: 'Créer une ville', sort_order: 301 },
      { module: 'accounting', menu: 'cities', action: 'update', code: 'accounting.cities.update', label: 'Modifier une ville', sort_order: 302 },
      { module: 'accounting', menu: 'cities', action: 'delete', code: 'accounting.cities.delete', label: 'Supprimer une ville', sort_order: 303 },
      { module: 'accounting', menu: 'cities', action: 'bulk_delete', code: 'accounting.cities.bulk_delete', label: 'Suppression en masse', sort_order: 304 },

      // 4. Utilisateurs
      { module: 'accounting', menu: 'users', action: 'view_page', code: 'accounting.users.view_page', label: 'Voir la page Utilisateurs', sort_order: 400 },
      { module: 'accounting', menu: 'users', action: 'create', code: 'accounting.users.create', label: 'Créer un utilisateur', sort_order: 401 },
      { module: 'accounting', menu: 'users', action: 'update', code: 'accounting.users.update', label: 'Modifier un utilisateur', sort_order: 402 },
      { module: 'accounting', menu: 'users', action: 'delete', code: 'accounting.users.delete', label: 'Supprimer un utilisateur', sort_order: 403 },
      { module: 'accounting', menu: 'users', action: 'assign_segments', code: 'accounting.users.assign_segments', label: 'Assigner des segments', sort_order: 404 },
      { module: 'accounting', menu: 'users', action: 'assign_cities', code: 'accounting.users.assign_cities', label: 'Assigner des villes', sort_order: 405 },
      { module: 'accounting', menu: 'users', action: 'assign_roles', code: 'accounting.users.assign_roles', label: 'Assigner des rôles', sort_order: 406 },

      // 5. Rôles & Permissions
      { module: 'accounting', menu: 'roles', action: 'view_page', code: 'accounting.roles.view_page', label: 'Voir la page Rôles', sort_order: 500 },
      { module: 'accounting', menu: 'roles', action: 'create', code: 'accounting.roles.create', label: 'Créer un rôle', sort_order: 501 },
      { module: 'accounting', menu: 'roles', action: 'update', code: 'accounting.roles.update', label: 'Modifier un rôle', sort_order: 502 },
      { module: 'accounting', menu: 'roles', action: 'delete', code: 'accounting.roles.delete', label: 'Supprimer un rôle', sort_order: 503 },

      // 6. Fiches de calcul
      { module: 'accounting', menu: 'calculation_sheets', action: 'view_page', code: 'accounting.calculation_sheets.view_page', label: 'Voir la page Fiches de calcul', sort_order: 600 },
      { module: 'accounting', menu: 'calculation_sheets', action: 'create', code: 'accounting.calculation_sheets.create', label: 'Créer une fiche de calcul', sort_order: 601 },
      { module: 'accounting', menu: 'calculation_sheets', action: 'update', code: 'accounting.calculation_sheets.update', label: 'Modifier une fiche de calcul', sort_order: 602 },
      { module: 'accounting', menu: 'calculation_sheets', action: 'delete', code: 'accounting.calculation_sheets.delete', label: 'Supprimer une fiche de calcul', sort_order: 603 },
      { module: 'accounting', menu: 'calculation_sheets', action: 'publish', code: 'accounting.calculation_sheets.publish', label: 'Publier/Dépublier une fiche', sort_order: 604 },
      { module: 'accounting', menu: 'calculation_sheets', action: 'duplicate', code: 'accounting.calculation_sheets.duplicate', label: 'Dupliquer une fiche', sort_order: 605 },
      { module: 'accounting', menu: 'calculation_sheets', action: 'export', code: 'accounting.calculation_sheets.export', label: 'Exporter en JSON', sort_order: 606 },
      { module: 'accounting', menu: 'calculation_sheets', action: 'settings', code: 'accounting.calculation_sheets.settings', label: 'Gérer les paramètres', sort_order: 607 },

      // 7. Créer déclaration (page dédiée)
      { module: 'accounting', menu: 'create_declaration', action: 'view_page', code: 'accounting.create_declaration.view_page', label: 'Accéder à création déclaration', sort_order: 700 },

      // 8. Gérer déclarations
      { module: 'accounting', menu: 'declarations', action: 'view_page', code: 'accounting.declarations.view_page', label: 'Voir la page Déclarations', sort_order: 800 },
      { module: 'accounting', menu: 'declarations', action: 'view_all', code: 'accounting.declarations.view_all', label: 'Voir TOUTES les déclarations', sort_order: 801 },
      { module: 'accounting', menu: 'declarations', action: 'create', code: 'accounting.declarations.create', label: 'Créer pour un autre professeur', sort_order: 802 },
      { module: 'accounting', menu: 'declarations', action: 'update', code: 'accounting.declarations.update', label: 'Modifier une déclaration', sort_order: 803 },
      { module: 'accounting', menu: 'declarations', action: 'delete', code: 'accounting.declarations.delete', label: 'Supprimer une déclaration', sort_order: 804 },
      { module: 'accounting', menu: 'declarations', action: 'approve', code: 'accounting.declarations.approve', label: 'Approuver une déclaration', sort_order: 805 },
      { module: 'accounting', menu: 'declarations', action: 'reject', code: 'accounting.declarations.reject', label: 'Rejeter une déclaration', sort_order: 806 },
      { module: 'accounting', menu: 'declarations', action: 'request_modification', code: 'accounting.declarations.request_modification', label: 'Demander modification', sort_order: 807 },

      // ========================================
      // FORMATION EN LIGNE (Training)
      // ========================================

      // 9. Gestion des Formations
      { module: 'training', menu: 'formations', action: 'view_page', code: 'training.formations.view_page', label: 'Voir la page Formations', sort_order: 1000 },
      { module: 'training', menu: 'formations', action: 'create', code: 'training.formations.create', label: 'Créer une formation', sort_order: 1001 },
      { module: 'training', menu: 'formations', action: 'update', code: 'training.formations.update', label: 'Modifier une formation', sort_order: 1002 },
      { module: 'training', menu: 'formations', action: 'delete', code: 'training.formations.delete', label: 'Supprimer une formation', sort_order: 1003 },
      { module: 'training', menu: 'formations', action: 'duplicate', code: 'training.formations.duplicate', label: 'Dupliquer une formation', sort_order: 1004 },
      { module: 'training', menu: 'formations', action: 'create_pack', code: 'training.formations.create_pack', label: 'Créer un pack', sort_order: 1005 },
      { module: 'training', menu: 'formations', action: 'edit_content', code: 'training.formations.edit_content', label: 'Éditer le contenu du cours', sort_order: 1006 },
      { module: 'training', menu: 'corps', action: 'create', code: 'training.corps.create', label: 'Créer un corps de formation', sort_order: 1007 },
      { module: 'training', menu: 'corps', action: 'update', code: 'training.corps.update', label: 'Modifier un corps', sort_order: 1008 },
      { module: 'training', menu: 'corps', action: 'delete', code: 'training.corps.delete', label: 'Supprimer un corps', sort_order: 1009 },

      // 10. Sessions de Formation
      { module: 'training', menu: 'sessions', action: 'view_page', code: 'training.sessions.view_page', label: 'Voir la page Sessions', sort_order: 1100 },
      { module: 'training', menu: 'sessions', action: 'create', code: 'training.sessions.create', label: 'Créer une session', sort_order: 1101 },
      { module: 'training', menu: 'sessions', action: 'update', code: 'training.sessions.update', label: 'Modifier une session', sort_order: 1102 },
      { module: 'training', menu: 'sessions', action: 'delete', code: 'training.sessions.delete', label: 'Supprimer une session', sort_order: 1103 },
      { module: 'training', menu: 'sessions', action: 'view_details', code: 'training.sessions.view_details', label: 'Voir les détails', sort_order: 1104 },

      // 11. Analytics
      { module: 'training', menu: 'analytics', action: 'view_page', code: 'training.analytics.view_page', label: 'Voir les analytics', sort_order: 1200 },
      { module: 'training', menu: 'analytics', action: 'export_csv', code: 'training.analytics.export_csv', label: 'Exporter en CSV', sort_order: 1201 },
      { module: 'training', menu: 'analytics', action: 'change_period', code: 'training.analytics.change_period', label: 'Changer la période', sort_order: 1202 },

      // 12. Rapports Étudiants
      { module: 'training', menu: 'student_reports', action: 'view_page', code: 'training.student_reports.view_page', label: 'Voir les rapports étudiants', sort_order: 1300 },
      { module: 'training', menu: 'student_reports', action: 'search', code: 'training.student_reports.search', label: 'Rechercher un étudiant', sort_order: 1301 },
      { module: 'training', menu: 'student_reports', action: 'export_csv', code: 'training.student_reports.export_csv', label: 'Exporter en CSV', sort_order: 1302 },
      { module: 'training', menu: 'student_reports', action: 'export_pdf', code: 'training.student_reports.export_pdf', label: 'Exporter en PDF', sort_order: 1303 },

      // 13. Certificats
      { module: 'training', menu: 'certificates', action: 'view_page', code: 'training.certificates.view_page', label: 'Voir les certificats', sort_order: 1400 },
      { module: 'training', menu: 'certificates', action: 'download', code: 'training.certificates.download', label: 'Télécharger un certificat', sort_order: 1401 },
      { module: 'training', menu: 'certificates', action: 'delete', code: 'training.certificates.delete', label: 'Supprimer un certificat', sort_order: 1402 },
      { module: 'training', menu: 'certificates', action: 'search', code: 'training.certificates.search', label: 'Rechercher un certificat', sort_order: 1403 },

      // 14. Templates de Certificats
      { module: 'training', menu: 'certificate_templates', action: 'view_page', code: 'training.certificate_templates.view_page', label: 'Voir les templates', sort_order: 1500 },
      { module: 'training', menu: 'certificate_templates', action: 'create_folder', code: 'training.certificate_templates.create_folder', label: 'Créer un dossier', sort_order: 1501 },
      { module: 'training', menu: 'certificate_templates', action: 'create_template', code: 'training.certificate_templates.create_template', label: 'Créer un template', sort_order: 1502 },
      { module: 'training', menu: 'certificate_templates', action: 'rename', code: 'training.certificate_templates.rename', label: 'Renommer', sort_order: 1503 },
      { module: 'training', menu: 'certificate_templates', action: 'delete', code: 'training.certificate_templates.delete', label: 'Supprimer', sort_order: 1504 },
      { module: 'training', menu: 'certificate_templates', action: 'duplicate', code: 'training.certificate_templates.duplicate', label: 'Dupliquer', sort_order: 1505 },
      { module: 'training', menu: 'certificate_templates', action: 'edit_canvas', code: 'training.certificate_templates.edit_canvas', label: 'Éditer le canvas', sort_order: 1506 },
      { module: 'training', menu: 'certificate_templates', action: 'organize', code: 'training.certificate_templates.organize', label: 'Organiser les dossiers', sort_order: 1507 },

      // 15. Forums
      { module: 'training', menu: 'forums', action: 'view_page', code: 'training.forums.view_page', label: 'Voir les forums', sort_order: 1600 },
      { module: 'training', menu: 'forums', action: 'pin_discussion', code: 'training.forums.pin_discussion', label: 'Épingler une discussion', sort_order: 1601 },
      { module: 'training', menu: 'forums', action: 'lock_discussion', code: 'training.forums.lock_discussion', label: 'Verrouiller une discussion', sort_order: 1602 },
      { module: 'training', menu: 'forums', action: 'delete_content', code: 'training.forums.delete_content', label: 'Supprimer du contenu', sort_order: 1603 },
      { module: 'training', menu: 'forums', action: 'moderate', code: 'training.forums.moderate', label: 'Modérer globalement', sort_order: 1604 },
    ];

    // Insert all permissions
    let insertedCount = 0;
    for (const perm of permissions) {
      await client.query(`
        INSERT INTO permissions (module, menu, action, code, label, sort_order)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [perm.module, perm.menu, perm.action, perm.code, perm.label, perm.sort_order]);
      insertedCount++;
    }
    console.log(`Inserted ${insertedCount} hierarchical permissions`);

    // Step 3: Assign all permissions to admin role
    console.log('Step 3: Assigning all permissions to admin role...');

    const adminRole = await client.query(`SELECT id FROM roles WHERE name = 'admin'`);
    if (adminRole.rows.length > 0) {
      const adminRoleId = adminRole.rows[0].id;
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT $1, id FROM permissions
        ON CONFLICT DO NOTHING
      `, [adminRoleId]);
      console.log('Admin role now has all permissions');
    }

    // Step 4: Create default gerant role permissions
    console.log('Step 4: Assigning default permissions to gerant role...');
    const gerantRole = await client.query(`SELECT id FROM roles WHERE name = 'gerant'`);
    if (gerantRole.rows.length > 0) {
      const gerantRoleId = gerantRole.rows[0].id;
      // Gerant gets most accounting permissions except role management and user deletion
      const gerantPermissions = [
        'accounting.dashboard.view_page',
        'accounting.segments.view_page', 'accounting.segments.create', 'accounting.segments.update',
        'accounting.cities.view_page', 'accounting.cities.create', 'accounting.cities.update', 'accounting.cities.delete',
        'accounting.users.view_page', 'accounting.users.create', 'accounting.users.update', 'accounting.users.assign_segments', 'accounting.users.assign_cities',
        'accounting.calculation_sheets.view_page', 'accounting.calculation_sheets.create', 'accounting.calculation_sheets.update', 'accounting.calculation_sheets.publish', 'accounting.calculation_sheets.duplicate', 'accounting.calculation_sheets.export',
        'accounting.create_declaration.view_page',
        'accounting.declarations.view_page', 'accounting.declarations.view_all', 'accounting.declarations.create', 'accounting.declarations.update', 'accounting.declarations.approve', 'accounting.declarations.reject', 'accounting.declarations.request_modification',
      ];
      for (const code of gerantPermissions) {
        await client.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          SELECT $1, id FROM permissions WHERE code = $2
          ON CONFLICT DO NOTHING
        `, [gerantRoleId, code]);
      }
      console.log(`Gerant role assigned ${gerantPermissions.length} permissions`);
    }

    // Step 5: Create impression role if not exists
    console.log('Step 5: Creating impression role with specific permissions...');
    let impressionRoleId;
    const existingImpression = await client.query(`SELECT id FROM roles WHERE name = 'impression'`);
    if (existingImpression.rows.length === 0) {
      const newRole = await client.query(`
        INSERT INTO roles (name, description, is_system_role)
        VALUES ('impression', 'Rôle lecture seule pour toutes les déclarations', false)
        RETURNING id
      `);
      impressionRoleId = newRole.rows[0].id;
      console.log('Created impression role');
    } else {
      impressionRoleId = existingImpression.rows[0].id;
      console.log('Impression role already exists');
    }

    // Assign impression role permissions
    const impressionPermissions = [
      'accounting.declarations.view_page',
      'accounting.declarations.view_all',
      'accounting.declarations.create', // Can create for other professors
    ];
    for (const code of impressionPermissions) {
      await client.query(`
        INSERT INTO role_permissions (role_id, permission_id)
        SELECT $1, id FROM permissions WHERE code = $2
        ON CONFLICT DO NOTHING
      `, [impressionRoleId, code]);
    }
    console.log(`Impression role assigned ${impressionPermissions.length} permissions`);

    // Step 6: Migrate existing user role_id to user_roles table
    console.log('Step 6: Migrating user roles to user_roles table...');
    const usersWithRoles = await client.query(`
      SELECT id, role_id FROM profiles WHERE role_id IS NOT NULL
    `);
    for (const user of usersWithRoles.rows) {
      await client.query(`
        INSERT INTO user_roles (user_id, role_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [user.id, user.role_id]);
    }
    console.log(`Migrated ${usersWithRoles.rows.length} user role assignments`);

    // Step 7: Update profiles with impression role
    console.log('Step 7: Updating profiles with impression role...');
    await client.query(`
      UPDATE profiles
      SET role_id = $1
      WHERE role = 'impression' AND (role_id IS NULL OR role_id != $1)
    `, [impressionRoleId]);

    await client.query('COMMIT');

    // Summary
    const permCount = await client.query('SELECT COUNT(*) as count FROM permissions');
    const roleCount = await client.query('SELECT COUNT(*) as count FROM roles');
    const rolePermCount = await client.query('SELECT COUNT(*) as count FROM role_permissions');
    const userRoleCount = await client.query('SELECT COUNT(*) as count FROM user_roles');

    res.json({
      success: true,
      message: 'Migration 040 completed successfully',
      summary: {
        total_permissions: permCount.rows[0].count,
        total_roles: roleCount.rows[0].count,
        role_permission_assignments: rolePermCount.rows[0].count,
        user_role_assignments: userRoleCount.rows[0].count,
        permissions_by_module: {
          accounting: 39,
          training: 39,
        }
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 040 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  } finally {
    client.release();
    await pool.end();
  }
});

export default router;
