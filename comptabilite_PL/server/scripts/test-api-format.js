/**
 * Script pour tester le nouveau format de retour de l'API
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

async function testApiFormat() {
  try {
    console.log('🧪 Test du nouveau format de retour API\n');

    // Find Oumayma
    const employeeResult = await pool.query(`
      SELECT id FROM hr_employees WHERE LOWER(first_name) LIKE '%oumayma%' LIMIT 1
    `);
    const employee = employeeResult.rows[0];

    // Simulate what the API returns (like hr-employee-portal.js)
    const records = await pool.query(`
      SELECT
        attendance_date as date,
        to_char(MIN(CASE WHEN status IN ('check_in', 'late', 'weekend', 'present', 'half_day', 'early_leave', 'late_early', 'incomplete') THEN clock_time END), 'YYYY-MM-DD"T"HH24:MI:SS') as check_in,
        to_char(MAX(CASE WHEN status IN ('check_out', 'weekend') THEN clock_time END), 'YYYY-MM-DD"T"HH24:MI:SS') as check_out,
        MAX(CASE WHEN status NOT IN ('check_out') THEN status END) as day_status
      FROM hr_attendance_records
      WHERE employee_id = $1
        AND DATE(attendance_date) = '2026-01-19'
      GROUP BY attendance_date
    `, [employee.id]);

    console.log('📊 Format retourné par l\'API:\n');
    console.table(records.rows);

    if (records.rows.length > 0) {
      const record = records.rows[0];
      console.log('\n🔍 Détails du format:');
      console.log(`  check_in: "${record.check_in}" (type: ${typeof record.check_in})`);
      console.log(`  check_out: "${record.check_out}" (type: ${typeof record.check_out})`);

      console.log('\n🧪 Test parsing JavaScript:');
      if (record.check_in) {
        const checkInDate = new Date(record.check_in);
        console.log(`  new Date("${record.check_in}"):`);
        console.log(`    → ${checkInDate}`);
        console.log(`    → Hours: ${checkInDate.getHours()}:${String(checkInDate.getMinutes()).padStart(2, '0')}`);
        console.log(`    → isNaN: ${isNaN(checkInDate.getTime())}`);
      }

      if (record.check_out) {
        const checkOutDate = new Date(record.check_out);
        console.log(`\n  new Date("${record.check_out}"):`);
        console.log(`    → ${checkOutDate}`);
        console.log(`    → Hours: ${checkOutDate.getHours()}:${String(checkOutDate.getMinutes()).padStart(2, '0')}`);
        console.log(`    → isNaN: ${isNaN(checkOutDate.getTime())}`);
      }
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

testApiFormat();
