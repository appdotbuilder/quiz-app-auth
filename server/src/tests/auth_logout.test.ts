import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { logoutUser } from '../handlers/auth_logout';

describe('logoutUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return success when logging out', async () => {
    const result = await logoutUser();

    expect(result).toEqual({
      success: true
    });
  });

  it('should return success multiple times (idempotent)', async () => {
    const result1 = await logoutUser();
    const result2 = await logoutUser();
    const result3 = await logoutUser();

    expect(result1).toEqual({ success: true });
    expect(result2).toEqual({ success: true });
    expect(result3).toEqual({ success: true });
  });

  it('should handle logout without any prior authentication state', async () => {
    // Test that logout works even when user was never logged in
    const result = await logoutUser();

    expect(result).toEqual({
      success: true
    });
    expect(typeof result.success).toBe('boolean');
  });

  it('should complete logout operation quickly', async () => {
    const startTime = Date.now();
    
    const result = await logoutUser();
    
    const endTime = Date.now();
    const duration = endTime - startTime;

    expect(result.success).toBe(true);
    // Logout should be very fast since it's just returning success
    expect(duration).toBeLessThan(100); // Less than 100ms
  });
});