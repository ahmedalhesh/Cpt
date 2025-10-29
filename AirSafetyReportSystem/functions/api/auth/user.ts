/**
 * Get current user API endpoint
 */

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
    
    // For now, return a demo user
    // In a real implementation, you would verify the JWT token
    const demoUser = {
      id: 'demo-user-id',
      email: 'demo@airline.com',
      firstName: 'Demo',
      lastName: 'User',
      role: 'captain',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return new Response(JSON.stringify(demoUser), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      message: 'Failed to get user',
      error: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
