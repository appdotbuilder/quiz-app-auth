import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { getUsers } from '../handlers/get_users';

describe('getUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when no users exist', async () => {
    const result = await getUsers();
    
    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('should return all users from database', async () => {
    // Create test users
    const passwordHash = 'hashed_password_123';
    
    await db.insert(usersTable).values([
      {
        email: 'admin@test.com',
        password_hash: passwordHash,
        role: 'ADMIN',
      },
      {
        email: 'user@test.com',
        password_hash: passwordHash,
        role: 'USER',
      }
    ]).execute();

    const result = await getUsers();
    
    expect(result).toHaveLength(2);
    
    // Verify admin user
    const adminUser = result.find(u => u.email === 'admin@test.com');
    expect(adminUser).toBeDefined();
    expect(adminUser!.role).toBe('ADMIN');
    expect(adminUser!.password_hash).toBe(passwordHash);
    expect(adminUser!.id).toBeDefined();
    expect(adminUser!.created_at).toBeInstanceOf(Date);
    expect(adminUser!.updated_at).toBeInstanceOf(Date);
    
    // Verify regular user
    const regularUser = result.find(u => u.email === 'user@test.com');
    expect(regularUser).toBeDefined();
    expect(regularUser!.role).toBe('USER');
    expect(regularUser!.password_hash).toBe(passwordHash);
    expect(regularUser!.id).toBeDefined();
    expect(regularUser!.created_at).toBeInstanceOf(Date);
    expect(regularUser!.updated_at).toBeInstanceOf(Date);
  });

  it('should return users in consistent order', async () => {
    // Create multiple users
    const passwordHash = 'hashed_password_123';
    
    const testUsers = [
      {
        email: 'user1@test.com',
        password_hash: passwordHash,
        role: 'USER' as const,
      },
      {
        email: 'admin1@test.com',
        password_hash: passwordHash,
        role: 'ADMIN' as const,
      },
      {
        email: 'user2@test.com',
        password_hash: passwordHash,
        role: 'USER' as const,
      }
    ];

    await db.insert(usersTable).values(testUsers).execute();

    // Call getUsers multiple times to check consistency
    const result1 = await getUsers();
    const result2 = await getUsers();
    
    expect(result1).toHaveLength(3);
    expect(result2).toHaveLength(3);
    
    // Results should be in the same order
    expect(result1.map(u => u.email)).toEqual(result2.map(u => u.email));
    
    // All users should have proper structure
    result1.forEach(user => {
      expect(user.id).toBeDefined();
      expect(user.email).toBeDefined();
      expect(user.password_hash).toBeDefined();
      expect(['ADMIN', 'USER']).toContain(user.role);
      expect(user.created_at).toBeInstanceOf(Date);
      expect(user.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should handle large number of users', async () => {
    const passwordHash = 'hashed_password_123';
    
    // Create 10 users
    const testUsers = Array.from({ length: 10 }, (_, i) => ({
      email: `user${i}@test.com`,
      password_hash: passwordHash,
      role: i % 2 === 0 ? 'USER' as const : 'ADMIN' as const,
    }));

    await db.insert(usersTable).values(testUsers).execute();

    const result = await getUsers();
    
    expect(result).toHaveLength(10);
    
    // Verify all users have proper structure
    result.forEach((user, index) => {
      expect(user.email).toBe(`user${index}@test.com`);
      expect(user.role).toBe(index % 2 === 0 ? 'USER' : 'ADMIN');
      expect(user.password_hash).toBe(passwordHash);
      expect(typeof user.id).toBe('number');
      expect(user.created_at).toBeInstanceOf(Date);
      expect(user.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should include password_hash in response', async () => {
    // Note: The current implementation includes password_hash
    // This test documents the current behavior
    const passwordHash = 'hashed_test_password';
    
    await db.insert(usersTable).values({
      email: 'test@example.com',
      password_hash: passwordHash,
      role: 'USER',
    }).execute();

    const result = await getUsers();
    
    expect(result).toHaveLength(1);
    expect(result[0].password_hash).toBe(passwordHash);
    expect(typeof result[0].password_hash).toBe('string');
  });
});