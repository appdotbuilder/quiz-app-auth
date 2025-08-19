import { db } from '../db';
import { quizPackagesTable, quizQuestionsTable } from '../db/schema';
import { type QuizQuestion } from '../schema';
import { eq, asc } from 'drizzle-orm';

export const getQuizQuestions = async (quizPackageId: number): Promise<QuizQuestion[]> => {
  try {
    // First, validate that the quiz package exists
    const quizPackage = await db.select()
      .from(quizPackagesTable)
      .where(eq(quizPackagesTable.id, quizPackageId))
      .execute();

    if (quizPackage.length === 0) {
      throw new Error('Quiz package not found');
    }

    // Fetch all questions for the quiz package, ordered by order_index
    const questions = await db.select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.quiz_package_id, quizPackageId))
      .orderBy(asc(quizQuestionsTable.order_index))
      .execute();

    return questions;
  } catch (error) {
    console.error('Failed to get quiz questions:', error);
    throw error;
  }
};