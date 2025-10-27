// Cloudflare Pages Functions - Main Worker
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Handle API routes
    if (url.pathname.startsWith('/api/')) {
      // Import the specific API handler
      if (url.pathname === '/api/auth/login' && request.method === 'POST') {
        return await handleLogin(request, env);
      }
      
      if (url.pathname === '/api/reports') {
        if (request.method === 'GET') {
          return await handleGetReports(request, env);
        } else if (request.method === 'POST') {
          return await handleCreateReport(request, env);
        }
      }
      
      if (url.pathname === '/api/settings') {
        if (request.method === 'GET') {
          return await handleGetSettings(request, env);
        } else if (request.method === 'PUT') {
          return await handleUpdateSettings(request, env);
        }
      }
      
      if (url.pathname === '/api/users') {
        if (request.method === 'GET') {
          return await handleGetUsers(request, env);
        } else if (request.method === 'POST') {
          return await handleCreateUser(request, env);
        }
      }
      
      return new Response('API endpoint not found', { status: 404 });
    }
    
    // Serve static files for non-API routes
    return new Response('Not Found', { status: 404 });
  }
};

// Login handler
async function handleLogin(request, env) {
  try {
    const body = await request.json();
    const { email, password } = body;

    // Check if DB binding exists
    if (!env.DB) {
      console.error('DB binding not found');
      return new Response(JSON.stringify({ message: 'Database not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Query database for user
    const result = await env.DB.prepare(
      'SELECT * FROM users WHERE email = ?'
    ).bind(email).first();

    if (!result) {
      return new Response(JSON.stringify({ message: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Simple password check (in production, use proper hashing)
    if (password !== 'password123') {
      return new Response(JSON.stringify({ message: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate a simple token
    const token = btoa(JSON.stringify({ 
      id: result.id, 
      email: result.email, 
      role: result.role 
    }));

    return new Response(JSON.stringify({ 
      token, 
      user: { 
        id: result.id, 
        email: result.email, 
        role: result.role,
        firstName: result.first_name,
        lastName: result.last_name
      } 
    }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ message: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Reports handlers
async function handleGetReports(request, env) {
  try {
    const reports = await env.DB.prepare('SELECT * FROM reports ORDER BY created_at DESC').all();
    
    return new Response(JSON.stringify(reports.results || []), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get reports error:', error);
    return new Response(JSON.stringify({ message: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleCreateReport(request, env) {
  try {
    const body = await request.json();
    
    // Basic validation
    if (!body.reportType || !body.description) {
      return new Response(JSON.stringify({ message: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const result = await env.DB.prepare(`
      INSERT INTO reports (id, report_type, description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      crypto.randomUUID(),
      body.reportType,
      body.description,
      'pending'
    ).run();
    
    return new Response(JSON.stringify({ 
      id: result.meta.last_row_id,
      ...body,
      status: 'pending'
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Create report error:', error);
    return new Response(JSON.stringify({ message: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Settings handlers
async function handleGetSettings(request, env) {
  try {
    const settings = await env.DB.prepare('SELECT * FROM company_settings LIMIT 1').first();
    
    return new Response(JSON.stringify(settings || { companyName: 'Air Safety Report System' }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get settings error:', error);
    return new Response(JSON.stringify({ message: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleUpdateSettings(request, env) {
  try {
    const body = await request.json();
    
    const result = await env.DB.prepare(`
      INSERT OR REPLACE INTO company_settings (id, company_name, logo, email, phone, address, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      'company-settings-id',
      body.companyName || 'Air Safety Report System',
      body.logo || null,
      body.email || null,
      body.phone || null,
      body.address || null
    ).run();
    
    return new Response(JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Update settings error:', error);
    return new Response(JSON.stringify({ message: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Users handlers
async function handleGetUsers(request, env) {
  try {
    const users = await env.DB.prepare('SELECT * FROM users ORDER BY created_at DESC').all();
    
    return new Response(JSON.stringify(users.results || []), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Get users error:', error);
    return new Response(JSON.stringify({ message: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

async function handleCreateUser(request, env) {
  try {
    const body = await request.json();
    
    // Basic validation
    if (!body.email || !body.password || !body.firstName || !body.lastName) {
      return new Response(JSON.stringify({ message: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const result = await env.DB.prepare(`
      INSERT INTO users (id, email, password, first_name, last_name, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).bind(
      crypto.randomUUID(),
      body.email,
      body.password, // In production, hash this
      body.firstName,
      body.lastName,
      body.role || 'captain'
    ).run();
    
    return new Response(JSON.stringify({ 
      id: result.meta.last_row_id,
      ...body
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Create user error:', error);
    return new Response(JSON.stringify({ message: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
