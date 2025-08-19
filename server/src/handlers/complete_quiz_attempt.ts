import { db } from '../db';
import { quizAttemptsTable, quizAnswersTable, quizQuestionsTable } from '../db/schema';
import { type CompleteQuizAttemptInput, type QuizResult } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function completeQuizAttempt(input: CompleteQuizAttemptInput, userId: number): Promise<QuizResult> {
  try {
    // First, find the quiz attempt and verify it belongs to the user
    const attempts = await db.select()
      .from(quizAttemptsTable)
      .where(
        and(
          eq(quizAttemptsTable.id, input.attempt_id),
          eq(quizAttemptsTable.user_id, userId)
        )
      )
      .execute();

    if (attempts.length === 0) {
      throw new Error(`Quiz attempt ${input.attempt_id} not found or does not belong to user`);
    }

    const attempt = attempts[0];

    // Check if attempt is already completed
    if (attempt.status === 'COMPLETED' || attempt.status === 'TIME_OUT') {
      // If already completed, just return the existing results
      return await getQuizResults(input.attempt_id);
    }

    // Check if attempt is in progress
    if (attempt.status !== 'IN_PROGRESS') {
      throw new Error(`Quiz attempt ${input.attempt_id} is not in progress`);
    }

    // Determine completion status
    const currentTime = new Date();
    // For manual completion, default to COMPLETED status
    // TIME_OUT should be set by a separate timeout mechanism, not here
    const finalStatus = 'COMPLETED';

    // Calculate final score by counting correct answers
    const answers = await db.select()
      .from(quizAnswersTable)
      .where(eq(quizAnswersTable.attempt_id, input.attempt_id))
      .execute();

    const correctAnswers = answers.filter(answer => answer.is_correct).length;
    const finalScore = correctAnswers;

    // Update the attempt with completion details
    await db.update(quizAttemptsTable)
      .set({
        status: finalStatus,
        completed_at: currentTime,
        score: finalScore,
        updated_at: currentTime
      })
      .where(eq(quizAttemptsTable.id, input.attempt_id))
      .execute();

    // Return the detailed results
    return await getQuizResults(input.attempt_id);

  } catch (error) {
    console.error('Complete quiz attempt failed:', error);
    throw error;
  }
}

async function getQuizResults(attemptId: number): Promise<QuizResult> {
  // Get the updated attempt details
  const attempts = await db.select()
    .from(quizAttemptsTable)
    .where(eq(quizAttemptsTable.id, attemptId))
    .execute();

  const attempt = attempts[0];

  // Get all answers with question details
  const answersWithQuestions = await db.select({
    answer_id: quizAnswersTable.id,
    question_id: quizAnswersTable.question_id,
    selected_answer: quizAnswersTable.selected_answer,
    is_correct: quizAnswersTable.is_correct,
    answered_at: quizAnswersTable.answered_at,
    question_text: quizQuestionsTable.question_text,
    option_a: quizQuestionsTable.option_a,
    option_b: quizQuestionsTable.option_b,
    option_c: quizQuestionsTable.option_c,
    option_d: quizQuestionsTable.option_d,
    option_e: quizQuestionsTable.option_e,
    correct_answer: quizQuestionsTable.correct_answer
  })
    .from(quizAnswersTable)
    .innerJoin(quizQuestionsTable, eq(quizAnswersTable.question_id, quizQuestionsTable.id))
    .where(eq(quizAnswersTable.attempt_id, attemptId))
    .execute();

  // Calculate statistics
  const correctAnswers = answersWithQuestions.filter(answer => answer.is_correct).length;
  const incorrectAnswers = answersWithQuestions.length - correctAnswers;

  // Calculate time taken
  const timeTakenSeconds = attempt.completed_at && attempt.started_at
    ? Math.floor((attempt.completed_at.getTime() - attempt.started_at.getTime()) / 1000)
    : 0;

  return {
    attempt_id: attemptId,
    score: attempt.score,
    total_questions: attempt.total_questions,
    correct_answers: correctAnswers,
    incorrect_answers: incorrectAnswers,
    time_taken_seconds: timeTakenSeconds,
    completed_at: attempt.completed_at!,
    answers: answersWithQuestions.map(answer => ({
      question_id: answer.question_id,
      question_text: answer.question_text,
      selected_answer: answer.selected_answer,
      correct_answer: answer.correct_answer,
      is_correct: answer.is_correct,
      option_a: answer.option_a,
      option_b: answer.option_b,
      option_c: answer.option_c,
      option_d: answer.option_d,
      option_e: answer.option_e,
    }))
  };
}