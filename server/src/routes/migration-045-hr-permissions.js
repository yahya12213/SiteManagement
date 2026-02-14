import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

// Migration 045: Add HR Permissions to RBAC System

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 045: HR Permissions ===');

    // Define all HR permissions
    const hrPermissions = [
      // HR Employees (Dossiers du Personnel)
      { module: 'hr', menu: 'employees', action: 'view_page', code: 'hr.employees.view_page', label: 'Voir la page Dossiers du Personnel', sort_order: 400 },
      { module: 'hr', menu: 'employees', action: 'create', code: 'hr.employees.create', label: 'Creer un employe', sort_order: 401 },
      { module: 'hr', menu: 'employees', action: 'update', code: 'hr.employees.update', label: 'Modifier un employe', sort_order: 402 },
      { module: 'hr', menu: 'employees', action: 'delete', code: 'hr.employees.delete', label: 'Supprimer un employe', sort_order: 403 },
      { module: 'hr', menu: 'employees', action: 'view_salary', code: 'hr.employees.view_salary', label: 'Voir les informations salariales', sort_order: 404 },
      { module: 'hr', menu: 'employees', action: 'manage_contracts', code: 'hr.contracts.manage', label: 'Gerer les contrats', sort_order: 405 },
      { module: 'hr', menu: 'employees', action: 'manage_documents', code: 'hr.documents.manage', label: 'Gerer les documents', sort_order: 406 },
      { module: 'hr', menu: 'employees', action: 'manage_discipline', code: 'hr.discipline.manage', label: 'Gerer les sanctions disciplinaires', sort_order: 407 },

      // HR Attendance (Temps & Presence)
      { module: 'hr', menu: 'attendance', action: 'view_page', code: 'hr.attendance.view_page', label: 'Voir la page Temps et Presence', sort_order: 410 },
      { module: 'hr', menu: 'attendance', action: 'view_all', code: 'hr.attendance.view_all', label: 'Voir tous les employes', sort_order: 411 },
      { module: 'hr', menu: 'attendance', action: 'edit_anomalies', code: 'hr.attendance.edit_anomalies', label: 'Corriger les anomalies de pointage', sort_order: 412 },
      { module: 'hr', menu: 'attendance', action: 'correct_records', code: 'hr.attendance.correct_records', label: 'Modifier les enregistrements', sort_order: 413 },
      { module: 'hr', menu: 'attendance', action: 'import_records', code: 'hr.attendance.import_records', label: 'Importer les pointages', sort_order: 414 },

      // HR Overtime
      { module: 'hr', menu: 'overtime', action: 'view_page', code: 'hr.overtime.view_page', label: 'Voir les heures supplementaires', sort_order: 420 },
      { module: 'hr', menu: 'overtime', action: 'request', code: 'hr.overtime.request', label: 'Demander des heures sup', sort_order: 421 },
      { module: 'hr', menu: 'overtime', action: 'approve', code: 'hr.overtime.approve', label: 'Approuver les heures sup', sort_order: 422 },
      { module: 'hr', menu: 'overtime', action: 'validate_payroll', code: 'hr.overtime.validate_payroll', label: 'Valider pour la paie', sort_order: 423 },

      // HR Leaves (Conges)
      { module: 'hr', menu: 'leaves', action: 'view_page', code: 'hr.leaves.view_page', label: 'Voir la page Conges et Planning', sort_order: 430 },
      { module: 'hr', menu: 'leaves', action: 'request', code: 'hr.leaves.request', label: 'Demander un conge', sort_order: 431 },
      { module: 'hr', menu: 'leaves', action: 'approve_n1', code: 'hr.leaves.approve_n1', label: 'Approuver N+1', sort_order: 432 },
      { module: 'hr', menu: 'leaves', action: 'approve_n2', code: 'hr.leaves.approve_n2', label: 'Approuver N+2', sort_order: 433 },
      { module: 'hr', menu: 'leaves', action: 'approve_hr', code: 'hr.leaves.approve_hr', label: 'Approbation RH finale', sort_order: 434 },
      { module: 'hr', menu: 'leaves', action: 'manage_balances', code: 'hr.leaves.manage_balances', label: 'Gerer les soldes de conges', sort_order: 435 },
      { module: 'hr', menu: 'leaves', action: 'manage_holidays', code: 'hr.holidays.manage', label: 'Gerer les jours feries', sort_order: 436 },

      // HR Dashboard
      { module: 'hr', menu: 'dashboard', action: 'view_page', code: 'hr.dashboard.view_page', label: 'Voir le tableau de bord RH', sort_order: 440 },
      { module: 'hr', menu: 'dashboard', action: 'export_reports', code: 'hr.dashboard.export_reports', label: 'Exporter les rapports', sort_order: 441 },
      { module: 'hr', menu: 'dashboard', action: 'view_summary', code: 'hr.monthly_summary.view', label: 'Voir les recaps mensuels', sort_order: 442 },
      { module: 'hr', menu: 'dashboard', action: 'validate_summary', code: 'hr.monthly_summary.validate', label: 'Valider les recaps pour paie', sort_order: 443 },
      { module: 'hr', menu: 'dashboard', action: 'export_summary', code: 'hr.monthly_summary.export', label: 'Exporter les recaps', sort_order: 444 },

      // HR Settings
      { module: 'hr', menu: 'settings', action: 'view_page', code: 'hr.settings.view_page', label: 'Voir les parametres RH', sort_order: 450 },
      { module: 'hr', menu: 'settings', action: 'manage_schedules', code: 'hr.settings.manage_schedules', label: 'Gerer les horaires de travail', sort_order: 451 },
      { module: 'hr', menu: 'settings', action: 'manage_leave_rules', code: 'hr.settings.manage_leave_rules', label: 'Configurer les regles de conges', sort_order: 452 },
      { module: 'hr', menu: 'settings', action: 'manage_workflows', code: 'hr.settings.manage_workflows', label: 'Configurer les workflows', sort_order: 453 },
    ];

    console.log(`Adding ${hrPermissions.length} HR permissions...`);

    // Insert permissions
    let insertedCount = 0;
    for (const perm of hrPermissions) {
      const exists = await client.query(
        'SELECT id FROM permissions WHERE code = $1',
        [perm.code]
      );

      if (exists.rows.length === 0) {
        await client.query(`
          INSERT INTO permissions (module, menu, action, code, label, sort_order)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [perm.module, perm.menu, perm.action, perm.code, perm.label, perm.sort_order]);
        insertedCount++;
      }
    }

    console.log(`Inserted ${insertedCount} new permissions`);

    // Assign all HR permissions to admin role
    const adminRole = await client.query(
      "SELECT id FROM roles WHERE name = 'admin'"
    );

    if (adminRole.rows.length > 0) {
      const adminRoleId = adminRole.rows[0].id;

      const hrPermsIds = await client.query(
        "SELECT id FROM permissions WHERE module = 'hr'"
      );

      let assignedCount = 0;
      for (const perm of hrPermsIds.rows) {
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

    // Get summary
    const totalPerms = await client.query(
      "SELECT COUNT(*) FROM permissions WHERE module = 'hr'"
    );

    const totalAssigned = await client.query(`
      SELECT COUNT(*) FROM role_permissions rp
      JOIN permissions p ON rp.permission_id = p.id
      WHERE p.module = 'hr'
    `);

    console.log('=== Migration 045 Complete ===');

    res.json({
      success: true,
      message: 'Migration 045 completed - HR Permissions added to RBAC',
      summary: {
        total_hr_permissions: parseInt(totalPerms.rows[0].count),
        permissions_inserted: insertedCount,
        total_role_assignments: parseInt(totalAssigned.rows[0].count),
        permissions_by_menu: {
          employees: 8,
          attendance: 5,
          overtime: 4,
          leaves: 7,
          dashboard: 5,
          settings: 4
        }
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 045 failed:', error);
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

    // Remove HR permissions from role_permissions first
    await client.query(`
      DELETE FROM role_permissions
      WHERE permission_id IN (
        SELECT id FROM permissions WHERE module = 'hr'
      )
    `);

    // Remove HR permissions
    await client.query("DELETE FROM permissions WHERE module = 'hr'");

    await client.query('COMMIT');

    res.json({ success: true, message: 'Migration 045 rolled back - HR permissions removed' });
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
      "SELECT COUNT(*) FROM permissions WHERE module = 'hr'"
    );

    const count = parseInt(result.rows[0].count);

    res.json({
      success: true,
      migrated: count >= 33,
      hr_permissions_count: count
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    await pool.end();
  }
});

export default router;
