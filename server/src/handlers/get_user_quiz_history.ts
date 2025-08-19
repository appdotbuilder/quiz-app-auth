import { db } from '../db';
import { quizAttemptsTable } from '../db/schema';
import { type QuizAttempt } from '../schema';
import { eq, desc } from 'drizzle-orm';

export const getUserQuizHistory = async (userId: number): Promise<QuizAttempt[]> => {
  try {
    // Query quiz attempts for the specific user, ordered by created_at DESC
    const results = await db.select()
      .from(quizAttemptsTable)
      .where(eq(quizAttemptsTable.user_id, userId))
      .orderBy(desc(quizAttemptsTable.created_at))
      .execute();

    // Return the results (no numeric conversions needed - all fields are integers)
    return results;
  } catch (error) {
    console.error('Failed to get user quiz history:', error);
    throw error;
  }
};