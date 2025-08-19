import { z } from 'zod';

// User role enum
export const userRoleSchema = z.enum(['ADMIN', 'USER']);
export type UserRole = z.infer<typeof userRoleSchema>;

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  role: userRoleSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type User = z.infer<typeof userSchema>;

// Input schemas for user operations
export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export type LoginInput = z.infer<typeof loginInputSchema>;

export const registerInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: userRoleSchema.default('USER'),
});

export type RegisterInput = z.infer<typeof registerInputSchema>;

// Quiz Package schema
export const quizPackageSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  created_by: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  question_count: z.number().int(),
});

export type QuizPackage = z.infer<typeof quizPackageSchema>;

// Input schemas for quiz package operations
export const createQuizPackageInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable(),
});

export type CreateQuizPackageInput = z.infer<typeof createQuizPackageInputSchema>;

export const updateQuizPackageInputSchema = z.object({
  id: z.number(),
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});

export type UpdateQuizPackageInput = z.infer<typeof updateQuizPackageInputSchema>;

// Quiz Question option enum
export const questionOptionSchema = z.enum(['A', 'B', 'C', 'D', 'E']);
export type QuestionOption = z.infer<typeof questionOptionSchema>;

// Quiz Question schema
export const quizQuestionSchema = z.object({
  id: z.number(),
  quiz_package_id: z.number(),
  question_text: z.string(),
  option_a: z.string(),
  option_b: z.string(),
  option_c: z.string(),
  option_d: z.string(),
  option_e: z.string(),
  correct_answer: questionOptionSchema,
  order_index: z.number().int(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

// Input schemas for quiz question operations
export const createQuizQuestionInputSchema = z.object({
  quiz_package_id: z.number(),
  question_text: z.string().min(1),
  option_a: z.string().min(1),
  option_b: z.string().min(1),
  option_c: z.string().min(1),
  option_d: z.string().min(1),
  option_e: z.string().min(1),
  correct_answer: questionOptionSchema,
  order_index: z.number().int().min(0),
});

export type CreateQuizQuestionInput = z.infer<typeof createQuizQuestionInputSchema>;

export const updateQuizQuestionInputSchema = z.object({
  id: z.number(),
  question_text: z.string().min(1).optional(),
  option_a: z.string().min(1).optional(),
  option_b: z.string().min(1).optional(),
  option_c: z.string().min(1).optional(),
  option_d: z.string().min(1).optional(),
  option_e: z.string().min(1).optional(),
  correct_answer: questionOptionSchema.optional(),
  order_index: z.number().int().min(0).optional(),
});

export type UpdateQuizQuestionInput = z.infer<typeof updateQuizQuestionInputSchema>;

// Quiz Attempt status enum
export const quizAttemptStatusSchema = z.enum(['IN_PROGRESS', 'COMPLETED', 'TIME_OUT']);
export type QuizAttemptStatus = z.infer<typeof quizAttemptStatusSchema>;

// Quiz Attempt schema
export const quizAttemptSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  quiz_package_id: z.number(),
  status: quizAttemptStatusSchema,
  score: z.number().int(),
  total_questions: z.number().int(),
  current_question_index: z.number().int(),
  started_at: z.coerce.date(),
  completed_at: z.coerce.date().nullable(),
  time_remaining_seconds: z.number().int(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});

export type QuizAttempt = z.infer<typeof quizAttemptSchema>;

// Input schemas for quiz attempt operations
export const startQuizAttemptInputSchema = z.object({
  quiz_package_id: z.number(),
});

export type StartQuizAttemptInput = z.infer<typeof startQuizAttemptInputSchema>;

export const submitQuizAnswerInputSchema = z.object({
  attempt_id: z.number(),
  question_id: z.number(),
  selected_answer: questionOptionSchema,
});

export type SubmitQuizAnswerInput = z.infer<typeof submitQuizAnswerInputSchema>;

export const completeQuizAttemptInputSchema = z.object({
  attempt_id: z.number(),
});

export type CompleteQuizAttemptInput = z.infer<typeof completeQuizAttemptInputSchema>;

// Quiz Answer schema (tracks user's answers)
export const quizAnswerSchema = z.object({
  id: z.number(),
  attempt_id: z.number(),
  question_id: z.number(),
  selected_answer: questionOptionSchema,
  is_correct: z.boolean(),
  answered_at: z.coerce.date(),
});

export type QuizAnswer = z.infer<typeof quizAnswerSchema>;

// Quiz Results schema (for detailed breakdown)
export const quizResultSchema = z.object({
  attempt_id: z.number(),
  score: z.number().int(),
  total_questions: z.number().int(),
  correct_answers: z.number().int(),
  incorrect_answers: z.number().int(),
  time_taken_seconds: z.number().int(),
  completed_at: z.coerce.date(),
  answers: z.array(z.object({
    question_id: z.number(),
    question_text: z.string(),
    selected_answer: questionOptionSchema,
    correct_answer: questionOptionSchema,
    is_correct: z.boolean(),
    option_a: z.string(),
    option_b: z.string(),
    option_c: z.string(),
    option_d: z.string(),
    option_e: z.string(),
  })),
});

export type QuizResult = z.infer<typeof quizResultSchema>;

// Auth response schema
export const authResponseSchema = z.object({
  user: z.object({
    id: z.number(),
    email: z.string().email(),
    role: userRoleSchema,
  }),
  token: z.string(),
});

export type AuthResponse = z.infer<typeof authResponseSchema>;

// Quiz Package with questions count
export const quizPackageWithStatsSchema = quizPackageSchema.extend({
  question_count: z.number().int(),
});

export type QuizPackageWithStats = z.infer<typeof quizPackageWithStatsSchema>;

// Current quiz state (for ongoing quiz)
export const currentQuizStateSchema = z.object({
  attempt_id: z.number(),
  quiz_package_id: z.number(),
  quiz_title: z.string(),
  current_question_index: z.number().int(),
  total_questions: z.number().int(),
  time_remaining_seconds: z.number().int(),
  current_question: quizQuestionSchema.nullable(),
});

export type CurrentQuizState = z.infer<typeof currentQuizStateSchema>;