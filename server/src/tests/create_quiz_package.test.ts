import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, quizPackagesTable } from '../db/schema';
import { type CreateQuizPackageInput } from '../schema';
import { createQuizPackage } from '../handlers/create_quiz_package';
import { eq } from 'drizzle-orm';

// Test data
const testAdminUser = {
  email: 'admin@example.com',
  password_hash: 'hashed_password_123',
  role: 'ADMIN' as const,
};

const testRegularUser = {
  email: 'user@example.com',
  password_hash: 'hashed_password_456',
  role: 'USER' as const,
};

const testQuizPackageInput: CreateQuizPackageInput = {
  title: 'JavaScript Fundamentals',
  description: 'A comprehensive quiz covering JavaScript basics',
};

describe('createQuizPackage', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create a quiz package for admin user', async () => {
    // Create admin user
    const adminResult = await db.insert(usersTable)
      .values(testAdminUser)
      .returning()
      .execute();
    
    const adminId = adminResult[0].id;

    // Create quiz package
    const result = await createQuizPackage(testQuizPackageInput, adminId);

    // Verify basic fields
    expect(result.title).toEqual('JavaScript Fundamentals');
    expect(result.description).toEqual('A comprehensive quiz covering JavaScript basics');
    expect(result.created_by).toEqual(adminId);
    expect(result.question_count).toEqual(0);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save quiz package to database', async () => {
    // Create admin user
    const adminResult = await db.insert(usersTable)
      .values(testAdminUser)
      .returning()
      .execute();
    
    const adminId = adminResult[0].id;

    // Create quiz package
    const result = await createQuizPackage(testQuizPackageInput, adminId);

    // Verify it's saved in database
    const savedPackages = await db.select()
      .from(quizPackagesTable)
      .where(eq(quizPackagesTable.id, result.id))
      .execute();

    expect(savedPackages).toHaveLength(1);
    expect(savedPackages[0].title).toEqual('JavaScript Fundamentals');
    expect(savedPackages[0].description).toEqual('A comprehensive quiz covering JavaScript basics');
    expect(savedPackages[0].created_by).toEqual(adminId);
    expect(savedPackages[0].created_at).toBeInstanceOf(Date);
    expect(savedPackages[0].updated_at).toBeInstanceOf(Date);
  });

  it('should create quiz package with null description', async () => {
    // Create admin user
    const adminResult = await db.insert(usersTable)
      .values(testAdminUser)
      .returning()
      .execute();
    
    const adminId = adminResult[0].id;

    // Create quiz package with null description
    const inputWithNullDescription: CreateQuizPackageInput = {
      title: 'Math Quiz',
      description: null,
    };

    const result = await createQuizPackage(inputWithNullDescription, adminId);

    expect(result.title).toEqual('Math Quiz');
    expect(result.description).toBeNull();
    expect(result.created_by).toEqual(adminId);
    expect(result.question_count).toEqual(0);
  });

  it('should throw error for non-admin user', async () => {
    // Create regular user (non-admin)
    const userResult = await db.insert(usersTable)
      .values(testRegularUser)
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    // Attempt to create quiz package as regular user
    await expect(createQuizPackage(testQuizPackageInput, userId))
      .rejects.toThrow(/only admin users can create quiz packages/i);
  });

  it('should throw error for non-existent user', async () => {
    const nonExistentUserId = 9999;

    // Attempt to create quiz package with non-existent user
    await expect(createQuizPackage(testQuizPackageInput, nonExistentUserId))
      .rejects.toThrow(/user not found/i);
  });

  it('should handle multiple quiz packages from same admin', async () => {
    // Create admin user
    const adminResult = await db.insert(usersTable)
      .values(testAdminUser)
      .returning()
      .execute();
    
    const adminId = adminResult[0].id;

    // Create first quiz package
    const firstPackage = await createQuizPackage({
      title: 'JavaScript Basics',
      description: 'Basic JS concepts',
    }, adminId);

    // Create second quiz package
    const secondPackage = await createQuizPackage({
      title: 'Advanced JavaScript',
      description: 'Advanced JS patterns',
    }, adminId);

    // Verify both packages exist and have different IDs
    expect(firstPackage.id).not.toEqual(secondPackage.id);
    expect(firstPackage.created_by).toEqual(adminId);
    expect(secondPackage.created_by).toEqual(adminId);

    // Verify both saved in database
    const allPackages = await db.select()
      .from(quizPackagesTable)
      .where(eq(quizPackagesTable.created_by, adminId))
      .execute();

    expect(allPackages).toHaveLength(2);
  });
});