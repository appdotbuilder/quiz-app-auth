import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, quizPackagesTable, quizQuestionsTable, quizAttemptsTable } from '../db/schema';
import { getCurrentQuizState } from '../handlers/get_current_quiz_state';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'testuser@example.com',
  password_hash: 'hashedpassword',
  role: 'USER' as const
};

const testQuizPackage = {
  title: 'Test Quiz',
  description: 'A test quiz package',
  created_by: 1
};

const testQuestions = [
  {
    quiz_package_id: 1,
    question_text: 'What is 2+2?',
    option_a: '3',
    option_b: '4',
    option_c: '5',
    option_d: '6',
    option_e: '7',
    correct_answer: 'B' as const,
    order_index: 0
  },
  {
    quiz_package_id: 1,
    question_text: 'What is 3+3?',
    option_a: '5',
    option_b: '6',
    option_c: '7',
    option_d: '8',
    option_e: '9',
    correct_answer: 'B' as const,
    order_index: 1
  }
];

describe('getCurrentQuizState', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return current quiz state for active attempt', async () => {
    // Create test data
    const users = await db.insert(usersTable).values(testUser).returning().execute();
    const quizPackages = await db.insert(quizPackagesTable).values(testQuizPackage).returning().execute();
    await db.insert(quizQuestionsTable).values(testQuestions).execute();

    // Create active quiz attempt
    const attempts = await db.insert(quizAttemptsTable).values({
      user_id: users[0].id,
      quiz_package_id: quizPackages[0].id,
      status: 'IN_PROGRESS',
      total_questions: 2,
      current_question_index: 0,
      time_remaining_seconds: 3600 // 1 hour
    }).returning().execute();

    const result = await getCurrentQuizState(attempts[0].id);

    expect(result).not.toBeNull();
    expect(result!.attempt_id).toEqual(attempts[0].id);
    expect(result!.quiz_package_id).toEqual(quizPackages[0].id);
    expect(result!.quiz_title).toEqual('Test Quiz');
    expect(result!.current_question_index).toEqual(0);
    expect(result!.total_questions).toEqual(2);
    expect(result!.time_remaining_seconds).toBeGreaterThan(3590); // Should be close to 3600
    expect(result!.current_question).not.toBeNull();
    expect(result!.current_question!.question_text).toEqual('What is 2+2?');
    expect(result!.current_question!.option_a).toEqual('3');
    expect(result!.current_question!.option_b).toEqual('4');
    expect(result!.current_question!.correct_answer).toEqual('B');
  });

  it('should return null for non-existent attempt', async () => {
    const result = await getCurrentQuizState(999);
    expect(result).toBeNull();
  });

  it('should return null for completed attempt', async () => {
    // Create test data
    const users = await db.insert(usersTable).values(testUser).returning().execute();
    const quizPackages = await db.insert(quizPackagesTable).values(testQuizPackage).returning().execute();

    // Create completed quiz attempt
    const attempts = await db.insert(quizAttemptsTable).values({
      user_id: users[0].id,
      quiz_package_id: quizPackages[0].id,
      status: 'COMPLETED',
      total_questions: 2,
      current_question_index: 2,
      completed_at: new Date(),
      time_remaining_seconds: 0
    }).returning().execute();

    const result = await getCurrentQuizState(attempts[0].id);
    expect(result).toBeNull();
  });

  it('should return null for timed out attempt', async () => {
    // Create test data
    const users = await db.insert(usersTable).values(testUser).returning().execute();
    const quizPackages = await db.insert(quizPackagesTable).values(testQuizPackage).returning().execute();

    // Create timed out quiz attempt
    const attempts = await db.insert(quizAttemptsTable).values({
      user_id: users[0].id,
      quiz_package_id: quizPackages[0].id,
      status: 'TIME_OUT',
      total_questions: 2,
      current_question_index: 1,
      completed_at: new Date(),
      time_remaining_seconds: 0
    }).returning().execute();

    const result = await getCurrentQuizState(attempts[0].id);
    expect(result).toBeNull();
  });

  it('should calculate actual remaining time based on elapsed time', async () => {
    // Create test data
    const users = await db.insert(usersTable).values(testUser).returning().execute();
    const quizPackages = await db.insert(quizPackagesTable).values(testQuizPackage).returning().execute();
    await db.insert(quizQuestionsTable).values(testQuestions).execute();

    // Create attempt that started 10 minutes ago
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const attempts = await db.insert(quizAttemptsTable).values({
      user_id: users[0].id,
      quiz_package_id: quizPackages[0].id,
      status: 'IN_PROGRESS',
      total_questions: 2,
      current_question_index: 0,
      started_at: tenMinutesAgo,
      time_remaining_seconds: 3600 // 1 hour
    }).returning().execute();

    const result = await getCurrentQuizState(attempts[0].id);

    expect(result).not.toBeNull();
    // Should be around 50 minutes remaining (3600 - 600 seconds)
    expect(result!.time_remaining_seconds).toBeLessThan(3600);
    expect(result!.time_remaining_seconds).toBeGreaterThan(2990); // Allow some variance for test execution time
  });

  it('should auto-complete quiz when time runs out', async () => {
    // Create test data
    const users = await db.insert(usersTable).values(testUser).returning().execute();
    const quizPackages = await db.insert(quizPackagesTable).values(testQuizPackage).returning().execute();

    // Create attempt that started 2 hours ago with 1 hour time limit
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const attempts = await db.insert(quizAttemptsTable).values({
      user_id: users[0].id,
      quiz_package_id: quizPackages[0].id,
      status: 'IN_PROGRESS',
      total_questions: 2,
      current_question_index: 0,
      started_at: twoHoursAgo,
      time_remaining_seconds: 3600 // 1 hour
    }).returning().execute();

    const result = await getCurrentQuizState(attempts[0].id);

    // Should return null because time ran out
    expect(result).toBeNull();

    // Check that attempt was marked as TIME_OUT
    const updatedAttempt = await db.select()
      .from(quizAttemptsTable)
      .where(eq(quizAttemptsTable.id, attempts[0].id))
      .execute();

    expect(updatedAttempt[0].status).toEqual('TIME_OUT');
    expect(updatedAttempt[0].completed_at).not.toBeNull();
    expect(updatedAttempt[0].time_remaining_seconds).toEqual(0);
  });

  it('should return null current_question when at end of quiz', async () => {
    // Create test data
    const users = await db.insert(usersTable).values(testUser).returning().execute();
    const quizPackages = await db.insert(quizPackagesTable).values(testQuizPackage).returning().execute();
    await db.insert(quizQuestionsTable).values(testQuestions).execute();

    // Create attempt at the end of questions
    const attempts = await db.insert(quizAttemptsTable).values({
      user_id: users[0].id,
      quiz_package_id: quizPackages[0].id,
      status: 'IN_PROGRESS',
      total_questions: 2,
      current_question_index: 2, // Beyond last question
      time_remaining_seconds: 3600
    }).returning().execute();

    const result = await getCurrentQuizState(attempts[0].id);

    expect(result).not.toBeNull();
    expect(result!.current_question_index).toEqual(2);
    expect(result!.current_question).toBeNull();
  });

  it('should handle second question correctly', async () => {
    // Create test data
    const users = await db.insert(usersTable).values(testUser).returning().execute();
    const quizPackages = await db.insert(quizPackagesTable).values(testQuizPackage).returning().execute();
    await db.insert(quizQuestionsTable).values(testQuestions).execute();

    // Create attempt on second question
    const attempts = await db.insert(quizAttemptsTable).values({
      user_id: users[0].id,
      quiz_package_id: quizPackages[0].id,
      status: 'IN_PROGRESS',
      total_questions: 2,
      current_question_index: 1,
      time_remaining_seconds: 3600
    }).returning().execute();

    const result = await getCurrentQuizState(attempts[0].id);

    expect(result).not.toBeNull();
    expect(result!.current_question_index).toEqual(1);
    expect(result!.current_question).not.toBeNull();
    expect(result!.current_question!.question_text).toEqual('What is 3+3?');
    expect(result!.current_question!.correct_answer).toEqual('B');
  });

  it('should handle quiz with no questions gracefully', async () => {
    // Create test data without questions
    const users = await db.insert(usersTable).values(testUser).returning().execute();
    const quizPackages = await db.insert(quizPackagesTable).values(testQuizPackage).returning().execute();

    // Create attempt
    const attempts = await db.insert(quizAttemptsTable).values({
      user_id: users[0].id,
      quiz_package_id: quizPackages[0].id,
      status: 'IN_PROGRESS',
      total_questions: 0,
      current_question_index: 0,
      time_remaining_seconds: 3600
    }).returning().execute();

    const result = await getCurrentQuizState(attempts[0].id);

    expect(result).not.toBeNull();
    expect(result!.current_question_index).toEqual(0);
    expect(result!.total_questions).toEqual(0);
    expect(result!.current_question).toBeNull();
  });
});