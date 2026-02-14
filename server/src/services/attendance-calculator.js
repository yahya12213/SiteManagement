/**
 * AttendanceCalculator - Service centralisé pour TOUS les calculs de temps
 *
 * Principe: Le frontend NE FAIT JAMAIS de calculs.
 * Tout est calculé ici et renvoyé pré-calculé.
 *
 * Utilise NOW() PostgreSQL uniquement - pas de décalage configurable.
 */

export class AttendanceCalculator {
  constructor(pool) {
    this.pool = pool;
  }

  /**
   * Obtenir l'horaire applicable pour un employé à une date donnée
   * @param {string} employeeId - UUID de l'employé
   * @param {string} date - Date au format YYYY-MM-DD
   * @returns {Object|null} Schedule object ou null
   */
  async getScheduleForDate(employeeId, date) {
    try {
      const result = await this.pool.query(`
        WITH employee_schedule AS (
          SELECT ws.*
          FROM hr_employee_schedules es
          JOIN hr_work_schedules ws ON es.schedule_id = ws.id
          WHERE es.employee_id = $1
            AND es.start_date <= $2
            AND (es.end_date IS NULL OR es.end_date >= $2)
            AND ws.is_active = true
          ORDER BY es.start_date DESC
          LIMIT 1
        ),
        default_schedule AS (
          SELECT * FROM hr_work_schedules
          WHERE is_default = true AND is_active = true
          LIMIT 1
        )
        SELECT * FROM employee_schedule
        UNION ALL
        SELECT * FROM default_schedule
        WHERE NOT EXISTS (SELECT 1 FROM employee_schedule)
        LIMIT 1
      `, [employeeId, date]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('[AttendanceCalculator] Error getting schedule:', error.message);
      return null;
    }
  }

  /**
   * Obtenir les horaires prévus pour un jour spécifique
   * @param {Object} schedule - Objet schedule
   * @param {string} date - Date au format YYYY-MM-DD
   * @returns {Object} { isWorkingDay, scheduledStart, scheduledEnd }
   */
  getScheduledTimesForDate(schedule, date) {
    if (!schedule) {
      return { isWorkingDay: false, scheduledStart: null, scheduledEnd: null };
    }

    const dateObj = new Date(date);
    const dayOfWeek = dateObj.getDay(); // 0=Dimanche, 1=Lundi, ..., 6=Samedi
    const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek; // 1=Lundi, 7=Dimanche

    const isWorkingDay = schedule.working_days?.includes(isoDay) ?? false;

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayName = dayNames[dayOfWeek];

    // Essayer d'abord les horaires spécifiques au jour
    let startTime = schedule[`${dayName}_start`];
    let endTime = schedule[`${dayName}_end`];

    // Fallback: utiliser les horaires par défaut du modèle si les horaires du jour sont NULL
    if (!startTime || !endTime) {
      startTime = schedule.start_time;
      endTime = schedule.end_time;
    }

    // Si toujours pas d'horaires, ce n'est pas un jour ouvrable
    if (!startTime || !endTime) {
      return { isWorkingDay: false, scheduledStart: null, scheduledEnd: null };
    }

    return { isWorkingDay, scheduledStart: startTime, scheduledEnd: endTime };
  }

  /**
   * Vérifier si une date est un jour férié
   * @param {string} date - Date au format YYYY-MM-DD
   * @returns {Object|null} Holiday info ou null
   */
  async isHoliday(date) {
    try {
      const result = await this.pool.query(`
        SELECT id, name, holiday_date
        FROM hr_public_holidays
        WHERE holiday_date = $1
        LIMIT 1
      `, [date]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('[AttendanceCalculator] Error checking holiday:', error.message);
      return null;
    }
  }

  /**
   * Vérifier si une date est un jour de récupération pour un employé
   * @param {string} employeeId - UUID de l'employé
   * @param {string} date - Date au format YYYY-MM-DD
   * @returns {Object|null} Recovery info ou null
   */
  async getRecoveryInfo(employeeId, date) {
    try {
      // Get employee details for filtering
      const empResult = await this.pool.query(`
        SELECT department, segment_id, centre_id FROM hr_employees WHERE id = $1
      `, [employeeId]);

      if (empResult.rows.length === 0) return null;
      const emp = empResult.rows[0];

      // Check for recovery declaration
      const result = await this.pool.query(`
        SELECT
          rd.id, rd.recovery_date, rd.is_day_off, rd.hours_to_recover,
          rp.name as period_name, rp.applies_to_all
        FROM hr_recovery_declarations rd
        JOIN hr_recovery_periods rp ON rd.recovery_period_id = rp.id
        WHERE rd.recovery_date = $1
          AND rd.status = 'active'
          AND rp.status = 'active'
          AND (
            rp.applies_to_all = true
            OR (rd.department_id = $2 OR rd.department_id IS NULL)
            OR (rd.segment_id = $3 OR rd.segment_id IS NULL)
            OR (rd.centre_id = $4 OR rd.centre_id IS NULL)
          )
        LIMIT 1
      `, [date, emp.department, emp.segment_id, emp.centre_id]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('[AttendanceCalculator] Error checking recovery:', error.message);
      return null;
    }
  }

  /**
   * Vérifier si l'employé a un congé approuvé pour cette date
   * @param {string} employeeId - UUID de l'employé
   * @param {string} date - Date au format YYYY-MM-DD
   * @returns {Object|null} Leave info ou null
   */
  async getApprovedLeave(employeeId, date) {
    try {
      const result = await this.pool.query(`
        SELECT lr.*, lt.name as leave_type_name, lt.code as leave_type_code
        FROM hr_leave_requests lr
        JOIN hr_leave_types lt ON lr.leave_type_id = lt.id
        WHERE lr.employee_id = $1
          AND lr.status = 'approved'
          AND $2 BETWEEN lr.start_date AND lr.end_date
        LIMIT 1
      `, [employeeId, date]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('[AttendanceCalculator] Error checking leave:', error.message);
      return null;
    }
  }

  /**
   * Vérifier si l'employé a des heures supplémentaires approuvées pour cette date
   * @param {string} employeeId - UUID de l'employé
   * @param {string} date - Date au format YYYY-MM-DD
   * @returns {Object|null} Overtime info ou null
   */
  async hasApprovedOvertime(employeeId, date) {
    try {
      const result = await this.pool.query(`
        SELECT id, estimated_hours
        FROM hr_overtime_requests
        WHERE employee_id = $1
          AND request_date = $2
          AND status = 'approved'
        LIMIT 1
      `, [employeeId, date]);
      return result.rows[0] || null;
    } catch (error) {
      console.error('[AttendanceCalculator] Error checking overtime:', error.message);
      return null;
    }
  }

  /**
   * Obtenir les périodes d'heures supplémentaires déclarées pour un employé à une date
   * (Déclarées par l'admin via hr_overtime_periods et hr_overtime_period_employees)
   * @param {string} employeeId - UUID de l'employé
   * @param {string} date - Date au format YYYY-MM-DD
   * @returns {Array} Liste des périodes HS
   */
  async getOvertimePeriodsForEmployee(employeeId, date) {
    try {
      const result = await this.pool.query(`
        SELECT op.id, op.period_date, op.start_time, op.end_time, op.rate_type, op.reason
        FROM hr_overtime_periods op
        JOIN hr_overtime_period_employees ope ON ope.period_id = op.id
        WHERE ope.employee_id = $1
          AND op.period_date = $2
          AND op.status = 'active'
      `, [employeeId, date]);
      return result.rows;
    } catch (error) {
      console.error('[AttendanceCalculator] Error getting overtime periods:', error.message);
      return [];
    }
  }

  /**
   * Calculer l'intersection (chevauchement) entre le pointage et une période
   * @param {number} clockInMinutes - Minutes depuis minuit du clock-in
   * @param {number} clockOutMinutes - Minutes depuis minuit du clock-out
   * @param {string} periodStart - Heure de début de la période (HH:MM)
   * @param {string} periodEnd - Heure de fin de la période (HH:MM)
   * @returns {number} Minutes de chevauchement
   */
  calculateOverlap(clockInMinutes, clockOutMinutes, periodStart, periodEnd) {
    const periodStartMinutes = this.timeToMinutes(periodStart);
    const periodEndMinutes = this.timeToMinutes(periodEnd);

    if (periodStartMinutes === null || periodEndMinutes === null) return 0;
    if (clockInMinutes === null || clockOutMinutes === null) return 0;

    const overlapStart = Math.max(periodStartMinutes, clockInMinutes);
    const overlapEnd = Math.min(periodEndMinutes, clockOutMinutes);

    return overlapEnd > overlapStart ? overlapEnd - overlapStart : 0;
  }

  /**
   * Convertir une chaîne de temps "HH:MM" en minutes depuis minuit
   */
  timeToMinutes(timeStr) {
    if (!timeStr) return null;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Convertir un timestamp en minutes depuis minuit
   *
   * SIMPLE: Le backend génère déjà les timestamps avec timezone Maroc (+01:00)
   * Ex: "2026-01-27T20:00:00+01:00"
   * On extrait directement "20:00" de la string - c'est déjà l'heure locale!
   * Pas besoin de conversion UTC → local.
   */
  timestampToMinutes(timestamp) {
    if (!timestamp) return null;

    // Convertir en string si c'est un objet Date
    const str = typeof timestamp === 'string' ? timestamp : timestamp.toISOString();

    // Extraire HH:MM directement de la string
    // Fonctionne avec: "2026-01-27T20:00:00+01:00", "20:00:00", "20:00"
    const match = str.match(/(\d{2}):(\d{2})/);
    if (!match) return null;

    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    return hours * 60 + minutes;
  }

  /**
   * CALCUL PRINCIPAL: Déterminer le statut et les minutes
   *
   * Priorités:
   * 1. Jour férié → 'holiday'
   * 2. Congé approuvé → 'leave'
   * 3. Récupération jour off → 'recovery_off'
   * 4. Weekend → 'weekend'
   * 5. Pas de pointage → 'absent'
   * 6. Calculs: retard, départ anticipé, heures sup
   * 7. Statut final: 'present', 'late', 'partial', 'early_leave'
   *
   * @param {string} employeeId - UUID de l'employé
   * @param {string} date - Date au format YYYY-MM-DD
   * @param {Date|string|null} clockIn - Timestamp d'entrée
   * @param {Date|string|null} clockOut - Timestamp de sortie
   * @returns {Object} Résultat du calcul
   */
  async calculateDayStatus(employeeId, date, clockIn, clockOut) {
    const result = {
      day_status: 'pending',
      scheduled_start: null,
      scheduled_end: null,
      scheduled_break_minutes: 0,
      gross_worked_minutes: null,
      net_worked_minutes: null,
      late_minutes: 0,
      early_leave_minutes: 0,
      overtime_minutes: 0,
      overtime_rate_type: null,
      overtime_periods: null,
      notes: null,
      special_day: null,
      is_working_day: true // Par défaut, jour ouvrable
    };

    // Get schedule
    const schedule = await this.getScheduleForDate(employeeId, date);
    const scheduledTimes = this.getScheduledTimesForDate(schedule, date);

    // Stocker si c'est un jour ouvrable selon le modèle horaire
    // Important pour le calcul de paie des fériés/récupérations
    result.is_working_day = scheduledTimes.isWorkingDay;

    if (schedule) {
      result.scheduled_start = scheduledTimes.scheduledStart;
      result.scheduled_end = scheduledTimes.scheduledEnd;
      result.scheduled_break_minutes = schedule.break_duration_minutes || 0;
    }

    // Récupérer les informations de jour férié et récupération en parallèle
    console.log('[Calculator] Checking holiday and recovery for', employeeId, date);
    const holiday = await this.isHoliday(date);
    const recovery = await this.getRecoveryInfo(employeeId, date);
    console.log('[Calculator] Holiday:', holiday ? holiday.name : 'none', '| Recovery:', recovery ? `${recovery.period_name} (is_day_off=${recovery.is_day_off})` : 'none');

    // Variable pour stocker le statut de récupération (sera restauré à la fin)
    let isRecoveryWorkDay = false;
    let recoveryStatus = null;
    let recoveryNotes = null;
    let recoverySpecialDay = null;

    // PRIORITÉ 1: Récupération où l'employé DOIT travailler
    // Un seul statut 'recovery' - pas de paie même si jour férié (le salarié "rembourse")
    if (recovery && !recovery.is_day_off) {
      isRecoveryWorkDay = true;
      // Jour de récupération où l'employé doit travailler → PAS DE PAIE
      recoveryStatus = 'recovery';
      if (holiday) {
        // Récupération sur jour férié - noter l'info mais même traitement (pas de paie)
        recoveryNotes = `Récupération (jour férié ${holiday.name}): ${recovery.period_name}`;
        recoverySpecialDay = { type: 'recovery', name: recovery.period_name, isHoliday: true, holidayName: holiday.name };
      } else {
        // Récupération sur jour normal
        recoveryNotes = `Récupération: ${recovery.period_name}`;
        recoverySpecialDay = { type: 'recovery', name: recovery.period_name, isHoliday: false };
      }
      // NE PAS return ici - continuer le calcul des heures travaillées
      // Le statut sera restauré à la fin après le calcul des heures
    }

    // PRIORITÉ 2: Récupération jour off (l'employé ne travaille pas - jour offert à récupérer plus tard)
    if (recovery && recovery.is_day_off) {
      result.day_status = 'recovery_off';

      // Calculer les heures prévues depuis le planning de l'employé
      let scheduledHours = 8; // Défaut si pas de planning
      if (result.scheduled_start && result.scheduled_end) {
        const startMinutes = this.timeToMinutes(result.scheduled_start);
        const endMinutes = this.timeToMinutes(result.scheduled_end);
        const breakMinutes = result.scheduled_break_minutes || 0;
        if (startMinutes !== null && endMinutes !== null) {
          scheduledHours = Math.round((endMinutes - startMinutes - breakMinutes) / 60);
        }
      }

      result.hours_to_recover = scheduledHours;
      result.notes = `Jour off donné: ${recovery.period_name} - ${scheduledHours}h à récupérer`;
      result.special_day = {
        type: 'recovery_off',
        name: recovery.period_name,
        is_day_off: true,
        hours_to_recover: scheduledHours
      };
      return result;
    }

    // PRIORITÉ 3: Jour férié (sans récupération)
    if (holiday && !recovery) {
      // Vérifier si période HS pour ce jour férié (permet de travailler les jours fériés)
      const overtimePeriodsForHoliday = await this.getOvertimePeriodsForEmployee(employeeId, date);
      if (overtimePeriodsForHoliday.length > 0) {
        // C'est un jour férié MAIS avec heures sup déclarées → continuer le calcul
        result.special_day = { type: 'holiday_overtime', name: holiday.name };
        result.notes = `Jour férié (HS): ${holiday.name}`;
        // Ne PAS return, continuer pour calculer les heures sup
      } else {
        result.day_status = 'holiday';
        result.notes = `Jour férié: ${holiday.name}`;
        result.special_day = { type: 'holiday', name: holiday.name };
        return result;
      }
    }

    // PRIORITÉ 4: Congé approuvé
    const leave = await this.getApprovedLeave(employeeId, date);
    if (leave) {
      // Mapper le type de congé au statut approprié
      const leaveCode = leave.leave_type_code?.toLowerCase();
      if (leaveCode === 'sick' || leaveCode === 'maladie') {
        result.day_status = 'sick';
      } else if (leaveCode === 'mission') {
        result.day_status = 'mission';
      } else if (leaveCode === 'training' || leaveCode === 'formation') {
        result.day_status = 'training';
      } else {
        result.day_status = 'leave';
      }
      result.notes = `Congé: ${leave.leave_type_name}`;
      result.special_day = { type: 'leave', name: leave.leave_type_name };
      return result;
    }

    // PRIORITÉ 4: Weekend (pas un jour ouvrable)
    // BUG #6 FIX: Check weekend even without schedule by checking day of week directly
    const dayOfWeek = new Date(date).getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekendDay = (dayOfWeek === 0 || dayOfWeek === 6);

    if (schedule && !scheduledTimes.isWorkingDay) {
      result.day_status = 'weekend';
      return result;
    }

    // BUG #6 FIX: If no schedule assigned, use default weekend (Saturday/Sunday)
    if (!schedule && isWeekendDay) {
      result.day_status = 'weekend';
      result.notes = 'Weekend (horaire par défaut)';
      return result;
    }

    // PRIORITÉ 5: Pas de pointage
    if (!clockIn) {
      // BUG #6 FIX: Don't mark as absent on weekend without schedule
      if (isWeekendDay) {
        result.day_status = 'weekend';
        result.notes = 'Weekend (sans horaire assigné)';
        return result;
      }
      result.day_status = 'absent';
      result.is_anomaly = true;
      return result;
    }

    // =====================================================
    // CALCULS avec pointage
    // =====================================================

    const clockInMinutes = this.timestampToMinutes(clockIn);
    const scheduledStartMinutes = this.timeToMinutes(result.scheduled_start);
    const scheduledEndMinutes = this.timeToMinutes(result.scheduled_end);
    // BUG #12 FIX: Use reasonable default tolerance (15 min) when schedule is null
    const DEFAULT_TOLERANCE_MINUTES = 15;
    const toleranceLate = schedule?.tolerance_late_minutes ?? DEFAULT_TOLERANCE_MINUTES;
    const toleranceEarlyLeave = schedule?.tolerance_early_leave_minutes ?? DEFAULT_TOLERANCE_MINUTES;

    // Calculer le retard
    if (scheduledStartMinutes !== null && clockInMinutes !== null) {
      const diff = clockInMinutes - scheduledStartMinutes;
      if (diff > toleranceLate) {
        result.late_minutes = diff;
      }
    }

    // Si pas de sortie, statut pending
    if (!clockOut) {
      result.day_status = clockInMinutes !== null && result.late_minutes > 0 ? 'late' : 'pending';
      return result;
    }

    // Calculs avec sortie
    const clockOutMinutes = this.timestampToMinutes(clockOut);

    // Temps brut travaillé - PLAFONNÉ aux horaires du modèle
    // Règle métier: Ne pas compter les arrivées avant l'heure ni les départs après l'heure
    // Les heures hors planning ne comptent que si heures supplémentaires approuvées
    if (clockInMinutes !== null && clockOutMinutes !== null) {
      // Calculer le temps effectif DANS la plage horaire du modèle
      let effectiveStartMinutes = clockInMinutes;
      let effectiveEndMinutes = clockOutMinutes;

      // Si horaires planifiés disponibles, plafonner aux limites
      if (scheduledStartMinutes !== null) {
        // Ne pas compter le temps avant l'heure de début prévue
        effectiveStartMinutes = Math.max(clockInMinutes, scheduledStartMinutes);
      }
      if (scheduledEndMinutes !== null) {
        // Ne pas compter le temps après l'heure de fin prévue (sauf heures sup)
        // Les heures sup seront ajoutées séparément si approuvées
        effectiveEndMinutes = Math.min(clockOutMinutes, scheduledEndMinutes);
      }

      // Temps brut = temps effectif dans la plage horaire
      result.gross_worked_minutes = Math.max(0, effectiveEndMinutes - effectiveStartMinutes);

      // Stocker les temps effectifs pour référence
      result.effective_start_minutes = effectiveStartMinutes;
      result.effective_end_minutes = effectiveEndMinutes;
      result.early_arrival_minutes = scheduledStartMinutes !== null
        ? Math.max(0, scheduledStartMinutes - clockInMinutes)
        : 0;

      // BUG #5 FIX: Only deduct break if employee worked long enough to have taken one
      // Minimum 4 hours of work required before deducting break (reasonable threshold)
      const MIN_HOURS_FOR_BREAK_DEDUCTION = 240; // 4 hours in minutes
      const breakDeduction = result.gross_worked_minutes >= MIN_HOURS_FOR_BREAK_DEDUCTION
        ? result.scheduled_break_minutes
        : 0;
      result.net_worked_minutes = Math.max(0, result.gross_worked_minutes - breakDeduction);
      result.break_deducted = breakDeduction > 0;
    }

    // Calculer le départ anticipé
    if (scheduledEndMinutes !== null && clockOutMinutes !== null) {
      const diff = scheduledEndMinutes - clockOutMinutes;
      if (diff > toleranceEarlyLeave) {
        result.early_leave_minutes = diff;
      }
    }

    // Calculer les heures supplémentaires (seulement si approuvées via hr_overtime_requests)
    const overtime = await this.hasApprovedOvertime(employeeId, date);
    if (overtime && scheduledEndMinutes !== null && clockOutMinutes !== null) {
      if (clockOutMinutes > scheduledEndMinutes) {
        const maxOvertimeMinutes = (overtime.estimated_hours || 0) * 60;
        result.overtime_minutes = Math.min(clockOutMinutes - scheduledEndMinutes, maxOvertimeMinutes);
      }
    }

    // NOUVEAU: Vérifier les périodes HS déclarées par admin (hr_overtime_periods)
    const overtimePeriods = await this.getOvertimePeriodsForEmployee(employeeId, date);
    if (overtimePeriods.length > 0 && clockInMinutes !== null && clockOutMinutes !== null) {
      let totalOvertimeFromPeriods = 0;
      let overtimeRateType = null;

      for (const period of overtimePeriods) {
        const overlap = this.calculateOverlap(clockInMinutes, clockOutMinutes, period.start_time, period.end_time);
        if (overlap > 0) {
          totalOvertimeFromPeriods += overlap;
          // Prendre le taux le plus avantageux (special > extended > normal)
          if (!overtimeRateType ||
              (period.rate_type === 'special') ||
              (period.rate_type === 'extended' && overtimeRateType === 'normal')) {
            overtimeRateType = period.rate_type;
          }
        }
      }

      // Si des heures sup calculées depuis les périodes déclarées
      if (totalOvertimeFromPeriods > 0) {
        result.overtime_minutes = Math.max(result.overtime_minutes, totalOvertimeFromPeriods);
        result.overtime_rate_type = overtimeRateType;
        result.overtime_periods = overtimePeriods;
      }
    }

    // Déterminer le statut final
    // PRIORITÉ: Si heures sup déclarées via période admin → statut 'overtime'
    if (result.overtime_minutes > 0 && result.overtime_periods && result.overtime_periods.length > 0) {
      result.day_status = 'overtime';
    } else if (result.late_minutes > 0 && result.early_leave_minutes > 0) {
      result.day_status = 'partial';
    } else if (result.late_minutes > 0) {
      result.day_status = 'late';
    } else if (result.early_leave_minutes > 0) {
      result.day_status = 'early_leave';
    } else {
      // Vérifier si temps suffisant pour "present" vs "partial"
      if (scheduledStartMinutes !== null && scheduledEndMinutes !== null) {
        const scheduledMinutes = scheduledEndMinutes - scheduledStartMinutes - result.scheduled_break_minutes;
        if (result.net_worked_minutes >= scheduledMinutes * 0.9) {
          result.day_status = 'present';
        } else {
          result.day_status = 'partial';
        }
      } else {
        result.day_status = 'present';
      }
    }

    // RESTAURATION FINALE: Si c'est un jour de récupération avec travail,
    // utiliser le statut recovery_paid/recovery_unpaid au lieu de present/late/etc.
    // Les heures ont été calculées, mais le statut doit refléter la récupération
    if (isRecoveryWorkDay && recoveryStatus) {
      result.day_status = recoveryStatus;
      result.notes = recoveryNotes;
      result.special_day = recoverySpecialDay;
    }

    return result;
  }

  /**
   * Obtenir les informations complètes pour un employé à une date
   * (utile pour l'affichage frontend)
   */
  async getDayInfo(employeeId, date) {
    const schedule = await this.getScheduleForDate(employeeId, date);
    const holiday = await this.isHoliday(date);
    const leave = await this.getApprovedLeave(employeeId, date);
    const recovery = await this.getRecoveryInfo(employeeId, date);
    const overtime = await this.hasApprovedOvertime(employeeId, date);

    const scheduledTimes = schedule ? this.getScheduledTimesForDate(schedule, date) : null;

    return {
      date,
      schedule: schedule ? {
        name: schedule.name,
        scheduled_start: scheduledTimes?.scheduledStart,
        scheduled_end: scheduledTimes?.scheduledEnd,
        break_duration_minutes: schedule.break_duration_minutes,
        is_working_day: scheduledTimes?.isWorkingDay,
        tolerance_late_minutes: schedule.tolerance_late_minutes,
        tolerance_early_leave_minutes: schedule.tolerance_early_leave_minutes
      } : null,
      holiday: holiday ? { name: holiday.name } : null,
      leave: leave ? { type: leave.leave_type_name, code: leave.leave_type_code } : null,
      recovery: recovery ? { name: recovery.period_name, is_day_off: recovery.is_day_off } : null,
      overtime_approved: overtime ? { hours: overtime.estimated_hours } : null
    };
  }
}

// Export singleton factory
let instance = null;

export function getAttendanceCalculator(pool) {
  if (!instance) {
    instance = new AttendanceCalculator(pool);
  }
  return instance;
}

export default AttendanceCalculator;
