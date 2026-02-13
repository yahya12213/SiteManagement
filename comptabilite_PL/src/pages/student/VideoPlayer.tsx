import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Clock,
  PlayCircle,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  CheckCircle,
} from 'lucide-react';
import { useStudentFormation, useUpdateVideoProgress } from '@/hooks/useStudent';
import type { FormationModule, ModuleVideo } from '@/types/cours';

const VideoPlayer: React.FC = () => {
  const { id: formationId, videoId } = useParams<{ id: string; videoId: string }>();
  const navigate = useNavigate();

  // Use the new integrated student hook
  const { data: formation, isLoading, error } = useStudentFormation(formationId);
  const updateProgress = useUpdateVideoProgress();

  // Find current video and its module
  const currentVideo = formation?.modules
    ?.flatMap((module) => module.videos || [])
    .find((video) => video.id === videoId);

  const currentModule = formation?.modules?.find((module) =>
    module.videos?.some((video) => video.id === videoId)
  );

  // Get all videos in order for navigation
  const allVideos: Array<{ video: ModuleVideo; module: FormationModule }> = [];
  formation?.modules?.forEach((module) => {
    module.videos?.forEach((video) => {
      allVideos.push({ video, module });
    });
  });

  const currentIndex = allVideos.findIndex((item) => item.video.id === videoId);
  const previousVideo = currentIndex > 0 ? allVideos[currentIndex - 1] : null;
  const nextVideo = currentIndex < allVideos.length - 1 ? allVideos[currentIndex + 1] : null;

  // Extract YouTube video ID from URL
  const getYouTubeVideoId = (url: string): string | null => {
    if (!url) return null;

    // Handle different YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=)([^&]+)/,
      /(?:youtu\.be\/)([^?]+)/,
      /(?:youtube\.com\/embed\/)([^?]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }

    return null;
  };

  const youtubeVideoId = currentVideo?.youtube_url ? getYouTubeVideoId(currentVideo.youtube_url) : null;

  // Format duration
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Check if current video is completed
  const isCompleted = currentVideo?.is_completed || false;

  // Handle marking video as complete
  const handleMarkComplete = async () => {
    if (!videoId || isCompleted) return;

    try {
      await updateProgress.mutateAsync({
        videoId: parseInt(videoId),
        data: {
          watched_seconds: currentVideo?.duration_seconds || 0,
          completed: true
        }
      });
    } catch (error) {
      console.error('Erreur lors du marquage de la vidéo:', error);
    }
  };

  // Auto-record video watch when component mounts
  useEffect(() => {
    // This would be where we track video viewing
    // For now, we'll just log it
    if (videoId) {
      console.log('Vidéo en cours de visionnage:', videoId);
    }
  }, [videoId]);

  if (isLoading) {
    return (
      <AppLayout title="Chargement..." subtitle="Chargement de la vidéo">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AppLayout>
    );
  }

  if (error || !formation || !currentVideo) {
    return (
      <AppLayout title="Erreur" subtitle="Vidéo introuvable">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 mb-4">
            {error?.message || 'Cette vidéo n\'existe pas ou n\'est pas disponible.'}
          </p>
          <Button
            onClick={() => navigate(formationId ? `/student/formations/${formationId}` : '/student/catalog')}
            variant="outline"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={currentVideo.title} subtitle={formation.title}>
      <div className="space-y-6">
        {/* Navigation Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/student/formations/${formationId}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à la formation
          </Button>

          {isCompleted ? (
            <div className="flex items-center gap-2 text-green-600 font-medium text-sm">
              <CheckCircle className="h-5 w-5" />
              <span>Vidéo terminée</span>
            </div>
          ) : (
            <Button
              onClick={handleMarkComplete}
              disabled={updateProgress.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {updateProgress.isPending ? 'Enregistrement...' : 'Marquer comme terminé'}
            </Button>
          )}
        </div>

        {/* Video Player */}
        <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
          {youtubeVideoId ? (
            <div className="relative" style={{ paddingBottom: '56.25%' }}>
              <iframe
                className="absolute top-0 left-0 w-full h-full"
                src={`https://www.youtube.com/embed/${youtubeVideoId}?rel=0`}
                title={currentVideo.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="aspect-video bg-gray-900 flex items-center justify-center">
              <div className="text-center text-white">
                <PlayCircle className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">URL de vidéo non disponible</p>
                <p className="text-sm text-gray-400 mt-2">
                  {currentVideo.youtube_url || 'Aucune URL configurée'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Video Info */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <PlayCircle className="h-5 w-5 text-purple-600" />
                <h1 className="text-2xl font-bold text-gray-900">{currentVideo.title}</h1>
              </div>
              {currentModule && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <BookOpen className="h-4 w-4 text-gray-400" />
                  <span>{currentModule.title}</span>
                </div>
              )}
            </div>

            {currentVideo.duration_seconds && (
              <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded-lg">
                <Clock className="h-4 w-4 text-gray-400" />
                <span>{formatDuration(currentVideo.duration_seconds)}</span>
              </div>
            )}
          </div>

          {currentVideo.description && (
            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Description</h3>
              <p className="text-gray-600 whitespace-pre-wrap">{currentVideo.description}</p>
            </div>
          )}
        </div>

        {/* Video Navigation */}
        {(previousVideo || nextVideo) && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Navigation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {previousVideo ? (
                <button
                  onClick={() =>
                    navigate(`/student/formations/${formationId}/videos/${previousVideo.video.id}`)
                  }
                  className="flex items-center gap-3 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all text-left"
                >
                  <ChevronLeft className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1">Vidéo précédente</p>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {previousVideo.video.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{previousVideo.module.title}</p>
                  </div>
                </button>
              ) : (
                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center">
                  <p className="text-sm text-gray-400">Première vidéo</p>
                </div>
              )}

              {nextVideo ? (
                <button
                  onClick={() =>
                    navigate(`/student/formations/${formationId}/videos/${nextVideo.video.id}`)
                  }
                  className="flex items-center gap-3 p-4 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-all text-left"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1">Vidéo suivante</p>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {nextVideo.video.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{nextVideo.module.title}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
                </button>
              ) : (
                <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center">
                  <p className="text-sm text-gray-400">Dernière vidéo</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* All Videos in Formation */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Toutes les vidéos ({allVideos.length})
          </h3>
          <div className="space-y-2">
            {allVideos.map(({ video, module }, index) => (
              <button
                key={video.id}
                onClick={() => navigate(`/student/formations/${formationId}/videos/${video.id}`)}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${video.id === videoId
                  ? 'bg-purple-50 border-purple-300 shadow-sm'
                  : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                  }`}
              >
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${video.id === videoId
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600'
                    }`}
                >
                  {video.id === videoId ? (
                    <PlayCircle className="h-4 w-4" />
                  ) : (
                    <span className="text-sm font-medium">{index + 1}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${video.id === videoId ? 'text-purple-900' : 'text-gray-900'
                      }`}
                  >
                    {video.title}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{module.title}</p>
                </div>
                {video.duration_seconds && (
                  <div className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(video.duration_seconds)}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default VideoPlayer;
