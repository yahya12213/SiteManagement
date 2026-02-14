// @ts-nocheck
import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/lib/api/client';
import { useNavigate } from 'react-router-dom';
import {
  Brain,
  Key,
  Server,
  CheckCircle,
  XCircle,
  Loader2,
  Sparkles,
  Shield,
  ExternalLink,
  RefreshCw,
  ArrowRightLeft,
  Zap,
} from 'lucide-react';

interface AISettings {
  // Multi-provider settings
  ai_primary_provider?: string;
  ai_fallback_enabled?: string;
  // Claude
  ai_claude_api_key?: string;
  ai_claude_api_key_configured?: boolean;
  ai_claude_model?: string;
  ai_claude_enabled?: string;
  // OpenAI
  ai_openai_api_key?: string;
  ai_openai_api_key_configured?: boolean;
  ai_openai_model?: string;
  ai_openai_enabled?: string;
  // Gemini
  ai_gemini_api_key?: string;
  ai_gemini_api_key_configured?: boolean;
  ai_gemini_model?: string;
  ai_gemini_enabled?: string;
  // DeepSeek
  ai_deepseek_api_key?: string;
  ai_deepseek_api_key_configured?: boolean;
  ai_deepseek_model?: string;
  ai_deepseek_enabled?: string;
  // Groq
  ai_groq_api_key?: string;
  ai_groq_api_key_configured?: boolean;
  ai_groq_model?: string;
  ai_groq_enabled?: string;
  // Legacy
  ai_provider?: string;
  ai_api_key_configured?: boolean;
  ai_model?: string;
  ai_enabled?: string;
}

interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  color: string;
  bgColor: string;
  borderColor: string;
  defaultModels: { id: string; name: string }[];
  docUrl: string;
}

const providers: ProviderConfig[] = [
  {
    id: 'gemini',
    name: 'Gemini (Google)',
    description: 'Gratuit - Recommandé pour commencer',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500',
    defaultModels: [
      { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash (Rapide)' },
      { id: 'gemini-1.5-flash-latest', name: 'Gemini 1.5 Flash' },
      { id: 'gemini-1.5-pro-latest', name: 'Gemini 1.5 Pro' },
    ],
    docUrl: 'https://aistudio.google.com/app/apikey',
  },
  {
    id: 'openai',
    name: 'OpenAI (GPT)',
    description: 'Payant - Très performant',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
    defaultModels: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Économique)' },
      { id: 'gpt-4o', name: 'GPT-4o (Puissant)' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    ],
    docUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'claude',
    name: 'Claude (Anthropic)',
    description: 'Payant - Excellent pour l\'analyse',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-500',
    defaultModels: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (Recommandé)' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (Rapide)' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus (Puissant)' },
    ],
    docUrl: 'https://console.anthropic.com/',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    description: 'Économique - Très bon rapport qualité/prix',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-500',
    defaultModels: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat (Recommandé)' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner (R1)' },
    ],
    docUrl: 'https://platform.deepseek.com/api_keys',
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'Gratuit - Ultra rapide (LPU)',
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-500',
    defaultModels: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Recommandé)' },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B (Ultra rapide)' },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
      { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
    ],
    docUrl: 'https://console.groq.com/keys',
  },
];

export default function AISettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<AISettings>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { success: boolean; message: string }>>({});
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [dynamicModels, setDynamicModels] = useState<Record<string, { id: string; name: string }[]>>({});
  const [loadingModels, setLoadingModels] = useState<string | null>(null);

  // Check if user is admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Load settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data = await apiClient.get<AISettings>('/ai-settings');
        setSettings(data);

        // Migrate legacy settings if needed
        if (data.ai_provider && !data.ai_primary_provider) {
          setSettings(prev => ({
            ...prev,
            ai_primary_provider: data.ai_provider,
            [`ai_${data.ai_provider}_enabled`]: data.ai_enabled,
            [`ai_${data.ai_provider}_model`]: data.ai_model,
            [`ai_${data.ai_provider}_api_key_configured`]: data.ai_api_key_configured,
          }));
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []);

  // Load models for a provider
  const loadModels = async (providerId: string) => {
    if (!settings[`ai_${providerId}_api_key_configured`] && !settings.ai_api_key_configured) {
      return;
    }

    setLoadingModels(providerId);
    try {
      const result = await apiClient.get<{ models: { id: string; name: string }[] }>(
        `/ai-settings/models?provider=${providerId}`
      );
      setDynamicModels(prev => ({ ...prev, [providerId]: result.models }));
    } catch (err: any) {
      console.error(`Failed to load models for ${providerId}:`, err);
    } finally {
      setLoadingModels(null);
    }
  };

  // Auto-load Gemini models when configured
  useEffect(() => {
    if (settings.ai_gemini_api_key_configured || (settings.ai_provider === 'gemini' && settings.ai_api_key_configured)) {
      loadModels('gemini');
    }
  }, [settings.ai_gemini_api_key_configured, settings.ai_api_key_configured, settings.ai_provider]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      await apiClient.post('/ai-settings', {
        ai_primary_provider: settings.ai_primary_provider || 'gemini',
        ai_fallback_enabled: settings.ai_fallback_enabled === 'true',
        // Claude
        ai_claude_api_key: settings.ai_claude_api_key,
        ai_claude_model: settings.ai_claude_model,
        ai_claude_enabled: settings.ai_claude_enabled === 'true',
        // OpenAI
        ai_openai_api_key: settings.ai_openai_api_key,
        ai_openai_model: settings.ai_openai_model,
        ai_openai_enabled: settings.ai_openai_enabled === 'true',
        // Gemini
        ai_gemini_api_key: settings.ai_gemini_api_key,
        ai_gemini_model: settings.ai_gemini_model,
        ai_gemini_enabled: settings.ai_gemini_enabled === 'true',
        // DeepSeek
        ai_deepseek_api_key: settings.ai_deepseek_api_key,
        ai_deepseek_model: settings.ai_deepseek_model,
        ai_deepseek_enabled: settings.ai_deepseek_enabled === 'true',
        // Groq
        ai_groq_api_key: settings.ai_groq_api_key,
        ai_groq_model: settings.ai_groq_model,
        ai_groq_enabled: settings.ai_groq_enabled === 'true',
      });

      // Reload settings
      const data = await apiClient.get<AISettings>('/ai-settings');
      setSettings(data);

      setSuccessMessage('Configuration sauvegardée avec succès!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async (providerId: string) => {
    setTestingProvider(providerId);
    setTestResults(prev => ({ ...prev, [providerId]: undefined }));

    try {
      const result = await apiClient.post<{ success: boolean; message: string; provider: string }>(
        `/ai-settings/test?provider=${providerId}`
      );
      setTestResults(prev => ({ ...prev, [providerId]: result }));
    } catch (err: any) {
      setTestResults(prev => ({ ...prev, [providerId]: { success: false, message: err.message } }));
    } finally {
      setTestingProvider(null);
    }
  };

  const getProviderStatus = (providerId: string) => {
    const enabled = settings[`ai_${providerId}_enabled`] === 'true';
    const configured = settings[`ai_${providerId}_api_key_configured`] ||
      (settings.ai_provider === providerId && settings.ai_api_key_configured);
    return { enabled, configured };
  };

  const getEnabledProvidersCount = () => {
    return providers.filter(p => getProviderStatus(p.id).enabled && getProviderStatus(p.id).configured).length;
  };

  const getModelsForProvider = (providerId: string) => {
    return dynamicModels[providerId] || providers.find(p => p.id === providerId)?.defaultModels || [];
  };

  if (user?.role !== 'admin') {
    return null;
  }

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
            <Brain className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              Configuration IA Multi-Fournisseur
            </h1>
            <p className="text-gray-500 mt-1">
              Configurez plusieurs fournisseurs IA avec basculement automatique
            </p>
          </div>
        </div>

        {/* Info Card */}
        <Card className="mb-6 border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <ArrowRightLeft className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-medium text-blue-800">Basculement automatique (Fallback)</h3>
                <p className="text-sm text-blue-700 mt-1">
                  Configurez plusieurs fournisseurs IA. Si le fournisseur principal atteint son quota ou rencontre une erreur,
                  le système basculera automatiquement vers le suivant.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Global Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5" />
                  Paramètres Globaux
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fournisseur Principal</Label>
                    <Select
                      value={settings.ai_primary_provider || 'gemini'}
                      onValueChange={(value) => setSettings(s => ({ ...s, ai_primary_provider: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez le fournisseur principal" />
                      </SelectTrigger>
                      <SelectContent>
                        {providers.map((provider) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {provider.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      Sera utilisé en priorité pour les analyses
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <RefreshCw className="h-5 w-5 text-purple-600" />
                      <div>
                        <Label className="text-base font-medium">
                          Activer le Fallback
                        </Label>
                        <p className="text-sm text-gray-500">
                          Basculer automatiquement si erreur/quota
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={settings.ai_fallback_enabled === 'true'}
                      onCheckedChange={(checked) =>
                        setSettings(s => ({ ...s, ai_fallback_enabled: checked ? 'true' : 'false' }))
                      }
                    />
                  </div>
                </div>

                {/* Status summary */}
                <div className="flex items-center gap-2 pt-2">
                  <span className="text-sm text-gray-600">Fournisseurs actifs:</span>
                  <Badge variant={getEnabledProvidersCount() > 0 ? 'default' : 'secondary'}>
                    {getEnabledProvidersCount()} / {providers.length}
                  </Badge>
                  {getEnabledProvidersCount() > 1 && settings.ai_fallback_enabled === 'true' && (
                    <Badge variant="outline" className="text-green-600 border-green-300">
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Fallback activé
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Provider Cards */}
            {providers.map((provider) => {
              const status = getProviderStatus(provider.id);
              const testResult = testResults[provider.id];
              const isPrimary = settings.ai_primary_provider === provider.id;
              const models = getModelsForProvider(provider.id);

              return (
                <Card
                  key={provider.id}
                  className={`transition-all ${status.enabled ? provider.borderColor + ' border-2' : 'border-gray-200'}`}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${provider.bgColor}`}>
                          <Server className={`h-4 w-4 ${provider.color}`} />
                        </div>
                        {provider.name}
                        {isPrimary && (
                          <Badge variant="default" className="ml-2">Principal</Badge>
                        )}
                      </CardTitle>
                      <div className="flex items-center gap-2">
                        {status.configured && (
                          <Badge variant="outline" className="text-green-600 border-green-300">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Configuré
                          </Badge>
                        )}
                        <Switch
                          checked={status.enabled}
                          onCheckedChange={(checked) =>
                            setSettings(s => ({ ...s, [`ai_${provider.id}_enabled`]: checked ? 'true' : 'false' }))
                          }
                        />
                      </div>
                    </div>
                    <CardDescription>{provider.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* API Key */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Clé API</Label>
                        <a
                          href={provider.docUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
                        >
                          Obtenir une clé <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div className="relative">
                        <Input
                          type="password"
                          placeholder={`Clé API ${provider.name}`}
                          value={settings[`ai_${provider.id}_api_key`] || ''}
                          onChange={(e) => setSettings(s => ({ ...s, [`ai_${provider.id}_api_key`]: e.target.value }))}
                          className="pr-24"
                        />
                        {status.configured && (
                          <Badge variant="success" className="absolute right-2 top-1/2 -translate-y-1/2">
                            <Key className="h-3 w-3 mr-1" />
                            OK
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Model Selection */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Modèle</Label>
                        {provider.id === 'gemini' && status.configured && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => loadModels(provider.id)}
                            disabled={loadingModels === provider.id}
                            className="text-xs"
                          >
                            {loadingModels === provider.id ? (
                              <><Loader2 className="h-3 w-3 mr-1 animate-spin" />Chargement...</>
                            ) : (
                              <><RefreshCw className="h-3 w-3 mr-1" />Actualiser</>
                            )}
                          </Button>
                        )}
                      </div>
                      <Select
                        value={settings[`ai_${provider.id}_model`] || ''}
                        onValueChange={(value) => setSettings(s => ({ ...s, [`ai_${provider.id}_model`]: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionnez un modèle" />
                        </SelectTrigger>
                        <SelectContent>
                          {models.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {provider.id === 'gemini' && dynamicModels.gemini?.length > 0 && (
                        <p className="text-xs text-green-600">
                          ✓ {dynamicModels.gemini.length} modèles détectés
                        </p>
                      )}
                    </div>

                    {/* Test Result & Button */}
                    <div className="flex items-center justify-between pt-2">
                      {testResult && (
                        <div className={`flex items-center gap-2 text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                          {testResult.success ? (
                            <CheckCircle className="h-4 w-4" />
                          ) : (
                            <XCircle className="h-4 w-4" />
                          )}
                          {testResult.message}
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleTest(provider.id)}
                        disabled={testingProvider === provider.id || !status.configured}
                        className="ml-auto"
                      >
                        {testingProvider === provider.id ? (
                          <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Test...</>
                        ) : (
                          <><Sparkles className="h-4 w-4 mr-2" />Tester</>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {/* Messages */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                <div>
                  <div className="font-medium text-red-800">Erreur</div>
                  <div className="text-sm text-red-700">{error}</div>
                </div>
              </div>
            )}

            {successMessage && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                <div className="font-medium text-green-800">{successMessage}</div>
              </div>
            )}

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700"
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sauvegarde...</>
                ) : (
                  <><CheckCircle className="h-4 w-4 mr-2" />Sauvegarder la configuration</>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
