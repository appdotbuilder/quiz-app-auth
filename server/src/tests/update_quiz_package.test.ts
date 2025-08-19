import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, quizPackagesTable } from '../db/schema';
import { type UpdateQuizPackageInput } from '../schema';
import { updateQuizPackage } from '../handlers/update_quiz_package';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'admin@test.com',
  password_hash: 'hashed_password',
  role: 'ADMIN' as const,
};

const testQuizPackage = {
  title: 'Original Quiz Package',
  description: 'Original description',
  created_by: 1,
};

describe('updateQuizPackage', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update quiz package title', async () => {
    // Create user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    // Create quiz package
    const packageResult = await db.insert(quizPackagesTable)
      .values({
        ...testQuizPackage,
        created_by: userResult[0].id,
      })
      .returning()
      .execute();

    const updateInput: UpdateQuizPackageInput = {
      id: packageResult[0].id,
      title: 'Updated Quiz Package Title',
    };

    const result = await updateQuizPackage(updateInput);

    // Verify updated fields
    expect(result.id).toEqual(packageResult[0].id);
    expect(result.title).toEqual('Updated Quiz Package Title');
    expect(result.description).toEqual('Original description'); // Should remain unchanged
    expect(result.created_by).toEqual(userResult[0].id);
    expect(result.question_count).toEqual(0);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(packageResult[0].updated_at!.getTime());
  });

  it('should update quiz package description', async () => {
    // Create user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    // Create quiz package
    const packageResult = await db.insert(quizPackagesTable)
      .values({
        ...testQuizPackage,
        created_by: userResult[0].id,
      })
      .returning()
      .execute();

    const updateInput: UpdateQuizPackageInput = {
      id: packageResult[0].id,
      description: 'Updated description',
    };

    const result = await updateQuizPackage(updateInput);

    // Verify updated fields
    expect(result.id).toEqual(packageResult[0].id);
    expect(result.title).toEqual('Original Quiz Package'); // Should remain unchanged
    expect(result.description).toEqual('Updated description');
    expect(result.created_by).toEqual(userResult[0].id);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(packageResult[0].updated_at!.getTime());
  });

  it('should update both title and description', async () => {
    // Create user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    // Create quiz package
    const packageResult = await db.insert(quizPackagesTable)
      .values({
        ...testQuizPackage,
        created_by: userResult[0].id,
      })
      .returning()
      .execute();

    const updateInput: UpdateQuizPackageInput = {
      id: packageResult[0].id,
      title: 'Completely New Title',
      description: 'Completely new description',
    };

    const result = await updateQuizPackage(updateInput);

    // Verify all updated fields
    expect(result.id).toEqual(packageResult[0].id);
    expect(result.title).toEqual('Completely New Title');
    expect(result.description).toEqual('Completely new description');
    expect(result.created_by).toEqual(userResult[0].id);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(packageResult[0].updated_at!.getTime());
  });

  it('should set description to null when explicitly provided', async () => {
    // Create user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    // Create quiz package
    const packageResult = await db.insert(quizPackagesTable)
      .values({
        ...testQuizPackage,
        created_by: userResult[0].id,
      })
      .returning()
      .execute();

    const updateInput: UpdateQuizPackageInput = {
      id: packageResult[0].id,
      description: null,
    };

    const result = await updateQuizPackage(updateInput);

    // Verify description is set to null
    expect(result.description).toBeNull();
    expect(result.title).toEqual('Original Quiz Package'); // Should remain unchanged
  });

  it('should save changes to database', async () => {
    // Create user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    // Create quiz package
    const packageResult = await db.insert(quizPackagesTable)
      .values({
        ...testQuizPackage,
        created_by: userResult[0].id,
      })
      .returning()
      .execute();

    const updateInput: UpdateQuizPackageInput = {
      id: packageResult[0].id,
      title: 'Database Persisted Title',
      description: 'Database persisted description',
    };

    await updateQuizPackage(updateInput);

    // Verify changes are persisted in database
    const savedPackage = await db.select()
      .from(quizPackagesTable)
      .where(eq(quizPackagesTable.id, packageResult[0].id))
      .execute();

    expect(savedPackage).toHaveLength(1);
    expect(savedPackage[0].title).toEqual('Database Persisted Title');
    expect(savedPackage[0].description).toEqual('Database persisted description');
    expect(savedPackage[0].updated_at).toBeInstanceOf(Date);
    expect(savedPackage[0].updated_at!.getTime()).toBeGreaterThan(packageResult[0].updated_at!.getTime());
  });

  it('should throw error when quiz package does not exist', async () => {
    const updateInput: UpdateQuizPackageInput = {
      id: 999999, // Non-existent ID
      title: 'This should fail',
    };

    await expect(updateQuizPackage(updateInput)).rejects.toThrow(/quiz package with id 999999 not found/i);
  });

  it('should handle minimal update with only id provided', async () => {
    // Create user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    // Create quiz package
    const packageResult = await db.insert(quizPackagesTable)
      .values({
        ...testQuizPackage,
        created_by: userResult[0].id,
      })
      .returning()
      .execute();

    const updateInput: UpdateQuizPackageInput = {
      id: packageResult[0].id,
      // No other fields provided - should only update timestamp
    };

    const result = await updateQuizPackage(updateInput);

    // Verify only timestamp was updated, other fields remain unchanged
    expect(result.id).toEqual(packageResult[0].id);
    expect(result.title).toEqual('Original Quiz Package');
    expect(result.description).toEqual('Original description');
    expect(result.created_by).toEqual(userResult[0].id);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.updated_at.getTime()).toBeGreaterThan(packageResult[0].updated_at!.getTime());
  });
});