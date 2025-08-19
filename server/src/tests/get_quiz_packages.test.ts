import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, quizPackagesTable, quizQuestionsTable } from '../db/schema';
import { type QuizPackageWithStats } from '../schema';
import { getQuizPackages } from '../handlers/get_quiz_packages';

describe('getQuizPackages', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no quiz packages exist', async () => {
    const result = await getQuizPackages();

    expect(result).toEqual([]);
  });

  it('should return quiz packages with correct question counts', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword123',
        role: 'USER'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create test quiz packages one by one to ensure proper ordering
    const package1Result = await db.insert(quizPackagesTable)
      .values({
        title: 'Package with 5 Questions',
        description: 'A package with exactly 5 questions',
        created_by: userId,
      })
      .returning()
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const package2Result = await db.insert(quizPackagesTable)
      .values({
        title: 'Package with No Questions',
        description: 'A package with no questions',
        created_by: userId,
      })
      .returning()
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    const package3Result = await db.insert(quizPackagesTable)
      .values({
        title: 'Package with 110 Questions',
        description: 'A complete package',
        created_by: userId,
      })
      .returning()
      .execute();

    const package1Id = package1Result[0].id;
    const package3Id = package3Result[0].id;

    // Add questions to first package (5 questions) - insert one by one
    for (let i = 0; i < 5; i++) {
      await db.insert(quizQuestionsTable)
        .values({
          quiz_package_id: package1Id,
          question_text: `Question ${i + 1}`,
          option_a: 'Option A',
          option_b: 'Option B',
          option_c: 'Option C',
          option_d: 'Option D',
          option_e: 'Option E',
          correct_answer: 'A',
          order_index: i,
        })
        .execute();
    }

    // Add questions to third package (110 questions) - insert one by one
    for (let i = 0; i < 110; i++) {
      await db.insert(quizQuestionsTable)
        .values({
          quiz_package_id: package3Id,
          question_text: `Question ${i + 1}`,
          option_a: 'Option A',
          option_b: 'Option B',
          option_c: 'Option C',
          option_d: 'Option D',
          option_e: 'Option E',
          correct_answer: 'A',
          order_index: i,
        })
        .execute();
    }

    const result = await getQuizPackages();

    expect(result).toHaveLength(3);
    
    // Find packages by title since ordering by timestamp might vary
    const packageWith110 = result.find(p => p.title === 'Package with 110 Questions');
    const packageWithNo = result.find(p => p.title === 'Package with No Questions');
    const packageWith5 = result.find(p => p.title === 'Package with 5 Questions');

    expect(packageWith110).toBeDefined();
    expect(packageWith110!.question_count).toEqual(110);
    expect(typeof packageWith110!.question_count).toBe('number');

    expect(packageWithNo).toBeDefined();
    expect(packageWithNo!.question_count).toEqual(0);
    expect(typeof packageWithNo!.question_count).toBe('number');

    expect(packageWith5).toBeDefined();
    expect(packageWith5!.question_count).toEqual(5);
    expect(typeof packageWith5!.question_count).toBe('number');

    // Verify all fields are present
    result.forEach(pkg => {
      expect(pkg.id).toBeDefined();
      expect(typeof pkg.id).toBe('number');
      expect(pkg.title).toBeDefined();
      expect(typeof pkg.title).toBe('string');
      expect(pkg.created_by).toBe(userId);
      expect(pkg.created_at).toBeInstanceOf(Date);
      expect(pkg.updated_at).toBeInstanceOf(Date);
      expect(typeof pkg.question_count).toBe('number');
      // description can be null
      expect(pkg.description === null || typeof pkg.description === 'string').toBe(true);
    });
  });

  it('should handle packages with null descriptions', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword123',
        role: 'ADMIN'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create package with null description
    await db.insert(quizPackagesTable)
      .values({
        title: 'Package with null description',
        description: null,
        created_by: userId,
      })
      .execute();

    const result = await getQuizPackages();

    expect(result).toHaveLength(1);
    expect(result[0].title).toEqual('Package with null description');
    expect(result[0].description).toBeNull();
    expect(result[0].question_count).toEqual(0);
  });

  it('should return packages ordered by created_at descending', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword123',
        role: 'USER'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create packages with slight time delays to ensure different timestamps
    const firstPackage = await db.insert(quizPackagesTable)
      .values({
        title: 'First Package',
        description: 'Created first',
        created_by: userId,
      })
      .returning()
      .execute();

    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const secondPackage = await db.insert(quizPackagesTable)
      .values({
        title: 'Second Package',
        description: 'Created second',
        created_by: userId,
      })
      .returning()
      .execute();

    await new Promise(resolve => setTimeout(resolve, 10));

    const thirdPackage = await db.insert(quizPackagesTable)
      .values({
        title: 'Third Package',
        description: 'Created third',
        created_by: userId,
      })
      .returning()
      .execute();

    const result = await getQuizPackages();

    expect(result).toHaveLength(3);
    
    // Should be ordered newest first (created_at DESC)
    expect(result[0].title).toEqual('Third Package');
    expect(result[1].title).toEqual('Second Package');
    expect(result[2].title).toEqual('First Package');

    // Verify ordering by checking timestamps
    expect(result[0].created_at >= result[1].created_at).toBe(true);
    expect(result[1].created_at >= result[2].created_at).toBe(true);
  });

  it('should correctly count questions across multiple packages', async () => {
    // Create a test user first
    const userResult = await db.insert(usersTable)
      .values({
        email: 'admin@example.com',
        password_hash: 'hashedpassword123',
        role: 'ADMIN'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create multiple packages one by one
    const packageAResult = await db.insert(quizPackagesTable)
      .values({
        title: 'Package A',
        description: 'Package with 3 questions',
        created_by: userId,
      })
      .returning()
      .execute();

    const packageBResult = await db.insert(quizPackagesTable)
      .values({
        title: 'Package B',
        description: 'Package with 2 questions',
        created_by: userId,
      })
      .returning()
      .execute();

    const packageAId = packageAResult[0].id;
    const packageBId = packageBResult[0].id;

    // Add 3 questions to Package A - insert individually
    await db.insert(quizQuestionsTable)
      .values({
        quiz_package_id: packageAId,
        question_text: 'Package A Question 1',
        option_a: 'A1', option_b: 'B1', option_c: 'C1', option_d: 'D1', option_e: 'E1',
        correct_answer: 'A',
        order_index: 0,
      })
      .execute();

    await db.insert(quizQuestionsTable)
      .values({
        quiz_package_id: packageAId,
        question_text: 'Package A Question 2',
        option_a: 'A2', option_b: 'B2', option_c: 'C2', option_d: 'D2', option_e: 'E2',
        correct_answer: 'B',
        order_index: 1,
      })
      .execute();

    await db.insert(quizQuestionsTable)
      .values({
        quiz_package_id: packageAId,
        question_text: 'Package A Question 3',
        option_a: 'A3', option_b: 'B3', option_c: 'C3', option_d: 'D3', option_e: 'E3',
        correct_answer: 'C',
        order_index: 2,
      })
      .execute();

    // Add 2 questions to Package B - insert individually
    await db.insert(quizQuestionsTable)
      .values({
        quiz_package_id: packageBId,
        question_text: 'Package B Question 1',
        option_a: 'A1', option_b: 'B1', option_c: 'C1', option_d: 'D1', option_e: 'E1',
        correct_answer: 'D',
        order_index: 0,
      })
      .execute();

    await db.insert(quizQuestionsTable)
      .values({
        quiz_package_id: packageBId,
        question_text: 'Package B Question 2',
        option_a: 'A2', option_b: 'B2', option_c: 'C2', option_d: 'D2', option_e: 'E2',
        correct_answer: 'E',
        order_index: 1,
      })
      .execute();

    const result = await getQuizPackages();

    expect(result).toHaveLength(2);
    
    // Find packages by title since they're ordered by created_at DESC
    const packageA = result.find(p => p.title === 'Package A');
    const packageB = result.find(p => p.title === 'Package B');

    expect(packageA).toBeDefined();
    expect(packageA!.question_count).toEqual(3);

    expect(packageB).toBeDefined();
    expect(packageB!.question_count).toEqual(2);
  });
});