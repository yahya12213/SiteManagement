/**
 * Prospect Assignment - Affectation automatique intelligente
 * Répartit les prospects selon la charge de travail des assistantes
 */

import pool from '../config/database.js';

/**
 * Trouve l'assistante avec la charge la plus faible
 * et retourne { assigned_to, ville_id, assistante_name, ville_name }
 */
export async function autoAssignProspect() {
  try {
    // 1. Récupérer toutes les assistantes ayant des villes assignées
    const assistantesQuery = `
      SELECT DISTINCT p.id, p.full_name
      FROM profiles p
      WHERE EXISTS (
        SELECT 1 FROM professor_cities WHERE professor_id = p.id
      )
    `;

    const { rows: assistantes } = await pool.query(assistantesQuery);

    if (assistantes.length === 0) {
      throw new Error('Aucune assistante disponible avec des villes assignées');
    }

    // 2. Pour chaque assistante, compter ses prospects non contactés
    const workloadPromises = assistantes.map(async (assistante) => {
      const countQuery = `
        SELECT COUNT(*) as count
        FROM prospects
        WHERE assigned_to = $1
          AND statut_contact IN ('non contacté', 'contacté sans reponse')
      `;
      const { rows } = await pool.query(countQuery, [assistante.id]);
      return {
        ...assistante,
        workload: parseInt(rows[0].count, 10)
      };
    });

    const workloads = await Promise.all(workloadPromises);

    // 3. Trouver l'assistante avec le minimum de prospects
    const minAssistante = workloads.reduce((min, curr) =>
      curr.workload < min.workload ? curr : min
    );

    console.log(`🎯 Assistante sélectionnée: ${minAssistante.full_name} (${minAssistante.workload} prospects)`);

    // 4. Récupérer ses villes
    const villesQuery = `
      SELECT c.id, c.name
      FROM cities c
      JOIN professor_cities pc ON pc.city_id = c.id
      WHERE pc.professor_id = $1
    `;
    const { rows: villes } = await pool.query(villesQuery, [minAssistante.id]);

    if (villes.length === 0) {
      throw new Error('Aucune ville assignée à cette assistante');
    }

    // 5. Pour chaque ville, compter les prospects
    const villeWorkloadPromises = villes.map(async (ville) => {
      const countQuery = `
        SELECT COUNT(*) as count
        FROM prospects
        WHERE ville_id = $1
      `;
      const { rows } = await pool.query(countQuery, [ville.id]);
      return {
        ...ville,
        count: parseInt(rows[0].count, 10)
      };
    });

    const villeWorkloads = await Promise.all(villeWorkloadPromises);

    // 6. Trouver la ville avec le minimum de prospects
    const minVille = villeWorkloads.reduce((min, curr) =>
      curr.count < min.count ? curr : min
    );

    console.log(`🏙️ Ville sélectionnée: ${minVille.name} (${minVille.count} prospects)`);

    return {
      assigned_to: minAssistante.id,
      assistante_name: minAssistante.full_name,
      ville_id: minVille.id,
      ville_name: minVille.name
    };
  } catch (error) {
    console.error('Error in autoAssignProspect:', error);
    throw error;
  }
}

/**
 * Trouve l'assistante qui a la ville assignée avec la charge la plus faible
 * @param {string} villeId - ID de la ville
 * @returns {Promise<Object|null>} { assigned_to, assistante_name } ou null si aucune assistante
 */
export async function findAssistanteForVille(villeId) {
  try {
    // Trouver les assistantes qui ont cette ville assignée
    const query = `
      SELECT
        p.id,
        p.full_name,
        (
          SELECT COUNT(*)
          FROM prospects
          WHERE assigned_to = p.id
            AND statut_contact IN ('non contacté', 'contacté sans reponse')
        ) as workload
      FROM profiles p
      JOIN professor_cities pc ON pc.professor_id = p.id
      WHERE pc.city_id = $1
      ORDER BY workload ASC
      LIMIT 1
    `;

    const { rows } = await pool.query(query, [villeId]);

    if (rows.length === 0) {
      console.log(`⚠️ Aucune assistante assignée à la ville ${villeId}`);
      return null;
    }

    console.log(`🎯 Assistante trouvée pour la ville: ${rows[0].full_name} (${rows[0].workload} prospects)`);

    return {
      assigned_to: rows[0].id,
      assistante_name: rows[0].full_name
    };
  } catch (error) {
    console.error('Error in findAssistanteForVille:', error);
    return null;
  }
}

/**
 * Vérifie si une ville est dans les villes assignées d'un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @param {string} villeId - ID de la ville
 * @returns {Promise<boolean>} true si la ville est assignée
 */
export async function isVilleAssignedToUser(userId, villeId) {
  const query = `
    SELECT 1
    FROM professor_cities
    WHERE professor_id = $1 AND city_id = $2
    LIMIT 1
  `;

  const { rows } = await pool.query(query, [userId, villeId]);
  return rows.length > 0;
}

/**
 * Réaffecte automatiquement un prospect si la ville a changé
 * et n'est plus dans le scope de l'assistante actuelle
 * @param {string} prospectId - ID du prospect
 * @param {string} newVilleId - Nouvelle ville
 * @param {string} currentAssignedTo - ID de l'assistante actuelle
 * @returns {Promise<Object|null>} Nouvelle affectation ou null si pas de changement
 */
export async function reassignIfOutOfScope(prospectId, newVilleId, currentAssignedTo) {
  // Vérifier si la nouvelle ville est dans le scope de l'assistante actuelle
  const isInScope = await isVilleAssignedToUser(currentAssignedTo, newVilleId);

  if (isInScope) {
    // Pas de réaffectation nécessaire
    return null;
  }

  // La ville n'est pas dans le scope → Réaffectation automatique
  console.log(`⚠️ Prospect ${prospectId} hors scope, réaffectation automatique...`);

  const newAssignment = await autoAssignProspect();

  // Mettre à jour le prospect
  await pool.query(`
    UPDATE prospects
    SET
      assigned_to = $1,
      ville_id = $2,
      is_auto_assigned = true,
      updated_at = NOW()
    WHERE id = $3
  `, [newAssignment.assigned_to, newAssignment.ville_id, prospectId]);

  return newAssignment;
}
