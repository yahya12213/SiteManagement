/**
 * Phone Validator - Normalisation internationale des numéros de téléphone
 * Support de 150+ pays avec validation automatique
 */

import pool from '../config/database.js';

/**
 * Normalise et valide un numéro de téléphone international
 * @param {string} rawPhone - Numéro brut saisi
 * @returns {Promise<Object>} { valid, phone_international, country_code, country, error }
 */
export async function normalizePhoneInternational(rawPhone) {
  if (!rawPhone || typeof rawPhone !== 'string') {
    return {
      valid: false,
      phone_international: null,
      country_code: null,
      country: null,
      error: 'Numéro requis'
    };
  }

  try {
    const query = `SELECT * FROM normalize_phone_international($1)`;
    const { rows } = await pool.query(query, [rawPhone]);

    if (rows.length === 0 || !rows[0].is_valid) {
      return {
        valid: false,
        phone_international: null,
        country_code: rows[0]?.country_code || null,
        country: rows[0]?.country || null,
        error: rows[0]?.error_message || 'Numéro invalide ou indicatif pays non géré'
      };
    }

    return {
      valid: true,
      phone_international: rows[0].phone_international,
      country_code: rows[0].country_code,
      country: rows[0].country,
      error: null
    };
  } catch (error) {
    console.error('Error normalizing phone:', error);
    return {
      valid: false,
      phone_international: null,
      country_code: null,
      country: null,
      error: 'Erreur lors de la validation du numéro'
    };
  }
}

/**
 * Valide un batch de numéros
 * @param {Array<string>} phoneList - Liste de numéros bruts
 * @returns {Promise<Array>} Résultats de validation
 */
export async function validatePhoneBatch(phoneList) {
  const promises = phoneList.map(phone => normalizePhoneInternational(phone));
  return Promise.all(promises);
}

/**
 * Formate un numéro international pour affichage
 * Exemple: +212612345678 → +212 6 12 34 56 78
 * @param {string} phoneInternational - Numéro au format international
 * @returns {string} Numéro formaté pour affichage
 */
export function formatPhoneForDisplay(phoneInternational) {
  if (!phoneInternational) return '';

  // Exemple simple : ajouter des espaces tous les 2-3 chiffres après le code pays
  // Peut être amélioré selon les conventions de chaque pays
  const match = phoneInternational.match(/^\+(\d{1,3})(\d+)$/);
  if (!match) return phoneInternational;

  const [, countryCode, nationalNumber] = match;

  // Ajouter des espaces tous les 2 chiffres dans le numéro national
  const formatted = nationalNumber.replace(/(\d{1,2})(?=\d)/g, '$1 ').trim();

  return `+${countryCode} ${formatted}`;
}
