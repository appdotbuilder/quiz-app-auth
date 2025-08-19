import { db } from '../db';
import { quizPackagesTable, quizQuestionsTable, quizAttemptsTable, quizAnswersTable } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function deleteQuizPackage(id: number): Promise<{ success: boolean }> {
  try {
    // First check if the quiz package exists
    const existingPackage = await db.select()
      .from(quizPackagesTable)
      .where(eq(quizPackagesTable.id, id))
      .execute();

    if (existingPackage.length === 0) {
      throw new Error('Quiz package not found');
    }

    // Delete in proper order to handle foreign key constraints:
    // 1. First get all attempt IDs for this quiz package
    const attempts = await db.select({ id: quizAttemptsTable.id })
      .from(quizAttemptsTable)
      .where(eq(quizAttemptsTable.quiz_package_id, id))
      .execute();

    // 2. Delete quiz answers for all these attempts
    if (attempts.length > 0) {
      const attemptIds = attempts.map(attempt => attempt.id);
      for (const attemptId of attemptIds) {
        await db.delete(quizAnswersTable)
          .where(eq(quizAnswersTable.attempt_id, attemptId))
          .execute();
      }
    }

    // 3. Delete quiz attempts (references quiz package)
    await db.delete(quizAttemptsTable)
      .where(eq(quizAttemptsTable.quiz_package_id, id))
      .execute();

    // 4. Delete quiz questions (references quiz package)
    await db.delete(quizQuestionsTable)
      .where(eq(quizQuestionsTable.quiz_package_id, id))
      .execute();

    // 5. Finally delete the quiz package itself
    await db.delete(quizPackagesTable)
      .where(eq(quizPackagesTable.id, id))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Quiz package deletion failed:', error);
    throw error;
  }
}