import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, quizPackagesTable, quizQuestionsTable } from '../db/schema';
import { getQuizPackageById } from '../handlers/get_quiz_package_by_id';

describe('getQuizPackageById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return quiz package with question count when package exists', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        role: 'USER'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create a test quiz package
    const packageResult = await db.insert(quizPackagesTable)
      .values({
        title: 'Math Quiz',
        description: 'Basic math questions',
        created_by: userId
      })
      .returning()
      .execute();

    const packageId = packageResult[0].id;

    // Create test questions for the package
    await db.insert(quizQuestionsTable)
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
          question_text: 'What is 5 * 3?',
          option_a: '14',
          option_b: '15',
          option_c: '16',
          option_d: '17',
          option_e: '18',
          correct_answer: 'B',
          order_index: 1
        },
        {
          quiz_package_id: packageId,
          question_text: 'What is 10 / 2?',
          option_a: '4',
          option_b: '5',
          option_c: '6',
          option_d: '7',
          option_e: '8',
          correct_answer: 'B',
          order_index: 2
        }
      ])
      .execute();

    // Test the handler
    const result = await getQuizPackageById(packageId);

    // Verify the result
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(packageId);
    expect(result!.title).toEqual('Math Quiz');
    expect(result!.description).toEqual('Basic math questions');
    expect(result!.created_by).toEqual(userId);
    expect(result!.question_count).toEqual(3);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return quiz package with zero question count when package has no questions', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        role: 'ADMIN'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create a test quiz package without questions
    const packageResult = await db.insert(quizPackagesTable)
      .values({
        title: 'Empty Quiz',
        description: null, // Test null description
        created_by: userId
      })
      .returning()
      .execute();

    const packageId = packageResult[0].id;

    // Test the handler
    const result = await getQuizPackageById(packageId);

    // Verify the result
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(packageId);
    expect(result!.title).toEqual('Empty Quiz');
    expect(result!.description).toBeNull();
    expect(result!.created_by).toEqual(userId);
    expect(result!.question_count).toEqual(0);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should return null when quiz package does not exist', async () => {
    const nonExistentId = 99999;

    const result = await getQuizPackageById(nonExistentId);

    expect(result).toBeNull();
  });

  it('should return correct question count for package with many questions', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'admin@example.com',
        password_hash: 'hashed_password',
        role: 'ADMIN'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create a test quiz package
    const packageResult = await db.insert(quizPackagesTable)
      .values({
        title: 'Comprehensive Quiz',
        description: 'A quiz with many questions',
        created_by: userId
      })
      .returning()
      .execute();

    const packageId = packageResult[0].id;

    // Create 10 test questions
    const questions = Array.from({ length: 10 }, (_, index) => ({
      quiz_package_id: packageId,
      question_text: `Question ${index + 1}?`,
      option_a: `Option A${index + 1}`,
      option_b: `Option B${index + 1}`,
      option_c: `Option C${index + 1}`,
      option_d: `Option D${index + 1}`,
      option_e: `Option E${index + 1}`,
      correct_answer: 'A' as const,
      order_index: index
    }));

    await db.insert(quizQuestionsTable)
      .values(questions)
      .execute();

    // Test the handler
    const result = await getQuizPackageById(packageId);

    // Verify the result
    expect(result).not.toBeNull();
    expect(result!.id).toEqual(packageId);
    expect(result!.title).toEqual('Comprehensive Quiz');
    expect(result!.description).toEqual('A quiz with many questions');
    expect(result!.created_by).toEqual(userId);
    expect(result!.question_count).toEqual(10);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
  });

  it('should handle database errors gracefully', async () => {
    // Test with invalid ID type that might cause database errors
    const invalidId = -1;

    // Should not throw error but return null for non-existent records
    const result = await getQuizPackageById(invalidId);
    expect(result).toBeNull();
  });
});