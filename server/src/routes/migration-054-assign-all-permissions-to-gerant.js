import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 054: Assign All Permissions to Gérant Role
// Ensures gérant role has complete access to all modules (accounting, training, hr, commercialisation, system)

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 054: Assign All Permissions to Gérant Role ===');

    // 1. Find or create the gérant role
    let gerantRoleResult = await client.query(`
      SELECT id FROM roles WHERE name = 'gerant' LIMIT 1
    `);

    let gerantRoleId;

    if (gerantRoleResult.rows.length === 0) {
      console.log('⚠️  Gérant role not found, creating it...');

      const createRoleResult = await client.query(`
        INSERT INTO roles (name, description, created_at)
        VALUES ('gerant', 'Gérant - Full access manager role', NOW())
        RETURNING id
      `);

      gerantRoleId = createRoleResult.rows[0].id;
      console.log(`  ✓ Created gérant role with ID: ${gerantRoleId}`);
    } else {
      gerantRoleId = gerantRoleResult.rows[0].id;
      console.log(`  ✓ Found gérant role with ID: ${gerantRoleId}`);
    }

    // 2. Get all permissions from all modules (accounting, training, hr, commercialisation, system)
    const allPermissionsResult = await client.query(`
      SELECT id, code, module
      FROM permissions
      WHERE module IN ('accounting', 'training', 'hr', 'commercialisation', 'system')
      ORDER BY module, code
    `);

    console.log(`\nFound ${allPermissionsResult.rows.length} permissions across all modules`);

    // Group by module for reporting
    const permsByModule = {};
    allPermissionsResult.rows.forEach(perm => {
      if (!permsByModule[perm.module]) {
        permsByModule[perm.module] = [];
      }
      permsByModule[perm.module].push(perm);
    });

    console.log('\nPermissions breakdown:');
    Object.keys(permsByModule).forEach(module => {
      console.log(`  - ${module}: ${permsByModule[module].length} permissions`);
    });

    // 3. Assign all permissions to gérant role
    console.log('\nAssigning permissions to gérant role...');

    let assignedCount = 0;
    let skippedCount = 0;

    for (const permission of allPermissionsResult.rows) {
      // Check if already assigned
      const checkAssignment = await client.query(`
        SELECT 1 FROM role_permissions
        WHERE role_id = $1 AND permission_id = $2
      `, [gerantRoleId, permission.id]);

      if (checkAssignment.rows.length === 0) {
        // Assign permission
        await client.query(`
          INSERT INTO role_permissions (role_id, permission_id)
          VALUES ($1, $2)
        `, [gerantRoleId, permission.id]);
        assignedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(`\n✅ Assigned ${assignedCount} new permissions to gérant role`);
    console.log(`  - Skipped ${skippedCount} (already assigned)`);

    // 4. Verify final permission count for gérant
    const verifyResult = await client.query(`
      SELECT COUNT(*) as total
      FROM role_permissions
      WHERE role_id = $1
    `, [gerantRoleId]);

    const totalPermissions = parseInt(verifyResult.rows[0].total);
    console.log(`\n📊 Gérant role now has ${totalPermissions} total permissions`);

    // 5. List modules with their permission counts
    const moduleCountsResult = await client.query(`
      SELECT p.module, COUNT(*) as count
      FROM role_permissions rp
      INNER JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = $1
      GROUP BY p.module
      ORDER BY p.module
    `, [gerantRoleId]);

    console.log('\nPermissions by module for gérant role:');
    moduleCountsResult.rows.forEach(row => {
      console.log(`  - ${row.module}: ${row.count} permissions`);
    });

    await client.query('COMMIT');

    console.log('\n✅ Migration 054 completed successfully!');
    console.log('Gérant role now has full access to all modules');

    res.json({
      success: true,
      message: 'Migration 054 completed - All permissions assigned to gérant role',
      gerantRoleId: gerantRoleId,
      permissionsAssigned: assignedCount,
      permissionsSkipped: skippedCount,
      totalPermissions: totalPermissions,
      moduleBreakdown: moduleCountsResult.rows
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 054 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  } finally {
    client.release();
    await pool.end();
  }
});

// Check migration status
router.get('/status', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    // Check if gérant role exists
    const gerantRoleResult = await client.query(`
      SELECT id FROM roles WHERE name = 'gerant' LIMIT 1
    `);

    if (gerantRoleResult.rows.length === 0) {
      return res.json({
        status: 'not_ready',
        message: 'Gérant role does not exist yet',
        gerantRoleExists: false
      });
    }

    const gerantRoleId = gerantRoleResult.rows[0].id;

    // Count permissions assigned to gérant
    const permCountResult = await client.query(`
      SELECT COUNT(*) as count
      FROM role_permissions
      WHERE role_id = $1
    `, [gerantRoleId]);

    const gerantPermCount = parseInt(permCountResult.rows[0].count);

    // Count total available permissions in key modules
    const totalPermResult = await client.query(`
      SELECT COUNT(*) as count
      FROM permissions
      WHERE module IN ('accounting', 'training', 'hr', 'commercialisation', 'system')
    `);

    const totalAvailablePerms = parseInt(totalPermResult.rows[0].count);

    // Get module breakdown
    const moduleBreakdown = await client.query(`
      SELECT p.module, COUNT(*) as count
      FROM role_permissions rp
      INNER JOIN permissions p ON rp.permission_id = p.id
      WHERE rp.role_id = $1
      GROUP BY p.module
      ORDER BY p.module
    `, [gerantRoleId]);

    const isMigrated = gerantPermCount >= totalAvailablePerms * 0.9; // 90% threshold

    res.json({
      status: 'ok',
      gerantRoleExists: true,
      gerantRoleId: gerantRoleId,
      gerantPermissions: gerantPermCount,
      totalAvailablePermissions: totalAvailablePerms,
      isMigrated: isMigrated,
      completionPercentage: Math.round((gerantPermCount / totalAvailablePerms) * 100),
      moduleBreakdown: moduleBreakdown.rows
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  } finally {
    client.release();
    await pool.end();
  }
});

export default router;
