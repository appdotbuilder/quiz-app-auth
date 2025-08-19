import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, quizPackagesTable, quizQuestionsTable, quizAttemptsTable, quizAnswersTable } from '../db/schema';
import { type SubmitQuizAnswerInput } from '../schema';
import { submitQuizAnswer } from '../handlers/submit_quiz_answer';
import { eq } from 'drizzle-orm';

describe('submitQuizAnswer', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let userId: number;
  let otherUserId: number;
  let quizPackageId: number;
  let question1Id: number;
  let question2Id: number;
  let attemptId: number;

  beforeEach(async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'test@example.com',
          password_hash: 'hashed_password',
          role: 'USER',
        },
        {
          email: 'other@example.com',
          password_hash: 'hashed_password',
          role: 'USER',
        }
      ])
      .returning()
      .execute();

    userId = users[0].id;
    otherUserId = users[1].id;

    // Create quiz package
    const quizPackages = await db.insert(quizPackagesTable)
      .values({
        title: 'Test Quiz',
        description: 'A test quiz',
        created_by: userId,
      })
      .returning()
      .execute();

    quizPackageId = quizPackages[0].id;

    // Create questions
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
          order_index: 0,
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
          order_index: 1,
        }
      ])
      .returning()
      .execute();

    question1Id = questions[0].id;
    question2Id = questions[1].id;

    // Create quiz attempt
    const attempts = await db.insert(quizAttemptsTable)
      .values({
        user_id: userId,
        quiz_package_id: quizPackageId,
        status: 'IN_PROGRESS',
        score: 0,
        total_questions: 2,
        current_question_index: 0,
        time_remaining_seconds: 7200,
      })
      .returning()
      .execute();

    attemptId = attempts[0].id;
  });

  it('should submit correct answer and advance to next question', async () => {
    const input: SubmitQuizAnswerInput = {
      attempt_id: attemptId,
      question_id: question1Id,
      selected_answer: 'B', // Correct answer
    };

    const result = await submitQuizAnswer(input, userId);

    // Check response
    expect(result.attempt_id).toBe(attemptId);
    expect(result.quiz_package_id).toBe(quizPackageId);
    expect(result.quiz_title).toBe('Test Quiz');
    expect(result.current_question_index).toBe(1);
    expect(result.total_questions).toBe(2);
    expect(result.time_remaining_seconds).toBeGreaterThan(0);
    expect(result.current_question).toBeDefined();
    expect(result.current_question?.id).toBe(question2Id);
    expect(result.current_question?.question_text).toBe('What is 3+3?');

    // Verify answer was recorded
    const answers = await db.select()
      .from(quizAnswersTable)
      .where(eq(quizAnswersTable.attempt_id, attemptId))
      .execute();

    expect(answers).toHaveLength(1);
    expect(answers[0].question_id).toBe(question1Id);
    expect(answers[0].selected_answer).toBe('B');
    expect(answers[0].is_correct).toBe(true);

    // Verify attempt was updated
    const attempts = await db.select()
      .from(quizAttemptsTable)
      .where(eq(quizAttemptsTable.id, attemptId))
      .execute();

    expect(attempts[0].score).toBe(1);
    expect(attempts[0].current_question_index).toBe(1);
    expect(attempts[0].status).toBe('IN_PROGRESS');
  });

  it('should submit incorrect answer and advance to next question', async () => {
    const input: SubmitQuizAnswerInput = {
      attempt_id: attemptId,
      question_id: question1Id,
      selected_answer: 'A', // Incorrect answer
    };

    const result = await submitQuizAnswer(input, userId);

    // Check response
    expect(result.current_question_index).toBe(1);
    expect(result.current_question?.id).toBe(question2Id);

    // Verify answer was recorded as incorrect
    const answers = await db.select()
      .from(quizAnswersTable)
      .where(eq(quizAnswersTable.attempt_id, attemptId))
      .execute();

    expect(answers[0].is_correct).toBe(false);

    // Verify score didn't increase
    const attempts = await db.select()
      .from(quizAttemptsTable)
      .where(eq(quizAttemptsTable.id, attemptId))
      .execute();

    expect(attempts[0].score).toBe(0);
  });

  it('should complete quiz when answering last question', async () => {
    // First, advance to the last question
    await db.update(quizAttemptsTable)
      .set({
        current_question_index: 1,
        score: 1,
      })
      .where(eq(quizAttemptsTable.id, attemptId))
      .execute();

    const input: SubmitQuizAnswerInput = {
      attempt_id: attemptId,
      question_id: question2Id,
      selected_answer: 'B', // Correct answer
    };

    const result = await submitQuizAnswer(input, userId);

    // Check response - should indicate completion
    expect(result.current_question_index).toBe(2);
    expect(result.current_question).toBeNull();

    // Verify attempt was completed
    const attempts = await db.select()
      .from(quizAttemptsTable)
      .where(eq(quizAttemptsTable.id, attemptId))
      .execute();

    expect(attempts[0].status).toBe('COMPLETED');
    expect(attempts[0].score).toBe(2);
    expect(attempts[0].completed_at).toBeInstanceOf(Date);
  });

  it('should reject submission for non-existent attempt', async () => {
    const input: SubmitQuizAnswerInput = {
      attempt_id: 99999,
      question_id: question1Id,
      selected_answer: 'B',
    };

    await expect(submitQuizAnswer(input, userId))
      .rejects.toThrow(/quiz attempt not found/i);
  });

  it('should reject submission for attempt belonging to other user', async () => {
    const input: SubmitQuizAnswerInput = {
      attempt_id: attemptId,
      question_id: question1Id,
      selected_answer: 'B',
    };

    await expect(submitQuizAnswer(input, otherUserId))
      .rejects.toThrow(/quiz attempt not found/i);
  });

  it('should reject submission for completed attempt', async () => {
    // Complete the attempt first
    await db.update(quizAttemptsTable)
      .set({
        status: 'COMPLETED',
        completed_at: new Date(),
      })
      .where(eq(quizAttemptsTable.id, attemptId))
      .execute();

    const input: SubmitQuizAnswerInput = {
      attempt_id: attemptId,
      question_id: question1Id,
      selected_answer: 'B',
    };

    await expect(submitQuizAnswer(input, userId))
      .rejects.toThrow(/quiz attempt not found/i);
  });

  it('should reject submission for wrong question ID', async () => {
    const input: SubmitQuizAnswerInput = {
      attempt_id: attemptId,
      question_id: question2Id, // Wrong question - should be question1Id
      selected_answer: 'B',
    };

    await expect(submitQuizAnswer(input, userId))
      .rejects.toThrow(/question id does not match/i);
  });

  it('should handle quiz with no questions', async () => {
    // Create quiz package with no questions
    const emptyQuizPackages = await db.insert(quizPackagesTable)
      .values({
        title: 'Empty Quiz',
        description: 'Quiz with no questions',
        created_by: userId,
      })
      .returning()
      .execute();

    const emptyQuizPackageId = emptyQuizPackages[0].id;

    // Create attempt for empty quiz
    const emptyAttempts = await db.insert(quizAttemptsTable)
      .values({
        user_id: userId,
        quiz_package_id: emptyQuizPackageId,
        status: 'IN_PROGRESS',
        score: 0,
        total_questions: 0,
        current_question_index: 0,
        time_remaining_seconds: 7200,
      })
      .returning()
      .execute();

    const emptyAttemptId = emptyAttempts[0].id;

    const input: SubmitQuizAnswerInput = {
      attempt_id: emptyAttemptId,
      question_id: question1Id,
      selected_answer: 'A',
    };

    await expect(submitQuizAnswer(input, userId))
      .rejects.toThrow(/no questions found/i);
  });

  it('should update time remaining correctly', async () => {
    // Mock started_at to be 60 seconds ago
    const pastTime = new Date();
    pastTime.setSeconds(pastTime.getSeconds() - 60);

    await db.update(quizAttemptsTable)
      .set({
        started_at: pastTime,
      })
      .where(eq(quizAttemptsTable.id, attemptId))
      .execute();

    const input: SubmitQuizAnswerInput = {
      attempt_id: attemptId,
      question_id: question1Id,
      selected_answer: 'B',
    };

    const result = await submitQuizAnswer(input, userId);

    // Time remaining should be less than original 7200 seconds
    expect(result.time_remaining_seconds).toBeLessThan(7200);
    expect(result.time_remaining_seconds).toBeGreaterThan(7100); // Should be around 7140
  });
});