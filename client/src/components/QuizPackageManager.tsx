import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { trpc } from '@/utils/trpc';
import type { QuizPackage, CreateQuizPackageInput, UpdateQuizPackageInput } from '../../../server/src/schema';

interface QuizPackageManagerProps {
  packages: QuizPackage[];
  onPackageCreated: (pkg: QuizPackage) => void;
  onPackageUpdated: (pkg: QuizPackage) => void;
  onPackageDeleted: (packageId: number) => void;
}

export function QuizPackageManager({ packages, onPackageCreated, onPackageUpdated, onPackageDeleted }: QuizPackageManagerProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<QuizPackage | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [createFormData, setCreateFormData] = useState<CreateQuizPackageInput>({
    title: '',
    description: null,
  });

  const [editFormData, setEditFormData] = useState<UpdateQuizPackageInput>({
    id: 0,
    title: '',
    description: null,
  });

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const newPackage = await trpc.createQuizPackage.mutate(createFormData);
      onPackageCreated(newPackage);
      setCreateFormData({ title: '', description: null });
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Failed to create package:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const updatedPackage = await trpc.updateQuizPackage.mutate(editFormData);
      onPackageUpdated(updatedPackage);
      setEditingPackage(null);
    } catch (error) {
      console.error('Failed to update package:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePackage = async (packageId: number) => {
    setIsLoading(true);

    try {
      await trpc.deleteQuizPackage.mutate({ id: packageId });
      onPackageDeleted(packageId);
    } catch (error) {
      console.error('Failed to delete package:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const startEdit = (pkg: QuizPackage) => {
    setEditFormData({
      id: pkg.id,
      title: pkg.title,
      description: pkg.description,
    });
    setEditingPackage(pkg);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold">📦 Quiz Packages</h3>
          <p className="text-gray-600">Each package must contain exactly 110 questions</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600">
              ➕ Create Package
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>📦 Create New Quiz Package</DialogTitle>
              <DialogDescription>
                Create a new quiz package. You'll add questions to it afterwards.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreatePackage}>
              <div className="space-y-4 py-4">
                <div>
                  <Input
                    placeholder="📝 Package title"
                    value={createFormData.title}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setCreateFormData((prev: CreateQuizPackageInput) => ({ ...prev, title: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <Textarea
                    placeholder="📄 Package description (optional)"
                    value={createFormData.description || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setCreateFormData((prev: CreateQuizPackageInput) => ({
                        ...prev,
                        description: e.target.value || null
                      }))
                    }
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? '🔄 Creating...' : '✨ Create Package'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {packages.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-300">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-xl font-semibold mb-2">No Quiz Packages Yet</h3>
            <p className="text-gray-600 text-center">
              Create your first quiz package to get started!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => (
            <Card key={pkg.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{pkg.title}</CardTitle>
                  <Badge 
                    variant={pkg.question_count === 110 ? "default" : "secondary"}
                    className={pkg.question_count === 110 ? "bg-green-500" : ""}
                  >
                    {pkg.question_count}/110
                  </Badge>
                </div>
                {pkg.description && (
                  <CardDescription className="line-clamp-3">
                    {pkg.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="text-sm text-gray-500 mb-4">
                  Created: {pkg.created_at.toLocaleDateString()}
                </div>
                
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => startEdit(pkg)}
                    className="flex-1"
                  >
                    ✏️ Edit
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                      >
                        🗑️
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Quiz Package</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{pkg.title}"? 
                          This will also delete all {pkg.question_count} questions in this package. 
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeletePackage(pkg.id)}
                          className="bg-red-500 hover:bg-red-600"
                        >
                          Delete Package
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      {editingPackage && (
        <Dialog open={!!editingPackage} onOpenChange={(open) => !open && setEditingPackage(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>✏️ Edit Quiz Package</DialogTitle>
              <DialogDescription>
                Update the package details
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdatePackage}>
              <div className="space-y-4 py-4">
                <div>
                  <Input
                    placeholder="📝 Package title"
                    value={editFormData.title}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setEditFormData((prev: UpdateQuizPackageInput) => ({ ...prev, title: e.target.value }))
                    }
                    required
                  />
                </div>
                <div>
                  <Textarea
                    placeholder="📄 Package description (optional)"
                    value={editFormData.description || ''}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setEditFormData((prev: UpdateQuizPackageInput) => ({
                        ...prev,
                        description: e.target.value || null
                      }))
                    }
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingPackage(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? '🔄 Updating...' : '💾 Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}