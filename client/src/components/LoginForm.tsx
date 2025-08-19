import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import type { AuthResponse, LoginInput, RegisterInput } from '../../../server/src/schema';

interface LoginFormProps {
  onLogin: (authResponse: AuthResponse) => void;
}

export function LoginForm({ onLogin }: LoginFormProps) {
  const [loginData, setLoginData] = useState<LoginInput>({
    email: '',
    password: '',
  });

  const [registerData, setRegisterData] = useState<RegisterInput>({
    email: '',
    password: '',
    role: 'USER',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('login');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await trpc.login.mutate(loginData);
      onLogin(response);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await trpc.register.mutate(registerData);
      onLogin(response);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto shadow-xl border-0 bg-white/90 backdrop-blur-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">Welcome! 🎉</CardTitle>
        <CardDescription>
          Sign in to start your quiz journey or create a new account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="login" className="text-sm">
              🔑 Sign In
            </TabsTrigger>
            <TabsTrigger value="register" className="text-sm">
              ✨ Sign Up
            </TabsTrigger>
          </TabsList>

          {error && (
            <Alert className="mb-4 border-red-200 bg-red-50">
              <AlertDescription className="text-red-700">
                {error}
              </AlertDescription>
            </Alert>
          )}

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="📧 Email address"
                  value={loginData.email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setLoginData((prev: LoginInput) => ({ ...prev, email: e.target.value }))
                  }
                  required
                  className="h-12"
                />
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="🔒 Password"
                  value={loginData.password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setLoginData((prev: LoginInput) => ({ ...prev, password: e.target.value }))
                  }
                  required
                  className="h-12"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                disabled={isLoading}
              >
                {isLoading ? '🔄 Signing in...' : '🚀 Sign In'}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <Input
                  type="email"
                  placeholder="📧 Email address"
                  value={registerData.email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setRegisterData((prev: RegisterInput) => ({ ...prev, email: e.target.value }))
                  }
                  required
                  className="h-12"
                />
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="🔒 Password (min. 6 characters)"
                  value={registerData.password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setRegisterData((prev: RegisterInput) => ({ ...prev, password: e.target.value }))
                  }
                  required
                  minLength={6}
                  className="h-12"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600"
                disabled={isLoading}
              >
                {isLoading ? '🔄 Creating account...' : '✨ Create Account'}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="mt-6 text-center text-sm text-gray-600">
          <p className="mb-2">🎯 Ready to test your knowledge?</p>
          <div className="flex justify-center space-x-4 text-xs">
            <span>📚 Multiple topics</span>
            <span>⏱️ Timed challenges</span>
            <span>🏆 Track progress</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}