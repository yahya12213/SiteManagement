import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Eye,
  Clock,
  Pin,
  Lock,
  TrendingUp,
  Activity,
  Plus,
} from 'lucide-react';
import { useForumThreads } from '@/hooks/useForums';
import { useFormation } from '@/hooks/useCours';
import { Button } from '@/components/ui/button';

export const ForumList: React.FC = () => {
  const { formationId } = useParams<{ formationId: string }>();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'active'>('recent');

  const { data: formationData, isLoading: formationLoading } = useFormation(
    formationId || undefined
  );
  const { data: threadsData, isLoading: threadsLoading } = useForumThreads(
    formationId || null,
    { sort: sortBy, pinned: 'true' }
  );

  const formation = formationData;
  const threads = threadsData?.threads || [];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'À l\'instant';
    if (diffMins < 60) return `Il y a ${diffMins} min`;
    if (diffHours < 24) return `Il y a ${diffHours}h`;
    if (diffDays < 7) return `Il y a ${diffDays}j`;
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (formationLoading || threadsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement du forum...</p>
        </div>
      </div>
    );
  }

  if (!formation) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Formation non trouvée</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Forum - {formation.title}
            </h1>
            <p className="text-gray-600 mt-1">
              Posez vos questions et discutez avec les autres étudiants
            </p>
          </div>
          <Button
            onClick={() => navigate(`/student/forums/${formationId}/new`)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouvelle discussion
          </Button>
        </div>
      </div>

      {/* Stats and Sort Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-600" />
              <span className="text-gray-600">
                <span className="font-semibold text-gray-900">{threads.length}</span>{' '}
                discussions
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-green-600" />
              <span className="text-gray-600">
                <span className="font-semibold text-gray-900">
                  {threads.reduce((sum, t) => sum + (t.post_count || 0), 0)}
                </span>{' '}
                réponses
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Trier par:</span>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as 'recent' | 'popular' | 'active')
              }
              className="text-sm border border-gray-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="recent">Plus récent</option>
              <option value="popular">Plus populaire</option>
              <option value="active">Plus actif</option>
            </select>
          </div>
        </div>
      </div>

      {/* Threads List */}
      {threads.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
          <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Aucune discussion pour le moment
          </h3>
          <p className="text-gray-600 mb-6">
            Soyez le premier à poser une question ou partager une idée
          </p>
          <Button
            onClick={() => navigate(`/student/forums/${formationId}/new`)}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Créer une discussion
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map((thread) => (
            <div
              key={thread.id}
              onClick={() => navigate(`/student/forums/thread/${thread.id}`)}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
            >
              <div className="flex items-start gap-4">
                {/* Thread Icon */}
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <MessageSquare className="h-6 w-6 text-white" />
                  </div>
                </div>

                {/* Thread Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {thread.is_pinned && (
                          <Pin className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                        )}
                        {thread.is_locked && (
                          <Lock className="h-4 w-4 text-gray-500 flex-shrink-0" />
                        )}
                        <h3 className="text-lg font-semibold text-gray-900 hover:text-blue-600">
                          {thread.title}
                        </h3>
                      </div>

                      {thread.content && (
                        <p className="text-sm text-gray-600 line-clamp-2 mb-3">
                          {thread.content}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>Par {thread.author_name}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(thread.created_at)}
                        </span>
                        {thread.last_post_at && (
                          <span>
                            Dernière réponse: {formatDate(thread.last_post_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Thread Stats */}
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-gray-600">
                          <Eye className="h-4 w-4" />
                          <span className="font-semibold">{thread.view_count}</span>
                        </div>
                        <div className="text-xs text-gray-500">vues</div>
                      </div>

                      <div className="text-center">
                        <div className="flex items-center gap-1 text-blue-600">
                          <MessageSquare className="h-4 w-4" />
                          <span className="font-semibold">{thread.post_count || 0}</span>
                        </div>
                        <div className="text-xs text-gray-500">réponses</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Popular Threads Badge (if sorting by popular) */}
      {sortBy === 'popular' && threads.length > 0 && (
        <div className="mt-6 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-800">
            <TrendingUp className="h-5 w-5" />
            <span className="font-semibold">
              Discussions les plus populaires en ce moment
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
