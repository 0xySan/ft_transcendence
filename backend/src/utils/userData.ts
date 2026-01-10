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

import { updateProfile, getProfileByUserId } from '../db/index.js';
const USER_IMG_DIR = path.join(process.cwd(), 'userData', 'imgs');

function updateUserImageInDb(userId: string | number, field: 'profile_picture' | 'background_picture', imageUrl: string) {
	const profile = getProfileByUserId(String(userId));
	if (!profile) throw new Error('Profile not found');
	return updateProfile(profile.profile_id, { [field]: imageUrl });
}

function updateUserAvatarInDb(userId: string | number, avatarUrl: string) {
	return updateUserImageInDb(userId, 'profile_picture', avatarUrl);
}

function updateUserBackgroundPictureInDb(userId: string | number, backgroundUrl: string) {
	return updateUserImageInDb(userId, 'background_picture', backgroundUrl);
}

/**
 * Check if the buffer is a valid image (PNG, JPG, WEBP, GIF)
 * @param buffer - The buffer to check
 * @returns boolean - True if the buffer is a valid image, false otherwise
 */
function isAllowedImage(buffer: Buffer): boolean {
	// PNG: 89 50 4E 47 0D 0A 1A 0A
	if (buffer.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]))) return true;
	// JPG: FF D8 FF
	if (buffer.subarray(0, 3).equals(Buffer.from([0xFF,0xD8,0xFF]))) return true;
	// WEBP: RIFF....WEBP
	if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') return true;
	// GIF: GIF87a or GIF89a
	const gifHeader = buffer.subarray(0, 6);
	if (gifHeader.equals(Buffer.from('GIF87a')) || gifHeader.equals(Buffer.from('GIF89a'))) return true;
	return false;
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

	if (!res.body) throw new Error('Response body is null');

	// Download to buffer first for validation
	let buffer: Buffer;
	if (typeof res.body.pipe === 'function') {
		// Node stream
		const chunks: Buffer[] = [];
		for await (const chunk of res.body) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
		buffer = Buffer.concat(chunks);
	} else {
		// Web ReadableStream
		const { Readable } = await import('stream');
		const nodeStream = Readable.fromWeb(res.body as any);
		const chunks: Buffer[] = [];
		for await (const chunk of nodeStream) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
		buffer = Buffer.concat(chunks);
	}

	if (!isAllowedImage(buffer)) {
		throw new Error('Downloaded file is not a valid PNG/JPG/WEBP/GIF image');
	}

	await fs.promises.writeFile(filePath, buffer);

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

	const buffer = await file.toBuffer();
	if (!isAllowedImage(buffer)) {
		throw new Error('Uploaded file is not a valid PNG/JPG/WEBP/GIF image');
	}

	await fs.promises.writeFile(filePath, buffer);

	updateUserAvatarInDb(userId, fileName);
	return fileName;
}

/**
 * Save a background picture from a remote URL
 */
export async function saveBackgroundFromUrl(userId: string, imageUrl: string) {
	const res = await fetch(imageUrl);
	if (!res.ok) {
		throw new Error(`Failed to download image: ${res.statusText}`);
	}

	const contentType = res.headers.get('content-type') || '';
	if (!contentType.startsWith('image/')) {
		throw new Error('URL does not point to an image');
	}

	const ext = contentType.split('/')[1] || 'png';
	const fileName = `background_${userId}.${ext}`;
	const filePath = path.join(USER_IMG_DIR, fileName);

	// Remove existing background if exists
	if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

	if (!res.body) throw new Error('Response body is null');

	// Download to buffer first for validation
	let buffer: Buffer;
	if (typeof res.body.pipe === 'function') {
		// Node stream
		const chunks: Buffer[] = [];
		for await (const chunk of res.body) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
		buffer = Buffer.concat(chunks);
	} else {
		// Web ReadableStream
		const { Readable } = await import('stream');
		const nodeStream = Readable.fromWeb(res.body as any);
		const chunks: Buffer[] = [];
		for await (const chunk of nodeStream) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
		buffer = Buffer.concat(chunks);
	}

	if (!isAllowedImage(buffer)) {
		throw new Error('Downloaded file is not a valid PNG/JPG/WEBP/GIF image');
	}

	await fs.promises.writeFile(filePath, buffer);

	updateUserBackgroundPictureInDb(userId, fileName);
	return fileName;
}

/**
 * Save a background picture from an uploaded file (e.g. multipart/form-data)
 */
export async function saveBackgroundFromFile(userId: string, file: any) {
	const fileExt = path.extname(file.filename) || '.png';
	const fileName = `background_${userId}${fileExt}`;
	const filePath = path.join(USER_IMG_DIR, fileName);

	// Remove existing background if exists
	if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

	const buffer = await file.toBuffer();
	if (!isAllowedImage(buffer)) {
		throw new Error('Uploaded file is not a valid PNG/JPG/WEBP/GIF image');
	}

	await fs.promises.writeFile(filePath, buffer);

	updateUserBackgroundPictureInDb(userId, fileName);
	return fileName;
}
