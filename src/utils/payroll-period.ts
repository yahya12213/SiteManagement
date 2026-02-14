import { subMonths } from 'date-fns';

export const PAYROLL_CUTOFF_DAY = 18;

/**
 * Calcule la période de paie pour un mois donné
 * Exemple avec cutoffDay = 18:
 * - Paie janvier 2026 = 19/12/2025 au 18/01/2026
 * - Paie février 2026 = 19/01/2026 au 18/02/2026
 * @param month Date du mois pour lequel calculer la période
 * @param cutoffDay Jour de coupure (par défaut 18)
 * @returns Objet avec les dates de début et fin de la période
 */
export function getPayrollPeriod(
  month: Date,
  cutoffDay: number = PAYROLL_CUTOFF_DAY
): { start: Date; end: Date } {
  const year = month.getFullYear();
  const monthIndex = month.getMonth(); // 0-indexed

  // Date de fin = jour de coupure du mois sélectionné
  const endDate = new Date(year, monthIndex, cutoffDay);

  // Date de début = jour après coupure du mois précédent
  const prevMonth = subMonths(month, 1);
  const startDate = new Date(
    prevMonth.getFullYear(),
    prevMonth.getMonth(),
    cutoffDay + 1
  );

  return { start: startDate, end: endDate };
}

/**
 * Formate la période de paie pour affichage
 * Exemple: "Paie janvier 2026 (19/12/2025 - 18/01/2026)"
 * @param month Date du mois à formater
 * @param locale Locale pour le formatage (par défaut 'fr-FR')
 * @returns Chaîne formatée représentant la période
 */
export function formatPayrollPeriod(month: Date, locale: string = 'fr-FR'): string {
  const period = getPayrollPeriod(month);
  const monthName = month.toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric'
  });
  const startStr = period.start.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  const endStr = period.end.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  return `Paie ${monthName} (${startStr} - ${endStr})`;
}
