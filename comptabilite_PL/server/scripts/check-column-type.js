/**
 * Script pour vérifier le type de la colonne clock_time
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

async function checkColumnType() {
  try {
    console.log('🔍 Vérification du type de colonne clock_time...\n');

    const result = await pool.query(`
      SELECT
        column_name,
        data_type,
        udt_name,
        datetime_precision,
        is_nullable
      FROM information_schema.columns
      WHERE table_name = 'hr_attendance_records'
        AND column_name IN ('clock_time', 'attendance_date')
      ORDER BY column_name
    `);

    console.log('📋 Structure des colonnes:\n');
    console.table(result.rows);

    // Test actual timezone behavior
    console.log('\n🧪 Test de comportement timezone:\n');

    const employeeResult = await pool.query(`
      SELECT id FROM hr_employees WHERE LOWER(first_name) LIKE '%oumayma%' LIMIT 1
    `);
    const employee = employeeResult.rows[0];

    const testResult = await pool.query(`
      SELECT
        clock_time,
        clock_time::text as text_representation,
        to_char(clock_time, 'YYYY-MM-DD HH24:MI:SS') as formatted_no_tz,
        to_char(clock_time AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') as formatted_utc
      FROM hr_attendance_records
      WHERE employee_id = $1
        AND DATE(clock_time) = '2026-01-19'
        AND source = 'correction'
      ORDER BY clock_time
      LIMIT 1
    `, [employee.id]);

    console.log('Résultat test:');
    console.table(testResult.rows);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkColumnType();
