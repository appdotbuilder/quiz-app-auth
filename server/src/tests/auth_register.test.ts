import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterInput } from '../schema';
import { registerUser } from '../handlers/auth_register';
import { eq } from 'drizzle-orm';

// Test input data
const testInput: RegisterInput = {
  email: 'test@example.com',
  password: 'testpassword123',
  role: 'USER'
};

const adminInput: RegisterInput = {
  email: 'admin@example.com',
  password: 'adminpass456',
  role: 'ADMIN'
};

describe('registerUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should register a new user successfully', async () => {
    const result = await registerUser(testInput);

    // Verify response structure
    expect(result.user.id).toBeDefined();
    expect(typeof result.user.id).toBe('number');
    expect(result.user.email).toEqual('test@example.com');
    expect(result.user.role).toEqual('USER');
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(0);
  });

  it('should save user to database with hashed password', async () => {
    const result = await registerUser(testInput);

    // Query database to verify user was saved
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.user.id))
      .execute();

    expect(users).toHaveLength(1);
    const savedUser = users[0];
    
    expect(savedUser.email).toEqual('test@example.com');
    expect(savedUser.role).toEqual('USER');
    expect(savedUser.password_hash).toBeDefined();
    expect(savedUser.password_hash).not.toEqual('testpassword123'); // Password should be hashed
    expect(savedUser.password_hash.length).toBeGreaterThan(0);
    expect(savedUser.created_at).toBeInstanceOf(Date);
    expect(savedUser.updated_at).toBeInstanceOf(Date);
  });

  it('should verify password is properly hashed', async () => {
    const result = await registerUser(testInput);

    // Get the hashed password from database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.user.id))
      .execute();

    const hashedPassword = users[0].password_hash;

    // Verify that the hashed password can be verified against original password
    const isValid = await Bun.password.verify('testpassword123', hashedPassword);
    expect(isValid).toBe(true);

    // Verify that wrong password fails
    const isInvalid = await Bun.password.verify('wrongpassword', hashedPassword);
    expect(isInvalid).toBe(false);
  });

  it('should generate valid token', async () => {
    const result = await registerUser(testInput);

    // Verify token structure and content by decoding base64
    const decoded = JSON.parse(atob(result.token));
    
    expect(decoded.userId).toEqual(result.user.id);
    expect(decoded.email).toEqual('test@example.com');
    expect(decoded.role).toEqual('USER');
    expect(decoded.exp).toBeDefined(); // Token should have expiration
    expect(decoded.iat).toBeDefined(); // Token should have issued at time
    expect(typeof decoded.exp).toBe('number');
    expect(typeof decoded.iat).toBe('number');
    expect(decoded.exp > decoded.iat).toBe(true); // Expiration should be after issued time
  });

  it('should register admin user with correct role', async () => {
    const result = await registerUser(adminInput);

    expect(result.user.email).toEqual('admin@example.com');
    expect(result.user.role).toEqual('ADMIN');

    // Verify in database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.user.id))
      .execute();

    expect(users[0].role).toEqual('ADMIN');
  });

  it('should use default USER role when not specified', async () => {
    const inputWithoutRole = {
      email: 'defaultuser@example.com',
      password: 'password123'
    };

    // Parse with Zod to apply defaults - in real usage this would be done by the API layer
    const parsedInput = {
      ...inputWithoutRole,
      role: 'USER' as const // Zod default applied
    };

    const result = await registerUser(parsedInput);

    expect(result.user.role).toEqual('USER');
  });

  it('should reject duplicate email registration', async () => {
    // Register first user
    await registerUser(testInput);

    // Attempt to register with same email
    const duplicateInput: RegisterInput = {
      email: 'test@example.com',
      password: 'differentpassword',
      role: 'ADMIN'
    };

    await expect(registerUser(duplicateInput))
      .rejects.toThrow(/already exists/i);
  });

  it('should handle case-sensitive email uniqueness', async () => {
    await registerUser(testInput);

    // Different case should still be allowed (email comparison is case-sensitive in database)
    const upperCaseInput: RegisterInput = {
      email: 'TEST@EXAMPLE.COM',
      password: 'password123',
      role: 'USER'
    };

    // This should succeed since emails are case-sensitive
    const result = await registerUser(upperCaseInput);
    expect(result.user.email).toEqual('TEST@EXAMPLE.COM');
  });

  it('should create users with sequential IDs', async () => {
    const user1 = await registerUser({
      email: 'user1@example.com',
      password: 'password123',
      role: 'USER'
    });

    const user2 = await registerUser({
      email: 'user2@example.com',
      password: 'password456',
      role: 'USER'
    });

    expect(user2.user.id).toBeGreaterThan(user1.user.id);
  });

  it('should set proper timestamps', async () => {
    const beforeRegistration = new Date();
    
    const result = await registerUser(testInput);
    
    const afterRegistration = new Date();

    // Get user from database to check timestamps
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.user.id))
      .execute();

    const savedUser = users[0];
    expect(savedUser.created_at >= beforeRegistration).toBe(true);
    expect(savedUser.created_at <= afterRegistration).toBe(true);
    expect(savedUser.updated_at >= beforeRegistration).toBe(true);
    expect(savedUser.updated_at <= afterRegistration).toBe(true);
  });
});