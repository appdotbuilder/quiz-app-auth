import { db } from '../db';
import { quizQuestionsTable } from '../db/schema';
import { type QuizQuestion } from '../schema';
import { eq } from 'drizzle-orm';

export async function getQuizQuestionById(id: number): Promise<QuizQuestion | null> {
  try {
    // Query the quiz question by ID
    const results = await db.select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.id, id))
      .execute();

    // Return null if question doesn't exist
    if (results.length === 0) {
      return null;
    }

    const question = results[0];

    // Return the question with all fields
    return {
      id: question.id,
      quiz_package_id: question.quiz_package_id,
      question_text: question.question_text,
      option_a: question.option_a,
      option_b: question.option_b,
      option_c: question.option_c,
      option_d: question.option_d,
      option_e: question.option_e,
      correct_answer: question.correct_answer,
      order_index: question.order_index,
      created_at: question.created_at,
      updated_at: question.updated_at,
    };
  } catch (error) {
    console.error('Quiz question retrieval failed:', error);
    throw error;
  }
}