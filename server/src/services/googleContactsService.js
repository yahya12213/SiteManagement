/**
 * Google Contacts Service
 *
 * Gère la synchronisation automatique des prospects vers Google Contacts
 * Chaque ville a son propre compte Google Contacts configuré
 */

import { google } from 'googleapis';
import pool from '../config/database.js';

class GoogleContactsService {
  /**
   * Obtenir le client OAuth2 authentifié pour une ville
   * @param {string} villeId - ID de la ville
   * @returns {Promise<OAuth2Client|null>}
   */
  async getAuthClient(villeId) {
    try {
      const { rows } = await pool.query(
        'SELECT google_token, google_sync_enabled, name FROM cities WHERE id = $1',
        [villeId]
      );

      if (!rows[0]) {
        console.log(`⚠️ Google Contacts: Ville ${villeId} non trouvée`);
        return null;
      }

      if (!rows[0].google_sync_enabled) {
        console.log(`⏭️ Google Contacts: Sync désactivé pour ${rows[0].name}`);
        return null;
      }

      if (!rows[0].google_token) {
        console.log(`⚠️ Google Contacts: Pas de token pour ${rows[0].name}`);
        return null;
      }

      const tokenData = JSON.parse(rows[0].google_token);

      // Utiliser les credentials d'environnement en priorité, sinon ceux du token stocké
      const redirectUri = process.env.GOOGLE_REDIRECT_URI ||
        (process.env.NODE_ENV === 'production'
          ? 'https://spectacular-enthusiasm-production.up.railway.app/api/google-oauth/callback'
          : 'http://localhost:3001/api/google-oauth/callback');

      const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID || tokenData.client_id,
        process.env.GOOGLE_CLIENT_SECRET || tokenData.client_secret,
        redirectUri
      );

      oauth2Client.setCredentials({
        access_token: tokenData.token,
        refresh_token: tokenData.refresh_token,
        token_uri: tokenData.token_uri
      });

      // Auto-refresh du token si expiré
      oauth2Client.on('tokens', async (tokens) => {
        console.log(`🔄 Google Contacts: Token rafraîchi pour ${rows[0].name}`);
        const updated = {
          ...tokenData,
          token: tokens.access_token || tokenData.token,
          expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : tokenData.expiry
        };
        await pool.query(
          'UPDATE cities SET google_token = $1 WHERE id = $2',
          [JSON.stringify(updated), villeId]
        );
      });

      return oauth2Client;

    } catch (error) {
      console.error(`❌ Google Contacts getAuthClient error:`, error.message);
      return null;
    }
  }

  /**
   * Synchroniser un prospect vers Google Contacts
   * @param {Object} prospect - Données du prospect
   * @returns {Promise<{success: boolean, contactId?: string, reason?: string}>}
   */
  async syncProspect(prospect) {
    const startTime = Date.now();

    try {
      // Valider les données minimales
      if (!prospect.ville_id) {
        return { success: false, reason: 'ville_id manquant' };
      }

      if (!prospect.phone_international) {
        return { success: false, reason: 'phone_international manquant' };
      }

      // Obtenir le client OAuth
      const auth = await this.getAuthClient(prospect.ville_id);
      if (!auth) {
        // Marquer comme skipped si pas de config Google
        await this.updateSyncStatus(prospect.id, 'skipped', null, 'Google non configuré pour cette ville');
        return { success: false, reason: 'Google non configuré pour cette ville' };
      }

      const people = google.people({ version: 'v1', auth });

      // Construire le nom du contact : Ville + ID + Segment + (Nom Prénom si disponible)
      // Exemple: "Beni Mellal 21438174 Prolean" ou "Beni Mellal 21438174 Prolean ahmed benali"
      const idShort = prospect.id; // ID complet de 8 chiffres (ex: 21438174)
      const villeName = prospect.ville_name || 'Inconnu';
      const segmentName = prospect.segment_name || '';

      // Construire le nom complet
      let displayName = `${villeName} ${idShort} ${segmentName}`.trim();

      // Ajouter nom et prénom si disponibles
      const fullName = [prospect.prenom, prospect.nom].filter(Boolean).join(' ').trim();
      if (fullName) {
        displayName += ` ${fullName}`;
      }

      // Construire les données du contact
      const contactData = {
        names: [{
          // Utiliser unstructuredName pour le nom complet affiché
          unstructuredName: displayName,
          // Garder aussi les champs structurés pour compatibilité
          givenName: `${villeName} ${idShort}`,
          familyName: segmentName + (fullName ? ` ${fullName}` : '')
        }],
        phoneNumbers: [{
          value: prospect.phone_international,
          type: 'mobile'
        }],
        userDefined: [
          { key: 'prospect_id', value: prospect.id },
          { key: 'ville', value: villeName },
          { key: 'segment', value: segmentName }
        ]
      };

      let contactId = prospect.google_contact_id;

      // Si le prospect a déjà un contact Google, on met à jour
      if (contactId) {
        try {
          // Récupérer le contact existant pour avoir l'etag
          const existingContact = await people.people.get({
            resourceName: contactId,
            personFields: 'names,phoneNumbers,metadata'
          });

          await people.people.updateContact({
            resourceName: contactId,
            updatePersonFields: 'names,phoneNumbers,userDefined',
            requestBody: {
              ...contactData,
              etag: existingContact.data.etag
            }
          });

          await this.updateSyncStatus(prospect.id, 'synced', contactId);
          console.log(`✅ Google Contacts: Mis à jour ${prospect.phone_international} (${Date.now() - startTime}ms)`);
          return { success: true, contactId };

        } catch (updateError) {
          // Si le contact n'existe plus, on le recrée
          if (updateError.code === 404) {
            console.log(`⚠️ Contact ${contactId} supprimé, recréation...`);
            contactId = null;
          } else {
            throw updateError;
          }
        }
      }

      // Rechercher si le contact existe déjà par téléphone
      if (!contactId) {
        const existing = await this.findByPhone(auth, prospect.phone_international);
        if (existing) {
          // Si le prospect avait un ancien contact différent, le supprimer
          if (prospect.google_contact_id && prospect.google_contact_id !== existing.resourceName) {
            try {
              await people.people.deleteContact({ resourceName: prospect.google_contact_id });
              console.log(`🗑️ Ancien contact supprimé: ${prospect.google_contact_id} (remplacé par ${existing.resourceName})`);
            } catch (deleteErr) {
              // Ignorer si déjà supprimé (404)
              if (deleteErr.code !== 404) {
                console.error('Erreur suppression ancien contact:', deleteErr.message);
              }
            }
          }

          // Mettre à jour le contact existant
          const existingContact = await people.people.get({
            resourceName: existing.resourceName,
            personFields: 'names,phoneNumbers,metadata'
          });

          await people.people.updateContact({
            resourceName: existing.resourceName,
            updatePersonFields: 'names,phoneNumbers,userDefined',
            requestBody: {
              ...contactData,
              etag: existingContact.data.etag
            }
          });

          await this.updateSyncStatus(prospect.id, 'synced', existing.resourceName);
          console.log(`✅ Google Contacts: Existant mis à jour ${prospect.phone_international} (${Date.now() - startTime}ms)`);
          return { success: true, contactId: existing.resourceName };
        }
      }

      // Créer un nouveau contact
      const result = await people.people.createContact({
        requestBody: contactData
      });

      const newContactId = result.data.resourceName;
      await this.updateSyncStatus(prospect.id, 'synced', newContactId);
      console.log(`✅ Google Contacts: Créé ${prospect.phone_international} → ${newContactId} (${Date.now() - startTime}ms)`);

      return { success: true, contactId: newContactId };

    } catch (error) {
      console.error(`❌ Google Contacts syncProspect error:`, error.message);

      // Mettre à jour le statut avec l'erreur
      await this.updateSyncStatus(prospect.id, 'failed', null, error.message);

      return { success: false, reason: error.message };
    }
  }

  /**
   * Rechercher un contact par numéro de téléphone
   * @param {OAuth2Client} auth - Client OAuth authentifié
   * @param {string} phone - Numéro de téléphone
   * @returns {Promise<Object|null>}
   */
  async findByPhone(auth, phone) {
    try {
      const people = google.people({ version: 'v1', auth });

      // Normaliser le numéro pour la recherche
      const searchPhone = phone.replace(/\s/g, '');

      const response = await people.people.searchContacts({
        query: searchPhone,
        readMask: 'names,phoneNumbers'
      });

      if (response.data.results && response.data.results.length > 0) {
        // Vérifier que le numéro correspond vraiment
        for (const result of response.data.results) {
          const person = result.person;
          if (person?.phoneNumbers) {
            for (const pn of person.phoneNumbers) {
              const normalizedPn = pn.value?.replace(/\s/g, '');
              if (normalizedPn === searchPhone || normalizedPn?.includes(searchPhone.slice(-9))) {
                return person;
              }
            }
          }
        }
      }

      return null;

    } catch (error) {
      console.error(`❌ Google Contacts findByPhone error:`, error.message);
      return null;
    }
  }

  /**
   * Mettre à jour le statut de synchronisation d'un prospect
   * @param {string} prospectId - ID du prospect
   * @param {string} status - Statut (pending, synced, failed, skipped)
   * @param {string|null} contactId - ID du contact Google
   * @param {string|null} error - Message d'erreur
   */
  async updateSyncStatus(prospectId, status, contactId = null, error = null) {
    try {
      const query = `
        UPDATE prospects SET
          google_sync_status = $1,
          google_contact_id = COALESCE($2, google_contact_id),
          google_last_sync = NOW(),
          google_sync_error = $3
        WHERE id = $4
      `;
      await pool.query(query, [status, contactId, error, prospectId]);
    } catch (err) {
      console.error(`❌ updateSyncStatus error:`, err.message);
    }
  }

  /**
   * Synchroniser tous les prospects en attente pour une ville
   * @param {string} villeId - ID de la ville
   * @param {number} limit - Nombre max de prospects à traiter
   * @returns {Promise<{synced: number, failed: number, skipped: number}>}
   */
  async syncPendingForCity(villeId, limit = 50) {
    const stats = { synced: 0, failed: 0, skipped: 0 };

    try {
      // Récupérer les prospects en attente de sync
      const { rows: prospects } = await pool.query(`
        SELECT
          p.id,
          p.phone_international,
          p.nom,
          p.prenom,
          p.ville_id,
          p.google_contact_id,
          c.name as ville_name,
          s.name as segment_name
        FROM prospects p
        LEFT JOIN cities c ON p.ville_id = c.id
        LEFT JOIN segments s ON p.segment_id = s.id
        WHERE p.ville_id = $1
          AND (p.google_sync_status = 'pending' OR p.google_sync_status = 'failed')
        ORDER BY p.created_at ASC
        LIMIT $2
      `, [villeId, limit]);

      console.log(`📤 Google Contacts: ${prospects.length} prospects à synchroniser pour ville ${villeId}`);

      for (const prospect of prospects) {
        const result = await this.syncProspect(prospect);
        if (result.success) {
          stats.synced++;
        } else if (result.reason?.includes('non configuré')) {
          stats.skipped++;
        } else {
          stats.failed++;
        }

        // Petite pause pour respecter les quotas Google
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      return stats;

    } catch (error) {
      console.error(`❌ syncPendingForCity error:`, error.message);
      return stats;
    }
  }

  /**
   * Synchroniser tous les prospects en attente (toutes villes)
   * @param {number} limitPerCity - Nombre max par ville
   * @returns {Promise<{total: number, synced: number, failed: number, skipped: number}>}
   */
  async syncAllPending(limitPerCity = 50) {
    const totalStats = { total: 0, synced: 0, failed: 0, skipped: 0 };

    try {
      // Récupérer les villes avec sync activé
      const { rows: cities } = await pool.query(`
        SELECT id, name FROM cities WHERE google_sync_enabled = true
      `);

      console.log(`🔄 Google Contacts: Sync de ${cities.length} villes`);

      for (const city of cities) {
        const stats = await this.syncPendingForCity(city.id, limitPerCity);
        totalStats.synced += stats.synced;
        totalStats.failed += stats.failed;
        totalStats.skipped += stats.skipped;
      }

      totalStats.total = totalStats.synced + totalStats.failed + totalStats.skipped;
      return totalStats;

    } catch (error) {
      console.error(`❌ syncAllPending error:`, error.message);
      return totalStats;
    }
  }

  /**
   * Tester la connexion Google pour une ville
   * @param {string} villeId - ID de la ville
   * @returns {Promise<{success: boolean, message: string, email?: string}>}
   */
  async testConnection(villeId) {
    try {
      const auth = await this.getAuthClient(villeId);
      if (!auth) {
        return { success: false, message: 'Token non configuré ou sync désactivé' };
      }

      const people = google.people({ version: 'v1', auth });

      // Tester en listant les contacts (fonctionne avec le scope 'contacts' seulement)
      // On ne récupère qu'un seul contact pour minimiser la charge
      const response = await people.people.connections.list({
        resourceName: 'people/me',
        pageSize: 1,
        personFields: 'names'
      });

      const totalContacts = response.data.totalPeople || 0;

      return {
        success: true,
        message: `Connexion OK`,
        email: `${totalContacts} contacts dans le compte`
      };

    } catch (error) {
      return {
        success: false,
        message: `Erreur: ${error.message}`
      };
    }
  }

  /**
   * Obtenir les statistiques de synchronisation pour une ville
   * @param {string} villeId - ID de la ville
   * @returns {Promise<Object>}
   */
  async getStatsForCity(villeId) {
    try {
      const { rows } = await pool.query(`
        SELECT
          COUNT(*) as total,
          COUNT(CASE WHEN google_sync_status = 'synced' THEN 1 END) as synced,
          COUNT(CASE WHEN google_sync_status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN google_sync_status = 'failed' THEN 1 END) as failed,
          COUNT(CASE WHEN google_sync_status = 'skipped' THEN 1 END) as skipped
        FROM prospects
        WHERE ville_id = $1
      `, [villeId]);

      return rows[0];

    } catch (error) {
      console.error(`❌ getStatsForCity error:`, error.message);
      return { total: 0, synced: 0, pending: 0, failed: 0, skipped: 0 };
    }
  }

  /**
   * Retry automatique des prospects en erreur après 10 minutes
   * Récupère les prospects 'failed' dont le dernier sync date de plus de 10 minutes
   * et les re-synchronise
   * @returns {Promise<{retried: number, synced: number, failed: number}>}
   */
  async retryFailedProspects() {
    const stats = { retried: 0, synced: 0, failed: 0 };

    try {
      // Récupérer les prospects failed depuis plus de 10 minutes
      // pour les villes avec sync activé
      const { rows: failedProspects } = await pool.query(`
        SELECT p.id, p.phone_international, p.nom, p.prenom, p.ville_id,
               p.google_contact_id, c.name as ville_name, s.name as segment_name
        FROM prospects p
        JOIN cities c ON c.id = p.ville_id
        LEFT JOIN segments s ON s.id = p.segment_id
        WHERE p.google_sync_status = 'failed'
          AND c.google_sync_enabled = true
          AND p.google_last_sync < NOW() - INTERVAL '10 minutes'
        ORDER BY p.google_last_sync ASC
        LIMIT 100
      `);

      if (failedProspects.length === 0) {
        return stats;
      }

      console.log(`🔄 Auto-retry: ${failedProspects.length} prospects en erreur à re-synchroniser`);
      stats.retried = failedProspects.length;

      for (const prospect of failedProspects) {
        try {
          const result = await this.syncProspect(prospect);
          if (result.success) {
            stats.synced++;
          } else {
            stats.failed++;
          }
          // Pause de 100ms entre chaque sync pour respecter les quotas Google
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          stats.failed++;
          console.error(`❌ Auto-retry error for prospect ${prospect.id}:`, err.message);
        }
      }

      console.log(`✅ Auto-retry terminé: ${stats.synced} réussis, ${stats.failed} échoués`);
      return stats;

    } catch (error) {
      console.error(`❌ retryFailedProspects error:`, error.message);
      return stats;
    }
  }
}

// Export singleton
export const googleContactsService = new GoogleContactsService();
export default googleContactsService;
