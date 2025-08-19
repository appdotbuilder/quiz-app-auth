import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { quizQuestionsTable, quizPackagesTable, usersTable } from '../db/schema';
import { type CreateQuizQuestionInput } from '../schema';
import { createQuizQuestion } from '../handlers/create_quiz_question';
import { eq, and } from 'drizzle-orm';

// Test data setup
const testUser = {
  email: 'admin@test.com',
  password_hash: 'hashedpassword',
  role: 'ADMIN' as const,
};

const testQuizPackage = {
  title: 'Test Quiz Package',
  description: 'A test quiz package',
  created_by: 1, // Will be updated with actual user ID
};

const testQuestionInput: CreateQuizQuestionInput = {
  quiz_package_id: 1, // Will be updated with actual package ID
  question_text: 'What is the capital of France?',
  option_a: 'London',
  option_b: 'Berlin',
  option_c: 'Paris',
  option_d: 'Madrid',
  option_e: 'Rome',
  correct_answer: 'C',
  order_index: 1,
};

describe('createQuizQuestion', () => {
  let userId: number;
  let quizPackageId: number;

  beforeEach(async () => {
    await createDB();

    // Create a test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create a test quiz package
    const packageResult = await db.insert(quizPackagesTable)
      .values({
        ...testQuizPackage,
        created_by: userId,
      })
      .returning()
      .execute();
    quizPackageId = packageResult[0].id;

    // Update test input with actual IDs
    testQuestionInput.quiz_package_id = quizPackageId;
  });

  afterEach(resetDB);

  it('should create a quiz question successfully', async () => {
    const result = await createQuizQuestion(testQuestionInput);

    // Verify the returned data
    expect(result.quiz_package_id).toEqual(quizPackageId);
    expect(result.question_text).toEqual('What is the capital of France?');
    expect(result.option_a).toEqual('London');
    expect(result.option_b).toEqual('Berlin');
    expect(result.option_c).toEqual('Paris');
    expect(result.option_d).toEqual('Madrid');
    expect(result.option_e).toEqual('Rome');
    expect(result.correct_answer).toEqual('C');
    expect(result.order_index).toEqual(1);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save quiz question to database', async () => {
    const result = await createQuizQuestion(testQuestionInput);

    // Query the database to verify the question was saved
    const savedQuestions = await db.select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.id, result.id))
      .execute();

    expect(savedQuestions).toHaveLength(1);
    const savedQuestion = savedQuestions[0];
    expect(savedQuestion.quiz_package_id).toEqual(quizPackageId);
    expect(savedQuestion.question_text).toEqual('What is the capital of France?');
    expect(savedQuestion.option_c).toEqual('Paris');
    expect(savedQuestion.correct_answer).toEqual('C');
    expect(savedQuestion.order_index).toEqual(1);
  });

  it('should throw error when quiz package does not exist', async () => {
    const invalidInput = {
      ...testQuestionInput,
      quiz_package_id: 99999, // Non-existent package ID
    };

    await expect(createQuizQuestion(invalidInput)).rejects.toThrow(/quiz package not found/i);
  });

  it('should throw error when order_index already exists for the package', async () => {
    // Create first question
    await createQuizQuestion(testQuestionInput);

    // Try to create another question with the same order_index
    const duplicateOrderInput = {
      ...testQuestionInput,
      question_text: 'Another question',
      order_index: 1, // Same order_index
    };

    await expect(createQuizQuestion(duplicateOrderInput)).rejects.toThrow(/order index already exists/i);
  });

  it('should allow different order_index values for the same package', async () => {
    // Create first question
    await createQuizQuestion(testQuestionInput);

    // Create second question with different order_index
    const secondQuestionInput = {
      ...testQuestionInput,
      question_text: 'What is 2 + 2?',
      option_a: '3',
      option_b: '4',
      option_c: '5',
      option_d: '6',
      option_e: '7',
      correct_answer: 'B' as const,
      order_index: 2,
    };

    const result = await createQuizQuestion(secondQuestionInput);
    expect(result.order_index).toEqual(2);
    expect(result.question_text).toEqual('What is 2 + 2?');

    // Verify both questions exist in database
    const allQuestions = await db.select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.quiz_package_id, quizPackageId))
      .execute();

    expect(allQuestions).toHaveLength(2);
  });

  it('should allow same order_index for different quiz packages', async () => {
    // Create second quiz package
    const secondPackageResult = await db.insert(quizPackagesTable)
      .values({
        title: 'Second Quiz Package',
        description: 'Another test package',
        created_by: userId,
      })
      .returning()
      .execute();
    const secondPackageId = secondPackageResult[0].id;

    // Create question in first package
    await createQuizQuestion(testQuestionInput);

    // Create question in second package with same order_index
    const secondPackageQuestionInput = {
      ...testQuestionInput,
      quiz_package_id: secondPackageId,
      question_text: 'Different question for second package',
    };

    const result = await createQuizQuestion(secondPackageQuestionInput);
    expect(result.quiz_package_id).toEqual(secondPackageId);
    expect(result.order_index).toEqual(1); // Same order_index, different package
  });

  it('should throw error when trying to exceed 110 questions limit', async () => {
    // Create 110 questions (simulating the limit)
    const promises = [];
    for (let i = 1; i <= 110; i++) {
      promises.push(
        db.insert(quizQuestionsTable)
          .values({
            quiz_package_id: quizPackageId,
            question_text: `Question ${i}`,
            option_a: 'A',
            option_b: 'B',
            option_c: 'C',
            option_d: 'D',
            option_e: 'E',
            correct_answer: 'A',
            order_index: i,
          })
          .execute()
      );
    }
    await Promise.all(promises);

    // Try to add the 111th question
    const exceededLimitInput = {
      ...testQuestionInput,
      order_index: 111,
    };

    await expect(createQuizQuestion(exceededLimitInput)).rejects.toThrow(/cannot have more than 110 questions/i);
  });

  it('should handle all question option enums correctly', async () => {
    const questionInputs = [
      { ...testQuestionInput, correct_answer: 'A' as const, order_index: 1 },
      { ...testQuestionInput, correct_answer: 'B' as const, order_index: 2 },
      { ...testQuestionInput, correct_answer: 'C' as const, order_index: 3 },
      { ...testQuestionInput, correct_answer: 'D' as const, order_index: 4 },
      { ...testQuestionInput, correct_answer: 'E' as const, order_index: 5 },
    ];

    const results = await Promise.all(
      questionInputs.map(input => createQuizQuestion(input))
    );

    expect(results).toHaveLength(5);
    expect(results[0].correct_answer).toEqual('A');
    expect(results[1].correct_answer).toEqual('B');
    expect(results[2].correct_answer).toEqual('C');
    expect(results[3].correct_answer).toEqual('D');
    expect(results[4].correct_answer).toEqual('E');
  });
});