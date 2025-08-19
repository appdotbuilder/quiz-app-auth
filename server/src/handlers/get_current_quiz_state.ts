import { db } from '../db';
import { quizAttemptsTable, quizQuestionsTable, quizPackagesTable } from '../db/schema';
import { type CurrentQuizState } from '../schema';
import { eq, and, asc } from 'drizzle-orm';

export async function getCurrentQuizState(attemptId: number): Promise<CurrentQuizState | null> {
  try {
    // Get the quiz attempt with package info
    const attemptResults = await db.select({
      attempt_id: quizAttemptsTable.id,
      quiz_package_id: quizAttemptsTable.quiz_package_id,
      status: quizAttemptsTable.status,
      current_question_index: quizAttemptsTable.current_question_index,
      total_questions: quizAttemptsTable.total_questions,
      started_at: quizAttemptsTable.started_at,
      time_remaining_seconds: quizAttemptsTable.time_remaining_seconds,
      quiz_title: quizPackagesTable.title
    })
    .from(quizAttemptsTable)
    .innerJoin(quizPackagesTable, eq(quizAttemptsTable.quiz_package_id, quizPackagesTable.id))
    .where(eq(quizAttemptsTable.id, attemptId))
    .execute();

    if (attemptResults.length === 0) {
      return null;
    }

    const attempt = attemptResults[0];

    // Return null if attempt is already completed or timed out
    if (attempt.status === 'COMPLETED' || attempt.status === 'TIME_OUT') {
      return null;
    }

    // Calculate actual time remaining based on elapsed time
    const now = new Date();
    const elapsedSeconds = Math.floor((now.getTime() - attempt.started_at.getTime()) / 1000);
    const actualTimeRemaining = Math.max(0, attempt.time_remaining_seconds - elapsedSeconds);

    // Auto-complete quiz if time has run out
    if (actualTimeRemaining === 0) {
      await db.update(quizAttemptsTable)
        .set({
          status: 'TIME_OUT',
          completed_at: now,
          time_remaining_seconds: 0,
          updated_at: now
        })
        .where(eq(quizAttemptsTable.id, attemptId))
        .execute();

      return null;
    }

    // Get current question if we're still within the quiz bounds
    let currentQuestion = null;
    if (attempt.current_question_index < attempt.total_questions) {
      const questionResults = await db.select({
        id: quizQuestionsTable.id,
        quiz_package_id: quizQuestionsTable.quiz_package_id,
        question_text: quizQuestionsTable.question_text,
        option_a: quizQuestionsTable.option_a,
        option_b: quizQuestionsTable.option_b,
        option_c: quizQuestionsTable.option_c,
        option_d: quizQuestionsTable.option_d,
        option_e: quizQuestionsTable.option_e,
        correct_answer: quizQuestionsTable.correct_answer,
        order_index: quizQuestionsTable.order_index,
        created_at: quizQuestionsTable.created_at,
        updated_at: quizQuestionsTable.updated_at
      })
      .from(quizQuestionsTable)
      .where(
        and(
          eq(quizQuestionsTable.quiz_package_id, attempt.quiz_package_id),
          eq(quizQuestionsTable.order_index, attempt.current_question_index)
        )
      )
      .execute();

      if (questionResults.length > 0) {
        currentQuestion = questionResults[0];
      }
    }

    return {
      attempt_id: attempt.attempt_id,
      quiz_package_id: attempt.quiz_package_id,
      quiz_title: attempt.quiz_title,
      current_question_index: attempt.current_question_index,
      total_questions: attempt.total_questions,
      time_remaining_seconds: actualTimeRemaining,
      current_question: currentQuestion
    };
  } catch (error) {
    console.error('Get current quiz state failed:', error);
    throw error;
  }
}