/**
 * Google OAuth Routes
 *
 * Gère le flux OAuth 2.0 pour connecter Google Contacts aux villes
 */

import express from 'express';
import { google } from 'googleapis';
import pool from '../config/database.js';
import { authenticateToken, requirePermission } from '../middleware/auth.js';

const router = express.Router();

/**
 * Créer un client OAuth2 avec les credentials d'environnement
 */
const getOAuth2Client = () => {
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ||
    (process.env.NODE_ENV === 'production'
      ? 'https://spectacular-enthusiasm-production.up.railway.app/api/google-oauth/callback'
      : 'http://localhost:3001/api/google-oauth/callback');

  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    redirectUri
  );
};

/**
 * GET /api/google-oauth/authorize/:cityId
 * Initie le flux OAuth - retourne l'URL Google pour autorisation
 */
router.get('/authorize/:cityId',
  authenticateToken,
  requirePermission('admin.manage_system'),
  async (req, res) => {
    try {
      const { cityId } = req.params;

      // Vérifier que les credentials Google sont configurés
      if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
        return res.status(500).json({
          error: 'Configuration manquante',
          message: 'GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET doivent être configurés dans les variables d\'environnement'
        });
      }

      // Vérifier que la ville existe
      const { rows } = await pool.query(
        'SELECT id, name FROM cities WHERE id = $1',
        [cityId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Ville non trouvée' });
      }

      const oauth2Client = getOAuth2Client();

      // Générer le state encodé pour sécurité CSRF
      const state = Buffer.from(JSON.stringify({
        cityId,
        userId: req.user.id,
        timestamp: Date.now()
      })).toString('base64');

      // Générer l'URL d'autorisation Google
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',      // Nécessaire pour obtenir refresh_token
        prompt: 'consent',           // Force le consentement pour obtenir refresh_token à chaque fois
        scope: ['https://www.googleapis.com/auth/contacts'],
        state
      });

      console.log(`🔐 Google OAuth: URL générée pour ville ${rows[0].name} (${cityId})`);

      res.json({ authUrl });

    } catch (error) {
      console.error('❌ Google OAuth authorize error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/google-oauth/callback
 * Callback OAuth - échange le code contre les tokens
 * NOTE: Cette route est PUBLIQUE car c'est Google qui redirige l'utilisateur
 */
router.get('/callback', async (req, res) => {
  try {
    const { code, state, error: oauthError } = req.query;

    // Base URL pour les redirections frontend
    const frontendBase = process.env.NODE_ENV === 'production'
      ? ''  // En production, même domaine
      : 'http://localhost:5173';  // En dev, Vite sur port 5173

    // Gestion des erreurs OAuth de Google
    if (oauthError) {
      console.error(`❌ Google OAuth error from Google: ${oauthError}`);
      return res.redirect(`${frontendBase}/admin/commercialisation/google-contacts?error=${encodeURIComponent(oauthError)}`);
    }

    if (!code || !state) {
      console.error('❌ Google OAuth callback: missing code or state');
      return res.redirect(`${frontendBase}/admin/commercialisation/google-contacts?error=missing_params`);
    }

    // Décoder et valider le state
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch {
      console.error('❌ Google OAuth callback: invalid state format');
      return res.redirect(`${frontendBase}/admin/commercialisation/google-contacts?error=invalid_state`);
    }

    const { cityId, timestamp } = stateData;

    // Vérifier que le state n'est pas trop vieux (15 minutes max)
    if (Date.now() - timestamp > 15 * 60 * 1000) {
      console.error('❌ Google OAuth callback: state expired');
      return res.redirect(`${frontendBase}/admin/commercialisation/google-contacts?error=state_expired`);
    }

    // Vérifier que la ville existe
    const { rows: cityRows } = await pool.query(
      'SELECT id, name FROM cities WHERE id = $1',
      [cityId]
    );

    if (cityRows.length === 0) {
      console.error(`❌ Google OAuth callback: city ${cityId} not found`);
      return res.redirect(`${frontendBase}/admin/commercialisation/google-contacts?error=city_not_found`);
    }

    const oauth2Client = getOAuth2Client();

    // Échanger le code contre les tokens
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      console.warn('⚠️ Google OAuth: No refresh_token received. User may have already authorized the app.');
    }

    // Formater le token pour stockage (compatible avec le format existant)
    const tokenData = {
      token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      token_uri: 'https://oauth2.googleapis.com/token',
      expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null
    };

    // Sauvegarder le token et activer la sync
    await pool.query(
      'UPDATE cities SET google_token = $1, google_sync_enabled = true WHERE id = $2',
      [JSON.stringify(tokenData), cityId]
    );

    console.log(`✅ Google OAuth: Token sauvegardé pour ville ${cityRows[0].name} (${cityId})`);

    // Rediriger vers le frontend avec succès
    res.redirect(`${frontendBase}/admin/commercialisation/google-contacts?oauth_success=true&cityId=${cityId}`);

  } catch (error) {
    console.error('❌ Google OAuth callback error:', error);

    const frontendBase = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173';
    res.redirect(`${frontendBase}/admin/commercialisation/google-contacts?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * DELETE /api/google-oauth/revoke/:cityId
 * Déconnecte Google pour une ville
 */
router.delete('/revoke/:cityId',
  authenticateToken,
  requirePermission('admin.manage_system'),
  async (req, res) => {
    try {
      const { cityId } = req.params;

      // Vérifier que la ville existe
      const { rows } = await pool.query(
        'SELECT id, name FROM cities WHERE id = $1',
        [cityId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Ville non trouvée' });
      }

      // Supprimer le token et désactiver la sync
      await pool.query(
        'UPDATE cities SET google_token = NULL, google_sync_enabled = false WHERE id = $1',
        [cityId]
      );

      console.log(`🔓 Google OAuth: Déconnecté pour ville ${rows[0].name} (${cityId})`);

      res.json({ message: 'Google déconnecté avec succès' });

    } catch (error) {
      console.error('❌ Google OAuth revoke error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * GET /api/google-oauth/status
 * Vérifie si les credentials Google OAuth sont configurés
 */
router.get('/status',
  authenticateToken,
  requirePermission('admin.manage_system'),
  async (req, res) => {
    try {
      const configured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

      res.json({
        configured,
        message: configured
          ? 'Google OAuth est configuré'
          : 'GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET ne sont pas configurés'
      });

    } catch (error) {
      console.error('❌ Google OAuth status error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// ============================================================
// RÉAUTORISATION AVEC CREDENTIALS STOCKÉS (Desktop App)
// Ces routes utilisent les credentials stockés dans le token de la ville
// pour permettre la réautorisation quand le token expire
// ============================================================

/**
 * GET /api/google-oauth/reauthorize-url/:cityId
 * Génère l'URL d'autorisation Google en utilisant les credentials stockés dans le token de la ville
 * Pour les credentials de type "Desktop/installed" (redirect_uri = urn:ietf:wg:oauth:2.0:oob)
 */
router.get('/reauthorize-url/:cityId',
  authenticateToken,
  requirePermission('admin.manage_system'),
  async (req, res) => {
    try {
      const { cityId } = req.params;

      // Récupérer le token existant pour obtenir les credentials
      const { rows } = await pool.query(
        'SELECT id, name, google_token FROM cities WHERE id = $1',
        [cityId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Ville non trouvée' });
      }

      const city = rows[0];

      if (!city.google_token) {
        return res.status(400).json({
          error: 'Pas de token configuré',
          message: 'Aucun token Google n\'est configuré pour cette ville. Utilisez la configuration manuelle.'
        });
      }

      let tokenData;
      try {
        tokenData = JSON.parse(city.google_token);
      } catch {
        return res.status(400).json({ error: 'Token invalide' });
      }

      // Vérifier qu'on a les credentials nécessaires
      if (!tokenData.client_id || !tokenData.client_secret) {
        return res.status(400).json({
          error: 'Credentials manquants',
          message: 'Le token stocké ne contient pas client_id ou client_secret'
        });
      }

      // Créer le client OAuth avec les credentials stockés
      // Pour les apps Desktop, on utilise 'urn:ietf:wg:oauth:2.0:oob' qui affiche le code à l'écran
      const oauth2Client = new google.auth.OAuth2(
        tokenData.client_id,
        tokenData.client_secret,
        'urn:ietf:wg:oauth:2.0:oob'
      );

      // Générer l'URL d'autorisation
      // Scope contacts: pour créer/modifier/lire les contacts
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',  // Force le consentement pour obtenir un nouveau refresh_token
        scope: ['https://www.googleapis.com/auth/contacts']
      });

      console.log(`🔐 Google Reauthorize: URL générée pour ville ${city.name} (${cityId})`);

      res.json({
        authUrl,
        cityName: city.name,
        message: 'Ouvrez cette URL, autorisez l\'accès, puis copiez le code affiché'
      });

    } catch (error) {
      console.error('❌ Google reauthorize-url error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

/**
 * POST /api/google-oauth/exchange-code/:cityId
 * Échange un code d'autorisation contre un nouveau token
 * Body: { code: "4/0A..." }
 */
router.post('/exchange-code/:cityId',
  authenticateToken,
  requirePermission('admin.manage_system'),
  async (req, res) => {
    try {
      const { cityId } = req.params;
      const { code } = req.body;

      if (!code) {
        return res.status(400).json({ error: 'Code manquant' });
      }

      // Récupérer le token existant pour obtenir les credentials
      const { rows } = await pool.query(
        'SELECT id, name, google_token FROM cities WHERE id = $1',
        [cityId]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Ville non trouvée' });
      }

      const city = rows[0];

      if (!city.google_token) {
        return res.status(400).json({ error: 'Pas de token configuré pour cette ville' });
      }

      let tokenData;
      try {
        tokenData = JSON.parse(city.google_token);
      } catch {
        return res.status(400).json({ error: 'Token invalide' });
      }

      if (!tokenData.client_id || !tokenData.client_secret) {
        return res.status(400).json({ error: 'Credentials manquants dans le token' });
      }

      // Créer le client OAuth avec les credentials stockés
      const oauth2Client = new google.auth.OAuth2(
        tokenData.client_id,
        tokenData.client_secret,
        'urn:ietf:wg:oauth:2.0:oob'
      );

      // Échanger le code contre les tokens
      const { tokens } = await oauth2Client.getToken(code);

      if (!tokens.access_token) {
        return res.status(400).json({ error: 'Échec de l\'échange du code' });
      }

      // Mettre à jour le token stocké
      const newTokenData = {
        ...tokenData,
        token: tokens.access_token,
        refresh_token: tokens.refresh_token || tokenData.refresh_token, // Garder l'ancien si pas de nouveau
        expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null
      };

      // Sauvegarder le nouveau token
      await pool.query(
        'UPDATE cities SET google_token = $1, google_sync_enabled = true WHERE id = $2',
        [JSON.stringify(newTokenData), cityId]
      );

      // Remettre les prospects "failed" en "pending" pour qu'ils soient re-synchronisés
      const { rowCount } = await pool.query(
        `UPDATE prospects SET google_sync_status = 'pending', google_sync_error = NULL
         WHERE ville_id = $1 AND google_sync_status = 'failed'`,
        [cityId]
      );

      console.log(`✅ Google Reauthorize: Nouveau token sauvegardé pour ville ${city.name} (${cityId})`);
      if (rowCount > 0) {
        console.log(`📋 ${rowCount} prospects remis en attente de synchronisation`);
      }

      res.json({
        success: true,
        message: 'Token mis à jour avec succès',
        hasRefreshToken: !!tokens.refresh_token
      });

    } catch (error) {
      console.error('❌ Google exchange-code error:', error);

      // Message d'erreur plus explicite pour les erreurs courantes
      let errorMessage = error.message;
      if (error.message?.includes('invalid_grant')) {
        errorMessage = 'Code invalide ou expiré. Veuillez réessayer avec un nouveau code.';
      } else if (error.message?.includes('invalid_client')) {
        errorMessage = 'Credentials invalides. Vérifiez la configuration.';
      }

      res.status(400).json({ error: errorMessage });
    }
  }
);

export default router;
