import { useState } from 'react';
import { X, AlertTriangle, RefreshCw } from 'lucide-react';
import { ProtectedButton } from '@/components/ui/ProtectedButton';

interface ResetDatabaseModalProps {
  onClose: () => void;
}

export default function ResetDatabaseModal({ onClose }: ResetDatabaseModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = () => {
    if (confirmText !== 'RESET') {
      alert('Veuillez taper "RESET" pour confirmer');
      return;
    }

    setIsResetting(true);

    // Supprimer la base de données du localStorage
    localStorage.removeItem('accounting_db');

    // Supprimer aussi la session utilisateur
    localStorage.removeItem('current_user');

    // Attendre un peu pour que l'utilisateur voie le message
    setTimeout(() => {
      // Recharger la page pour recréer la base de données
      window.location.reload();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[450px] md:w-[500px] max-w-[95vw]">
        {/* En-tête */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Réinitialiser la base de données</h2>
              <p className="text-sm text-red-600">Action irréversible</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isResetting}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Contenu */}
        <div className="p-6 space-y-6">
          {/* Avertissement */}
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-2">
                <p className="font-semibold text-red-900">Attention ! Cette action va :</p>
                <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
                  <li>Supprimer TOUTES les données de la base de données</li>
                  <li>Supprimer tous les segments</li>
                  <li>Supprimer toutes les villes</li>
                  <li>Supprimer tous les professeurs</li>
                  <li>Supprimer toutes les fiches</li>
                  <li>Vous déconnecter automatiquement</li>
                  <li>Recréer une base de données vierge</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Information */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">
              <strong>Après la réinitialisation :</strong>
              <br />
              La base de données sera recréée avec le compte admin par défaut.
              <br />
              <br />
              <strong>Connexion :</strong>
              <br />
              • Nom d'utilisateur : <code className="bg-blue-100 px-1 py-0.5 rounded">admin</code>
              <br />
              • Mot de passe : <code className="bg-blue-100 px-1 py-0.5 rounded">admin123</code>
            </p>
          </div>

          {/* Confirmation */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tapez <strong className="text-red-600">RESET</strong> pour confirmer :
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
              placeholder="RESET"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent uppercase"
              disabled={isResetting}
              autoFocus
            />
          </div>

          {isResetting && (
            <div className="flex items-center justify-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <RefreshCw className="w-5 h-5 text-yellow-600 animate-spin" />
              <span className="text-yellow-900 font-medium">Réinitialisation en cours...</span>
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isResetting}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Annuler
            </button>
            <ProtectedButton
              permission="system.roles.view_page"
              onClick={handleReset}
              disabled={confirmText !== 'RESET' || isResetting}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-5 h-5 ${isResetting ? 'animate-spin' : ''}`} />
              {isResetting ? 'Réinitialisation...' : 'Réinitialiser'}
            </ProtectedButton>
          </div>
        </div>
      </div>
    </div>
  );
}
