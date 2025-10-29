/**
 * Get current user API endpoint
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

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

export const onRequestGet = async ({ request, env }: { request: Request; env: any }) => {
  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        message: 'No token provided'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const payload = decodeJwtPayload(token);
    
    if (!payload || !payload.id) {
      return new Response(JSON.stringify({
        message: 'Invalid token'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = await getSQLiteDB();
    
    // Find user by ID
    const userStmt = db.prepare('SELECT * FROM users WHERE id = ? LIMIT 1');
    const user = userStmt.get(payload.id);
    
    if (!user) {
      return new Response(JSON.stringify({
        message: 'User not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Return user data without password
    const userData = {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: user.role,
      profileImageUrl: user.profile_image_url,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    };

    return new Response(JSON.stringify(userData), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Get user error:', error);
    return new Response(JSON.stringify({
      message: 'Failed to get user',
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
