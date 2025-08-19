import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput, type AuthResponse } from '../schema';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env['JWT_SECRET'] || 'default-secret-key';

// Simple password hashing using built-in crypto (for demonstration)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const hashedInput = await hashPassword(password);
  return hashedInput === hash;
}

// Simple JWT-like token generation (for demonstration)
function generateToken(payload: any): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Date.now();
  const payloadWithTimestamp = {
    ...payload,
    exp: Math.floor(now / 1000) + (7 * 24 * 60 * 60), // 7 days
    iat: Math.floor(now / 1000),
    jti: now.toString() + Math.random().toString(36).substr(2, 9) // Unique token ID
  };
  const payloadEncoded = btoa(JSON.stringify(payloadWithTimestamp));
  
  // Simple signature using secret (for demonstration - not cryptographically secure)
  const signature = btoa(JWT_SECRET + header + payloadEncoded).slice(0, 32);
  
  return `${header}.${payloadEncoded}.${signature}`;
}

export async function loginUser(input: LoginInput): Promise<AuthResponse> {
  try {
    // Query user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = users[0];

    // Verify password - for this demo, we'll assume passwords are stored as simple hashes
    // In a real application, you would use bcrypt or similar
    const isPasswordValid = await verifyPassword(input.password, user.password_hash);
    
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate token
    const token = generateToken({ 
      userId: user.id, 
      email: user.email, 
      role: user.role 
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      token,
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}