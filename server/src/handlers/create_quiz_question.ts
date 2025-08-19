import { db } from '../db';
import { quizQuestionsTable, quizPackagesTable } from '../db/schema';
import { type CreateQuizQuestionInput, type QuizQuestion } from '../schema';
import { eq, count, and } from 'drizzle-orm';

export const createQuizQuestion = async (input: CreateQuizQuestionInput): Promise<QuizQuestion> => {
  try {
    // Validate that the quiz package exists
    const quizPackage = await db.select()
      .from(quizPackagesTable)
      .where(eq(quizPackagesTable.id, input.quiz_package_id))
      .execute();

    if (quizPackage.length === 0) {
      throw new Error('Quiz package not found');
    }

    // Check current question count to ensure we don't exceed 110 questions limit
    const questionCountResult = await db.select({ count: count() })
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.quiz_package_id, input.quiz_package_id))
      .execute();

    const currentQuestionCount = questionCountResult[0].count;
    if (currentQuestionCount >= 110) {
      throw new Error('Quiz package cannot have more than 110 questions');
    }

    // Check if order_index is already used within this package
    const existingQuestion = await db.select()
      .from(quizQuestionsTable)
      .where(and(
        eq(quizQuestionsTable.quiz_package_id, input.quiz_package_id),
        eq(quizQuestionsTable.order_index, input.order_index)
      ))
      .execute();

    if (existingQuestion.length > 0) {
      throw new Error('Order index already exists for this quiz package');
    }

    // Insert the new quiz question
    const result = await db.insert(quizQuestionsTable)
      .values({
        quiz_package_id: input.quiz_package_id,
        question_text: input.question_text,
        option_a: input.option_a,
        option_b: input.option_b,
        option_c: input.option_c,
        option_d: input.option_d,
        option_e: input.option_e,
        correct_answer: input.correct_answer,
        order_index: input.order_index
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Quiz question creation failed:', error);
    throw error;
  }
};