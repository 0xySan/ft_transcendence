/**
 * @file qrCode.ts
 * Utilities for generating QR code matrices (used for TOTP QR URIs, etc.)

 */

import { placeFinderPattern, placeTimingPatterns, placeAlignmentPatterns } from './fixedPatterns.js';
import { EcLevel, getInfo, QrEncodingMode, QrTextEncoding } from './qr.types.js';
import { splitIntoBlocks, placeDataAndEcc } from './dataManagment.js';
import { placeFormatBits, placeVersionBits } from './metadata.js';
import { encodePayloadToDataCodewords } from './dataEncoding.js';
import { chooseBestMask, applyMask } from './mask.js';
import { reedSolomonEncode } from './reedSolomon.js';

/**
 * Build a mask of reserved/function modules in the QR matrix.
 * These modules should not be modified when applying data masks.
 *
 * @param inputMatrix The QR matrix with fixed patterns placed (boolean|null)
 * @returns A boolean matrix where true indicates a reserved/function module
 */
export function buildReservedModuleMask(inputMatrix: (boolean | null)[][]): boolean[][] {
	const size = inputMatrix.length;
	const mask = Array.from({ length: size }, () => Array<boolean>(size).fill(false));

	// Helper to mark a rectangle area in the mask
	function markRect(top: number, left: number, height: number, width: number) {
		for (let r = top; r < top + height; r++) {
			for (let c = left; c < left + width; c++) {
				if (r >= 0 && r < size && c >= 0 && c < size) mask[r][c] = true;
			}
		}
	}

	// 1) mark modules already placed (finder/separators/timing/alignment)
	for (let r = 0; r < size; r++) {
		for (let c = 0; c < size; c++) {
			if (inputMatrix[r][c] !== null) mask[r][c] = true;
		}
	}

	// 2) mark format bits (15 bits total, with duplicates)
	markRect(0, 8, 9, 1); // top-left vertical
	markRect(8, 0, 1, 9); // top-left horizontal
	markRect(8, size - 8, 1, 8); // top-right horizontal
	markRect(size - 7, 8, 7, 1); // bottom-left vertical

	// 3) version bits for version >= 7
	const version = Math.floor((size - 17) / 4);
	if (version >= 7) {
		for (let r = 0; r <= 5; r++) {
			for (let c = size - 11; c <= size - 9; c++) mask[r][c] = true;
		}
		for (let r = size - 11; r <= size - 9; r++) {
			for (let c = 0; c <= 5; c++) mask[r][c] = true;
		}
	}

	return mask;
}

/**
 * @brief Computes the data length in codewords for a given mode and data string.
 * @param mode QrEncodingMode
 * @param data The string to encode
 * @param encoding Text encoding to use
 * @returns The data length in codewords approximation
 */
function computeDataLength(mode: QrEncodingMode, data: string, encoding: QrTextEncoding): number {
	let dataLength: number;
	switch (mode) {
		case 'numeric':
			dataLength = Math.ceil(data.length / 3); // 10 bits per 3 digits ≈ 1 CW per 8 bits
			break;
		case 'alphanumeric':
			dataLength = Math.ceil(data.length / 2); // 11 bits per 2 chars ≈ 1 CW per 8 bits
			break;
		case 'kanji':
			dataLength = data.length * 2; // 2 bytes per character
			break;
		case 'byte':
			if (encoding === 'UTF-8') dataLength = new TextEncoder().encode(data).length;
			else if (encoding === 'ISO-8859-1') dataLength = data.length;
			else if (encoding === 'UTF-16BE') dataLength = data.length * 2;
			else if (encoding === 'Shift_JIS') dataLength = data.length * 2;
			else throw new Error(`Unsupported encoding: ${encoding}`);
			break;
		case 'eci':
			// 1 codeword for ECI segment + data in chosen encoding
			let byteLength: number;
			if (encoding === 'UTF-8') byteLength = new TextEncoder().encode(data).length;
			else if (encoding === 'ISO-8859-1') byteLength = data.length;
			else if (encoding === 'UTF-16BE') byteLength = data.length * 2;
			else if (encoding === 'Shift_JIS') byteLength = data.length * 2;
			else throw new Error(`Unsupported encoding: ${encoding}`);
			dataLength = 1 + byteLength;
			break;
	}
	return dataLength;
}

/**
 * Determines the minimal QR version required to encode a given string
 * at a specified error correction level, using the Byte mode.
 * @param data The string to encode
 * @param ecLevel Error correction level ('L' | 'M' | 'Q' | 'H')
 * @param encoding Text encoding to use (default 'UTF-8')
 * @returns An object with the minimal version and encoding mode, or undefined if too large
 * @example
 * ```ts
 * const result = getMinimalVersion("Hello, World!", 'M', 'UTF-8');
 * if (result) {
 * 	console.log(`Minimal version: ${result.version}, Mode: ${result.mode}`);
 * } else {
 * 	console.log("Data too large for any QR version at this error correction level.");
 * }
 * ```
 */
export function getMinimalVersion(
	data: string,
	ecLevel: EcLevel,
	encoding: QrTextEncoding = 'UTF-8'
): { version: number; mode: QrEncodingMode } | undefined {
	const isNumeric = (s: string) => /^[0-9]*$/.test(s);
	const isAlphanumeric = (s: string) => /^[0-9A-Z $%*+\-./:]*$/.test(s);
	const isKanji = (s: string) => encoding === 'Shift_JIS' && s.length > 0;

	// Determine the QR mode
	let mode: QrEncodingMode;

	if (isNumeric(data)) {
		mode = 'numeric';
	} else if (isAlphanumeric(data)) {
		mode = 'alphanumeric';
	} else if (isKanji(data) && encoding === 'Shift_JIS') {
		mode = 'kanji';
	} else if (encoding === 'UTF-8' || encoding === 'ISO-8859-1' || encoding === 'UTF-16BE') {		// Standard encodings → use byte mode
		mode = 'byte';
	} else {
		// Non-standard encodings → use ECI mode
		mode = 'eci';
	}

	// Calculate data length in codewords approximation
	let dataLength: number;
	try {
		dataLength = computeDataLength(mode, data, encoding);
	} catch (e) {
		console.error('Error computing data length:', e);
		return undefined;
	}
	// Find minimal version that can hold the data
	for (let version = 1; version <= 40; version++) {
		const info = getInfo(version, ecLevel);
		if (!info) continue;
		if (dataLength <= info.totDataCW) {
			return { version, mode };
		}
	}

	// No suitable version found
	return undefined;
}

/**
 * @brief Generate a QR matrix from a payload.
 *
 * @param payload text payload
 * @param version QR version (1..40), @default 1
 * @param maskPattern optional (0..7). If -1, the best mask is chosen automatically. @default -1
 * @param errorCorrectionLevel 'L'|'M'|'Q'|'H' ECC level, @default 'M'
 * @returns boolean[][] QR matrix (true=black, false=white)
 */
export function generateQrCode(
	payload: string,
	version?: number,
	maskPattern = -1,
	errorCorrectionLevel: EcLevel = 'M',
	mode?: QrEncodingMode,
	encoding: QrTextEncoding = 'UTF-8'
): boolean[][] {
	if (!version) {
		const minimal = getMinimalVersion(payload, errorCorrectionLevel, encoding);
		if (!minimal) throw new Error('Payload too large for any QR version at this error correction level.');
		version = minimal.version;
		mode = minimal.mode;
	}
	if (!mode) mode = 'byte'; // default to byte mode if not specified
	const size = 21 + (version - 1) * 4;
	// matrix uses boolean|null during construction (null = empty)
	const matrix: (boolean | null)[][] = Array.from({ length: size }, () =>
		Array.from({ length: size }, () => null)
	);

	// 1) Place fixed patterns
	placeFinderPattern(matrix as any as boolean[][], 0, 0);
	placeFinderPattern(matrix as any as boolean[][], size - 7, 0);
	placeFinderPattern(matrix as any as boolean[][], 0, size - 7);
	placeTimingPatterns(matrix as any as boolean[][]);
	placeAlignmentPatterns(matrix as any as boolean[][], version);
	matrix[size - 8][8] = true; // dark module (fixed position)

	// 2) build reserved module mask
	const functionMask = buildReservedModuleMask(matrix);

	// 3) Encode payload -> data codewords
	const dataCodewords = encodePayloadToDataCodewords(payload, version, errorCorrectionLevel, mode, encoding);

	// 4) Split into blocks and generate ECC for each block
	const blocks = splitIntoBlocks(dataCodewords, version, errorCorrectionLevel);
	const eccBlocks: number[][] = blocks.map((b) => {
		// compute ecc for this block's data only
		return reedSolomonEncode(b.data, b.eccCount);
	});

	// 5) Place data & ecc into matrix (unmasked)
	placeDataAndEcc(matrix, blocks, eccBlocks, functionMask);

	// 6) Choose mask (if maskPattern < 0)
	const chosenMask = maskPattern >= 0 ? maskPattern : chooseBestMask(matrix as any as boolean[][], functionMask);

	// 7) Apply mask -> returns a matrix with booleans (no nulls) or consistent type expected by applyMask
	const maskedMatrix = applyMask(matrix as any as boolean[][], chosenMask, functionMask);

	// 8) Place format bits (format depends on chosenMask and ECL), and version bits (if any)
	placeFormatBits(maskedMatrix, chosenMask, errorCorrectionLevel);
	placeVersionBits(maskedMatrix, version);

	return maskedMatrix;
}

/**
 * Nicely print a matrix with ASCII blocks
 * Use with @function generateQrCode
 */
export function printMatrix(matrix: (boolean | null)[][]) {
	for (const row of matrix) {
		let line = '';
		for (const cell of row) {
			if (cell === true) line += '██';
			else if (cell === false) line += '  ';
			else line += '..';
		}
		console.log(line);
	}
}