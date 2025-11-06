/**
 * Rate Limiting utility for Cloudflare Pages Functions
 * Uses D1 database to track request counts per IP/user
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
  keyPrefix: string;
}

/**
 * Rate limit check using D1 database
 * Returns true if request is allowed, false if rate limited
 */
export async function checkRateLimit(
  env: any,
  key: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  try {
    // Ensure rate_limit table exists
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS rate_limit (
        key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 1,
        reset_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `).run();

    const now = Date.now();
    const resetAt = now + config.windowMs;
    const fullKey = `${config.keyPrefix}:${key}`;

    // Get existing record
    const existing = await env.DB.prepare(
      'SELECT count, reset_at FROM rate_limit WHERE key = ?'
    )
      .bind(fullKey)
      .first();

    if (!existing) {
      // First request - create record
      await env.DB.prepare(
        'INSERT INTO rate_limit (key, count, reset_at, created_at) VALUES (?, 1, ?, ?)'
      ).bind(fullKey, resetAt, now).run();

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt,
      };
    }

    const existingResetAt = Number(existing.reset_at || 0);
    const existingCount = Number(existing.count || 0);

    // Check if window has expired or if resetAt is in the future beyond the current window
    // This handles cases where the window size was changed (e.g., from 15min to 5min)
    const maxAllowedResetAt = now + config.windowMs;
    if (now >= existingResetAt || existingResetAt > maxAllowedResetAt) {
      // Reset window with new timeframe
      await env.DB.prepare(
        'UPDATE rate_limit SET count = 1, reset_at = ?, created_at = ? WHERE key = ?'
      ).bind(resetAt, now, fullKey).run();

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt,
      };
    }

    // Check if limit exceeded
    if (existingCount >= config.maxRequests) {
      // Ensure resetAt doesn't exceed the current window size
      const validResetAt = Math.min(existingResetAt, maxAllowedResetAt);
      return {
        allowed: false,
        remaining: 0,
        resetAt: validResetAt,
      };
    }

    // Increment count
    await env.DB.prepare(
      'UPDATE rate_limit SET count = count + 1 WHERE key = ?'
    ).bind(fullKey).run();

    return {
      allowed: true,
      remaining: config.maxRequests - existingCount - 1,
      resetAt: existingResetAt,
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // On error, allow request (fail open for availability)
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: Date.now() + config.windowMs,
    };
  }
}

/**
 * Clean up old rate limit records (run periodically)
 */
export async function cleanupRateLimit(env: any, olderThanMs: number = 3600000): Promise<void> {
  try {
    const cutoff = Date.now() - olderThanMs;
    await env.DB.prepare(
      'DELETE FROM rate_limit WHERE created_at < ?'
    ).bind(cutoff).run();
  } catch (error) {
    console.error('Rate limit cleanup error:', error);
  }
}

/**
 * Get client identifier from request
 */
export function getRateLimitKey(request: Request, userId?: string | null): string {
  // Use user ID if available (more reliable)
  if (userId) {
    return `user:${userId}`;
  }

  // Fallback to IP address
  const headers = Object.fromEntries(request.headers || []);
  const ip = (headers['cf-connecting-ip'] as string) ||
            (headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
            'unknown';
  
  return `ip:${ip}`;
}

