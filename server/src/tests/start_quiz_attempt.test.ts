import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  quizPackagesTable, 
  quizQuestionsTable,
  quizAttemptsTable 
} from '../db/schema';
import { type StartQuizAttemptInput } from '../schema';
import { startQuizAttempt } from '../handlers/start_quiz_attempt';
import { eq, and } from 'drizzle-orm';

describe('startQuizAttempt', () => {
  let testUserId: number;
  let testQuizPackageId: number;

  beforeEach(async () => {
    await createDB();

    // Create a test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        role: 'USER',
      })
      .returning()
      .execute();

    testUserId = userResult[0].id;

    // Create a test quiz package
    const quizPackageResult = await db.insert(quizPackagesTable)
      .values({
        title: 'Test Quiz Package',
        description: 'A quiz package for testing',
        created_by: testUserId,
      })
      .returning()
      .execute();

    testQuizPackageId = quizPackageResult[0].id;

    // Create exactly 110 questions for the quiz package
    const questions = Array.from({ length: 110 }, (_, index) => ({
      quiz_package_id: testQuizPackageId,
      question_text: `Question ${index + 1}?`,
      option_a: 'Option A',
      option_b: 'Option B',
      option_c: 'Option C',
      option_d: 'Option D',
      option_e: 'Option E',
      correct_answer: 'A' as const,
      order_index: index,
    }));

    await db.insert(quizQuestionsTable)
      .values(questions)
      .execute();
  });

  afterEach(resetDB);

  const testInput: StartQuizAttemptInput = {
    quiz_package_id: 0, // Will be set in each test
  };

  it('should create a new quiz attempt successfully', async () => {
    const input = { ...testInput, quiz_package_id: testQuizPackageId };
    
    const result = await startQuizAttempt(input, testUserId);

    // Verify the returned state
    expect(result.quiz_package_id).toEqual(testQuizPackageId);
    expect(result.quiz_title).toEqual('Test Quiz Package');
    expect(result.current_question_index).toEqual(0);
    expect(result.total_questions).toEqual(110);
    expect(result.time_remaining_seconds).toEqual(7200);
    expect(result.attempt_id).toBeDefined();
    expect(typeof result.attempt_id).toBe('number');
    expect(result.current_question).toBeDefined();
    expect(result.current_question?.question_text).toEqual('Question 1?');
  });

  it('should save quiz attempt to database', async () => {
    const input = { ...testInput, quiz_package_id: testQuizPackageId };
    
    const result = await startQuizAttempt(input, testUserId);

    // Verify the attempt was saved to database
    const attempts = await db.select()
      .from(quizAttemptsTable)
      .where(eq(quizAttemptsTable.id, result.attempt_id))
      .execute();

    expect(attempts).toHaveLength(1);
    const attempt = attempts[0];
    expect(attempt.user_id).toEqual(testUserId);
    expect(attempt.quiz_package_id).toEqual(testQuizPackageId);
    expect(attempt.status).toEqual('IN_PROGRESS');
    expect(attempt.score).toEqual(0);
    expect(attempt.total_questions).toEqual(110);
    expect(attempt.current_question_index).toEqual(0);
    expect(attempt.time_remaining_seconds).toEqual(7200);
    expect(attempt.started_at).toBeInstanceOf(Date);
    expect(attempt.completed_at).toBeNull();
  });

  it('should return existing IN_PROGRESS attempt instead of creating new one', async () => {
    const input = { ...testInput, quiz_package_id: testQuizPackageId };

    // Start first attempt
    const firstResult = await startQuizAttempt(input, testUserId);

    // Try to start second attempt
    const secondResult = await startQuizAttempt(input, testUserId);

    // Should return the same attempt
    expect(secondResult.attempt_id).toEqual(firstResult.attempt_id);
    expect(secondResult.quiz_package_id).toEqual(firstResult.quiz_package_id);
    expect(secondResult.current_question_index).toEqual(firstResult.current_question_index);

    // Verify only one attempt exists in database
    const attempts = await db.select()
      .from(quizAttemptsTable)
      .where(
        and(
          eq(quizAttemptsTable.user_id, testUserId),
          eq(quizAttemptsTable.quiz_package_id, testQuizPackageId)
        )
      )
      .execute();

    expect(attempts).toHaveLength(1);
  });

  it('should throw error if quiz package does not exist', async () => {
    const input = { quiz_package_id: 99999 };

    await expect(startQuizAttempt(input, testUserId)).rejects.toThrow(/Quiz package with ID 99999 not found/);
  });

  it('should throw error if quiz package does not have exactly 110 questions', async () => {
    // Create quiz package with wrong number of questions
    const wrongQuizPackageResult = await db.insert(quizPackagesTable)
      .values({
        title: 'Wrong Quiz Package',
        description: 'A quiz package with wrong question count',
        created_by: testUserId,
      })
      .returning()
      .execute();

    const wrongQuizPackageId = wrongQuizPackageResult[0].id;

    // Create only 50 questions (not 110)
    const questions = Array.from({ length: 50 }, (_, index) => ({
      quiz_package_id: wrongQuizPackageId,
      question_text: `Question ${index + 1}?`,
      option_a: 'Option A',
      option_b: 'Option B',
      option_c: 'Option C',
      option_d: 'Option D',
      option_e: 'Option E',
      correct_answer: 'A' as const,
      order_index: index,
    }));

    await db.insert(quizQuestionsTable)
      .values(questions)
      .execute();

    const input = { quiz_package_id: wrongQuizPackageId };

    await expect(startQuizAttempt(input, testUserId)).rejects.toThrow(/Quiz package must have exactly 110 questions, found 50/);
  });

  it('should handle quiz package with no questions', async () => {
    // Create quiz package with no questions
    const emptyQuizPackageResult = await db.insert(quizPackagesTable)
      .values({
        title: 'Empty Quiz Package',
        description: 'A quiz package with no questions',
        created_by: testUserId,
      })
      .returning()
      .execute();

    const emptyQuizPackageId = emptyQuizPackageResult[0].id;
    const input = { quiz_package_id: emptyQuizPackageId };

    await expect(startQuizAttempt(input, testUserId)).rejects.toThrow(/Quiz package must have exactly 110 questions, found 0/);
  });

  it('should return null current_question when no question exists at index 0', async () => {
    // Create quiz package with questions but none at order_index 0
    const specialQuizPackageResult = await db.insert(quizPackagesTable)
      .values({
        title: 'Special Quiz Package',
        description: 'Quiz package with special ordering',
        created_by: testUserId,
      })
      .returning()
      .execute();

    const specialQuizPackageId = specialQuizPackageResult[0].id;

    // Create 110 questions but start from order_index 1 (skip 0)
    const questions = Array.from({ length: 110 }, (_, index) => ({
      quiz_package_id: specialQuizPackageId,
      question_text: `Question ${index + 2}?`,
      option_a: 'Option A',
      option_b: 'Option B',
      option_c: 'Option C',
      option_d: 'Option D',
      option_e: 'Option E',
      correct_answer: 'A' as const,
      order_index: index + 1, // Start from 1, not 0
    }));

    await db.insert(quizQuestionsTable)
      .values(questions)
      .execute();

    const input = { quiz_package_id: specialQuizPackageId };
    const result = await startQuizAttempt(input, testUserId);

    expect(result.current_question).toBeNull();
  });

  it('should work with different users for same quiz package', async () => {
    // Create second user
    const secondUserInsertResult = await db.insert(usersTable)
      .values({
        email: 'test2@example.com',
        password_hash: 'hashedpassword2',
        role: 'USER',
      })
      .returning()
      .execute();

    const secondUserId = secondUserInsertResult[0].id;
    const input = { quiz_package_id: testQuizPackageId };

    // Start attempts for both users
    const firstUserAttemptResult = await startQuizAttempt(input, testUserId);
    const secondUserAttemptResult = await startQuizAttempt(input, secondUserId);

    // Should create separate attempts
    expect(firstUserAttemptResult.attempt_id).not.toEqual(secondUserAttemptResult.attempt_id);

    // Verify both attempts exist in database
    const attempts = await db.select()
      .from(quizAttemptsTable)
      .where(eq(quizAttemptsTable.quiz_package_id, testQuizPackageId))
      .execute();

    expect(attempts).toHaveLength(2);
  });
});