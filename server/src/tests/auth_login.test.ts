import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput } from '../schema';
import { loginUser } from '../handlers/auth_login';

const JWT_SECRET = process.env['JWT_SECRET'] || 'default-secret-key';

// Simple password hashing function (matching the one in handler)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Simple token parsing function
function parseToken(token: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }
  
  const payload = JSON.parse(atob(parts[1]));
  return payload;
}

// Test user data
const testUser = {
  email: 'test@example.com',
  password: 'password123',
  role: 'USER' as const,
};

const testAdmin = {
  email: 'admin@example.com', 
  password: 'adminpass123',
  role: 'ADMIN' as const,
};

describe('loginUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  beforeEach(async () => {
    // Create test users with hashed passwords
    const userPasswordHash = await hashPassword(testUser.password);
    const adminPasswordHash = await hashPassword(testAdmin.password);

    await db.insert(usersTable).values([
      {
        email: testUser.email,
        password_hash: userPasswordHash,
        role: testUser.role,
      },
      {
        email: testAdmin.email,
        password_hash: adminPasswordHash,
        role: testAdmin.role,
      }
    ]).execute();
  });

  it('should successfully login with valid credentials', async () => {
    const input: LoginInput = {
      email: testUser.email,
      password: testUser.password,
    };

    const result = await loginUser(input);

    // Verify user data
    expect(result.user.email).toEqual(testUser.email);
    expect(result.user.role).toEqual(testUser.role);
    expect(result.user.id).toBeDefined();
    expect(typeof result.user.id).toBe('number');

    // Verify token exists
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(0);
  });

  it('should generate valid token with correct claims', async () => {
    const input: LoginInput = {
      email: testUser.email,
      password: testUser.password,
    };

    const result = await loginUser(input);

    // Parse and verify token claims
    const decoded = parseToken(result.token);
    
    expect(decoded.userId).toEqual(result.user.id);
    expect(decoded.email).toEqual(testUser.email);
    expect(decoded.role).toEqual(testUser.role);
    expect(decoded.exp).toBeDefined(); // Token expiration
    expect(decoded.iat).toBeDefined(); // Token issued at
    expect(decoded.jti).toBeDefined(); // Unique token ID
    
    // Verify expiration is in the future
    const now = Math.floor(Date.now() / 1000);
    expect(decoded.exp).toBeGreaterThan(now);
  });

  it('should login admin user with correct role', async () => {
    const input: LoginInput = {
      email: testAdmin.email,
      password: testAdmin.password,
    };

    const result = await loginUser(input);

    expect(result.user.email).toEqual(testAdmin.email);
    expect(result.user.role).toEqual('ADMIN');
    expect(result.user.id).toBeDefined();

    // Verify token contains admin role
    const decoded = parseToken(result.token);
    expect(decoded.role).toEqual('ADMIN');
  });

  it('should reject login with invalid email', async () => {
    const input: LoginInput = {
      email: 'nonexistent@example.com',
      password: testUser.password,
    };

    await expect(loginUser(input)).rejects.toThrow(/invalid email or password/i);
  });

  it('should reject login with invalid password', async () => {
    const input: LoginInput = {
      email: testUser.email,
      password: 'wrongpassword',
    };

    await expect(loginUser(input)).rejects.toThrow(/invalid email or password/i);
  });

  it('should reject login with empty password', async () => {
    const input: LoginInput = {
      email: testUser.email,
      password: '',
    };

    await expect(loginUser(input)).rejects.toThrow(/invalid email or password/i);
  });

  it('should handle case-sensitive email matching', async () => {
    const input: LoginInput = {
      email: testUser.email.toUpperCase(), // Different case
      password: testUser.password,
    };

    await expect(loginUser(input)).rejects.toThrow(/invalid email or password/i);
  });

  it('should return consistent error for both invalid email and password', async () => {
    // Test invalid email
    const invalidEmailInput: LoginInput = {
      email: 'fake@example.com',
      password: testUser.password,
    };

    // Test invalid password  
    const invalidPasswordInput: LoginInput = {
      email: testUser.email,
      password: 'wrongpassword',
    };

    // Both should throw the same error message for security
    await expect(loginUser(invalidEmailInput)).rejects.toThrow(/invalid email or password/i);
    await expect(loginUser(invalidPasswordInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should handle multiple login attempts for same user', async () => {
    const input: LoginInput = {
      email: testUser.email,
      password: testUser.password,
    };

    // Login multiple times
    const result1 = await loginUser(input);
    const result2 = await loginUser(input);

    // Each login should generate different tokens (different timestamps)
    expect(result1.token).not.toEqual(result2.token);
    
    // But user data should be consistent
    expect(result1.user.id).toEqual(result2.user.id);
    expect(result1.user.email).toEqual(result2.user.email);
    expect(result1.user.role).toEqual(result2.user.role);

    // Both tokens should contain same user data but different unique IDs
    const decoded1 = parseToken(result1.token);
    const decoded2 = parseToken(result2.token);
    
    expect(decoded1.userId).toEqual(decoded2.userId);
    expect(decoded1.email).toEqual(decoded2.email);
    expect(decoded1.role).toEqual(decoded2.role);
    
    // But tokens should have different unique IDs
    expect(decoded1.jti).toBeDefined();
    expect(decoded2.jti).toBeDefined();
    expect(decoded1.jti).not.toEqual(decoded2.jti);
  });

  it('should verify password hashing works correctly', async () => {
    const password = 'testpassword';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    
    // Same password should produce same hash
    expect(hash1).toEqual(hash2);
    
    // Different passwords should produce different hashes
    const differentHash = await hashPassword('different');
    expect(hash1).not.toEqual(differentHash);
    
    // Hash should be a hex string
    expect(hash1).toMatch(/^[a-f0-9]+$/);
    expect(hash1.length).toBe(64); // SHA-256 produces 64 character hex string
  });
});