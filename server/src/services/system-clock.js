/**
 * Service d'horloge système configurable - Version Absolue
 *
 * L'admin définit l'heure souhaitée et le système la prend telle quelle.
 * Le temps avance en temps réel à partir de ce point.
 *
 * Principe: Admin dit "il est 10:30" → Système utilise 10:30 → Temps avance normalement
 *
 * Stockage:
 * - enabled: boolean
 * - reference_server_time: moment où l'horloge a été configurée (timestamp serveur)
 * - desired_time: heure que l'admin a définie à ce moment
 *
 * Calcul:
 * - elapsed = NOW() - reference_server_time
 * - system_time = desired_time + elapsed
 */

/**
 * Récupère la configuration de l'horloge depuis hr_settings
 * @param {Pool} pool - Connection pool PostgreSQL
 * @returns {Promise<Object>} Configuration de l'horloge
 */
export async function getClockConfig(pool) {
  try {
    const result = await pool.query(`
      SELECT setting_value FROM hr_settings WHERE setting_key = 'system_clock'
    `);

    if (result.rows.length === 0) {
      return {
        enabled: false,
        offset_minutes: 0,
        reference_server_time: null,
        desired_time: null
      };
    }

    // PostgreSQL JSONB retourne déjà un objet, pas une chaîne
    // Gérer les deux cas pour éviter l'erreur "[object Object] is not valid JSON"
    const settingValue = result.rows[0].setting_value;
    let config;

    if (typeof settingValue === 'string') {
      config = JSON.parse(settingValue);
    } else if (typeof settingValue === 'object' && settingValue !== null) {
      config = settingValue; // Déjà un objet parsé par PostgreSQL
    } else {
      console.warn('[SystemClock] Invalid setting_value type:', typeof settingValue);
      return {
        enabled: false,
        offset_minutes: 0,
        reference_server_time: null,
        desired_time: null
      };
    }

    return {
      enabled: config.enabled || false,
      offset_minutes: parseInt(config.offset_minutes) || 0,
      reference_server_time: config.reference_server_time || null,
      desired_time: config.desired_time || null,
      updated_at: config.updated_at || null,
      updated_by: config.updated_by || null
    };
  } catch (error) {
    console.error('[SystemClock] Error getting config:', error.message, error);
    return {
      enabled: false,
      offset_minutes: 0,
      reference_server_time: null,
      desired_time: null
    };
  }
}

/**
 * FONCTION PRINCIPALE: Obtient l'heure système actuelle
 *
 * Si l'horloge est activée:
 *   system_time = desired_time + (NOW() - reference_server_time)
 * Sinon:
 *   system_time = NOW()
 *
 * @param {Pool} pool - Connection pool PostgreSQL
 * @returns {Promise<Date>} L'heure système à utiliser pour le pointage
 */
export async function getSystemTime(pool) {
  const config = await getClockConfig(pool);

  // Si désactivé ou pas de config, utiliser NOW()
  if (!config.enabled || !config.desired_time || !config.reference_server_time) {
    const result = await pool.query(`SELECT NOW() as now`);
    return new Date(result.rows[0].now);
  }

  // Calculer le temps écoulé depuis la configuration et l'ajouter au temps désiré
  // system_time = desired_time + (NOW() - reference_server_time)
  const result = await pool.query(`
    SELECT (
      $1::TIMESTAMPTZ + (NOW() - $2::TIMESTAMPTZ)
    ) as system_time
  `, [config.desired_time, config.reference_server_time]);

  return new Date(result.rows[0].system_time);
}

/**
 * Obtient la date système actuelle au format YYYY-MM-DD
 * Utilise Africa/Casablanca pour l'heure locale du Maroc
 *
 * @param {Pool} pool - Connection pool PostgreSQL
 * @returns {Promise<string>} Date au format YYYY-MM-DD
 */
export async function getSystemDate(pool) {
  const systemTime = await getSystemTime(pool);
  // Utiliser en-CA avec timezone Africa/Casablanca pour format YYYY-MM-DD
  return systemTime.toLocaleDateString('en-CA', { timeZone: 'Africa/Casablanca' });
}

/**
 * Obtient l'heure système actuelle au format HH:MM
 * Utilise Africa/Casablanca pour l'heure locale du Maroc
 *
 * @param {Pool} pool - Connection pool PostgreSQL
 * @returns {Promise<string>} Heure au format HH:MM
 */
export async function getSystemTimeFormatted(pool) {
  const systemTime = await getSystemTime(pool);
  // Utiliser toLocaleTimeString avec timezone Africa/Casablanca pour éviter décalage UTC
  return systemTime.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Casablanca'
  });
}

/**
 * Obtient un timestamp ISO complet pour le pointage
 * Format: YYYY-MM-DDTHH:MM:SS+01:00 (heure locale Africa/Casablanca)
 *
 * @param {Pool} pool - Connection pool PostgreSQL
 * @returns {Promise<string>} Timestamp ISO complet
 */
export async function getSystemTimestamp(pool) {
  const config = await getClockConfig(pool);

  if (!config.enabled || !config.desired_time || !config.reference_server_time) {
    const result = await pool.query(`
      SELECT TO_CHAR(NOW() AT TIME ZONE 'Africa/Casablanca', 'YYYY-MM-DD"T"HH24:MI:SS"+01:00"') as ts
    `);
    return result.rows[0].ts;
  }

  // Calculer le temps système et le formater en heure locale Maroc
  const result = await pool.query(`
    SELECT TO_CHAR(
      ($1::TIMESTAMPTZ + (NOW() - $2::TIMESTAMPTZ)) AT TIME ZONE 'Africa/Casablanca',
      'YYYY-MM-DD"T"HH24:MI:SS"+01:00"'
    ) as ts
  `, [config.desired_time, config.reference_server_time]);

  return result.rows[0].ts;
}

/**
 * Configure l'horloge avec un temps absolu
 *
 * @param {Pool} pool - Connection pool PostgreSQL
 * @param {boolean} enabled - Activer/désactiver l'horloge personnalisée
 * @param {string} desiredDateTime - Date/heure souhaitée au format ISO (YYYY-MM-DDTHH:MM:SS)
 * @param {string} updatedBy - ID de l'utilisateur qui fait la modification
 * @returns {Promise<Object>} La nouvelle configuration
 */
export async function setAbsoluteTime(pool, enabled, desiredDateTime, updatedBy) {
  // Récupérer le temps serveur actuel comme référence
  const serverTimeResult = await pool.query(`SELECT NOW() as now`);
  const referenceServerTime = serverTimeResult.rows[0].now;

  const config = {
    enabled: Boolean(enabled),
    desired_time: desiredDateTime,
    reference_server_time: referenceServerTime,
    // Garder offset_minutes pour compatibilité (calculé mais pas utilisé)
    offset_minutes: 0,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy
  };

  // Upsert dans hr_settings
  await pool.query(`
    INSERT INTO hr_settings (setting_key, setting_value, description, category, updated_at)
    VALUES ('system_clock', $1, 'Configuration de l''horloge système pour le pointage', 'attendance', NOW())
    ON CONFLICT (setting_key) DO UPDATE SET
      setting_value = $1,
      updated_at = NOW()
  `, [JSON.stringify(config)]);

  console.log(`[SystemClock] Absolute time set: enabled=${enabled}, desired=${desiredDateTime}, reference=${referenceServerTime}, by=${updatedBy}`);

  return config;
}

/**
 * Met à jour la configuration de l'horloge (ancienne méthode avec offset)
 * @deprecated Utiliser setAbsoluteTime() à la place
 */
export async function updateClockConfig(pool, enabled, offset_minutes, updatedBy) {
  // Si enabled=false, juste désactiver
  if (!enabled) {
    return resetClock(pool, updatedBy);
  }

  // Calculer le temps désiré basé sur l'offset (pour compatibilité)
  const serverTimeResult = await pool.query(`SELECT NOW() as now`);
  const referenceServerTime = serverTimeResult.rows[0].now;
  const desiredTime = new Date(new Date(referenceServerTime).getTime() + (offset_minutes * 60000));

  const config = {
    enabled: true,
    desired_time: desiredTime.toISOString(),
    reference_server_time: referenceServerTime,
    offset_minutes: parseInt(offset_minutes) || 0,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy
  };

  await pool.query(`
    INSERT INTO hr_settings (setting_key, setting_value, description, category, updated_at)
    VALUES ('system_clock', $1, 'Configuration de l''horloge système pour le pointage', 'attendance', NOW())
    ON CONFLICT (setting_key) DO UPDATE SET
      setting_value = $1,
      updated_at = NOW()
  `, [JSON.stringify(config)]);

  console.log(`[SystemClock] Config updated (offset mode): offset=${offset_minutes}min, by=${updatedBy}`);

  return config;
}

/**
 * Réinitialise l'horloge (désactive l'offset)
 *
 * @param {Pool} pool - Connection pool PostgreSQL
 * @param {string} updatedBy - ID de l'utilisateur
 * @returns {Promise<Object>} La nouvelle configuration (désactivée)
 */
export async function resetClock(pool, updatedBy) {
  const config = {
    enabled: false,
    desired_time: null,
    reference_server_time: null,
    offset_minutes: 0,
    updated_at: new Date().toISOString(),
    updated_by: updatedBy
  };

  await pool.query(`
    INSERT INTO hr_settings (setting_key, setting_value, description, category, updated_at)
    VALUES ('system_clock', $1, 'Configuration de l''horloge système pour le pointage', 'attendance', NOW())
    ON CONFLICT (setting_key) DO UPDATE SET
      setting_value = $1,
      updated_at = NOW()
  `, [JSON.stringify(config)]);

  console.log(`[SystemClock] Clock reset by ${updatedBy}`);

  return config;
}

/**
 * Vérifie si l'horloge personnalisée est activée
 *
 * @param {Pool} pool - Connection pool PostgreSQL
 * @returns {Promise<boolean>}
 */
export async function isClockEnabled(pool) {
  const config = await getClockConfig(pool);
  return config.enabled && config.desired_time && config.reference_server_time;
}

export default {
  getClockConfig,
  getSystemTime,
  getSystemDate,
  getSystemTimeFormatted,
  getSystemTimestamp,
  setAbsoluteTime,
  updateClockConfig,
  resetClock,
  isClockEnabled
};
