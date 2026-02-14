import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 062: Add Employee Portal / Gestion Pointage Permissions

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 062: Employee Portal (Gestion Pointage) Permissions ===');

    // Define Employee Portal permissions
    const permissions = [
      { module: 'hr', menu: 'employee_portal', action: 'view_page', code: 'hr.employee_portal.view_page', label: 'Voir Gestion Pointage', description: 'Accéder à la page de gestion du pointage', sort_order: 460 },
      { module: 'hr', menu: 'employee_portal', action: 'clock_in_out', code: 'hr.employee_portal.clock_in_out', label: 'Pointer (Entrée/Sortie)', description: 'Effectuer des pointages d\'entrée et de sortie', sort_order: 461 },
      { module: 'hr', menu: 'employee_portal', action: 'submit_requests', code: 'hr.employee_portal.submit_requests', label: 'Soumettre des demandes', description: 'Soumettre des demandes de congé ou heures sup', sort_order: 462 },
      { module: 'hr', menu: 'employee_portal', action: 'view_history', code: 'hr.employee_portal.view_history', label: 'Voir historique pointages', description: 'Consulter l\'historique des pointages', sort_order: 463 },
    ];

    console.log(`Adding ${permissions.length} Employee Portal permissions...`);

    // Insert permissions
    let insertedCount = 0;
    for (const perm of permissions) {
      const exists = await client.query(
        'SELECT id FROM permissions WHERE code = $1',
        [perm.code]
      );

      if (exists.rows.length === 0) {
        await client.query(`
          INSERT INTO permissions (module, menu, action, code, label, description, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [perm.module, perm.menu, perm.action, perm.code, perm.label, perm.description, perm.sort_order]);
        insertedCount++;
        console.log(`✅ Added: ${perm.code}`);
      } else {
        console.log(`⏭️ Already exists: ${perm.code}`);
      }
    }

    console.log(`Inserted ${insertedCount} new permissions`);

    // Assign all Employee Portal permissions to admin role
    const adminRole = await client.query(
      "SELECT id FROM roles WHERE name = 'admin'"
    );

    if (adminRole.rows.length > 0) {
      const adminRoleId = adminRole.rows[0].id;

      const portalPermsIds = await client.query(
        "SELECT id FROM permissions WHERE menu = 'employee_portal'"
      );

      let assignedCount = 0;
      for (const perm of portalPermsIds.rows) {
        const alreadyAssigned = await client.query(
          'SELECT 1 FROM role_permissions WHERE role_id = $1 AND permission_id = $2',
          [adminRoleId, perm.id]
        );

        if (alreadyAssigned.rows.length === 0) {
          await client.query(
            'INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)',
            [adminRoleId, perm.id]
          );
          assignedCount++;
        }
      }

      console.log(`Assigned ${assignedCount} permissions to admin role`);
    }

    await client.query('COMMIT');

    console.log('=== Migration 062 Complete ===');

    res.json({
      success: true,
      message: 'Migration 062 completed - Employee Portal (Gestion Pointage) permissions added',
      summary: {
        permissions_inserted: insertedCount,
        permissions: permissions.map(p => p.code)
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 062 failed:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
    await pool.end();
  }
});

router.post('/rollback', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Remove Employee Portal permissions from role_permissions first
    await client.query(`
      DELETE FROM role_permissions
      WHERE permission_id IN (
        SELECT id FROM permissions WHERE menu = 'employee_portal'
      )
    `);

    // Remove Employee Portal permissions
    await client.query("DELETE FROM permissions WHERE menu = 'employee_portal'");

    await client.query('COMMIT');

    res.json({ success: true, message: 'Migration 062 rolled back - Employee Portal permissions removed' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
    await pool.end();
  }
});

router.get('/status', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    const result = await pool.query(
      "SELECT COUNT(*) FROM permissions WHERE menu = 'employee_portal'"
    );

    const count = parseInt(result.rows[0].count);

    res.json({
      status: {
        migrationNeeded: count < 4,
        applied: count >= 4,
        permissions_count: count
      },
      message: count >= 4
        ? 'Migration 062 already applied - Employee Portal permissions exist'
        : 'Migration needed - Employee Portal permissions missing'
    });
  } catch (error) {
    res.status(500).json({
      status: {
        migrationNeeded: true,
        applied: false,
        error: error.message
      },
      message: `Error checking status: ${error.message}`
    });
  } finally {
    await pool.end();
  }
});

export default router;
