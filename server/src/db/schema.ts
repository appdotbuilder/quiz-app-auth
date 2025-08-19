import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  integer, 
  boolean,
  pgEnum 
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'USER']);
export const questionOptionEnum = pgEnum('question_option', ['A', 'B', 'C', 'D', 'E']);
export const quizAttemptStatusEnum = pgEnum('quiz_attempt_status', ['IN_PROGRESS', 'COMPLETED', 'TIME_OUT']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull().default('USER'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Quiz Packages table
export const quizPackagesTable = pgTable('quiz_packages', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'), // Nullable by default
  created_by: integer('created_by').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Quiz Questions table
export const quizQuestionsTable = pgTable('quiz_questions', {
  id: serial('id').primaryKey(),
  quiz_package_id: integer('quiz_package_id').notNull(),
  question_text: text('question_text').notNull(),
  option_a: text('option_a').notNull(),
  option_b: text('option_b').notNull(),
  option_c: text('option_c').notNull(),
  option_d: text('option_d').notNull(),
  option_e: text('option_e').notNull(),
  correct_answer: questionOptionEnum('correct_answer').notNull(),
  order_index: integer('order_index').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Quiz Attempts table
export const quizAttemptsTable = pgTable('quiz_attempts', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull(),
  quiz_package_id: integer('quiz_package_id').notNull(),
  status: quizAttemptStatusEnum('status').notNull().default('IN_PROGRESS'),
  score: integer('score').notNull().default(0),
  total_questions: integer('total_questions').notNull(),
  current_question_index: integer('current_question_index').notNull().default(0),
  started_at: timestamp('started_at').defaultNow().notNull(),
  completed_at: timestamp('completed_at'), // Nullable - set when quiz is completed
  time_remaining_seconds: integer('time_remaining_seconds').notNull().default(7200), // 120 minutes = 7200 seconds
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Quiz Answers table (tracks user's answers to individual questions)
export const quizAnswersTable = pgTable('quiz_answers', {
  id: serial('id').primaryKey(),
  attempt_id: integer('attempt_id').notNull(),
  question_id: integer('question_id').notNull(),
  selected_answer: questionOptionEnum('selected_answer').notNull(),
  is_correct: boolean('is_correct').notNull(),
  answered_at: timestamp('answered_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  createdQuizPackages: many(quizPackagesTable),
  quizAttempts: many(quizAttemptsTable),
}));

export const quizPackagesRelations = relations(quizPackagesTable, ({ one, many }) => ({
  creator: one(usersTable, {
    fields: [quizPackagesTable.created_by],
    references: [usersTable.id],
  }),
  questions: many(quizQuestionsTable),
  attempts: many(quizAttemptsTable),
}));

export const quizQuestionsRelations = relations(quizQuestionsTable, ({ one, many }) => ({
  quizPackage: one(quizPackagesTable, {
    fields: [quizQuestionsTable.quiz_package_id],
    references: [quizPackagesTable.id],
  }),
  answers: many(quizAnswersTable),
}));

export const quizAttemptsRelations = relations(quizAttemptsTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [quizAttemptsTable.user_id],
    references: [usersTable.id],
  }),
  quizPackage: one(quizPackagesTable, {
    fields: [quizAttemptsTable.quiz_package_id],
    references: [quizPackagesTable.id],
  }),
  answers: many(quizAnswersTable),
}));

export const quizAnswersRelations = relations(quizAnswersTable, ({ one }) => ({
  attempt: one(quizAttemptsTable, {
    fields: [quizAnswersTable.attempt_id],
    references: [quizAttemptsTable.id],
  }),
  question: one(quizQuestionsTable, {
    fields: [quizAnswersTable.question_id],
    references: [quizQuestionsTable.id],
  }),
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type QuizPackage = typeof quizPackagesTable.$inferSelect;
export type NewQuizPackage = typeof quizPackagesTable.$inferInsert;

export type QuizQuestion = typeof quizQuestionsTable.$inferSelect;
export type NewQuizQuestion = typeof quizQuestionsTable.$inferInsert;

export type QuizAttempt = typeof quizAttemptsTable.$inferSelect;
export type NewQuizAttempt = typeof quizAttemptsTable.$inferInsert;

export type QuizAnswer = typeof quizAnswersTable.$inferSelect;
export type NewQuizAnswer = typeof quizAnswersTable.$inferInsert;

// Important: Export all tables and relations for proper query building
export const tables = {
  users: usersTable,
  quizPackages: quizPackagesTable,
  quizQuestions: quizQuestionsTable,
  quizAttempts: quizAttemptsTable,
  quizAnswers: quizAnswersTable,
};

export const tableRelations = {
  usersRelations,
  quizPackagesRelations,
  quizQuestionsRelations,
  quizAttemptsRelations,
  quizAnswersRelations,
};