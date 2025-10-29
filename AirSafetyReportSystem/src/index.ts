/**
 * Cloudflare Worker Entry Point
 * Handles all API routes and serves static files
 */

import { getAssetFromKV, mapRequestToAsset } from '@cloudflare/kv-asset-handler';
import manifestJSON from '__STATIC_CONTENT_MANIFEST';
import { router } from './router';
import type { Env } from './types';

const manifest = JSON.parse(manifestJSON) as Record<string, string>;

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// Handle API routes
		if (url.pathname.startsWith('/api')) {
			try {
				return await router.handle(request, env);
			} catch (error) {
				console.error('API Error:', error);
				return new Response(
					JSON.stringify({ 
						message: 'Internal server error',
						error: error instanceof Error ? error.message : 'Unknown error'
					}),
					{ 
						status: 500,
						headers: { 'Content-Type': 'application/json' }
					}
				);
			}
		}

		// Handle static assets (SPA)
		try {
			return await getAssetFromKV(
				{
					request,
					waitUntil: ctx.waitUntil.bind(ctx),
				},
				{
					ASSET_NAMESPACE: env.__STATIC_CONTENT,
					ASSET_MANIFEST: manifest,
					mapRequestToAsset: (request: Request) => {
						// For SPA, always serve index.html for non-API routes
						const url = new URL(request.url);
						if (!url.pathname.startsWith('/api') && !manifest[url.pathname]) {
							return new Request(`${url.origin}/index.html`, request);
						}
						return mapRequestToAsset(request);
					},
				}
			);
		} catch (e) {
			// If asset not found, return 404
			return new Response('Not Found', { status: 404 });
		}
	},
} satisfies ExportedHandler<Env>;

