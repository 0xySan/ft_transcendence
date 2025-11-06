/**
 * @file fixedPatterns.ts
 * @brief Functions to place fixed patterns (finder, timing, alignment) in a QR code matrix.
 */

import { ALIGNMENT_POSITIONS } from "./qr.constants.js";

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