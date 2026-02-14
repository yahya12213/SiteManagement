/**
 * Migration 105: Assigner tous les employés à un manager
 *
 * Cette migration:
 * 1. Trouve le premier utilisateur Admin
 * 2. Crée un enregistrement hr_employee pour l'admin si nécessaire
 * 3. Assigne tous les employés sans manager à cet admin
 */

import express from 'express';
import pg from 'pg';
const { Pool } = pg;

const router = express.Router();

router.post('/run', async (req, res) => {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('=== Migration 105: Assigner équipe manager ===');

    // Step 1: Trouver le premier utilisateur Admin
    console.log('Step 1: Recherche de l\'utilisateur Admin...');
    const adminProfile = await client.query(`
      SELECT p.id, p.username, p.full_name
      FROM profiles p
      JOIN user_roles ur ON p.id = ur.user_id
      JOIN roles r ON ur.role_id = r.id
      WHERE r.name = 'Admin'
      ORDER BY p.created_at ASC
      LIMIT 1
    `);

    if (adminProfile.rows.length === 0) {
      throw new Error('Aucun utilisateur Admin trouvé');
    }

    const admin = adminProfile.rows[0];
    console.log(`  ✓ Admin trouvé: ${admin.full_name || admin.username} (ID: ${admin.id})`);

    // Step 2: Vérifier si l'admin a un enregistrement hr_employee
    console.log('Step 2: Vérification enregistrement employé admin...');
    let adminEmployee = await client.query(`
      SELECT id, first_name, last_name FROM hr_employees WHERE profile_id = $1
    `, [admin.id]);

    let adminEmployeeId;

    if (adminEmployee.rows.length === 0) {
      console.log('  → Création enregistrement employé pour admin...');

      // Parser le nom complet
      const nameParts = (admin.full_name || admin.username || 'Admin').trim().split(' ');
      const firstName = nameParts[0] || 'Admin';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Générer un numéro employé
      const employeeNumber = `ADM-${Date.now().toString().slice(-6)}`;

      const newEmployee = await client.query(`
        INSERT INTO hr_employees (
          employee_number,
          first_name,
          last_name,
          profile_id,
          employment_status,
          hire_date,
          requires_clocking,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, 'active', CURRENT_DATE, false, NOW(), NOW())
        RETURNING id, first_name, last_name
      `, [employeeNumber, firstName, lastName, admin.id]);

      adminEmployeeId = newEmployee.rows[0].id;
      console.log(`  ✓ Employé admin créé: ${firstName} ${lastName} (ID: ${adminEmployeeId})`);
    } else {
      adminEmployeeId = adminEmployee.rows[0].id;
      console.log(`  ✓ Employé admin existant: ${adminEmployee.rows[0].first_name} ${adminEmployee.rows[0].last_name} (ID: ${adminEmployeeId})`);
    }

    // Step 3: Compter les employés sans manager
    const beforeCount = await client.query(`
      SELECT COUNT(*) as count FROM hr_employees WHERE manager_id IS NULL AND id != $1
    `, [adminEmployeeId]);
    console.log(`Step 3: ${beforeCount.rows[0].count} employés sans manager trouvés`);

    // Step 4: Assigner tous les employés sans manager à l'admin
    console.log('Step 4: Assignation des employés...');
    const updateResult = await client.query(`
      UPDATE hr_employees
      SET manager_id = $1, updated_at = NOW()
      WHERE manager_id IS NULL AND id != $1
      RETURNING id, first_name, last_name
    `, [adminEmployeeId]);

    console.log(`  ✓ ${updateResult.rowCount} employés assignés à l'équipe`);

    // Lister les employés assignés
    if (updateResult.rows.length > 0 && updateResult.rows.length <= 10) {
      updateResult.rows.forEach(emp => {
        console.log(`    - ${emp.first_name} ${emp.last_name}`);
      });
    }

    await client.query('COMMIT');

    console.log('=== Migration 105 Complete ===');

    res.json({
      success: true,
      message: `Migration 105 terminée - ${updateResult.rowCount} employés assignés au manager`,
      details: {
        admin: admin.full_name || admin.username,
        admin_employee_id: adminEmployeeId,
        employees_assigned: updateResult.rowCount,
        employees_list: updateResult.rows.map(e => `${e.first_name} ${e.last_name}`)
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration 105 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
    await pool.end();
  }
});

export default router;
