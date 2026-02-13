import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { FileText, Plus } from 'lucide-react';

const Devis: React.FC = () => {
  return (
    <AppLayout
      title="Gestion des Devis"
      subtitle="Création et suivi des propositions commerciales"
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900">Liste des devis</h2>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors">
            <Plus className="w-5 h-5" />
            Nouveau devis
          </button>
        </div>

        {/* Development Notice */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <FileText className="w-6 h-6 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-purple-900 mb-2">Module en développement</h3>
              <p className="text-purple-800">
                La gestion des devis sera bientôt disponible. Vous pourrez créer, envoyer et suivre vos propositions commerciales.
              </p>
              <div className="mt-4">
                <h4 className="font-medium text-purple-900 mb-2">Fonctionnalités prévues:</h4>
                <ul className="list-disc list-inside space-y-1 text-purple-800">
                  <li>Création de devis personnalisés</li>
                  <li>Génération automatique en PDF</li>
                  <li>Suivi des statuts (brouillon, envoyé, accepté, refusé)</li>
                  <li>Conversion devis → contrat</li>
                  <li>Historique et versions</li>
                  <li>Templates de devis</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Devis;
