/**
 * Utilitaire pour calculer les jours ouvrables
 * Exclut les samedis, dimanches et jours fériés
 */

/**
 * Calcule le nombre de jours ouvrables entre deux dates
 * Exclut les samedis, dimanches et jours fériés
 *
 * @param {Date} startDate - Date de début (incluse)
 * @param {Date} endDate - Date de fin (incluse)
 * @param {Date[]} publicHolidays - Tableau de dates de jours fériés
 * @returns {number} Nombre de jours ouvrables
 */
function calculateWorkingDays(startDate, endDate, publicHolidays = []) {
  if (!startDate || !endDate) return 0;
  if (endDate < startDate) return 0;

  let workingDays = 0;
  let current = new Date(startDate);

  // Normaliser les dates de jours fériés pour comparaison (YYYY-MM-DD)
  const holidayStrings = publicHolidays.map(h => {
    const d = new Date(h);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });

  while (current <= endDate) {
    const dayOfWeek = current.getDay(); // 0 = Dimanche, 6 = Samedi
    const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

    const currentDateString = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`;
    const isHoliday = holidayStrings.includes(currentDateString);

    if (!isWeekend && !isHoliday) {
      workingDays++;
    }

    // Avancer au jour suivant
    current.setDate(current.getDate() + 1);
  }

  return workingDays;
}

export { calculateWorkingDays };
