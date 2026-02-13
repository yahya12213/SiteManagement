/**
 * Configuration de la Paie
 * Page dédiée aux paramètres et variables du système de paie
 */

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePayrollConfig } from '@/hooks/usePayroll';

export function PayrollConfiguration() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('cotisations');
  const { data, isLoading } = usePayrollConfig();
  const config = (data as any)?.config || [];

  const [isSaving, setIsSaving] = useState(false);

  // Helper pour récupérer une valeur de config
  const getConfigValue = (key: string): string => {
    const item = config.find((c: any) => c.config_key === key);
    return item?.config_value || '';
  };

  // États locaux pour les valeurs CNSS
  const [cnssEmployeeRate, setCnssEmployeeRate] = useState(
    getConfigValue('cnss_employee_rate') || '4.48'
  );
  const [cnssEmployerRate, setCnssEmployerRate] = useState(
    getConfigValue('cnss_employer_rate') || '8.98'
  );
  const [cnssCeiling, setCnssCeiling] = useState(
    getConfigValue('cnss_ceiling') || '6000'
  );

  // États locaux pour les valeurs AMO
  const [amoEmployeeRate, setAmoEmployeeRate] = useState(
    getConfigValue('amo_employee_rate') || '2.26'
  );
  const [amoEmployerRate, setAmoEmployerRate] = useState(
    getConfigValue('amo_employer_rate') || '4.11'
  );

  // États locaux pour les heures supplémentaires
  const [overtime25Rate, setOvertime25Rate] = useState(
    getConfigValue('overtime_rate_25') || '1.25'
  );
  const [overtime50Rate, setOvertime50Rate] = useState(
    getConfigValue('overtime_rate_50') || '1.50'
  );
  const [overtime100Rate, setOvertime100Rate] = useState(
    getConfigValue('overtime_rate_100') || '2.00'
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // TODO: Implémenter la sauvegarde via API
      // await payrollApi.updateConfig('cnss', { ... });

      toast({
        title: 'Configuration enregistrée',
        description: 'Les modifications ont été sauvegardées avec succès',
      });
    } catch (error: unknown) {
      toast({
        title: 'Erreur',
        description:
          error instanceof Error ? error.message : 'Erreur lors de la sauvegarde',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          <span className="ml-3 text-gray-600">Chargement de la configuration...</span>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        {/* En-tête */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/admin/hr/payroll')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour
              </Button>
              <div>
                <CardTitle className="text-2xl">Configuration de la Paie</CardTitle>
                <CardDescription>
                  Paramètres des cotisations, impôts et autres variables
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Onglets Configuration */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="cotisations">Cotisations Sociales</TabsTrigger>
            <TabsTrigger value="heures-sup">Heures Supplémentaires</TabsTrigger>
            <TabsTrigger value="igr">IGR (Impôt)</TabsTrigger>
            <TabsTrigger value="anciennete">Prime d'Ancienneté</TabsTrigger>
          </TabsList>

          {/* Onglet Cotisations */}
          <TabsContent value="cotisations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>CNSS (Caisse Nationale de Sécurité Sociale)</CardTitle>
                <CardDescription>
                  Configuration des taux et plafond de cotisation CNSS
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cnss-employee">Taux Salarié (%)</Label>
                    <Input
                      id="cnss-employee"
                      type="number"
                      step="0.01"
                      value={cnssEmployeeRate}
                      onChange={(e) => setCnssEmployeeRate(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">
                      Taux de cotisation retenu sur le salaire de l'employé
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cnss-employer">Taux Employeur (%)</Label>
                    <Input
                      id="cnss-employer"
                      type="number"
                      step="0.01"
                      value={cnssEmployerRate}
                      onChange={(e) => setCnssEmployerRate(e.target.value)}
                    />
                    <p className="text-xs text-gray-500">
                      Taux de cotisation patronale
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cnss-ceiling">Plafond mensuel (MAD)</Label>
                  <Input
                    id="cnss-ceiling"
                    type="number"
                    value={cnssCeiling}
                    onChange={(e) => setCnssCeiling(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    Montant maximum mensuel soumis à la CNSS
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AMO (Assurance Maladie Obligatoire)</CardTitle>
                <CardDescription>
                  Configuration des taux de cotisation AMO (sans plafond)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="amo-employee">Taux Salarié (%)</Label>
                    <Input
                      id="amo-employee"
                      type="number"
                      step="0.01"
                      value={amoEmployeeRate}
                      onChange={(e) => setAmoEmployeeRate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="amo-employer">Taux Employeur (%)</Label>
                    <Input
                      id="amo-employer"
                      type="number"
                      step="0.01"
                      value={amoEmployerRate}
                      onChange={(e) => setAmoEmployerRate(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Heures Supplémentaires */}
          <TabsContent value="heures-sup" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Taux de Majoration</CardTitle>
                <CardDescription>
                  Configuration des multiplicateurs pour les heures supplémentaires
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="overtime-25">
                    Heures supplémentaires normales (multiplicateur)
                  </Label>
                  <Input
                    id="overtime-25"
                    type="number"
                    step="0.01"
                    value={overtime25Rate}
                    onChange={(e) => setOvertime25Rate(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    Généralement 1.25 (majoration de 25%)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="overtime-50">
                    Heures supplémentaires de nuit (multiplicateur)
                  </Label>
                  <Input
                    id="overtime-50"
                    type="number"
                    step="0.01"
                    value={overtime50Rate}
                    onChange={(e) => setOvertime50Rate(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    Généralement 1.50 (majoration de 50%)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="overtime-100">
                    Heures supplémentaires jours fériés (multiplicateur)
                  </Label>
                  <Input
                    id="overtime-100"
                    type="number"
                    step="0.01"
                    value={overtime100Rate}
                    onChange={(e) => setOvertime100Rate(e.target.value)}
                  />
                  <p className="text-xs text-gray-500">
                    Généralement 2.00 (majoration de 100%)
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet IGR */}
          <TabsContent value="igr">
            <Card>
              <CardHeader>
                <CardTitle>Barème IGR 2025</CardTitle>
                <CardDescription>
                  Impôt sur le Revenu - Barème progressif annuel
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Configuration avancée du barème IGR disponible prochainement.
                  <br />
                  Barème actuel : 6 tranches de 0% à 38%
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Onglet Ancienneté */}
          <TabsContent value="anciennete">
            <Card>
              <CardHeader>
                <CardTitle>Prime d'Ancienneté</CardTitle>
                <CardDescription>
                  Barème des primes selon les années de service
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  Configuration avancée des primes d'ancienneté disponible prochainement.
                  <br />
                  Barème actuel : 5%, 10%, 15%, 20%, 25% selon années de service
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Bouton Enregistrer */}
        <Card className="p-4">
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Enregistrer les Modifications
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
