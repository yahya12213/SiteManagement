/**
 * Migration 148: Add ville_id column to hr_employees
 *
 * Problem: Employees need to be assigned to segment + ville, but no field exists
 * Solution:
 * 1. Add ville_id column to hr_employees
 * 2. Auto-assign employees to city with most enrollments in their segment
 */

import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

router.post('/run', async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('🔄 Starting Migration 148: Add ville_id to hr_employees');

    // Step 1: Add ville_id column
    console.log('  Step 1: Adding ville_id column...');
    await client.query(`
      ALTER TABLE hr_employees
      ADD COLUMN IF NOT EXISTS ville_id TEXT
      REFERENCES cities(id) ON DELETE SET NULL
    `);
    console.log('  ✅ ville_id column added');

    // Step 2: Create index
    console.log('  Step 2: Creating index...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_hr_employees_ville
      ON hr_employees(ville_id)
    `);
    console.log('  ✅ Index created');

    // Step 3: Auto-assign employees to their primary city
    console.log('  Step 3: Auto-assigning employees to cities...');
    const employeesQuery = `
      SELECT DISTINCT
        e.id as employee_id,
        e.first_name || ' ' || e.last_name as employee_name,
        e.segment_id
      FROM hr_employees e
      WHERE e.segment_id IS NOT NULL
        AND e.ville_id IS NULL
    `;

    const employeesResult = await client.query(employeesQuery);
    console.log(`  Found ${employeesResult.rows.length} employees to process`);

    const assignments = [];
    const unassigned = [];

    for (const employee of employeesResult.rows) {
      // Find city with most enrollments in this segment
      const cityQuery = `
        SELECT
          sf.ville_id,
          c.name as city_name,
          COUNT(DISTINCT se.student_id) as enrollments
        FROM sessions_formation sf
        JOIN session_etudiants se ON se.session_id = sf.id
        LEFT JOIN cities c ON c.id = sf.ville_id
        WHERE sf.segment_id = $1
          AND sf.ville_id IS NOT NULL
          AND sf.statut <> 'annulee'
        GROUP BY sf.ville_id, c.name
        ORDER BY enrollments DESC
        LIMIT 1
      `;

      const cityResult = await client.query(cityQuery, [employee.segment_id]);

      if (cityResult.rows.length > 0) {
        const primaryCity = cityResult.rows[0];

        // Assign employee to this city
        await client.query(`
          UPDATE hr_employees
          SET ville_id = $1
          WHERE id = $2
        `, [primaryCity.ville_id, employee.employee_id]);

        console.log(`    ✅ ${employee.employee_name} → ${primaryCity.city_name} (${primaryCity.enrollments} enrollments)`);

        assignments.push({
          employee: employee.employee_name,
          city: primaryCity.city_name,
          city_id: primaryCity.ville_id,
          enrollments: parseInt(primaryCity.enrollments)
        });
      } else {
        console.log(`    ⚠️  ${employee.employee_name} → No sessions found in segment`);
        unassigned.push({
          employee: employee.employee_name,
          segment_id: employee.segment_id,
          reason: 'No sessions found in segment'
        });
      }
    }

    await client.query('COMMIT');
    console.log('✅ Migration 148 completed successfully');

    res.json({
      success: true,
      message: `Assigned ${assignments.length} employees to cities`,
      assignments,
      unassigned,
      total_processed: employeesResult.rows.length
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration 148 failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  } finally {
    client.release();
  }
});

export default router;
