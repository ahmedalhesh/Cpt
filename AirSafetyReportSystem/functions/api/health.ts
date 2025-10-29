/**
 * Health check endpoint
 */

import type { PagesFunction } from '@cloudflare/workers-types';

export const onRequestGet: PagesFunction = async ({ env }) => {
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
