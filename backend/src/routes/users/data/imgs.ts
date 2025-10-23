/**
 * @field imgs.ts
 * @description api path to retrieve user images
 */

import { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs';

export function userDataImgsRoute(fastify: FastifyInstance) {
	fastify.get('/data/imgs/:fileName', async (request, reply) => {
		const { fileName } = request.params as { fileName: string };
		if (!fileName) {
			return reply.status(400).send({ error: 'File name is required' });
		}

		const filePath = path.join(process.cwd(), 'userData', 'imgs', fileName);

		if (!fs.existsSync(filePath)) {
			return reply.status(404).send({ error: 'File not found' });
		}

		const stats = fs.statSync(filePath);
		if (stats.isDirectory()) {
			return reply.status(400).send({ error: 'Invalid file path: is a directory' });
		}

		// Detect content type
		const ext = path.extname(filePath).toLowerCase();
		let contentType = 'application/octet-stream';
		if (ext === '.png') contentType = 'image/png';
		else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
		else if (ext === '.webp') contentType = 'image/webp';

		// Stream file instead of reading synchronously
		reply.type(contentType);
		const stream = fs.createReadStream(filePath);
		return reply.send(stream);
	});
}
