/**
 * Create User API endpoint for Cloudflare Pages Functions
 * Admin-only endpoint to create new users
 */

export const onRequestPost = async ({ request, env }: { request: Request; env: any }) => {
  try {
    // Check authentication
    const auth = request.headers.get('Authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const token = auth.substring(7);
    let payload: any;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) throw new Error('Invalid token format');
      const payloadBase64 = parts[1];
      const decoded = atob(payloadBase64);
      payload = JSON.parse(decoded);
    } catch (e) {
      return new Response(JSON.stringify({ message: 'Invalid token' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // Get user from database to check role
    const userId = payload.id;
    const userRow = await env.DB.prepare('SELECT id, role FROM users WHERE id = ? LIMIT 1').bind(userId).first();
    
    if (!userRow) {
      return new Response(JSON.stringify({ message: 'User not found' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // Check if user is admin (case-insensitive)
    const userRole = String(userRow.role || '').toLowerCase();
    if (userRole !== 'admin') {
      return new Response(JSON.stringify({ message: 'Forbidden: Admin access required' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    // Parse request body
    const { email, password, firstName, lastName, role = 'captain' } = await request.json();

    // Validation
    if (!email || !password) {
      return new Response(JSON.stringify({ message: 'Email and password are required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Check if user already exists by email
    const existingUserByEmail = await env.DB.prepare('SELECT id FROM users WHERE lower(email) = ? LIMIT 1')
      .bind(String(email).toLowerCase()).first();
    if (existingUserByEmail) {
      return new Response(JSON.stringify({ message: 'User with this email already exists' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Check if user already exists by name (if both names provided)
    if (firstName && lastName) {
      const existingUserByName = await env.DB.prepare('SELECT id FROM users WHERE first_name = ? AND last_name = ? LIMIT 1')
        .bind(firstName, lastName).first();
      if (existingUserByName) {
        return new Response(JSON.stringify({ message: 'User with this name already exists' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // Hash password using bcryptjs
    let hashedPassword = password;
    try {
      const { hashSync } = await import('bcryptjs');
      hashedPassword = hashSync(String(password), 10);
    } catch (bcryptError) {
      // If bcryptjs is not available, store as plain text (not recommended for production)
      console.warn('bcryptjs not available, storing password as plain text');
      hashedPassword = String(password);
    }

    // Create user
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    
    await env.DB.prepare(
      'INSERT INTO users (id, email, password, first_name, last_name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(
      id,
      String(email).toLowerCase(),
      hashedPassword,
      firstName || null,
      lastName || null,
      role || 'captain',
      now,
      now
    ).run();

    return new Response(
      JSON.stringify({
        message: 'User created successfully',
        user: {
          id,
          email: String(email).toLowerCase(),
          firstName: firstName || null,
          lastName: lastName || null,
          role: role || 'captain',
        },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('User creation error:', error);
    return new Response(
      JSON.stringify({ 
        message: 'Failed to create user', 
        error: error?.message || String(error) 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

