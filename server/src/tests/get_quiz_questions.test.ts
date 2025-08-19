import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, quizPackagesTable, quizQuestionsTable } from '../db/schema';
import { type CreateQuizQuestionInput } from '../schema';
import { getQuizQuestions } from '../handlers/get_quiz_questions';

// Test data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashed_password',
  role: 'ADMIN' as const,
};

const testQuizPackage = {
  title: 'Test Quiz Package',
  description: 'A test quiz package',
};

const testQuestions: CreateQuizQuestionInput[] = [
  {
    quiz_package_id: 0, // Will be set after quiz package creation
    question_text: 'What is 2+2?',
    option_a: '3',
    option_b: '4',
    option_c: '5',
    option_d: '6',
    option_e: '7',
    correct_answer: 'B',
    order_index: 1,
  },
  {
    quiz_package_id: 0, // Will be set after quiz package creation
    question_text: 'What is the capital of France?',
    option_a: 'London',
    option_b: 'Berlin',
    option_c: 'Paris',
    option_d: 'Madrid',
    option_e: 'Rome',
    correct_answer: 'C',
    order_index: 0, // Lower index to test ordering
  },
  {
    quiz_package_id: 0, // Will be set after quiz package creation
    question_text: 'What is 5*3?',
    option_a: '10',
    option_b: '12',
    option_c: '15',
    option_d: '18',
    option_e: '20',
    correct_answer: 'C',
    order_index: 2,
  },
];

describe('getQuizQuestions', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should fetch questions for a valid quiz package', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const quizPackageResult = await db.insert(quizPackagesTable)
      .values({
        ...testQuizPackage,
        created_by: userResult[0].id,
      })
      .returning()
      .execute();

    // Create questions with the correct quiz_package_id
    const questionsToInsert = testQuestions.map(q => ({
      ...q,
      quiz_package_id: quizPackageResult[0].id,
    }));

    await db.insert(quizQuestionsTable)
      .values(questionsToInsert)
      .execute();

    // Test the handler
    const result = await getQuizQuestions(quizPackageResult[0].id);

    // Verify results
    expect(result).toHaveLength(3);
    
    // Verify ordering by order_index (ascending)
    expect(result[0].question_text).toEqual('What is the capital of France?');
    expect(result[0].order_index).toEqual(0);
    
    expect(result[1].question_text).toEqual('What is 2+2?');
    expect(result[1].order_index).toEqual(1);
    
    expect(result[2].question_text).toEqual('What is 5*3?');
    expect(result[2].order_index).toEqual(2);

    // Verify all fields are present
    result.forEach(question => {
      expect(question.id).toBeDefined();
      expect(question.quiz_package_id).toEqual(quizPackageResult[0].id);
      expect(question.question_text).toBeDefined();
      expect(question.option_a).toBeDefined();
      expect(question.option_b).toBeDefined();
      expect(question.option_c).toBeDefined();
      expect(question.option_d).toBeDefined();
      expect(question.option_e).toBeDefined();
      expect(question.correct_answer).toBeDefined();
      expect(question.order_index).toBeDefined();
      expect(question.created_at).toBeInstanceOf(Date);
      expect(question.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should return empty array for quiz package with no questions', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const quizPackageResult = await db.insert(quizPackagesTable)
      .values({
        ...testQuizPackage,
        created_by: userResult[0].id,
      })
      .returning()
      .execute();

    // Test the handler
    const result = await getQuizQuestions(quizPackageResult[0].id);

    // Verify results
    expect(result).toHaveLength(0);
    expect(result).toEqual([]);
  });

  it('should throw error for non-existent quiz package', async () => {
    const nonExistentId = 999;

    // Test the handler
    await expect(getQuizQuestions(nonExistentId))
      .rejects.toThrow(/quiz package not found/i);
  });

  it('should fetch questions with correct data types', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const quizPackageResult = await db.insert(quizPackagesTable)
      .values({
        ...testQuizPackage,
        created_by: userResult[0].id,
      })
      .returning()
      .execute();

    // Create a single question
    await db.insert(quizQuestionsTable)
      .values({
        quiz_package_id: quizPackageResult[0].id,
        question_text: 'Test question?',
        option_a: 'A',
        option_b: 'B',
        option_c: 'C',
        option_d: 'D',
        option_e: 'E',
        correct_answer: 'A',
        order_index: 0,
      })
      .execute();

    // Test the handler
    const result = await getQuizQuestions(quizPackageResult[0].id);

    // Verify data types
    expect(result).toHaveLength(1);
    const question = result[0];
    
    expect(typeof question.id).toBe('number');
    expect(typeof question.quiz_package_id).toBe('number');
    expect(typeof question.question_text).toBe('string');
    expect(typeof question.option_a).toBe('string');
    expect(typeof question.option_b).toBe('string');
    expect(typeof question.option_c).toBe('string');
    expect(typeof question.option_d).toBe('string');
    expect(typeof question.option_e).toBe('string');
    expect(['A', 'B', 'C', 'D', 'E']).toContain(question.correct_answer);
    expect(typeof question.order_index).toBe('number');
    expect(question.created_at).toBeInstanceOf(Date);
    expect(question.updated_at).toBeInstanceOf(Date);
  });

  it('should maintain correct order even with non-sequential order_index values', async () => {
    // Create prerequisite data
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    const quizPackageResult = await db.insert(quizPackagesTable)
      .values({
        ...testQuizPackage,
        created_by: userResult[0].id,
      })
      .returning()
      .execute();

    // Create questions with non-sequential order_index
    const nonSequentialQuestions = [
      {
        quiz_package_id: quizPackageResult[0].id,
        question_text: 'Question 3',
        option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D', option_e: 'E',
        correct_answer: 'A' as const,
        order_index: 10,
      },
      {
        quiz_package_id: quizPackageResult[0].id,
        question_text: 'Question 1',
        option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D', option_e: 'E',
        correct_answer: 'B' as const,
        order_index: 5,
      },
      {
        quiz_package_id: quizPackageResult[0].id,
        question_text: 'Question 2',
        option_a: 'A', option_b: 'B', option_c: 'C', option_d: 'D', option_e: 'E',
        correct_answer: 'C' as const,
        order_index: 8,
      },
    ];

    await db.insert(quizQuestionsTable)
      .values(nonSequentialQuestions)
      .execute();

    // Test the handler
    const result = await getQuizQuestions(quizPackageResult[0].id);

    // Verify ordering is correct (ascending by order_index)
    expect(result).toHaveLength(3);
    expect(result[0].question_text).toEqual('Question 1');
    expect(result[0].order_index).toEqual(5);
    
    expect(result[1].question_text).toEqual('Question 2');
    expect(result[1].order_index).toEqual(8);
    
    expect(result[2].question_text).toEqual('Question 3');
    expect(result[2].order_index).toEqual(10);
  });
});