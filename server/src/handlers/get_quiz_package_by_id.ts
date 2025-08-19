import { db } from '../db';
import { quizPackagesTable, quizQuestionsTable } from '../db/schema';
import { type QuizPackageWithStats } from '../schema';
import { eq, count } from 'drizzle-orm';

export async function getQuizPackageById(id: number): Promise<QuizPackageWithStats | null> {
  try {
    // Query quiz package with question count using join and aggregation
    const result = await db
      .select({
        id: quizPackagesTable.id,
        title: quizPackagesTable.title,
        description: quizPackagesTable.description,
        created_by: quizPackagesTable.created_by,
        created_at: quizPackagesTable.created_at,
        updated_at: quizPackagesTable.updated_at,
        question_count: count(quizQuestionsTable.id),
      })
      .from(quizPackagesTable)
      .leftJoin(quizQuestionsTable, eq(quizPackagesTable.id, quizQuestionsTable.quiz_package_id))
      .where(eq(quizPackagesTable.id, id))
      .groupBy(
        quizPackagesTable.id,
        quizPackagesTable.title,
        quizPackagesTable.description,
        quizPackagesTable.created_by,
        quizPackagesTable.created_at,
        quizPackagesTable.updated_at
      )
      .execute();

    // Return null if package doesn't exist
    if (result.length === 0) {
      return null;
    }

    // Return the first (and only) result
    const packageData = result[0];
    return {
      id: packageData.id,
      title: packageData.title,
      description: packageData.description,
      created_by: packageData.created_by,
      created_at: packageData.created_at,
      updated_at: packageData.updated_at,
      question_count: packageData.question_count,
    };
  } catch (error) {
    console.error('Failed to get quiz package by id:', error);
    throw error;
  }
}