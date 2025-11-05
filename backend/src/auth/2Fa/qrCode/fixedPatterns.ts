/**
 * @file fixedPatterns.ts
 * @brief Functions to place fixed patterns (finder, timing, alignment) in a QR code matrix.
 */

import { ALIGNMENT_POSITIONS } from "./qr.constants.js";

/**
 * @brief Computes the positions of alignment patterns for a given QR code version.
 *
 * @param version QR code version (1..40)
 * @returns Array of module indices for alignment patterns
 *
 * @example
 * const positions = getAlignmentPositions(5);
 * console.log(positions); // e.g., [6, 14, 22]
 */
function getAlignmentPositions(version: number): number[] {
	 /* Alignment patterns help QR code readers correct for distortion and
	 * maintain proper module alignment, especially in larger QR codes.
	 * Version 1 QR codes have no alignment patterns. For higher versions,
	 * positions are calculated dynamically based on the size of the matrix.
	 */
	if (version === 1) return []; // Version 1 has no alignment patterns

	const table: number[][] = [
		[], // v1
		[6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38],
		[6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54],
		[6, 32, 58], [6, 34, 62], [6, 26, 46, 66], [6, 26, 48, 70],
		[6, 26, 50, 74], [6, 30, 54, 78], [6, 30, 56, 82],
		[6, 30, 58, 86], [6, 34, 62, 90], [6, 28, 50, 72, 94],
		[6, 26, 50, 74, 98], [6, 30, 54, 78, 102],
		[6, 28, 54, 80, 106], [6, 32, 58, 84, 110],
		[6, 30, 58, 86, 114], [6, 34, 62, 90, 118],
		[6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126],
		[6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134],
		[6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142],
		[6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150],
		[6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158],
		[6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166],
		[6, 30, 58, 86, 114, 142, 170]
	];

	return table[version - 1];
}


/**
 * @brief Draws a single alignment pattern (5x5 square) centered at (x, y).
 *
 * @param matrix The QR matrix to modify
 * @param centerX X coordinate of the center
 * @param centerY Y coordinate of the center
 */
function placeAlignmentPattern(matrix: boolean[][], centerX: number, centerY: number): void {
	/**
	 * Alignment patterns are smaller 5x5 squares with a black center module,
	 * a white border, and a black outer border. They are used to correct
	 * distortion and maintain accurate decoding for larger QR codes.
	 */
	for (let y = -2; y <= 2; y++) {
		for (let x = -2; x <= 2; x++) {
			const absX = centerX + x;
			const absY = centerY + y;
			if (x === 0 && y === 0)
				matrix[absY][absX] = true; // center
			else if (x === -2 || x === 2 || y === -2 || y === 2)
				matrix[absY][absX] = true; // outer border
			else 
				matrix[absY][absX] = false; // inner white border
		}
	}
}

/**
 * @brief Adds alignment patterns to a QR code matrix based on its version.
 *
 * @param matrix The QR code matrix to modify
 * @param version The QR code version (1..40)
 *
 * @example
 * const matrix = generateQrCode("example", 5);
 * placeAlignmentPatterns(matrix, 5);
 */
export function placeAlignmentPatterns(matrix: boolean[][], version: number): void {
	/**
	 * For QR codes version 2 and higher, alignment patterns are placed at
	 * calculated positions, skipping the corners with finder patterns.
	 */
	const positions = ALIGNMENT_POSITIONS[version - 1];
	if (positions.length === 0) return;

	console.log('Alignment pattern positions:', positions);

	for (const row of positions) {
		for (const col of positions) {
			// Skip finder pattern corners
			if (
				(row === 6 && col === 6) ||
				(row === 6 && col === matrix.length - 7) ||
				(row === matrix.length - 7 && col === 6)
			) continue;

			placeAlignmentPattern(matrix, col, row);
		}
	}
}

/**
 * @brief Places the timing patterns (row and column at index 6).
 * @param matrix The QR matrix to modify.
 */
export function placeTimingPatterns(matrix: boolean[][]): void {
	/**
	 * Timing patterns are alternating black and white modules
	 * that run horizontally and vertically between the finder patterns.
	 * Their purpose is to help QR code readers determine the size of the modules,
	 * correct for distortion and ensure proper gride alignment.
	 */
	const size = matrix.length;

	for (let i = 8; i < size - 8; i++) { // 8 is to skip finder patterns
		// Horizontal timing pattern
		if (matrix[6][i] === null)
			matrix[6][i] = i % 2 === 0;

		// Vertical timing pattern
		if (matrix[i][6] === null)
			matrix[i][6] = i % 2 === 0;
	}
}

/**
 * @brief Draws a 7x7 finder pattern at a given top-left position.
 * @param matrix The QR code matrix to modify.
 * @param startX The top-left X coordinate.
 * @param startY The top-left Y coordinate.
 */
export function placeFinderPattern(matrix: boolean[][], startX: number, startY: number): void {
	/**
	 * Finder patterns are 7x7 square patterns located at three corners of the QR code.
	 * They consist of a 3x3 black square surrounded by a white border and then a black border.
	 * Their purpose is to help QR code readers locate and orient the QR code.
	 * They must be surrounded by at least one module of white space (the "quiet zone").
	 */
	const size = matrix.length;

	// Draw finder pattern including a 1-module quiet zone around it
	for (let y = -1; y <= 7; y++) {
		for (let x = -1; x <= 7; x++) {
			const absY = startY + y;
			const absX = startX + x;
			if (absY < 0 || absY >= size || absX < 0 || absX >= size) continue;

			if (y === -1 || y === 7 || x === -1 || x === 7) {
				// Quiet zone around the 7x7 finder
				matrix[absY][absX] = false;
			} else {
				const isBorder = y === 0 || y === 6 || x === 0 || x === 6;
				const isCenter = x >= 2 && x <= 4 && y >= 2 && y <= 4;
				matrix[absY][absX] = isBorder || isCenter;
			}
		}
	}
}