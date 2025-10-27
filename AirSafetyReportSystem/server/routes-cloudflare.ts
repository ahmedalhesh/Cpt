// Cloudflare-compatible API routes
import { storage } from "./storage.js";
import { insertReportSchema, insertCommentSchema } from "@shared/schema.js";

export async function routes(request: Request, context: { db: any, env: any }): Promise<Response> {
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;

  try {
    // Authentication routes
    if (path === '/api/auth/login' && method === 'POST') {
      const body = await request.json();
      const { email, password } = body;

      const user = await storage.getUserByEmail(email);
      if (!user || !await storage.verifyPassword(password, user.password)) {
        return new Response(JSON.stringify({ message: 'Invalid credentials' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const token = storage.generateToken(user);
      return new Response(JSON.stringify({ token, user: { id: user.id, email: user.email, role: user.role } }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Reports routes
    if (path === '/api/reports' && method === 'GET') {
      const reports = await storage.getReports();
      return new Response(JSON.stringify(reports), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/reports' && method === 'POST') {
      const body = await request.json();
      const validatedData = insertReportSchema.parse(body);
      
      const report = await storage.createReport(validatedData);
      return new Response(JSON.stringify(report), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Report detail
    if (path.startsWith('/api/reports/') && method === 'GET') {
      const reportId = path.split('/')[3];
      const report = await storage.getReport(parseInt(reportId));
      
      if (!report) {
        return new Response(JSON.stringify({ message: 'Report not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify(report), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Comments routes
    if (path === '/api/comments' && method === 'POST') {
      const body = await request.json();
      const validatedData = insertCommentSchema.parse(body);
      
      const comment = await storage.createComment(validatedData);
      return new Response(JSON.stringify(comment), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path.startsWith('/api/comments/') && method === 'GET') {
      const reportId = path.split('/')[3];
      const comments = await storage.getComments(parseInt(reportId));
      
      return new Response(JSON.stringify(comments), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Users management
    if (path === '/api/users' && method === 'GET') {
      const users = await storage.getAllUsers();
      return new Response(JSON.stringify(users), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/users' && method === 'POST') {
      const body = await request.json();
      const user = await storage.createUser(body);
      return new Response(JSON.stringify(user), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Company settings
    if (path === '/api/settings' && method === 'GET') {
      const settings = await storage.getCompanySettings();
      return new Response(JSON.stringify(settings), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/settings' && method === 'PUT') {
      const body = await request.json();
      const settings = await storage.updateCompanySettings(body);
      return new Response(JSON.stringify(settings), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Notifications
    if (path === '/api/notifications' && method === 'GET') {
      const notifications = await storage.getNotifications();
      return new Response(JSON.stringify(notifications), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Default response
    return new Response(JSON.stringify({ message: 'Not Found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('API Error:', error);
    return new Response(JSON.stringify({ message: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
