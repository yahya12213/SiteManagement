/**
 * Script pour vérifier le résumé quotidien d'Oumayma (19/01/2026)
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

async function checkDailySummary() {
  try {
    console.log('🔍 Recherche de l\'employée Oumayma...');

    const employeeResult = await pool.query(`
      SELECT id, first_name, last_name, employee_number
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

    // Check ALL attendance records for 2026-01-19
    console.log('📊 Enregistrements de pointage bruts (19/01/2026):');
    const rawRecords = await pool.query(`
      SELECT
        id,
        attendance_date,
        clock_time,
        status,
        source,
        notes,
        late_minutes,
        early_leave_minutes,
        created_at
      FROM hr_attendance_records
      WHERE employee_id = $1
        AND DATE(clock_time) = '2026-01-19'
      ORDER BY clock_time
    `, [employee.id]);

    console.table(rawRecords.rows);

    // Calculate daily summary (like the frontend would)
    console.log('\n📈 Calcul du résumé quotidien:');

    const checkIn = rawRecords.rows.find(r => r.status === 'check_in' || r.status === 'late');
    const checkOut = rawRecords.rows.find(r => r.status === 'check_out');

    if (checkIn && checkOut) {
      const checkInTime = new Date(checkIn.clock_time);
      const checkOutTime = new Date(checkOut.clock_time);
      const workedMs = checkOutTime - checkInTime;
      const workedHours = workedMs / (1000 * 60 * 60);
      const workedMinutes = workedMs / (1000 * 60);

      console.log(`   Entrée: ${checkInTime.toLocaleTimeString('fr-FR')}`);
      console.log(`   Sortie: ${checkOutTime.toLocaleTimeString('fr-FR')}`);
      console.log(`   Heures travaillées: ${Math.floor(workedHours)}h ${Math.floor(workedMinutes % 60)}min`);
      console.log(`   Statut entrée: ${checkIn.status}`);
      console.log(`   Statut sortie: ${checkOut.status}`);
    } else {
      console.log('⚠️  Pointages incomplets:');
      console.log(`   Check-in: ${checkIn ? '✅' : '❌'}`);
      console.log(`   Check-out: ${checkOut ? '✅' : '❌'}`);
    }

    // Check if there's a final status record (present, late, etc.)
    const finalStatusRecord = rawRecords.rows.find(r =>
      ['present', 'late', 'partial', 'absent', 'sortie_anticipee'].includes(r.status)
    );

    if (finalStatusRecord) {
      console.log(`\n✅ Statut final: ${finalStatusRecord.status}`);
    } else {
      console.log(`\n⚠️  Aucun statut final trouvé (present/late/partial/absent)`);
      console.log('   Le statut final devrait être calculé au check-out');
    }

    // Check monthly summary
    console.log('\n📅 Vérification résumé mensuel:');
    const monthlySummary = await pool.query(`
      SELECT *
      FROM hr_monthly_attendance_summary
      WHERE employee_id = $1
        AND year = 2026
        AND month = 1
      LIMIT 1
    `, [employee.id]);

    if (monthlySummary.rows.length > 0) {
      console.log('Résumé mensuel trouvé:');
      console.log(`   Jours présents: ${monthlySummary.rows[0].days_present}`);
      console.log(`   Jours absents: ${monthlySummary.rows[0].days_absent}`);
      console.log(`   Retards: ${monthlySummary.rows[0].days_late}`);
    } else {
      console.log('⚠️  Aucun résumé mensuel trouvé pour janvier 2026');
    }

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

checkDailySummary();
