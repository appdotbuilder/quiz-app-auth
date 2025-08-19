import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { trpc } from '@/utils/trpc';
import type { QuizQuestion, CreateQuizQuestionInput, UpdateQuizQuestionInput, QuestionOption } from '../../../server/src/schema';

interface QuizQuestionManagerProps {
  packageId: number;
  packageTitle: string;
}

export function QuizQuestionManager({ packageId, packageTitle }: QuizQuestionManagerProps) {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [createFormData, setCreateFormData] = useState<CreateQuizQuestionInput>({
    quiz_package_id: packageId,
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    option_e: '',
    correct_answer: 'A',
    order_index: 0,
  });

  const [editFormData, setEditFormData] = useState<UpdateQuizQuestionInput>({
    id: 0,
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    option_e: '',
    correct_answer: 'A',
    order_index: 0,
  });

  useEffect(() => {
    const loadQuestions = async () => {
      try {
        const questionsData = await trpc.getQuizQuestions.query({ quizPackageId: packageId });
        setQuestions(questionsData.sort((a, b) => a.order_index - b.order_index));
      } catch (error) {
        console.error('Failed to load questions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadQuestions();
  }, [packageId]);

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const newQuestion = await trpc.createQuizQuestion.mutate({
        ...createFormData,
        order_index: questions.length,
      });
      setQuestions((prev: QuizQuestion[]) => [...prev, newQuestion]);
      setCreateFormData({
        quiz_package_id: packageId,
        question_text: '',
        option_a: '',
        option_b: '',
        option_c: '',
        option_d: '',
        option_e: '',
        correct_answer: 'A',
        order_index: 0,
      });
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Failed to create question:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const updatedQuestion = await trpc.updateQuizQuestion.mutate(editFormData);
      setQuestions((prev: QuizQuestion[]) =>
        prev.map((q) => (q.id === updatedQuestion.id ? updatedQuestion : q))
      );
      setEditingQuestion(null);
    } catch (error) {
      console.error('Failed to update question:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteQuestion = async (questionId: number) => {
    setIsSubmitting(true);

    try {
      await trpc.deleteQuizQuestion.mutate({ id: questionId });
      setQuestions((prev: QuizQuestion[]) => prev.filter((q) => q.id !== questionId));
    } catch (error) {
      console.error('Failed to delete question:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEdit = (question: QuizQuestion) => {
    setEditFormData({
      id: question.id,
      question_text: question.question_text,
      option_a: question.option_a,
      option_b: question.option_b,
      option_c: question.option_c,
      option_d: question.option_d,
      option_e: question.option_e,
      correct_answer: question.correct_answer,
      order_index: question.order_index,
    });
    setEditingQuestion(question);
  };

  const progress = (questions.length / 110) * 100;
  const canAddMore = questions.length < 110;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-center">
          <div className="animate-spin text-2xl mb-2">🔄</div>
          <p className="text-gray-600">Loading questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-xl">❓ Questions for "{packageTitle}"</CardTitle>
              <CardDescription>
                Each quiz package needs exactly 110 multiple-choice questions
              </CardDescription>
            </div>
            
            {canAddMore && (
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600">
                    ➕ Add Question
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>❓ Add New Question</DialogTitle>
                    <DialogDescription>
                      Create a new multiple-choice question with 5 options (A-E)
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateQuestion}>
                    <div className="space-y-4 py-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Question Text</label>
                        <Textarea
                          placeholder="Enter your question here..."
                          value={createFormData.question_text}
                          onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                            setCreateFormData((prev: CreateQuizQuestionInput) => ({ ...prev, question_text: e.target.value }))
                          }
                          required
                          rows={3}
                        />
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">🅰️ Option A</label>
                          <Input
                            placeholder="Enter option A"
                            value={createFormData.option_a}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setCreateFormData((prev: CreateQuizQuestionInput) => ({ ...prev, option_a: e.target.value }))
                            }
                            required
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">🅱️ Option B</label>
                          <Input
                            placeholder="Enter option B"
                            value={createFormData.option_b}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setCreateFormData((prev: CreateQuizQuestionInput) => ({ ...prev, option_b: e.target.value }))
                            }
                            required
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">🅲 Option C</label>
                          <Input
                            placeholder="Enter option C"
                            value={createFormData.option_c}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setCreateFormData((prev: CreateQuizQuestionInput) => ({ ...prev, option_c: e.target.value }))
                            }
                            required
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">🅳 Option D</label>
                          <Input
                            placeholder="Enter option D"
                            value={createFormData.option_d}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setCreateFormData((prev: CreateQuizQuestionInput) => ({ ...prev, option_d: e.target.value }))
                            }
                            required
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">🅴 Option E</label>
                          <Input
                            placeholder="Enter option E"
                            value={createFormData.option_e}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setCreateFormData((prev: CreateQuizQuestionInput) => ({ ...prev, option_e: e.target.value }))
                            }
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block">✅ Correct Answer</label>
                        <Select 
                          value={createFormData.correct_answer} 
                          onValueChange={(value: QuestionOption) =>
                            setCreateFormData((prev: CreateQuizQuestionInput) => ({ ...prev, correct_answer: value }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A">🅰️ Option A</SelectItem>
                            <SelectItem value="B">🅱️ Option B</SelectItem>
                            <SelectItem value="C">🅲 Option C</SelectItem>
                            <SelectItem value="D">🅳 Option D</SelectItem>
                            <SelectItem value="E">🅴 Option E</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? '🔄 Creating...' : '✨ Create Question'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Progress</span>
              <Badge variant={questions.length === 110 ? "default" : "secondary"}>
                {questions.length}/110 questions
              </Badge>
            </div>
            <Progress value={progress} className="h-2" />
          </div>

          {!canAddMore && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <div className="flex items-center">
                <span className="text-green-600 text-lg mr-2">🎉</span>
                <span className="text-green-800 font-medium">
                  Package complete! All 110 questions added.
                </span>
              </div>
            </div>
          )}
        </CardHeader>
      </Card>

      {questions.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-300">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="text-6xl mb-4">❓</div>
            <h3 className="text-xl font-semibold mb-2">No Questions Yet</h3>
            <p className="text-gray-600 text-center">
              Add questions to build your quiz package
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {questions.map((question, index) => (
            <Card key={question.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-3">
                    <Badge variant="outline">#{index + 1}</Badge>
                    <span className="text-sm text-gray-500">
                      Correct: <Badge variant="secondary">{question.correct_answer}</Badge>
                    </span>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(question)}
                    >
                      ✏️ Edit
                    </Button>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          🗑️
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Question</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this question? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteQuestion(question.id)}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Delete Question
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="font-medium text-gray-900">
                    {question.question_text}
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { key: 'A', value: question.option_a },
                      { key: 'B', value: question.option_b },
                      { key: 'C', value: question.option_c },
                      { key: 'D', value: question.option_d },
                      { key: 'E', value: question.option_e },
                    ].map((option) => (
                      <div
                        key={option.key}
                        className={`flex items-center space-x-3 p-2 rounded-md border ${
                          question.correct_answer === option.key
                            ? 'bg-green-50 border-green-200'
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <Badge 
                          variant={question.correct_answer === option.key ? "default" : "outline"}
                          className={question.correct_answer === option.key ? "bg-green-500" : ""}
                        >
                          {option.key}
                        </Badge>
                        <span className={question.correct_answer === option.key ? 'font-medium' : ''}>
                          {option.value}
                        </span>
                        {question.correct_answer === option.key && (
                          <span className="text-green-600">✅</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      {editingQuestion && (
        <Dialog open={!!editingQuestion} onOpenChange={(open) => !open && setEditingQuestion(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>✏️ Edit Question</DialogTitle>
              <DialogDescription>
                Update the question and its options
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateQuestion}>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Question Text</label>
                  <Textarea
                    placeholder="Enter your question here..."
                    value={editFormData.question_text}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                      setEditFormData((prev: UpdateQuizQuestionInput) => ({ ...prev, question_text: e.target.value }))
                    }
                    required
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">🅰️ Option A</label>
                    <Input
                      placeholder="Enter option A"
                      value={editFormData.option_a}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setEditFormData((prev: UpdateQuizQuestionInput) => ({ ...prev, option_a: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">🅱️ Option B</label>
                    <Input
                      placeholder="Enter option B"
                      value={editFormData.option_b}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setEditFormData((prev: UpdateQuizQuestionInput) => ({ ...prev, option_b: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">🅲 Option C</label>
                    <Input
                      placeholder="Enter option C"
                      value={editFormData.option_c}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setEditFormData((prev: UpdateQuizQuestionInput) => ({ ...prev, option_c: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">🅳 Option D</label>
                    <Input
                      placeholder="Enter option D"
                      value={editFormData.option_d}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setEditFormData((prev: UpdateQuizQuestionInput) => ({ ...prev, option_d: e.target.value }))
                      }
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">🅴 Option E</label>
                    <Input
                      placeholder="Enter option E"
                      value={editFormData.option_e}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setEditFormData((prev: UpdateQuizQuestionInput) => ({ ...prev, option_e: e.target.value }))
                      }
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">✅ Correct Answer</label>
                  <Select 
                    value={editFormData.correct_answer} 
                    onValueChange={(value: QuestionOption) =>
                      setEditFormData((prev: UpdateQuizQuestionInput) => ({ ...prev, correct_answer: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A">🅰️ Option A</SelectItem>
                      <SelectItem value="B">🅱️ Option B</SelectItem>
                      <SelectItem value="C">🅲 Option C</SelectItem>
                      <SelectItem value="D">🅳 Option D</SelectItem>
                      <SelectItem value="E">🅴 Option E</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setEditingQuestion(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? '🔄 Updating...' : '💾 Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}