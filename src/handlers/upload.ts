import { Ctx } from '../hono';

export async function handleUpload(ctx: Ctx): Promise<Response> {
	if (ctx.req.body === null) {
		return ctx.json({ error: 'No body provided!' }, 400);
	}
	const expectedHash = ctx.req.header('x-checksum');
	if (expectedHash === null) {
		return ctx.json({ error: 'Missing "x-checksum" header!' }, 400);
	}

	const clone = ctx.req.raw.clone();
	const hash = await sha256(await clone.arrayBuffer());
	if (expectedHash !== hash) {
		return ctx.json({ error: 'Checksum mismatch!' }, 400);
	}

	const [streamOne, streamTwo] = ctx.req.body.tee();

	const path = `${ctx.req.param('project')}/${ctx.req.param('pr')}/${ctx.req.param('build')}`;

	// Store in R2
	const obj = await ctx.env.R2.put(
		path,
		streamOne,
		{
			httpMetadata: {
				contentType: 'application/java-archive',
				contentDisposition: `attachment; filename="${ctx.req.param('project')}-${ctx.req.param('build')}.jar"`,
				cacheControl: 'public, max-age=31536000',
			},
			sha256: hash,
		},
	);

	// Store in cache
	const headers = new Headers();
	obj.writeHttpMetadata(headers);
	const cachedResponse = new Response(streamTwo, { headers });

	const cache = caches.default;
	ctx.executionCtx.waitUntil(cache.put(new URL(`https://cache/${path}`), cachedResponse));

	return ctx.json({ message: 'Success!' });
}

async function sha256(input: ArrayBuffer) {
	const hashBuffer = await crypto.subtle.digest('SHA-256', input);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
	return hashHex;
}

