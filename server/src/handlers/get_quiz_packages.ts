import { db } from '../db';
import { quizPackagesTable, quizQuestionsTable } from '../db/schema';
import { type QuizPackageWithStats } from '../schema';
import { sql, desc } from 'drizzle-orm';

export const getQuizPackages = async (): Promise<QuizPackageWithStats[]> => {
  try {
    // Query quiz packages with question count using LEFT JOIN and GROUP BY
    const results = await db
      .select({
        id: quizPackagesTable.id,
        title: quizPackagesTable.title,
        description: quizPackagesTable.description,
        created_by: quizPackagesTable.created_by,
        created_at: quizPackagesTable.created_at,
        updated_at: quizPackagesTable.updated_at,
        question_count: sql<number>`COALESCE(COUNT(${quizQuestionsTable.id}), 0)`.as('question_count'),
      })
      .from(quizPackagesTable)
      .leftJoin(
        quizQuestionsTable,
        sql`${quizPackagesTable.id} = ${quizQuestionsTable.quiz_package_id}`
      )
      .groupBy(
        quizPackagesTable.id,
        quizPackagesTable.title,
        quizPackagesTable.description,
        quizPackagesTable.created_by,
        quizPackagesTable.created_at,
        quizPackagesTable.updated_at
      )
      .orderBy(desc(quizPackagesTable.created_at))
      .execute();

    return results.map(result => ({
      ...result,
      // Ensure question_count is properly typed as number
      question_count: Number(result.question_count),
    }));
  } catch (error) {
    console.error('Failed to fetch quiz packages:', error);
    throw error;
  }
};