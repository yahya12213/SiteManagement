import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Award,
  PlayCircle,
  FileQuestion,
  ChevronRight,
  ChevronDown,
  Lock,
  CheckCircle,
  MessageSquare,
} from 'lucide-react';
import { useStudentFormation } from '@/hooks/useStudent';
import { ProgressBar, ProgressStats } from '@/components/student/ProgressBar';
import type { FormationModule, ModuleVideo } from '@/types/cours';

const FormationViewer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Use the new student-specific hook which includes full content and progress
  const { data: formation, isLoading, error } = useStudentFormation(id);

  // Progress summary is now bundled in the formation data
  const progressSummary = formation?.summary;

  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // Check if certificate exists (placeholder for now, can be improved with real data)
  const hasCertificate = progressSummary && progressSummary.overall_progress >= 100;

  const toggleModule = (moduleId: string) => {
    const newExpanded = new Set(expandedModules);
    if (newExpanded.has(moduleId)) {
      newExpanded.delete(moduleId);
    } else {
      newExpanded.add(moduleId);
    }
    setExpandedModules(newExpanded);
  };

  // Check if video is completed (using the new is_completed field from serializer)
  const isVideoCompleted = (videoId: string): boolean => {
    // Find video in modules
    const allVideos: ModuleVideo[] = formation?.modules?.flatMap((m: FormationModule) => m.videos || []) || [];
    const video = allVideos.find((v: ModuleVideo) => v.id === videoId);
    return video?.is_completed || false;
  };

  // Check if test is passed (Placeholder as tests are not implemented in backend)
  const isTestPassed = (_testId: string): boolean => {
    return false;
  };

  const getLevelBadge = (level?: string) => {
    const badges = {
      debutant: { bg: 'bg-green-100', text: 'text-green-700', label: 'Débutant' },
      intermediaire: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Intermédiaire' },
      avance: { bg: 'bg-red-100', text: 'text-red-700', label: 'Avancé' },
    };
    const badge = level && level in badges ? badges[level as keyof typeof badges] : { bg: 'bg-gray-100', text: 'text-gray-700', label: 'N/A' };
    return (
      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const getModuleTypeIcon = (type: string) => {
    if (type === 'video') return <PlayCircle className="h-5 w-5 text-purple-600" />;
    if (type === 'test') return <FileQuestion className="h-5 w-5 text-orange-600" />;
    return <BookOpen className="h-5 w-5 text-blue-600" />;
  };

  const isModuleAccessible = (module: FormationModule, modules: FormationModule[]) => {
    // If no prerequisite, module is accessible
    if (!module.prerequisite_module_id) return true;

    // Check if prerequisite module exists
    const prerequisite = modules.find((m) => m.id === module.prerequisite_module_id);
    if (!prerequisite) return true; // If prerequisite not found, allow access

    // In a real app, check if user completed prerequisite
    // For now, we'll allow access to all modules
    return true;
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
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 mb-4">
            {error instanceof Error ? error.message : 'Cette formation n\'existe pas ou n\'est pas disponible.'}
          </p>
          <Button onClick={() => navigate('/student/dashboard')} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour au tableau de bord
          </Button>
        </div>
      </AppLayout>
    );
  }

  const modules: FormationModule[] = formation.modules || [];
  const totalVideos = modules.reduce((sum: number, m: FormationModule) => sum + (m.videos?.length || 0), 0);
  const totalTests = modules.reduce((sum: number, m: FormationModule) => sum + (m.tests?.length || 0), 0);

  return (
    <AppLayout title={formation.title} subtitle="Contenu de la formation">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/student/catalog')}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour au catalogue
          </Button>

          <div className="flex items-start gap-6">
            {/* Thumbnail */}
            <div className="hidden md:block">
              {formation.thumbnail_url ? (
                <img
                  src={formation.thumbnail_url}
                  alt={formation.title}
                  className="w-48 h-32 object-cover rounded-lg"
                />
              ) : (
                <div className="w-48 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <BookOpen className="h-12 w-12 text-white opacity-50" />
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-2xl font-bold text-gray-900">{formation.title}</h1>
                {getLevelBadge(formation.level)}
              </div>

              {formation.description && (
                <p className="text-gray-600 mb-4">{formation.description}</p>
              )}

              <div className="flex flex-wrap gap-6 text-sm text-gray-600">
                {formation.duration_hours && (
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span>{formation.duration_hours}h de contenu</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-gray-400" />
                  <span>{modules.length} module(s)</span>
                </div>
                <div className="flex items-center gap-2">
                  <PlayCircle className="h-4 w-4 text-gray-400" />
                  <span>{totalVideos} vidéo(s)</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileQuestion className="h-4 w-4 text-gray-400" />
                  <span>{totalTests} test(s)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-gray-400" />
                  <span>Score de réussite: {formation.passing_score_percentage}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Progress Section */}
        {progressSummary && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Votre progression</h2>

            {/* Overall Progress */}
            <div className="mb-6">
              <ProgressBar
                progress={progressSummary.overall_progress}
                label="Progression globale"
                color="purple"
                size="lg"
              />
            </div>

            {/* Certificate Badge */}
            {hasCertificate && (
              <div className="mb-6">
                <div
                  onClick={() => navigate('/student/certificates')}
                  className="bg-gradient-to-r from-amber-50 to-amber-100 border-2 border-amber-300 rounded-lg p-4 cursor-pointer hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="bg-amber-500 p-3 rounded-full">
                      <Award className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-amber-900 mb-1">
                        🎉 Certificat disponible !
                      </h3>
                      <p className="text-sm text-amber-700">
                        Félicitations ! Vous avez terminé cette formation. Cliquez ici pour télécharger votre certificat.
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-amber-600" />
                  </div>
                </div>
              </div>
            )}

            {/* Forum Access */}
            <div className="mb-6">
              <div
                onClick={() => navigate(`/student/forums/${id}`)}
                className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-lg p-4 cursor-pointer hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-full">
                    <MessageSquare className="h-6 w-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900 mb-1">
                      💬 Forum de discussion
                    </h3>
                    <p className="text-sm text-blue-700">
                      Posez vos questions, partagez vos idées et discutez avec les autres étudiants.
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-blue-600" />
                </div>
              </div>
            </div>

            {/* Detailed Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ProgressStats
                completed={progressSummary.completed_videos}
                total={progressSummary.total_videos}
                label="Vidéos terminées"
                color="blue"
              />
              <ProgressStats
                completed={progressSummary.passed_tests}
                total={progressSummary.total_tests}
                label="Tests réussis"
                color="green"
              />
            </div>
          </div>
        )}

        {/* Content */}
        {modules.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
            <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucun contenu disponible
            </h3>
            <p className="text-gray-500">
              Cette formation n'a pas encore de contenu. Revenez plus tard.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="p-6 border-b">
              <h2 className="text-xl font-bold text-gray-900">Contenu de la formation</h2>
              <p className="text-sm text-gray-600 mt-1">
                Cliquez sur un module pour voir son contenu
              </p>
            </div>

            <div className="divide-y">
              {modules.map((module, index) => {
                const isExpanded = expandedModules.has(module.id);
                const isAccessible = isModuleAccessible(module, modules);
                const videos = module.videos || [];
                const tests = module.tests || [];
                const hasContent = videos.length > 0 || tests.length > 0;

                return (
                  <div key={module.id}>
                    {/* Module Header */}
                    <div
                      className={`p-4 hover:bg-gray-50 transition-colors ${!isAccessible ? 'opacity-60' : 'cursor-pointer'
                        }`}
                      onClick={() => isAccessible && hasContent && toggleModule(module.id)}
                    >
                      <div className="flex items-center gap-3">
                        {hasContent ? (
                          <button className="text-gray-400 hover:text-gray-600">
                            {isExpanded ? (
                              <ChevronDown className="h-5 w-5" />
                            ) : (
                              <ChevronRight className="h-5 w-5" />
                            )}
                          </button>
                        ) : (
                          <div className="w-5" />
                        )}

                        {getModuleTypeIcon(module.module_type)}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-500">
                              Module {index + 1}
                            </span>
                            {!isAccessible && (
                              <Lock className="h-4 w-4 text-gray-400" />
                            )}
                          </div>
                          <h3 className="text-base font-semibold text-gray-900">
                            {module.title}
                          </h3>
                          {module.description && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                              {module.description}
                            </p>
                          )}
                        </div>

                        <div className="text-sm text-gray-500">
                          {videos.length > 0 && (
                            <span className="mr-3">{videos.length} vidéo(s)</span>
                          )}
                          {tests.length > 0 && <span>{tests.length} test(s)</span>}
                        </div>
                      </div>
                    </div>

                    {/* Module Content */}
                    {isExpanded && hasContent && (
                      <div className="bg-gray-50 px-4 py-3 space-y-2">
                        {/* Videos */}
                        {videos.map((video, vIndex) => {
                          const completed = isVideoCompleted(video.id);
                          return (
                            <div
                              key={video.id}
                              className={`bg-white rounded-lg border p-3 hover:shadow-md transition-shadow cursor-pointer ${completed ? 'border-green-300 bg-green-50' : 'border-purple-200'
                                }`}
                              onClick={() =>
                                navigate(
                                  `/student/formations/${formation.id}/videos/${video.id}`
                                )
                              }
                            >
                              <div className="flex items-center gap-3">
                                <PlayCircle className={`h-5 w-5 flex-shrink-0 ${completed ? 'text-green-600' : 'text-purple-600'
                                  }`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900">
                                    Vidéo {vIndex + 1}: {video.title}
                                  </p>
                                  {video.duration_seconds && (
                                    <p className="text-xs text-gray-500">
                                      Durée: {Math.floor(video.duration_seconds / 60)} min{' '}
                                      {video.duration_seconds % 60} sec
                                    </p>
                                  )}
                                </div>
                                {completed ? (
                                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-gray-400" />
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {/* Tests */}
                        {tests.map((test, tIndex) => {
                          const passed = isTestPassed(test.id);
                          return (
                            <div
                              key={test.id}
                              className={`bg-white rounded-lg border p-3 hover:shadow-md transition-shadow cursor-pointer ${passed ? 'border-green-300 bg-green-50' : 'border-orange-200'
                                }`}
                              onClick={() =>
                                navigate(`/student/formations/${formation.id}/tests/${test.id}`)
                              }
                            >
                              <div className="flex items-center gap-3">
                                <FileQuestion className={`h-5 w-5 flex-shrink-0 ${passed ? 'text-green-600' : 'text-orange-600'
                                  }`} />
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900">
                                    Test {tIndex + 1}: {test.title}
                                  </p>
                                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                    {test.questions && (
                                      <span>{test.questions.length} question(s)</span>
                                    )}
                                    {test.time_limit_minutes && (
                                      <span>⏱️ {test.time_limit_minutes} min</span>
                                    )}
                                    <span>Score min: {test.passing_score}%</span>
                                  </div>
                                </div>
                                {passed ? (
                                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                                ) : (
                                  <ChevronRight className="h-5 w-5 text-gray-400" />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default FormationViewer;
