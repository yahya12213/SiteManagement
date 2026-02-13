import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  ArrowLeft,
  Video,
  FileQuestion,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import {
  useFormation,
  useDeleteModule,
  useDeleteVideo,
  useDeleteTest,
} from '@/hooks/useCours';
import { ModuleFormModal } from '@/components/admin/formations/ModuleFormModal';
import { VideoFormModal } from '@/components/admin/formations/VideoFormModal';
import { TestFormModal } from '@/components/admin/formations/TestFormModal';
import { formatPrice } from '@/lib/utils/formatPrice';
import type { FormationModule, ModuleVideo, ModuleTest } from '@/types/cours';

const FormationEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: formation, isLoading, error } = useFormation(id);
  const deleteModule = useDeleteModule();
  const deleteVideo = useDeleteVideo();
  const deleteTest = useDeleteTest();

  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [moduleToEdit, setModuleToEdit] = useState<FormationModule | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  const toggleModule = (moduleId: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  const handleDeleteModule = async (module: FormationModule) => {
    if (
      window.confirm(
        `Êtes-vous sûr de vouloir supprimer le module "${module.title}" ? Toutes les vidéos et tests associés seront également supprimés.`
      )
    ) {
      try {
        await deleteModule.mutateAsync(module.id);
      } catch (error) {
        console.error('Error deleting module:', error);
        alert('Erreur lors de la suppression du module');
      }
    }
  };

  const handleDeleteVideo = async (video: ModuleVideo) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la vidéo "${video.title}" ?`)) {
      try {
        await deleteVideo.mutateAsync(video.id);
      } catch (error) {
        console.error('Error deleting video:', error);
        alert('Erreur lors de la suppression de la vidéo');
      }
    }
  };

  const handleDeleteTest = async (test: ModuleTest) => {
    if (
      window.confirm(
        `Êtes-vous sûr de vouloir supprimer le test "${test.title}" ? Toutes les questions et réponses associées seront également supprimées.`
      )
    ) {
      try {
        await deleteTest.mutateAsync(test.id);
      } catch (error) {
        console.error('Error deleting test:', error);
        alert('Erreur lors de la suppression du test');
      }
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700';
  };

  const getStatusLabel = (status: string) => {
    return status === 'published' ? 'Publiée' : 'Brouillon';
  };

  const getModuleTypeColor = (type: string) => {
    const colors = {
      video: 'bg-purple-50 text-purple-700',
      test: 'bg-orange-50 text-orange-700',
      document: 'bg-blue-50 text-blue-700',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-50 text-gray-700';
  };

  const getModuleTypeLabel = (type: string) => {
    const labels = {
      video: 'Vidéo',
      test: 'Test',
      document: 'Document',
    };
    return labels[type as keyof typeof labels] || type;
  };

  if (isLoading) {
    return (
      <AppLayout title="Chargement..." subtitle="Chargement de la formation">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AppLayout>
    );
  }

  if (error || !formation) {
    return (
      <AppLayout title="Erreur" subtitle="Formation introuvable">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-800">Formation introuvable</p>
            <p className="text-sm text-red-700 mt-1">
              {error?.message || 'Cette formation n\'existe pas ou a été supprimée.'}
            </p>
          </div>
        </div>
        <div className="mt-6">
          <Button onClick={() => navigate('/admin/formations/cours')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour aux formations
          </Button>
        </div>
      </AppLayout>
    );
  }

  const modules = formation.modules || [];

  return (
    <AppLayout title={formation.title} subtitle="Configuration de la formation">
      <div className="space-y-6">
        {/* Header with status and actions */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/admin/formations/cours')}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Retour
                </Button>
                <span
                  className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                    formation.status
                  )}`}
                >
                  {getStatusLabel(formation.status)}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{formation.title}</h2>
              {formation.description && (
                <p className="text-sm text-gray-600 mt-2">{formation.description}</p>
              )}
              <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                {formation.duration_hours && (
                  <span>{formation.duration_hours}h de contenu</span>
                )}
                {formation.price && Number(formation.price) > 0 && <span>{formatPrice(formation.price)}</span>}
                <span>{modules.length} module(s)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions bar */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={() => {
                setModuleToEdit(null);
                setShowModuleModal(true);
              }}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Ajouter un module
            </Button>
          </div>
        </div>

        {/* Modules list */}
        {modules.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun module</h3>
            <p className="text-sm text-gray-500 mb-6">
              Commencez par créer le premier module de votre formation
            </p>
            <Button
              onClick={() => {
                setModuleToEdit(null);
                setShowModuleModal(true);
              }}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Créer un module
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {modules.map((module) => {
              const isExpanded = expandedModules.has(module.id);
              const videos = module.videos || [];
              const tests = module.tests || [];
              const hasContent = videos.length > 0 || tests.length > 0;

              return (
                <div key={module.id} className="bg-white rounded-lg shadow-sm border">
                  {/* Module header */}
                  <div className="p-4 flex items-center gap-3">
                    <button
                      onClick={() => toggleModule(module.id)}
                      className="text-gray-400 hover:text-gray-600"
                      disabled={!hasContent}
                    >
                      {hasContent ? (
                        isExpanded ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )
                      ) : (
                        <div className="w-5 h-5"></div>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-gray-500">
                          #{module.order_index + 1}
                        </span>
                        <h3 className="text-base font-semibold text-gray-900 truncate">
                          {module.title}
                        </h3>
                        <span
                          className={`px-2 py-0.5 text-xs font-medium rounded-full ${getModuleTypeColor(
                            module.module_type
                          )}`}
                        >
                          {getModuleTypeLabel(module.module_type)}
                        </span>
                      </div>
                      {module.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">{module.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                        <span>{videos.length} vidéo(s)</span>
                        <span>{tests.length} test(s)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedModuleId(module.id);
                          setShowVideoModal(true);
                        }}
                        className="text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                        title="Ajouter une vidéo"
                      >
                        <Video className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedModuleId(module.id);
                          setShowTestModal(true);
                        }}
                        className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                        title="Ajouter un test"
                      >
                        <FileQuestion className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setModuleToEdit(module);
                          setShowModuleModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        title="Éditer le module"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteModule(module)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Supprimer le module"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Module content (videos and tests) */}
                  {isExpanded && hasContent && (
                    <div className="border-t bg-gray-50 px-4 py-3 space-y-2">
                      {/* Videos */}
                      {videos.map((video) => (
                        <div
                          key={video.id}
                          className="bg-white rounded border border-purple-100 p-3 flex items-center gap-3"
                        >
                          <Video className="h-4 w-4 text-purple-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {video.title}
                            </p>
                            {video.duration_seconds && (
                              <p className="text-xs text-gray-500">
                                {Math.floor(video.duration_seconds / 60)}min{' '}
                                {video.duration_seconds % 60}s
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteVideo(video)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      {/* Tests */}
                      {tests.map((test) => (
                        <div
                          key={test.id}
                          className="bg-white rounded border border-orange-100 p-3 flex items-center gap-3"
                        >
                          <FileQuestion className="h-4 w-4 text-orange-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {test.title}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                              <span>{test.questions?.length || 0} question(s)</span>
                              {test.time_limit_minutes && (
                                <span>{test.time_limit_minutes} min</span>
                              )}
                              <span>Score min: {test.passing_score}%</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteTest(test)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Module Modal */}
      {showModuleModal && id && (
        <ModuleFormModal
          formationId={id}
          module={moduleToEdit || undefined}
          modules={modules}
          onClose={() => {
            setShowModuleModal(false);
            setModuleToEdit(null);
          }}
        />
      )}

      {/* Video Modal */}
      {showVideoModal && selectedModuleId && (
        <VideoFormModal
          moduleId={selectedModuleId}
          onClose={() => {
            setShowVideoModal(false);
            setSelectedModuleId(null);
          }}
        />
      )}

      {/* Test Modal */}
      {showTestModal && selectedModuleId && (
        <TestFormModal
          moduleId={selectedModuleId}
          onClose={() => {
            setShowTestModal(false);
            setSelectedModuleId(null);
          }}
        />
      )}
    </AppLayout>
  );
};

export default FormationEditor;
