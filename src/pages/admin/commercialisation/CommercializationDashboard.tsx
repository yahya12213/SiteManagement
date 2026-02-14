import React from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { TrendingUp, Users, Target, FileText, FileCheck } from 'lucide-react';

const CommercializationDashboard: React.FC = () => {
  return (
    <AppLayout
      title="Tableau de bord Commercialisation"
      subtitle="Vue d'ensemble des activités commerciales"
    >
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Clients</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">0</p>
              </div>
              <Users className="w-12 h-12 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Prospects</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">0</p>
              </div>
              <Target className="w-12 h-12 text-orange-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Devis</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">0</p>
              </div>
              <FileText className="w-12 h-12 text-purple-500" />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Contrats</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">0</p>
              </div>
              <FileCheck className="w-12 h-12 text-green-500" />
            </div>
          </div>
        </div>

        {/* Development Notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <TrendingUp className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-yellow-900 mb-2">Module en développement</h3>
              <p className="text-yellow-800">
                Le module de commercialisation est actuellement en développement.
                Les fonctionnalités seront disponibles prochainement.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default CommercializationDashboard;
