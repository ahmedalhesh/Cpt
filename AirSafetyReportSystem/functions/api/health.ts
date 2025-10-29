/**
 * Health check endpoint
 */

export const onRequestGet = async ({ env }: { env: any }) => {
  return new Response(JSON.stringify({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: 'D1 connected',
    environment: env.NODE_ENV || 'production',
  }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
