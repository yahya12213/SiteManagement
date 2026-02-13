/**
 * SystemClockEditor Component
 * Allows admin to configure a custom system clock for attendance
 *
 * APPROACH: Send absolute datetime directly to backend
 * Admin enters date + time → Backend stores it as reference → Clock advances from there
 * NO offset calculation, NO timezone dependency
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Clock, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';

interface SystemClockConfig {
  enabled: boolean;
  offset_minutes: number;
  current_server_time: string;
  current_system_time: string;
  desired_time: string | null;
  reference_server_time: string | null;
  updated_at: string | null;
  updated_by: string | null;
}

export default function SystemClockEditor() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [enabled, setEnabled] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch current system clock config
  const { data: config, isLoading, refetch } = useQuery({
    queryKey: ['system-clock-config'],
    queryFn: async () => {
      const response = await apiClient.get('/hr/settings/system-clock');
      return (response as any).data as SystemClockConfig;
    },
    refetchInterval: 5000, // Refresh every 5 seconds to show live time
  });

  // Initialize form values only once when config is first loaded
  useEffect(() => {
    if (config && !isInitialized) {
      setEnabled(config.enabled);

      // Initialize date/time from current system time
      const timeToUse = config.enabled && config.current_system_time
        ? new Date(config.current_system_time)
        : new Date(config.current_server_time);

      // Format for date input (YYYY-MM-DD) - utiliser Africa/Casablanca
      const dateStr = timeToUse.toLocaleDateString('en-CA', { timeZone: 'Africa/Casablanca' });
      setCustomDate(dateStr);

      // Format for time input (HH:MM) - utiliser Africa/Casablanca
      const timeStr = timeToUse.toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Africa/Casablanca'
      });
      setCustomTime(timeStr);

      setIsInitialized(true);
    }
  }, [config, isInitialized]);

  // Update mutation - sends desired_datetime (absolute time)
  const updateMutation = useMutation({
    mutationFn: async (data: { enabled: boolean; desired_datetime?: string }) => {
      const response = await apiClient.put('/hr/settings/system-clock', data);
      return response;
    },
    onSuccess: (response: any) => {
      setIsInitialized(false); // Allow re-sync with server
      queryClient.invalidateQueries({ queryKey: ['system-clock-config'] });
      toast({
        title: 'Configuration mise a jour',
        description: response.message || 'L\'horloge systeme a ete mise a jour.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Erreur lors de la mise a jour',
        variant: 'destructive',
      });
    },
  });

  // Reset mutation
  const resetMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/hr/settings/system-clock/reset');
      return response;
    },
    onSuccess: (response: any) => {
      setIsInitialized(false); // Allow re-sync with server
      queryClient.invalidateQueries({ queryKey: ['system-clock-config'] });
      setEnabled(false);
      toast({
        title: 'Horloge reinitialisee',
        description: response.message || 'L\'horloge utilise maintenant l\'heure serveur.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Erreur lors de la reinitialisation',
        variant: 'destructive',
      });
    },
  });

  const handleSave = () => {
    if (enabled && (!customDate || !customTime)) {
      toast({
        title: 'Champs requis',
        description: 'Veuillez remplir la date et l\'heure',
        variant: 'destructive',
      });
      return;
    }

    if (enabled) {
      // Envoyer le datetime absolu avec timezone Africa/Casablanca (+01:00)
      // Format: YYYY-MM-DDTHH:MM:SS+01:00
      const desired_datetime = `${customDate}T${customTime}:00+01:00`;

      console.log('[SystemClockEditor] Setting absolute time:', {
        desired_datetime,
        date: customDate,
        time: customTime
      });

      updateMutation.mutate({ enabled: true, desired_datetime });
    } else {
      // Désactiver l'horloge personnalisée
      updateMutation.mutate({ enabled: false });
    }
  };

  const handleReset = () => {
    resetMutation.mutate();
  };

  const formatTime = (dateString: string | Date | undefined) => {
    if (!dateString) return '--:--:--';
    const date = new Date(dateString);
    return date.toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'Africa/Casablanca'
    });
  };

  const formatDate = (dateString: string | Date | undefined) => {
    if (!dateString) return '--/--/----';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'Africa/Casablanca'
    });
  };

  const formatOffset = (minutes: number | undefined) => {
    if (minutes === undefined || minutes === 0) return '';
    const sign = minutes >= 0 ? '+' : '-';
    const absMinutes = Math.abs(minutes);
    const hours = Math.floor(absMinutes / 60);
    const mins = absMinutes % 60;
    return `${sign}${hours}h${mins.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Chargement...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            <CardTitle>Horloge Systeme</CardTitle>
          </div>
          {config?.enabled && (
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Horloge personnalisee active
            </Badge>
          )}
          {!config?.enabled && (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Heure serveur
            </Badge>
          )}
        </div>
        <CardDescription>
          Configurer une horloge independante du serveur pour le pointage
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Current Time Display */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg border">
            <div className="text-sm text-gray-500 mb-1">Heure serveur</div>
            <div className="text-2xl font-mono font-bold text-gray-700">
              {formatTime(config?.current_server_time)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {formatDate(config?.current_server_time)}
            </div>
          </div>

          <div className={`p-4 rounded-lg border ${config?.enabled ? 'bg-blue-50 border-blue-200' : 'bg-gray-50'}`}>
            <div className="text-sm text-gray-500 mb-1">
              Heure systeme (pointage)
              {config?.enabled && config?.offset_minutes !== undefined && config.offset_minutes !== 0 && (
                <span className="ml-2 text-blue-600 font-medium">
                  {formatOffset(config.offset_minutes)}
                </span>
              )}
            </div>
            <div className={`text-2xl font-mono font-bold ${config?.enabled ? 'text-blue-700' : 'text-gray-700'}`}>
              {config?.enabled && config?.current_system_time
                ? formatTime(config.current_system_time)
                : formatTime(config?.current_server_time)}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {config?.enabled && config?.current_system_time
                ? formatDate(config.current_system_time)
                : formatDate(config?.current_server_time)}
            </div>
          </div>
        </div>

        {/* Enable Toggle */}
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
          <div>
            <div className="font-medium">Activer l'horloge personnalisee</div>
            <div className="text-sm text-gray-500">
              Les pointages utiliseront cette heure au lieu de l'heure serveur
            </div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>

        {/* Custom DateTime Inputs */}
        {enabled && (
          <div className="space-y-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="text-sm font-medium text-blue-800">
              Definir la date et l'heure du systeme
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="custom-date" className="text-blue-700">Date</Label>
                <Input
                  id="custom-date"
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="bg-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-time" className="text-blue-700">Heure (HH:MM)</Label>
                <Input
                  id="custom-time"
                  type="text"
                  placeholder="14:30"
                  pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
                  value={customTime}
                  onChange={(e) => {
                    // Accepter seulement les chiffres et :
                    const val = e.target.value.replace(/[^0-9:]/g, '');
                    // Auto-ajouter : après 2 chiffres
                    if (val.length === 2 && !val.includes(':') && customTime.length < 2) {
                      setCustomTime(val + ':');
                    } else if (val.length <= 5) {
                      setCustomTime(val);
                    }
                  }}
                  className="bg-white"
                />
              </div>
            </div>
            <p className="text-xs text-blue-600">
              L'horloge avancera a partir de cette date/heure en temps reel
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t">
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex-1"
          >
            {updateMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            Appliquer
          </Button>
          {config?.enabled && (
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Reinitialiser
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Info */}
        {config?.updated_at && (
          <div className="text-xs text-gray-500 text-center">
            Derniere modification: {new Date(config.updated_at).toLocaleString('fr-FR')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
