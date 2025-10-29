/**
 * /api/auth/login - Login endpoint using SQLite
 */

import { Database } from 'sql.js';

// Cache the database
let cachedDB: Database | null = null;

async function getSQLiteDB(): Promise<Database> {
  if (cachedDB) return cachedDB;
  
  try {
    const dbUrl = 'https://raw.githubusercontent.com/ahmedalhesh/Cpt/main/AirSafetyReportSystem/database.sqlite';
    const response = await fetch(dbUrl);
    if (!response.ok) {
      throw new Error(`Failed to download database: ${response.status}`);
    }
    
    const buffer = await response.arrayBuffer();
    cachedDB = new Database(new Uint8Array(buffer));
    return cachedDB;
  } catch (error) {
    console.error('Error loading SQLite database:', error);
    throw error;
  }
}

export const onRequestPost = async ({ request, env }: { request: Request; env: any }) => {
  try {
    const body = await request.json();
    const { email, password } = body;
    
    if (!email || !password) {
      return new Response(JSON.stringify({ message: 'Email and password are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = await getSQLiteDB();
    
    // Find user by email
    const userStmt = db.prepare('SELECT * FROM users WHERE email = ? LIMIT 1');
    const user = userStmt.get(email);
    
    if (!user) {
      return new Response(JSON.stringify({ message: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // For demo purposes, accept any password for demo users
    if (email === 'demo@airline.com' || email === 'admin@airline.com') {
      const token = btoa(JSON.stringify({
        id: user.id,
        email: user.email,
        role: user.role,
        exp: Date.now() + (7 * 24 * 60 * 60 * 1000) // 7 days
      }));
      
      return new Response(JSON.stringify({
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // For other users, you would verify password hash here
    return new Response(JSON.stringify({ message: 'Invalid credentials' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({ 
      message: 'Internal server error',
      error: error?.message || String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
