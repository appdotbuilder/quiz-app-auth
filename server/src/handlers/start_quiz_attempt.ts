import { db } from '../db';
import { 
  quizPackagesTable, 
  quizQuestionsTable, 
  quizAttemptsTable 
} from '../db/schema';
import { type StartQuizAttemptInput, type CurrentQuizState } from '../schema';
import { eq, and, count } from 'drizzle-orm';

export async function startQuizAttempt(input: StartQuizAttemptInput, userId: number): Promise<CurrentQuizState> {
  try {
    // First, validate that the quiz package exists
    const quizPackages = await db.select()
      .from(quizPackagesTable)
      .where(eq(quizPackagesTable.id, input.quiz_package_id))
      .execute();

    if (quizPackages.length === 0) {
      throw new Error(`Quiz package with ID ${input.quiz_package_id} not found`);
    }

    const quizPackage = quizPackages[0];

    // Validate that the quiz package has exactly 110 questions
    const questionCountResult = await db.select({ count: count() })
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.quiz_package_id, input.quiz_package_id))
      .execute();

    const questionCount = questionCountResult[0].count;
    if (questionCount !== 110) {
      throw new Error(`Quiz package must have exactly 110 questions, found ${questionCount}`);
    }

    // Check if user has any existing IN_PROGRESS attempts for this package
    const existingAttempts = await db.select()
      .from(quizAttemptsTable)
      .where(
        and(
          eq(quizAttemptsTable.user_id, userId),
          eq(quizAttemptsTable.quiz_package_id, input.quiz_package_id),
          eq(quizAttemptsTable.status, 'IN_PROGRESS')
        )
      )
      .execute();

    let attempt;

    if (existingAttempts.length > 0) {
      // Return existing attempt
      attempt = existingAttempts[0];
    } else {
      // Create new attempt
      const newAttemptResult = await db.insert(quizAttemptsTable)
        .values({
          user_id: userId,
          quiz_package_id: input.quiz_package_id,
          status: 'IN_PROGRESS',
          score: 0,
          total_questions: questionCount,
          current_question_index: 0,
          time_remaining_seconds: 7200, // 120 minutes
        })
        .returning()
        .execute();

      attempt = newAttemptResult[0];
    }

    // Get the first question (order_index = 0) for the current state
    const firstQuestions = await db.select()
      .from(quizQuestionsTable)
      .where(
        and(
          eq(quizQuestionsTable.quiz_package_id, input.quiz_package_id),
          eq(quizQuestionsTable.order_index, attempt.current_question_index)
        )
      )
      .execute();

    const currentQuestion = firstQuestions.length > 0 ? firstQuestions[0] : null;

    return {
      attempt_id: attempt.id,
      quiz_package_id: attempt.quiz_package_id,
      quiz_title: quizPackage.title,
      current_question_index: attempt.current_question_index,
      total_questions: attempt.total_questions,
      time_remaining_seconds: attempt.time_remaining_seconds,
      current_question: currentQuestion,
    };
  } catch (error) {
    console.error('Quiz attempt start failed:', error);
    throw error;
  }
}