import express from 'express';
import pool from '../config/database.js';

const router = express.Router();

// Provider configuration
const PROVIDERS = ['claude', 'openai', 'gemini', 'deepseek', 'groq'];

// GET /api/ai-settings - Get AI configuration (multi-provider)
router.get('/', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const result = await pool.query(`
      SELECT key, value FROM app_settings
      WHERE key LIKE 'ai_%'
    `);

    // Convert to object, mask API keys
    const settings = {};
    result.rows.forEach(row => {
      // Mask any API key field
      if (row.key.includes('_api_key') && row.value) {
        settings[row.key] = row.value.length > 4
          ? '*'.repeat(row.value.length - 4) + row.value.slice(-4)
          : '****';
        settings[row.key + '_configured'] = true;
      } else {
        settings[row.key] = row.value;
      }
    });

    // Legacy support: map old single-provider settings to new format
    if (settings.ai_api_key_configured && settings.ai_provider) {
      const provider = settings.ai_provider;
      if (!settings[`ai_${provider}_api_key_configured`]) {
        settings[`ai_${provider}_api_key_configured`] = true;
        settings[`ai_${provider}_model`] = settings.ai_model;
        settings[`ai_${provider}_enabled`] = settings.ai_enabled;
      }
    }

    res.json(settings);
  } catch (error) {
    console.error('Error fetching AI settings:', error);
    res.status(500).json({ error: 'Failed to fetch AI settings' });
  }
});

// GET /api/ai-settings/status - Get AI configuration status (for all users)
router.get('/status', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT key, value FROM app_settings
      WHERE key IN ('ai_provider', 'ai_api_key', 'ai_enabled')
    `);

    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });

    const isConfigured = Boolean(
      settings.ai_provider &&
      settings.ai_api_key &&
      settings.ai_enabled === 'true'
    );

    res.json({
      configured: isConfigured,
      provider: settings.ai_provider || null,
      enabled: settings.ai_enabled === 'true'
    });
  } catch (error) {
    console.error('Error fetching AI status:', error);
    res.status(500).json({ error: 'Failed to fetch AI status' });
  }
});

// POST /api/ai-settings - Save AI configuration (multi-provider)
router.post('/', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      // Legacy single provider
      ai_provider, ai_api_key, ai_model, ai_enabled,
      // Multi-provider settings
      ai_primary_provider,
      ai_fallback_enabled,
      // Claude
      ai_claude_api_key, ai_claude_model, ai_claude_enabled,
      // OpenAI
      ai_openai_api_key, ai_openai_model, ai_openai_enabled,
      // Gemini
      ai_gemini_api_key, ai_gemini_model, ai_gemini_enabled,
      // DeepSeek
      ai_deepseek_api_key, ai_deepseek_model, ai_deepseek_enabled,
      // Groq
      ai_groq_api_key, ai_groq_model, ai_groq_enabled
    } = req.body;

    const settings = [];

    // Multi-provider settings
    if (ai_primary_provider !== undefined) {
      settings.push({ key: 'ai_primary_provider', value: ai_primary_provider || 'gemini' });
    }
    if (ai_fallback_enabled !== undefined) {
      settings.push({ key: 'ai_fallback_enabled', value: ai_fallback_enabled ? 'true' : 'false' });
    }

    // Claude settings
    if (ai_claude_api_key && !ai_claude_api_key.includes('*')) {
      settings.push({ key: 'ai_claude_api_key', value: ai_claude_api_key });
    }
    if (ai_claude_model !== undefined) {
      settings.push({ key: 'ai_claude_model', value: ai_claude_model || '' });
    }
    if (ai_claude_enabled !== undefined) {
      settings.push({ key: 'ai_claude_enabled', value: ai_claude_enabled ? 'true' : 'false' });
    }

    // OpenAI settings
    if (ai_openai_api_key && !ai_openai_api_key.includes('*')) {
      settings.push({ key: 'ai_openai_api_key', value: ai_openai_api_key });
    }
    if (ai_openai_model !== undefined) {
      settings.push({ key: 'ai_openai_model', value: ai_openai_model || '' });
    }
    if (ai_openai_enabled !== undefined) {
      settings.push({ key: 'ai_openai_enabled', value: ai_openai_enabled ? 'true' : 'false' });
    }

    // Gemini settings
    if (ai_gemini_api_key && !ai_gemini_api_key.includes('*')) {
      settings.push({ key: 'ai_gemini_api_key', value: ai_gemini_api_key });
    }
    if (ai_gemini_model !== undefined) {
      settings.push({ key: 'ai_gemini_model', value: ai_gemini_model || '' });
    }
    if (ai_gemini_enabled !== undefined) {
      settings.push({ key: 'ai_gemini_enabled', value: ai_gemini_enabled ? 'true' : 'false' });
    }

    // DeepSeek settings
    if (ai_deepseek_api_key && !ai_deepseek_api_key.includes('*')) {
      settings.push({ key: 'ai_deepseek_api_key', value: ai_deepseek_api_key });
    }
    if (ai_deepseek_model !== undefined) {
      settings.push({ key: 'ai_deepseek_model', value: ai_deepseek_model || '' });
    }
    if (ai_deepseek_enabled !== undefined) {
      settings.push({ key: 'ai_deepseek_enabled', value: ai_deepseek_enabled ? 'true' : 'false' });
    }

    // Groq settings
    if (ai_groq_api_key && !ai_groq_api_key.includes('*')) {
      settings.push({ key: 'ai_groq_api_key', value: ai_groq_api_key });
    }
    if (ai_groq_model !== undefined) {
      settings.push({ key: 'ai_groq_model', value: ai_groq_model || '' });
    }
    if (ai_groq_enabled !== undefined) {
      settings.push({ key: 'ai_groq_enabled', value: ai_groq_enabled ? 'true' : 'false' });
    }

    // Legacy support: single provider settings
    if (ai_provider !== undefined) {
      settings.push({ key: 'ai_provider', value: ai_provider || '' });
    }
    if (ai_api_key && !ai_api_key.includes('*')) {
      settings.push({ key: 'ai_api_key', value: ai_api_key });
    }
    if (ai_model !== undefined) {
      settings.push({ key: 'ai_model', value: ai_model || '' });
    }
    if (ai_enabled !== undefined) {
      settings.push({ key: 'ai_enabled', value: ai_enabled ? 'true' : 'false' });
    }

    for (const setting of settings) {
      await pool.query(`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()
      `, [setting.key, setting.value]);
    }

    res.json({ success: true, message: 'AI settings saved successfully' });
  } catch (error) {
    console.error('Error saving AI settings:', error);
    res.status(500).json({ error: 'Failed to save AI settings' });
  }
});

// GET /api/ai-settings/models - Get available models for a provider
router.get('/models', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { provider } = req.query;

    // Get API key from database - try provider-specific key first, then legacy
    const result = await pool.query(`
      SELECT key, value FROM app_settings
      WHERE key IN ('ai_${provider}_api_key', 'ai_api_key')
    `);

    const keyMap = {};
    result.rows.forEach(row => { keyMap[row.key] = row.value; });
    const apiKey = keyMap[`ai_${provider}_api_key`] || keyMap['ai_api_key'];

    if (!apiKey) {
      return res.status(400).json({ error: 'API key not configured for ' + provider });
    }

    let models = [];

    if (provider === 'gemini') {
      // Fetch models from Google Gemini API
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

      if (response.ok) {
        const data = await response.json();
        models = data.models
          .filter(m => m.supportedGenerationMethods?.includes('generateContent'))
          .map(m => ({
            id: m.name.replace('models/', ''),
            name: m.displayName || m.name.replace('models/', ''),
            description: m.description || ''
          }))
          .sort((a, b) => {
            // Sort to put flash/recommended models first
            if (a.id.includes('flash') && !b.id.includes('flash')) return -1;
            if (!a.id.includes('flash') && b.id.includes('flash')) return 1;
            return a.name.localeCompare(b.name);
          });
      } else {
        const error = await response.json();
        return res.status(400).json({ error: error.error?.message || 'Failed to fetch models' });
      }
    } else if (provider === 'openai') {
      // OpenAI models (static list - API requires different endpoint)
      models = [
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Rapide, économique)' },
        { id: 'gpt-4o', name: 'GPT-4o (Plus puissant)' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      ];
    } else if (provider === 'claude') {
      // Claude models (static list)
      models = [
        { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Recommandé)' },
        { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Rapide)' },
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (Plus puissant)' },
      ];
    } else if (provider === 'deepseek') {
      // DeepSeek models (static list)
      models = [
        { id: 'deepseek-chat', name: 'DeepSeek Chat (Recommandé)' },
        { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)' },
      ];
    } else if (provider === 'groq') {
      // Groq models (static list)
      models = [
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Recommandé)' },
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Ultra rapide)' },
        { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
        { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
      ];
    }

    res.json({ models });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

// POST /api/ai-settings/test - Test AI connection (supports specific provider via query param)
router.post('/test', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { provider: specificProvider } = req.query;

    // Get all AI settings
    const result = await pool.query(`
      SELECT key, value FROM app_settings
      WHERE key LIKE 'ai_%'
    `);

    const allSettings = {};
    result.rows.forEach(row => {
      allSettings[row.key] = row.value;
    });

    // Determine which provider to test
    let providerToTest = specificProvider || allSettings.ai_primary_provider || allSettings.ai_provider;

    // Get provider-specific settings, fallback to legacy
    const apiKey = allSettings[`ai_${providerToTest}_api_key`] || allSettings.ai_api_key;
    const model = allSettings[`ai_${providerToTest}_model`] || allSettings.ai_model;

    if (!providerToTest || !apiKey) {
      return res.status(400).json({ error: `Configuration manquante pour ${providerToTest || 'IA'}` });
    }

    // Test connection based on provider
    let testResult = { success: false, message: '', provider: providerToTest };

    try {
      if (providerToTest === 'claude') {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: model || 'claude-3-haiku-20240307',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Test' }]
          })
        });

        if (response.ok) {
          testResult = { success: true, message: 'Connexion à Claude API réussie', provider: 'claude' };
        } else {
          const error = await response.json();
          testResult = { success: false, message: error.error?.message || 'Connection failed', provider: 'claude' };
        }
      } else if (providerToTest === 'openai') {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model || 'gpt-4o-mini',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Test' }]
          })
        });

        if (response.ok) {
          testResult = { success: true, message: 'Connexion à OpenAI API réussie', provider: 'openai' };
        } else {
          const error = await response.json();
          testResult = { success: false, message: error.error?.message || 'Connection failed', provider: 'openai' };
        }
      } else if (providerToTest === 'gemini') {
        const modelName = model || 'gemini-2.0-flash';
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Test' }] }]
          })
        });

        if (response.ok) {
          testResult = { success: true, message: 'Connexion à Gemini API réussie', provider: 'gemini' };
        } else {
          const error = await response.json();
          testResult = { success: false, message: error.error?.message || 'Connection failed' };
        }
      } else if (providerToTest === 'deepseek') {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model || 'deepseek-chat',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Test' }]
          })
        });

        if (response.ok) {
          testResult = { success: true, message: 'Connexion à DeepSeek API réussie', provider: 'deepseek' };
        } else {
          const error = await response.json();
          testResult = { success: false, message: error.error?.message || 'Connection failed', provider: 'deepseek' };
        }
      } else if (providerToTest === 'groq') {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model || 'llama-3.3-70b-versatile',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Test' }]
          })
        });

        if (response.ok) {
          testResult = { success: true, message: 'Connexion à Groq API réussie', provider: 'groq' };
        } else {
          const error = await response.json();
          testResult = { success: false, message: error.error?.message || 'Connection failed', provider: 'groq' };
        }
      }
    } catch (fetchError) {
      testResult = { success: false, message: `Network error: ${fetchError.message}` };
    }

    res.json(testResult);
  } catch (error) {
    console.error('Error testing AI connection:', error);
    res.status(500).json({ error: 'Failed to test AI connection' });
  }
});

// POST /api/ai-settings/analyze - Run AI analysis on prospects data (with fallback support)
router.post('/analyze', async (req, res) => {
  try {
    const { indicators, filters } = req.body;

    // Get all AI settings
    const settingsResult = await pool.query(`
      SELECT key, value FROM app_settings
      WHERE key LIKE 'ai_%'
    `);

    const settings = {};
    settingsResult.rows.forEach(row => {
      settings[row.key] = row.value;
    });

    // Build list of available providers (enabled with API key)
    const availableProviders = [];

    // Check each provider
    for (const provider of PROVIDERS) {
      const apiKey = settings[`ai_${provider}_api_key`];
      const enabled = settings[`ai_${provider}_enabled`] === 'true';

      if (apiKey && enabled) {
        availableProviders.push({
          name: provider,
          apiKey,
          model: settings[`ai_${provider}_model`]
        });
      }
    }

    // Legacy fallback: check old single-provider settings
    if (availableProviders.length === 0 && settings.ai_provider && settings.ai_api_key) {
      if (settings.ai_enabled === 'true') {
        availableProviders.push({
          name: settings.ai_provider,
          apiKey: settings.ai_api_key,
          model: settings.ai_model
        });
      }
    }

    if (availableProviders.length === 0) {
      return res.status(400).json({
        error: 'AI not configured',
        code: 'AI_NOT_CONFIGURED',
        message: 'Aucun fournisseur IA n\'est configuré et activé. Contactez l\'administrateur.'
      });
    }

    // Determine provider order (primary first, then others)
    const primaryProvider = settings.ai_primary_provider || availableProviders[0]?.name;
    const fallbackEnabled = settings.ai_fallback_enabled === 'true';

    // Sort providers: primary first, then others
    availableProviders.sort((a, b) => {
      if (a.name === primaryProvider) return -1;
      if (b.name === primaryProvider) return 1;
      return 0;
    });

    // Build the analysis prompt
    const prompt = buildAnalysisPrompt(indicators, filters);

    // Try providers in order with fallback
    let aiResponse = null;
    let usedProvider = null;
    let usedModel = null;
    const errors = [];

    for (const provider of availableProviders) {
      try {
        console.log(`🤖 Trying AI provider: ${provider.name}`);

        if (provider.name === 'claude') {
          aiResponse = await callClaudeAPI(provider.apiKey, provider.model, prompt);
        } else if (provider.name === 'openai') {
          aiResponse = await callOpenAIAPI(provider.apiKey, provider.model, prompt);
        } else if (provider.name === 'gemini') {
          aiResponse = await callGeminiAPI(provider.apiKey, provider.model, prompt);
        } else if (provider.name === 'deepseek') {
          aiResponse = await callDeepSeekAPI(provider.apiKey, provider.model, prompt);
        } else if (provider.name === 'groq') {
          aiResponse = await callGroqAPI(provider.apiKey, provider.model, prompt);
        }

        usedProvider = provider.name;
        usedModel = provider.model;
        console.log(`✅ AI response received from ${provider.name}`);
        break; // Success - exit loop

      } catch (apiError) {
        console.error(`❌ ${provider.name} API error:`, apiError.message);
        errors.push({ provider: provider.name, error: apiError.message });

        // If fallback is disabled, don't try other providers
        if (!fallbackEnabled) {
          return res.status(500).json({
            error: 'AI API error',
            message: `Erreur ${provider.name}: ${apiError.message}`,
            provider: provider.name
          });
        }
        // Continue to next provider
      }
    }

    if (!aiResponse) {
      return res.status(500).json({
        error: 'All AI providers failed',
        message: 'Tous les fournisseurs IA ont échoué. Réessayez plus tard.',
        errors
      });
    }

    res.json({
      success: true,
      analysis: aiResponse,
      provider: usedProvider,
      model: usedModel,
      fallbackUsed: usedProvider !== primaryProvider
    });

  } catch (error) {
    console.error('Error running AI analysis:', error);
    res.status(500).json({ error: 'Failed to run AI analysis' });
  }
});

// Helper function to build the analysis prompt with pre-calculated indicators
function buildAnalysisPrompt(indicators, filters) {
  const { current, previous, ecart } = indicators;

  // ===== CALCULS PRÉ-TRAITÉS CÔTÉ SERVEUR =====
  const total = current.total || 0;
  const nonContactes = current.non_contactes || 0;
  const totalContactes = total - nonContactes;
  const avecRdv = current.avec_rdv || 0;
  const inscritsProspect = current.inscrits_prospect || 0;
  const inscritsSession = current.inscrits_session || 0;

  // Taux calculés
  const tauxContact = total > 0 ? ((totalContactes / total) * 100).toFixed(1) : 0;
  const tauxRDV = totalContactes > 0 ? ((avecRdv / totalContactes) * 100).toFixed(1) : 0;
  const tauxConversion = total > 0 ? ((inscritsProspect / total) * 100).toFixed(1) : 0;
  const tauxShowUp = avecRdv > 0 ? ((inscritsSession / avecRdv) * 100).toFixed(1) : 0;

  // Objectifs et écarts
  const objectifMensuel = current.inscription_objective || null;
  const ecartObjectif = current.inscription_gap !== undefined ? current.inscription_gap : null;
  const joursOuvresTotal = current.total_working_days || 22;
  const joursOuvresEcoules = current.elapsed_working_days || 0;
  const joursRestants = joursOuvresTotal - joursOuvresEcoules;
  const objectifQuotidien = current.daily_objective?.toFixed(1) || null;

  // Productivité
  const productiviteActuelle = joursOuvresEcoules > 0 ? (inscritsProspect / joursOuvresEcoules).toFixed(2) : 0;
  const projectionFinMois = joursOuvresTotal > 0 ? Math.round(productiviteActuelle * joursOuvresTotal) : 0;

  // Évolutions vs période précédente
  const evolTotal = previous?.total ? (((total - previous.total) / previous.total) * 100).toFixed(1) : null;
  const evolInscrits = previous?.inscrits_prospect !== undefined ? (inscritsProspect - previous.inscrits_prospect) : null;

  // Détermination des statuts pour les KPIs
  const getStatus = (value, good, warning) => {
    const v = parseFloat(value);
    if (v >= good) return 'good';
    if (v >= warning) return 'warning';
    return 'critical';
  };

  return `# ANALYSE COMMERCIALE - CENTRE DE FORMATION PROLEAN

## TON RÔLE
Tu es le **Directeur Commercial virtuel** de PROLEAN, centre de formation professionnelle au Maroc.
Ta mission: **MAXIMISER LES INSCRIPTIONS** en analysant les données et proposant des actions concrètes.

## CONTEXTE BUSINESS PROLEAN
- **Activité**: Formation professionnelle (comptabilité, paie, RH, fiscalité, informatique)
- **Cibles**: Jeunes diplômés, comptables en reconversion, entreprises
- **Modèle**: Prospection téléphonique → RDV au centre → Inscription → Formation
- **Cycle de vente**: 1-2 semaines (décision rapide)
- **Périodes de pic**: Septembre-Octobre (rentrée), Janvier-Février (nouvelle année)
- **Objectif principal**: Convertir un maximum de prospects en inscrits

---

## INDICATEURS CALCULÉS (Période actuelle)

### Pipeline Commercial
| Métrique | Valeur | Cible Recommandée | Statut |
|----------|--------|-------------------|--------|
| Total prospects | ${total} | - | - |
| Non contactés | ${nonContactes} | < 20% du total | ${nonContactes/total*100 > 20 ? '⚠️ Trop élevé' : '✅ OK'} |
| **Taux de contact** | ${tauxContact}% | > 80% | ${getStatus(tauxContact, 80, 60) === 'good' ? '✅' : getStatus(tauxContact, 80, 60) === 'warning' ? '⚠️' : '🔴'} |
| **Taux de RDV** | ${tauxRDV}% | > 25% | ${getStatus(tauxRDV, 25, 15) === 'good' ? '✅' : getStatus(tauxRDV, 25, 15) === 'warning' ? '⚠️' : '🔴'} |
| **Taux de conversion** | ${tauxConversion}% | > 5% | ${getStatus(tauxConversion, 5, 3) === 'good' ? '✅' : getStatus(tauxConversion, 5, 3) === 'warning' ? '⚠️' : '🔴'} |
| **Taux de show-up** | ${tauxShowUp}% | > 60% | ${getStatus(tauxShowUp, 60, 40) === 'good' ? '✅' : getStatus(tauxShowUp, 60, 40) === 'warning' ? '⚠️' : '🔴'} |

### Suivi des Objectifs d'Inscription
| Métrique | Valeur |
|----------|--------|
| Objectif mensuel | ${objectifMensuel || 'Non défini'} |
| Inscrits actuels (prospects) | ${inscritsProspect} |
| Inscrits actuels (sessions) | ${inscritsSession} |
| **Écart vs objectif** | ${ecartObjectif !== null ? (ecartObjectif >= 0 ? '+' + ecartObjectif : ecartObjectif) : 'N/A'} |
| Jours ouvrés écoulés | ${joursOuvresEcoules} / ${joursOuvresTotal} |
| Jours ouvrés restants | ${joursRestants} |
| Objectif/jour requis | ${objectifQuotidien || 'N/A'} inscriptions/jour |
| Productivité actuelle | ${productiviteActuelle} inscriptions/jour |
| **Projection fin de mois** | ${projectionFinMois} inscriptions |

### Comparaison Période Précédente
| Métrique | Actuel | Précédent | Évolution |
|----------|--------|-----------|-----------|
| Total prospects | ${total} | ${previous?.total || '-'} | ${evolTotal ? evolTotal + '%' : '-'} |
| Inscrits | ${inscritsProspect} | ${previous?.inscrits_prospect ?? '-'} | ${evolInscrits !== null ? (evolInscrits >= 0 ? '+' + evolInscrits : evolInscrits) : '-'} |

### Écarts de Données (Qualité)
- Inscrits en session mais pas marqués comme prospect inscrit: ${ecart?.ecart_session?.count || 0}
- Prospects marqués "inscrit" mais pas dans session: ${ecart?.ecart_prospect?.count || 0}

---

## FILTRES APPLIQUÉS
- Segment: ${filters?.segment_id ? 'Filtré sur segment #' + filters.segment_id : 'Tous les segments'}
- Ville: ${filters?.ville_id ? 'Filtré sur ville #' + filters.ville_id : 'Toutes les villes'}

---

## INSTRUCTIONS D'ANALYSE

### 1. DIAGNOSTIC RAPIDE (3-4 phrases max)
Évalue l'état de santé du pipeline et identifie LE problème principal qui bloque les inscriptions.
Base-toi sur les indicateurs calculés ci-dessus.

### 2. INDICATEURS CLÉS (JSON pour graphiques)
Retourne ce JSON avec les valeurs EXACTES calculées ci-dessus:
\`\`\`json
{
  "healthScore": <0-100 basé sur: tauxContact(30%) + tauxRDV(25%) + tauxConversion(25%) + tauxShowUp(20%)>,
  "kpis": [
    {"name": "Taux de contact", "value": ${tauxContact}, "target": 80, "unit": "%", "status": "${getStatus(tauxContact, 80, 60)}"},
    {"name": "Taux de RDV", "value": ${tauxRDV}, "target": 25, "unit": "%", "status": "${getStatus(tauxRDV, 25, 15)}"},
    {"name": "Taux de conversion", "value": ${tauxConversion}, "target": 5, "unit": "%", "status": "${getStatus(tauxConversion, 5, 3)}"},
    {"name": "Taux de show-up", "value": ${tauxShowUp}, "target": 60, "unit": "%", "status": "${getStatus(tauxShowUp, 60, 40)}"},
    {"name": "Inscriptions", "value": ${inscritsProspect}, "target": ${objectifMensuel || inscritsProspect + 10}, "unit": "", "status": "${ecartObjectif !== null && ecartObjectif >= 0 ? 'good' : ecartObjectif !== null && ecartObjectif >= -5 ? 'warning' : 'critical'}"}
  ],
  "trends": [
    {"metric": "Prospects", "current": ${total}, "previous": ${previous?.total || 0}, "change": ${evolTotal || 0}, "trend": "${evolTotal > 0 ? 'up' : evolTotal < 0 ? 'down' : 'stable'}"},
    {"metric": "Inscriptions", "current": ${inscritsProspect}, "previous": ${previous?.inscrits_prospect || 0}, "change": ${evolInscrits || 0}, "trend": "${evolInscrits > 0 ? 'up' : evolInscrits < 0 ? 'down' : 'stable'}"}
  ],
  "funnelData": [
    {"stage": "Prospects", "count": ${total}},
    {"stage": "Contactés", "count": ${totalContactes}},
    {"stage": "RDV obtenus", "count": ${avecRdv}},
    {"stage": "Inscrits", "count": ${inscritsSession}}
  ]
}
\`\`\`

### 3. RECOMMANDATIONS DÉTAILLÉES (JSON)
Maximum 5 recommandations, ordonnées par priorité. Pour CHAQUE recommandation, explique:
- **context**: Pourquoi cette recommandation ? Quel indicateur est problématique ?
- **expectedImpact**: Combien d'inscriptions supplémentaires ?
- **responsable**: Qui doit agir ?
- **timeframe**: Quand agir ?

\`\`\`json
{
  "recommendations": [
    {
      "priority": "urgent|high|medium",
      "title": "Titre action (max 50 caractères)",
      "description": "Action concrète et précise à réaliser",
      "context": "Basé sur [indicateur] qui est à [X%] vs cible de [Y%]. Cela signifie que...",
      "expectedImpact": "+X inscriptions potentielles",
      "responsable": "Assistante commerciale|Manager|Direction",
      "timeframe": "Immédiat|Cette semaine|Ce mois",
      "kpiToTrack": "Indicateur à surveiller pour mesurer le succès"
    }
  ]
}
\`\`\`

### 4. SYNTHÈSE FINALE (JSON) - TRÈS IMPORTANT
Donne une vision globale et une recommandation finale:
\`\`\`json
{
  "globalAssessment": {
    "status": "critique|attention|bon|excellent",
    "summary": "Résumé de la situation en 2-3 phrases. Soyez direct et factuel.",
    "topPriority": "L'ACTION UNIQUE la plus importante à faire MAINTENANT pour augmenter les inscriptions",
    "projection": "Avec les actions proposées: estimation de X inscriptions fin de période",
    "risk": "Sans action: risque de X inscriptions manquées vs objectif"
  }
}
\`\`\`

### 5. ALERTES CRITIQUES (si applicable)
Liste les situations nécessitant une intervention IMMÉDIATE (dans les 24-48h).

---

## RÈGLES IMPORTANTES
1. **CONCRET**: Pas de conseils génériques. Actions précises avec qui/quoi/quand
2. **CHIFFRÉ**: Quantifie l'impact de chaque recommandation
3. **CONTEXTUALISÉ**: Explique POURQUOI chaque recommandation est faite (quel indicateur)
4. **RÉALISTE**: Adapté au contexte marocain et aux ressources d'un centre de formation
5. **PRIORISÉ**: Max 5 recommandations, la plus urgente en premier
6. **ACTIONNABLE**: Chaque recommandation doit pouvoir être mise en œuvre immédiatement

Tous les blocs JSON doivent être valides et parsables.`;
}

// Helper function to call Claude API
async function callClaudeAPI(apiKey, model, prompt) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: model || 'claude-3-haiku-20240307',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Claude API error');
  }

  const data = await response.json();
  return data.content[0].text;
}

// Helper function to call OpenAI API
async function callOpenAIAPI(apiKey, model, prompt) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      max_tokens: 4000,
      messages: [
        { role: 'system', content: 'Tu es un expert en analyse commerciale CRM.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'OpenAI API error');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Helper function to call Gemini API
async function callGeminiAPI(apiKey, model, prompt) {
  const modelName = model || 'gemini-2.0-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 4000 }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Gemini API error');
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

// Helper function to call DeepSeek API
async function callDeepSeekAPI(apiKey, model, prompt) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'deepseek-chat',
      max_tokens: 4000,
      messages: [
        { role: 'system', content: 'Tu es un expert en analyse commerciale CRM.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'DeepSeek API error');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// Helper function to call Groq API
async function callGroqAPI(apiKey, model, prompt) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: model || 'llama-3.3-70b-versatile',
      max_tokens: 4000,
      messages: [
        { role: 'system', content: 'Tu es un expert en analyse commerciale CRM.' },
        { role: 'user', content: prompt }
      ]
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Groq API error');
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

export default router;
