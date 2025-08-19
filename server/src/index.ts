import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schema types
import {
  loginInputSchema,
  registerInputSchema,
  createQuizPackageInputSchema,
  updateQuizPackageInputSchema,
  createQuizQuestionInputSchema,
  updateQuizQuestionInputSchema,
  startQuizAttemptInputSchema,
  submitQuizAnswerInputSchema,
  completeQuizAttemptInputSchema,
} from './schema';

// Import handlers
import { loginUser } from './handlers/auth_login';
import { registerUser } from './handlers/auth_register';
import { logoutUser } from './handlers/auth_logout';
import { getUsers } from './handlers/get_users';
import { createQuizPackage } from './handlers/create_quiz_package';
import { getQuizPackages } from './handlers/get_quiz_packages';
import { getQuizPackageById } from './handlers/get_quiz_package_by_id';
import { updateQuizPackage } from './handlers/update_quiz_package';
import { deleteQuizPackage } from './handlers/delete_quiz_package';
import { createQuizQuestion } from './handlers/create_quiz_question';
import { getQuizQuestions } from './handlers/get_quiz_questions';
import { getQuizQuestionById } from './handlers/get_quiz_question_by_id';
import { updateQuizQuestion } from './handlers/update_quiz_question';
import { deleteQuizQuestion } from './handlers/delete_quiz_question';
import { startQuizAttempt } from './handlers/start_quiz_attempt';
import { getCurrentQuizState } from './handlers/get_current_quiz_state';
import { submitQuizAnswer } from './handlers/submit_quiz_answer';
import { completeQuizAttempt } from './handlers/complete_quiz_attempt';
import { getQuizResult } from './handlers/get_quiz_result';
import { getUserQuizHistory } from './handlers/get_user_quiz_history';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  login: publicProcedure
    .input(loginInputSchema)
    .mutation(({ input }) => loginUser(input)),
  
  register: publicProcedure
    .input(registerInputSchema)
    .mutation(({ input }) => registerUser(input)),
  
  logout: publicProcedure
    .mutation(() => logoutUser()),

  // User management routes (Admin only)
  getUsers: publicProcedure
    .query(() => getUsers()),

  // Quiz Package routes
  createQuizPackage: publicProcedure
    .input(createQuizPackageInputSchema)
    .mutation(({ input }) => createQuizPackage(input, 1)), // TODO: Get userId from auth context
  
  getQuizPackages: publicProcedure
    .query(() => getQuizPackages()),
  
  getQuizPackageById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getQuizPackageById(input.id)),
  
  updateQuizPackage: publicProcedure
    .input(updateQuizPackageInputSchema)
    .mutation(({ input }) => updateQuizPackage(input)),
  
  deleteQuizPackage: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteQuizPackage(input.id)),

  // Quiz Question routes
  createQuizQuestion: publicProcedure
    .input(createQuizQuestionInputSchema)
    .mutation(({ input }) => createQuizQuestion(input)),
  
  getQuizQuestions: publicProcedure
    .input(z.object({ quizPackageId: z.number() }))
    .query(({ input }) => getQuizQuestions(input.quizPackageId)),
  
  getQuizQuestionById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getQuizQuestionById(input.id)),
  
  updateQuizQuestion: publicProcedure
    .input(updateQuizQuestionInputSchema)
    .mutation(({ input }) => updateQuizQuestion(input)),
  
  deleteQuizQuestion: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ input }) => deleteQuizQuestion(input.id)),

  // Quiz Taking routes
  startQuizAttempt: publicProcedure
    .input(startQuizAttemptInputSchema)
    .mutation(({ input }) => startQuizAttempt(input, 1)), // TODO: Get userId from auth context
  
  getCurrentQuizState: publicProcedure
    .input(z.object({ attemptId: z.number() }))
    .query(({ input }) => getCurrentQuizState(input.attemptId)),
  
  submitQuizAnswer: publicProcedure
    .input(submitQuizAnswerInputSchema)
    .mutation(({ input }) => submitQuizAnswer(input, 1)), // TODO: Get userId from auth context
  
  completeQuizAttempt: publicProcedure
    .input(completeQuizAttemptInputSchema)
    .mutation(({ input }) => completeQuizAttempt(input, 1)), // TODO: Get userId from auth context
  
  getQuizResult: publicProcedure
    .input(z.object({ attemptId: z.number() }))
    .query(({ input }) => getQuizResult(input.attemptId, 1)), // TODO: Get userId from auth context
  
  getUserQuizHistory: publicProcedure
    .query(() => getUserQuizHistory(1)), // TODO: Get userId from auth context
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`Quiz Application TRPC server listening at port: ${port}`);
}

start();