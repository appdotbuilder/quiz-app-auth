import { db } from '../db';
import { quizAttemptsTable, quizAnswersTable, quizQuestionsTable, quizPackagesTable } from '../db/schema';
import { type SubmitQuizAnswerInput, type CurrentQuizState } from '../schema';
import { eq, and, SQL } from 'drizzle-orm';

export async function submitQuizAnswer(input: SubmitQuizAnswerInput, userId: number): Promise<CurrentQuizState> {
  try {
    // First, get the current attempt and validate it
    const attempts = await db.select()
      .from(quizAttemptsTable)
      .innerJoin(quizPackagesTable, eq(quizAttemptsTable.quiz_package_id, quizPackagesTable.id))
      .where(
        and(
          eq(quizAttemptsTable.id, input.attempt_id),
          eq(quizAttemptsTable.user_id, userId),
          eq(quizAttemptsTable.status, 'IN_PROGRESS')
        )
      )
      .execute();

    if (attempts.length === 0) {
      throw new Error('Quiz attempt not found or not accessible');
    }

    const attempt = attempts[0].quiz_attempts;
    const quizPackage = attempts[0].quiz_packages;

    // Get all questions for this quiz package, ordered by order_index
    const questions = await db.select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.quiz_package_id, attempt.quiz_package_id))
      .orderBy(quizQuestionsTable.order_index)
      .execute();

    if (questions.length === 0) {
      throw new Error('No questions found for this quiz');
    }

    // Validate that the question_id matches the current question
    const currentQuestion = questions[attempt.current_question_index];
    if (!currentQuestion || currentQuestion.id !== input.question_id) {
      throw new Error('Question ID does not match current question');
    }

    // Check if answer is correct
    const isCorrect = currentQuestion.correct_answer === input.selected_answer;

    // Record the answer
    await db.insert(quizAnswersTable)
      .values({
        attempt_id: input.attempt_id,
        question_id: input.question_id,
        selected_answer: input.selected_answer,
        is_correct: isCorrect,
      })
      .execute();

    // Calculate new score and next question index
    const newScore = attempt.score + (isCorrect ? 1 : 0);
    const nextQuestionIndex = attempt.current_question_index + 1;
    const isLastQuestion = nextQuestionIndex >= questions.length;

    // Update time remaining (simple calculation based on current time)
    const now = new Date();
    const elapsedSeconds = Math.floor((now.getTime() - attempt.started_at.getTime()) / 1000);
    const timeRemaining = Math.max(0, 7200 - elapsedSeconds); // 120 minutes total

    // Update the attempt
    let updateValues: any = {
      score: newScore,
      current_question_index: nextQuestionIndex,
      time_remaining_seconds: timeRemaining,
      updated_at: now,
    };

    // If it's the last question or time is up, complete the quiz
    if (isLastQuestion || timeRemaining === 0) {
      updateValues.status = timeRemaining === 0 ? 'TIME_OUT' : 'COMPLETED';
      updateValues.completed_at = now;
    }

    await db.update(quizAttemptsTable)
      .set(updateValues)
      .where(eq(quizAttemptsTable.id, input.attempt_id))
      .execute();

    // Get next question (if not last question and not timed out)
    const nextQuestion = (isLastQuestion || timeRemaining === 0) ? null : questions[nextQuestionIndex];

    // Return the next question without the correct answer
    const currentQuestionForResponse = nextQuestion ? {
      ...nextQuestion,
      correct_answer: 'A' as any // Hide the correct answer from the user
    } : null;

    return {
      attempt_id: input.attempt_id,
      quiz_package_id: attempt.quiz_package_id,
      quiz_title: quizPackage.title,
      current_question_index: nextQuestionIndex,
      total_questions: questions.length,
      time_remaining_seconds: timeRemaining,
      current_question: currentQuestionForResponse,
    };

  } catch (error) {
    console.error('Submit quiz answer failed:', error);
    throw error;
  }
}