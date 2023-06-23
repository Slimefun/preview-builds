import { Ctx } from '../hono';

export async function handleDownload(ctx: Ctx): Promise<Response> {
	const path = `${ctx.req.param('project')}/${ctx.req.param('pr')}/${ctx.req.param('build')}`;

	// Check cache
	const cache = caches.default;
	const res = await cache.match(new URL(`https://cache/${path}`));
	if (res !== undefined) {
		return res;
	}

	const obj = await ctx.env.R2.get(path);
	if (obj === null) {
		return ctx.json({ error: 'Build not found!' }, 404);
	}

	const headers = new Headers();
	obj.writeHttpMetadata(headers);

	return new Response(obj.body, { headers });
}
