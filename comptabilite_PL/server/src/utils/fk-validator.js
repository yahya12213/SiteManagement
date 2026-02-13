import pool from '../config/database.js';

/**
 * Foreign Key Validation Utilities
 * Validates that foreign key references exist before INSERT/UPDATE operations
 */

/**
 * Validates that a profile ID exists in the profiles table
 * @param {string|null|undefined} profileId - Profile ID to validate
 * @returns {Promise<{valid: boolean, error: string|null}>}
 */
export const validateProfileExists = async (profileId) => {
  // NULL/undefined/empty string is valid for optional FK fields
  if (!profileId || profileId === '') {
    return { valid: true, error: null };
  }

  try {
    const result = await pool.query(
      'SELECT id FROM profiles WHERE id = $1',
      [profileId]
    );

    if (result.rows.length === 0) {
      return {
        valid: false,
        error: `Le profil avec l'ID "${profileId}" n'existe pas. Veuillez sélectionner un utilisateur valide.`
      };
    }

    return { valid: true, error: null };
  } catch (error) {
    console.error('Profile validation error:', error);
    return {
      valid: false,
      error: 'Erreur lors de la validation du profil'
    };
  }
};

/**
 * Validates that a segment ID exists in the segments table
 * @param {string|null|undefined} segmentId - Segment ID to validate
 * @returns {Promise<{valid: boolean, error: string|null}>}
 */
export const validateSegmentExists = async (segmentId) => {
  if (!segmentId || segmentId === '') {
    return { valid: true, error: null };
  }

  try {
    const result = await pool.query(
      'SELECT id FROM segments WHERE id = $1',
      [segmentId]
    );

    if (result.rows.length === 0) {
      return {
        valid: false,
        error: `Le segment avec l'ID "${segmentId}" n'existe pas.`
      };
    }

    return { valid: true, error: null };
  } catch (error) {
    console.error('Segment validation error:', error);
    return {
      valid: false,
      error: 'Erreur lors de la validation du segment'
    };
  }
};

/**
 * Validates that a city ID exists in the cities table
 * @param {string|null|undefined} cityId - City ID to validate
 * @returns {Promise<{valid: boolean, error: string|null}>}
 */
export const validateCityExists = async (cityId) => {
  if (!cityId || cityId === '') {
    return { valid: true, error: null };
  }

  try {
    const result = await pool.query(
      'SELECT id FROM cities WHERE id = $1',
      [cityId]
    );

    if (result.rows.length === 0) {
      return {
        valid: false,
        error: `La ville avec l'ID "${cityId}" n'existe pas.`
      };
    }

    return { valid: true, error: null };
  } catch (error) {
    console.error('City validation error:', error);
    return {
      valid: false,
      error: 'Erreur lors de la validation de la ville'
    };
  }
};

/**
 * Validates multiple FK fields for a project
 * Batch validation for better performance
 * @param {object} fields - Object with {manager_id, segment_id, city_id}
 * @returns {Promise<{valid: boolean, errors: string[]}>}
 */
export const validateProjectForeignKeys = async (fields) => {
  const { manager_id, segment_id, city_id } = fields;
  const errors = [];

  // Validate manager_id
  const managerCheck = await validateProfileExists(manager_id);
  if (!managerCheck.valid) {
    errors.push(managerCheck.error);
  }

  // Validate segment_id
  const segmentCheck = await validateSegmentExists(segment_id);
  if (!segmentCheck.valid) {
    errors.push(segmentCheck.error);
  }

  // Validate city_id
  const cityCheck = await validateCityExists(city_id);
  if (!cityCheck.valid) {
    errors.push(cityCheck.error);
  }

  return {
    valid: errors.length === 0,
    errors
  };
};
