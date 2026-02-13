/**
 * Migration 029 - Role-Based Access Control (RBAC) System
 *
 * CRITICAL: This migration is ADDITIVE only - no data loss
 * - Creates new roles table (dynamic roles)
 * - Creates new permissions table (granular permissions)
 * - Creates role_permissions junction table
 * - Adds role_id column to profiles (keeps old role column for compatibility)
 * - Migrates existing roles to new system
 * - Seeds default permissions
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting RBAC Migration 029...');
    await client.query('BEGIN');

    // Step 1: Create roles table
    console.log('  📦 Creating roles table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT UNIQUE NOT NULL,
        description TEXT,
        is_system_role BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Step 2: Create permissions table
    console.log('  📦 Creating permissions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS permissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        module TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Step 3: Create role_permissions junction table
    console.log('  📦 Creating role_permissions table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
        permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
        granted_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (role_id, permission_id)
      )
    `);

    // Step 4: Add role_id column to profiles (ADDITIVE - keeps old role column)
    console.log('  📦 Adding role_id to profiles...');
    const checkColumn = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'profiles' AND column_name = 'role_id'
    `);

    if (checkColumn.rows.length === 0) {
      await client.query(`
        ALTER TABLE profiles
        ADD COLUMN role_id UUID REFERENCES roles(id)
      `);
    }

    // Step 5: Insert default roles (mapping from old system)
    console.log('  📦 Seeding default roles...');
    const defaultRoles = [
      { name: 'admin', description: 'Administrateur - Accès complet', is_system_role: true },
      { name: 'gerant', description: 'Gérant - Gestion quotidienne', is_system_role: false },
      { name: 'professor', description: 'Professeur - Gestion des cours', is_system_role: false },
      { name: 'assistante', description: 'Assistante - Génération de documents', is_system_role: false },
      { name: 'comptable', description: 'Comptable - Gestion financière', is_system_role: false },
      { name: 'superviseur', description: 'Superviseur - Vue d\'ensemble', is_system_role: false },
    ];

    const roleIdMap = {};
    for (const role of defaultRoles) {
      const existing = await client.query(
        'SELECT id FROM roles WHERE name = $1',
        [role.name]
      );

      if (existing.rows.length === 0) {
        const result = await client.query(
          `INSERT INTO roles (name, description, is_system_role)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [role.name, role.description, role.is_system_role]
        );
        roleIdMap[role.name] = result.rows[0].id;
      } else {
        roleIdMap[role.name] = existing.rows[0].id;
      }
    }
    console.log('    ✅ Roles created:', Object.keys(roleIdMap));

    // Step 6: Insert comprehensive permissions
    console.log('  📦 Seeding permissions...');
    const permissions = [
      // User Management
      { code: 'users.view', name: 'Voir Utilisateurs', module: 'users', description: 'Visualiser la liste des utilisateurs' },
      { code: 'users.create', name: 'Créer Utilisateurs', module: 'users', description: 'Créer de nouveaux utilisateurs' },
      { code: 'users.edit', name: 'Modifier Utilisateurs', module: 'users', description: 'Modifier les informations des utilisateurs' },
      { code: 'users.delete', name: 'Supprimer Utilisateurs', module: 'users', description: 'Supprimer des utilisateurs' },
      { code: 'users.manage_roles', name: 'Gérer Rôles', module: 'users', description: 'Assigner et modifier les rôles' },

      // Student Management
      { code: 'students.view', name: 'Voir Étudiants', module: 'students', description: 'Visualiser les informations des étudiants' },
      { code: 'students.create', name: 'Créer Étudiants', module: 'students', description: 'Inscrire de nouveaux étudiants' },
      { code: 'students.edit', name: 'Modifier Étudiants', module: 'students', description: 'Modifier les informations des étudiants' },
      { code: 'students.delete', name: 'Supprimer Étudiants', module: 'students', description: 'Supprimer des étudiants' },
      { code: 'students.manage_status', name: 'Gérer Statut Étudiants', module: 'students', description: 'Changer le statut des étudiants' },

      // Sessions Management
      { code: 'sessions.view', name: 'Voir Sessions', module: 'sessions', description: 'Visualiser les sessions de formation' },
      { code: 'sessions.create', name: 'Créer Sessions', module: 'sessions', description: 'Créer de nouvelles sessions' },
      { code: 'sessions.edit', name: 'Modifier Sessions', module: 'sessions', description: 'Modifier les sessions existantes' },
      { code: 'sessions.delete', name: 'Supprimer Sessions', module: 'sessions', description: 'Supprimer des sessions' },
      { code: 'sessions.manage_students', name: 'Gérer Étudiants Session', module: 'sessions', description: 'Ajouter/retirer des étudiants des sessions' },
      { code: 'sessions.manage_professors', name: 'Gérer Professeurs Session', module: 'sessions', description: 'Assigner des professeurs aux sessions' },

      // Documents
      { code: 'documents.generate', name: 'Générer Documents', module: 'documents', description: 'Générer certificats et attestations' },
      { code: 'documents.bulk_generate', name: 'Génération en Masse', module: 'documents', description: 'Générer des documents pour plusieurs étudiants' },
      { code: 'documents.view_templates', name: 'Voir Templates', module: 'documents', description: 'Visualiser les templates de documents' },
      { code: 'documents.manage_templates', name: 'Gérer Templates', module: 'documents', description: 'Créer et modifier les templates' },

      // Finances
      { code: 'finances.view', name: 'Voir Finances', module: 'finances', description: 'Voir les informations financières' },
      { code: 'finances.manage_payments', name: 'Gérer Paiements', module: 'finances', description: 'Enregistrer et modifier les paiements' },
      { code: 'finances.manage_discounts', name: 'Gérer Réductions', module: 'finances', description: 'Appliquer des réductions' },
      { code: 'finances.view_reports', name: 'Voir Rapports Financiers', module: 'finances', description: 'Accéder aux rapports financiers' },

      // Formations
      { code: 'formations.view', name: 'Voir Formations', module: 'formations', description: 'Visualiser les formations' },
      { code: 'formations.create', name: 'Créer Formations', module: 'formations', description: 'Créer de nouvelles formations' },
      { code: 'formations.edit', name: 'Modifier Formations', module: 'formations', description: 'Modifier les formations existantes' },
      { code: 'formations.delete', name: 'Supprimer Formations', module: 'formations', description: 'Supprimer des formations' },

      // Settings
      { code: 'settings.view', name: 'Voir Paramètres', module: 'settings', description: 'Accéder aux paramètres' },
      { code: 'settings.edit', name: 'Modifier Paramètres', module: 'settings', description: 'Modifier les paramètres système' },
      { code: 'settings.manage_segments', name: 'Gérer Segments', module: 'settings', description: 'Gérer les segments' },
      { code: 'settings.manage_cities', name: 'Gérer Villes', module: 'settings', description: 'Gérer les villes' },
      { code: 'settings.manage_corps', name: 'Gérer Corps Formation', module: 'settings', description: 'Gérer les corps de formation' },

      // Reports
      { code: 'reports.view', name: 'Voir Rapports', module: 'reports', description: 'Accéder aux rapports' },
      { code: 'reports.export', name: 'Exporter Données', module: 'reports', description: 'Exporter des données' },
      { code: 'reports.dashboard', name: 'Voir Dashboard', module: 'reports', description: 'Accéder au tableau de bord' },
    ];

    const permissionIdMap = {};
    for (const perm of permissions) {
      const existing = await client.query(
        'SELECT id FROM permissions WHERE code = $1',
        [perm.code]
      );

      if (existing.rows.length === 0) {
        const result = await client.query(
          `INSERT INTO permissions (code, name, module, description)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [perm.code, perm.name, perm.module, perm.description]
        );
        permissionIdMap[perm.code] = result.rows[0].id;
      } else {
        permissionIdMap[perm.code] = existing.rows[0].id;
      }
    }
    console.log(`    ✅ ${Object.keys(permissionIdMap).length} permissions created`);

    // Step 7: Assign default permissions to roles
    console.log('  📦 Assigning default permissions to roles...');

    const rolePermissionMappings = {
      'admin': Object.keys(permissionIdMap), // Admin gets ALL permissions
      'gerant': [
        'users.view', 'students.view', 'students.create', 'students.edit', 'students.manage_status',
        'sessions.view', 'sessions.create', 'sessions.edit', 'sessions.manage_students', 'sessions.manage_professors',
        'documents.generate', 'documents.bulk_generate', 'documents.view_templates',
        'finances.view', 'finances.manage_payments', 'finances.manage_discounts', 'finances.view_reports',
        'formations.view', 'formations.create', 'formations.edit',
        'settings.view', 'settings.manage_segments', 'settings.manage_cities',
        'reports.view', 'reports.export', 'reports.dashboard'
      ],
      'professor': [
        'students.view', 'sessions.view', 'documents.generate', 'formations.view',
        'reports.view', 'reports.dashboard'
      ],
      'assistante': [
        'students.view', 'sessions.view',
        'documents.generate', 'documents.bulk_generate', 'documents.view_templates',
        'reports.view'
      ],
      'comptable': [
        'students.view', 'sessions.view',
        'finances.view', 'finances.manage_payments', 'finances.manage_discounts', 'finances.view_reports',
        'reports.view', 'reports.export', 'reports.dashboard'
      ],
      'superviseur': [
        'users.view', 'students.view', 'sessions.view',
        'finances.view', 'finances.view_reports',
        'formations.view', 'settings.view',
        'reports.view', 'reports.export', 'reports.dashboard'
      ],
    };

    for (const [roleName, permCodes] of Object.entries(rolePermissionMappings)) {
      const roleId = roleIdMap[roleName];
      if (!roleId) continue;

      for (const permCode of permCodes) {
        const permId = permissionIdMap[permCode];
        if (!permId) continue;

        await client.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           VALUES ($1, $2)
           ON CONFLICT (role_id, permission_id) DO NOTHING`,
          [roleId, permId]
        );
      }
    }
    console.log('    ✅ Role-permission mappings created');

    // Step 8: Migrate existing users to new role_id system
    console.log('  📦 Migrating existing users to new role system...');
    const existingUsers = await client.query(
      'SELECT id, role FROM profiles WHERE role_id IS NULL'
    );

    let migratedCount = 0;
    for (const user of existingUsers.rows) {
      const newRoleId = roleIdMap[user.role];
      if (newRoleId) {
        await client.query(
          'UPDATE profiles SET role_id = $1 WHERE id = $2',
          [newRoleId, user.id]
        );
        migratedCount++;
      }
    }
    console.log(`    ✅ ${migratedCount} users migrated to new role system`);

    // Step 9: Create indexes for performance
    console.log('  📦 Creating indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
      CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);
      CREATE INDEX IF NOT EXISTS idx_profiles_role_id ON profiles(role_id);
      CREATE INDEX IF NOT EXISTS idx_permissions_module ON permissions(module);
      CREATE INDEX IF NOT EXISTS idx_permissions_code ON permissions(code);
    `);

    await client.query('COMMIT');
    console.log('✅ Migration 029 completed successfully!');

    res.json({
      success: true,
      message: 'RBAC Migration completed successfully',
      details: {
        rolesCreated: Object.keys(roleIdMap).length,
        permissionsCreated: Object.keys(permissionIdMap).length,
        usersMigrated: migratedCount,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 029 failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    client.release();
  }
});

// Rollback migration (if needed)
router.post('/rollback', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🔄 Rolling back Migration 029...');
    await client.query('BEGIN');

    // Remove role_id from profiles (but keep old role column)
    console.log('  📦 Removing role_id from profiles...');
    await client.query('ALTER TABLE profiles DROP COLUMN IF EXISTS role_id');

    // Drop junction table first (foreign keys)
    console.log('  📦 Dropping role_permissions table...');
    await client.query('DROP TABLE IF EXISTS role_permissions CASCADE');

    // Drop permissions table
    console.log('  📦 Dropping permissions table...');
    await client.query('DROP TABLE IF EXISTS permissions CASCADE');

    // Drop roles table
    console.log('  📦 Dropping roles table...');
    await client.query('DROP TABLE IF EXISTS roles CASCADE');

    await client.query('COMMIT');
    console.log('✅ Rollback completed - old role system still intact');

    res.json({
      success: true,
      message: 'RBAC Migration rolled back successfully. Old role system is still functional.',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Rollback failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  } finally {
    client.release();
  }
});

// Check migration status
router.get('/status', async (req, res) => {
  try {
    const checks = {};

    // Check if roles table exists
    const rolesTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'roles'
      )
    `);
    checks.rolesTableExists = rolesTable.rows[0].exists;

    // Check if permissions table exists
    const permissionsTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'permissions'
      )
    `);
    checks.permissionsTableExists = permissionsTable.rows[0].exists;

    // Check if role_permissions table exists
    const rolePermissionsTable = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'role_permissions'
      )
    `);
    checks.rolePermissionsTableExists = rolePermissionsTable.rows[0].exists;

    // Check if role_id column exists in profiles
    const roleIdColumn = await pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'profiles' AND column_name = 'role_id'
    `);
    checks.roleIdColumnExists = roleIdColumn.rows.length > 0;

    // Count data
    if (checks.rolesTableExists) {
      const rolesCount = await pool.query('SELECT COUNT(*) FROM roles');
      checks.rolesCount = parseInt(rolesCount.rows[0].count);
    }

    if (checks.permissionsTableExists) {
      const permissionsCount = await pool.query('SELECT COUNT(*) FROM permissions');
      checks.permissionsCount = parseInt(permissionsCount.rows[0].count);
    }

    if (checks.roleIdColumnExists) {
      const migratedUsers = await pool.query('SELECT COUNT(*) FROM profiles WHERE role_id IS NOT NULL');
      checks.migratedUsersCount = parseInt(migratedUsers.rows[0].count);
    }

    const isComplete =
      checks.rolesTableExists &&
      checks.permissionsTableExists &&
      checks.rolePermissionsTableExists &&
      checks.roleIdColumnExists;

    res.json({
      success: true,
      migrationComplete: isComplete,
      checks,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
