import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, quizPackagesTable, quizQuestionsTable } from '../db/schema';
import { type UpdateQuizQuestionInput, type CreateQuizQuestionInput } from '../schema';
import { updateQuizQuestion } from '../handlers/update_quiz_question';
import { eq } from 'drizzle-orm';

// Test data setup
const testUser = {
  email: 'admin@test.com',
  password_hash: 'hashedpassword',
  role: 'ADMIN' as const,
};

const testQuizPackage = {
  title: 'Test Quiz Package',
  description: 'A package for testing',
  created_by: 1,
};

const testQuestion = {
  quiz_package_id: 1,
  question_text: 'Original question?',
  option_a: 'Original A',
  option_b: 'Original B',
  option_c: 'Original C',
  option_d: 'Original D',
  option_e: 'Original E',
  correct_answer: 'A' as const,
  order_index: 0,
};

const setupTestData = async () => {
  // Create user
  await db.insert(usersTable).values(testUser).execute();
  
  // Create quiz package
  await db.insert(quizPackagesTable).values(testQuizPackage).execute();
  
  // Create test question
  const questionResult = await db.insert(quizQuestionsTable)
    .values(testQuestion)
    .returning()
    .execute();
  
  return questionResult[0];
};

describe('updateQuizQuestion', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update a quiz question with all fields', async () => {
    const question = await setupTestData();
    
    const updateInput: UpdateQuizQuestionInput = {
      id: question.id,
      question_text: 'Updated question?',
      option_a: 'Updated A',
      option_b: 'Updated B',
      option_c: 'Updated C',
      option_d: 'Updated D',
      option_e: 'Updated E',
      correct_answer: 'B',
      order_index: 1,
    };

    const result = await updateQuizQuestion(updateInput);

    expect(result.id).toEqual(question.id);
    expect(result.question_text).toEqual('Updated question?');
    expect(result.option_a).toEqual('Updated A');
    expect(result.option_b).toEqual('Updated B');
    expect(result.option_c).toEqual('Updated C');
    expect(result.option_d).toEqual('Updated D');
    expect(result.option_e).toEqual('Updated E');
    expect(result.correct_answer).toEqual('B');
    expect(result.order_index).toEqual(1);
    expect(result.quiz_package_id).toEqual(question.quiz_package_id);
    expect(result.created_at).toEqual(question.created_at);
    expect(result.updated_at).not.toEqual(question.updated_at);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should update only specified fields (partial update)', async () => {
    const question = await setupTestData();
    
    const updateInput: UpdateQuizQuestionInput = {
      id: question.id,
      question_text: 'Partially updated question?',
      correct_answer: 'C',
    };

    const result = await updateQuizQuestion(updateInput);

    expect(result.id).toEqual(question.id);
    expect(result.question_text).toEqual('Partially updated question?');
    expect(result.correct_answer).toEqual('C');
    // These should remain unchanged
    expect(result.option_a).toEqual('Original A');
    expect(result.option_b).toEqual('Original B');
    expect(result.option_c).toEqual('Original C');
    expect(result.option_d).toEqual('Original D');
    expect(result.option_e).toEqual('Original E');
    expect(result.order_index).toEqual(0);
  });

  it('should save updates to database', async () => {
    const question = await setupTestData();
    
    const updateInput: UpdateQuizQuestionInput = {
      id: question.id,
      question_text: 'Database updated question?',
      option_a: 'DB Updated A',
    };

    await updateQuizQuestion(updateInput);

    // Verify in database
    const updatedQuestion = await db.select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.id, question.id))
      .execute();

    expect(updatedQuestion).toHaveLength(1);
    expect(updatedQuestion[0].question_text).toEqual('Database updated question?');
    expect(updatedQuestion[0].option_a).toEqual('DB Updated A');
    expect(updatedQuestion[0].option_b).toEqual('Original B'); // Unchanged
    expect(updatedQuestion[0].updated_at).not.toEqual(question.updated_at);
  });

  it('should update order_index when no conflicts exist', async () => {
    const question = await setupTestData();
    
    const updateInput: UpdateQuizQuestionInput = {
      id: question.id,
      order_index: 5,
    };

    const result = await updateQuizQuestion(updateInput);

    expect(result.order_index).toEqual(5);
    expect(result.updated_at).not.toEqual(question.updated_at);
  });

  it('should throw error when question does not exist', async () => {
    await setupTestData();
    
    const updateInput: UpdateQuizQuestionInput = {
      id: 999, // Non-existent ID
      question_text: 'This should fail',
    };

    expect(updateQuizQuestion(updateInput)).rejects.toThrow(/question with id 999 not found/i);
  });

  it('should throw error when order_index conflicts with existing question', async () => {
    const question1 = await setupTestData();
    
    // Create second question with order_index 1
    const question2 = await db.insert(quizQuestionsTable)
      .values({
        ...testQuestion,
        question_text: 'Second question?',
        order_index: 1,
      })
      .returning()
      .execute();

    const updateInput: UpdateQuizQuestionInput = {
      id: question1.id,
      order_index: 1, // This conflicts with question2
    };

    expect(updateQuizQuestion(updateInput)).rejects.toThrow(/order index 1 already exists/i);
  });

  it('should allow updating order_index to same value (no conflict)', async () => {
    const question = await setupTestData();
    
    const updateInput: UpdateQuizQuestionInput = {
      id: question.id,
      order_index: 0, // Same as current value
      question_text: 'Same order index update',
    };

    const result = await updateQuizQuestion(updateInput);

    expect(result.order_index).toEqual(0);
    expect(result.question_text).toEqual('Same order index update');
  });

  it('should handle all question option enum values', async () => {
    const question = await setupTestData();
    
    const correctAnswers = ['A', 'B', 'C', 'D', 'E'] as const;
    
    for (const answer of correctAnswers) {
      const updateInput: UpdateQuizQuestionInput = {
        id: question.id,
        correct_answer: answer,
      };

      const result = await updateQuizQuestion(updateInput);
      expect(result.correct_answer).toEqual(answer);
    }
  });

  it('should handle questions from different quiz packages (no order conflict)', async () => {
    const question1 = await setupTestData();
    
    // Create second quiz package
    const package2 = await db.insert(quizPackagesTable)
      .values({
        title: 'Second Quiz Package',
        description: 'Another package',
        created_by: 1,
      })
      .returning()
      .execute();

    // Create question in second package with same order_index
    const question2 = await db.insert(quizQuestionsTable)
      .values({
        ...testQuestion,
        quiz_package_id: package2[0].id,
        question_text: 'Question in second package?',
        order_index: 0, // Same order_index but different package
      })
      .returning()
      .execute();

    // Should be able to update order_index in first package without conflict
    const updateInput: UpdateQuizQuestionInput = {
      id: question1.id,
      order_index: 0, // This is fine since it's in a different package context
      question_text: 'Updated in first package',
    };

    const result = await updateQuizQuestion(updateInput);
    expect(result.order_index).toEqual(0);
    expect(result.question_text).toEqual('Updated in first package');
  });
});