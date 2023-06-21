import { Hono } from 'hono';
import { auth } from './auth';
import { handleDownload } from './handlers/download';
import { handleUpload } from './handlers/upload';
import { Env } from './hono';

const app = new Hono<{ Bindings: Env }>();

app.post('/upload/:project/:pr/:build', auth, handleUpload);
app.get('/download/:project/:pr/:build', handleDownload);

app.notFound((ctx) => ctx.json({ error: 'Route not found!' }, 404));
app.onError((err, ctx) => {
	console.log('Unknown error occurred:');
	console.error(err);
	return ctx.json({ error: 'Unknown error occurred' }, 500);
});

export default app;
