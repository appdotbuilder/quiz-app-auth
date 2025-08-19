import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { QuizPackageManager } from '@/components/QuizPackageManager';
import { QuizQuestionManager } from '@/components/QuizQuestionManager';
import { trpc } from '@/utils/trpc';
import type { User, QuizPackage } from '../../../server/src/schema';

export function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [quizPackages, setQuizPackages] = useState<QuizPackage[]>([]);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [usersData, packagesData] = await Promise.all([
          trpc.getUsers.query(),
          trpc.getQuizPackages.query(),
        ]);
        setUsers(usersData);
        setQuizPackages(packagesData);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const handlePackageCreated = (newPackage: QuizPackage) => {
    setQuizPackages((prev: QuizPackage[]) => [...prev, newPackage]);
  };

  const handlePackageUpdated = (updatedPackage: QuizPackage) => {
    setQuizPackages((prev: QuizPackage[]) =>
      prev.map((pkg) => (pkg.id === updatedPackage.id ? updatedPackage : pkg))
    );
  };

  const handlePackageDeleted = (packageId: number) => {
    setQuizPackages((prev: QuizPackage[]) => prev.filter((pkg) => pkg.id !== packageId));
    if (selectedPackageId === packageId) {
      setSelectedPackageId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin text-4xl mb-4">🔄</div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          🛠️ Admin Dashboard
        </h2>
        <p className="text-gray-600">
          Manage quiz packages, questions, and monitor users
        </p>
      </div>

      <Tabs defaultValue="packages" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="packages" className="text-sm">
            📦 Quiz Packages
          </TabsTrigger>
          <TabsTrigger value="questions" className="text-sm">
            ❓ Questions
          </TabsTrigger>
          <TabsTrigger value="users" className="text-sm">
            👥 Users
          </TabsTrigger>
        </TabsList>

        <TabsContent value="packages" className="space-y-6">
          <QuizPackageManager
            packages={quizPackages}
            onPackageCreated={handlePackageCreated}
            onPackageUpdated={handlePackageUpdated}
            onPackageDeleted={handlePackageDeleted}
          />
        </TabsContent>

        <TabsContent value="questions" className="space-y-6">
          {quizPackages.length === 0 ? (
            <Card className="border-dashed border-2 border-gray-300">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="text-6xl mb-4">📦</div>
                <h3 className="text-xl font-semibold mb-2">No Quiz Packages Yet</h3>
                <p className="text-gray-600 text-center mb-4">
                  Create a quiz package first to add questions
                </p>
                <Button 
                  onClick={() => {
                    const packagesTab = document.querySelector('[value="packages"]') as HTMLElement;
                    packagesTab?.click();
                  }}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  📦 Create Quiz Package
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-3">Select a Quiz Package:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {quizPackages.map((pkg) => (
                    <Button
                      key={pkg.id}
                      variant={selectedPackageId === pkg.id ? "default" : "outline"}
                      className={`p-4 h-auto text-left justify-start ${
                        selectedPackageId === pkg.id 
                          ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                          : 'hover:bg-purple-50'
                      }`}
                      onClick={() => setSelectedPackageId(pkg.id)}
                    >
                      <div className="w-full">
                        <div className="font-medium">{pkg.title}</div>
                        <div className="text-sm opacity-75">
                          {pkg.question_count}/110 questions
                        </div>
                      </div>
                    </Button>
                  ))}
                </div>
              </div>

              {selectedPackageId && (
                <QuizQuestionManager
                  packageId={selectedPackageId}
                  packageTitle={quizPackages.find(p => p.id === selectedPackageId)?.title || ''}
                />
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                👥 User Management
                <Badge variant="secondary">{users.length} users</Badge>
              </CardTitle>
              <CardDescription>
                Overview of all registered users
              </CardDescription>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">👤</div>
                  <p className="text-gray-600">No users registered yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="text-2xl">
                          {user.role === 'ADMIN' ? '👑' : '👤'}
                        </div>
                        <div>
                          <div className="font-medium">{user.email}</div>
                          <div className="text-sm text-gray-500">
                            Joined {user.created_at.toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <Badge 
                        variant={user.role === 'ADMIN' ? 'default' : 'secondary'}
                        className={user.role === 'ADMIN' ? 'bg-yellow-500' : ''}
                      >
                        {user.role}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}