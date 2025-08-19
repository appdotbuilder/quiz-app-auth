import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterInput, type AuthResponse } from '../schema';
import { eq } from 'drizzle-orm';

export async function registerUser(input: RegisterInput): Promise<AuthResponse> {
  try {
    // Check if user already exists
    const existingUsers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (existingUsers.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash password using Bun's built-in password hashing
    const passwordHash = await Bun.password.hash(input.password);

    // Insert new user
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        password_hash: passwordHash,
        role: input.role
      })
      .returning()
      .execute();

    const newUser = result[0];

    // Generate simple token (in production, use proper JWT library)
    const tokenPayload = {
      userId: newUser.id,
      email: newUser.email,
      role: newUser.role,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours
    };
    
    const token = btoa(JSON.stringify(tokenPayload)); // Base64 encode for simple token

    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role
      },
      token
    };
  } catch (error) {
    console.error('User registration failed:', error);
    throw error;
  }
}