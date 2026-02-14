/**
 * Migration 081: DEBUG - Vérifier exactement quelles permissions getUserPermissions retourne pour admin
 *
 * Ce diagnostic va:
 * 1. Récupérer l'utilisateur admin depuis profiles
 * 2. Exécuter les 3 requêtes de getUserPermissions manuellement
 * 3. Afficher les résultats de chaque requête
 * 4. Vérifier si 'system.roles.view_page' est dans les résultats
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🔍 Migration 081: DEBUG - Analysing getUserPermissions for admin...');

    // Step 1: Get admin user
    const adminUserResult = await client.query(`
      SELECT id, username, role, role_id
      FROM profiles
      WHERE role = 'admin'
      LIMIT 1
    `);

    if (adminUserResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No admin user found in profiles table'
      });
    }

    const adminUser = adminUserResult.rows[0];
    console.log('👤 Admin user found:', adminUser);

    // Step 2: Try Query 1 (user_roles table)
    console.log('\n📊 Query 1: Using user_roles table (N-N relationship)...');
    const query1Result = await client.query(`
      SELECT DISTINCT p.code
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      INNER JOIN user_roles ur ON rp.role_id = ur.role_id
      WHERE ur.user_id = $1
    `, [adminUser.id]);

    const permissions1 = query1Result.rows.map(r => r.code);
    console.log(`   ✅ Query 1 returned ${permissions1.length} permissions`);
    console.log(`   🔍 Contains 'system.roles.view_page'? ${permissions1.includes('system.roles.view_page')}`);

    // Step 3: Try Query 2 (profiles.role_id fallback)
    console.log('\n📊 Query 2: Using profiles.role_id fallback...');
    const query2Result = await client.query(`
      SELECT DISTINCT p.code
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      INNER JOIN roles r ON rp.role_id = r.id
      INNER JOIN profiles pr ON pr.role_id = r.id
      WHERE pr.id = $1
    `, [adminUser.id]);

    const permissions2 = query2Result.rows.map(r => r.code);
    console.log(`   ✅ Query 2 returned ${permissions2.length} permissions`);
    console.log(`   🔍 Contains 'system.roles.view_page'? ${permissions2.includes('system.roles.view_page')}`);

    // Step 4: Try Query 3 (profiles.role text matching)
    console.log('\n📊 Query 3: Using profiles.role text matching...');
    const query3Result = await client.query(`
      SELECT DISTINCT p.code
      FROM permissions p
      INNER JOIN role_permissions rp ON p.id = rp.permission_id
      INNER JOIN roles r ON rp.role_id = r.id
      INNER JOIN profiles pr ON pr.role = r.name
      WHERE pr.id = $1
    `, [adminUser.id]);

    const permissions3 = query3Result.rows.map(r => r.code);
    console.log(`   ✅ Query 3 returned ${permissions3.length} permissions`);
    console.log(`   🔍 Contains 'system.roles.view_page'? ${permissions3.includes('system.roles.view_page')}`);

    // Step 5: Check which query getUserPermissions would actually use
    console.log('\n🔄 Simulating getUserPermissions logic...');
    let finalPermissions = [];
    let queryUsed = '';

    if (permissions1.length > 0) {
      finalPermissions = permissions1;
      queryUsed = 'Query 1 (user_roles)';
    } else if (permissions2.length > 0) {
      finalPermissions = permissions2;
      queryUsed = 'Query 2 (profiles.role_id)';
    } else if (permissions3.length > 0) {
      finalPermissions = permissions3;
      queryUsed = 'Query 3 (profiles.role text)';
    }

    console.log(`   📍 getUserPermissions would use: ${queryUsed}`);
    console.log(`   📊 Final permissions count: ${finalPermissions.length}`);
    console.log(`   🔍 Contains 'system.roles.view_page'? ${finalPermissions.includes('system.roles.view_page')}`);

    // Step 6: Check if user_roles table has entry for admin
    const userRolesCheck = await client.query(`
      SELECT ur.*, r.name as role_name
      FROM user_roles ur
      INNER JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = $1
    `, [adminUser.id]);

    console.log(`\n🔗 user_roles table check: ${userRolesCheck.rows.length} entries found`);

    // Step 7: List first 10 permissions from final query
    const firstTenPermissions = finalPermissions.slice(0, 10);
    console.log('\n📝 First 10 permissions from final query:');
    firstTenPermissions.forEach((perm, idx) => {
      console.log(`   ${idx + 1}. ${perm}`);
    });

    res.json({
      success: true,
      message: 'Migration 081: Debug analysis completed',
      adminUser: {
        id: adminUser.id,
        username: adminUser.username,
        role: adminUser.role,
        role_id: adminUser.role_id
      },
      queryResults: {
        query1: {
          name: 'user_roles table',
          permissionCount: permissions1.length,
          hasSystemRolesViewPage: permissions1.includes('system.roles.view_page'),
          sample: permissions1.slice(0, 5)
        },
        query2: {
          name: 'profiles.role_id fallback',
          permissionCount: permissions2.length,
          hasSystemRolesViewPage: permissions2.includes('system.roles.view_page'),
          sample: permissions2.slice(0, 5)
        },
        query3: {
          name: 'profiles.role text matching',
          permissionCount: permissions3.length,
          hasSystemRolesViewPage: permissions3.includes('system.roles.view_page'),
          sample: permissions3.slice(0, 5)
        }
      },
      actualQuery: {
        queryUsed: queryUsed,
        finalPermissionCount: finalPermissions.length,
        hasSystemRolesViewPage: finalPermissions.includes('system.roles.view_page'),
        firstTenPermissions: firstTenPermissions
      },
      userRolesTableEntries: userRolesCheck.rows,
      diagnosis: finalPermissions.includes('system.roles.view_page')
        ? '✅ Permission trouvée dans les résultats - Le problème est ailleurs'
        : '❌ Permission NOT found - Problème identifié dans getUserPermissions'
    });

  } catch (error) {
    console.error('❌ Migration 081 error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  } finally {
    client.release();
  }
});

// Check migration status
router.get('/status', async (req, res) => {
  res.json({
    status: {
      migrationNeeded: true,
      applied: false,
      info: 'This is a diagnostic migration - run it to debug admin permissions'
    },
    message: 'Diagnostic migration - always available to run'
  });
});

export default router;
