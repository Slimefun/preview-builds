import { Next } from 'hono';
import { Ctx } from './hono';

export async function auth(ctx: Ctx, next: Next): Promise<Response | void> {
	if (ctx.req.header('authorization') === null || ctx.req.header('authorization') !== ctx.env.PUBLISH_TOKEN) {
		return Response.json({ error: 'Invalid authentication!' }, { status: 400 });
	}

	return next();
}
