import { db } from '../db';
import { quizPackagesTable, usersTable } from '../db/schema';
import { type CreateQuizPackageInput, type QuizPackage } from '../schema';
import { eq } from 'drizzle-orm';

export const createQuizPackage = async (
  input: CreateQuizPackageInput, 
  userId: number
): Promise<QuizPackage> => {
  try {
    // Verify user exists and has admin role
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1)
      .execute();

    if (!user.length) {
      throw new Error('User not found');
    }

    if (user[0].role !== 'ADMIN') {
      throw new Error('Only admin users can create quiz packages');
    }

    // Create the quiz package
    const result = await db.insert(quizPackagesTable)
      .values({
        title: input.title,
        description: input.description,
        created_by: userId
      })
      .returning()
      .execute();

    const quizPackage = result[0];
    
    // Return with question_count = 0 (no questions initially)
    return {
      ...quizPackage,
      question_count: 0
    };
  } catch (error) {
    console.error('Quiz package creation failed:', error);
    throw error;
  }
};