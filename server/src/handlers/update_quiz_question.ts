import { db } from '../db';
import { quizQuestionsTable } from '../db/schema';
import { type UpdateQuizQuestionInput, type QuizQuestion } from '../schema';
import { eq, and, ne, SQL } from 'drizzle-orm';

export const updateQuizQuestion = async (input: UpdateQuizQuestionInput): Promise<QuizQuestion> => {
  try {
    // First verify the question exists
    const existingQuestion = await db.select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.id, input.id))
      .execute();

    if (existingQuestion.length === 0) {
      throw new Error(`Question with id ${input.id} not found`);
    }

    const currentQuestion = existingQuestion[0];

    // If order_index is being updated, check for uniqueness within the quiz package
    if (input.order_index !== undefined && input.order_index !== currentQuestion.order_index) {
      const conflictingQuestion = await db.select()
        .from(quizQuestionsTable)
        .where(
          and(
            eq(quizQuestionsTable.quiz_package_id, currentQuestion.quiz_package_id),
            eq(quizQuestionsTable.order_index, input.order_index),
            ne(quizQuestionsTable.id, input.id)
          )
        )
        .execute();

      if (conflictingQuestion.length > 0) {
        throw new Error(`Order index ${input.order_index} already exists in quiz package ${currentQuestion.quiz_package_id}`);
      }
    }

    // Build update object with only provided fields
    const updateData: Record<string, any> = {
      updated_at: new Date(),
    };

    if (input.question_text !== undefined) {
      updateData['question_text'] = input.question_text;
    }
    if (input.option_a !== undefined) {
      updateData['option_a'] = input.option_a;
    }
    if (input.option_b !== undefined) {
      updateData['option_b'] = input.option_b;
    }
    if (input.option_c !== undefined) {
      updateData['option_c'] = input.option_c;
    }
    if (input.option_d !== undefined) {
      updateData['option_d'] = input.option_d;
    }
    if (input.option_e !== undefined) {
      updateData['option_e'] = input.option_e;
    }
    if (input.correct_answer !== undefined) {
      updateData['correct_answer'] = input.correct_answer;
    }
    if (input.order_index !== undefined) {
      updateData['order_index'] = input.order_index;
    }

    // Update the question
    const result = await db.update(quizQuestionsTable)
      .set(updateData)
      .where(eq(quizQuestionsTable.id, input.id))
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Quiz question update failed:', error);
    throw error;
  }
};