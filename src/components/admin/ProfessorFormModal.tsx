import { useState, useEffect } from 'react';
import { X, User, Mail, Lock } from 'lucide-react';
import { useProfessor, useCreateProfessor, useUpdateProfessor } from '@/hooks/useProfessors';
import { usePermission } from '@/hooks/usePermission';

interface ProfessorFormModalProps {
  professorId: string | null;
  onClose: () => void;
}

export default function ProfessorFormModal({ professorId, onClose }: ProfessorFormModalProps) {
  const [formData, setFormData] = useState({
    full_name: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  const { data: professor } = useProfessor(professorId || '');
  const createProfessor = useCreateProfessor();
  const updateProfessor = useUpdateProfessor();

  const isEdit = !!professorId;

  // Permissions
  const { accounting } = usePermission();
  const canSave = isEdit ? accounting.canUpdateProfessor : accounting.canCreateProfessor;

  useEffect(() => {
    if (professor) {
      setFormData({
        full_name: professor.full_name,
        username: professor.username,
        password: '',
        confirmPassword: '',
      });
    }
  }, [professor]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.full_name.trim() || !formData.username.trim()) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (!isEdit && !formData.password) {
      alert('Le mot de passe est requis pour un nouveau professeur');
      return;
    }

    if (formData.password && formData.password !== formData.confirmPassword) {
      alert('Les mots de passe ne correspondent pas');
      return;
    }

    if (formData.password && formData.password.length < 6) {
      alert('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    // Validation username
    if (formData.username.length < 3) {
      alert('Le nom d\'utilisateur doit contenir au moins 3 caractères');
      return;
    }

    try {
      if (isEdit && professorId) {
        await updateProfessor.mutateAsync({
          id: professorId,
          username: formData.username,
          full_name: formData.full_name,
          password: formData.password || undefined,
        });
      } else {
        await createProfessor.mutateAsync({
          username: formData.username,
          full_name: formData.full_name,
          password: formData.password,
        });
      }
      onClose();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde du professeur');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[500px] md:w-[550px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* En-tête */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <User className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                {isEdit ? 'Modifier le professeur' : 'Nouveau professeur'}
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                {isEdit ? 'Modifiez les informations' : 'Ajoutez un nouveau professeur'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 ml-2"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Nom complet */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom complet *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                required
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Ex: Mohamed El Alami"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Nom d'utilisateur */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom d'utilisateur *
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                required
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '') })}
                placeholder="Ex: prof123"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                minLength={3}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Minimum 3 caractères, sans espaces
            </p>
          </div>

          {/* Mot de passe */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Mot de passe {isEdit ? '(laisser vide pour ne pas changer)' : '*'}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="password"
                required={!isEdit}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                minLength={6}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Minimum 6 caractères
            </p>
          </div>

          {/* Confirmation mot de passe */}
          {formData.password && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirmer le mot de passe *
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              {formData.confirmPassword && formData.password !== formData.confirmPassword && (
                <p className="mt-1 text-xs text-red-600">
                  Les mots de passe ne correspondent pas
                </p>
              )}
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            {canSave && (
              <button
                type="submit"
                disabled={createProfessor.isPending || updateProfessor.isPending}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createProfessor.isPending || updateProfessor.isPending
                  ? 'Enregistrement...'
                  : isEdit
                  ? 'Mettre à jour'
                  : 'Créer'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
