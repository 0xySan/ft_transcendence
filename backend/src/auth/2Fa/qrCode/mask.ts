/**
 * @file qrCode/mask.ts
 * @brief Functions to apply and choose data masks for QR code matrices.
 */

/**
 * @brief Apply the specified mask pattern to the QR matrix, skipping function/reserved modules.
 * @param matrix QR matrix to mask
 * @param mask Mask pattern number (0..7)
 * @param functionMask Boolean matrix indicating reserved/function modules
 * @returns Masked QR matrix
 */
export function applyMask(matrix: boolean[][], mask: number, functionMask: boolean[][]): boolean[][] {
	const size = matrix.length;
	const result: boolean[][] = matrix.map(row => [...row]);

	for (let r = 0; r < size; r++) {
		for (let c = 0; c < size; c++) {
			if (functionMask[r][c]) continue; // skip function/reserved modules
			switch (mask) {
				case 0: if ((r + c) % 2 === 0) result[r][c] = !result[r][c]; break;
				case 1: if (r % 2 === 0) result[r][c] = !result[r][c]; break;
				case 2: if (c % 3 === 0) result[r][c] = !result[r][c]; break;
				case 3: if ((r + c) % 3 === 0) result[r][c] = !result[r][c]; break;
				case 4: if ((Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0) result[r][c] = !result[r][c]; break;
				case 5: if ((((r * c) % 2) + ((r * c) % 3)) % 2 === 0) result[r][c] = !result[r][c]; break;
				case 6: if (((r * c) % 2 + (r * c) % 3) % 2 === 0) result[r][c] = !result[r][c]; break;
				case 7: if (((r + c) % 2 + (r * c) % 3) % 2 === 0) result[r][c] = !result[r][c]; break;
			}
		}
	}

	return result;
}

/**
 * @brief Calculate the penalty score for a QR matrix based on masking rules.
 * @param matrix QR matrix to evaluate
 * @returns Penalty score according to QR code masking rules
 */
function penaltyScore(matrix: boolean[][]): number {
	const size = matrix.length;
	let score = 0;

	// Rule 1: consecutive modules in row/col
	for (let r = 0; r < size; r++) {
		let count = 1;
		for (let c = 1; c < size; c++) {
			count = matrix[r][c] === matrix[r][c - 1] ? count + 1 : 1;
			if (count >= 5) score += 3 + (count - 5);
		}
	}
	for (let c = 0; c < size; c++) {
		let count = 1;
		for (let r = 1; r < size; r++) {
			count = matrix[r][c] === matrix[r - 1][c] ? count + 1 : 1;
			if (count >= 5) score += 3 + (count - 5);
		}
	}

	// Rule 2: 2x2 blocks of same color
	for (let r = 0; r < size - 1; r++) {
		for (let c = 0; c < size - 1; c++) {
			const val = matrix[r][c];
			if (matrix[r][c + 1] === val && matrix[r + 1][c] === val && matrix[r + 1][c + 1] === val) {
				score += 3;
			}
		}
	}

	// Rule 3: finder-like patterns
	const pattern1 = [true,false,true,true,true,false,true,false,false,false,false];
	const pattern2 = [false,false,false,false,true,false,true,true,true,false,true];
	const flatten = matrix.flat();
	for (let i = 0; i <= flatten.length - 11; i++) {
		let match1 = true;
		let match2 = true;
		for (let j = 0; j < 11; j++) {
			if (flatten[i + j] !== pattern1[j]) match1 = false;
			if (flatten[i + j] !== pattern2[j]) match2 = false;
		}
		if (match1 || match2) score += 40;
	}

	// Rule 4: balance of dark modules
	const total = flatten.length;
	const dark = flatten.filter(b => b).length;
	const percent = Math.floor((dark * 100) / total);
	const k = Math.floor(Math.abs(percent - 50) / 5);
	score += k * 10;

	return score;
}

/**
 * @brief Choose the best mask pattern for the QR matrix by evaluating penalty scores.
 * @param matrix QR matrix to evaluate
 * @param functionMask Boolean matrix indicating reserved/function modules
 * @returns Best mask pattern number (0..7)
 */
export function chooseBestMask(matrix: boolean[][], functionMask: boolean[][]): number {
	let bestMask = 0;
	let bestScore = Infinity;

	for (let mask = 0; mask < 8; mask++) {
		const masked = applyMask(matrix, mask, functionMask);
		const score = penaltyScore(masked);
		if (score < bestScore) {
			bestScore = score;
			bestMask = mask;
		}
	}
	return bestMask;
}