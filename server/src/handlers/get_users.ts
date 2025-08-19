import { db } from '../db';
import { usersTable } from '../db/schema';
import { type User } from '../schema';

export const getUsers = async (): Promise<User[]> => {
  try {
    // Fetch all users from the database
    const result = await db.select({
      id: usersTable.id,
      email: usersTable.email,
      password_hash: usersTable.password_hash,
      role: usersTable.role,
      created_at: usersTable.created_at,
      updated_at: usersTable.updated_at,
    })
      .from(usersTable)
      .execute();

    return result;
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw error;
  }
};