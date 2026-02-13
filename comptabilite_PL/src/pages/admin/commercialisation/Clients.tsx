import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Users, Plus } from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';

const Clients: React.FC = () => {
  const { commercialisation } = usePermission();

  return (
    <AppLayout
      title="Gestion des Clients"
      subtitle="Base de données des clients"
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Liste des clients</h2>
          </div>
          {commercialisation.canCreateClient && (
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
              <Plus className="w-5 h-5" />
              Nouveau client
            </button>
          )}
        </div>

        {/* Development Notice */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Users className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Module en développement</h3>
              <p className="text-blue-800">
                La gestion des clients sera bientôt disponible. Vous pourrez créer, modifier et suivre vos clients.
              </p>
              <div className="mt-4">
                <h4 className="font-medium text-blue-900 mb-2">Fonctionnalités prévues:</h4>
                <ul className="list-disc list-inside space-y-1 text-blue-800">
                  <li>Création et modification de fiches clients</li>
                  <li>Historique des interactions</li>
                  <li>Suivi des contrats et devis associés</li>
                  <li>Statistiques par client</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Clients;
