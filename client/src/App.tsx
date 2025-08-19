import { useState, useEffect } from 'react';
import { LoginForm } from '@/components/LoginForm';
import { AdminDashboard } from '@/components/AdminDashboard';
import { UserDashboard } from '@/components/UserDashboard';
import { QuizInterface } from '@/components/QuizInterface';
import { QuizResults } from '@/components/QuizResults';
import { Button } from '@/components/ui/button';
import { trpc } from '@/utils/trpc';
import type { AuthResponse } from '../../server/src/schema';

type AppState = 'login' | 'admin-dashboard' | 'user-dashboard' | 'taking-quiz' | 'quiz-results';

function App() {
  const [currentState, setCurrentState] = useState<AppState>('login');
  const [user, setUser] = useState<AuthResponse['user'] | null>(null);
  const [currentAttemptId, setCurrentAttemptId] = useState<number | null>(null);

  const handleLogin = (authResponse: AuthResponse) => {
    setUser(authResponse.user);
    if (authResponse.user.role === 'ADMIN') {
      setCurrentState('admin-dashboard');
    } else {
      setCurrentState('user-dashboard');
    }
  };

  const handleLogout = async () => {
    try {
      await trpc.logout.mutate();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setUser(null);
      setCurrentAttemptId(null);
      setCurrentState('login');
    }
  };

  const handleStartQuiz = (attemptId: number) => {
    setCurrentAttemptId(attemptId);
    setCurrentState('taking-quiz');
  };

  const handleCompleteQuiz = () => {
    setCurrentState('quiz-results');
  };

  const handleBackToDashboard = () => {
    setCurrentAttemptId(null);
    if (user?.role === 'ADMIN') {
      setCurrentState('admin-dashboard');
    } else {
      setCurrentState('user-dashboard');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50">
      {/* Fun floating shapes */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-20 h-20 bg-yellow-300 rounded-full opacity-20 animate-bounce" style={{ animationDelay: '0s' }}></div>
        <div className="absolute top-32 right-20 w-16 h-16 bg-pink-300 rounded-full opacity-20 animate-bounce" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-20 left-32 w-24 h-24 bg-blue-300 rounded-full opacity-20 animate-bounce" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-40 right-10 w-12 h-12 bg-green-300 rounded-full opacity-20 animate-bounce" style={{ animationDelay: '0.5s' }}></div>
      </div>

      <div className="relative z-10">
        {/* Header */}
        {user && (
          <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-purple-100">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between items-center h-16">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  🧠 QuizMaster
                </h1>
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-600">
                    👋 Hello, {user.email} 
                    {user.role === 'ADMIN' && ' (Admin)'}
                  </span>
                  <Button 
                    onClick={handleLogout}
                    variant="outline"
                    className="hover:bg-red-50 hover:text-red-600 hover:border-red-300"
                  >
                    Logout
                  </Button>
                </div>
              </div>
            </div>
          </header>
        )}

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          {currentState === 'login' && (
            <div className="max-w-md mx-auto">
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  🧠 QuizMaster
                </h1>
                <p className="text-gray-600">
                  Challenge your knowledge with fun quizzes! 🚀
                </p>
              </div>
              <LoginForm onLogin={handleLogin} />
            </div>
          )}

          {currentState === 'admin-dashboard' && user && (
            <AdminDashboard />
          )}

          {currentState === 'user-dashboard' && user && (
            <UserDashboard onStartQuiz={handleStartQuiz} />
          )}

          {currentState === 'taking-quiz' && currentAttemptId && (
            <QuizInterface 
              attemptId={currentAttemptId}
              onComplete={handleCompleteQuiz}
            />
          )}

          {currentState === 'quiz-results' && currentAttemptId && (
            <QuizResults 
              attemptId={currentAttemptId}
              onBackToDashboard={handleBackToDashboard}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;