// Cloudflare Workers/Pages handler
import { createDB } from './db.js';
import { routes } from './routes.js';

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    // Initialize database with D1 binding
    const db = createDB(env.DB);
    
    // Handle API routes
    if (url.pathname.startsWith('/api/')) {
      return await routes(request, { db, env });
    }
    
    // For non-API routes, serve static files
    // This will be handled by Cloudflare Pages
    return new Response('Not Found', { status: 404 });
  }
};
