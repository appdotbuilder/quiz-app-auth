import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { trpc } from '@/utils/trpc';
import type { CurrentQuizState, QuestionOption } from '../../../server/src/schema';

interface QuizInterfaceProps {
  attemptId: number;
  onComplete: () => void;
}

export function QuizInterface({ attemptId, onComplete }: QuizInterfaceProps) {
  const [quizState, setQuizState] = useState<CurrentQuizState | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<QuestionOption | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [showTimeWarning, setShowTimeWarning] = useState(false);

  // Load current quiz state
  const loadQuizState = useCallback(async () => {
    try {
      const state = await trpc.getCurrentQuizState.query({ attemptId });
      setQuizState(state);
      if (state) {
        setTimeLeft(state.time_remaining_seconds);
      }
      setSelectedAnswer(null); // Reset selection for new question
    } catch (error) {
      console.error('Failed to load quiz state:', error);
    } finally {
      setIsLoading(false);
    }
  }, [attemptId]);

  // Timer effect
  useEffect(() => {
    if (timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = prev - 1;
        
        // Show warning when 5 minutes left
        if (newTime === 300 && !showTimeWarning) {
          setShowTimeWarning(true);
        }
        
        // Auto-submit when time runs out
        if (newTime <= 0) {
          handleCompleteQuiz();
          return 0;
        }
        
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timeLeft, showTimeWarning]);

  // Load initial state
  useEffect(() => {
    loadQuizState();
  }, [loadQuizState]);

  const handleSubmitAnswer = async () => {
    if (!selectedAnswer || !quizState?.current_question) return;

    setIsSubmitting(true);
    try {
      await trpc.submitQuizAnswer.mutate({
        attempt_id: attemptId,
        question_id: quizState.current_question.id,
        selected_answer: selectedAnswer,
      });

      // Check if this was the last question
      if (quizState.current_question_index >= quizState.total_questions - 1) {
        await handleCompleteQuiz();
      } else {
        // Load next question
        await loadQuizState();
      }
    } catch (error) {
      console.error('Failed to submit answer:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteQuiz = async () => {
    try {
      await trpc.completeQuizAttempt.mutate({ attempt_id: attemptId });
      onComplete();
    } catch (error) {
      console.error('Failed to complete quiz:', error);
      onComplete(); // Still navigate to results even if there's an error
    }
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeColor = (seconds: number) => {
    if (seconds <= 300) return 'text-red-600'; // 5 minutes
    if (seconds <= 900) return 'text-yellow-600'; // 15 minutes
    return 'text-green-600';
  };

  if (isLoading || !quizState) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">🔄</div>
          <p className="text-gray-600">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (!quizState.current_question) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-4xl mb-4">❓</div>
          <p className="text-gray-600">No question available</p>
        </div>
      </div>
    );
  }

  const progress = ((quizState.current_question_index + 1) / quizState.total_questions) * 100;
  const question = quizState.current_question;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header with Progress and Timer */}
      <Card className="mb-6 border-0 bg-white/90 backdrop-blur-sm shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-4">
              <div className="text-2xl">🎯</div>
              <div>
                <h1 className="text-xl font-bold">{quizState.quiz_title}</h1>
                <p className="text-sm text-gray-600">
                  Question {quizState.current_question_index + 1} of {quizState.total_questions}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-6">
              <div className="text-center">
                <div className="text-sm text-gray-600">Progress</div>
                <Badge variant="outline" className="text-sm">
                  {Math.round(progress)}%
                </Badge>
              </div>
              
              <div className="text-center">
                <div className="text-sm text-gray-600">Time Left</div>
                <Badge 
                  className={`text-lg px-3 py-1 ${
                    timeLeft <= 300 ? 'bg-red-500' : 
                    timeLeft <= 900 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                >
                  ⏰ {formatTime(timeLeft)}
                </Badge>
              </div>
            </div>
          </div>
          
          <Progress value={progress} className="mt-4 h-2" />
        </CardContent>
      </Card>

      {/* Question Card */}
      <Card className="mb-6 shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center">
            <Badge variant="outline" className="text-sm">
              Question #{quizState.current_question_index + 1}
            </Badge>
            <Badge variant="secondary" className="text-sm">
              Multiple Choice
            </Badge>
          </div>
          <CardTitle className="text-xl leading-relaxed">
            {question.question_text}
          </CardTitle>
          <CardDescription>
            Select one answer from the options below. You cannot go back to previous questions.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <RadioGroup 
            value={selectedAnswer || ''} 
            onValueChange={(value: QuestionOption) => setSelectedAnswer(value)}
            className="space-y-3"
          >
            {[
              { key: 'A' as const, value: question.option_a, emoji: '🅰️' },
              { key: 'B' as const, value: question.option_b, emoji: '🅱️' },
              { key: 'C' as const, value: question.option_c, emoji: '🅲' },
              { key: 'D' as const, value: question.option_d, emoji: '🅳' },
              { key: 'E' as const, value: question.option_e, emoji: '🅴' },
            ].map((option) => (
              <div 
                key={option.key}
                className={`flex items-start space-x-3 p-4 rounded-lg border-2 transition-all cursor-pointer hover:bg-blue-50 ${
                  selectedAnswer === option.key 
                    ? 'border-blue-500 bg-blue-50 shadow-md' 
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => setSelectedAnswer(option.key)}
              >
                <RadioGroupItem 
                  value={option.key} 
                  id={option.key}
                  className="mt-1"
                />
                <Label 
                  htmlFor={option.key}
                  className="flex-1 cursor-pointer text-base leading-relaxed"
                >
                  <span className="inline-flex items-center space-x-2">
                    <span className="text-lg">{option.emoji}</span>
                    <span>{option.value}</span>
                  </span>
                </Label>
              </div>
            ))}
          </RadioGroup>

          <div className="flex justify-between items-center pt-6 border-t">
            <div className="text-sm text-gray-600">
              {quizState.current_question_index === quizState.total_questions - 1 
                ? '🏁 This is the final question!' 
                : `➡️ ${quizState.total_questions - quizState.current_question_index - 1} questions remaining`
              }
            </div>
            
            <Button
              onClick={handleSubmitAnswer}
              disabled={!selectedAnswer || isSubmitting}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-lg px-8 py-3"
            >
              {isSubmitting ? (
                '🔄 Submitting...'
              ) : quizState.current_question_index === quizState.total_questions - 1 ? (
                '🏁 Finish Quiz'
              ) : (
                '➡️ Next Question'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Time Warning Dialog */}
      <AlertDialog open={showTimeWarning} onOpenChange={setShowTimeWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              ⏰ Time Warning
            </AlertDialogTitle>
            <AlertDialogDescription>
              <div className="space-y-3">
                <p>You have <strong>5 minutes or less</strong> remaining!</p>
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-yellow-800 text-sm">
                    ⚠️ The quiz will automatically submit when time runs out. Make sure to answer the remaining questions quickly.
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setShowTimeWarning(false)}
              className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
            >
              ⚡ Got It!
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fun floating elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-10 w-8 h-8 text-2xl animate-bounce" style={{ animationDelay: '0s' }}>
          🧠
        </div>
        <div className="absolute top-40 left-20 w-8 h-8 text-2xl animate-bounce" style={{ animationDelay: '1s' }}>
          💡
        </div>
        <div className="absolute bottom-40 right-32 w-8 h-8 text-2xl animate-bounce" style={{ animationDelay: '2s' }}>
          🎯
        </div>
      </div>
    </div>
  );
}