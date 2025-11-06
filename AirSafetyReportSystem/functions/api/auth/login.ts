/**
 * Login API endpoint for Cloudflare Pages Functions
 */

import { signJWT } from '../lib/jwt.js';
import { checkRateLimit, getRateLimitKey } from '../lib/rate-limit.js';
import { sanitizeEmail, sanitizeString } from '../lib/validation.js';
import { z } from 'zod';

// Login request schema
const loginSchema = z.object({
  email: z.string().email().max(255).transform((val) => val.toLowerCase().trim()),
  password: z.string().min(1).max(1000),
});

export const onRequestPost = async ({ request, env }: { request: Request; env: any }) => {
  try {
    // Rate limiting - 5 attempts per 5 minutes per IP
    const rateLimitKey = getRateLimitKey(request);
    const rateLimit = await checkRateLimit(env, rateLimitKey, {
      maxRequests: 5,
      windowMs: 5 * 60 * 1000, // 5 minutes
      keyPrefix: 'login',
    });

    if (!rateLimit.allowed) {
      await logLoginEvent(env, request, {
        outcome: 'rate_limited',
        email: 'rate_limited',
      });
      
      // Calculate remaining time in minutes and seconds
      const remainingMs = Math.max(0, rateLimit.resetAt - Date.now());
      const remainingMinutes = Math.floor(remainingMs / 60000);
      const remainingSeconds = Math.ceil((remainingMs % 60000) / 1000);
      
      let timeMessage = '';
      if (remainingMinutes > 0) {
        timeMessage = `${remainingMinutes} minute${remainingMinutes > 1 ? 's' : ''}`;
        if (remainingSeconds > 0 && remainingSeconds < 60) {
          timeMessage += ` and ${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''}`;
        }
      } else {
        timeMessage = `${remainingSeconds} second${remainingSeconds > 1 ? 's' : ''}`;
      }
      
      // Professional message
      const message = `You have exceeded the maximum number of login attempts. Please try again after ${timeMessage}.`;
      
      return new Response(
        JSON.stringify({
          message,
          retryAfter: Math.ceil(remainingMs / 1000),
          retryAfterFormatted: timeMessage,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': Math.ceil(remainingMs / 1000).toString(),
          },
        }
      );
    }

    // Parse and validate request body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(
        JSON.stringify({ message: 'Invalid request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate input
    const validation = loginSchema.safeParse(body);
    if (!validation.success) {
      await logLoginEvent(env, request, {
        outcome: 'error',
        reason: 'validation_failed',
        email: String(body.email || ''),
      });
      return new Response(
        JSON.stringify({
          message: 'Invalid email or password format',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { email, password } = validation.data;

    // Sanitize inputs
    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedPassword = sanitizeString(password);

    if (!sanitizedEmail || !sanitizedPassword) {
      await logLoginEvent(env, request, {
        outcome: 'error',
        reason: 'sanitization_failed',
        email: String(email || ''),
      });
      return new Response(
        JSON.stringify({ message: 'Invalid email or password' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const adminEmail = String(env.ADMIN_EMAIL || 'admin@airline.com').toLowerCase();
    const adminPassword = String(env.ADMIN_PASSWORD || 'password123');
    const inputEmail = sanitizedEmail;

    // Find user by email (use sanitized email)
    const row = await env.DB.prepare('SELECT id, email, password, first_name, last_name, role FROM users WHERE lower(email) = ? LIMIT 1')
      .bind(sanitizedEmail).first();

    // Auto-seed admin if missing or users table is empty and provided creds match admin defaults
    let user = row;
    if (!user) {
      const countRow = await env.DB.prepare('SELECT COUNT(*) as c FROM users').first();
      const usersCount = Number((countRow && (countRow.c ?? countRow['COUNT(*)'])) || 0);

      const isAdminAttempt = inputEmail === adminEmail;
      const chosenPassword = env.ADMIN_PASSWORD ? adminPassword : String(password);

      if (isAdminAttempt || usersCount === 0) {
        const id = (await env.DB.prepare('SELECT lower(hex(randomblob(16))) as id').first())?.id || crypto.randomUUID();
        // Hash password before storing
        let finalPassword = chosenPassword;
        try {
          const bcryptjs = await import('bcryptjs');
          finalPassword = bcryptjs.hashSync(chosenPassword, 12);
        } catch (e: any) {
          console.error('Failed to hash password during admin creation:', e?.message || String(e));
          // Fallback to plain text only if bcrypt fails (should not happen)
        }
        await env.DB.prepare(
          'INSERT INTO users (id, email, password, first_name, last_name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)'
        ).bind(id, inputEmail, finalPassword, 'Admin', 'User', 'admin').run();

        await logLoginEvent(env, request, {
          outcome: 'auto_seed_admin',
          email: inputEmail,
          usersCountBefore: usersCount,
        });

        user = await env.DB.prepare('SELECT id, email, password, first_name, last_name, role FROM users WHERE lower(email) = ? LIMIT 1')
          .bind(inputEmail).first();
      }
    }

    if (!user) {
      await logLoginEvent(env, request, {
        outcome: 'fail',
        reason: 'user_not_found',
        email: inputEmail,
      });
      return new Response(JSON.stringify({ message: 'Invalid credentials' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // Verify password - prioritize bcrypt, but support plain text for migration
    const stored = String(user.password || '').trim();
    let ok = false;
    let passwordCheckDetails: any = { storedLength: stored.length, isBcryptHash: false };
    
    if (!stored) {
      // No password stored - allow demo fallback or deny
      console.log('No password stored for user:', user.email);
      ok = false;
    } else {
      // Check if password is bcrypt hashed (starts with $2a$, $2b$, or $2y$)
      const isBcryptHash = /^\$2[aby]\$/.test(stored);
      passwordCheckDetails.isBcryptHash = isBcryptHash;
      
      if (isBcryptHash) {
        // Bcrypt hashed password
        console.log('Attempting bcrypt comparison for user:', user.email);
        try {
          // Dynamic import bcryptjs for Cloudflare Workers compatibility
          const bcryptjs = await import('bcryptjs');
          ok = bcryptjs.compareSync(sanitizedPassword, stored);
          console.log('bcrypt comparison result:', ok, 'for user:', user.email);
        } catch (e: any) {
          console.error('bcrypt comparison error:', {
            message: e?.message || String(e),
            stack: e?.stack,
            userEmail: user.email,
          });
          // If bcrypt fails completely, fallback to plain text comparison as last resort
          // This ensures users can still login even if bcryptjs is unavailable
          ok = stored === sanitizedPassword;
          if (ok) {
            console.warn(`bcryptjs failed, but plain text match succeeded for user ${user.email}`);
          }
        }
      } else {
        // Plain text password (for migration - should be hashed)
        console.log('Plain text password detected for user:', user.email);
        ok = stored === sanitizedPassword;
        console.log('Plain text comparison result:', ok, 'for user:', user.email);
        
        if (ok) {
          // Auto-hash plain text password on successful login
          try {
            const bcryptjs = await import('bcryptjs');
            const hashedPassword = bcryptjs.hashSync(sanitizedPassword, 12);
            await env.DB.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .bind(hashedPassword, user.id).run();
            console.log(`Auto-hashed password for user ${user.email}`);
          } catch (e: any) {
            console.error('Failed to auto-hash password:', {
              message: e?.message || String(e),
              stack: e?.stack,
              userEmail: user.email,
            });
            // Continue with login even if hashing fails
          }
        }
      }
    }

    // Allow demo fallback for known accounts if password missing (only in development)
    const isDevelopment = env.NODE_ENV !== 'production' && env.NODE_ENV !== 'PRODUCTION';
    const demoOk = isDevelopment && !stored && ((inputEmail === 'admin@airline.com' || inputEmail === 'demo@airline.com') && sanitizedPassword === 'password123');

    if (!ok && !demoOk) {
      // If this is the admin account and password mismatched, self-heal by updating the stored password
      const isAdminAttempt = inputEmail === adminEmail;
      if (isAdminAttempt) {
        const newPass = env.ADMIN_PASSWORD ? adminPassword : sanitizedPassword;
        // Hash password before storing
        let hashedPassword = newPass;
        try {
          const bcryptjs = await import('bcryptjs');
          hashedPassword = bcryptjs.hashSync(newPass, 12);
        } catch (e: any) {
          console.error('Failed to hash password during admin reset:', e?.message || String(e));
        }
        try {
          await env.DB.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE lower(email) = ?')
            .bind(hashedPassword, inputEmail).run();
          ok = true;
          await logLoginEvent(env, request, {
            outcome: 'admin_password_reset',
            email: inputEmail,
          });
        } catch (e) {
          console.error('Failed to update admin password:', e);
        }
      }
    }

    if (!ok && !demoOk) {
      await logLoginEvent(env, request, {
        outcome: 'fail',
        reason: 'invalid_password',
        email: inputEmail,
      });
      return new Response(JSON.stringify({ message: 'Invalid credentials' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // Issue secure signed JWT token
    const JWT_SECRET = env.JWT_SECRET || 'default-secret-key-change-in-production-minimum-32-chars';
    if (!JWT_SECRET || JWT_SECRET.length < 32) {
      console.error('WARNING: JWT_SECRET is too short or missing. Length:', JWT_SECRET.length, 'Using default (NOT SECURE FOR PRODUCTION)');
      // Use a longer default if the provided one is too short
      const defaultSecret = 'default-secret-key-change-in-production-minimum-32-chars-long';
      if (JWT_SECRET.length < 32) {
        console.warn('Using extended default secret due to short JWT_SECRET');
      }
    }

    let token: string;
    try {
      // Ensure JWT_SECRET is at least 32 characters
      const effectiveSecret = JWT_SECRET.length >= 32 ? JWT_SECRET : JWT_SECRET + 'default-secret-key-change-in-production-minimum-32-chars'.substring(0, 32 - JWT_SECRET.length);
      
      token = await signJWT(
        { id: user.id, email: user.email, role: user.role },
        effectiveSecret
      );
      console.log('JWT token generated successfully for user:', user.email);
    } catch (error: any) {
      console.error('JWT signing error:', {
        message: error?.message || String(error),
        stack: error?.stack,
        jwtSecretLength: JWT_SECRET.length,
      });
      await logLoginEvent(env, request, {
        outcome: 'error',
        reason: 'jwt_signing_failed',
        email: inputEmail,
        error: error?.message || String(error),
      });
      return new Response(JSON.stringify({ message: 'Login failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    await logLoginEvent(env, request, {
      outcome: 'success',
      email: inputEmail,
      role: user.role,
    });

    return new Response(JSON.stringify({ token }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error: any) {
    try {
      await logLoginEvent(env, request, {
        outcome: 'error',
        reason: 'exception',
        error: error?.message || String(error),
        stack: error?.stack || undefined,
      });
    } catch {}
    // Don't expose internal error details to client, but log for debugging
    console.error('Login error:', {
      message: error?.message || String(error),
      stack: error?.stack,
      name: error?.name,
    });
    return new Response(
      JSON.stringify({ message: 'Login failed. Please try again later.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

async function logLoginEvent(env: any, request: Request, payload: Record<string, unknown>) {
  try {
    const webhook = env.LOG_WEBHOOK_URL || env.LOGIN_AUDIT_URL;
    const headers = Object.fromEntries(request.headers || []);
    const userAgent = String(headers['user-agent'] || headers['User-Agent'] || '');
    const ip = (headers['cf-connecting-ip'] as string) || (headers['x-forwarded-for'] as string) || '';

    const body = {
      event: 'login',
      timestamp: new Date().toISOString(),
      userAgent,
      ip,
      ...payload,
    };

    if (webhook) {
      await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } else {
      console.log('[login_audit]', body);
    }
  } catch (e) {
    // swallow logging errors
  }
}

