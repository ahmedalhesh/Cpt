// Cloudflare Pages Functions - API Routes
import { createDB } from '../server/db.js';
import { routes } from '../server/routes-cloudflare.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Initialize database
    const db = createDB(env.DB);
    
    // Handle API routes
    if (url.pathname.startsWith('/api/')) {
      return await routes(request, { db, env });
    }
    
    // Serve static files for non-API routes
    return new Response('Not Found', { status: 404 });
  }
};
