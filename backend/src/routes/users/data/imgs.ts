/**
 * @field imgs.ts
 * @description api path to retrieve user images
 */

import { FastifyInstance } from 'fastify';
import path from 'path';
import fs from 'fs';

export function userDataImgsRoute(fastify: FastifyInstance) {
	fastify.get('data/imgs/:fileName', async (request, reply) => {
		const { fileName } = request.params as { fileName: string };
		const filePath = path.join(process.cwd(), 'userData', 'imgs', fileName);

		if (!fs.existsSync(filePath)) {
			return reply.status(404).send({ error: 'File not found' });
		}

		// Simple content type detection based on file extension
		const ext = path.extname(filePath).toLowerCase();
		let contentType = 'application/octet-stream';
		if (ext === '.png') contentType = 'image/png';
		else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
		else if (ext === '.webp') contentType = 'image/webp';

		// Read and send the file content synchronously
		const fileBuffer = fs.readFileSync(filePath);
		reply.type(contentType).send(fileBuffer);
	});
}
