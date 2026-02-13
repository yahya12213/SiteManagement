import express from 'express';
import { authenticateToken, requirePermission } from '../middleware/auth.js';
import pool from '../config/database.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

const router = express.Router();

// ===============================
// PAYROLL PERIODS
// ===============================

/**
 * Get all payroll periods
 */
router.get('/periods',
  authenticateToken,
  requirePermission('hr.payroll.view_page'),
  async (req, res) => {
    const { year, status } = req.query;

    try {
      let query = `
        SELECT * FROM hr_payroll_periods
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 1;

      if (year) {
        query += ` AND year = $${paramCount}`;
        params.push(parseInt(year));
        paramCount++;
      }

      if (status) {
        query += ` AND status = $${paramCount}`;
        params.push(status);
        paramCount++;
      }

      query += ' ORDER BY year DESC, month DESC';

      const result = await pool.query(query, params);
      res.json({ success: true, periods: result.rows });
    } catch (error) {
      console.error('Error fetching payroll periods:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get single payroll period with summary
 */
router.get('/periods/:id',
  authenticateToken,
  requirePermission('hr.payroll.view_page'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const result = await pool.query(`
        SELECT p.*,
          (SELECT COUNT(*) FROM hr_payslips WHERE period_id = p.id) as payslip_count,
          (SELECT COUNT(*) FROM hr_payslips WHERE period_id = p.id AND status = 'validated') as validated_count
        FROM hr_payroll_periods p
        WHERE p.id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Period not found' });
      }

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Error fetching payroll period:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Create a new payroll period
 */
router.post('/periods',
  authenticateToken,
  requirePermission('hr.payroll.periods.create'),
  async (req, res) => {
    const { year, month, start_date, end_date, pay_date, notes } = req.body;
    const userId = req.user.id;

    try {
      // Check if period already exists
      const existing = await pool.query(
        'SELECT id FROM hr_payroll_periods WHERE year = $1 AND month = $2',
        [year, month]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Une période de paie existe déjà pour ${month}/${year}`
        });
      }

      const months = ['', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
      const name = `${months[month]} ${year}`;

      const result = await pool.query(`
        INSERT INTO hr_payroll_periods
        (name, year, month, start_date, end_date, pay_date, notes, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `, [name, year, month, start_date, end_date, pay_date, notes, userId]);

      // Audit log
      await pool.query(`
        INSERT INTO hr_payroll_audit_logs (entity_type, entity_id, action, new_values, performed_by)
        VALUES ('period', $1, 'create', $2, $3)
      `, [result.rows[0].id, JSON.stringify(result.rows[0]), userId]);

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Error creating payroll period:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Update a payroll period
 */
router.put('/periods/:id',
  authenticateToken,
  requirePermission('hr.payroll.periods.create'),
  async (req, res) => {
    const { id } = req.params;
    const { start_date, end_date, pay_date, notes } = req.body;
    const userId = req.user.id;

    try {
      // Check period is not closed
      const period = await pool.query('SELECT * FROM hr_payroll_periods WHERE id = $1', [id]);
      if (period.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Period not found' });
      }
      if (period.rows[0].status === 'closed') {
        return res.status(400).json({ success: false, error: 'Cannot modify a closed period' });
      }

      const result = await pool.query(`
        UPDATE hr_payroll_periods
        SET start_date = COALESCE($1, start_date),
            end_date = COALESCE($2, end_date),
            pay_date = COALESCE($3, pay_date),
            notes = COALESCE($4, notes)
        WHERE id = $5
        RETURNING *
      `, [start_date, end_date, pay_date, notes, id]);

      // Audit log
      await pool.query(`
        INSERT INTO hr_payroll_audit_logs (entity_type, entity_id, action, old_values, new_values, performed_by)
        VALUES ('period', $1, 'update', $2, $3, $4)
      `, [id, JSON.stringify(period.rows[0]), JSON.stringify(result.rows[0]), userId]);

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Error updating payroll period:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Close a payroll period
 */
router.post('/periods/:id/close',
  authenticateToken,
  requirePermission('hr.payroll.periods.close'),
  async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
      // Check all payslips are validated
      const unvalidated = await pool.query(`
        SELECT COUNT(*) FROM hr_payslips
        WHERE period_id = $1 AND status != 'validated'
      `, [id]);

      if (parseInt(unvalidated.rows[0].count) > 0) {
        return res.status(400).json({
          success: false,
          error: `${unvalidated.rows[0].count} bulletins ne sont pas encore validés`
        });
      }

      const result = await pool.query(`
        UPDATE hr_payroll_periods
        SET status = 'closed', closed_at = NOW(), closed_by = $1
        WHERE id = $2 AND status = 'validated'
        RETURNING *
      `, [userId, id]);

      if (result.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Period must be validated before closing'
        });
      }

      // Audit log
      await pool.query(`
        INSERT INTO hr_payroll_audit_logs (entity_type, entity_id, action, performed_by)
        VALUES ('period', $1, 'close', $2)
      `, [id, userId]);

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Error closing payroll period:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ===============================
// PAYROLL EMPLOYEES
// ===============================

/**
 * Get eligible employees for payroll calculation
 * GET /api/hr/payroll/employees
 */
router.get('/employees',
  authenticateToken,
  requirePermission('hr.payroll.calculate'),
  async (req, res) => {
    const { search, segment_id } = req.query;

    try {
      let query = `
        SELECT
          e.id,
          e.employee_number,
          e.first_name,
          e.last_name,
          e.department,
          e.position,
          e.hourly_rate,
          e.payroll_cutoff_day,
          e.segment_id,
          e.is_cnss_subject,
          e.is_amo_subject,
          s.name as segment_name,
          s.color as segment_color,
          c.salary_gross as base_salary,
          c.working_hours_per_week
        FROM hr_employees e
        LEFT JOIN segments s ON e.segment_id = s.id
        LEFT JOIN hr_contracts c ON c.employee_id = e.id AND c.status = 'active'
        WHERE e.employment_status = 'active'
      `;

      const params = [];
      let paramCount = 1;

      // Filtre par segment
      if (segment_id && segment_id !== 'all') {
        query += ` AND e.segment_id = $${paramCount}`;
        params.push(segment_id);
        paramCount++;
      }

      // Filtre recherche
      if (search) {
        query += ` AND (
          e.first_name ILIKE $${paramCount}
          OR e.last_name ILIKE $${paramCount}
          OR e.employee_number ILIKE $${paramCount}
          OR CONCAT(e.first_name, ' ', e.last_name) ILIKE $${paramCount}
        )`;
        params.push(`%${search}%`);
        paramCount++;
      }

      query += ' ORDER BY e.last_name, e.first_name';

      const result = await pool.query(query, params);

      res.json({
        success: true,
        employees: result.rows
      });
    } catch (error) {
      console.error('Error fetching payroll employees:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get employee counts by segment
 * GET /api/hr/payroll/employees/counts-by-segment
 */
router.get('/employees/counts-by-segment',
  authenticateToken,
  requirePermission('hr.payroll.view_page'),
  async (req, res) => {
    try {
      const query = `
        SELECT
          s.id,
          s.name,
          s.color,
          COUNT(e.id)::integer as employee_count
        FROM segments s
        LEFT JOIN hr_employees e ON e.segment_id = s.id AND e.employment_status = 'active'
        GROUP BY s.id, s.name, s.color
        ORDER BY s.name
      `;

      const result = await pool.query(query);

      res.json({
        success: true,
        data: result.rows
      });
    } catch (error) {
      console.error('Error fetching employee counts by segment:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ===============================
// PAYROLL CALCULATION
// ===============================

/**
 * Calculate payroll for a period
 */
router.post('/calculate/:period_id',
  authenticateToken,
  requirePermission('hr.payroll.calculate'),
  async (req, res) => {
    const { period_id } = req.params;
    const { employee_ids } = req.body; // Array of employee IDs or undefined for all
    const userId = req.user.id;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Get period info
      const period = await client.query('SELECT * FROM hr_payroll_periods WHERE id = $1', [period_id]);
      if (period.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Period not found' });
      }

      const periodData = period.rows[0];
      if (periodData.status === 'closed') {
        return res.status(400).json({ success: false, error: 'Cannot recalculate a closed period' });
      }

      // Update period status
      await client.query(
        'UPDATE hr_payroll_periods SET status = $1 WHERE id = $2',
        ['calculating', period_id]
      );

      // Get payroll configuration
      const configResult = await client.query('SELECT * FROM hr_payroll_config WHERE is_active = true');
      const config = {};
      configResult.rows.forEach(row => {
        if (row.config_type === 'json') {
          config[row.config_key] = JSON.parse(row.config_value);
        } else if (row.config_type === 'number') {
          config[row.config_key] = parseFloat(row.config_value);
        } else if (row.config_type === 'boolean') {
          config[row.config_key] = row.config_value === 'true';
        } else {
          config[row.config_key] = row.config_value;
        }
      });

      // Get all active employees with contracts
      // Filter by employee_ids if provided
      let employeeQuery = `
        SELECT
          e.*,
          e.is_cnss_subject,
          e.is_amo_subject,
          c.salary_gross as base_salary,
          c.working_hours_per_week,
          c.start_date as contract_start_date
        FROM hr_employees e
        LEFT JOIN hr_contracts c ON c.employee_id = e.id AND c.status = 'active'
        WHERE e.employment_status = 'active'
      `;

      const employeeParams = [];

      // Add employee_ids filter if provided
      if (employee_ids && Array.isArray(employee_ids) && employee_ids.length > 0) {
        employeeQuery += ` AND e.id = ANY($1::uuid[])`;
        employeeParams.push(employee_ids);
      }

      employeeQuery += ' ORDER BY e.last_name, e.first_name';

      const employees = await client.query(employeeQuery, employeeParams);

      // Delete existing payslips for this period (if recalculating)
      await client.query('DELETE FROM hr_payslips WHERE period_id = $1', [period_id]);

      let totalGross = 0;
      let totalNet = 0;
      let totalCnssEmployee = 0;
      let totalCnssEmployer = 0;
      let totalAmo = 0;
      let totalIgr = 0;

      for (const emp of employees.rows) {
        // Get employee's work schedule for holiday calculation
        const scheduleResult = await client.query(`
          SELECT ws.monday_start, ws.monday_end, ws.tuesday_start, ws.tuesday_end,
                 ws.wednesday_start, ws.wednesday_end, ws.thursday_start, ws.thursday_end,
                 ws.friday_start, ws.friday_end, ws.saturday_start, ws.saturday_end,
                 ws.break_duration_minutes, ws.working_days
          FROM hr_employee_schedules es
          JOIN hr_work_schedules ws ON ws.id = es.schedule_id
          WHERE es.employee_id = $1
          ORDER BY es.start_date DESC LIMIT 1
        `, [emp.id]);
        const empSchedule = scheduleResult.rows[0];

        // Get attendance data from hr_attendance_daily
        const attendance = await client.query(`
          SELECT
            COALESCE(SUM(CASE
              WHEN day_status IN ('present', 'recovery_paid', 'late', 'overtime')
                   AND net_worked_minutes IS NOT NULL
              THEN net_worked_minutes
              ELSE 0
            END), 0) as worked_minutes,

            COUNT(CASE WHEN day_status = 'absent' AND is_working_day = true THEN 1 END) as absence_days,

            COALESCE(SUM(CASE
              WHEN is_working_day = true AND late_minutes > 0
              THEN late_minutes ELSE 0
            END), 0) as total_late_minutes,

            json_agg(json_build_object('dow', EXTRACT(DOW FROM work_date)::int))
              FILTER (WHERE day_status = 'holiday' AND is_working_day = true) as holiday_days
          FROM hr_attendance_daily
          WHERE employee_id = $1
            AND work_date BETWEEN $2 AND $3
        `, [emp.id, periodData.start_date, periodData.end_date]);

        // Calculate paid hours from holidays using employee schedule
        let holidayPaidMinutes = 0;
        const holidayDays = attendance.rows[0].holiday_days || [];
        if (empSchedule && holidayDays.length > 0) {
          const breakMin = empSchedule.break_duration_minutes || 60;
          const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
          for (const hd of holidayDays) {
            const dayName = dayNames[hd.dow];
            const startTime = empSchedule[`${dayName}_start`];
            const endTime = empSchedule[`${dayName}_end`];
            if (startTime && endTime) {
              holidayPaidMinutes += timeToMinutes(endTime) - timeToMinutes(startTime) - breakMin;
            } else {
              holidayPaidMinutes += 8 * 60;
            }
          }
        }

        const totalPaidHours = (parseFloat(attendance.rows[0].worked_minutes) + holidayPaidMinutes) / 60;
        const absenceDays = parseInt(attendance.rows[0].absence_days) || 0;
        const lateMinutes = parseInt(attendance.rows[0].total_late_minutes) || 0;

        // 🔍 LOG DIAGNOSTIC DÉTAILLÉ - DONNÉES SOURCES
        console.log(`\n${'='.repeat(70)}`);
        console.log(`🧑 EMPLOYÉ: ${emp.first_name} ${emp.last_name} (ID: ${emp.id})`);
        console.log(`${'='.repeat(70)}`);
        console.log(`📅 PÉRIODE: ${periodData.start_date} → ${periodData.end_date}`);
        console.log(`\n📋 DONNÉES CONTRAT (hr_contracts):`);
        console.log(`   base_salary (salary_gross): ${emp.base_salary ?? 'NULL'}`);
        console.log(`   working_hours_per_week: ${emp.working_hours_per_week ?? 'NULL'}`);
        console.log(`\n📋 DONNÉES EMPLOYÉ (hr_employees):`);
        console.log(`   hourly_rate: ${emp.hourly_rate ?? 'NULL'}`);
        console.log(`   segment_id: ${emp.segment_id ?? 'NULL'}`);
        console.log(`   ville_id: ${emp.ville_id ?? 'NULL'}`);
        console.log(`\n⏱️ DONNÉES POINTAGE (hr_attendance_daily):`);
        console.log(`   worked_minutes brut: ${attendance.rows[0].worked_minutes}`);
        console.log(`   holiday_paid_minutes: ${holidayPaidMinutes}`);
        console.log(`   total_paid_hours: ${totalPaidHours.toFixed(2)} h`);
        console.log(`   absence_days: ${absenceDays}`);
        console.log(`   late_minutes: ${lateMinutes}`);

        // Calculate base salary and hourly rate
        const empHourlyRate = parseFloat(emp.hourly_rate) || 0;
        let baseSalary;
        let hourlyRate;

        if (emp.base_salary) {
          baseSalary = parseFloat(emp.base_salary);
          hourlyRate = baseSalary / (config.working_hours_monthly || 191);
          console.log(`\n💵 MODE SALAIRE FIXE:`);
          console.log(`   baseSalary (contrat): ${baseSalary.toFixed(2)} MAD`);
          console.log(`   hourlyRate calculé: ${hourlyRate.toFixed(2)} MAD/h`);
        } else if (empHourlyRate > 0) {
          hourlyRate = empHourlyRate;
          baseSalary = hourlyRate * totalPaidHours;
          console.log(`\n💵 MODE SALAIRE HORAIRE:`);
          console.log(`   hourlyRate (employé): ${hourlyRate.toFixed(2)} MAD/h`);
          console.log(`   baseSalary calculé: ${hourlyRate.toFixed(2)} x ${totalPaidHours.toFixed(2)}h = ${baseSalary.toFixed(2)} MAD`);
        } else {
          console.log(`\n⚠️ AUCUNE DONNÉE SALAIRE - EMPLOYÉ IGNORÉ`);
          console.log(`${'='.repeat(70)}\n`);
          continue; // Skip employees without salary data
        }

        // Absence and late deductions (only for fixed-salary employees)
        // Hourly workers: absent days already excluded from totalPaidHours
        let absenceDeduction = 0;
        let lateDeduction = 0;
        if (emp.base_salary) {
          absenceDeduction = absenceDays > 0 ? absenceDays * hourlyRate * 8 : 0;
          lateDeduction = lateMinutes > 0 ? (lateMinutes / 60) * hourlyRate : 0;
        }
        const adjustedBaseSalary = Math.max(0, baseSalary - absenceDeduction - lateDeduction);

        // Get approved overtime for this period from hr_overtime_records (periods declared by manager)
        const overtime = await client.query(`
          SELECT
            COALESCE(SUM(CASE WHEN rate_type = 'normal' THEN actual_minutes ELSE 0 END), 0) / 60.0 as hours_25,
            COALESCE(SUM(CASE WHEN rate_type = 'extended' THEN actual_minutes ELSE 0 END), 0) / 60.0 as hours_50,
            COALESCE(SUM(CASE WHEN rate_type IN ('special', 'night', 'weekend', 'holiday') THEN actual_minutes ELSE 0 END), 0) / 60.0 as hours_100
          FROM hr_overtime_records
          WHERE employee_id = $1
          AND validated_for_payroll = true
          AND overtime_date BETWEEN $2 AND $3
        `, [emp.id, periodData.start_date, periodData.end_date]);

        const overtimeHours25 = parseFloat(overtime.rows[0]?.hours_25) || 0;
        const overtimeHours50 = parseFloat(overtime.rows[0]?.hours_50) || 0;
        const overtimeHours100 = parseFloat(overtime.rows[0]?.hours_100) || 0;

        const overtimeAmount =
          (overtimeHours25 * hourlyRate * (config.overtime_rate_25 || 1.25)) +
          (overtimeHours50 * hourlyRate * (config.overtime_rate_50 || 1.50)) +
          (overtimeHours100 * hourlyRate * (config.overtime_rate_100 || 2.00));

        // Calculate seniority bonus
        const hireDate = new Date(emp.hire_date);
        const yearsOfService = Math.floor((new Date() - hireDate) / (365.25 * 24 * 60 * 60 * 1000));
        let seniorityRate = 0;
        const seniorityBonusRates = config.seniority_bonus_rates || [];
        for (const bracket of seniorityBonusRates) {
          if (yearsOfService >= bracket.years) {
            seniorityRate = bracket.rate;
          }
        }
        const seniorityBonus = adjustedBaseSalary * (seniorityRate / 100);

        // Get enrollment bonuses for this period
        const enrollmentBonuses = await client.query(`
          SELECT
            COALESCE(SUM(f.prime_assistante), 0) as total,
            COUNT(*) as count
          FROM session_etudiants se
          JOIN sessions_formation sf ON sf.id = se.session_id
          JOIN formations f ON f.id = se.formation_id
          WHERE sf.segment_id = $1
            AND ($2::TEXT IS NULL OR sf.ville_id = $2::TEXT)
            AND COALESCE(se.date_inscription, se.created_at)::date >= $3
            AND COALESCE(se.date_inscription, se.created_at)::date <= $4
            AND COALESCE(f.prime_assistante, 0) > 0
            AND sf.statut != 'annulee'
            AND (sf.session_type != 'en_ligne' OR COALESCE(se.delivery_status, 'non_livree') = 'livree')
        `, [emp.segment_id, emp.ville_id, periodData.start_date, periodData.end_date]);

        const enrollmentBonusTotal = parseFloat(enrollmentBonuses.rows[0]?.total) || 0;
        const enrollmentBonusCount = parseInt(enrollmentBonuses.rows[0]?.count) || 0;

        // 🔍 LOG DÉTAILLÉ: Prime de rendement (inscriptions)
        console.log(`\n📊 [PAYROLL-CALC] Employé: ${emp.first_name} ${emp.last_name} (${emp.id})`);
        console.log(`   Segment ID: ${emp.segment_id}`);
        console.log(`   Ville ID: ${emp.ville_id}`);
        console.log(`   Période: ${periodData.start_date} → ${periodData.end_date}`);
        console.log(`   ✅ Primes inscription trouvées: ${enrollmentBonusCount} inscriptions = ${enrollmentBonusTotal.toFixed(2)} MAD`);

        // Gross salary (incluant primes inscription)
        const grossSalary = adjustedBaseSalary + overtimeAmount + seniorityBonus + enrollmentBonusTotal;

        // 🔍 LOG DÉTAILLÉ: Calcul salaire brut
        console.log(`   💰 Salaire base ajusté: ${adjustedBaseSalary.toFixed(2)} MAD`);
        console.log(`   ⏰ Heures sup: ${overtimeAmount.toFixed(2)} MAD`);
        console.log(`   📅 Prime ancienneté: ${seniorityBonus.toFixed(2)} MAD`);
        console.log(`   🎓 Primes inscription: ${enrollmentBonusTotal.toFixed(2)} MAD`);
        console.log(`   ➡️  SALAIRE BRUT TOTAL: ${grossSalary.toFixed(2)} MAD`);

        // Vérifier si l'employé est assujetti à la CNSS/AMO
        const isCnssSubject = emp.is_cnss_subject !== false; // true par défaut
        const isAmoSubject = emp.is_amo_subject !== false; // true par défaut

        // CNSS calculation (capped at 6000 MAD) - seulement si assujetti
        const cnssBase = Math.min(grossSalary, config.cnss_ceiling || 6000);
        let cnssEmployee = 0;
        let cnssEmployer = 0;
        if (isCnssSubject) {
          cnssEmployee = cnssBase * (config.cnss_employee_rate || 4.48) / 100;
          cnssEmployer = cnssBase * (config.cnss_employer_rate || 8.98) / 100;
        }

        // AMO calculation - seulement si assujetti
        const amoBase = grossSalary;
        let amoEmployee = 0;
        let amoEmployer = 0;
        if (isAmoSubject) {
          amoEmployee = amoBase * (config.amo_employee_rate || 2.26) / 100;
          amoEmployer = amoBase * (config.amo_employer_rate || 4.11) / 100;
        }

        // IGR calculation (simplified - annual then monthly)
        const annualGross = grossSalary * 12;
        const professionalExpenses = Math.min(
          annualGross * (config.igr_professional_expenses_rate || 20) / 100,
          config.igr_professional_expenses_cap || 30000
        );
        const annualCnss = cnssEmployee * 12;
        const annualAmo = amoEmployee * 12;
        const taxableIncome = annualGross - professionalExpenses - annualCnss - annualAmo;

        let annualIgr = 0;
        const igrBrackets = config.igr_brackets || [];
        for (const bracket of igrBrackets) {
          if (taxableIncome > bracket.min) {
            const max = bracket.max || Infinity;
            if (taxableIncome <= max) {
              annualIgr = (taxableIncome * bracket.rate / 100) - bracket.deduction;
              break;
            }
          }
        }
        const monthlyIgr = Math.max(0, annualIgr / 12);

        // Net salary
        const totalDeductions = cnssEmployee + amoEmployee + monthlyIgr;
        const netSalary = grossSalary - totalDeductions;

        // 🔍 LOG DÉTAILLÉ: Retenues et net
        console.log(`   🏦 CNSS employé: ${cnssEmployee.toFixed(2)} MAD (assujetti: ${isCnssSubject})`);
        console.log(`   🏥 AMO employé: ${amoEmployee.toFixed(2)} MAD (assujetti: ${isAmoSubject})`);
        console.log(`   💸 IGR: ${monthlyIgr.toFixed(2)} MAD`);
        console.log(`   ➖ Total retenues: ${totalDeductions.toFixed(2)} MAD`);
        console.log(`   ✅ SALAIRE NET: ${netSalary.toFixed(2)} MAD\n`);

        // Insert payslip
        const payslipResult = await client.query(`
          INSERT INTO hr_payslips (
            period_id, employee_id, employee_number, employee_name, position, department, hire_date,
            base_salary, hourly_rate, working_hours, worked_hours,
            overtime_hours_25, overtime_hours_50, overtime_hours_100, overtime_amount,
            absence_days, absence_deduction, late_minutes, late_deduction,
            gross_salary, gross_taxable,
            cnss_base, cnss_employee, cnss_employer, amo_base, amo_employee, amo_employer,
            igr_base, igr_amount, total_deductions, net_salary,
            status, generated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11,
            $12, $13, $14, $15,
            $16, $17, $18, $19,
            $20, $21,
            $22, $23, $24, $25, $26, $27,
            $28, $29, $30, $31,
            'calculated', NOW()
          ) RETURNING id
        `, [
          period_id, emp.id, emp.employee_number, `${emp.first_name} ${emp.last_name}`,
          emp.position, emp.department, emp.hire_date,
          adjustedBaseSalary, hourlyRate, config.working_hours_monthly || 191, totalPaidHours,
          overtimeHours25, overtimeHours50, overtimeHours100, overtimeAmount,
          absenceDays, absenceDeduction, lateMinutes, lateDeduction,
          grossSalary, taxableIncome / 12,
          cnssBase, cnssEmployee, cnssEmployer, amoBase, amoEmployee, amoEmployer,
          taxableIncome / 12, monthlyIgr, totalDeductions, netSalary
        ]);

        // Insert payslip lines
        const payslipId = payslipResult.rows[0].id;

        // Base salary line
        await client.query(`
          INSERT INTO hr_payslip_lines (payslip_id, line_type, category, code, label, amount, display_order)
          VALUES ($1, 'earning', 'base_salary', 'SAL_BASE', 'Salaire de base', $2, 1)
        `, [payslipId, adjustedBaseSalary]);

        // Seniority bonus line (if applicable)
        if (seniorityBonus > 0) {
          await client.query(`
            INSERT INTO hr_payslip_lines (payslip_id, line_type, category, code, label, quantity, rate, amount, display_order)
            VALUES ($1, 'earning', 'bonus', 'PRIME_ANC', 'Prime d''ancienneté', $2, $3, $4, 2)
          `, [payslipId, yearsOfService, seniorityRate, seniorityBonus]);
        }

        // Overtime line (if applicable)
        if (overtimeAmount > 0) {
          await client.query(`
            INSERT INTO hr_payslip_lines (payslip_id, line_type, category, code, label, quantity, rate, amount, display_order)
            VALUES ($1, 'earning', 'overtime', 'HS', 'Heures supplémentaires', $2, $3, $4, 3)
          `, [payslipId, overtimeHours25 + overtimeHours50 + overtimeHours100, hourlyRate, overtimeAmount]);
        }

        // Prime de rendement (enrollment bonus) line (if applicable)
        if (enrollmentBonusTotal > 0) {
          await client.query(`
            INSERT INTO hr_payslip_lines (payslip_id, line_type, category, code, label, quantity, amount, display_order)
            VALUES ($1, 'earning', 'commission', 'PRIME_REND', 'Prime de rendement', $2, $3, 4)
          `, [payslipId, enrollmentBonusCount, enrollmentBonusTotal]);

          // Marquer les primes comme payées
          await client.query(`
            UPDATE hr_enrollment_bonuses
            SET status = 'paid', paid_in_period_id = $1
            WHERE employee_id = $2 AND payroll_period_id = $1 AND status = 'validated'
          `, [period_id, emp.id]);
        }

        // Absence deduction line
        if (absenceDeduction > 0) {
          await client.query(`
            INSERT INTO hr_payslip_lines (payslip_id, line_type, category, code, label, quantity, rate, amount, display_order)
            VALUES ($1, 'deduction', 'other_deduction', 'ABSENCE', 'Déduction absences', $2, $3, $4, 13)
          `, [payslipId, absenceDays, hourlyRate * 8, absenceDeduction]);
        }

        // Late deduction line
        if (lateDeduction > 0) {
          await client.query(`
            INSERT INTO hr_payslip_lines (payslip_id, line_type, category, code, label, quantity, rate, amount, display_order)
            VALUES ($1, 'deduction', 'other_deduction', 'RETARD', 'Déduction retards', $2, $3, $4, 14)
          `, [payslipId, lateMinutes, hourlyRate / 60, lateDeduction]);
        }

        // CNSS line (only if subject to CNSS)
        if (isCnssSubject) {
          await client.query(`
            INSERT INTO hr_payslip_lines (payslip_id, line_type, category, code, label, base_amount, rate, amount, display_order)
            VALUES ($1, 'deduction', 'cnss', 'CNSS', 'CNSS Salarié', $2, $3, $4, 10)
          `, [payslipId, cnssBase, config.cnss_employee_rate || 4.48, cnssEmployee]);
        }

        // AMO line (only if subject to AMO)
        if (isAmoSubject) {
          await client.query(`
            INSERT INTO hr_payslip_lines (payslip_id, line_type, category, code, label, base_amount, rate, amount, display_order)
            VALUES ($1, 'deduction', 'amo', 'AMO', 'AMO Salarié', $2, $3, $4, 11)
          `, [payslipId, amoBase, config.amo_employee_rate || 2.26, amoEmployee]);
        }

        // IGR line
        await client.query(`
          INSERT INTO hr_payslip_lines (payslip_id, line_type, category, code, label, base_amount, amount, display_order)
          VALUES ($1, 'deduction', 'igr', 'IGR', 'Impôt sur le revenu', $2, $3, 12)
        `, [payslipId, taxableIncome / 12, monthlyIgr]);

        // Update totals
        totalGross += grossSalary;
        totalNet += netSalary;
        totalCnssEmployee += cnssEmployee;
        totalCnssEmployer += cnssEmployer;
        totalAmo += amoEmployee + amoEmployer;
        totalIgr += monthlyIgr;
      }

      // Update period with totals
      await client.query(`
        UPDATE hr_payroll_periods
        SET status = 'calculated',
            calculated_at = NOW(),
            total_employees = $1,
            total_gross = $2,
            total_net = $3,
            total_cnss_employee = $4,
            total_cnss_employer = $5,
            total_amo = $6,
            total_igr = $7
        WHERE id = $8
      `, [employees.rows.length, totalGross, totalNet, totalCnssEmployee, totalCnssEmployer, totalAmo, totalIgr, period_id]);

      // Audit log
      await client.query(`
        INSERT INTO hr_payroll_audit_logs (entity_type, entity_id, action, new_values, performed_by)
        VALUES ('period', $1, 'calculate', $2, $3)
      `, [period_id, JSON.stringify({
        employees: employees.rows.length,
        total_gross: totalGross,
        total_net: totalNet
      }), userId]);

      await client.query('COMMIT');

      res.json({
        success: true,
        data: {
          period_id,
          employees_selected: employee_ids?.length || 'all',
          employees_processed: employees.rows.length,
          total_gross: totalGross,
          total_net: totalNet,
          total_cnss_employee: totalCnssEmployee,
          total_cnss_employer: totalCnssEmployer,
          total_amo: totalAmo,
          total_igr: totalIgr
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error calculating payroll:', error);
      res.status(500).json({ success: false, error: error.message });
    } finally {
      client.release();
    }
  }
);

/**
 * Reset/Delete payroll calculations for a period
 * POST /api/hr/payroll/calculate/:period_id/reset
 */
router.post('/calculate/:period_id/reset',
  authenticateToken,
  requirePermission('hr.payroll.calculate'),
  async (req, res) => {
    const { period_id } = req.params;
    const userId = req.user.id;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // 1. Check period exists and is not closed
      const periodCheck = await client.query(
        'SELECT id, status, name FROM hr_payroll_periods WHERE id = $1',
        [period_id]
      );

      if (periodCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ success: false, error: 'Période non trouvée' });
      }

      const period = periodCheck.rows[0];

      if (period.status === 'closed') {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Impossible de supprimer les calculs d\'une période clôturée'
        });
      }

      // 2. Delete all payslip lines first (to avoid FK constraint issues)
      await client.query(`
        DELETE FROM hr_payslip_lines
        WHERE payslip_id IN (
          SELECT id FROM hr_payslips WHERE period_id = $1
        )
      `, [period_id]);

      // 3. Delete all payslips for this period
      const deleteResult = await client.query(
        'DELETE FROM hr_payslips WHERE period_id = $1',
        [period_id]
      );

      // 4. Reset period status and totals
      await client.query(`
        UPDATE hr_payroll_periods
        SET status = 'draft',
            calculated_at = NULL,
            total_employees = NULL,
            total_gross = NULL,
            total_net = NULL,
            total_cnss_employee = NULL,
            total_cnss_employer = NULL,
            total_amo = NULL,
            total_igr = NULL
        WHERE id = $1
      `, [period_id]);

      // 5. Audit log
      await client.query(`
        INSERT INTO hr_payroll_audit_logs (entity_type, entity_id, action, old_values, performed_by)
        VALUES ('period', $1, 'delete', $2, $3)
      `, [
        period_id,
        JSON.stringify({
          deleted_payslips: deleteResult.rowCount,
          period_name: period.name,
          action_detail: 'reset_calculations'
        }),
        userId
      ]);

      await client.query('COMMIT');

      res.json({
        success: true,
        message: `Calculs de paie supprimés pour la période ${period.name}`,
        deleted_payslips: deleteResult.rowCount
      });

    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error resetting payroll calculations:', error);
      res.status(500).json({ success: false, error: error.message });
    } finally {
      client.release();
    }
  }
);

// ===============================
// PAYSLIPS
// ===============================

/**
 * Get all payslips for a period
 */
router.get('/payslips',
  authenticateToken,
  requirePermission('hr.payroll.view_all_payslips'),
  async (req, res) => {
    const { period_id, employee_id, status } = req.query;

    try {
      let query = `
        SELECT ps.*
        FROM hr_payslips ps
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 1;

      if (period_id) {
        query += ` AND ps.period_id = $${paramCount}`;
        params.push(period_id);
        paramCount++;
      }

      if (employee_id) {
        query += ` AND ps.employee_id = $${paramCount}`;
        params.push(employee_id);
        paramCount++;
      }

      if (status) {
        query += ` AND ps.status = $${paramCount}`;
        params.push(status);
        paramCount++;
      }

      query += ' ORDER BY ps.employee_name';

      const result = await pool.query(query, params);

      // 🔍 LOG DÉTAILLÉ: API GET /payslips
      console.log(`\n📋 [API-GET-PAYSLIPS] Requête reçue`);
      console.log(`   Filtres: period_id=${period_id}, employee_id=${employee_id}, status=${status}`);
      console.log(`   Nombre de bulletins trouvés: ${result.rows.length}`);
      if (result.rows.length > 0) {
        result.rows.forEach((ps, idx) => {
          console.log(`   [${idx + 1}] ${ps.employee_name} - Brut: ${ps.gross_salary} MAD, Net: ${ps.net_salary} MAD, Statut: ${ps.status}`);
        });
      }
      console.log(`   ✅ Réponse envoyée au frontend\n`);

      res.json({ success: true, payslips: result.rows });
    } catch (error) {
      console.error('Error fetching payslips:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Get single payslip with lines
 */
router.get('/payslips/:id',
  authenticateToken,
  async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
      // Check permission: either view_all or own payslip
      const payslip = await pool.query(`
        SELECT ps.*, p.year, p.month, p.name as period_name,
          e.profile_id
        FROM hr_payslips ps
        JOIN hr_payroll_periods p ON p.id = ps.period_id
        JOIN hr_employees e ON e.id = ps.employee_id
        WHERE ps.id = $1
      `, [id]);

      if (payslip.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Payslip not found' });
      }

      // Check if user can view this payslip
      const isOwn = payslip.rows[0].profile_id === userId;
      // More flexible admin check (support multiple role names)
      const adminRoles = ['admin', 'administrator', 'administrateur', 'Admin', 'ADMIN'];
      const isAdmin = adminRoles.includes(req.user.role);

      if (!isOwn && !isAdmin) {
        // Check for view permission using role_permissions + permissions tables
        const hasPermission = await pool.query(`
          SELECT 1 FROM role_permissions rp
          JOIN permissions p ON p.id = rp.permission_id
          JOIN profiles pr ON pr.role_id = rp.role_id
          WHERE pr.id = $1
          AND p.code IN (
            'ressources_humaines.gestion_paie.bulletins.voir',
            'hr.payroll.view_all_payslips',
            'hr.payroll.view_page'
          )
        `, [userId]);

        if (hasPermission.rows.length === 0) {
          return res.status(403).json({ success: false, error: 'Access denied' });
        }
      }

      // Get payslip lines
      const lines = await pool.query(`
        SELECT * FROM hr_payslip_lines
        WHERE payslip_id = $1
        ORDER BY display_order, line_type
      `, [id]);

      // 🔍 LOG DÉTAILLÉ: API GET /payslips/:id
      console.log(`\n📄 [API-GET-PAYSLIP-DETAIL] ID: ${id}`);
      console.log(`   Employé: ${payslip.rows[0].employee_name}`);
      console.log(`   Brut: ${payslip.rows[0].gross_salary} MAD`);
      console.log(`   Net: ${payslip.rows[0].net_salary} MAD`);
      console.log(`   Lignes détail: ${lines.rows.length}`);
      lines.rows.forEach(line => {
        console.log(`     - ${line.label}: ${line.amount} MAD (${line.line_type})`);
      });
      console.log(`   ✅ Réponse envoyée\n`);

      // Audit log for viewing
      await pool.query(`
        INSERT INTO hr_payroll_audit_logs (entity_type, entity_id, action, performed_by)
        VALUES ('payslip', $1, 'view', $2)
      `, [id, userId]);

      res.json({
        success: true,
        payslip: {
          ...payslip.rows[0],
          lines: lines.rows
        }
      });
    } catch (error) {
      console.error('Error fetching payslip:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Download payslip PDF
 * GET /api/hr/payroll/payslips/:id/pdf
 */
router.get('/payslips/:id/pdf',
  authenticateToken,
  async (req, res) => {
    const { id } = req.params;
    const userId = req.user?.id;

    // 🔍 LOG IMMÉDIAT - Route PDF atteinte
    console.log(`\n🔴 [PDF-ROUTE-START] ==================`);
    console.log(`   Payslip ID: ${id}`);
    console.log(`   User: ${JSON.stringify(req.user)}`);
    console.log(`   Headers Auth: ${req.headers.authorization ? 'Present' : 'MISSING'}`);

    if (!req.user || !userId) {
      console.log(`   ❌ No user/userId - returning 403`);
      return res.status(403).json({ success: false, error: 'Not authenticated' });
    }

    try {
      // Vérifier accès (admin ou propriétaire)
      const payslip = await pool.query(`
        SELECT ps.*, e.profile_id, e.first_name, e.last_name
        FROM hr_payslips ps
        JOIN hr_employees e ON e.id = ps.employee_id
        WHERE ps.id = $1
      `, [id]);

      if (payslip.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Payslip not found' });
      }

      const payslipData = payslip.rows[0];

      // Check permission - admin or owner
      const isOwner = payslipData.profile_id === userId;
      // More flexible admin check (case insensitive, includes 'admin' anywhere)
      const userRole = req.user.role || '';
      const isAdmin = userRole.toLowerCase().includes('admin');

      // 🔍 LOG: Permission check for PDF download
      console.log(`\n📄 [PDF-DOWNLOAD] Payslip: ${id}`);
      console.log(`   User ID: ${userId}, Role: "${userRole}"`);
      console.log(`   isAdmin: ${isAdmin}, isOwner: ${isOwner}`);

      if (!isAdmin && !isOwner) {
        // Check for ANY payroll-related permission (very permissive)
        const hasPermission = await pool.query(`
          SELECT p.code FROM role_permissions rp
          JOIN permissions p ON p.id = rp.permission_id
          JOIN profiles pr ON pr.role_id = rp.role_id
          WHERE pr.id = $1
          AND (
            p.code LIKE '%paie%'
            OR p.code LIKE '%payroll%'
            OR p.code LIKE 'ressources_humaines.gestion_paie%'
            OR p.code LIKE 'hr.payroll%'
          )
          LIMIT 5
        `, [userId]);

        console.log(`   Payroll permissions found: ${hasPermission.rows.length > 0 ? hasPermission.rows.map(r => r.code).join(', ') : 'NONE'}`);

        if (hasPermission.rows.length === 0) {
          console.log(`   ❌ Access denied - no payroll permission found`);
          return res.status(403).json({ success: false, error: 'Access denied - no payroll permission' });
        }
        console.log(`   ✅ Access granted via permission: ${hasPermission.rows[0].code}`);
      } else {
        console.log(`   ✅ Access granted (admin: ${isAdmin}, owner: ${isOwner})`);
      }

      // Générer ou récupérer le PDF
      const uploadsDir = path.join(__dirname, '../../uploads/payslips');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const pdfFilename = `bulletin-${id}.pdf`;
      const pdfPath = path.join(uploadsDir, pdfFilename);

      // Si le fichier existe déjà et est récent, le retourner
      if (fs.existsSync(pdfPath)) {
        const stats = fs.statSync(pdfPath);
        const fileAge = Date.now() - stats.mtimeMs;
        // Si le fichier a moins de 24h, le retourner directement
        if (fileAge < 24 * 60 * 60 * 1000) {
          return res.download(pdfPath, `bulletin-${payslipData.first_name}-${payslipData.last_name}.pdf`);
        }
      }

      // Sinon, générer le PDF
      const { PayslipPDFGenerator } = await import('../services/payslipPDFGenerator.js');
      const generator = new PayslipPDFGenerator();
      await generator.generatePayslip(id, pdfPath);

      // Mettre à jour la base de données
      await pool.query(`
        UPDATE hr_payslips
        SET pdf_path = $1, pdf_generated_at = NOW()
        WHERE id = $2
      `, [pdfFilename, id]);

      // Audit log
      await pool.query(`
        INSERT INTO hr_payroll_audit_logs (entity_type, entity_id, action, performed_by)
        VALUES ('payslip', $1, 'download', $2)
      `, [id, userId]);

      // Télécharger
      res.download(pdfPath, `bulletin-${payslipData.first_name}-${payslipData.last_name}.pdf`);

    } catch (error) {
      console.error('Error generating payslip PDF:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Validate a payslip
 */
router.post('/payslips/:id/validate',
  authenticateToken,
  requirePermission('hr.payroll.validate'),
  async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
      const result = await pool.query(`
        UPDATE hr_payslips
        SET status = 'validated', validated_at = NOW(), validated_by = $1
        WHERE id = $2 AND status = 'calculated'
        RETURNING *
      `, [userId, id]);

      if (result.rows.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Payslip must be in calculated status to validate'
        });
      }

      // Check if all payslips for the period are validated
      const period = await pool.query(`
        SELECT period_id FROM hr_payslips WHERE id = $1
      `, [id]);

      const unvalidated = await pool.query(`
        SELECT COUNT(*) FROM hr_payslips
        WHERE period_id = $1 AND status != 'validated'
      `, [period.rows[0].period_id]);

      if (parseInt(unvalidated.rows[0].count) === 0) {
        await pool.query(`
          UPDATE hr_payroll_periods
          SET status = 'validated', validated_at = NOW(), validated_by = $1
          WHERE id = $2
        `, [userId, period.rows[0].period_id]);
      }

      // Audit log
      await pool.query(`
        INSERT INTO hr_payroll_audit_logs (entity_type, entity_id, action, performed_by)
        VALUES ('payslip', $1, 'validate', $2)
      `, [id, userId]);

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Error validating payslip:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Validate all payslips for a period
 */
router.post('/periods/:id/validate-all',
  authenticateToken,
  requirePermission('hr.payroll.validate'),
  async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;

    try {
      // Update all calculated payslips
      await pool.query(`
        UPDATE hr_payslips
        SET status = 'validated', validated_at = NOW(), validated_by = $1
        WHERE period_id = $2 AND status = 'calculated'
      `, [userId, id]);

      // Update period status
      await pool.query(`
        UPDATE hr_payroll_periods
        SET status = 'validated', validated_at = NOW(), validated_by = $1
        WHERE id = $2
      `, [userId, id]);

      // Audit log
      await pool.query(`
        INSERT INTO hr_payroll_audit_logs (entity_type, entity_id, action, performed_by)
        VALUES ('period', $1, 'validate', $2)
      `, [id, userId]);

      res.json({ success: true, message: 'All payslips validated' });
    } catch (error) {
      console.error('Error validating payslips:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ===============================
// CONFIGURATION
// ===============================

/**
 * Get payroll configuration
 */
router.get('/config',
  authenticateToken,
  requirePermission('hr.payroll.view_page'),
  async (req, res) => {
    const { category } = req.query;

    try {
      let query = 'SELECT * FROM hr_payroll_config WHERE is_active = true';
      const params = [];

      if (category) {
        query += ' AND category = $1';
        params.push(category);
      }

      query += ' ORDER BY category, config_key';

      const result = await pool.query(query, params);

      // Parse JSON values
      const config = result.rows.map(row => ({
        ...row,
        parsed_value: row.config_type === 'json' ? JSON.parse(row.config_value) :
          row.config_type === 'number' ? parseFloat(row.config_value) :
            row.config_type === 'boolean' ? row.config_value === 'true' :
              row.config_value
      }));

      res.json({ success: true, data: config });
    } catch (error) {
      console.error('Error fetching payroll config:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Update payroll configuration
 */
router.put('/config/:key',
  authenticateToken,
  requirePermission('hr.payroll.config'),
  async (req, res) => {
    const { key } = req.params;
    const { value } = req.body;
    const userId = req.user.id;

    try {
      // Get current value for audit
      const current = await pool.query(
        'SELECT * FROM hr_payroll_config WHERE config_key = $1',
        [key]
      );

      if (current.rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Config key not found' });
      }

      // Update config
      const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      const result = await pool.query(`
        UPDATE hr_payroll_config
        SET config_value = $1, updated_by = $2, updated_at = NOW()
        WHERE config_key = $3
        RETURNING *
      `, [stringValue, userId, key]);

      // Audit log
      await pool.query(`
        INSERT INTO hr_payroll_audit_logs (entity_type, entity_id, action, old_values, new_values, performed_by)
        VALUES ('config', $1, 'update', $2, $3, $4)
      `, [current.rows[0].id, JSON.stringify({ value: current.rows[0].config_value }), JSON.stringify({ value: stringValue }), userId]);

      res.json({ success: true, data: result.rows[0] });
    } catch (error) {
      console.error('Error updating payroll config:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ===============================
// EXPORTS
// ===============================

/**
 * Export CNSS declaration
 */
router.get('/export/cnss/:period_id',
  authenticateToken,
  requirePermission('hr.payroll.export'),
  async (req, res) => {
    const { period_id } = req.params;
    const userId = req.user.id;

    try {
      // Exclure les employés non assujettis à la CNSS
      const payslips = await pool.query(`
        SELECT
          ps.employee_number,
          ps.employee_name,
          e.cin,
          e.cnss_number,
          ps.cnss_base,
          ps.cnss_employee,
          ps.cnss_employer
        FROM hr_payslips ps
        JOIN hr_employees e ON e.id = ps.employee_id
        WHERE ps.period_id = $1
        AND e.is_cnss_subject = true
        AND ps.cnss_employee > 0
        ORDER BY ps.employee_name
      `, [period_id]);

      // Audit log
      await pool.query(`
        INSERT INTO hr_payroll_audit_logs (entity_type, entity_id, action, performed_by)
        VALUES ('period', $1, 'export', $2)
      `, [period_id, userId]);

      res.json({
        success: true,
        data: payslips.rows,
        totals: {
          total_cnss_base: payslips.rows.reduce((sum, p) => sum + parseFloat(p.cnss_base || 0), 0),
          total_cnss_employee: payslips.rows.reduce((sum, p) => sum + parseFloat(p.cnss_employee || 0), 0),
          total_cnss_employer: payslips.rows.reduce((sum, p) => sum + parseFloat(p.cnss_employer || 0), 0)
        }
      });
    } catch (error) {
      console.error('Error exporting CNSS:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

/**
 * Export bank transfer file
 */
router.get('/export/bank/:period_id',
  authenticateToken,
  requirePermission('hr.payroll.export'),
  async (req, res) => {
    const { period_id } = req.params;
    const userId = req.user.id;

    try {
      const payslips = await pool.query(`
        SELECT
          ps.employee_number,
          ps.employee_name,
          e.rib,
          e.bank_name,
          ps.net_salary
        FROM hr_payslips ps
        JOIN hr_employees e ON e.id = ps.employee_id
        WHERE ps.period_id = $1 AND ps.status = 'validated'
        ORDER BY ps.employee_name
      `, [period_id]);

      // Audit log
      await pool.query(`
        INSERT INTO hr_payroll_audit_logs (entity_type, entity_id, action, performed_by)
        VALUES ('period', $1, 'export', $2)
      `, [period_id, userId]);

      res.json({
        success: true,
        data: payslips.rows,
        total_amount: payslips.rows.reduce((sum, p) => sum + parseFloat(p.net_salary || 0), 0)
      });
    } catch (error) {
      console.error('Error exporting bank file:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// ===============================
// AUDIT LOGS
// ===============================

/**
 * Get payroll audit logs
 */
router.get('/logs',
  authenticateToken,
  requirePermission('hr.payroll.view_page'),
  async (req, res) => {
    const { entity_type, entity_id, limit = 50 } = req.query;

    try {
      let query = `
        SELECT l.*, p.full_name as performed_by_name
        FROM hr_payroll_audit_logs l
        LEFT JOIN profiles p ON p.id = l.performed_by
        WHERE 1=1
      `;
      const params = [];
      let paramCount = 1;

      if (entity_type) {
        query += ` AND l.entity_type = $${paramCount}`;
        params.push(entity_type);
        paramCount++;
      }

      if (entity_id) {
        query += ` AND l.entity_id = $${paramCount}`;
        params.push(entity_id);
        paramCount++;
      }

      query += ` ORDER BY l.performed_at DESC LIMIT $${paramCount}`;
      params.push(parseInt(limit));

      const result = await pool.query(query, params);
      res.json({ success: true, data: result.rows });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

export default router;
