/**
 * Script pour vérifier les heures exactes stockées en base
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

async function checkExactTime() {
  try {
    console.log('🔍 Vérification des heures exactes pour Oumayma (19/01/2026)...\n');

    // Find Oumayma
    const employeeResult = await pool.query(`
      SELECT id FROM hr_employees WHERE LOWER(first_name) LIKE '%oumayma%' LIMIT 1
    `);

    const employee = employeeResult.rows[0];

    // Get records with timezone info
    const records = await pool.query(`
      SELECT
        id,
        status,
        clock_time,
        clock_time AT TIME ZONE 'UTC' as utc_time,
        EXTRACT(HOUR FROM clock_time AT TIME ZONE 'UTC') as utc_hour,
        EXTRACT(MINUTE FROM clock_time AT TIME ZONE 'UTC') as utc_minute,
        to_char(clock_time, 'YYYY-MM-DD HH24:MI:SS TZ') as formatted_with_tz
      FROM hr_attendance_records
      WHERE employee_id = $1
        AND DATE(clock_time) = '2026-01-19'
        AND source = 'correction'
      ORDER BY clock_time
    `, [employee.id]);

    console.log('📊 Heures stockées en base de données:\n');
    records.rows.forEach(r => {
      console.log(`${r.status}:`);
      console.log(`  clock_time brut: ${r.clock_time}`);
      console.log(`  Formaté avec TZ: ${r.formatted_with_tz}`);
      console.log(`  UTC: ${r.utc_hour}:${String(r.utc_minute).padStart(2, '0')}`);
      console.log('');
    });

    // Check what the API would return
    console.log('📡 Ce que l\'API devrait retourner:\n');
    const apiResult = await pool.query(`
      SELECT
        clock_time,
        status,
        to_char(clock_time, 'HH24:MI') as time_only
      FROM hr_attendance_records
      WHERE employee_id = $1
        AND DATE(clock_time) = '2026-01-19'
        AND source = 'correction'
      ORDER BY clock_time
    `, [employee.id]);

    apiResult.rows.forEach(r => {
      console.log(`  ${r.status}: ${r.time_only} (full: ${r.clock_time})`);
    });

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkExactTime();
