/**
 * Prospect Reinject - Réinjection des prospects anciens
 * Permet de retravailler les prospects obsolètes sans créer de doublons
 *
 * RÈGLES DE RÉINJECTION:
 * 1. Doublon = même phone_international + même segment_id
 * 2. Si date_injection > 24h:
 *    - Si statut = "contacté avec rdv" ET date_rdv dans le FUTUR → BLOQUER (doublon)
 *    - Si statut = "contacté avec rdv" ET date_rdv dans le PASSÉ → RÉINJECTER
 *    - Sinon → RÉINJECTER
 * 3. Si date_injection <= 24h → BLOQUER (doublon)
 * 4. Lors de la réinjection: APPEND ville/nom/prenom/date_rdv pour tracer l'historique
 */

import pool from '../config/database.js';
import { googleContactsService } from '../services/googleContactsService.js';

/**
 * Réinjecte un prospect existant avec historique complet
 * @param {string} prospectId - ID du prospect
 * @param {string} userId - ID de l'utilisateur effectuant la réinjection
 * @param {Object} newData - Nouvelles données (ville_id, nom, prenom) à AJOUTER
 * @returns {Promise<Object>} Prospect réinjecté
 */
export async function reinjectProspect(prospectId, userId, newData = {}) {
  // D'abord récupérer les données actuelles pour l'historique
  const { rows: currentRows } = await pool.query(
    'SELECT ville_id, nom, prenom, date_rdv, historique_rdv, historique_villes FROM prospects WHERE id = $1',
    [prospectId]
  );

  if (currentRows.length === 0) {
    throw new Error('Prospect non trouvé');
  }

  const current = currentRows[0];

  // Préparer les champs avec historique (APPEND)
  const updateFields = [
    'date_injection = NOW()',
    "statut_contact = 'non contacté'",
    "decision_nettoyage = 'laisser'",
    'updated_at = NOW()'
  ];
  const updateValues = [];
  let paramIndex = 1;

  // HISTORIQUE RDV: Si date_rdv existe, l'ajouter à historique_rdv avant de la vider
  if (current.date_rdv) {
    const rdvDate = new Date(current.date_rdv);
    const rdvFormatted = rdvDate.toLocaleDateString('fr-FR') + ' ' + rdvDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    // Construire le nouvel historique
    let newHistoriqueRdv;
    if (current.historique_rdv) {
      // Vérifier si cette date n'est pas déjà dans l'historique
      if (!current.historique_rdv.includes(rdvFormatted)) {
        newHistoriqueRdv = `${current.historique_rdv}, ${rdvFormatted}`;
      } else {
        newHistoriqueRdv = current.historique_rdv;
      }
    } else {
      newHistoriqueRdv = rdvFormatted;
    }

    updateFields.push(`historique_rdv = $${paramIndex++}`);
    updateValues.push(newHistoriqueRdv);
    console.log(`📅 Historique RDV: ${newHistoriqueRdv}`);
  }

  // Maintenant on peut vider date_rdv
  updateFields.push('date_rdv = NULL');

  // HISTORIQUE VILLES: Stocker l'ancienne ville avant de mettre à jour
  if (newData.ville_id && newData.ville_id !== current.ville_id) {
    // Récupérer les noms des villes pour l'historique lisible
    const villeHistoryQuery = `
      SELECT
        COALESCE(
          (SELECT name FROM cities WHERE id = $1),
          $1::text
        ) as current_ville,
        COALESCE(
          (SELECT name FROM cities WHERE id = $2),
          $2::text
        ) as new_ville
    `;
    const { rows: villeRows } = await pool.query(villeHistoryQuery, [current.ville_id, newData.ville_id]);
    const villeHistory = villeRows[0];

    // Construire le nouvel historique des villes
    let newHistoriqueVilles;
    if (current.historique_villes) {
      // Vérifier si l'ancienne ville n'est pas déjà dans l'historique
      if (!current.historique_villes.includes(villeHistory.current_ville)) {
        newHistoriqueVilles = `${current.historique_villes}, ${villeHistory.current_ville}`;
      } else {
        newHistoriqueVilles = current.historique_villes;
      }
    } else {
      // Première réinjection - stocker l'ancienne ville
      newHistoriqueVilles = villeHistory.current_ville;
    }

    updateFields.push(`historique_villes = $${paramIndex++}`);
    updateValues.push(newHistoriqueVilles);
    console.log(`📍 Historique villes: ${newHistoriqueVilles} → nouvelle: ${villeHistory.new_ville}`);

    // Mettre à jour la ville_id avec la nouvelle ville
    updateFields.push(`ville_id = $${paramIndex++}`);
    updateValues.push(newData.ville_id);
  }

  // APPEND nom: format "Nom1, Nom2"
  if (newData.nom) {
    if (current.nom && current.nom !== newData.nom) {
      // Vérifier si le nouveau nom n'est pas déjà dans l'historique
      const existingNoms = current.nom.split(', ').map(n => n.trim().toLowerCase());
      if (!existingNoms.includes(newData.nom.trim().toLowerCase())) {
        updateFields.push(`nom = $${paramIndex++}`);
        updateValues.push(`${current.nom}, ${newData.nom}`);
        console.log(`👤 Historique nom: ${current.nom} → ${current.nom}, ${newData.nom}`);
      }
    } else if (!current.nom) {
      updateFields.push(`nom = $${paramIndex++}`);
      updateValues.push(newData.nom);
    }
  }

  // APPEND prenom: format "Prenom1, Prenom2"
  if (newData.prenom) {
    if (current.prenom && current.prenom !== newData.prenom) {
      // Vérifier si le nouveau prénom n'est pas déjà dans l'historique
      const existingPrenoms = current.prenom.split(', ').map(p => p.trim().toLowerCase());
      if (!existingPrenoms.includes(newData.prenom.trim().toLowerCase())) {
        updateFields.push(`prenom = $${paramIndex++}`);
        updateValues.push(`${current.prenom}, ${newData.prenom}`);
        console.log(`👤 Historique prénom: ${current.prenom} → ${current.prenom}, ${newData.prenom}`);
      }
    } else if (!current.prenom) {
      updateFields.push(`prenom = $${paramIndex++}`);
      updateValues.push(newData.prenom);
    }
  }

  // Exécuter la mise à jour
  updateValues.push(prospectId);
  const query = `
    UPDATE prospects
    SET ${updateFields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const { rows } = await pool.query(query, updateValues);

  // Logger dans l'historique des appels
  const callId = `call-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  await pool.query(`
    INSERT INTO prospect_call_history
    (id, prospect_id, user_id, call_start, call_end, status_before, status_after, commentaire)
    VALUES ($1, $2, $3, NOW(), NOW(), 'réinjection', 'non contacté', 'Prospect réinjecté automatiquement')
  `, [callId, prospectId, userId]);

  console.log(`🔄 Prospect ${prospectId} réinjecté par user ${userId}`);

  // 📱 Sync vers Google Contacts (async, non-bloquant)
  // La ville peut avoir changé lors de la réinjection, on sync vers le nouveau compte Google
  const reinjectedProspect = rows[0];
  if (reinjectedProspect) {
    const villeInfo = await pool.query(
      'SELECT c.name as ville_name, s.name as segment_name FROM cities c LEFT JOIN segments s ON c.segment_id = s.id WHERE c.id = $1',
      [reinjectedProspect.ville_id]
    );

    googleContactsService.syncProspect({
      id: reinjectedProspect.id,
      phone_international: reinjectedProspect.phone_international,
      nom: reinjectedProspect.nom,
      prenom: reinjectedProspect.prenom,
      ville_id: reinjectedProspect.ville_id,
      ville_name: villeInfo.rows[0]?.ville_name || '',
      segment_name: villeInfo.rows[0]?.segment_name || '',
      google_contact_id: reinjectedProspect.google_contact_id
    }).catch(err => console.error('Google sync error (reinject):', err.message));
  }

  return rows[0];
}

/**
 * Détermine si un prospect doit être réinjecté selon les nouvelles règles
 *
 * RÈGLES:
 * 1. date_injection doit être > 24 heures
 * 2. Si statut = "contacté avec rdv":
 *    - date_rdv passée → RÉINJECTER
 *    - date_rdv future → BLOQUER
 * 3. Autres statuts + > 24h → RÉINJECTER
 *
 * @param {Object} existingProspect - Prospect existant
 * @returns {{ canReinject: boolean, reason: string }} Résultat avec raison
 */
export function shouldReinject(existingProspect) {
  if (!existingProspect) {
    return { canReinject: false, reason: 'Prospect inexistant' };
  }

  const now = new Date();
  const dateInjection = existingProspect.date_injection
    ? new Date(existingProspect.date_injection)
    : null;

  // RÈGLE: Le prospect doit avoir été injecté il y a plus de 24 heures
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000; // 24h en ms
  const isOlderThan24h = dateInjection &&
    (now.getTime() - dateInjection.getTime()) > TWENTY_FOUR_HOURS;

  if (!isOlderThan24h) {
    return {
      canReinject: false,
      reason: 'Prospect injecté il y a moins de 24 heures'
    };
  }

  // RÈGLE: Si statut = "contacté avec rdv", vérifier la date du RDV
  const statutContact = existingProspect.statut_contact?.toLowerCase();

  if (statutContact === 'contacté avec rdv') {
    const dateRdv = existingProspect.date_rdv
      ? new Date(existingProspect.date_rdv)
      : null;

    if (dateRdv) {
      // Comparer avec aujourd'hui (début de journée pour être précis)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dateRdv >= today) {
        // RDV dans le futur ou aujourd'hui → BLOQUER
        return {
          canReinject: false,
          reason: `RDV prévu le ${dateRdv.toLocaleDateString('fr-FR')} - ne peut pas être réinjecté`
        };
      } else {
        // RDV dans le passé → RÉINJECTER
        return {
          canReinject: true,
          reason: `RDV passé (${dateRdv.toLocaleDateString('fr-FR')}) - peut être réinjecté`
        };
      }
    }

    // Pas de date RDV mais statut "contacté avec rdv" → RÉINJECTER (incohérent)
    return {
      canReinject: true,
      reason: 'Statut RDV sans date - peut être réinjecté'
    };
  }

  // Autres statuts + > 24h → RÉINJECTER
  return {
    canReinject: true,
    reason: `Ancien prospect (> 24h) avec statut "${statutContact || 'non défini'}" - peut être réinjecté`
  };
}

/**
 * Gère la logique complète de doublon vs réinjection
 *
 * RÈGLES:
 * 1. Un même numéro peut exister dans différents segments
 * 2. Doublon = phone_international + segment_id identiques
 * 3. Si doublon existe:
 *    - Vérifier si réinjection possible (shouldReinject)
 *    - Si oui: réinjecter avec APPEND des données
 *    - Si non: bloquer comme doublon
 *
 * @param {string} phoneInternational - Numéro au format international
 * @param {string} userId - ID de l'utilisateur
 * @param {Object} prospectData - Données du nouveau prospect (segment_id, ville_id, nom, prenom)
 * @returns {Promise<Object>} { action: 'created'|'reinjected'|'duplicate', prospect, message }
 */
export async function handleDuplicateOrReinject(phoneInternational, userId, prospectData) {
  // Vérifier si le prospect existe DANS LE MÊME SEGMENT
  const existingQuery = `
    SELECT * FROM prospects
    WHERE phone_international = $1
      AND segment_id = $2
  `;
  const { rows: existing } = await pool.query(existingQuery, [phoneInternational, prospectData.segment_id]);

  if (existing.length === 0) {
    // Aucun doublon dans ce segment → Créer un nouveau prospect
    return {
      action: 'created',
      prospect: null,
      message: 'Nouveau prospect à créer'
    };
  }

  const existingProspect = existing[0];

  // Vérifier si le prospect peut être réinjecté
  const reinjectResult = shouldReinject(existingProspect);

  if (reinjectResult.canReinject) {
    // Réinjecter le prospect avec APPEND des données
    const reinjected = await reinjectProspect(existingProspect.id, userId, {
      ville_id: prospectData.ville_id,
      nom: prospectData.nom,
      prenom: prospectData.prenom
    });

    return {
      action: 'reinjected',
      prospect: reinjected,
      message: `Prospect réinjecté: ${reinjectResult.reason}`
    };
  }

  // Le prospect ne peut pas être réinjecté → Doublon strict
  return {
    action: 'duplicate',
    prospect: existingProspect,
    message: reinjectResult.reason
  };
}
