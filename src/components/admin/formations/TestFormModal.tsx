import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, AlertCircle, Plus, Trash2, Check } from 'lucide-react';
import {
  useCreateTest,
  useCreateQuestion,
  useCreateChoice,
} from '@/hooks/useCours';

interface QuestionData {
  tempId: string;
  question_text: string;
  points: number;
  choices: ChoiceData[];
}

interface ChoiceData {
  tempId: string;
  choice_text: string;
  is_correct: boolean;
}

interface TestFormModalProps {
  moduleId: string;
  onClose: () => void;
}

export const TestFormModal: React.FC<TestFormModalProps> = ({ moduleId, onClose }) => {
  const createTest = useCreateTest();
  const createQuestion = useCreateQuestion();
  const createChoice = useCreateChoice();

  const [testData, setTestData] = useState({
    title: '',
    description: '',
    passing_score: 60,
    time_limit_minutes: '',
    max_attempts: '',
    show_correct_answers: true,
  });

  const [questions, setQuestions] = useState<QuestionData[]>([
    {
      tempId: `q-${Date.now()}`,
      question_text: '',
      points: 1,
      choices: [
        { tempId: `c-${Date.now()}-1`, choice_text: '', is_correct: false },
        { tempId: `c-${Date.now()}-2`, choice_text: '', is_correct: false },
      ],
    },
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        tempId: `q-${Date.now()}`,
        question_text: '',
        points: 1,
        choices: [
          { tempId: `c-${Date.now()}-1`, choice_text: '', is_correct: false },
          { tempId: `c-${Date.now()}-2`, choice_text: '', is_correct: false },
        ],
      },
    ]);
  };

  const removeQuestion = (tempId: string) => {
    if (questions.length === 1) {
      setErrors({ questions: 'Un test doit avoir au moins une question' });
      return;
    }
    setQuestions(questions.filter((q) => q.tempId !== tempId));
    // Clear the error if it exists
    if (errors.questions) {
      const newErrors = { ...errors };
      delete newErrors.questions;
      setErrors(newErrors);
    }
  };

  const updateQuestion = (tempId: string, field: string, value: string | number) => {
    setQuestions(
      questions.map((q) => (q.tempId === tempId ? { ...q, [field]: value } : q))
    );
  };

  const addChoice = (questionTempId: string) => {
    setQuestions(
      questions.map((q) =>
        q.tempId === questionTempId
          ? {
              ...q,
              choices: [
                ...q.choices,
                { tempId: `c-${Date.now()}`, choice_text: '', is_correct: false },
              ],
            }
          : q
      )
    );
  };

  const removeChoice = (questionTempId: string, choiceTempId: string) => {
    setQuestions(
      questions.map((q) => {
        if (q.tempId === questionTempId) {
          if (q.choices.length <= 2) {
            setErrors({
              ...errors,
              [`choices-${questionTempId}`]:
                'Une question doit avoir au moins 2 choix de réponse',
            });
            return q;
          }
          return {
            ...q,
            choices: q.choices.filter((c) => c.tempId !== choiceTempId),
          };
        }
        return q;
      })
    );
  };

  const updateChoice = (
    questionTempId: string,
    choiceTempId: string,
    field: string,
    value: string | boolean
  ) => {
    setQuestions(
      questions.map((q) =>
        q.tempId === questionTempId
          ? {
              ...q,
              choices: q.choices.map((c) =>
                c.tempId === choiceTempId ? { ...c, [field]: value } : c
              ),
            }
          : q
      )
    );
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Test metadata validation
    if (!testData.title.trim()) {
      newErrors.title = 'Le titre est obligatoire';
    }

    if (testData.passing_score < 0 || testData.passing_score > 100) {
      newErrors.passing_score = 'Le score de réussite doit être entre 0 et 100';
    }

    if (testData.time_limit_minutes && parseInt(testData.time_limit_minutes) < 1) {
      newErrors.time_limit_minutes = 'La limite de temps doit être d\'au moins 1 minute';
    }

    if (testData.max_attempts && parseInt(testData.max_attempts) < 1) {
      newErrors.max_attempts = 'Le nombre de tentatives doit être d\'au moins 1';
    }

    // Questions validation
    if (questions.length === 0) {
      newErrors.questions = 'Le test doit avoir au moins une question';
    }

    questions.forEach((question, qIndex) => {
      if (!question.question_text.trim()) {
        newErrors[`question-${question.tempId}`] = `Question ${qIndex + 1}: Le texte est obligatoire`;
      }

      if (question.points < 0) {
        newErrors[`points-${question.tempId}`] = `Question ${qIndex + 1}: Les points doivent être positifs`;
      }

      if (question.choices.length < 2) {
        newErrors[`choices-${question.tempId}`] = `Question ${qIndex + 1}: Au moins 2 choix requis`;
      }

      const hasCorrectAnswer = question.choices.some((c) => c.is_correct);
      if (!hasCorrectAnswer) {
        newErrors[`correct-${question.tempId}`] =
          `Question ${qIndex + 1}: Au moins un choix doit être marqué comme correct`;
      }

      question.choices.forEach((choice, cIndex) => {
        if (!choice.choice_text.trim()) {
          newErrors[`choice-${choice.tempId}`] =
            `Question ${qIndex + 1}, Choix ${cIndex + 1}: Le texte est obligatoire`;
        }
      });
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Step 1: Create the test
      const test = await createTest.mutateAsync({
        moduleId,
        data: {
          title: testData.title.trim(),
          description: testData.description.trim() || undefined,
          passing_score: testData.passing_score,
          time_limit_minutes: testData.time_limit_minutes
            ? parseInt(testData.time_limit_minutes)
            : undefined,
          max_attempts: testData.max_attempts ? parseInt(testData.max_attempts) : undefined,
          show_correct_answers: testData.show_correct_answers,
        },
      });

      // Step 2: Create questions sequentially
      for (let i = 0; i < questions.length; i++) {
        const questionData = questions[i];
        const question = await createQuestion.mutateAsync({
          testId: test.id,
          data: {
            question_text: questionData.question_text.trim(),
            points: questionData.points,
            order_index: i,
          },
        });

        // Step 3: Create choices for this question
        for (let j = 0; j < questionData.choices.length; j++) {
          const choiceData = questionData.choices[j];
          await createChoice.mutateAsync({
            questionId: question.id,
            data: {
              choice_text: choiceData.choice_text.trim(),
              is_correct: choiceData.is_correct,
              order_index: j,
            },
          });
        }
      }

      onClose();
    } catch (error) {
      console.error('Error creating test:', error);
      setErrors({
        submit: 'Une erreur est survenue lors de la création du test',
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10 rounded-t-lg">
          <h2 className="text-xl font-semibold text-gray-900">Créer un test</h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-8 max-h-[calc(90vh-140px)] overflow-y-auto">
          {/* Submit Error */}
          {errors.submit && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{errors.submit}</p>
            </div>
          )}

          {/* Test Metadata Section */}
          <div className="space-y-6 bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <span className="bg-orange-100 text-orange-700 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">
                1
              </span>
              Informations du test
            </h3>

            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                Titre du test <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                value={testData.title}
                onChange={(e) => setTestData({ ...testData, title: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                  errors.title ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Ex: Quiz sur les bases de données relationnelles"
              />
              {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={testData.description}
                onChange={(e) => setTestData({ ...testData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="Décrivez les objectifs et le contenu de ce test..."
              />
            </div>

            {/* Test Settings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Passing Score */}
              <div>
                <label
                  htmlFor="passing_score"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Score de réussite (%) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="passing_score"
                  value={testData.passing_score}
                  onChange={(e) =>
                    setTestData({ ...testData, passing_score: parseInt(e.target.value) || 0 })
                  }
                  min="0"
                  max="100"
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                    errors.passing_score ? 'border-red-300' : 'border-gray-300'
                  }`}
                />
                {errors.passing_score && (
                  <p className="mt-1 text-sm text-red-600">{errors.passing_score}</p>
                )}
              </div>

              {/* Time Limit */}
              <div>
                <label
                  htmlFor="time_limit_minutes"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Limite de temps (minutes)
                </label>
                <input
                  type="number"
                  id="time_limit_minutes"
                  value={testData.time_limit_minutes}
                  onChange={(e) =>
                    setTestData({ ...testData, time_limit_minutes: e.target.value })
                  }
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Optionnel"
                />
                {errors.time_limit_minutes && (
                  <p className="mt-1 text-sm text-red-600">{errors.time_limit_minutes}</p>
                )}
              </div>

              {/* Max Attempts */}
              <div>
                <label
                  htmlFor="max_attempts"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Nombre de tentatives max
                </label>
                <input
                  type="number"
                  id="max_attempts"
                  value={testData.max_attempts}
                  onChange={(e) => setTestData({ ...testData, max_attempts: e.target.value })}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Illimité"
                />
                {errors.max_attempts && (
                  <p className="mt-1 text-sm text-red-600">{errors.max_attempts}</p>
                )}
              </div>

              {/* Show Correct Answers */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Afficher les bonnes réponses
                </label>
                <div className="flex items-center gap-4 h-[42px]">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={testData.show_correct_answers}
                      onChange={(e) =>
                        setTestData({ ...testData, show_correct_answers: e.target.checked })
                      }
                      className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700">
                      Montrer les réponses correctes après la soumission
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Questions Section */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <span className="bg-orange-100 text-orange-700 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">
                  2
                </span>
                Questions ({questions.length})
              </h3>
              <Button
                type="button"
                onClick={addQuestion}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Ajouter une question
              </Button>
            </div>

            {errors.questions && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-800">{errors.questions}</p>
              </div>
            )}

            {/* Questions List */}
            <div className="space-y-6">
              {questions.map((question, qIndex) => (
                <div key={question.tempId} className="border border-gray-200 rounded-lg p-6 bg-white">
                  <div className="flex items-start justify-between mb-4">
                    <h4 className="font-semibold text-gray-900">Question {qIndex + 1}</h4>
                    {questions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeQuestion(question.tempId)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 p-1 rounded"
                        title="Supprimer cette question"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Question Text */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Texte de la question <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={question.question_text}
                      onChange={(e) =>
                        updateQuestion(question.tempId, 'question_text', e.target.value)
                      }
                      rows={2}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                        errors[`question-${question.tempId}`]
                          ? 'border-red-300'
                          : 'border-gray-300'
                      }`}
                      placeholder="Entrez la question..."
                    />
                    {errors[`question-${question.tempId}`] && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors[`question-${question.tempId}`]}
                      </p>
                    )}
                  </div>

                  {/* Points */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Points</label>
                    <input
                      type="number"
                      value={question.points}
                      onChange={(e) =>
                        updateQuestion(question.tempId, 'points', parseInt(e.target.value) || 1)
                      }
                      min="0"
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    />
                    {errors[`points-${question.tempId}`] && (
                      <p className="mt-1 text-sm text-red-600">
                        {errors[`points-${question.tempId}`]}
                      </p>
                    )}
                  </div>

                  {/* Choices */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Choix de réponse (cochez les bonnes réponses)
                      </label>
                      <button
                        type="button"
                        onClick={() => addChoice(question.tempId)}
                        className="text-sm text-orange-600 hover:text-orange-700 flex items-center gap-1"
                      >
                        <Plus className="h-4 w-4" />
                        Ajouter un choix
                      </button>
                    </div>

                    {errors[`choices-${question.tempId}`] && (
                      <div className="bg-red-50 border border-red-200 rounded p-2 mb-3">
                        <p className="text-sm text-red-800">
                          {errors[`choices-${question.tempId}`]}
                        </p>
                      </div>
                    )}

                    {errors[`correct-${question.tempId}`] && (
                      <div className="bg-red-50 border border-red-200 rounded p-2 mb-3">
                        <p className="text-sm text-red-800">
                          {errors[`correct-${question.tempId}`]}
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      {question.choices.map((choice, cIndex) => (
                        <div
                          key={choice.tempId}
                          className={`flex items-center gap-3 p-3 rounded-lg border ${
                            choice.is_correct
                              ? 'bg-green-50 border-green-200'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex items-center">
                            <input
                              type="checkbox"
                              checked={choice.is_correct}
                              onChange={(e) =>
                                updateChoice(
                                  question.tempId,
                                  choice.tempId,
                                  'is_correct',
                                  e.target.checked
                                )
                              }
                              className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                              title="Marquer comme bonne réponse"
                            />
                            {choice.is_correct && (
                              <Check className="h-4 w-4 text-green-600 ml-1" />
                            )}
                          </div>
                          <input
                            type="text"
                            value={choice.choice_text}
                            onChange={(e) =>
                              updateChoice(
                                question.tempId,
                                choice.tempId,
                                'choice_text',
                                e.target.value
                              )
                            }
                            className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent ${
                              errors[`choice-${choice.tempId}`]
                                ? 'border-red-300'
                                : 'border-gray-300'
                            }`}
                            placeholder={`Choix ${cIndex + 1}`}
                          />
                          {question.choices.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeChoice(question.tempId, choice.tempId)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-100 p-1 rounded"
                              title="Supprimer ce choix"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t sticky bottom-0 bg-white">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-w-[180px] bg-orange-600 hover:bg-orange-700"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Création en cours...</span>
                </div>
              ) : (
                'Créer le test'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
