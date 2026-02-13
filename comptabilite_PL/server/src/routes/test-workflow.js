import express from 'express';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import pool from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

router.post('/run', authenticateToken, requireRole(['gerant', 'admin']), async (req, res) => {
  const client = await pool.connect();

  const results = {
    success: true,
    steps: [],
    employees: {},
    requests: {}
  };

  try {
    await client.query('BEGIN');

    // ÉTAPE 1: Créer les profils
    results.steps.push('Création des profils');

    const managerN1Result = await client.query(`
      INSERT INTO profiles (id, email, full_name, role)
      VALUES (
        gen_random_uuid(),
        'directeur.test@example.com',
        'Directeur Test',
        'gerant'
      )
      ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
      RETURNING id, email, full_name
    `);
    const managerN1 = managerN1Result.rows[0];
    results.employees.managerN1 = managerN1;

    const managerNResult = await client.query(`
      INSERT INTO profiles (id, email, full_name, role)
      VALUES (
        gen_random_uuid(),
        'chef.equipe.test@example.com',
        'Chef Équipe Test',
        'employee'
      )
      ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
      RETURNING id, email, full_name
    `);
    const managerN = managerNResult.rows[0];
    results.employees.managerN = managerN;

    const employeeProfileResult = await client.query(`
      INSERT INTO profiles (id, email, full_name, role)
      VALUES (
        gen_random_uuid(),
        'employe.test@example.com',
        'Employé Test',
        'employee'
      )
      ON CONFLICT (email) DO UPDATE SET full_name = EXCLUDED.full_name
      RETURNING id, email, full_name
    `);
    const employeeProfile = employeeProfileResult.rows[0];
    results.employees.employee = employeeProfile;

    // ÉTAPE 2: Créer les employés HR
    results.steps.push('Création des employés RH');

    const hrManagerN1Result = await client.query(`
      INSERT INTO hr_employees (
        id, profile_id, employee_number, first_name, last_name,
        email, phone, hire_date, employment_status, requires_clocking,
        department, position, salary, hourly_rate
      ) VALUES (
        gen_random_uuid(),
        $1,
        'EMP-DIR-' || FLOOR(RANDOM() * 10000),
        'Directeur',
        'Test',
        'directeur.test@example.com',
        '+212600000001',
        '2020-01-01',
        'active',
        false,
        'Direction',
        'Directeur',
        120000,
        600
      )
      ON CONFLICT (profile_id) DO UPDATE
      SET first_name = EXCLUDED.first_name
      RETURNING id, employee_number, first_name, last_name
    `, [managerN1.id]);
    const hrManagerN1 = hrManagerN1Result.rows[0];
    results.employees.hrManagerN1 = hrManagerN1;

    const hrManagerNResult = await client.query(`
      INSERT INTO hr_employees (
        id, profile_id, employee_number, first_name, last_name,
        email, phone, hire_date, employment_status, requires_clocking,
        department, position, salary, hourly_rate
      ) VALUES (
        gen_random_uuid(),
        $1,
        'EMP-CHF-' || FLOOR(RANDOM() * 10000),
        'Chef',
        'Équipe Test',
        'chef.equipe.test@example.com',
        '+212600000002',
        '2021-01-01',
        'active',
        false,
        'Production',
        'Chef d''équipe',
        80000,
        400
      )
      ON CONFLICT (profile_id) DO UPDATE
      SET first_name = EXCLUDED.first_name
      RETURNING id, employee_number, first_name, last_name
    `, [managerN.id]);
    const hrManagerN = hrManagerNResult.rows[0];
    results.employees.hrManagerN = hrManagerN;

    const hrEmployeeResult = await client.query(`
      INSERT INTO hr_employees (
        id, profile_id, employee_number, first_name, last_name,
        email, phone, hire_date, employment_status, requires_clocking,
        department, position, salary, hourly_rate
      ) VALUES (
        gen_random_uuid(),
        $1,
        'EMP-TST-' || FLOOR(RANDOM() * 10000),
        'Employé',
        'Test',
        'employe.test@example.com',
        '+212600000003',
        '2023-06-01',
        'active',
        true,
        'Production',
        'Opérateur',
        36000,
        150
      )
      ON CONFLICT (profile_id) DO UPDATE
      SET first_name = EXCLUDED.first_name
      RETURNING id, employee_number, first_name, last_name
    `, [employeeProfile.id]);
    const hrEmployee = hrEmployeeResult.rows[0];
    results.employees.hrEmployee = hrEmployee;

    // ÉTAPE 3: Définir la hiérarchie
    results.steps.push('Définition de la hiérarchie');

    await client.query(`
      DELETE FROM hr_employee_managers WHERE employee_id = $1
    `, [hrEmployee.id]);

    await client.query(`
      INSERT INTO hr_employee_managers (employee_id, manager_id, rank, is_active)
      VALUES ($1, $2, 0, true)
    `, [hrEmployee.id, hrManagerN.id]);

    await client.query(`
      INSERT INTO hr_employee_managers (employee_id, manager_id, rank, is_active)
      VALUES ($1, $2, 1, true)
    `, [hrEmployee.id, hrManagerN1.id]);

    // ÉTAPE 4: Créer des pointages
    results.steps.push('Création des pointages');

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    await client.query(`
      DELETE FROM hr_attendance_records
      WHERE employee_id = $1 AND attendance_date = $2
    `, [hrEmployee.id, yesterdayStr]);

    const checkInTime = new Date(yesterday);
    checkInTime.setHours(8, 45, 0, 0);

    const checkInResult = await client.query(`
      INSERT INTO hr_attendance_records (
        employee_id, attendance_date, clock_time, status, source,
        scheduled_start, late_minutes
      ) VALUES ($1, $2, $3, 'late', 'self_service', '08:30:00', 15)
      RETURNING id, clock_time, status, late_minutes
    `, [hrEmployee.id, yesterdayStr, checkInTime.toISOString()]);

    const checkOutTime = new Date(yesterday);
    checkOutTime.setHours(16, 0, 0, 0);

    const checkOutResult = await client.query(`
      INSERT INTO hr_attendance_records (
        employee_id, attendance_date, clock_time, status, source,
        scheduled_start, scheduled_end, early_leave_minutes
      ) VALUES ($1, $2, $3, 'check_out', 'self_service', '08:30:00', '17:30:00', 90)
      RETURNING id, clock_time, status, early_leave_minutes
    `, [hrEmployee.id, yesterdayStr, checkOutTime.toISOString()]);

    results.requests.checkIn = checkInResult.rows[0];
    results.requests.checkOut = checkOutResult.rows[0];

    // ÉTAPE 5: Créer demande de correction
    results.steps.push('Création demande de correction');

    const correctionResult = await client.query(`
      INSERT INTO hr_correction_requests (
        employee_id, attendance_date, request_type, status,
        current_check_in, current_check_out,
        requested_check_in, requested_check_out,
        reason, created_at
      ) VALUES (
        $1, $2, 'time_correction', 'pending',
        '08:45:00', '16:00:00',
        '08:30:00', '17:30:00',
        'Erreur de pointage - J''étais présent aux heures normales',
        NOW()
      )
      RETURNING id, attendance_date, request_type, status, reason
    `, [hrEmployee.id, yesterdayStr]);

    const correction = correctionResult.rows[0];
    results.requests.correction = correction;

    // ÉTAPE 6: Validation N
    results.steps.push('Validation par Manager N');

    await client.query(`
      UPDATE hr_correction_requests
      SET
        status = 'approved_n1',
        n1_approver_id = $1,
        n1_approved_at = NOW(),
        n1_comment = 'Vérifié - Employé présent aux horaires demandés'
      WHERE id = $2
    `, [hrManagerN.id, correction.id]);

    // ÉTAPE 7: Validation N+1
    results.steps.push('Validation par Manager N+1');

    await client.query(`
      UPDATE hr_correction_requests
      SET
        status = 'approved',
        n2_approver_id = $1,
        n2_approved_at = NOW(),
        n2_comment = 'Approuvé - Correction validée',
        approved_at = NOW()
      WHERE id = $2
    `, [hrManagerN1.id, correction.id]);

    // ÉTAPE 8: Appliquer correction
    results.steps.push('Application de la correction');

    await client.query(`
      UPDATE hr_attendance_records
      SET
        clock_time = $1,
        status = 'check_in',
        late_minutes = 0,
        notes = COALESCE(notes, '') || ' [Corrigé #' || $2 || ']'
      WHERE employee_id = $3 AND attendance_date = $4 AND status IN ('late', 'check_in')
    `, [yesterdayStr + ' 08:30:00', correction.id, hrEmployee.id, yesterdayStr]);

    await client.query(`
      UPDATE hr_attendance_records
      SET
        clock_time = $1,
        early_leave_minutes = 0,
        notes = COALESCE(notes, '') || ' [Corrigé #' || $2 || ']'
      WHERE employee_id = $3 AND attendance_date = $4 AND status = 'check_out'
    `, [yesterdayStr + ' 17:30:00', correction.id, hrEmployee.id, yesterdayStr]);

    await client.query(`
      UPDATE hr_attendance_records
      SET status = 'present'
      WHERE employee_id = $1 AND attendance_date = $2 AND status = 'check_in'
    `, [hrEmployee.id, yesterdayStr]);

    // ÉTAPE 9: Créer congé standard
    results.steps.push('Création demande de congé');

    const leaveStartDate = new Date(today);
    leaveStartDate.setDate(leaveStartDate.getDate() + 7);
    const leaveStartStr = leaveStartDate.toISOString().split('T')[0];

    const leaveEndDate = new Date(leaveStartDate);
    leaveEndDate.setDate(leaveEndDate.getDate() + 4);
    const leaveEndStr = leaveEndDate.toISOString().split('T')[0];

    const leaveResult = await client.query(`
      INSERT INTO hr_leave_requests (
        employee_id, leave_type, start_date, end_date,
        total_days, reason, status, created_at
      ) VALUES (
        $1, 'annual', $2, $3, 5,
        'Congé annuel planifié - vacances en famille',
        'pending', NOW()
      )
      RETURNING id, leave_type, start_date, end_date, total_days, status
    `, [hrEmployee.id, leaveStartStr, leaveEndStr]);

    const leave = leaveResult.rows[0];
    results.requests.leave = leave;

    await client.query(`
      UPDATE hr_leave_requests
      SET status = 'approved_n1', n1_approver_id = $1, n1_approved_at = NOW(),
          n1_comment = 'Congé approuvé - période disponible'
      WHERE id = $2
    `, [hrManagerN.id, leave.id]);

    await client.query(`
      UPDATE hr_leave_requests
      SET status = 'approved', n2_approver_id = $1, n2_approved_at = NOW(),
          n2_comment = 'Validé - Bon repos', approved_at = NOW()
      WHERE id = $2
    `, [hrManagerN1.id, leave.id]);

    // ÉTAPE 10: Créer congé maladie
    results.steps.push('Création demande de congé maladie');

    const sickLeaveStartDate = new Date(today);
    sickLeaveStartDate.setDate(sickLeaveStartDate.getDate() + 1);
    const sickLeaveStartStr = sickLeaveStartDate.toISOString().split('T')[0];

    const sickLeaveEndDate = new Date(sickLeaveStartDate);
    sickLeaveEndDate.setDate(sickLeaveEndDate.getDate() + 2);
    const sickLeaveEndStr = sickLeaveEndDate.toISOString().split('T')[0];

    // Créer fichier de test
    const uploadsDir = path.join(process.cwd(), 'uploads', 'medical-certificates');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const testCertificatePath = path.join(uploadsDir, `certificat-medical-test-${Date.now()}.txt`);
    fs.writeFileSync(testCertificatePath, `
CERTIFICAT MÉDICAL - TEST
Patient: ${hrEmployee.first_name} ${hrEmployee.last_name}
Date: ${new Date().toLocaleDateString('fr-FR')}
Durée: 3 jours
Du: ${sickLeaveStartDate.toLocaleDateString('fr-FR')}
Au: ${sickLeaveEndDate.toLocaleDateString('fr-FR')}
    `);

    const sickLeaveResult = await client.query(`
      INSERT INTO hr_leave_requests (
        employee_id, leave_type, start_date, end_date,
        total_days, reason, status, justification_url, created_at
      ) VALUES (
        $1, 'sick', $2, $3, 3,
        'Grippe - Repos médical prescrit',
        'pending', $4, NOW()
      )
      RETURNING id, leave_type, start_date, end_date, total_days, status, justification_url
    `, [hrEmployee.id, sickLeaveStartStr, sickLeaveEndStr, testCertificatePath]);

    const sickLeave = sickLeaveResult.rows[0];
    results.requests.sickLeave = sickLeave;

    await client.query(`
      UPDATE hr_leave_requests
      SET status = 'approved_n1', n1_approver_id = $1, n1_approved_at = NOW(),
          n1_comment = 'Certificat médical vérifié'
      WHERE id = $2
    `, [hrManagerN.id, sickLeave.id]);

    await client.query(`
      UPDATE hr_leave_requests
      SET status = 'approved', n2_approver_id = $1, n2_approved_at = NOW(),
          n2_comment = 'Validé - Prompt rétablissement', approved_at = NOW()
      WHERE id = $2
    `, [hrManagerN1.id, sickLeave.id]);

    await client.query('COMMIT');

    results.summary = {
      totalSteps: results.steps.length,
      employeeCreated: `${hrEmployee.first_name} ${hrEmployee.last_name} (${hrEmployee.employee_number})`,
      managerN: `${hrManagerN.first_name} ${hrManagerN.last_name} (${hrManagerN.employee_number})`,
      managerN1: `${hrManagerN1.first_name} ${hrManagerN1.last_name} (${hrManagerN1.employee_number})`,
      correctionId: correction.id,
      leaveId: leave.id,
      sickLeaveId: sickLeave.id,
      certificatePath: path.basename(testCertificatePath)
    };

    res.json({
      success: true,
      message: 'Workflow de test complété avec succès',
      results
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Erreur workflow test:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      details: error.stack
    });
  } finally {
    client.release();
  }
});

export default router;
