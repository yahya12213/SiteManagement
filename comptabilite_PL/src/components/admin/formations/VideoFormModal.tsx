import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, AlertCircle, ExternalLink } from 'lucide-react';
import { useCreateVideo, useUpdateVideo } from '@/hooks/useCours';
import type { ModuleVideo } from '@/types/cours';

interface VideoFormModalProps {
  moduleId: string;
  video?: ModuleVideo;
  onClose: () => void;
}

export const VideoFormModal: React.FC<VideoFormModalProps> = ({ moduleId, video, onClose }) => {
  const isEdit = !!video;
  const createVideo = useCreateVideo();
  const updateVideo = useUpdateVideo();

  const [formData, setFormData] = useState({
    title: video?.title || '',
    youtube_url: video?.youtube_url || '',
    duration_seconds: video?.duration_seconds?.toString() || '',
    description: video?.description || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateYouTubeUrl = (url: string): boolean => {
    if (!url.trim()) return false;

    // Accept various YouTube URL formats
    const patterns = [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^https?:\/\/(www\.)?youtu\.be\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/embed\/[\w-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/v\/[\w-]+/,
    ];

    return patterns.some((pattern) => pattern.test(url));
  };

  const extractYouTubeId = (url: string): string | null => {
    const patterns = [
      /youtube\.com\/watch\?v=([\w-]+)/,
      /youtu\.be\/([\w-]+)/,
      /youtube\.com\/embed\/([\w-]+)/,
      /youtube\.com\/v\/([\w-]+)/,
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Le titre est obligatoire';
    }

    if (!formData.youtube_url.trim()) {
      newErrors.youtube_url = "L'URL YouTube est obligatoire";
    } else if (!validateYouTubeUrl(formData.youtube_url)) {
      newErrors.youtube_url =
        "L'URL YouTube n'est pas valide. Formats acceptés: youtube.com/watch?v=..., youtu.be/..., youtube.com/embed/...";
    }

    if (formData.duration_seconds && parseInt(formData.duration_seconds) < 0) {
      newErrors.duration_seconds = 'La durée doit être positive';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      const submitData = {
        title: formData.title.trim(),
        youtube_url: formData.youtube_url.trim(),
        duration_seconds: formData.duration_seconds
          ? parseInt(formData.duration_seconds)
          : undefined,
        description: formData.description.trim() || undefined,
      };

      if (isEdit && video) {
        await updateVideo.mutateAsync({
          id: video.id,
          data: submitData,
        });
      } else {
        await createVideo.mutateAsync({
          moduleId,
          data: submitData,
        });
      }

      onClose();
    } catch (error) {
      console.error('Error saving video:', error);
      setErrors({
        submit: 'Une erreur est survenue lors de la sauvegarde de la vidéo',
      });
    }
  };

  const videoId = extractYouTubeId(formData.youtube_url);
  const thumbnailUrl = videoId
    ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    : null;

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}min ${secs}s`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[650px] md:w-[750px] lg:w-[850px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEdit ? 'Modifier la vidéo' : 'Ajouter une vidéo'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Submit Error */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{errors.submit}</p>
            </div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Titre de la vidéo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                errors.title ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Ex: Introduction à SQL"
            />
            {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
          </div>

          {/* YouTube URL */}
          <div>
            <label htmlFor="youtube_url" className="block text-sm font-medium text-gray-700 mb-2">
              URL YouTube <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              id="youtube_url"
              value={formData.youtube_url}
              onChange={(e) => setFormData({ ...formData, youtube_url: e.target.value })}
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                errors.youtube_url ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="https://www.youtube.com/watch?v=..."
            />
            {errors.youtube_url && (
              <p className="mt-1 text-sm text-red-600">{errors.youtube_url}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Formats acceptés: youtube.com/watch?v=..., youtu.be/..., youtube.com/embed/...
            </p>

            {/* Video Preview */}
            {thumbnailUrl && !errors.youtube_url && (
              <div className="mt-3 border border-gray-200 rounded-lg overflow-hidden">
                <img src={thumbnailUrl} alt="Aperçu YouTube" className="w-full" />
                <div className="p-2 bg-gray-50 flex items-center justify-between">
                  <span className="text-xs text-gray-600">Aperçu de la vidéo</span>
                  <a
                    href={formData.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1"
                  >
                    Ouvrir sur YouTube
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Duration */}
          <div>
            <label
              htmlFor="duration_seconds"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Durée (en secondes)
            </label>
            <input
              type="number"
              id="duration_seconds"
              value={formData.duration_seconds}
              onChange={(e) => setFormData({ ...formData, duration_seconds: e.target.value })}
              min="0"
              className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent ${
                errors.duration_seconds ? 'border-red-300' : 'border-gray-300'
              }`}
              placeholder="Ex: 300"
            />
            {errors.duration_seconds && (
              <p className="mt-1 text-sm text-red-600">{errors.duration_seconds}</p>
            )}
            {formData.duration_seconds && parseInt(formData.duration_seconds) > 0 && (
              <p className="mt-1 text-xs text-gray-500">
                Équivalent: {formatDuration(parseInt(formData.duration_seconds))}
              </p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              Optionnel - Aide les étudiants à planifier leur temps d'apprentissage
            </p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Décrivez le contenu de cette vidéo..."
            />
            <p className="mt-1 text-xs text-gray-500">
              Résumé du contenu abordé dans la vidéo
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={createVideo.isPending || updateVideo.isPending}
              className="min-w-[120px] bg-purple-600 hover:bg-purple-700"
            >
              {createVideo.isPending || updateVideo.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Sauvegarde...</span>
                </div>
              ) : isEdit ? (
                'Modifier'
              ) : (
                'Ajouter'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
