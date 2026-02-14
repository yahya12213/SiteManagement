import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MessageSquare,
  ThumbsUp,
  Lightbulb,
  Eye,
  Send,
  Trash2,
  Lock,
  Pin,
  Clock,
} from 'lucide-react';
import {
  useForumThread,
  useForumPosts,
  useIncrementViewCount,
  useCreatePost,
  useAddReaction,
  useRemoveReaction,
  useDeletePost,
} from '@/hooks/useForums';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import type { ForumPost } from '@/lib/api/forums';

export const ThreadView: React.FC = () => {
  const { threadId } = useParams<{ threadId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [replyContent, setReplyContent] = useState('');

  const { data: threadData, isLoading: threadLoading } = useForumThread(
    threadId || null
  );
  const { data: postsData, isLoading: postsLoading } = useForumPosts(
    threadId || null
  );
  const incrementViewMutation = useIncrementViewCount();
  const createPostMutation = useCreatePost();
  const addReactionMutation = useAddReaction();
  const removeReactionMutation = useRemoveReaction();
  const deletePostMutation = useDeletePost();

  const thread = threadData?.thread;
  const posts = postsData?.posts || [];

  // Increment view count on mount
  useEffect(() => {
    if (threadId) {
      incrementViewMutation.mutate(threadId);
    }
  }, [threadId]);

  const handleReply = async () => {
    if (!replyContent.trim() || !threadId || !user) return;

    try {
      await createPostMutation.mutateAsync({
        threadId,
        data: {
          author_id: user.id,
          content: replyContent.trim(),
        },
      });
      setReplyContent('');
    } catch (error) {
      console.error('Error posting reply:', error);
      alert('Erreur lors de l\'envoi de la réponse');
    }
  };

  const handleReaction = async (
    postId: string,
    reactionType: 'like' | 'helpful' | 'insightful',
    hasReacted: boolean
  ) => {
    if (!user) return;

    try {
      if (hasReacted) {
        await removeReactionMutation.mutateAsync({
          postId,
          userId: user.id,
          reactionType,
        });
      } else {
        await addReactionMutation.mutateAsync({
          postId,
          data: {
            user_id: user.id,
            reaction_type: reactionType,
          },
        });
      }
    } catch (error) {
      console.error('Error toggling reaction:', error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!user) return;
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette réponse ?')) return;

    try {
      await deletePostMutation.mutateAsync({
        postId,
        userId: user.id,
        isAdmin: user.role === 'admin',
      });
    } catch (error) {
      console.error('Error deleting post:', error);
      alert('Erreur lors de la suppression');
    }
  };

  const getReactionCount = (post: ForumPost, type: string): number => {
    if (!post.reactions) return 0;
    const reaction = post.reactions.find((r) => r.reaction_type === type);
    return reaction ? reaction.count : 0;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (threadLoading || postsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement de la discussion...</p>
        </div>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">Discussion non trouvée</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Back Button */}
      <Button
        onClick={() => navigate(`/student/forums/${thread.formation_id}`)}
        variant="ghost"
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Retour au forum
      </Button>

      {/* Thread Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="h-8 w-8 text-white" />
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {thread.is_pinned && (
                <Pin className="h-5 w-5 text-yellow-600" />
              )}
              {thread.is_locked && (
                <Lock className="h-5 w-5 text-gray-500" />
              )}
              <h1 className="text-2xl font-bold text-gray-900">
                {thread.title}
              </h1>
            </div>

            {thread.content && (
              <p className="text-gray-700 mb-4 whitespace-pre-wrap">
                {thread.content}
              </p>
            )}

            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span className="font-medium">{thread.author_name}</span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDate(thread.created_at)}
              </span>
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {thread.view_count} vues
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="h-4 w-4" />
                {thread.post_count || 0} réponses
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Posts List */}
      <div className="space-y-4 mb-6">
        {posts.map((post) => {
          const isAuthor = user?.id === post.author_id;
          const isAdmin = user?.role === 'admin';
          const canDelete = isAuthor || isAdmin;

          return (
            <div
              key={post.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-5"
            >
              <div className="flex items-start gap-4">
                {/* Author Avatar */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-teal-600 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-semibold text-sm">
                    {post.author_name?.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Post Content */}
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-semibold text-gray-900">
                        {post.author_name}
                      </span>
                      {post.author_role === 'admin' && (
                        <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded">
                          Admin
                        </span>
                      )}
                      {post.author_role === 'gerant' && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                          Formateur
                        </span>
                      )}
                      <span className="ml-3 text-sm text-gray-500">
                        {formatDate(post.created_at)}
                      </span>
                      {post.is_edited && (
                        <span className="ml-2 text-xs text-gray-400">
                          (modifié)
                        </span>
                      )}
                    </div>

                    {canDelete && (
                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="text-red-600 hover:text-red-700 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <p className="text-gray-700 mb-3 whitespace-pre-wrap">
                    {post.content}
                  </p>

                  {/* Reactions */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleReaction(post.id, 'like', false)}
                      className="flex items-center gap-1 text-sm text-gray-600 hover:text-blue-600 transition-colors"
                    >
                      <ThumbsUp className="h-4 w-4" />
                      <span>{getReactionCount(post, 'like')}</span>
                    </button>

                    <button
                      onClick={() => handleReaction(post.id, 'helpful', false)}
                      className="flex items-center gap-1 text-sm text-gray-600 hover:text-green-600 transition-colors"
                    >
                      <MessageSquare className="h-4 w-4" />
                      <span>{getReactionCount(post, 'helpful')}</span>
                    </button>

                    <button
                      onClick={() => handleReaction(post.id, 'insightful', false)}
                      className="flex items-center gap-1 text-sm text-gray-600 hover:text-purple-600 transition-colors"
                    >
                      <Lightbulb className="h-4 w-4" />
                      <span>{getReactionCount(post, 'insightful')}</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Reply Box */}
      {thread.is_locked ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <Lock className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
          <p className="text-yellow-800 font-medium">
            Cette discussion est verrouillée. Vous ne pouvez plus y répondre.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">
            Votre réponse
          </h3>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Écrivez votre réponse ici..."
            rows={4}
            className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-sm text-gray-500">
              Soyez respectueux et constructif dans vos réponses
            </p>
            <Button
              onClick={handleReply}
              disabled={!replyContent.trim() || createPostMutation.isPending}
              className="bg-gradient-to-r from-blue-600 to-blue-700 text-white"
            >
              {createPostMutation.isPending ? (
                'Envoi...'
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Envoyer
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
