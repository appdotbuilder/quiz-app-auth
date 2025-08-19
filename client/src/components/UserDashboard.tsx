import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { trpc } from '@/utils/trpc';
import type { QuizPackage, QuizAttempt } from '../../../server/src/schema';

interface UserDashboardProps {
  onStartQuiz: (attemptId: number) => void;
}

export function UserDashboard({ onStartQuiz }: UserDashboardProps) {
  const [quizPackages, setQuizPackages] = useState<QuizPackage[]>([]);
  const [quizHistory, setQuizHistory] = useState<QuizAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStarting, setIsStarting] = useState<number | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [packagesData, historyData] = await Promise.all([
          trpc.getQuizPackages.query(),
          trpc.getUserQuizHistory.query(),
        ]);
        
        // Only show packages with 110 questions (complete packages)
        const completePackages = packagesData.filter(pkg => pkg.question_count === 110);
        setQuizPackages(completePackages);
        setQuizHistory(historyData);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handleStartQuiz = async (packageId: number) => {
    setIsStarting(packageId);
    try {
      const response = await trpc.startQuizAttempt.mutate({ quiz_package_id: packageId });
      onStartQuiz(response.attempt_id);
    } catch (error) {
      console.error('Failed to start quiz:', error);
    } finally {
      setIsStarting(null);
    }
  };

  const getScoreColor = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 80) return 'text-green-600';
    if (percentage >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadge = (score: number, total: number) => {
    const percentage = (score / total) * 100;
    if (percentage >= 80) return 'bg-green-500';
    if (percentage >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">🔄</div>
          <p className="text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          🎯 Quiz Dashboard
        </h2>
        <p className="text-gray-600">
          Challenge yourself with exciting quizzes!
        </p>
      </div>

      <Tabs defaultValue="available" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="available" className="text-sm">
            🎮 Available Quizzes
          </TabsTrigger>
          <TabsTrigger value="history" className="text-sm">
            📈 My History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="space-y-6">
          {quizPackages.length === 0 ? (
            <Card className="border-dashed border-2 border-gray-300">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="text-6xl mb-4">📚</div>
                <h3 className="text-xl font-semibold mb-2">No Quizzes Available Yet</h3>
                <p className="text-gray-600 text-center">
                  Check back later for new quiz challenges!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {quizPackages.map((pkg) => {
                const recentAttempts = quizHistory.filter(attempt => 
                  attempt.quiz_package_id === pkg.id && attempt.status === 'COMPLETED'
                );
                const bestScore = recentAttempts.length > 0 
                  ? Math.max(...recentAttempts.map(a => a.score))
                  : null;

                return (
                  <Card key={pkg.id} className="hover:shadow-lg transition-all duration-200 hover:-translate-y-1">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{pkg.title}</CardTitle>
                        <Badge variant="default" className="bg-blue-500">
                          110 Questions
                        </Badge>
                      </div>
                      {pkg.description && (
                        <CardDescription className="line-clamp-3">
                          {pkg.description}
                        </CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-sm text-gray-600">
                          <span>⏱️ Duration: 120 minutes</span>
                          <span>🎯 Multiple Choice</span>
                        </div>

                        {bestScore !== null && (
                          <div className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="text-sm text-gray-600">Your Best Score:</span>
                              <Badge className={getScoreBadge(bestScore, 110)}>
                                {bestScore}/110 ({Math.round((bestScore / 110) * 100)}%)
                              </Badge>
                            </div>
                          </div>
                        )}

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button 
                              className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600"
                              disabled={isStarting === pkg.id}
                            >
                              {isStarting === pkg.id ? (
                                <>🔄 Starting...</>
                              ) : (
                                <>🚀 Start Quiz</>
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center gap-2">
                                🎮 Start Quiz: {pkg.title}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                <div className="space-y-3">
                                  <p>You're about to start a quiz with the following rules:</p>
                                  <ul className="space-y-2 text-sm">
                                    <li>📝 <strong>110 questions</strong> - All multiple choice (A-E)</li>
                                    <li>⏰ <strong>120 minutes total</strong> - Timer will be displayed</li>
                                    <li>➡️ <strong>No going back</strong> - You can't return to previous questions</li>
                                    <li>⚡ <strong>Auto-submit</strong> - Quiz submits automatically when time runs out</li>
                                    <li>📊 <strong>Instant results</strong> - See your score and breakdown immediately</li>
                                  </ul>
                                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                                    <p className="text-yellow-800 text-sm">
                                      ⚠️ <strong>Ready to begin?</strong> Make sure you have a stable internet connection and won't be interrupted for the next 2 hours.
                                    </p>
                                  </div>
                                </div>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>
                                🔙 Not Yet
                              </AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleStartQuiz(pkg.id)}
                                className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
                              >
                                🎯 Let's Go!
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-6">
          {quizHistory.length === 0 ? (
            <Card className="border-dashed border-2 border-gray-300">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="text-6xl mb-4">📈</div>
                <h3 className="text-xl font-semibold mb-2">No Quiz History Yet</h3>
                <p className="text-gray-600 text-center">
                  Take your first quiz to see your progress here!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {quizHistory
                .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
                .map((attempt) => {
                  const quizPackage = quizPackages.find(pkg => pkg.id === attempt.quiz_package_id);
                  const percentage = Math.round((attempt.score / attempt.total_questions) * 100);
                  
                  return (
                    <Card key={attempt.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-lg font-semibold">
                              {quizPackage?.title || `Quiz #${attempt.quiz_package_id}`}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {attempt.status === 'COMPLETED' ? '✅ Completed' : 
                               attempt.status === 'TIME_OUT' ? '⏰ Time Out' : 
                               '🔄 In Progress'}
                            </p>
                          </div>
                          
                          {attempt.status !== 'IN_PROGRESS' && (
                            <div className="text-right">
                              <Badge className={`text-lg px-3 py-1 ${getScoreBadge(attempt.score, attempt.total_questions)}`}>
                                {attempt.score}/{attempt.total_questions}
                              </Badge>
                              <div className={`text-sm font-medium ${getScoreColor(attempt.score, attempt.total_questions)}`}>
                                {percentage}%
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                          <div>
                            <span className="block font-medium">Started:</span>
                            <span>{attempt.started_at.toLocaleDateString()}</span>
                          </div>
                          {attempt.completed_at && (
                            <div>
                              <span className="block font-medium">Completed:</span>
                              <span>{attempt.completed_at.toLocaleDateString()}</span>
                            </div>
                          )}
                          <div>
                            <span className="block font-medium">Questions:</span>
                            <span>{attempt.current_question_index + 1}/{attempt.total_questions}</span>
                          </div>
                          <div>
                            <span className="block font-medium">Time Remaining:</span>
                            <span>
                              {Math.floor(attempt.time_remaining_seconds / 60)}m {attempt.time_remaining_seconds % 60}s
                            </span>
                          </div>
                        </div>

                        {attempt.status !== 'IN_PROGRESS' && (
                          <div className="mt-4 flex justify-between items-center pt-4 border-t">
                            <div className="flex space-x-4 text-sm">
                              <span className="text-green-600">
                                ✅ Correct: {attempt.score}
                              </span>
                              <span className="text-red-600">
                                ❌ Wrong: {attempt.total_questions - attempt.score}
                              </span>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              {percentage >= 80 && <span>🏆</span>}
                              {percentage >= 60 && percentage < 80 && <span>🥉</span>}
                              {percentage < 60 && <span>📚</span>}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}