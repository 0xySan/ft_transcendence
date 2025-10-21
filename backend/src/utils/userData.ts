/**
 * @file userData.ts
 * @description Utility functions for managing data uploaded by users.
 */

import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';
import fetch from 'node-fetch';
const streamPipeline = promisify(pipeline);

import { db, updateProfile } from '../db/index.js'; // adapte selon ton ORM

const USER_IMG_DIR = path.join(process.cwd(), 'userData', 'imgs');

function updateUserAvatarInDb(userId: string | number, avatarUrl: string) {
	return updateProfile(Number(userId), { profile_picture: avatarUrl });
}

/**
 * Save an avatar from a remote URL
 */
export async function saveAvatarFromUrl(userId: string, imageUrl: string) {
	const res = await fetch(imageUrl);
	if (!res.ok) {
		throw new Error(`Failed to download image: ${res.statusText}`);
	}

	const contentType = res.headers.get('content-type') || '';
	if (!contentType.startsWith('image/')) {
		throw new Error('URL does not point to an image');
	}

	const ext = contentType.split('/')[1] || 'png';
	const fileName = `avatar_${userId}.${ext}`;
	const filePath = path.join(USER_IMG_DIR, fileName);

	// Remove existing avatar if exists
	if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

	// Stream the image to a file
	if (!res.body) throw new Error('Response body is null');
	const nodeStream = (await import('stream')).Readable.fromWeb(res.body as any);

	await streamPipeline(nodeStream, fs.createWriteStream(filePath));

	updateUserAvatarInDb(userId, fileName);
	return fileName;
}

/**
 * Save an avatar from an uploaded file (e.g. multipart/form-data)
 */
export async function saveAvatarFromFile(userId: string, file: any) {
	const fileExt = path.extname(file.filename) || '.png';
	const fileName = `avatar_${userId}${fileExt}`;
	const filePath = path.join(USER_IMG_DIR, fileName);

	// Remove existing avatar if exists
	if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

	await fs.promises.writeFile(filePath, await file.toBuffer());

	updateUserAvatarInDb(userId, fileName);
	return fileName;
}
