import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, quizPackagesTable, quizQuestionsTable, quizAttemptsTable, quizAnswersTable } from '../db/schema';
import { getQuizResult } from '../handlers/get_quiz_result';

describe('getQuizResult', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return detailed quiz results for completed attempt', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values({
        email: 'testuser@example.com',
        password_hash: 'hashedpassword',
        role: 'USER'
      })
      .returning()
      .execute();
    const userId = users[0].id;

    // Create quiz package
    const packages = await db.insert(quizPackagesTable)
      .values({
        title: 'Test Quiz',
        description: 'A test quiz',
        created_by: userId
      })
      .returning()
      .execute();
    const packageId = packages[0].id;

    // Create quiz questions
    const questions = await db.insert(quizQuestionsTable)
      .values([
        {
          quiz_package_id: packageId,
          question_text: 'What is 2 + 2?',
          option_a: '3',
          option_b: '4',
          option_c: '5',
          option_d: '6',
          option_e: '7',
          correct_answer: 'B',
          order_index: 0
        },
        {
          quiz_package_id: packageId,
          question_text: 'What is 3 + 3?',
          option_a: '5',
          option_b: '6',
          option_c: '7',
          option_d: '8',
          option_e: '9',
          correct_answer: 'B',
          order_index: 1
        }
      ])
      .returning()
      .execute();

    // Create completed quiz attempt
    const startTime = new Date('2024-01-01T10:00:00Z');
    const endTime = new Date('2024-01-01T10:15:00Z'); // 15 minutes later
    const attempts = await db.insert(quizAttemptsTable)
      .values({
        user_id: userId,
        quiz_package_id: packageId,
        status: 'COMPLETED',
        score: 1,
        total_questions: 2,
        current_question_index: 2,
        started_at: startTime,
        completed_at: endTime,
        time_remaining_seconds: 6300 // Some time remaining
      })
      .returning()
      .execute();
    const attemptId = attempts[0].id;

    // Create quiz answers
    await db.insert(quizAnswersTable)
      .values([
        {
          attempt_id: attemptId,
          question_id: questions[0].id,
          selected_answer: 'B',
          is_correct: true
        },
        {
          attempt_id: attemptId,
          question_id: questions[1].id,
          selected_answer: 'A',
          is_correct: false
        }
      ])
      .execute();

    // Test the handler
    const result = await getQuizResult(attemptId, userId);

    expect(result).not.toBeNull();
    expect(result!.attempt_id).toBe(attemptId);
    expect(result!.score).toBe(1);
    expect(result!.total_questions).toBe(2);
    expect(result!.correct_answers).toBe(1);
    expect(result!.incorrect_answers).toBe(1);
    expect(result!.time_taken_seconds).toBe(900); // 15 minutes = 900 seconds
    expect(result!.completed_at).toEqual(endTime);

    // Test answers structure
    expect(result!.answers).toHaveLength(2);

    // First answer (correct)
    const firstAnswer = result!.answers.find(a => a.question_id === questions[0].id);
    expect(firstAnswer).toBeDefined();
    expect(firstAnswer!.question_text).toBe('What is 2 + 2?');
    expect(firstAnswer!.selected_answer).toBe('B');
    expect(firstAnswer!.correct_answer).toBe('B');
    expect(firstAnswer!.is_correct).toBe(true);
    expect(firstAnswer!.option_a).toBe('3');
    expect(firstAnswer!.option_b).toBe('4');

    // Second answer (incorrect)
    const secondAnswer = result!.answers.find(a => a.question_id === questions[1].id);
    expect(secondAnswer).toBeDefined();
    expect(secondAnswer!.question_text).toBe('What is 3 + 3?');
    expect(secondAnswer!.selected_answer).toBe('A');
    expect(secondAnswer!.correct_answer).toBe('B');
    expect(secondAnswer!.is_correct).toBe(false);
    expect(secondAnswer!.option_b).toBe('6');
  });

  it('should return null for non-existent attempt', async () => {
    const result = await getQuizResult(999, 1);
    expect(result).toBeNull();
  });

  it('should return null for attempt not belonging to user', async () => {
    // Create two users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'user1@example.com',
          password_hash: 'hashedpassword',
          role: 'USER'
        },
        {
          email: 'user2@example.com',
          password_hash: 'hashedpassword',
          role: 'USER'
        }
      ])
      .returning()
      .execute();
    const user1Id = users[0].id;
    const user2Id = users[1].id;

    // Create quiz package
    const packages = await db.insert(quizPackagesTable)
      .values({
        title: 'Test Quiz',
        description: 'A test quiz',
        created_by: user1Id
      })
      .returning()
      .execute();
    const packageId = packages[0].id;

    // Create completed attempt for user1
    const attempts = await db.insert(quizAttemptsTable)
      .values({
        user_id: user1Id,
        quiz_package_id: packageId,
        status: 'COMPLETED',
        score: 0,
        total_questions: 1,
        completed_at: new Date()
      })
      .returning()
      .execute();
    const attemptId = attempts[0].id;

    // Try to get results as user2
    const result = await getQuizResult(attemptId, user2Id);
    expect(result).toBeNull();
  });

  it('should return null for non-completed attempt', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values({
        email: 'testuser@example.com',
        password_hash: 'hashedpassword',
        role: 'USER'
      })
      .returning()
      .execute();
    const userId = users[0].id;

    // Create quiz package
    const packages = await db.insert(quizPackagesTable)
      .values({
        title: 'Test Quiz',
        description: 'A test quiz',
        created_by: userId
      })
      .returning()
      .execute();
    const packageId = packages[0].id;

    // Create in-progress attempt
    const attempts = await db.insert(quizAttemptsTable)
      .values({
        user_id: userId,
        quiz_package_id: packageId,
        status: 'IN_PROGRESS',
        score: 0,
        total_questions: 1
      })
      .returning()
      .execute();
    const attemptId = attempts[0].id;

    // Try to get results for in-progress attempt
    const result = await getQuizResult(attemptId, userId);
    expect(result).toBeNull();
  });

  it('should handle perfect score correctly', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values({
        email: 'testuser@example.com',
        password_hash: 'hashedpassword',
        role: 'USER'
      })
      .returning()
      .execute();
    const userId = users[0].id;

    // Create quiz package
    const packages = await db.insert(quizPackagesTable)
      .values({
        title: 'Test Quiz',
        description: 'A test quiz',
        created_by: userId
      })
      .returning()
      .execute();
    const packageId = packages[0].id;

    // Create quiz question
    const questions = await db.insert(quizQuestionsTable)
      .values({
        quiz_package_id: packageId,
        question_text: 'Easy question',
        option_a: 'Wrong',
        option_b: 'Correct',
        option_c: 'Wrong',
        option_d: 'Wrong',
        option_e: 'Wrong',
        correct_answer: 'B',
        order_index: 0
      })
      .returning()
      .execute();

    // Create completed attempt with perfect score
    const attempts = await db.insert(quizAttemptsTable)
      .values({
        user_id: userId,
        quiz_package_id: packageId,
        status: 'COMPLETED',
        score: 1,
        total_questions: 1,
        completed_at: new Date()
      })
      .returning()
      .execute();
    const attemptId = attempts[0].id;

    // Create correct answer
    await db.insert(quizAnswersTable)
      .values({
        attempt_id: attemptId,
        question_id: questions[0].id,
        selected_answer: 'B',
        is_correct: true
      })
      .execute();

    const result = await getQuizResult(attemptId, userId);

    expect(result).not.toBeNull();
    expect(result!.score).toBe(1);
    expect(result!.correct_answers).toBe(1);
    expect(result!.incorrect_answers).toBe(0);
  });

  it('should handle zero score correctly', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values({
        email: 'testuser@example.com',
        password_hash: 'hashedpassword',
        role: 'USER'
      })
      .returning()
      .execute();
    const userId = users[0].id;

    // Create quiz package
    const packages = await db.insert(quizPackagesTable)
      .values({
        title: 'Test Quiz',
        description: 'A test quiz',
        created_by: userId
      })
      .returning()
      .execute();
    const packageId = packages[0].id;

    // Create quiz question
    const questions = await db.insert(quizQuestionsTable)
      .values({
        quiz_package_id: packageId,
        question_text: 'Hard question',
        option_a: 'Wrong',
        option_b: 'Correct',
        option_c: 'Wrong',
        option_d: 'Wrong',
        option_e: 'Wrong',
        correct_answer: 'B',
        order_index: 0
      })
      .returning()
      .execute();

    // Create completed attempt with zero score
    const attempts = await db.insert(quizAttemptsTable)
      .values({
        user_id: userId,
        quiz_package_id: packageId,
        status: 'COMPLETED',
        score: 0,
        total_questions: 1,
        completed_at: new Date()
      })
      .returning()
      .execute();
    const attemptId = attempts[0].id;

    // Create incorrect answer
    await db.insert(quizAnswersTable)
      .values({
        attempt_id: attemptId,
        question_id: questions[0].id,
        selected_answer: 'A',
        is_correct: false
      })
      .execute();

    const result = await getQuizResult(attemptId, userId);

    expect(result).not.toBeNull();
    expect(result!.score).toBe(0);
    expect(result!.correct_answers).toBe(0);
    expect(result!.incorrect_answers).toBe(1);
  });
});