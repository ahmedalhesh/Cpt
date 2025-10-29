/**
 * API Routes Middleware for Cloudflare Pages Functions
 */

export const onRequest = async ({ request, env, waitUntil, next }: { request: Request; env: any; waitUntil: any; next: any }) => {
  // Add CORS headers
  const response = await next();
  
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return response;
};
