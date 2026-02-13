/**
 * Prospect Cleaner - Nettoyage automatique des prospects obsolètes
 * Moteur de décision pour marquer les prospects à supprimer
 */

import pool from '../config/database.js';

/**
 * Recalcule la décision de nettoyage pour tous les prospects
 * Utilise la fonction PostgreSQL apply_cleaning_decision()
 * @returns {Promise<Object>} Stats du nettoyage (laisser, supprimer, a_revoir)
 */
export async function runCleaningBatch() {
  console.log('🧹 Démarrage du nettoyage batch des prospects...');

  const query = `
    UPDATE prospects
    SET decision_nettoyage = apply_cleaning_decision(date_rdv, statut_contact, date_injection),
        updated_at = NOW()
  `;

  await pool.query(query);

  // Récupérer les stats
  const statsQuery = `
    SELECT
      decision_nettoyage,
      COUNT(*) as count
    FROM prospects
    GROUP BY decision_nettoyage
  `;

  const { rows } = await pool.query(statsQuery);

  const stats = {
    laisser: 0,
    supprimer: 0,
    a_revoir: 0,
    total: 0
  };

  rows.forEach(row => {
    const count = parseInt(row.count, 10);
    stats.total += count;

    if (row.decision_nettoyage === 'laisser') {
      stats.laisser = count;
    } else if (row.decision_nettoyage === 'supprimer') {
      stats.supprimer = count;
    } else if (row.decision_nettoyage === 'a_revoir_manuelle') {
      stats.a_revoir = count;
    }
  });

  console.log('✅ Nettoyage batch terminé:', stats);

  return stats;
}

/**
 * Supprime définitivement les prospects marqués "supprimer"
 * ⚠️ DÉSACTIVÉ: La suppression automatique est interdite
 * Les prospects ne doivent JAMAIS être supprimés automatiquement
 * Utiliser la réinjection à la place
 * @returns {Promise<Object>} { deleted: 0, message: string }
 */
export async function deleteMarkedProspects() {
  console.log('⚠️ SUPPRESSION DÉSACTIVÉE - Les prospects ne sont jamais supprimés automatiquement');
  console.log('💡 Utilisez la réinjection pour retravailler les anciens prospects');

  // NE PAS SUPPRIMER - Retourner 0 suppressions
  return {
    deleted: 0,
    message: 'Suppression automatique désactivée. Utilisez la réinjection.'
  };
}

/**
 * Récupère les prospects marqués pour suppression avec détails
 * @param {number} limit - Nombre max de résultats
 * @param {number} offset - Offset pour pagination
 * @returns {Promise<Array>} Liste des prospects à supprimer
 */
export async function getProspectsToDelete(limit = 100, offset = 0) {
  const query = `
    SELECT
      p.id,
      p.phone_international,
      p.nom,
      p.prenom,
      p.statut_contact,
      p.date_rdv,
      p.date_injection,
      p.decision_nettoyage,
      c.name as ville_name,
      s.name as segment_name
    FROM prospects p
    LEFT JOIN cities c ON c.id = p.ville_id
    LEFT JOIN segments s ON s.id = p.segment_id
    WHERE p.decision_nettoyage = 'supprimer'
    ORDER BY p.date_injection DESC
    LIMIT $1 OFFSET $2
  `;

  const { rows } = await pool.query(query, [limit, offset]);
  return rows;
}

/**
 * Récupère les stats de nettoyage par décision
 * @returns {Promise<Object>} Stats globales
 */
export async function getCleaningStats() {
  const query = `
    SELECT
      decision_nettoyage,
      COUNT(*) as count,
      COUNT(*) FILTER (WHERE statut_contact = 'non contacté') as non_contactes,
      COUNT(*) FILTER (WHERE date_rdv IS NOT NULL) as avec_rdv
    FROM prospects
    GROUP BY decision_nettoyage
  `;

  const { rows } = await pool.query(query);

  const stats = {
    laisser: { total: 0, non_contactes: 0, avec_rdv: 0 },
    supprimer: { total: 0, non_contactes: 0, avec_rdv: 0 },
    a_revoir_manuelle: { total: 0, non_contactes: 0, avec_rdv: 0 }
  };

  rows.forEach(row => {
    const decision = row.decision_nettoyage || 'a_revoir_manuelle';
    if (stats[decision]) {
      stats[decision] = {
        total: parseInt(row.count, 10),
        non_contactes: parseInt(row.non_contactes, 10),
        avec_rdv: parseInt(row.avec_rdv, 10)
      };
    }
  });

  return stats;
}

/**
 * Planifie une tâche de nettoyage automatique
 * (À appeler via un cron job)
 */
export async function scheduledCleanup() {
  try {
    console.log('⏰ Nettoyage planifié démarré:', new Date().toISOString());

    // Recalculer les décisions
    const stats = await runCleaningBatch();

    console.log(`📊 Résultats: ${stats.laisser} à garder, ${stats.supprimer} à supprimer, ${stats.a_revoir} à revoir`);

    // Option: supprimer automatiquement (à activer avec précaution)
    // const deleted = await deleteMarkedProspects();
    // console.log(`🗑️ ${deleted.deleted} prospects supprimés automatiquement`);

    return stats;
  } catch (error) {
    console.error('❌ Erreur lors du nettoyage planifié:', error);
    throw error;
  }
}
