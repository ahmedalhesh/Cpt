/**
 * Cloudflare Pages Functions Middleware
 * Handles Express.js compatibility on Cloudflare Pages
 */

import type { PagesFunction } from '@cloudflare/workers-types';

export const onRequest: PagesFunction = async ({ request, env, waitUntil, next }) => {
  // Handle CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // For API routes, we'll need to handle them differently
  // This is a placeholder - the actual API handling will be done through
  // Cloudflare Pages Functions or by adapting the Express app
  
  return next();
};