/**
 * API Routes Middleware for Cloudflare Pages Functions
 */

import type { PagesFunction } from '@cloudflare/workers-types';

export const onRequest: PagesFunction = async ({ request, env, waitUntil, next }) => {
  // Add CORS headers
  const response = await next();
  
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return response;
};
