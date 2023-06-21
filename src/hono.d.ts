import { Context } from 'hono';

export type Env = {
	R2: R2Bucket;
	PUBLISH_TOKEN: string;
}

export type Ctx = Context<{ Bindings: Env }>;
