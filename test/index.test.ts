import { resolve } from 'node:path';
import { describe, expect, test, beforeAll, afterAll } from 'vitest';
import { unstable_dev } from 'wrangler';
import type { UnstableDevWorker } from 'wrangler';

describe('Worker', () => {
	let worker: UnstableDevWorker;

	beforeAll(async () => {
		worker = await unstable_dev('src/index.ts', {
			experimental: { disableExperimentalWarning: true },
			persist: true,
			persistTo: resolve('.wrangler/test-run'),
			vars: {
				PUBLISH_TOKEN: 'test-publish-token',
			},
			r2: [{
				binding: 'R2',
				bucket_name: 'preview-builds',
				preview_bucket_name: 'preview-builds',
			}],
		});
	});

	afterAll(async () => {
		await worker.stop();
	});

	test('404 returns error', async () => {
		const resp = await worker.fetch('https://worker/test');
		expect(resp.status).toBe(404);

		const body = await resp.json();
		expect(body).toStrictEqual({ error: 'Route not found!' });
	});

	describe('Upload', () => {
		test('Should be POST', async () => {
			const resp = await worker.fetch('https://worker/upload/test/1/123');
			expect(resp.status).toBe(404);

			const body = await resp.json();
			expect(body).toStrictEqual({ error: 'Route not found!' });
		});

		test('Requires auth', async () => {
			const resp = await worker.fetch('https://worker/upload/test/1/123', { method: 'POST' });
			expect(resp.status).toBe(401);

			const body = await resp.json();
			expect(body).toStrictEqual({ error: 'Invalid authentication!' });
		});

		test('X-Checksum header is required', async () => {
			const resp = await worker.fetch('https://worker/upload/test/1/123', {
				method: 'POST',
				body: 'Testing123',
				headers: {
					Authorization: 'test-publish-token',
				},
			});
			expect(resp.status).toBe(400);

			const body = await resp.json();
			expect(body).toStrictEqual({ error: 'Missing "x-checksum" header!' });
		});

		test('Needs valid checksum', async () => {
			// Test valid
			let resp = await worker.fetch('https://worker/upload/test/1/123', {
				method: 'POST',
				body: 'Testing123',
				headers: {
					Authorization: 'test-publish-token',
					'X-Checksum': '0218b3506b9b9de4fd357c0865a393471b73fc5ea972c5731219cfae32cee483',
				},

			});
			expect(resp.status).toBe(200);

			let body = await resp.json();
			expect(body).not.toStrictEqual({ error: 'Checksum mismatch!' });

			// Test invalid
			resp = await worker.fetch('https://worker/upload/test/1/123', {
				method: 'POST',
				body: 'Testing123',
				headers: {
					Authorization: 'test-publish-token',
					'X-Checksum': 'a',
				},
			});
			expect(resp.status).toBe(400);

			body = await resp.json();
			expect(body).toStrictEqual({ error: 'Checksum mismatch!' });
		});

		test('Upload succeeds', async () => {
			const resp = await worker.fetch('https://worker/upload/test/1/123', {
				method: 'POST',
				body: 'Testing123',
				headers: {
					Authorization: 'test-publish-token',
					'X-Checksum': '0218b3506b9b9de4fd357c0865a393471b73fc5ea972c5731219cfae32cee483',
				},

			});
			expect(resp.status).toBe(200);

			const body = await resp.json();
			expect(body).toStrictEqual({ message: 'Success!' });
		});
	});

	describe('Download', () => {
		test('Should be GET', async () => {
			const resp = await worker.fetch('https://worker/download/test/1/123', { method: 'POST' });
			expect(resp.status).toBe(404);

			const body = await resp.json();
			expect(body).toStrictEqual({ error: 'Route not found!' });
		});

		test('Invalid build 404s', async () => {
			const resp = await worker.fetch('https://worker/download/test/10000/10000');
			expect(resp.status).toBe(404);

			const body = await resp.json();
			expect(body).toStrictEqual({ error: 'Build not found!' });
		});

		test('Download succeeds', async () => {
			// -- Upload the file --
			let resp = await worker.fetch('https://worker/upload/test/1/123', {
				method: 'POST',
				body: 'Testing123',
				headers: {
					Authorization: 'test-publish-token',
					'X-Checksum': '0218b3506b9b9de4fd357c0865a393471b73fc5ea972c5731219cfae32cee483',
				},

			});
			expect(resp.status).toBe(200);

			let body = await resp.json();
			expect(body).toStrictEqual({ message: 'Success!' });

			// -- Download --
			resp = await worker.fetch('https://worker/download/test/1/123');
			expect(resp.status).toBe(200);

			// Check content
			body = await resp.text();
			expect(body).toBe('Testing123');

			// Check headers
			expect(resp.headers.get('Content-Type')).toBe('application/java-archive');
			expect(resp.headers.get('Content-Disposition')).toBe('attachment; filename="test-123.jar"');
			expect(resp.headers.get('Cache-Control')).toBe('public, max-age=31536000');
		});
	});
});
