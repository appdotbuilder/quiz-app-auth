import { db } from '../db';
import { quizQuestionsTable, quizAnswersTable } from '../db/schema';
import { eq, sql } from 'drizzle-orm';

export const deleteQuizQuestion = async (id: number): Promise<{ success: boolean }> => {
  try {
    // First, check if the question exists and get its order_index
    const questionToDelete = await db.select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.id, id))
      .execute();

    if (questionToDelete.length === 0) {
      throw new Error('Question not found');
    }

    const { quiz_package_id, order_index } = questionToDelete[0];

    // Delete related quiz answers first to maintain referential integrity
    await db.delete(quizAnswersTable)
      .where(eq(quizAnswersTable.question_id, id))
      .execute();

    // Delete the question
    await db.delete(quizQuestionsTable)
      .where(eq(quizQuestionsTable.id, id))
      .execute();

    // Update order_index of remaining questions to maintain sequence
    // All questions with order_index > deleted question's order_index should be decremented by 1
    await db.execute(
      sql`UPDATE quiz_questions 
          SET order_index = order_index - 1 
          WHERE quiz_package_id = ${quiz_package_id} 
          AND order_index > ${order_index}`
    );

    return { success: true };
  } catch (error) {
    console.error('Question deletion failed:', error);
    throw error;
  }
};