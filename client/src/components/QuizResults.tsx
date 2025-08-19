import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/utils/trpc';
import type { QuizResult } from '../../../server/src/schema';

interface QuizResultsProps {
  attemptId: number;
  onBackToDashboard: () => void;
}

export function QuizResults({ attemptId, onBackToDashboard }: QuizResultsProps) {
  const [results, setResults] = useState<QuizResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadResults = async () => {
      try {
        const resultsData = await trpc.getQuizResult.query({ attemptId });
        setResults(resultsData);
      } catch (error) {
        console.error('Failed to load results:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadResults();
  }, [attemptId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">🔄</div>
          <p className="text-gray-600">Loading your results...</p>
        </div>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-4">❌</div>
          <p className="text-gray-600">Failed to load results</p>
          <Button onClick={onBackToDashboard} className="mt-4">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const percentage = Math.round((results.score / results.total_questions) * 100);
  const timeTaken = Math.floor(results.time_taken_seconds / 60);
  
  const getPerformanceLevel = () => {
    if (percentage >= 90) return { level: '🏆 Excellent!', color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' };
    if (percentage >= 80) return { level: '🥇 Great!', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' };
    if (percentage >= 70) return { level: '🥈 Good!', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' };
    if (percentage >= 60) return { level: '🥉 Not Bad!', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' };
    return { level: '📚 Keep Learning!', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' };
  };

  const performance = getPerformanceLevel();
  const correctAnswers = results.answers.filter(a => a.is_correct);
  const incorrectAnswers = results.answers.filter(a => !a.is_correct);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Celebration Header */}
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">🎉</div>
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          Quiz Complete!
        </h1>
        <p className="text-gray-600">
          Here are your detailed results
        </p>
      </div>

      {/* Score Overview */}
      <Card className={`mb-8 ${performance.bg} ${performance.border} border-2`}>
        <CardContent className="p-8">
          <div className="text-center">
            <div className="text-6xl mb-4">{percentage >= 80 ? '🏆' : percentage >= 60 ? '🎯' : '📚'}</div>
            <div className={`text-3xl font-bold mb-2 ${performance.color}`}>
              {performance.level}
            </div>
            <div className="text-5xl font-bold mb-4">
              {results.score}/{results.total_questions}
            </div>
            <Badge className="text-2xl px-6 py-2 bg-gradient-to-r from-blue-500 to-purple-500">
              {percentage}% Score
            </Badge>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-white/50 rounded-lg">
              <div className="text-2xl mb-2">✅</div>
              <div className="text-2xl font-bold text-green-600">{results.correct_answers}</div>
              <div className="text-sm text-gray-600">Correct Answers</div>
            </div>
            <div className="text-center p-4 bg-white/50 rounded-lg">
              <div className="text-2xl mb-2">❌</div>
              <div className="text-2xl font-bold text-red-600">{results.incorrect_answers}</div>
              <div className="text-sm text-gray-600">Incorrect Answers</div>
            </div>
            <div className="text-center p-4 bg-white/50 rounded-lg">
              <div className="text-2xl mb-2">⏱️</div>
              <div className="text-2xl font-bold text-blue-600">{timeTaken}m</div>
              <div className="text-sm text-gray-600">Time Taken</div>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Overall Performance</span>
              <span className="text-sm text-gray-600">{percentage}%</span>
            </div>
            <Progress value={percentage} className="h-3" />
          </div>
        </CardContent>
      </Card>

      {/* Detailed Results */}
      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="summary">📊 Summary</TabsTrigger>
          <TabsTrigger value="correct">✅ Correct ({results.correct_answers})</TabsTrigger>
          <TabsTrigger value="incorrect">❌ Incorrect ({results.incorrect_answers})</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  📈 Performance Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Correct Answers</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={(results.correct_answers / results.total_questions) * 100} className="w-24 h-2" />
                      <span className="text-green-600 font-bold">{results.correct_answers}</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Incorrect Answers</span>
                    <div className="flex items-center space-x-2">
                      <Progress value={(results.incorrect_answers / results.total_questions) * 100} className="w-24 h-2" />
                      <span className="text-red-600 font-bold">{results.incorrect_answers}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  ⏰ Time Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Total Time</span>
                    <span className="font-bold">{timeTaken} minutes</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Average per Question</span>
                    <span className="font-bold">{Math.round(results.time_taken_seconds / results.total_questions)} seconds</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Completed</span>
                    <span className="font-bold">{results.completed_at.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Motivational Message */}
          <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
            <CardContent className="p-6 text-center">
              <div className="text-4xl mb-4">
                {percentage >= 90 ? '🌟' : percentage >= 80 ? '🎯' : percentage >= 60 ? '💪' : '🚀'}
              </div>
              <h3 className="text-xl font-bold mb-2">
                {percentage >= 90 ? 'Outstanding Performance!' : 
                 percentage >= 80 ? 'Great Job!' :
                 percentage >= 60 ? 'Good Effort!' : 
                 'Keep Practicing!'}
              </h3>
              <p className="text-gray-600">
                {percentage >= 90 ? 'You\'ve mastered this topic! Consider helping others or taking on more challenging quizzes.' :
                 percentage >= 80 ? 'You have a solid understanding. Review the incorrect answers to reach perfection.' :
                 percentage >= 60 ? 'You\'re on the right track. Focus on the areas where you had incorrect answers.' :
                 'Don\'t be discouraged! Learning takes time. Review the material and try again when you\'re ready.'}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="correct" className="space-y-4">
          <ScrollArea className="h-[600px] w-full rounded-md border p-4">
            {correctAnswers.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">😔</div>
                <p className="text-gray-600">No correct answers to show</p>
              </div>
            ) : (
              <div className="space-y-4">
                {correctAnswers.map((answer, index) => (
                  <Card key={answer.question_id} className="border-green-200 bg-green-50">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <Badge variant="outline" className="text-green-700 border-green-300">
                          Question #{results.answers.findIndex(a => a.question_id === answer.question_id) + 1}
                        </Badge>
                        <Badge className="bg-green-500">✅ Correct</Badge>
                      </div>
                      
                      <div className="mb-3 font-medium">
                        {answer.question_text}
                      </div>

                      <div className="space-y-2">
                        {[
                          { key: 'A', value: answer.option_a, emoji: '🅰️' },
                          { key: 'B', value: answer.option_b, emoji: '🅱️' },
                          { key: 'C', value: answer.option_c, emoji: '🅲' },
                          { key: 'D', value: answer.option_d, emoji: '🅳' },
                          { key: 'E', value: answer.option_e, emoji: '🅴' },
                        ].map((option) => (
                          <div
                            key={option.key}
                            className={`flex items-center space-x-2 p-2 rounded ${
                              answer.selected_answer === option.key
                                ? 'bg-green-100 border-2 border-green-300 font-medium'
                                : 'bg-white'
                            }`}
                          >
                            <span>{option.emoji}</span>
                            <span>{option.value}</span>
                            {answer.selected_answer === option.key && (
                              <span className="ml-auto text-green-600">✅ Your Answer</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="incorrect" className="space-y-4">
          <ScrollArea className="h-[600px] w-full rounded-md border p-4">
            {incorrectAnswers.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-4xl mb-4">🎉</div>
                <p className="text-gray-600">Perfect score! No incorrect answers!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {incorrectAnswers.map((answer, index) => (
                  <Card key={answer.question_id} className="border-red-200 bg-red-50">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <Badge variant="outline" className="text-red-700 border-red-300">
                          Question #{results.answers.findIndex(a => a.question_id === answer.question_id) + 1}
                        </Badge>
                        <Badge variant="destructive">❌ Incorrect</Badge>
                      </div>
                      
                      <div className="mb-3 font-medium">
                        {answer.question_text}
                      </div>

                      <div className="space-y-2">
                        {[
                          { key: 'A', value: answer.option_a, emoji: '🅰️' },
                          { key: 'B', value: answer.option_b, emoji: '🅱️' },
                          { key: 'C', value: answer.option_c, emoji: '🅲' },
                          { key: 'D', value: answer.option_d, emoji: '🅳' },
                          { key: 'E', value: answer.option_e, emoji: '🅴' },
                        ].map((option) => (
                          <div
                            key={option.key}
                            className={`flex items-center space-x-2 p-2 rounded ${
                              answer.selected_answer === option.key
                                ? 'bg-red-100 border-2 border-red-300'
                                : answer.correct_answer === option.key
                                ? 'bg-green-100 border-2 border-green-300 font-medium'
                                : 'bg-white'
                            }`}
                          >
                            <span>{option.emoji}</span>
                            <span>{option.value}</span>
                            {answer.selected_answer === option.key && (
                              <span className="ml-auto text-red-600">❌ Your Answer</span>
                            )}
                            {answer.correct_answer === option.key && (
                              <span className="ml-auto text-green-600">✅ Correct Answer</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="mt-8 text-center">
        <Button
          onClick={onBackToDashboard}
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-lg px-8 py-3"
        >
          🏠 Back to Dashboard
        </Button>
      </div>

      {/* Confetti-like floating elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 text-4xl animate-bounce" style={{ animationDelay: '0s' }}>🎉</div>
        <div className="absolute top-32 right-20 text-3xl animate-bounce" style={{ animationDelay: '1s' }}>🏆</div>
        <div className="absolute bottom-20 left-32 text-4xl animate-bounce" style={{ animationDelay: '2s' }}>⭐</div>
        <div className="absolute bottom-40 right-10 text-3xl animate-bounce" style={{ animationDelay: '0.5s' }}>🎯</div>
        <div className="absolute top-1/2 left-1/4 text-2xl animate-bounce" style={{ animationDelay: '1.5s' }}>✨</div>
        <div className="absolute top-1/3 right-1/3 text-3xl animate-bounce" style={{ animationDelay: '2.5s' }}>🌟</div>
      </div>
    </div>
  );
}