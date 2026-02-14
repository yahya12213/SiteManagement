import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MessageSquare, AlertCircle } from 'lucide-react';
import { useCreateThread } from '@/hooks/useForums';
import { useFormation } from '@/hooks/useCours';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export const CreateThread: React.FC = () => {
  const { formationId } = useParams<{ formationId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState('');

  const { data: formationData } = useFormation(formationId || undefined);
  const createThreadMutation = useCreateThread();

  const formation = formationData;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Le titre est requis');
      return;
    }

    if (!formationId || !user) {
      setError('Erreur: Formation ou utilisateur non trouvé');
      return;
    }

    try {
      const result = await createThreadMutation.mutateAsync({
        formationId,
        data: {
          author_id: user.id,
          title: title.trim(),
          content: content.trim() || undefined,
        },
      });

      // Navigate to the new thread
      navigate(`/student/forums/thread/${result.thread.id}`);
    } catch (err) {
      console.error('Error creating thread:', err);
      setError('Erreur lors de la création de la discussion');
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Back Button */}
      <Button
        onClick={() => navigate(`/student/forums/${formationId}`)}
        variant="ghost"
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Retour au forum
      </Button>

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 mb-6 text-white">
        <div className="flex items-center gap-3 mb-2">
          <MessageSquare className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Nouvelle discussion</h1>
        </div>
        <p className="text-blue-100">
          Formation: {formation?.title || 'Chargement...'}
        </p>
      </div>

      {/* Guidelines */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-blue-900 mb-2">
          Conseils pour créer une bonne discussion
        </h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Choisissez un titre clair et descriptif</li>
          <li>• Expliquez votre question ou sujet en détail</li>
          <li>• Soyez respectueux et constructif</li>
          <li>• Vérifiez qu'une discussion similaire n'existe pas déjà</li>
        </ul>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title Input */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <label
            htmlFor="title"
            className="block text-sm font-semibold text-gray-900 mb-2"
          >
            Titre de la discussion *
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex: Comment configurer l'environnement de développement ?"
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={200}
          />
          <p className="mt-2 text-sm text-gray-500">
            {title.length}/200 caractères
          </p>
        </div>

        {/* Content Input */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <label
            htmlFor="content"
            className="block text-sm font-semibold text-gray-900 mb-2"
          >
            Description (optionnelle)
          </label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Décrivez votre question ou sujet en détail..."
            rows={10}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            maxLength={5000}
          />
          <p className="mt-2 text-sm text-gray-500">
            {content.length}/5000 caractères
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            onClick={() => navigate(`/student/forums/${formationId}`)}
            variant="outline"
          >
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={!title.trim() || createThreadMutation.isPending}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white"
          >
            {createThreadMutation.isPending ? (
              'Création...'
            ) : (
              <>
                <MessageSquare className="h-4 w-4 mr-2" />
                Créer la discussion
              </>
            )}
          </Button>
        </div>
      </form>

      {/* Preview Note */}
      <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-sm text-gray-600">
          💡 <strong>Note:</strong> Votre discussion sera visible par tous les
          étudiants de cette formation. Vous pourrez la modifier ou la supprimer
          après sa création.
        </p>
      </div>
    </div>
  );
};
