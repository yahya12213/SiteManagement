import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 055: Fix Critical Permission Issues
// 1. Move accounting.roles.* to system.roles.*
// 2. Add missing training.corps.view_page
// 3. Add professor permissions
// 4. Add student permissions
// 5. Sync all role_id fields

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 055: Fix Critical Permission Issues ===');

    // STEP 1: Move accounting.roles.* to system.roles.*
    console.log('Step 1: Moving accounting.roles permissions to system.roles...');

    const rolesPermissions = await client.query(`
      SELECT id, code FROM permissions WHERE module = 'accounting' AND menu = 'roles'
    `);

    if (rolesPermissions.rows.length > 0) {
      for (const perm of rolesPermissions.rows) {
        const newCode = perm.code.replace('accounting.roles', 'system.roles');

        // Check if the new code already exists
        const existingCheck = await client.query(`
          SELECT id FROM permissions WHERE code = $1
        `, [newCode]);

        if (existingCheck.rows.length > 0) {
          // New code already exists, delete the old one to avoid duplicates
          await client.query(`DELETE FROM permissions WHERE id = $1`, [perm.id]);
          console.log(`  Deleted duplicate: ${perm.code} (${newCode} already exists)`);
        } else {
          // Safe to update
          await client.query(`
            UPDATE permissions
            SET module = 'system', code = $1
            WHERE id = $2
          `, [newCode, perm.id]);
          console.log(`  Updated: ${perm.code} → ${newCode}`);
        }
      }
    } else {
      console.log('  No permissions to move (already migrated)');
    }

    // STEP 2: Add missing training.corps.view_page
    console.log('Step 2: Adding missing training.corps.view_page...');

    const corpsResult = await client.query(`
      INSERT INTO permissions (module, menu, action, code, label, description, sort_order, created_at)
      VALUES ('training', 'corps', 'view_page', 'training.corps.view_page',
              'Voir la page Corps de Formation',
              'Accéder à la page de gestion des corps de formation',
              1006, NOW())
      ON CONFLICT (code) DO NOTHING
      RETURNING id
    `);

    if (corpsResult.rowCount > 0) {
      console.log('  Added: training.corps.view_page');
    } else {
      console.log('  Already exists: training.corps.view_page');
    }

    // STEP 3: Add professor permissions
    console.log('Step 3: Adding professor permissions...');

    const professorPermissions = [
      { module: 'accounting', menu: 'professor', action: 'declarations_view_page', code: 'accounting.professor.declarations.view_page', label: 'Voir mes déclarations', description: 'Accéder à la page des déclarations professeur', sort_order: 4100 },
      { module: 'accounting', menu: 'professor', action: 'declarations_fill', code: 'accounting.professor.declarations.fill', label: 'Remplir une déclaration', description: 'Remplir et soumettre une déclaration', sort_order: 4101 },
    ];

    let professorPermissionsAdded = 0;
    for (const perm of professorPermissions) {
      const result = await client.query(`
        INSERT INTO permissions (module, menu, action, code, label, description, sort_order, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (code) DO NOTHING
        RETURNING id
      `, [perm.module, perm.menu, perm.action, perm.code, perm.label, perm.description, perm.sort_order]);

      if (result.rowCount > 0) {
        console.log(`  Added: ${perm.code}`);
        professorPermissionsAdded++;
      } else {
        console.log(`  Already exists: ${perm.code}`);
      }
    }

    // STEP 4: Add student permissions
    console.log('Step 4: Adding student permissions...');

    const studentPermissions = [
      { module: 'training', menu: 'student', action: 'dashboard_view_page', code: 'training.student.dashboard.view_page', label: 'Voir dashboard étudiant', description: 'Accéder au tableau de bord étudiant', sort_order: 2100 },
      { module: 'training', menu: 'student', action: 'catalog_view_page', code: 'training.student.catalog.view_page', label: 'Voir catalogue formations', description: 'Consulter le catalogue des formations disponibles', sort_order: 2101 },
      { module: 'training', menu: 'student', action: 'course_view', code: 'training.student.course.view', label: 'Voir une formation', description: 'Accéder au contenu d\'une formation', sort_order: 2102 },
      { module: 'training', menu: 'student', action: 'course_videos_view', code: 'training.student.course.videos.view', label: 'Voir vidéos cours', description: 'Visionner les vidéos d\'une formation', sort_order: 2103 },
      { module: 'training', menu: 'student', action: 'course_tests_take', code: 'training.student.course.tests.take', label: 'Passer les tests', description: 'Passer les tests d\'évaluation', sort_order: 2104 },
      { module: 'training', menu: 'student', action: 'certificates_view', code: 'training.student.certificates.view', label: 'Voir mes certificats', description: 'Consulter mes certificats obtenus', sort_order: 2105 },
      { module: 'training', menu: 'student', action: 'forums_participate', code: 'training.student.forums.participate', label: 'Participer aux forums', description: 'Participer aux discussions des forums', sort_order: 2106 },
    ];

    let studentPermissionsAdded = 0;
    for (const perm of studentPermissions) {
      const result = await client.query(`
        INSERT INTO permissions (module, menu, action, code, label, description, sort_order, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        ON CONFLICT (code) DO NOTHING
        RETURNING id
      `, [perm.module, perm.menu, perm.action, perm.code, perm.label, perm.description, perm.sort_order]);

      if (result.rowCount > 0) {
        console.log(`  Added: ${perm.code}`);
        studentPermissionsAdded++;
      } else {
        console.log(`  Already exists: ${perm.code}`);
      }
    }

    // STEP 5: Sync all role_id fields
    console.log('Step 5: Synchronizing role_id fields...');

    const syncResult = await client.query(`
      UPDATE profiles
      SET role_id = roles.id
      FROM roles
      WHERE profiles.role = roles.name
      AND profiles.role_id IS NULL
      RETURNING profiles.id
    `);

    console.log(`  Synchronized ${syncResult.rowCount} user role_id fields`);

    // STEP 6: Assign all new permissions to admin and gerant roles
    console.log('Step 6: Assigning new permissions to admin and gerant roles...');

    // Get admin and gerant role IDs
    const adminRole = await client.query(`SELECT id FROM roles WHERE name = 'admin' LIMIT 1`);
    const gerantRole = await client.query(`SELECT id FROM roles WHERE name = 'gerant' LIMIT 1`);

    // Get all new permission IDs
    const newPermissionCodes = [
      'training.corps.view_page',
      ...professorPermissions.map(p => p.code),
      ...studentPermissions.map(p => p.code)
    ];

    for (const permCode of newPermissionCodes) {
      const permResult = await client.query(`SELECT id FROM permissions WHERE code = $1`, [permCode]);
      if (permResult.rows.length > 0) {
        const permId = permResult.rows[0].id;

        // Assign to admin
        if (adminRole.rows.length > 0) {
          await client.query(`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [adminRole.rows[0].id, permId]);
        }

        // Assign to gerant
        if (gerantRole.rows.length > 0) {
          await client.query(`
            INSERT INTO role_permissions (role_id, permission_id)
            VALUES ($1, $2)
            ON CONFLICT DO NOTHING
          `, [gerantRole.rows[0].id, permId]);
        }
      }
    }

    console.log('  Assigned all new permissions to admin and gerant roles');

    await client.query('COMMIT');

    console.log('=== Migration 055 completed successfully! ===');
    console.log(`Summary:`);
    console.log(`  - Moved ${rolesPermissions.rows.length} roles permissions to system module`);
    console.log(`  - Added training.corps.view_page (if new)`);
    console.log(`  - Added ${professorPermissionsAdded} professor permissions`);
    console.log(`  - Added ${studentPermissionsAdded} student permissions`);
    console.log(`  - Synced ${syncResult.rowCount} role_id fields`);

    res.json({
      success: true,
      message: 'Migration 055 executed successfully',
      details: {
        rolesPermissionsMoved: rolesPermissions.rows.length,
        professorPermissionsAdded,
        studentPermissionsAdded,
        roleIdsSynced: syncResult.rowCount
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 055 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  } finally {
    client.release();
    await pool.end();
  }
});

// GET endpoint to check migration status
router.get('/status', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Check if system.roles permissions exist
    const systemRolesCheck = await pool.query(`
      SELECT COUNT(*) as count FROM permissions WHERE module = 'system' AND menu = 'roles'
    `);

    // Check if training.corps.view_page exists
    const corpsViewCheck = await pool.query(`
      SELECT COUNT(*) as count FROM permissions WHERE code = 'training.corps.view_page'
    `);

    // Check if professor permissions exist
    const professorCheck = await pool.query(`
      SELECT COUNT(*) as count FROM permissions WHERE module = 'accounting' AND menu = 'professor'
    `);

    // Check if student permissions exist
    const studentCheck = await pool.query(`
      SELECT COUNT(*) as count FROM permissions WHERE module = 'training' AND menu = 'student'
    `);

    // Check for NULL role_id
    const nullRoleIdCheck = await pool.query(`
      SELECT COUNT(*) as count FROM profiles WHERE role_id IS NULL AND role IS NOT NULL
    `);

    const status = {
      systemRolesExists: parseInt(systemRolesCheck.rows[0].count) > 0,
      corpsViewPageExists: parseInt(corpsViewCheck.rows[0].count) > 0,
      professorPermissionsCount: parseInt(professorCheck.rows[0].count),
      studentPermissionsCount: parseInt(studentCheck.rows[0].count),
      unsyncedRoleIds: parseInt(nullRoleIdCheck.rows[0].count),
      migrationNeeded: parseInt(systemRolesCheck.rows[0].count) === 0 ||
                       parseInt(nullRoleIdCheck.rows[0].count) > 0
    };

    res.json({
      success: true,
      status,
      message: status.migrationNeeded ?
        'Migration 055 needs to be run' :
        'Migration 055 already applied'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    await pool.end();
  }
});

export default router;
