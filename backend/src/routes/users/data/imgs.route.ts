/**
 * @file imgs.ts
 * @description api path to retrieve user images (robust error handling)
 */

import { FastifyInstance } from 'fastify';
import { requireAuth } from '../../../middleware/auth.middleware.js';
import { userImgsSchema, uploadAvatarUrlSchema, uploadAvatarFileSchema, uploadBackgroundUrlSchema, uploadBackgroundFileSchema } from '../../../plugins/swagger/schemas/userImgs.schema.js';
import { saveImageFromUrl, saveImageFromFile } from '../../../utils/userData.js';
import path from 'path';
import fs from 'fs';

export function userDataImgsRoute(fastify: FastifyInstance) {
	fastify.get('/data/imgs/:fileName', { schema: userImgsSchema, validatorCompiler: ({ schema }) => {return () => true;} }, async (request, reply) => {
		try {
			const { fileName } = request.params as { fileName: string };
			if (!fileName) {
				return reply.status(400).send({ error: 'File name is required' });
			}

			const filePath = path.join(process.cwd(), 'userData', 'imgs', fileName);

			if (!fs.existsSync(filePath)) {
				return reply.status(404).send({ error: 'File not found' });
			}

			let stats;
			try {
				stats = fs.statSync(filePath);
			} catch (err) {
				fastify.log.debug({ err }, 'statSync failed for filePath');
				return reply.status(404).send({ error: 'File not found' });
			}

			if (stats && typeof stats.isDirectory === 'function' && stats.isDirectory()) {
				return reply.status(400).send({ error: 'Invalid file path: is a directory' });
			}

			// Detect content type
			const ext = path.extname(filePath).toLowerCase();
			let contentType = 'application/octet-stream';
			if (ext === '.png') contentType = 'image/png';
			else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
			else if (ext === '.webp') contentType = 'image/webp';
			else if (ext === '.gif') contentType = 'image/gif';

			// Stream file
			reply.type(contentType);

			let stream;
			try {
				stream = fs.createReadStream(filePath);
			} catch (err) {
				fastify.log.error({ err }, 'createReadStream failed');
				return reply.status(500).send({ error: 'Error reading file' });
			}

			stream.on('error', (err) => {
				fastify.log.error({ err }, 'stream error while sending file');
				try {
					if (!reply.sent) reply.status(500).send({ error: 'Error reading file' });
				} catch (e) {
					// nothing to do
				}
			});

			return reply.send(stream);
		} catch (err) {
			fastify.log.error({ err }, 'Unhandled error in /data/imgs/:fileName');
			return reply.status(500).send({ error: 'Internal server error' });
		}
	});

	// POST: upload avatar from URL
	fastify.post('/data/imgs/avatar-url', {
		schema: uploadAvatarUrlSchema,
		validatorCompiler: ({ schema }) => { return () => true; },
		preHandler: requireAuth
	}, async (request, reply) => {
		try {
			const session = (request as any).session;
			const userId = session?.user_id;
			if (!userId) return reply.status(401).send({ error: 'Unauthorized' });
			const { url } = request.body as { url: string };
			if (!url || typeof url !== 'string') return reply.status(400).send({ error: 'Missing or invalid url' });
			const fileName = await saveImageFromUrl(userId, url, 'avatar');
			return reply.status(200).send({ success: true, fileName });
		} catch (err: any) {
			return reply.status(400).send({ error: err.message || 'Failed to upload avatar from URL' });
		}
	});

	// POST: upload avatar from file (multipart/form-data)
	fastify.post('/data/imgs/avatar', {
		schema: uploadAvatarFileSchema,
		validatorCompiler: ({ schema }) => { return () => true; },
		preHandler: requireAuth
	}, async (request, reply) => {
		try {
			const session = (request as any).session;
			const userId = session?.user_id;
			if (!userId) return reply.status(401).send({ error: 'Unauthorized' });
			const file = await request.file();
			if (!file) return reply.status(400).send({ error: 'No file uploaded' });
			// Early quick check on MIME type to reject non-image uploads before buffering
			const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
			if (!file.mimetype || !allowedMimes.includes(file.mimetype)) {
				return reply.status(400).send({ error: 'Invalid file type' });
			}
			const fileName = await saveImageFromFile(userId, file, 'avatar');
			return reply.status(200).send({ success: true, fileName });
		} catch (err: any) {
			return reply.status(400).send({ error: err.message || 'Failed to upload avatar' });
		}
	});

	// POST: upload background from URL
	fastify.post('/data/imgs/background-url', {
		schema: uploadBackgroundUrlSchema,
		validatorCompiler: ({ schema }) => { return () => true; },
		preHandler: requireAuth
	}, async (request, reply) => {
		try {
			const session = (request as any).session;
			const userId = session?.user_id;
			if (!userId) return reply.status(401).send({ error: 'Unauthorized' });
			const { url } = request.body as { url: string };
			if (!url || typeof url !== 'string') return reply.status(400).send({ error: 'Missing or invalid url' });
			const fileName = await saveImageFromUrl(userId, url, 'background');
			return reply.status(200).send({ success: true, fileName });
		} catch (err: any) {
			return reply.status(400).send({ error: err.message || 'Failed to upload background from URL' });
		}
	});

	// POST: upload background from file (multipart/form-data)
	fastify.post('/data/imgs/background', {
		schema: uploadBackgroundFileSchema,
		validatorCompiler: ({ schema }) => { return () => true; },
		preHandler: requireAuth
	}, async (request, reply) => {
		try {
			const session = (request as any).session;
			const userId = session?.user_id;
			if (!userId) return reply.status(401).send({ error: 'Unauthorized' });
			const file = await request.file();
			if (!file) return reply.status(400).send({ error: 'No file uploaded' });
			// Early quick check on MIME type to reject non-image uploads before buffering
			const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'];
			if (!file.mimetype || !allowedMimes.includes(file.mimetype)) {
				return reply.status(400).send({ error: 'Invalid file type' });
			}
			const fileName = await saveImageFromFile(userId, file, 'background');
			return reply.status(200).send({ success: true, fileName });
		} catch (err: any) {
			return reply.status(400).send({ error: err.message || 'Failed to upload background' });
		}
	});
}
