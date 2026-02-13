/**
 * Migration 030 - Add Gestion Comptable Permissions
 *
 * Adds missing permissions for the accounting management module:
 * - Declarations (fiches de calcul, créer/gérer déclarations)
 * - This is an ADDITIVE migration - no data loss
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🔄 Starting Migration 030 - Gestion Comptable Permissions...');
    await client.query('BEGIN');

    // Step 1: Add new permissions for Gestion Comptable
    console.log('  📦 Adding Gestion Comptable permissions...');
    const newPermissions = [
      // Declarations (Fiches de calcul et déclarations)
      { code: 'declarations.view', name: 'Voir Déclarations', module: 'declarations', description: 'Visualiser les déclarations et fiches de calcul' },
      { code: 'declarations.create', name: 'Créer Déclarations', module: 'declarations', description: 'Créer de nouvelles déclarations' },
      { code: 'declarations.edit', name: 'Modifier Déclarations', module: 'declarations', description: 'Modifier les déclarations existantes' },
      { code: 'declarations.delete', name: 'Supprimer Déclarations', module: 'declarations', description: 'Supprimer des déclarations' },
      { code: 'declarations.view_sheets', name: 'Voir Fiches de Calcul', module: 'declarations', description: 'Visualiser les fiches de calcul' },
      { code: 'declarations.manage_sheets', name: 'Gérer Fiches de Calcul', module: 'declarations', description: 'Créer et modifier les fiches de calcul' },
      { code: 'declarations.fill', name: 'Remplir Déclarations', module: 'declarations', description: 'Remplir les déclarations (professeurs)' },
    ];

    const permissionIdMap = {};
    let addedCount = 0;

    for (const perm of newPermissions) {
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
        addedCount++;
        console.log(`    ✅ Added permission: ${perm.code}`);
      } else {
        permissionIdMap[perm.code] = existing.rows[0].id;
        console.log(`    ℹ️  Permission already exists: ${perm.code}`);
      }
    }
    console.log(`    ✅ ${addedCount} new permissions added`);

    // Step 2: Assign new permissions to existing roles
    console.log('  📦 Assigning new permissions to roles...');

    // Get role IDs
    const rolesResult = await client.query('SELECT id, name FROM roles');
    const roleIdMap = {};
    for (const role of rolesResult.rows) {
      roleIdMap[role.name] = role.id;
    }

    const rolePermissionMappings = {
      'admin': Object.keys(permissionIdMap), // Admin gets ALL new permissions
      'gerant': [
        'declarations.view',
        'declarations.create',
        'declarations.edit',
        'declarations.delete',
        'declarations.view_sheets',
        'declarations.manage_sheets',
      ],
      'professor': [
        'declarations.view',
        'declarations.fill',
      ],
      'assistante': [
        'declarations.view',
        'declarations.view_sheets',
      ],
      'comptable': [
        'declarations.view',
        'declarations.create',
        'declarations.edit',
        'declarations.view_sheets',
        'declarations.manage_sheets',
      ],
      'superviseur': [
        'declarations.view',
        'declarations.view_sheets',
      ],
    };

    let assignedCount = 0;
    for (const [roleName, permCodes] of Object.entries(rolePermissionMappings)) {
      const roleId = roleIdMap[roleName];
      if (!roleId) {
        console.log(`    ⚠️  Role not found: ${roleName}`);
        continue;
      }

      for (const permCode of permCodes) {
        const permId = permissionIdMap[permCode];
        if (!permId) continue;

        const result = await client.query(
          `INSERT INTO role_permissions (role_id, permission_id)
           VALUES ($1, $2)
           ON CONFLICT (role_id, permission_id) DO NOTHING
           RETURNING role_id`,
          [roleId, permId]
        );

        if (result.rows.length > 0) {
          assignedCount++;
        }
      }
      console.log(`    ✅ Assigned permissions to role: ${roleName}`);
    }
    console.log(`    ✅ ${assignedCount} role-permission mappings created`);

    await client.query('COMMIT');
    console.log('✅ Migration 030 completed successfully!');

    res.json({
      success: true,
      message: 'Gestion Comptable permissions added successfully',
      details: {
        permissionsAdded: addedCount,
        rolePermissionsAssigned: assignedCount,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 030 failed:', error.message);
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
    const result = await pool.query(`
      SELECT COUNT(*) as count
      FROM permissions
      WHERE module = 'declarations'
    `);

    const hasDeclarationsModule = parseInt(result.rows[0].count) > 0;

    res.json({
      success: true,
      migrationComplete: hasDeclarationsModule,
      declarationsPermissionsCount: parseInt(result.rows[0].count),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;
