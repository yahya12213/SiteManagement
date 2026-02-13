/**
 * Migration 068: Auto-create employee records for users with clocking permission
 * Creates hr_employees records for users who have hr.employee_portal.clock_in_out permission
 * but don't have an employee record yet
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Find all users who have the clocking permission but don't have an employee record
    // Note: profiles table only has: id, username, password, full_name, role, created_at (no email)
    const usersWithoutEmployee = await client.query(`
      SELECT DISTINCT p.id as profile_id, p.username, p.full_name
      FROM profiles p
      INNER JOIN user_roles ur ON p.id = ur.user_id
      INNER JOIN role_permissions rp ON ur.role_id = rp.role_id
      INNER JOIN permissions perm ON rp.permission_id = perm.id
      WHERE perm.code = 'hr.employee_portal.clock_in_out'
      AND NOT EXISTS (
        SELECT 1 FROM hr_employees e WHERE e.profile_id = p.id
      )
    `);

    console.log(`Found ${usersWithoutEmployee.rows.length} users without employee records`);

    let createdCount = 0;
    const createdEmployees = [];

    for (const user of usersWithoutEmployee.rows) {
      // Generate employee number from username
      const employeeNumber = `EMP-${user.username.toUpperCase().substring(0, 5)}-${Date.now().toString().slice(-4)}`;

      // Parse full_name into first_name and last_name
      const nameParts = (user.full_name || user.username || '').trim().split(' ');
      const firstName = nameParts[0] || user.username;
      const lastName = nameParts.slice(1).join(' ') || '';

      // Create employee record with requires_clocking = true
      // Note: email is NULL since profiles table doesn't have email column
      const result = await client.query(`
        INSERT INTO hr_employees (
          employee_number,
          first_name,
          last_name,
          profile_id,
          requires_clocking,
          employment_status,
          hire_date,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, true, 'active', CURRENT_DATE, NOW(), NOW())
        RETURNING id, employee_number
      `, [
        employeeNumber,
        firstName,
        lastName,
        user.profile_id
      ]);

      createdCount++;
      createdEmployees.push({
        employee_id: result.rows[0].id,
        employee_number: result.rows[0].employee_number,
        username: user.username,
        profile_id: user.profile_id
      });

      console.log(`✅ Created employee record for ${user.username}: ${employeeNumber}`);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Migration 068 completed - Created ${createdCount} employee records`,
      details: {
        usersFound: usersWithoutEmployee.rows.length,
        employeesCreated: createdCount,
        employees: createdEmployees
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 068 error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

// Check migration status
router.get('/status', async (req, res) => {
  try {
    // Count users with clocking permission but no employee record
    const result = await pool.query(`
      SELECT COUNT(DISTINCT p.id) as missing_count
      FROM profiles p
      INNER JOIN user_roles ur ON p.id = ur.user_id
      INNER JOIN role_permissions rp ON ur.role_id = rp.role_id
      INNER JOIN permissions perm ON rp.permission_id = perm.id
      WHERE perm.code = 'hr.employee_portal.clock_in_out'
      AND NOT EXISTS (
        SELECT 1 FROM hr_employees e WHERE e.profile_id = p.id
      )
    `);

    const missingCount = parseInt(result.rows[0].missing_count);

    res.json({
      status: {
        migrationNeeded: missingCount > 0,
        applied: missingCount === 0,
        usersWithoutEmployee: missingCount
      },
      message: missingCount === 0
        ? 'Migration 068 applied - All users with clocking permission have employee records'
        : `Migration needed - ${missingCount} user(s) with clocking permission missing employee record`
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
  }
});

export default router;
