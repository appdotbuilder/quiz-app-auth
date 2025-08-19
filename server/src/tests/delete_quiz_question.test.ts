import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, quizPackagesTable, quizQuestionsTable, quizAnswersTable, quizAttemptsTable } from '../db/schema';
import { deleteQuizQuestion } from '../handlers/delete_quiz_question';
import { eq, asc } from 'drizzle-orm';

describe('deleteQuizQuestion', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should delete a quiz question successfully', async () => {
    // Create test user
    const users = await db.insert(usersTable)
      .values({
        email: 'admin@test.com',
        password_hash: 'hashedpassword',
        role: 'ADMIN'
      })
      .returning()
      .execute();

    const userId = users[0].id;

    // Create quiz package
    const packages = await db.insert(quizPackagesTable)
      .values({
        title: 'Test Quiz Package',
        description: 'A test quiz package',
        created_by: userId
      })
      .returning()
      .execute();

    const packageId = packages[0].id;

    // Create multiple questions with different order_index values
    const questions = await db.insert(quizQuestionsTable)
      .values([
        {
          quiz_package_id: packageId,
          question_text: 'Question 1',
          option_a: 'A1',
          option_b: 'B1',
          option_c: 'C1',
          option_d: 'D1',
          option_e: 'E1',
          correct_answer: 'A',
          order_index: 0
        },
        {
          quiz_package_id: packageId,
          question_text: 'Question 2',
          option_a: 'A2',
          option_b: 'B2',
          option_c: 'C2',
          option_d: 'D2',
          option_e: 'E2',
          correct_answer: 'B',
          order_index: 1
        },
        {
          quiz_package_id: packageId,
          question_text: 'Question 3',
          option_a: 'A3',
          option_b: 'B3',
          option_c: 'C3',
          option_d: 'D3',
          option_e: 'E3',
          correct_answer: 'C',
          order_index: 2
        }
      ])
      .returning()
      .execute();

    const questionToDeleteId = questions[1].id; // Middle question (order_index: 1)

    // Delete the middle question
    const result = await deleteQuizQuestion(questionToDeleteId);

    expect(result.success).toBe(true);

    // Verify question was deleted
    const deletedQuestion = await db.select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.id, questionToDeleteId))
      .execute();

    expect(deletedQuestion).toHaveLength(0);

    // Verify remaining questions and their reordered indices
    const remainingQuestions = await db.select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.quiz_package_id, packageId))
      .orderBy(asc(quizQuestionsTable.order_index))
      .execute();

    expect(remainingQuestions).toHaveLength(2);
    expect(remainingQuestions[0].question_text).toBe('Question 1');
    expect(remainingQuestions[0].order_index).toBe(0); // Should remain unchanged
    expect(remainingQuestions[1].question_text).toBe('Question 3');
    expect(remainingQuestions[1].order_index).toBe(1); // Should be decremented from 2 to 1
  });

  it('should delete related quiz answers when deleting a question', async () => {
    // Create test data
    const users = await db.insert(usersTable)
      .values({
        email: 'user@test.com',
        password_hash: 'hashedpassword',
        role: 'USER'
      })
      .returning()
      .execute();

    const userId = users[0].id;

    const packages = await db.insert(quizPackagesTable)
      .values({
        title: 'Test Quiz Package',
        description: 'A test quiz package',
        created_by: userId
      })
      .returning()
      .execute();

    const packageId = packages[0].id;

    const questions = await db.insert(quizQuestionsTable)
      .values({
        quiz_package_id: packageId,
        question_text: 'Test Question',
        option_a: 'A',
        option_b: 'B',
        option_c: 'C',
        option_d: 'D',
        option_e: 'E',
        correct_answer: 'A',
        order_index: 0
      })
      .returning()
      .execute();

    const questionId = questions[0].id;

    // Create a quiz attempt
    const attempts = await db.insert(quizAttemptsTable)
      .values({
        user_id: userId,
        quiz_package_id: packageId,
        status: 'IN_PROGRESS',
        total_questions: 1,
        current_question_index: 0
      })
      .returning()
      .execute();

    const attemptId = attempts[0].id;

    // Create quiz answer
    await db.insert(quizAnswersTable)
      .values({
        attempt_id: attemptId,
        question_id: questionId,
        selected_answer: 'A',
        is_correct: true
      })
      .execute();

    // Verify answer exists before deletion
    const answersBefore = await db.select()
      .from(quizAnswersTable)
      .where(eq(quizAnswersTable.question_id, questionId))
      .execute();

    expect(answersBefore).toHaveLength(1);

    // Delete the question
    const result = await deleteQuizQuestion(questionId);

    expect(result.success).toBe(true);

    // Verify related answers are deleted
    const answersAfter = await db.select()
      .from(quizAnswersTable)
      .where(eq(quizAnswersTable.question_id, questionId))
      .execute();

    expect(answersAfter).toHaveLength(0);
  });

  it('should throw error when question does not exist', async () => {
    const nonExistentId = 999999;

    await expect(deleteQuizQuestion(nonExistentId))
      .rejects
      .toThrow(/Question not found/i);
  });

  it('should handle deleting first question correctly', async () => {
    // Create test user and package
    const users = await db.insert(usersTable)
      .values({
        email: 'admin@test.com',
        password_hash: 'hashedpassword',
        role: 'ADMIN'
      })
      .returning()
      .execute();

    const userId = users[0].id;

    const packages = await db.insert(quizPackagesTable)
      .values({
        title: 'Test Quiz Package',
        description: 'A test quiz package',
        created_by: userId
      })
      .returning()
      .execute();

    const packageId = packages[0].id;

    // Create questions
    const questions = await db.insert(quizQuestionsTable)
      .values([
        {
          quiz_package_id: packageId,
          question_text: 'First Question',
          option_a: 'A1',
          option_b: 'B1',
          option_c: 'C1',
          option_d: 'D1',
          option_e: 'E1',
          correct_answer: 'A',
          order_index: 0
        },
        {
          quiz_package_id: packageId,
          question_text: 'Second Question',
          option_a: 'A2',
          option_b: 'B2',
          option_c: 'C2',
          option_d: 'D2',
          option_e: 'E2',
          correct_answer: 'B',
          order_index: 1
        }
      ])
      .returning()
      .execute();

    const firstQuestionId = questions[0].id;

    // Delete first question
    const result = await deleteQuizQuestion(firstQuestionId);

    expect(result.success).toBe(true);

    // Verify remaining question has correct order_index
    const remainingQuestions = await db.select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.quiz_package_id, packageId))
      .execute();

    expect(remainingQuestions).toHaveLength(1);
    expect(remainingQuestions[0].question_text).toBe('Second Question');
    expect(remainingQuestions[0].order_index).toBe(0); // Should be decremented from 1 to 0
  });

  it('should handle deleting last question correctly', async () => {
    // Create test user and package
    const users = await db.insert(usersTable)
      .values({
        email: 'admin@test.com',
        password_hash: 'hashedpassword',
        role: 'ADMIN'
      })
      .returning()
      .execute();

    const userId = users[0].id;

    const packages = await db.insert(quizPackagesTable)
      .values({
        title: 'Test Quiz Package',
        description: 'A test quiz package',
        created_by: userId
      })
      .returning()
      .execute();

    const packageId = packages[0].id;

    // Create questions
    const questions = await db.insert(quizQuestionsTable)
      .values([
        {
          quiz_package_id: packageId,
          question_text: 'First Question',
          option_a: 'A1',
          option_b: 'B1',
          option_c: 'C1',
          option_d: 'D1',
          option_e: 'E1',
          correct_answer: 'A',
          order_index: 0
        },
        {
          quiz_package_id: packageId,
          question_text: 'Last Question',
          option_a: 'A2',
          option_b: 'B2',
          option_c: 'C2',
          option_d: 'D2',
          option_e: 'E2',
          correct_answer: 'B',
          order_index: 1
        }
      ])
      .returning()
      .execute();

    const lastQuestionId = questions[1].id;

    // Delete last question
    const result = await deleteQuizQuestion(lastQuestionId);

    expect(result.success).toBe(true);

    // Verify remaining question order_index is unchanged
    const remainingQuestions = await db.select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.quiz_package_id, packageId))
      .execute();

    expect(remainingQuestions).toHaveLength(1);
    expect(remainingQuestions[0].question_text).toBe('First Question');
    expect(remainingQuestions[0].order_index).toBe(0); // Should remain unchanged
  });

  it('should handle deleting single question correctly', async () => {
    // Create test user and package
    const users = await db.insert(usersTable)
      .values({
        email: 'admin@test.com',
        password_hash: 'hashedpassword',
        role: 'ADMIN'
      })
      .returning()
      .execute();

    const userId = users[0].id;

    const packages = await db.insert(quizPackagesTable)
      .values({
        title: 'Test Quiz Package',
        description: 'A test quiz package',
        created_by: userId
      })
      .returning()
      .execute();

    const packageId = packages[0].id;

    // Create single question
    const questions = await db.insert(quizQuestionsTable)
      .values({
        quiz_package_id: packageId,
        question_text: 'Only Question',
        option_a: 'A',
        option_b: 'B',
        option_c: 'C',
        option_d: 'D',
        option_e: 'E',
        correct_answer: 'A',
        order_index: 0
      })
      .returning()
      .execute();

    const questionId = questions[0].id;

    // Delete the only question
    const result = await deleteQuizQuestion(questionId);

    expect(result.success).toBe(true);

    // Verify no questions remain
    const remainingQuestions = await db.select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.quiz_package_id, packageId))
      .execute();

    expect(remainingQuestions).toHaveLength(0);
  });
});