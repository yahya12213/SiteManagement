/**
 * Script pour restaurer les heures correctes (annuler la mauvaise correction)
 */

import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function restoreTimezone() {
  try {
    console.log('🔄 Restauration des heures correctes pour Oumayma...\n');

    // Find Oumayma
    const employeeResult = await pool.query(`
      SELECT id FROM hr_employees WHERE LOWER(first_name) LIKE '%oumayma%' LIMIT 1
    `);

    const employee = employeeResult.rows[0];

    // Get the correction request to know the original times
    const correctionRequest = await pool.query(`
      SELECT requested_check_in, requested_check_out
      FROM hr_attendance_correction_requests
      WHERE employee_id = $1 AND request_date = '2026-01-19'
      ORDER BY created_at DESC LIMIT 1
    `, [employee.id]);

    const { requested_check_in, requested_check_out } = correctionRequest.rows[0];
    console.log(`📋 Heures demandées dans la correction:`);
    console.log(`   Check-in: ${requested_check_in}`);
    console.log(`   Check-out: ${requested_check_out}`);

    // Update to exact times without timezone conversion
    console.log('\n🔧 Mise à jour avec les heures exactes...');

    // Construct timestamps as '2026-01-19 10:00:00' (local time, no timezone conversion)
    await pool.query(`
      UPDATE hr_attendance_records
      SET clock_time = ('2026-01-19 ' || $2)::timestamp
      WHERE employee_id = $1
        AND DATE(clock_time) = '2026-01-19'
        AND source = 'correction'
        AND (status = 'present' OR status = 'check_in')
      RETURNING id, clock_time
    `, [employee.id, requested_check_in]);

    await pool.query(`
      UPDATE hr_attendance_records
      SET clock_time = ('2026-01-19 ' || $2)::timestamp
      WHERE employee_id = $1
        AND DATE(clock_time) = '2026-01-19'
        AND source = 'correction'
        AND status = 'check_out'
      RETURNING id, clock_time
    `, [employee.id, requested_check_out]);

    console.log('   ✅ Check-in mis à jour');
    console.log('   ✅ Check-out mis à jour');

    // Verify
    const finalRecords = await pool.query(`
      SELECT clock_time, status
      FROM hr_attendance_records
      WHERE employee_id = $1
        AND DATE(clock_time) = '2026-01-19'
        AND source = 'correction'
      ORDER BY clock_time
    `, [employee.id]);

    console.log('\n✅ Heures finales:');
    finalRecords.rows.forEach(r => {
      const time = new Date(r.clock_time);
      console.log(`   ${r.status}: ${r.clock_time} (UTC: ${time.toISOString()})`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

restoreTimezone();
