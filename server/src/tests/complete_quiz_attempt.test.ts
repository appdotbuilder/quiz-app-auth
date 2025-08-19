import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  quizPackagesTable, 
  quizQuestionsTable, 
  quizAttemptsTable, 
  quizAnswersTable 
} from '../db/schema';
import { type CompleteQuizAttemptInput } from '../schema';
import { completeQuizAttempt } from '../handlers/complete_quiz_attempt';
import { eq } from 'drizzle-orm';

describe('completeQuizAttempt', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Helper function to create test data
  const createTestData = async () => {
    // Create user
    const users = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        role: 'USER'
      })
      .returning()
      .execute();
    const userId = users[0].id;

    // Create quiz package
    const quizPackages = await db.insert(quizPackagesTable)
      .values({
        title: 'Test Quiz',
        description: 'A test quiz',
        created_by: userId
      })
      .returning()
      .execute();
    const quizPackageId = quizPackages[0].id;

    // Create quiz questions
    const questions = await db.insert(quizQuestionsTable)
      .values([
        {
          quiz_package_id: quizPackageId,
          question_text: 'What is 2+2?',
          option_a: '3',
          option_b: '4',
          option_c: '5',
          option_d: '6',
          option_e: '7',
          correct_answer: 'B',
          order_index: 0
        },
        {
          quiz_package_id: quizPackageId,
          question_text: 'What is 3+3?',
          option_a: '5',
          option_b: '6',
          option_c: '7',
          option_d: '8',
          option_e: '9',
          correct_answer: 'B',
          order_index: 1
        },
        {
          quiz_package_id: quizPackageId,
          question_text: 'What is 5+5?',
          option_a: '9',
          option_b: '10',
          option_c: '11',
          option_d: '12',
          option_e: '13',
          correct_answer: 'B',
          order_index: 2
        }
      ])
      .returning()
      .execute();

    return { userId, quizPackageId, questions };
  };

  it('should complete a quiz attempt and return detailed results', async () => {
    const { userId, quizPackageId, questions } = await createTestData();

    // Create quiz attempt with a specific start time to ensure measurable time difference
    const startTime = new Date(Date.now() - 2000); // 2 seconds ago
    const attempts = await db.insert(quizAttemptsTable)
      .values({
        user_id: userId,
        quiz_package_id: quizPackageId,
        status: 'IN_PROGRESS',
        score: 0,
        total_questions: 3,
        current_question_index: 0,
        started_at: startTime,
        time_remaining_seconds: 7200
      })
      .returning()
      .execute();
    const attemptId = attempts[0].id;

    // Add some answers (2 correct, 1 incorrect)
    await db.insert(quizAnswersTable)
      .values([
        {
          attempt_id: attemptId,
          question_id: questions[0].id,
          selected_answer: 'B', // Correct
          is_correct: true
        },
        {
          attempt_id: attemptId,
          question_id: questions[1].id,
          selected_answer: 'B', // Correct
          is_correct: true
        },
        {
          attempt_id: attemptId,
          question_id: questions[2].id,
          selected_answer: 'A', // Incorrect
          is_correct: false
        }
      ])
      .execute();

    const input: CompleteQuizAttemptInput = {
      attempt_id: attemptId
    };

    const result = await completeQuizAttempt(input, userId);

    // Verify result structure
    expect(result.attempt_id).toEqual(attemptId);
    expect(result.score).toEqual(2); // 2 correct answers
    expect(result.total_questions).toEqual(3);
    expect(result.correct_answers).toEqual(2);
    expect(result.incorrect_answers).toEqual(1);
    expect(result.time_taken_seconds).toBeGreaterThanOrEqual(1);
    expect(result.completed_at).toBeInstanceOf(Date);
    expect(result.answers).toHaveLength(3);

    // Verify answer details
    const answer1 = result.answers.find(a => a.question_id === questions[0].id);
    expect(answer1).toBeDefined();
    expect(answer1!.question_text).toEqual('What is 2+2?');
    expect(answer1!.selected_answer).toEqual('B');
    expect(answer1!.correct_answer).toEqual('B');
    expect(answer1!.is_correct).toBe(true);
    expect(answer1!.option_b).toEqual('4');

    // Verify attempt was updated in database
    const updatedAttempts = await db.select()
      .from(quizAttemptsTable)
      .where(eq(quizAttemptsTable.id, attemptId))
      .execute();

    const updatedAttempt = updatedAttempts[0];
    expect(updatedAttempt.status).toEqual('COMPLETED');
    expect(updatedAttempt.score).toEqual(2);
    expect(updatedAttempt.completed_at).toBeInstanceOf(Date);
  });

  it('should return existing results if attempt is already completed', async () => {
    const { userId, quizPackageId, questions } = await createTestData();

    const completedAt = new Date();
    // Create already completed attempt
    const attempts = await db.insert(quizAttemptsTable)
      .values({
        user_id: userId,
        quiz_package_id: quizPackageId,
        status: 'COMPLETED',
        score: 1,
        total_questions: 3,
        current_question_index: 3,
        completed_at: completedAt,
        time_remaining_seconds: 3600
      })
      .returning()
      .execute();
    const attemptId = attempts[0].id;

    // Add one answer
    await db.insert(quizAnswersTable)
      .values([
        {
          attempt_id: attemptId,
          question_id: questions[0].id,
          selected_answer: 'B',
          is_correct: true
        }
      ])
      .execute();

    const input: CompleteQuizAttemptInput = {
      attempt_id: attemptId
    };

    const result = await completeQuizAttempt(input, userId);

    // Should return existing results without modification
    expect(result.attempt_id).toEqual(attemptId);
    expect(result.score).toEqual(1);
    expect(result.correct_answers).toEqual(1);
    expect(result.answers).toHaveLength(1);
  });

  it('should throw error if attempt does not exist', async () => {
    const { userId } = await createTestData();

    const input: CompleteQuizAttemptInput = {
      attempt_id: 99999 // Non-existent attempt
    };

    await expect(completeQuizAttempt(input, userId))
      .rejects.toThrow(/not found or does not belong to user/i);
  });

  it('should throw error if attempt does not belong to user', async () => {
    const { userId, quizPackageId } = await createTestData();

    // Create another user
    const otherUsers = await db.insert(usersTable)
      .values({
        email: 'other@example.com',
        password_hash: 'hashed_password',
        role: 'USER'
      })
      .returning()
      .execute();
    const otherUserId = otherUsers[0].id;

    // Create attempt for other user
    const attempts = await db.insert(quizAttemptsTable)
      .values({
        user_id: otherUserId,
        quiz_package_id: quizPackageId,
        status: 'IN_PROGRESS',
        score: 0,
        total_questions: 3,
        current_question_index: 0,
        time_remaining_seconds: 7200
      })
      .returning()
      .execute();
    const attemptId = attempts[0].id;

    const input: CompleteQuizAttemptInput = {
      attempt_id: attemptId
    };

    // Try to complete with wrong user
    await expect(completeQuizAttempt(input, userId))
      .rejects.toThrow(/not found or does not belong to user/i);
  });

  it('should handle attempt with no answers', async () => {
    const { userId, quizPackageId } = await createTestData();

    // Create quiz attempt with no answers
    const attempts = await db.insert(quizAttemptsTable)
      .values({
        user_id: userId,
        quiz_package_id: quizPackageId,
        status: 'IN_PROGRESS',
        score: 0,
        total_questions: 3,
        current_question_index: 0,
        time_remaining_seconds: 7200
      })
      .returning()
      .execute();
    const attemptId = attempts[0].id;

    const input: CompleteQuizAttemptInput = {
      attempt_id: attemptId
    };

    const result = await completeQuizAttempt(input, userId);

    expect(result.attempt_id).toEqual(attemptId);
    expect(result.score).toEqual(0);
    expect(result.correct_answers).toEqual(0);
    expect(result.incorrect_answers).toEqual(0);
    expect(result.answers).toHaveLength(0);
  });

  it('should calculate time taken correctly', async () => {
    const { userId, quizPackageId, questions } = await createTestData();

    // Create attempt with specific start time
    const startTime = new Date(Date.now() - 60000); // 1 minute ago
    const attempts = await db.insert(quizAttemptsTable)
      .values({
        user_id: userId,
        quiz_package_id: quizPackageId,
        status: 'IN_PROGRESS',
        score: 0,
        total_questions: 3,
        current_question_index: 0,
        started_at: startTime,
        time_remaining_seconds: 7200
      })
      .returning()
      .execute();
    const attemptId = attempts[0].id;

    // Add one answer
    await db.insert(quizAnswersTable)
      .values([
        {
          attempt_id: attemptId,
          question_id: questions[0].id,
          selected_answer: 'B',
          is_correct: true
        }
      ])
      .execute();

    const input: CompleteQuizAttemptInput = {
      attempt_id: attemptId
    };

    const result = await completeQuizAttempt(input, userId);

    // Should have calculated time taken (should be around 60 seconds)
    expect(result.time_taken_seconds).toBeGreaterThanOrEqual(50);
    expect(result.time_taken_seconds).toBeLessThanOrEqual(70);
  });

  it('should handle all answer options correctly', async () => {
    const { userId, quizPackageId } = await createTestData();

    // Create questions with different correct answers
    const questions = await db.insert(quizQuestionsTable)
      .values([
        {
          quiz_package_id: quizPackageId,
          question_text: 'Option A question?',
          option_a: 'Correct',
          option_b: 'Wrong',
          option_c: 'Wrong',
          option_d: 'Wrong',
          option_e: 'Wrong',
          correct_answer: 'A',
          order_index: 10
        },
        {
          quiz_package_id: quizPackageId,
          question_text: 'Option E question?',
          option_a: 'Wrong',
          option_b: 'Wrong',
          option_c: 'Wrong',
          option_d: 'Wrong',
          option_e: 'Correct',
          correct_answer: 'E',
          order_index: 11
        }
      ])
      .returning()
      .execute();

    const attempts = await db.insert(quizAttemptsTable)
      .values({
        user_id: userId,
        quiz_package_id: quizPackageId,
        status: 'IN_PROGRESS',
        score: 0,
        total_questions: 2,
        current_question_index: 0,
        time_remaining_seconds: 7200
      })
      .returning()
      .execute();
    const attemptId = attempts[0].id;

    // Add answers for both options
    await db.insert(quizAnswersTable)
      .values([
        {
          attempt_id: attemptId,
          question_id: questions[0].id,
          selected_answer: 'A', // Correct
          is_correct: true
        },
        {
          attempt_id: attemptId,
          question_id: questions[1].id,
          selected_answer: 'E', // Correct
          is_correct: true
        }
      ])
      .execute();

    const input: CompleteQuizAttemptInput = {
      attempt_id: attemptId
    };

    const result = await completeQuizAttempt(input, userId);

    expect(result.score).toEqual(2);
    expect(result.correct_answers).toEqual(2);
    expect(result.incorrect_answers).toEqual(0);

    // Verify specific answer details
    const answerA = result.answers.find(a => a.correct_answer === 'A');
    const answerE = result.answers.find(a => a.correct_answer === 'E');

    expect(answerA).toBeDefined();
    expect(answerA!.selected_answer).toEqual('A');
    expect(answerA!.is_correct).toBe(true);
    expect(answerA!.option_a).toEqual('Correct');

    expect(answerE).toBeDefined();
    expect(answerE!.selected_answer).toEqual('E');
    expect(answerE!.is_correct).toBe(true);
    expect(answerE!.option_e).toEqual('Correct');
  });
});