/**
 * Script pour corriger la demande de correction d'Oumayma (19/01/2026)
 * Créer les enregistrements de pointage manquants
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

async function fixOumaymaCorrectionData() {
  try {
    console.log('🔍 Recherche de l\'employée Oumayma...');

    // Find Oumayma
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
    console.log(`✅ Employée trouvée: ${employee.first_name} ${employee.last_name} (ID: ${employee.id})`);

    // Find approved correction request for 2026-01-19
    console.log('\n🔍 Recherche de la demande de correction pour le 19/01/2026...');
    const correctionResult = await pool.query(`
      SELECT
        id, employee_id, request_date,
        requested_check_in, requested_check_out,
        reason, status,
        created_at, updated_at
      FROM hr_attendance_correction_requests
      WHERE employee_id = $1
        AND request_date = '2026-01-19'
        AND status = 'approved'
      ORDER BY created_at DESC
      LIMIT 1
    `, [employee.id]);

    if (correctionResult.rows.length === 0) {
      console.log('❌ Aucune demande de correction approuvée trouvée pour le 19/01/2026');
      console.log('\n📋 Demandes de correction existantes pour Oumayma:');
      const allCorrections = await pool.query(`
        SELECT id, request_date, status, requested_check_in, requested_check_out
        FROM hr_attendance_correction_requests
        WHERE employee_id = $1
        ORDER BY request_date DESC
        LIMIT 10
      `, [employee.id]);
      console.table(allCorrections.rows);
      return;
    }

    const correction = correctionResult.rows[0];
    console.log(`✅ Demande de correction trouvée (ID: ${correction.id})`);
    console.log(`   Date: ${correction.request_date}`);
    console.log(`   Entrée demandée: ${correction.requested_check_in}`);
    console.log(`   Sortie demandée: ${correction.requested_check_out}`);
    console.log(`   Statut: ${correction.status}`);

    // Check if attendance records already exist
    console.log('\n🔍 Vérification des enregistrements de pointage existants...');
    const existingRecords = await pool.query(`
      SELECT id, clock_time, status, source
      FROM hr_attendance_records
      WHERE employee_id = $1
        AND DATE(clock_time) = $2
      ORDER BY clock_time
    `, [employee.id, correction.request_date]);

    if (existingRecords.rows.length > 0) {
      console.log(`⚠️  ${existingRecords.rows.length} enregistrement(s) trouvé(s):`);
      console.table(existingRecords.rows);
      console.log('\n❓ Voulez-vous recréer les enregistrements ? (les existants seront supprimés)');
      // For automated script, we'll skip deletion and just show what exists
      return;
    }

    console.log('✅ Aucun enregistrement existant trouvé');

    // Create attendance records
    console.log('\n📝 Création des enregistrements de pointage...');

    // Check-in
    const checkInResult = await pool.query(`
      INSERT INTO hr_attendance_records (
        employee_id, attendance_date, clock_time,
        status, source, notes, created_at
      )
      VALUES (
        $1,
        $2::date,
        $2::date + $3::time,
        'check_in',
        'correction',
        'Créé suite à demande de correction approuvée',
        NOW()
      )
      RETURNING id, clock_time, status, source
    `, [employee.id, correction.request_date, correction.requested_check_in]);

    console.log('✅ Entrée créée:');
    console.log(checkInResult.rows[0]);

    // Check-out
    if (correction.requested_check_out) {
      const checkOutResult = await pool.query(`
        INSERT INTO hr_attendance_records (
          employee_id, attendance_date, clock_time,
          status, source, notes, created_at
        )
        VALUES (
          $1,
          $2::date,
          $2::date + $3::time,
          'check_out',
          'correction',
          'Créé suite à demande de correction approuvée',
          NOW()
        )
        RETURNING id, clock_time, status, source
      `, [employee.id, correction.request_date, correction.requested_check_out]);

      console.log('✅ Sortie créée:');
      console.log(checkOutResult.rows[0]);
    }

    console.log('\n✅ Correction terminée avec succès !');
    console.log('\n📊 Vérification finale:');
    const finalRecords = await pool.query(`
      SELECT id, clock_time, status, source
      FROM hr_attendance_records
      WHERE employee_id = $1
        AND DATE(clock_time) = $2
      ORDER BY clock_time
    `, [employee.id, correction.request_date]);

    console.table(finalRecords.rows);

  } catch (error) {
    console.error('❌ Erreur:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

fixOumaymaCorrectionData();
