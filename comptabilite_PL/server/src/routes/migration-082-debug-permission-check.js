/**
 * Migration 082: DEBUG - Tracer exactement ce qui se passe dans requirePermission
 *
 * Ce diagnostic va ajouter des logs temporaires au middleware requirePermission
 * pour voir exactement pourquoi le 403 est retourné
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    console.log('🔍 Migration 082: Analyzing requirePermission middleware behavior...');

    // Get admin user info
    const adminResult = await client.query(`
      SELECT p.id, p.username, p.role, p.role_id, r.name as role_name
      FROM profiles p
      LEFT JOIN roles r ON p.role_id = r.id
      WHERE p.role = 'admin'
      LIMIT 1
    `);

    if (adminResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No admin user found'
      });
    }

    const admin = adminResult.rows[0];
    console.log('👤 Admin user:', admin);

    // Simulate what happens in the JWT token
    const simulatedJWT = {
      id: admin.id,
      username: admin.username,
      role: admin.role,
      role_id: admin.role_id
    };

    console.log('🎫 Simulated JWT payload:', simulatedJWT);

    // Check admin bypass condition
    const adminBypassCheck = simulatedJWT.role === 'admin';
    console.log(`🔐 Admin bypass check (req.user.role === 'admin'): ${adminBypassCheck}`);
    console.log(`   - simulatedJWT.role = "${simulatedJWT.role}"`);
    console.log(`   - Type: ${typeof simulatedJWT.role}`);
    console.log(`   - Comparison: "${simulatedJWT.role}" === "admin" = ${adminBypassCheck}`);

    // Check if profiles.role field contains extra whitespace or special characters
    const roleBytes = Buffer.from(admin.role || '', 'utf8');
    console.log(`   - Role bytes: [${Array.from(roleBytes).join(', ')}]`);
    console.log(`   - Role length: ${(admin.role || '').length} characters`);
    console.log(`   - Role trimmed: "${(admin.role || '').trim()}"`);
    console.log(`   - Trimmed equals 'admin': ${(admin.role || '').trim() === 'admin'}`);

    // Test the exact condition from requirePermission middleware
    const testCondition1 = simulatedJWT.role === 'admin';
    const testCondition2 = false; // permissions.includes('*') - we'll test this separately

    console.log(`\n📋 Testing requirePermission conditions:`);
    console.log(`   1. req.user.role === 'admin': ${testCondition1}`);
    console.log(`   2. permissions.includes('*'): ${testCondition2} (would need to check getUserPermissions)`);
    console.log(`   3. Combined (OR): ${testCondition1 || testCondition2}`);

    // If admin bypass would NOT trigger, find out why
    let diagnosis = '';
    if (!testCondition1) {
      diagnosis = `❌ PROBLÈME IDENTIFIÉ: req.user.role !== 'admin'
        - Valeur actuelle: "${simulatedJWT.role}"
        - Type: ${typeof simulatedJWT.role}
        - Le bypass admin ne se déclenche PAS`;
    } else {
      diagnosis = `✅ Le bypass admin DEVRAIT se déclencher
        - req.user.role === 'admin' retourne true
        - Le problème doit être ailleurs (peut-être une erreur avant le bypass check)`;
    }

    res.json({
      success: true,
      message: 'Migration 082: Permission check diagnostic completed',
      admin: {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        role_id: admin.role_id,
        role_name: admin.role_name
      },
      simulatedJWT: simulatedJWT,
      adminBypassCheck: {
        result: adminBypassCheck,
        condition: "req.user.role === 'admin'",
        leftSide: simulatedJWT.role,
        rightSide: 'admin',
        type: typeof simulatedJWT.role,
        bytes: Array.from(roleBytes),
        length: (admin.role || '').length,
        trimmed: (admin.role || '').trim()
      },
      requirePermissionSimulation: {
        condition1_roleCheck: testCondition1,
        condition2_wildcardPermission: testCondition2,
        combinedResult: testCondition1 || testCondition2,
        wouldBypass: testCondition1 || testCondition2
      },
      diagnosis: diagnosis
    });

  } catch (error) {
    console.error('❌ Migration 082 error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  } finally {
    client.release();
  }
});

router.get('/status', async (req, res) => {
  res.json({
    status: {
      migrationNeeded: true,
      applied: false,
      info: 'Diagnostic migration - tests requirePermission middleware logic'
    },
    message: 'Diagnostic migration - always available to run'
  });
});

export default router;
