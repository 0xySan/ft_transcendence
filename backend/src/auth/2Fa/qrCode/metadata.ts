/**
 * @file metadata.ts
 * @brief Functions to place format and version bits in a QR code matrix.
 */

/**
 * @brief Compute 15-bit format string (ECL + mask pattern) with BCH error correction
 * @param maskPattern Mask index (0..7)
 * @param ecl Error correction level ('L','M','Q','H')
 * @returns Array of 15 bits (MSB first: bits[0] is the most significant bit)
 */
function computeFormatBits(maskPattern: number, ecl: 'L'|'M'|'Q'|'H'): number[] {
	if (maskPattern < 0 || maskPattern > 7) throw new Error('maskPattern must be 0..7');

	// ECL -> 2 bits mapping per QR spec: L=01, M=00, Q=11, H=10
	const eclBitsMap: Record<'L'|'M'|'Q'|'H', number> = { L: 0b01, M: 0b00, Q: 0b11, H: 0b10 };
	const eclBits = eclBitsMap[ecl] & 0b11;

	// 5-bit format info (ECL(2) << 3) | mask(3)
	const formatInfo5 = (eclBits << 3) | (maskPattern & 0b111);

	// Generator polynomial for BCH(15,5) (binary 10100110111 = 0x537)
	const G = 0x537;
	// Shift left 10 bits to make space for BCH remainder
	let data = formatInfo5 << 10;

	// Perform binary polynomial long division to get remainder (10 bits)
	for (let bit = (14); bit >= 10; bit--) {
		if ((data >> bit) & 1) {
			data ^= (G << (bit - 10));
		}
	}
	const remainder = data & 0x3FF; // 10-bit remainder

	// Combine the 5-bit info + 10-bit remainder
	let rawFormat = ((formatInfo5 << 10) | remainder) & 0x7FFF; // 15 bits

	// XOR with fixed mask 0x5412 per spec
	rawFormat ^= 0x5412;

	// Convert to array MSB -> LSB (15 bits)
	const bits: number[] = [];
	for (let i = 14; i >= 0; i--) bits.push((rawFormat >> i) & 1);
	return bits;
}

/**
 * @brief Place 15 format bits around finder patterns
 * @param matrix QR matrix (mutable)
 * @param maskPattern Mask index 0..7
 * @param ecl Error correction level
 */
export function placeFormatBits(matrix: boolean[][], maskPattern: number, ecl: 'L'|'M'|'Q'|'H') {
	const bits = computeFormatBits(maskPattern, ecl);
	const size = matrix.length;

	// Top-left placement order (MSB first)
	// Note: we skip (6,8) and (8,6) because those are timing pattern positions
	const tlPositions: [number, number][] = [
		[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7],
		[8, 8],
		[7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
	];

	// Safety: ensure matrix large enough
	if (size < 9) throw new Error('matrix size too small for format bits');

	// Place the 15 bits around top-left in the canonical order
	for (let i = 0; i < 15; i++) {
		const [r, c] = tlPositions[i];
		// defensive bounds check
		if (r >= 0 && r < size && c >= 0 && c < size) matrix[r][c] = !!bits[i];
	}

	// Duplicate the format bits:
	// - Top-right: bits[0..7] placed from (8, size-1) leftwards
	// - Bottom-left: bits[0..7] placed from (size-1, 8) upwards
	for (let i = 0; i <= 7; i++) {
		const topRightCol = size - 1 - i;
		const bottomLeftRow = size - 1 - i;
		// top-right: row 8, col size-1-i
		if (8 >= 0 && 8 < size && topRightCol >= 0 && topRightCol < size) {
			matrix[8][topRightCol] = !!bits[bits.length - 1 - i];
		}
		// bottom-left: row size-1-i, col 8
		if (bottomLeftRow >= 0 && bottomLeftRow < size && 8 >= 0 && 8 < size) {
			matrix[bottomLeftRow][8] = !!bits[i];
		}
	}
}


/**
 * @brief Compute 18-bit version information bits with BCH error correction
 * @param version QR version (7..40)
 * @returns 18-bit version information bits as boolean array (MSB first)
 */
function computeVersionBits(version: number): boolean[] {
	let POLY = 0b1111100100101; // generator polynomial: x^12 + x^11 + x^10 + x^9 + x^8 + x^5 + x^2 + 1

	if (version < 7 || version > 40) throw new Error('Version must be in range 7..40');
	
	// Version info is 6 bits (version number) shifted left by 12 bits
	let data = version << 12;
	
	// Perform binary polynomial long division to get remainder (12 bits)
	for (let bit = (17); bit >= 12; bit--) {
		if ((data >> bit) & 1) {
			data ^= (POLY << (bit - 12));
		}
	}
	const remainder = data & 0xFFF; // 12-bit remainder

	// Combine the 6-bit version + 12-bit remainder
	data = ((version << 12) | remainder) & 0x3FFFF; // 18 bits

	// Convert to boolean array MSB -> LSB (18 bits)
	const bits: boolean[] = [];
	for (let i = 17; i >= 0; i--) {
		bits.push(((data >> i) & 1) === 1);
	}

	return bits;
}

/**
 * @brief Place version bits in the QR matrix for versions 7 and above
 * @param matrix The QR code matrix to modify
 * @param version The QR code version (7..40)
 */
export function placeVersionBits(matrix: boolean[][], version: number) {
	if (version < 7) return;

	const size = matrix.length;
	const bits = computeVersionBits(version);

	for (let i = 0; i < 18; i++) {
		const r1 = Math.floor(i / 3);
		const c1 = size - 11 + (i % 3);
		const r2 = size - 11 + (i % 3);
		const c2 = Math.floor(i / 3);
		// Place in top-right area
		if (r1 >= 0 && r1 < size && c1 >= 0 && c1 < size)
			matrix[r1][c1] = bits[bits.length - 1 - i];
		// Place in bottom-left area
		if (r2 >= 0 && r2 < size && c2 >= 0 && c2 < size) {
			matrix[r2][c2] = bits[bits.length - 1 - i];
		}
	}
}