import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, quizPackagesTable, quizQuestionsTable, quizAttemptsTable, quizAnswersTable } from '../db/schema';
import { deleteQuizPackage } from '../handlers/delete_quiz_package';
import { eq } from 'drizzle-orm';

describe('deleteQuizPackage', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete a quiz package and all related data', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'admin@example.com',
        password_hash: 'hashedpassword',
        role: 'ADMIN'
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create test quiz package
    const packageResult = await db.insert(quizPackagesTable)
      .values({
        title: 'Test Package',
        description: 'A test quiz package',
        created_by: userId
      })
      .returning()
      .execute();
    const packageId = packageResult[0].id;

    // Create test questions
    const questionResult = await db.insert(quizQuestionsTable)
      .values({
        quiz_package_id: packageId,
        question_text: 'What is 2 + 2?',
        option_a: '3',
        option_b: '4',
        option_c: '5',
        option_d: '6',
        option_e: '7',
        correct_answer: 'B',
        order_index: 0
      })
      .returning()
      .execute();
    const questionId = questionResult[0].id;

    // Create test quiz attempt
    const attemptResult = await db.insert(quizAttemptsTable)
      .values({
        user_id: userId,
        quiz_package_id: packageId,
        status: 'COMPLETED',
        total_questions: 1,
        score: 1
      })
      .returning()
      .execute();
    const attemptId = attemptResult[0].id;

    // Create test answer
    await db.insert(quizAnswersTable)
      .values({
        attempt_id: attemptId,
        question_id: questionId,
        selected_answer: 'B',
        is_correct: true
      })
      .execute();

    // Verify data exists before deletion
    const packagesBeforeDelete = await db.select()
      .from(quizPackagesTable)
      .where(eq(quizPackagesTable.id, packageId))
      .execute();
    expect(packagesBeforeDelete).toHaveLength(1);

    const questionsBeforeDelete = await db.select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.quiz_package_id, packageId))
      .execute();
    expect(questionsBeforeDelete).toHaveLength(1);

    // Execute deletion
    const result = await deleteQuizPackage(packageId);

    // Verify successful response
    expect(result.success).toBe(true);

    // Verify all related data is deleted
    const packagesAfterDelete = await db.select()
      .from(quizPackagesTable)
      .where(eq(quizPackagesTable.id, packageId))
      .execute();
    expect(packagesAfterDelete).toHaveLength(0);

    const questionsAfterDelete = await db.select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.quiz_package_id, packageId))
      .execute();
    expect(questionsAfterDelete).toHaveLength(0);

    const attemptsAfterDelete = await db.select()
      .from(quizAttemptsTable)
      .where(eq(quizAttemptsTable.quiz_package_id, packageId))
      .execute();
    expect(attemptsAfterDelete).toHaveLength(0);

    const answersAfterDelete = await db.select()
      .from(quizAnswersTable)
      .where(eq(quizAnswersTable.attempt_id, attemptId))
      .execute();
    expect(answersAfterDelete).toHaveLength(0);
  });

  it('should handle deletion of package with multiple questions and attempts', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'admin@example.com',
        password_hash: 'hashedpassword',
        role: 'ADMIN'
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create test quiz package
    const packageResult = await db.insert(quizPackagesTable)
      .values({
        title: 'Multi Question Package',
        description: 'Package with multiple questions',
        created_by: userId
      })
      .returning()
      .execute();
    const packageId = packageResult[0].id;

    // Create multiple questions
    const question1Result = await db.insert(quizQuestionsTable)
      .values({
        quiz_package_id: packageId,
        question_text: 'Question 1',
        option_a: 'A1',
        option_b: 'B1',
        option_c: 'C1',
        option_d: 'D1',
        option_e: 'E1',
        correct_answer: 'A',
        order_index: 0
      })
      .returning()
      .execute();

    const question2Result = await db.insert(quizQuestionsTable)
      .values({
        quiz_package_id: packageId,
        question_text: 'Question 2',
        option_a: 'A2',
        option_b: 'B2',
        option_c: 'C2',
        option_d: 'D2',
        option_e: 'E2',
        correct_answer: 'B',
        order_index: 1
      })
      .returning()
      .execute();

    // Create multiple attempts
    const attempt1Result = await db.insert(quizAttemptsTable)
      .values({
        user_id: userId,
        quiz_package_id: packageId,
        status: 'COMPLETED',
        total_questions: 2,
        score: 2
      })
      .returning()
      .execute();

    const attempt2Result = await db.insert(quizAttemptsTable)
      .values({
        user_id: userId,
        quiz_package_id: packageId,
        status: 'IN_PROGRESS',
        total_questions: 2,
        score: 0
      })
      .returning()
      .execute();

    // Create answers for attempts
    await db.insert(quizAnswersTable)
      .values([
        {
          attempt_id: attempt1Result[0].id,
          question_id: question1Result[0].id,
          selected_answer: 'A',
          is_correct: true
        },
        {
          attempt_id: attempt1Result[0].id,
          question_id: question2Result[0].id,
          selected_answer: 'B',
          is_correct: true
        },
        {
          attempt_id: attempt2Result[0].id,
          question_id: question1Result[0].id,
          selected_answer: 'C',
          is_correct: false
        }
      ])
      .execute();

    // Verify data exists
    const questionsBeforeDelete = await db.select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.quiz_package_id, packageId))
      .execute();
    expect(questionsBeforeDelete).toHaveLength(2);

    const attemptsBeforeDelete = await db.select()
      .from(quizAttemptsTable)
      .where(eq(quizAttemptsTable.quiz_package_id, packageId))
      .execute();
    expect(attemptsBeforeDelete).toHaveLength(2);

    // Execute deletion
    const result = await deleteQuizPackage(packageId);
    expect(result.success).toBe(true);

    // Verify all data is deleted
    const questionsAfterDelete = await db.select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.quiz_package_id, packageId))
      .execute();
    expect(questionsAfterDelete).toHaveLength(0);

    const attemptsAfterDelete = await db.select()
      .from(quizAttemptsTable)
      .where(eq(quizAttemptsTable.quiz_package_id, packageId))
      .execute();
    expect(attemptsAfterDelete).toHaveLength(0);
  });

  it('should throw error when quiz package does not exist', async () => {
    const nonExistentId = 999999;

    await expect(deleteQuizPackage(nonExistentId))
      .rejects.toThrow(/quiz package not found/i);
  });

  it('should handle deletion of package with no questions or attempts', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'admin@example.com',
        password_hash: 'hashedpassword',
        role: 'ADMIN'
      })
      .returning()
      .execute();
    const userId = userResult[0].id;

    // Create quiz package with no questions or attempts
    const packageResult = await db.insert(quizPackagesTable)
      .values({
        title: 'Empty Package',
        description: 'Package with no questions',
        created_by: userId
      })
      .returning()
      .execute();
    const packageId = packageResult[0].id;

    // Verify package exists
    const packagesBeforeDelete = await db.select()
      .from(quizPackagesTable)
      .where(eq(quizPackagesTable.id, packageId))
      .execute();
    expect(packagesBeforeDelete).toHaveLength(1);

    // Execute deletion
    const result = await deleteQuizPackage(packageId);
    expect(result.success).toBe(true);

    // Verify package is deleted
    const packagesAfterDelete = await db.select()
      .from(quizPackagesTable)
      .where(eq(quizPackagesTable.id, packageId))
      .execute();
    expect(packagesAfterDelete).toHaveLength(0);
  });
});