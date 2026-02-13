import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { FileCheck, Plus } from 'lucide-react';

const Contrats: React.FC = () => {
  return (
    <AppLayout
      title="Gestion des Contrats"
      subtitle="Suivi des contrats de vente"
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileCheck className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">Liste des contrats</h2>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
            <Plus className="w-5 h-5" />
            Nouveau contrat
          </button>
        </div>

        {/* Development Notice */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <FileCheck className="w-6 h-6 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-green-900 mb-2">Module en développement</h3>
              <p className="text-green-800">
                La gestion des contrats sera bientôt disponible. Vous pourrez créer, gérer et suivre vos contrats de vente.
              </p>
              <div className="mt-4">
                <h4 className="font-medium text-green-900 mb-2">Fonctionnalités prévues:</h4>
                <ul className="list-disc list-inside space-y-1 text-green-800">
                  <li>Création et personnalisation de contrats</li>
                  <li>Signature électronique</li>
                  <li>Suivi des échéances et renouvellements</li>
                  <li>Gestion des avenants</li>
                  <li>Archivage et recherche</li>
                  <li>Alertes et notifications</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Contrats;
