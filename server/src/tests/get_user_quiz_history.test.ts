import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, quizPackagesTable, quizAttemptsTable } from '../db/schema';
import { getUserQuizHistory } from '../handlers/get_user_quiz_history';
import { eq } from 'drizzle-orm';

describe('getUserQuizHistory', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return quiz attempts for specific user ordered by created_at DESC', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'testuser@example.com',
        password_hash: 'hashed_password',
        role: 'USER',
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create quiz package
    const packageResult = await db.insert(quizPackagesTable)
      .values({
        title: 'Test Quiz Package',
        description: 'A test quiz package',
        created_by: userId,
      })
      .returning()
      .execute();

    const quizPackageId = packageResult[0].id;

    // Create multiple quiz attempts with different timestamps
    const attempt1Result = await db.insert(quizAttemptsTable)
      .values({
        user_id: userId,
        quiz_package_id: quizPackageId,
        status: 'COMPLETED',
        score: 80,
        total_questions: 10,
        current_question_index: 10,
        time_remaining_seconds: 1800,
      })
      .returning()
      .execute();

    // Wait a bit to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const attempt2Result = await db.insert(quizAttemptsTable)
      .values({
        user_id: userId,
        quiz_package_id: quizPackageId,
        status: 'IN_PROGRESS',
        score: 40,
        total_questions: 10,
        current_question_index: 4,
        time_remaining_seconds: 3600,
      })
      .returning()
      .execute();

    const result = await getUserQuizHistory(userId);

    // Should return 2 attempts
    expect(result).toHaveLength(2);

    // Should be ordered by created_at DESC (most recent first)
    expect(result[0].id).toEqual(attempt2Result[0].id); // More recent
    expect(result[1].id).toEqual(attempt1Result[0].id); // Older

    // Verify first attempt data
    expect(result[0].user_id).toEqual(userId);
    expect(result[0].quiz_package_id).toEqual(quizPackageId);
    expect(result[0].status).toEqual('IN_PROGRESS');
    expect(result[0].score).toEqual(40);
    expect(result[0].total_questions).toEqual(10);
    expect(result[0].current_question_index).toEqual(4);
    expect(result[0].time_remaining_seconds).toEqual(3600);
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);

    // Verify second attempt data
    expect(result[1].user_id).toEqual(userId);
    expect(result[1].status).toEqual('COMPLETED');
    expect(result[1].score).toEqual(80);
  });

  it('should return empty array for user with no quiz attempts', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'noattempts@example.com',
        password_hash: 'hashed_password',
        role: 'USER',
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    const result = await getUserQuizHistory(userId);

    expect(result).toEqual([]);
  });

  it('should only return attempts for the specified user', async () => {
    // Create two test users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        password_hash: 'hashed_password',
        role: 'USER',
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        password_hash: 'hashed_password',
        role: 'USER',
      })
      .returning()
      .execute();

    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;

    // Create quiz package
    const packageResult = await db.insert(quizPackagesTable)
      .values({
        title: 'Test Quiz Package',
        description: 'A test quiz package',
        created_by: user1Id,
      })
      .returning()
      .execute();

    const quizPackageId = packageResult[0].id;

    // Create quiz attempts for both users
    await db.insert(quizAttemptsTable)
      .values({
        user_id: user1Id,
        quiz_package_id: quizPackageId,
        status: 'COMPLETED',
        score: 90,
        total_questions: 10,
        current_question_index: 10,
        time_remaining_seconds: 1200,
      })
      .execute();

    await db.insert(quizAttemptsTable)
      .values({
        user_id: user2Id,
        quiz_package_id: quizPackageId,
        status: 'COMPLETED',
        score: 70,
        total_questions: 10,
        current_question_index: 10,
        time_remaining_seconds: 1500,
      })
      .execute();

    await db.insert(quizAttemptsTable)
      .values({
        user_id: user1Id,
        quiz_package_id: quizPackageId,
        status: 'IN_PROGRESS',
        score: 20,
        total_questions: 10,
        current_question_index: 2,
        time_remaining_seconds: 6000,
      })
      .execute();

    // Get history for user1
    const user1History = await getUserQuizHistory(user1Id);

    // Should only return attempts for user1
    expect(user1History).toHaveLength(2);
    user1History.forEach(attempt => {
      expect(attempt.user_id).toEqual(user1Id);
    });

    // Verify attempts are ordered by created_at DESC
    expect(user1History[0].score).toEqual(20); // More recent
    expect(user1History[1].score).toEqual(90); // Older

    // Get history for user2
    const user2History = await getUserQuizHistory(user2Id);

    // Should only return attempts for user2
    expect(user2History).toHaveLength(1);
    expect(user2History[0].user_id).toEqual(user2Id);
    expect(user2History[0].score).toEqual(70);
  });

  it('should handle various quiz attempt statuses correctly', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'statustest@example.com',
        password_hash: 'hashed_password',
        role: 'USER',
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create quiz package
    const packageResult = await db.insert(quizPackagesTable)
      .values({
        title: 'Status Test Quiz',
        description: 'Testing different statuses',
        created_by: userId,
      })
      .returning()
      .execute();

    const quizPackageId = packageResult[0].id;

    // Create attempts with different statuses
    await db.insert(quizAttemptsTable)
      .values({
        user_id: userId,
        quiz_package_id: quizPackageId,
        status: 'COMPLETED',
        score: 85,
        total_questions: 10,
        current_question_index: 10,
        completed_at: new Date(),
        time_remaining_seconds: 0,
      })
      .execute();

    await db.insert(quizAttemptsTable)
      .values({
        user_id: userId,
        quiz_package_id: quizPackageId,
        status: 'IN_PROGRESS',
        score: 30,
        total_questions: 10,
        current_question_index: 3,
        time_remaining_seconds: 4500,
      })
      .execute();

    await db.insert(quizAttemptsTable)
      .values({
        user_id: userId,
        quiz_package_id: quizPackageId,
        status: 'TIME_OUT',
        score: 50,
        total_questions: 10,
        current_question_index: 5,
        completed_at: new Date(),
        time_remaining_seconds: 0,
      })
      .execute();

    const result = await getUserQuizHistory(userId);

    expect(result).toHaveLength(3);

    // Verify all statuses are present
    const statuses = result.map(attempt => attempt.status);
    expect(statuses).toContain('COMPLETED');
    expect(statuses).toContain('IN_PROGRESS');
    expect(statuses).toContain('TIME_OUT');

    // Verify completed_at is handled correctly
    const completedAttempts = result.filter(attempt => 
      attempt.status === 'COMPLETED' || attempt.status === 'TIME_OUT'
    );
    completedAttempts.forEach(attempt => {
      expect(attempt.completed_at).toBeInstanceOf(Date);
    });

    const inProgressAttempts = result.filter(attempt => 
      attempt.status === 'IN_PROGRESS'
    );
    inProgressAttempts.forEach(attempt => {
      expect(attempt.completed_at).toBeNull();
    });
  });

  it('should persist attempts in database correctly', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'persist@example.com',
        password_hash: 'hashed_password',
        role: 'USER',
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create quiz package
    const packageResult = await db.insert(quizPackagesTable)
      .values({
        title: 'Persistence Test Quiz',
        description: 'Testing database persistence',
        created_by: userId,
      })
      .returning()
      .execute();

    const quizPackageId = packageResult[0].id;

    // Create quiz attempt
    const attemptResult = await db.insert(quizAttemptsTable)
      .values({
        user_id: userId,
        quiz_package_id: quizPackageId,
        status: 'COMPLETED',
        score: 75,
        total_questions: 15,
        current_question_index: 15,
        time_remaining_seconds: 900,
      })
      .returning()
      .execute();

    // Verify the attempt was created in database
    const dbAttempts = await db.select()
      .from(quizAttemptsTable)
      .where(eq(quizAttemptsTable.id, attemptResult[0].id))
      .execute();

    expect(dbAttempts).toHaveLength(1);
    expect(dbAttempts[0].user_id).toEqual(userId);
    expect(dbAttempts[0].score).toEqual(75);
    expect(dbAttempts[0].total_questions).toEqual(15);

    // Get history and verify it matches database
    const result = await getUserQuizHistory(userId);

    expect(result).toHaveLength(1);
    expect(result[0].id).toEqual(attemptResult[0].id);
    expect(result[0].user_id).toEqual(userId);
    expect(result[0].quiz_package_id).toEqual(quizPackageId);
    expect(result[0].score).toEqual(75);
    expect(result[0].total_questions).toEqual(15);
    expect(result[0].current_question_index).toEqual(15);
    expect(result[0].time_remaining_seconds).toEqual(900);
    expect(result[0].status).toEqual('COMPLETED');
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
  });
});