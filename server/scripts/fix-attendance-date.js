/**
 * Script pour corriger les enregistrements de pointage d'Oumayma
 * Ajouter attendance_date et calculer le statut final
 */

import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixAttendanceDate() {
  try {
    console.log('🔍 Recherche de l\'employée Oumayma...');

    const employeeResult = await pool.query(`
      SELECT id, first_name, last_name
      FROM hr_employees
      WHERE LOWER(first_name) LIKE '%oumayma%' OR LOWER(last_name) LIKE '%oumayma%'
      LIMIT 1
    `);

    if (employeeResult.rows.length === 0) {
      console.log('❌ Employée Oumayma non trouvée');
      return;
    }

    const employee = employeeResult.rows[0];
    console.log(`✅ Employée: ${employee.first_name} ${employee.last_name}\n`);

    // Get records for 2026-01-19
    console.log('📊 Enregistrements avant correction:');
    const beforeRecords = await pool.query(`
      SELECT id, clock_time, status, attendance_date, source
      FROM hr_attendance_records
      WHERE employee_id = $1
        AND DATE(clock_time) = '2026-01-19'
      ORDER BY clock_time
    `, [employee.id]);

    console.table(beforeRecords.rows);

    // Update attendance_date for both records
    console.log('\n🔧 Mise à jour de attendance_date...');
    await pool.query(`
      UPDATE hr_attendance_records
      SET attendance_date = DATE(clock_time)
      WHERE employee_id = $1
        AND DATE(clock_time) = '2026-01-19'
        AND attendance_date IS NULL
    `, [employee.id]);

    const checkIn = beforeRecords.rows.find(r => r.status === 'check_in');
    const checkOut = beforeRecords.rows.find(r => r.status === 'check_out');

    if (checkIn && checkOut) {
      const checkInTime = new Date(checkIn.clock_time);
      const checkOutTime = new Date(checkOut.clock_time);
      const workedMs = checkOutTime - checkInTime;
      const workedHours = workedMs / (1000 * 60 * 60);

      console.log(`   Heures travaillées: ${workedHours}h`);

      // Determine final status
      let finalStatus = 'present';
      if (workedHours < 3) {
        finalStatus = 'partial';
      } else if (checkIn.late_minutes > 0) {
        finalStatus = 'late';
      }

      console.log(`   Statut final calculé: ${finalStatus}\n`);

      // Update check_in record with final status
      console.log('🔧 Mise à jour du statut final...');
      await pool.query(`
        UPDATE hr_attendance_records
        SET status = $1
        WHERE id = $2
      `, [finalStatus, checkIn.id]);
    }

    // Verify the fix
    console.log('\n✅ Enregistrements après correction:');
    const afterRecords = await pool.query(`
      SELECT id, attendance_date, clock_time, status, source, late_minutes
      FROM hr_attendance_records
      WHERE employee_id = $1
        AND DATE(clock_time) = '2026-01-19'
      ORDER BY clock_time
    `, [employee.id]);

    console.table(afterRecords.rows);

    console.log('\n✅ Correction terminée !');
    console.log('\n📝 Résumé:');
    console.log(`   attendance_date: ${afterRecords.rows[0].attendance_date || 'NULL'} → devrait être 2026-01-19`);
    console.log(`   Statut final: ${afterRecords.rows.find(r => r.status !== 'check_out')?.status}`);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixAttendanceDate();
