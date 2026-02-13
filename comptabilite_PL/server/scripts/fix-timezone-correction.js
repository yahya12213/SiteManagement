/**
 * Script pour corriger le décalage timezone des pointages de correction
 * Problème: Les heures sont stockées avec +1h de décalage (UTC au lieu de heure locale)
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

async function fixTimezoneCorrection() {
  try {
    console.log('🔍 Recherche des pointages de correction d\'Oumayma pour le 19/01/2026...\n');

    // Find Oumayma
    const employeeResult = await pool.query(`
      SELECT id, first_name, last_name
      FROM hr_employees
      WHERE LOWER(first_name) LIKE '%oumayma%'
      LIMIT 1
    `);

    if (employeeResult.rows.length === 0) {
      console.log('❌ Employée non trouvée');
      return;
    }

    const employee = employeeResult.rows[0];
    console.log(`✅ Employée: ${employee.first_name} ${employee.last_name}`);

    // Get current records
    const currentRecords = await pool.query(`
      SELECT id, clock_time, status
      FROM hr_attendance_records
      WHERE employee_id = $1
        AND DATE(clock_time) = '2026-01-19'
        AND source = 'correction'
      ORDER BY clock_time
    `, [employee.id]);

    console.log('\n📊 Enregistrements actuels (avec décalage +1h):');
    currentRecords.rows.forEach(r => {
      const time = new Date(r.clock_time);
      console.log(`   ${r.status}: ${time.toISOString()} (affiché comme ${time.getUTCHours()}:${String(time.getUTCMinutes()).padStart(2, '0')} UTC)`);
    });

    // Fix check-in (should be 10:00 local = 09:00 UTC, but stored as 10:00 UTC)
    // We need to subtract 1 hour
    console.log('\n🔧 Correction des heures (enlever 1h de décalage)...');

    const checkIn = currentRecords.rows.find(r => r.status === 'present' || r.status === 'check_in');
    const checkOut = currentRecords.rows.find(r => r.status === 'check_out');

    if (checkIn) {
      await pool.query(`
        UPDATE hr_attendance_records
        SET clock_time = clock_time - INTERVAL '1 hour'
        WHERE id = $1
        RETURNING clock_time
      `, [checkIn.id]);
      console.log('   ✅ Check-in corrigé: 09:00 UTC (10:00 heure locale)');
    }

    if (checkOut) {
      await pool.query(`
        UPDATE hr_attendance_records
        SET clock_time = clock_time - INTERVAL '1 hour'
        WHERE id = $1
        RETURNING clock_time
      `, [checkOut.id]);
      console.log('   ✅ Check-out corrigé: 19:00 UTC (20:00 heure locale)');
    }

    // Verify final state
    const finalRecords = await pool.query(`
      SELECT id, clock_time, status
      FROM hr_attendance_records
      WHERE employee_id = $1
        AND DATE(clock_time) = '2026-01-19'
        AND source = 'correction'
      ORDER BY clock_time
    `, [employee.id]);

    console.log('\n✅ Enregistrements corrigés:');
    finalRecords.rows.forEach(r => {
      const time = new Date(r.clock_time);
      console.log(`   ${r.status}: ${time.toISOString()} (affiché comme ${time.getUTCHours()}:${String(time.getUTCMinutes()).padStart(2, '0')} UTC)`);
    });

    console.log('\n🎉 Correction terminée!');

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixTimezoneCorrection();
