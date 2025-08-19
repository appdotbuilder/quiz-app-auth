import { db } from '../db';
import { quizAttemptsTable, quizAnswersTable, quizQuestionsTable } from '../db/schema';
import { type QuizResult } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function getQuizResult(attemptId: number, userId: number): Promise<QuizResult | null> {
  try {
    // First, get the quiz attempt and validate it exists, is COMPLETED, and belongs to the user
    const attempts = await db.select()
      .from(quizAttemptsTable)
      .where(
        and(
          eq(quizAttemptsTable.id, attemptId),
          eq(quizAttemptsTable.user_id, userId),
          eq(quizAttemptsTable.status, 'COMPLETED')
        )
      )
      .execute();

    if (attempts.length === 0) {
      return null;
    }

    const attempt = attempts[0];

    // Get all answers for this attempt with question details
    const answersWithQuestions = await db.select()
      .from(quizAnswersTable)
      .innerJoin(quizQuestionsTable, eq(quizAnswersTable.question_id, quizQuestionsTable.id))
      .where(eq(quizAnswersTable.attempt_id, attemptId))
      .execute();

    // Transform the joined results into the required format
    const answers = answersWithQuestions.map(result => ({
      question_id: result.quiz_answers.question_id,
      question_text: result.quiz_questions.question_text,
      selected_answer: result.quiz_answers.selected_answer,
      correct_answer: result.quiz_questions.correct_answer,
      is_correct: result.quiz_answers.is_correct,
      option_a: result.quiz_questions.option_a,
      option_b: result.quiz_questions.option_b,
      option_c: result.quiz_questions.option_c,
      option_d: result.quiz_questions.option_d,
      option_e: result.quiz_questions.option_e,
    }));

    // Calculate statistics
    const correctAnswers = answers.filter(answer => answer.is_correct).length;
    const incorrectAnswers = answers.length - correctAnswers;

    // Calculate time taken (in seconds)
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
      answers: answers,
    };
  } catch (error) {
    console.error('Get quiz result failed:', error);
    throw error;
  }
}