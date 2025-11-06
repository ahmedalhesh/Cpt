/**
 * Input validation utilities for Backend APIs
 * Uses Zod for schema validation
 */

import { z } from 'zod';

/**
 * Validate request body against schema
 */
export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return { success: false, errors: result.error };
}

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove potentially dangerous characters
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .trim()
    .slice(0, 10000); // Max length
}

/**
 * Sanitize email input
 */
export function sanitizeEmail(email: string): string {
  if (typeof email !== 'string') {
    return '';
  }
  
  // Basic email validation and sanitization
  const sanitized = email.toLowerCase().trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  
  if (!emailRegex.test(sanitized)) {
    return '';
  }
  
  return sanitized.slice(0, 255);
}

/**
 * Common validation schemas
 */
export const commonSchemas = {
  email: z.string().email().max(255).transform((val) => val.toLowerCase().trim()),
  nonEmptyString: z.string().min(1).max(10000),
  uuid: z.string().uuid(),
  reportId: z.string().min(1).max(100),
  status: z.enum(['submitted', 'in_review', 'closed', 'rejected']),
  reportType: z.enum(['asr', 'ncr', 'cdf', 'chr', 'or', 'rir', 'captain']),
};

/**
 * Sanitize object recursively
 */
export function sanitizeObject<T extends Record<string, any>>(obj: T): Partial<T> {
  const sanitized: Partial<T> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key as keyof T] = sanitizeString(value) as T[keyof T];
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key as keyof T] = sanitizeObject(value) as T[keyof T];
    } else {
      sanitized[key as keyof T] = value;
    }
  }
  
  return sanitized;
}

