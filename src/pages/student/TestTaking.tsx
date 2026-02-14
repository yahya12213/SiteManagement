import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Clock,
  FileQuestion,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Award,
  BookOpen,
} from 'lucide-react';
import { useStudentFormation } from '@/hooks/useStudent';

interface AnswerState {
  [questionId: string]: string; // questionId -> selected choiceId
}

const TestTaking: React.FC = () => {
  const { id: formationId, testId } = useParams<{ id: string; testId: string }>();
  const navigate = useNavigate();

  // Use the new integrated student hook
  const { data: formation, isLoading, error } = useStudentFormation(formationId);
  // Placeholder for test submission hook
  const submitAttempt = { mutateAsync: async (data: any) => console.log('Submit test attempt:', data) };

  const [answers, setAnswers] = useState<AnswerState>({});
  const [submitted, setSubmitted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [startTime] = useState<Date>(new Date());

  // Find current test and its module
  const currentTest = formation?.modules
    ?.flatMap((module) => module.tests || [])
    .find((test) => test.id === testId);

  const currentModule = formation?.modules?.find((module) =>
    module.tests?.some((test) => test.id === testId)
  );

  const questions = currentTest?.questions || [];

  // Initialize timer if time limit exists
  useEffect(() => {
    if (currentTest?.time_limit_minutes && !submitted) {
      setTimeRemaining(currentTest.time_limit_minutes * 60);

      const timer = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev === null || prev <= 0) {
            clearInterval(timer);
            // Auto-submit when time runs out
            if (!submitted) {
              handleSubmit();
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [currentTest, submitted]);

  const handleAnswerChange = (questionId: string, choiceId: string) => {
    if (submitted) return;
    setAnswers((prev) => ({
      ...prev,
      [questionId]: choiceId,
    }));
  };

  const handleSubmit = async () => {
    if (submitted || !testId) return;

    // Check if all questions are answered
    const unansweredCount = questions.filter((q) => !answers[q.id]).length;
    if (unansweredCount > 0) {
      if (
        !window.confirm(
          `${unansweredCount} question(s) non répondue(s). Voulez-vous vraiment soumettre le test ?`
        )
      ) {
        return;
      }
    }

    setSubmitted(true);

    // Calculate score immediately after submission
    let totalPoints = 0;
    let earnedPoints = 0;

    questions.forEach((question) => {
      totalPoints += question.points;
      const selectedChoiceId = answers[question.id];
      if (selectedChoiceId) {
        const selectedChoice = question.choices.find((c) => c.id === selectedChoiceId);
        if (selectedChoice?.is_correct) {
          earnedPoints += question.points;
        }
      }
    });

    const pointsPercentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;
    const passed = pointsPercentage >= (currentTest?.passing_score || 70);

    // Save attempt to database
    try {
      await submitAttempt.mutateAsync({
        testId,
        data: {
          answers,
          score: earnedPoints,
          total_points: totalPoints,
          passed,
        },
      });
    } catch (error) {
      console.error('Erreur lors de l\'enregistrement de la tentative:', error);
      // Continue even if save fails - user can still see results
    }
  };

  // Calculate score
  const calculateScore = () => {
    let correctCount = 0;
    let totalPoints = 0;
    let earnedPoints = 0;

    questions.forEach((question) => {
      totalPoints += question.points;
      const selectedChoiceId = answers[question.id];
      if (selectedChoiceId) {
        const selectedChoice = question.choices.find((c) => c.id === selectedChoiceId);
        if (selectedChoice?.is_correct) {
          correctCount++;
          earnedPoints += question.points;
        }
      }
    });

    const percentage = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;
    const pointsPercentage = totalPoints > 0 ? (earnedPoints / totalPoints) * 100 : 0;

    return {
      correctCount,
      totalQuestions: questions.length,
      percentage: Math.round(percentage),
      earnedPoints,
      totalPoints,
      pointsPercentage: Math.round(pointsPercentage),
      passed: pointsPercentage >= (currentTest?.passing_score || 70),
    };
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getTimeTaken = (): string => {
    if (!submitted) return '';
    const endTime = new Date();
    const diffSeconds = Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
    return formatTime(diffSeconds);
  };

  const score = submitted ? calculateScore() : null;

  if (isLoading) {
    return (
      <AppLayout title="Chargement..." subtitle="Chargement du test">
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </AppLayout>
    );
  }

  if (error || !formation || !currentTest) {
    return (
      <AppLayout title="Erreur" subtitle="Test introuvable">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 mb-4">
            {error?.message || "Ce test n'existe pas ou n'est pas disponible."}
          </p>
          <Button
            onClick={() =>
              navigate(formationId ? `/student/formations/${formationId}` : '/student/catalog')
            }
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
    <AppLayout title={currentTest.title} subtitle={formation.title}>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/student/formations/${formationId}`)}
              disabled={!submitted}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour à la formation
            </Button>

            {!submitted && timeRemaining !== null && (
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium ${timeRemaining < 60
                    ? 'bg-red-100 text-red-700'
                    : timeRemaining < 300
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-blue-100 text-blue-700'
                  }`}
              >
                <Clock className="h-4 w-4" />
                <span>{formatTime(timeRemaining)}</span>
              </div>
            )}
          </div>

          <div className="flex items-start gap-4">
            <FileQuestion className="h-6 w-6 text-orange-600 flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{currentTest.title}</h1>
              {currentModule && (
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                  <BookOpen className="h-4 w-4 text-gray-400" />
                  <span>{currentModule.title}</span>
                </div>
              )}
              {currentTest.description && (
                <p className="text-gray-600 mb-3">{currentTest.description}</p>
              )}

              <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <FileQuestion className="h-4 w-4 text-gray-400" />
                  <span>{questions.length} questions</span>
                </div>
                {currentTest.time_limit_minutes && (
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span>{currentTest.time_limit_minutes} min</span>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <Award className="h-4 w-4 text-gray-400" />
                  <span>Score minimum: {currentTest.passing_score}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Results Summary */}
        {submitted && score && (
          <div
            className={`rounded-lg shadow-sm border p-6 ${score.passed
                ? 'bg-green-50 border-green-200'
                : 'bg-red-50 border-red-200'
              }`}
          >
            <div className="flex items-center gap-3 mb-4">
              {score.passed ? (
                <CheckCircle className="h-8 w-8 text-green-600" />
              ) : (
                <XCircle className="h-8 w-8 text-red-600" />
              )}
              <div>
                <h2
                  className={`text-xl font-bold ${score.passed ? 'text-green-900' : 'text-red-900'
                    }`}
                >
                  {score.passed ? 'Test réussi !' : 'Test échoué'}
                </h2>
                <p className={score.passed ? 'text-green-700' : 'text-red-700'}>
                  Score: {score.pointsPercentage}% ({score.earnedPoints}/{score.totalPoints} points)
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Bonnes réponses</p>
                <p className="text-lg font-semibold text-gray-900">
                  {score.correctCount}/{score.totalQuestions}
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Pourcentage</p>
                <p className="text-lg font-semibold text-gray-900">{score.percentage}%</p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Points obtenus</p>
                <p className="text-lg font-semibold text-gray-900">
                  {score.earnedPoints}/{score.totalPoints}
                </p>
              </div>
              <div className="bg-white rounded-lg p-3 border border-gray-200">
                <p className="text-xs text-gray-500 mb-1">Temps écoulé</p>
                <p className="text-lg font-semibold text-gray-900">{getTimeTaken()}</p>
              </div>
            </div>
          </div>
        )}

        {/* Questions */}
        {questions.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
            <FileQuestion className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune question</h3>
            <p className="text-gray-500">Ce test n'a pas encore de questions.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {questions.map((question, index) => {
              const selectedChoiceId = answers[question.id];
              const selectedChoice = question.choices.find((c) => c.id === selectedChoiceId);
              const isCorrect = selectedChoice?.is_correct || false;

              return (
                <div key={question.id} className="bg-white rounded-lg shadow-sm border p-6">
                  {/* Question Header */}
                  <div className="flex items-start gap-3 mb-4">
                    <div
                      className={`flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 ${submitted
                          ? isCorrect
                            ? 'bg-green-100 text-green-700'
                            : selectedChoiceId
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-700'
                          : 'bg-blue-100 text-blue-700'
                        }`}
                    >
                      {submitted ? (
                        isCorrect ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : selectedChoiceId ? (
                          <XCircle className="h-4 w-4" />
                        ) : (
                          <AlertTriangle className="h-4 w-4" />
                        )
                      ) : (
                        <span className="text-sm font-medium">{index + 1}</span>
                      )}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-base font-semibold text-gray-900">
                          Question {index + 1}
                        </h3>
                        <span className="text-sm text-gray-500">{question.points} pts</span>
                      </div>
                      <p className="text-gray-700">{question.question_text}</p>
                    </div>
                  </div>

                  {/* Choices */}
                  <div className="space-y-2 ml-11">
                    {question.choices.map((choice) => {
                      const isSelected = selectedChoiceId === choice.id;
                      const showAsCorrect = submitted && choice.is_correct;
                      const showAsIncorrect = submitted && isSelected && !choice.is_correct;

                      return (
                        <label
                          key={choice.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${submitted
                              ? showAsCorrect
                                ? 'bg-green-50 border-green-300'
                                : showAsIncorrect
                                  ? 'bg-red-50 border-red-300'
                                  : 'border-gray-200 bg-gray-50'
                              : isSelected
                                ? 'bg-blue-50 border-blue-300'
                                : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                            } ${submitted ? 'cursor-default' : ''}`}
                        >
                          <input
                            type="radio"
                            name={`question-${question.id}`}
                            value={choice.id}
                            checked={isSelected}
                            onChange={() => handleAnswerChange(question.id, choice.id)}
                            disabled={submitted}
                            className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <p
                              className={`text-sm ${showAsCorrect
                                  ? 'text-green-900 font-medium'
                                  : showAsIncorrect
                                    ? 'text-red-900'
                                    : 'text-gray-900'
                                }`}
                            >
                              {choice.choice_text}
                            </p>
                            {submitted && choice.is_correct && (
                              <p className="text-xs text-green-700 mt-1">
                                ✓ Bonne réponse
                              </p>
                            )}
                            {submitted && showAsIncorrect && (
                              <p className="text-xs text-red-700 mt-1">✗ Mauvaise réponse</p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* Warning for unanswered */}
                  {!submitted && !selectedChoiceId && (
                    <div className="mt-3 ml-11 text-sm text-amber-600 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      <span>Question non répondue</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Submit Button */}
        {!submitted && questions.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <p>
                  {Object.keys(answers).length} / {questions.length} questions répondues
                </p>
                {currentTest.show_correct_answers && (
                  <p className="text-xs text-gray-500 mt-1">
                    Les réponses correctes seront affichées après la soumission
                  </p>
                )}
              </div>
              <Button onClick={handleSubmit} size="lg" className="min-w-[200px]">
                <CheckCircle className="h-5 w-5 mr-2" />
                Soumettre le test
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default TestTaking;
